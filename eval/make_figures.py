"""
Generate publication/slide-ready vector figures from real Tier 2 result folders.

Reads summary.csv and per_run.csv via eval/compare_runs.py and writes SVG (+ PDF)
charts into docs/figures/ using black, grey, white, and a single accent (#1F4E79),
legible in grayscale with slide-sized typography (>= 17 pt). Also writes
CAPTIONS.md citing the exact source files behind each figure.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR))

from compare_runs import RunData, load_run  # noqa: E402

ACCENT = "#1F4E79"
BLACK = "#111111"
GREY_LIGHT = "#D9D9D9"
GREY_GRID = "#D0D0D0"
GREY_TEXT = "#4A4A4A"


def _configure_style() -> None:
    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.sans-serif": ["DejaVu Sans", "Arial", "Helvetica"],
        "font.size": 17,
        "axes.titlesize": 20,
        "axes.titleweight": "bold",
        "axes.labelsize": 18,
        "xtick.labelsize": 17,
        "ytick.labelsize": 17,
        "legend.fontsize": 17,
        "axes.edgecolor": BLACK,
        "axes.linewidth": 1.2,
        "figure.facecolor": "#FFFFFF",
        "axes.facecolor": "#FFFFFF",
        "svg.fonttype": "none",
    })


def _clean_axes(ax: plt.Axes) -> None:
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", color=GREY_GRID, linestyle="--", linewidth=0.9, alpha=0.8)
    ax.set_axisbelow(True)


def _save_both(fig: plt.Figure, out_dir: Path, stem: str, formats: list[str]) -> list[Path]:
    paths: list[Path] = []
    for fmt in formats:
        p = out_dir / f"{stem}.{fmt}"
        fig.savefig(p, format=fmt, bbox_inches="tight")
        paths.append(p)
    plt.close(fig)
    return paths


def plot_detection_rates(
    before: RunData,
    after: RunData,
    level: str,
    out_dir: Path,
    formats: list[str],
) -> list[Path]:
    attacks: list[str] = list(before.attacks_order)
    for a in after.attacks_order:
        if a not in attacks:
            attacks.append(a)

    x = np.arange(len(attacks))
    w = 0.37

    b_rates, b_err_lo, b_err_hi, b_labels = [], [], [], []
    a_rates, a_err_lo, a_err_hi, a_labels = [], [], [], []
    for atk in attacks:
        b = before.attacks.get((level, atk))
        a = after.attacks.get((level, atk))
        if b:
            b_rates.append(b.rate * 100.0)
            b_err_lo.append(max(0.0, (b.rate - b.ci_low) * 100.0))
            b_err_hi.append(max(0.0, (b.ci_high - b.rate) * 100.0))
            b_labels.append(f"{b.hits}/{b.total}")
        else:
            b_rates.append(0.0); b_err_lo.append(0.0); b_err_hi.append(0.0); b_labels.append("n/a")
        if a:
            a_rates.append(a.rate * 100.0)
            a_err_lo.append(max(0.0, (a.rate - a.ci_low) * 100.0))
            a_err_hi.append(max(0.0, (a.ci_high - a.rate) * 100.0))
            a_labels.append(f"{a.hits}/{a.total}")
        else:
            a_rates.append(0.0); a_err_lo.append(0.0); a_err_hi.append(0.0); a_labels.append("n/a")

    fig, ax = plt.subplots(figsize=(13.5, 6.8))
    _clean_axes(ax)

    bars_b = ax.bar(
        x - w / 2,
        b_rates,
        width=w,
        color=GREY_LIGHT,
        edgecolor=BLACK,
        linewidth=1.3,
        hatch="///",
        label=before.label,
    )
    bars_a = ax.bar(
        x + w / 2,
        a_rates,
        width=w,
        color=ACCENT,
        edgecolor=BLACK,
        linewidth=1.3,
        label=after.label,
    )

    ax.errorbar(
        x - w / 2,
        b_rates,
        yerr=[b_err_lo, b_err_hi],
        fmt="none",
        ecolor=BLACK,
        elinewidth=1.4,
        capsize=4,
    )
    ax.errorbar(
        x + w / 2,
        a_rates,
        yerr=[a_err_lo, a_err_hi],
        fmt="none",
        ecolor=BLACK,
        elinewidth=1.4,
        capsize=4,
    )

    for rect, hi, lbl in zip(bars_b, b_err_hi, b_labels):
        h = rect.get_height()
        ax.text(
            rect.get_x() + rect.get_width() / 2,
            min(111.0, h + hi + 2.5),
            lbl,
            ha="center",
            va="bottom",
            fontsize=17,
            color=GREY_TEXT,
        )
    for rect, hi, lbl in zip(bars_a, a_err_hi, a_labels):
        h = rect.get_height()
        ax.text(
            rect.get_x() + rect.get_width() / 2,
            min(111.0, h + hi + 2.5),
            lbl,
            ha="center",
            va="bottom",
            fontsize=17,
            fontweight="bold",
            color=BLACK,
        )

    ax.set_xticks(x)
    ax.set_xticklabels([a.replace("_", "\n") for a in attacks], fontsize=17)
    ax.set_ylabel("Detection rate (%) [95% Wilson CI]", fontsize=18)
    ax.set_ylim(0, 118)
    ax.set_title(f"Tier 2 Attack Detection Rate — Alarm Level: {level}", pad=16)
    ax.legend(frameon=False, loc="upper right", ncols=2)

    return _save_both(fig, out_dir, f"detection_rate_{level}", formats)


def plot_false_alarms(
    before: RunData,
    after: RunData,
    out_dir: Path,
    formats: list[str],
) -> list[Path]:
    # False alarms are identical across degraded/tripped in summary, show tripped level explicitly
    level = "tripped"
    bc = before.clean[level]
    ac = after.clean[level]

    labels = [
        f"{before.label}\n({bc.videos} clips, {bc.hours:.2f} clean h)",
        f"{after.label}\n({ac.videos} clips, {ac.hours:.2f} clean h)",
    ]
    vals = [bc.fa_per_hour, ac.fa_per_hour]
    err_lo = [max(0.0, bc.fa_per_hour - bc.ci_low), max(0.0, ac.fa_per_hour - ac.ci_low)]
    err_hi = [max(0.0, bc.ci_high - bc.fa_per_hour), max(0.0, ac.ci_high - ac.fa_per_hour)]

    fig, ax = plt.subplots(figsize=(9.5, 6.2))
    _clean_axes(ax)

    x = np.array([0, 1])
    colors = [GREY_LIGHT, ACCENT]
    hatches = ["///", ""]
    for i in range(2):
        ax.bar(
            x[i],
            vals[i],
            width=0.45,
            color=colors[i],
            edgecolor=BLACK,
            linewidth=1.4,
            hatch=hatches[i],
        )

    ax.errorbar(
        x,
        vals,
        yerr=[err_lo, err_hi],
        fmt="none",
        ecolor=BLACK,
        elinewidth=1.6,
        capsize=6,
    )

    notes = [
        f"{bc.fa_per_hour:.1f}/h\n(k={bc.false_alarms}, 95% CI [{bc.ci_low:.1f}, {bc.ci_high:.1f}])",
        f"{ac.fa_per_hour:.1f}/h\n(k={ac.false_alarms}, 95% CI [{ac.ci_low:.1f}, {ac.ci_high:.1f}])",
    ]
    top_y = max(vals[0] + err_hi[0], vals[1] + err_hi[1], 10.0)
    for i in range(2):
        ax.text(
            x[i],
            vals[i] + err_hi[i] + top_y * 0.03,
            notes[i],
            ha="center",
            va="bottom",
            fontsize=17,
            fontweight="bold" if i == 1 else "normal",
            color=BLACK,
        )

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=17)
    ax.set_ylabel("Clean false alarms per hour [exact 95% Poisson CI]", fontsize=18)
    ax.set_ylim(0, top_y * 1.24)
    ax.set_title("Clean Footage False-Alarm Rate (Baseline vs. v2)", pad=16)

    return _save_both(fig, out_dir, "false_alarms_per_hour", formats)


def write_captions(
    before: RunData,
    after: RunData,
    out_dir: Path,
    generated: dict[str, list[Path]],
) -> Path:
    lines = [
        "# Tier 2 Real-Footage Figures — Data Sources & Captions",
        "",
        "All figures are generated directly by `eval/make_figures.py` from saved CSV results.",
        "",
        "## Input Data Files",
        f"- **Before ({before.label}, `{before.detector}`):** `{before.folder / 'summary.csv'}` and `{before.folder / 'per_run.csv'}` ({before.clean['tripped'].videos} videos, {before.clean['tripped'].hours:.3f} clean h)",
        f"- **After ({after.label}, `{after.detector}`):** `{after.folder / 'summary.csv'}` and `{after.folder / 'per_run.csv'}` ({after.clean['tripped'].videos} videos, {after.clean['tripped'].hours:.3f} clean h)",
        "",
        "## Figures",
    ]
    descriptions = {
        "detection_rate_tripped": (
            "Attack detection rate at the `tripped` (`liveness <= 0.50`) gate level across 8 tamper transforms, "
            "showing 95% Wilson binomial confidence intervals."
        ),
        "detection_rate_degraded": (
            "Attack detection rate at the `degraded` (`liveness < 0.85`) gate level across 8 tamper transforms, "
            "showing 95% Wilson binomial confidence intervals."
        ),
        "false_alarms_per_hour": (
            "Untouched clean-footage false alarms per hour at `tripped` (`<= 0.50`) with exact 95% Garwood Poisson intervals, "
            f"reflecting finite clean duration ({before.clean['tripped'].hours:.3f} h before, {after.clean['tripped'].hours:.3f} h after)."
        ),
    }
    for stem, files in generated.items():
        names = ", ".join(f"`{p.name}`" for p in files)
        lines.append(f"- **{stem}** ({names}): {descriptions[stem]}")
    lines.append("")
    cap = out_dir / "CAPTIONS.md"
    cap.write_text("\n".join(lines), encoding="utf-8")
    return cap


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--before", required=True, type=Path)
    ap.add_argument("--after", required=True, type=Path)
    ap.add_argument("--before-label", type=str, default=None)
    ap.add_argument("--after-label", type=str, default=None)
    ap.add_argument("--out-dir", type=Path, default=Path("docs/figures"))
    ap.add_argument("--formats", default="svg,pdf", help="comma-separated vector formats (default svg,pdf)")
    args = ap.parse_args()

    formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    _configure_style()

    before = load_run(args.before, args.before_label)
    after = load_run(args.after, args.after_label)

    generated = {
        "detection_rate_tripped": plot_detection_rates(before, after, "tripped", args.out_dir, formats),
        "detection_rate_degraded": plot_detection_rates(before, after, "degraded", args.out_dir, formats),
        "false_alarms_per_hour": plot_false_alarms(before, after, args.out_dir, formats),
    }
    cap = write_captions(before, after, args.out_dir, generated)
    print(f"Wrote figures and {cap} from {args.before} and {args.after}")


if __name__ == "__main__":
    main()
