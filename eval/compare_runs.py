"""
Compare two real-footage Tier 2 evaluation folders (e.g. baseline v1 vs tuned v2).

Reads summary.csv and per_run.csv (and optional summary.md metadata) from two
result directories produced by eval/tier2_real_footage.py and generates a unified
before/after table in Markdown and CSV formats, including:
  - detection rate per attack at both alarm levels (`degraded`, `tripped`)
  - 95% Wilson binomial confidence intervals for detection rates
  - median detection delay in seconds
  - clean false alarms per hour with exact 95% Poisson confidence intervals
  - evaluated video counts and exact clean-evaluation hours

Every number is computed directly from the saved CSV files.
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path

Z_95 = 1.959963984540054


def wilson_ci(k: int, n: int, z: float = Z_95) -> tuple[float, float]:
    """Return 95% Wilson score binomial confidence interval (low, high) in [0, 1]."""
    if n <= 0:
        return 0.0, 0.0
    p = k / n
    z2 = z * z
    denom = 1.0 + z2 / n
    center = (p + z2 / (2.0 * n)) / denom
    half = (z * math.sqrt((p * (1.0 - p) + z2 / (4.0 * n)) / n)) / denom
    return max(0.0, center - half), min(1.0, center + half)


def _poisson_upper_tail(k: int, lam: float) -> float:
    """Compute P(X >= k | X ~ Poisson(lam)) stably in log-space for k >= 1."""
    if lam <= 0.0:
        return 0.0 if k > 0 else 1.0
    # Complement of sum_{i=0}^{k-1} exp(-lam) * lam^i / i!
    log_lam = math.log(lam)
    cdf = 0.0
    for i in range(k):
        cdf += math.exp(-lam + i * log_lam - math.lgamma(i + 1))
    return max(0.0, min(1.0, 1.0 - cdf))


def _poisson_lower_tail(k: int, lam: float) -> float:
    """Compute P(X <= k | X ~ Poisson(lam)) stably in log-space."""
    if lam <= 0.0:
        return 1.0
    log_lam = math.log(lam)
    total = 0.0
    for i in range(k + 1):
        total += math.exp(-lam + i * log_lam - math.lgamma(i + 1))
    return max(0.0, min(1.0, total))


def _bisect_poisson_count_low(k: int, alpha: float) -> float:
    """Solve P(X >= k | lam) = alpha / 2 for lam (Garwood lower Poisson count bound)."""
    if k <= 0:
        return 0.0
    target = alpha / 2.0
    lo, hi = 0.0, float(max(10, k * 2 + 20))
    while _poisson_upper_tail(k, hi) < target:
        hi *= 2.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if _poisson_upper_tail(k, mid) < target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def _bisect_poisson_count_high(k: int, alpha: float) -> float:
    """Solve P(X <= k | lam) = alpha / 2 for lam (Garwood upper Poisson count bound)."""
    target = alpha / 2.0
    lo, hi = float(max(0, k)), float(max(12, k * 2 + 25))
    while _poisson_lower_tail(k, hi) > target:
        hi *= 2.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if _poisson_lower_tail(k, mid) > target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def poisson_rate_ci(k: int, hours: float, alpha: float = 0.05) -> tuple[float, float, float]:
    """Return (rate_per_hour, ci95_low, ci95_high) using exact Garwood Poisson bounds."""
    if hours <= 0.0:
        return 0.0, 0.0, 0.0
    try:
        from scipy.stats import chi2

        low_count = 0.0 if k <= 0 else 0.5 * float(chi2.ppf(alpha / 2.0, 2 * k))
        high_count = 0.5 * float(chi2.ppf(1.0 - alpha / 2.0, 2 * (k + 1)))
    except ImportError:
        low_count = _bisect_poisson_count_low(k, alpha)
        high_count = _bisect_poisson_count_high(k, alpha)
    return k / hours, low_count / hours, high_count / hours


@dataclass
class AttackStats:
    hits: int
    total: int
    rate: float
    ci_low: float
    ci_high: float
    median_delay_s: float | None


@dataclass
class CleanStats:
    videos: int
    hours: float
    false_alarms: int
    videos_with_fa: int
    fa_per_hour: float
    ci_low: float
    ci_high: float


@dataclass
class RunData:
    folder: Path
    label: str
    detector: str
    date: str
    dropped_note: str
    attacks_order: list[str]
    attacks: dict[tuple[str, str], AttackStats]
    clean: dict[str, CleanStats]


def _parse_summary_md(md_path: Path) -> tuple[str, str, str, str]:
    label = md_path.parent.name
    detector = "unknown"
    date = ""
    dropped_note = ""
    if not md_path.exists():
        return label, detector, date, dropped_note
    text = md_path.read_text(encoding="utf-8")
    m_head = re.search(r"detector\s+([^\s]+)", text)
    if m_head:
        detector = m_head.group(1).strip()
    m_ds = re.search(r"^\s*-\s*Dataset:\s*(.+)$", text, flags=re.MULTILINE)
    if m_ds:
        label = m_ds.group(1).strip()
    m_dt = re.search(r"^\s*-\s*Date:\s*(.+)$", text, flags=re.MULTILINE)
    if m_dt:
        date = m_dt.group(1).strip()
    m_clips = re.search(r"^\s*-\s*Clips:\s*(.+)$", text, flags=re.MULTILINE)
    if m_clips:
        dropped_note = m_clips.group(1).strip()
    return label, detector, date, dropped_note


def load_run(folder: Path, label_override: str | None = None) -> RunData:
    """Load and cross-check summary.csv and per_run.csv from a result folder."""
    summary_csv = folder / "summary.csv"
    per_run_csv = folder / "per_run.csv"
    summary_md = folder / "summary.md"

    if not summary_csv.exists():
        sys.exit(f"Missing required file: {summary_csv}")
    if not per_run_csv.exists():
        sys.exit(f"Missing required file: {per_run_csv}")

    label, detector, date, dropped_note = _parse_summary_md(summary_md)
    if label_override:
        label = label_override

    with summary_csv.open(encoding="utf-8", newline="") as f:
        sum_rows = list(csv.DictReader(f))
    with per_run_csv.open(encoding="utf-8", newline="") as f:
        per_rows = list(csv.DictReader(f))

    attacks_order: list[str] = []
    attacks: dict[tuple[str, str], AttackStats] = {}
    clean: dict[str, CleanStats] = {}

    for level in ("degraded", "tripped"):
        lvl_sum = [r for r in sum_rows if r["level"] == level]
        lvl_per = [r for r in per_rows if r["level"] == level]

        clean_per = [r for r in lvl_per if r["run"] == "clean"]
        if clean_per:
            hours = sum(float(r["seconds"]) for r in clean_per) / 3600.0
            fa = sum(int(float(r["false_alarms"])) for r in clean_per)
            videos = len(clean_per)
            videos_with_fa = sum(1 for r in clean_per if int(float(r["false_alarms"])) > 0)
        else:
            csum = [r for r in lvl_sum if r["run"] == "clean"]
            if not csum:
                sys.exit(f"No clean row found for level '{level}' in {folder}")
            videos = int(csum[0]["total"])
            hours = float(csum[0]["clean_hours"])
            fa = int(csum[0]["clean_false_alarms"])
            videos_with_fa = 0

        rate, ci_lo, ci_hi = poisson_rate_ci(fa, hours)
        clean[level] = CleanStats(
            videos=videos,
            hours=hours,
            false_alarms=fa,
            videos_with_fa=videos_with_fa,
            fa_per_hour=rate,
            ci_low=ci_lo,
            ci_high=ci_hi,
        )

        # Preserve order of attacks from summary.csv
        for row in lvl_sum:
            run_name = row["run"]
            if run_name == "clean":
                continue
            if run_name not in attacks_order:
                attacks_order.append(run_name)

            a_per = [r for r in lvl_per if r["run"] == run_name]
            if a_per:
                total = len(a_per)
                hits_rows = [r for r in a_per if str(r["detected"]).strip().lower() == "true"]
                hits = len(hits_rows)
                delays = [float(r["delay_s"]) for r in hits_rows if str(r["delay_s"]).strip() != ""]
                med = statistics.median(delays) if delays else None
            else:
                hits = int(row["detected"])
                total = int(row["total"])
                med = None if row["median_delay_s"] in ("", "n/a") else float(row["median_delay_s"])

            lo, hi = wilson_ci(hits, total)
            attacks[(level, run_name)] = AttackStats(
                hits=hits,
                total=total,
                rate=(hits / total) if total > 0 else 0.0,
                ci_low=lo,
                ci_high=hi,
                median_delay_s=med,
            )

    return RunData(
        folder=folder,
        label=label,
        detector=detector,
        date=date,
        dropped_note=dropped_note,
        attacks_order=attacks_order,
        attacks=attacks,
        clean=clean,
    )


def _fmt_pct_ci(st: AttackStats | None) -> str:
    if st is None:
        return "n/a"
    return f"{st.hits}/{st.total} ({st.rate * 100:.1f}%) [{st.ci_low * 100:.1f}, {st.ci_high * 100:.1f}]%"


def _fmt_delay(st: AttackStats | None) -> str:
    if st is None or st.median_delay_s is None:
        return "n/a"
    return f"{st.median_delay_s:.2f}"


def _fmt_fa(cl: CleanStats | None) -> str:
    if cl is None:
        return "n/a"
    return f"{cl.fa_per_hour:.1f}/h [{cl.ci_low:.1f}, {cl.ci_high:.1f}] ({cl.false_alarms} over {cl.hours:.3f}h, {cl.videos} vids)"


def build_csv_rows(before: RunData, after: RunData) -> list[dict[str, object]]:
    """Build machine-readable CSV comparison rows for both alarm levels."""
    all_attacks: list[str] = list(before.attacks_order)
    for a in after.attacks_order:
        if a not in all_attacks:
            all_attacks.append(a)

    rows: list[dict[str, object]] = []
    for level in ("degraded", "tripped"):
        for atk in all_attacks:
            b = before.attacks.get((level, atk))
            a = after.attacks.get((level, atk))
            rows.append({
                "level": level,
                "metric": atk,
                "kind": "detection_rate",
                "before_hits": b.hits if b else "",
                "before_total": b.total if b else "",
                "before_value": f"{b.rate:.4f}" if b else "",
                "before_ci95_low": f"{b.ci_low:.4f}" if b else "",
                "before_ci95_high": f"{b.ci_high:.4f}" if b else "",
                "before_median_delay_s": "" if (b is None or b.median_delay_s is None) else f"{b.median_delay_s:.2f}",
                "before_videos": before.clean[level].videos,
                "before_clean_hours": f"{before.clean[level].hours:.4f}",
                "after_hits": a.hits if a else "",
                "after_total": a.total if a else "",
                "after_value": f"{a.rate:.4f}" if a else "",
                "after_ci95_low": f"{a.ci_low:.4f}" if a else "",
                "after_ci95_high": f"{a.ci_high:.4f}" if a else "",
                "after_median_delay_s": "" if (a is None or a.median_delay_s is None) else f"{a.median_delay_s:.2f}",
                "after_videos": after.clean[level].videos,
                "after_clean_hours": f"{after.clean[level].hours:.4f}",
            })
        bc = before.clean[level]
        ac = after.clean[level]
        rows.append({
            "level": level,
            "metric": "clean_fa_per_hour",
            "kind": "poisson_rate",
            "before_hits": bc.false_alarms,
            "before_total": bc.videos,
            "before_value": f"{bc.fa_per_hour:.3f}",
            "before_ci95_low": f"{bc.ci_low:.3f}",
            "before_ci95_high": f"{bc.ci_high:.3f}",
            "before_median_delay_s": "",
            "before_videos": bc.videos,
            "before_clean_hours": f"{bc.hours:.4f}",
            "after_hits": ac.false_alarms,
            "after_total": ac.videos,
            "after_value": f"{ac.fa_per_hour:.3f}",
            "after_ci95_low": f"{ac.ci_low:.3f}",
            "after_ci95_high": f"{ac.ci_high:.3f}",
            "after_median_delay_s": "",
            "after_videos": ac.videos,
            "after_clean_hours": f"{ac.hours:.4f}",
        })
    return rows


def build_markdown(before: RunData, after: RunData) -> str:
    """Build Markdown comparison report."""
    all_attacks: list[str] = list(before.attacks_order)
    for a in after.attacks_order:
        if a not in all_attacks:
            all_attacks.append(a)

    lines = [
        f"# Tier 2 Comparison: {before.label} vs. {after.label}",
        "",
        f"- Before folder: `{before.folder}` (`{before.detector}`, {before.clean['tripped'].videos} videos, {before.clean['tripped'].hours:.3f} clean h"
        + (f", {before.dropped_note}" if before.dropped_note else "")
        + ")",
        f"- After folder: `{after.folder}` (`{after.detector}`, {after.clean['tripped'].videos} videos, {after.clean['tripped'].hours:.3f} clean h"
        + (f", {after.dropped_note}" if after.dropped_note else "")
        + ")",
        "- Intervals: 95% Wilson binomial CIs for detection rates; exact 95% Garwood Poisson CIs for false alarms/hour.",
        "",
        "| Level | Run | Before (rate, 95% CI) | Before delay (s) | After (rate, 95% CI) | After delay (s) |",
        "|---|---|---|---|---|---|",
    ]
    for level in ("degraded", "tripped"):
        for atk in all_attacks:
            b = before.attacks.get((level, atk))
            a = after.attacks.get((level, atk))
            lines.append(
                f"| {level} | {atk} | {_fmt_pct_ci(b)} | {_fmt_delay(b)} | {_fmt_pct_ci(a)} | {_fmt_delay(a)} |"
            )
        lines.append(
            f"| {level} | **clean FA/hour** | {_fmt_fa(before.clean[level])} | n/a | {_fmt_fa(after.clean[level])} | n/a |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--before", required=True, type=Path, help="baseline result directory")
    ap.add_argument("--after", required=True, type=Path, help="v2 / tuned result directory")
    ap.add_argument("--before-label", type=str, default=None)
    ap.add_argument("--after-label", type=str, default=None)
    ap.add_argument("--out-dir", type=Path, default=None, help="if set, write comparison.md and comparison.csv here")
    ap.add_argument("--out-md", type=Path, default=None)
    ap.add_argument("--out-csv", type=Path, default=None)
    args = ap.parse_args()

    before = load_run(args.before, args.before_label)
    after = load_run(args.after, args.after_label)

    md_text = build_markdown(before, after)
    csv_rows = build_csv_rows(before, after)

    out_md = args.out_md or (args.out_dir / "comparison.md" if args.out_dir else None)
    out_csv = args.out_csv or (args.out_dir / "comparison.csv" if args.out_dir else None)

    if out_md:
        out_md.parent.mkdir(parents=True, exist_ok=True)
        out_md.write_text(md_text, encoding="utf-8")
    if out_csv:
        out_csv.parent.mkdir(parents=True, exist_ok=True)
        with out_csv.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys()))
            writer.writeheader()
            writer.writerows(csv_rows)

    print(md_text)
    if out_md or out_csv:
        print("Wrote:", ", ".join(str(p) for p in (out_md, out_csv) if p))


if __name__ == "__main__":
    main()
