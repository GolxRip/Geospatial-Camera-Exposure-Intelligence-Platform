"""
Tier 2 evaluation on real surveillance footage.

Takes clean, real videos, injects tampering at a known moment, runs the liveness
tracker frame by frame, and measures:

  - detection rate per attack type (fraction of videos where an alarm fires after onset
    that the same video's clean run did not also raise at that moment)
  - detection delay in seconds
  - false alarms on the untouched clean videos, per hour of footage

Two alarm levels are reported, matching the gate in the paper:
  degraded : liveness < 0.85  (theta_high, gate starts tapering)
  tripped  : liveness <= 0.50 (theta_low, hard cap)

Input: a folder of videos (.mp4/.avi/.mov/.mkv) and/or frame folders (a folder of
.jpg/.png frames, e.g. CDnet's <video>/input/). Every video is used twice or more:
once clean, once per attack.

    python eval/tier2_real_footage.py --data ~/datasets/cdnet --out eval/results/tier2
    python eval/tier2_real_footage.py --data clips/ --attacks freeze,loop,blur --max-seconds 120

Nothing here is tuned to the data. Thresholds come from the detector as shipped, so the
first run is an honest baseline. Tune on one set of videos and report on a different one.
"""

from __future__ import annotations

import argparse
import csv
import importlib
import shlex
import statistics
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "video_pipeline"))

VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp"}
DEGRADED, TRIPPED = 0.85, 0.50


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

@dataclass
class Clip:
    name: str
    frames: list[np.ndarray]
    fps: float

    @property
    def seconds(self) -> float:
        return len(self.frames) / self.fps


def _resize(frame: np.ndarray, width: int) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= width:
        return frame
    return cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)


def load_video(path: Path, width: int, max_seconds: float) -> Clip | None:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    if not (1 <= fps <= 120):
        fps = 25.0
    frames, limit = [], int(max_seconds * fps)
    while len(frames) < limit:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(_resize(frame, width))
    cap.release()
    return Clip(path.stem, frames, fps) if frames else None


def load_frame_dir(path: Path, width: int, max_seconds: float, fps: float) -> Clip | None:
    files = sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_EXT)[: int(max_seconds * fps)]
    frames = [f for f in (cv2.imread(str(p)) for p in files) if f is not None]
    name = path.parent.name if path.name == "input" else path.name
    return Clip(name, [_resize(f, width) for f in frames], fps) if frames else None


def discover(root: Path, width: int, max_seconds: float, dir_fps: float, min_seconds: float) -> list[Clip]:
    clips = []
    for p in sorted(root.rglob("*")):
        if p.is_file() and p.suffix.lower() in VIDEO_EXT:
            c = load_video(p, width, max_seconds)
        elif p.is_dir() and any(q.suffix.lower() in IMAGE_EXT for q in p.iterdir()):
            c = load_frame_dir(p, width, max_seconds, dir_fps)
        else:
            continue
        if not c:
            continue
        if c.seconds >= min_seconds:
            clips.append(c)
            print(f"  loaded {c.name}: {len(c.frames)} frames, {c.seconds:.1f}s @ {c.fps:.0f}fps")
        else:
            print(f"  skipped {c.name}: {c.seconds:.1f}s < --min-seconds {min_seconds:.1f}")
    return clips


# ---------------------------------------------------------------------------
# Attacks. Each returns (tampered frame list, onset frame index).
# ---------------------------------------------------------------------------

def _onset(n: int) -> int:
    return int(n * 0.4)


def attack_freeze(frames, fps):
    t0 = _onset(len(frames))
    return frames[:t0] + [frames[t0]] * (len(frames) - t0), t0


def attack_loop(frames, fps, loop_seconds=5.0):
    """Replay the last few seconds before onset over and over (RTSP loop injection)."""
    t0 = _onset(len(frames))
    seg = frames[max(0, t0 - int(loop_seconds * fps)): t0]
    tail = [seg[i % len(seg)] for i in range(len(frames) - t0)]
    return frames[:t0] + tail, t0


def attack_blur(frames, fps):
    t0 = _onset(len(frames))
    return frames[:t0] + [cv2.GaussianBlur(f, (0, 0), 6) for f in frames[t0:]], t0


def attack_slow_blur(frames, fps, ramp_seconds=60.0):
    """Defocus that ramps up slowly, the way a lens is turned by hand or fogs over."""
    t0, ramp = _onset(len(frames)), max(1, int(ramp_seconds * fps))
    out = frames[:t0]
    for i, f in enumerate(frames[t0:]):
        sigma = 0.1 + 6.0 * min(1.0, i / ramp)
        out.append(cv2.GaussianBlur(f, (0, 0), sigma))
    return out, t0


def attack_cover(frames, fps):
    t0 = _onset(len(frames))
    rng = np.random.default_rng(0)
    out = frames[:t0]
    for f in frames[t0:]:
        dark = np.full_like(f, 18)
        noise = rng.integers(0, 6, size=f.shape, dtype=np.uint8)  # real sensors are never perfectly flat
        out.append(cv2.add(dark, noise))
    return out, t0


def attack_partial_cover(frames, fps):
    t0 = _onset(len(frames))
    out = frames[:t0]
    for f in frames[t0:]:
        g = f.copy()
        h, w = g.shape[:2]
        cv2.ellipse(g, (int(w * 0.35), int(h * 0.45)), (int(w * 0.38), int(h * 0.42)), 0, 0, 360, (25, 25, 25), -1)
        out.append(g)
    return out, t0


def attack_moved(frames, fps):
    """Camera pointed somewhere else: shift and rotate the view."""
    t0 = _onset(len(frames))
    h, w = frames[0].shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), 12, 1.25)
    m[0, 2] += w * 0.2
    out = frames[:t0] + [cv2.warpAffine(f, m, (w, h), borderMode=cv2.BORDER_REFLECT) for f in frames[t0:]]
    return out, t0


def attack_downscale(frames, fps):
    """Low-resolution decoy relayed at the original size."""
    t0 = _onset(len(frames))
    h, w = frames[0].shape[:2]
    small = lambda f: cv2.resize(cv2.resize(f, (w // 5, h // 5), interpolation=cv2.INTER_AREA), (w, h))
    return frames[:t0] + [small(f) for f in frames[t0:]], t0


ATTACKS = {
    "freeze": attack_freeze,
    "loop": attack_loop,
    "blur": attack_blur,
    "slow_blur": attack_slow_blur,
    "cover": attack_cover,
    "partial_cover": attack_partial_cover,
    "moved": attack_moved,
    "downscale": attack_downscale,
}


# ---------------------------------------------------------------------------
# Running the detector
# ---------------------------------------------------------------------------

def load_detector(spec: str):
    module, cls = spec.split(":")
    return getattr(importlib.import_module(module), cls)


def run(detector_cls, frames, fps) -> np.ndarray:
    tracker = detector_cls(camera_id="eval")
    return np.array([tracker.process_frame(f, i, i / fps)["liveness_score"] for i, f in enumerate(frames)])


def episodes(below: np.ndarray, min_len: int) -> int:
    """Count separate alarm episodes lasting at least min_len frames."""
    count, run_len = 0, 0
    for b in below:
        run_len = run_len + 1 if b else 0
        if run_len == min_len:
            count += 1
    return count


def first_alarm(scores: np.ndarray, clean: np.ndarray, t0: int, thr: float, inclusive: bool,
                min_len: int) -> int | None:
    """First sustained alarm after onset that the clean run did NOT also raise at that moment.

    Without the clean comparison, a detector that false-alarms on a quiet scene gets
    credited with "detecting" every attack on that scene.
    """
    alarm = (lambda x: x <= thr) if inclusive else (lambda x: x < thr)
    below = alarm(scores[t0:]) & ~alarm(clean[t0:len(scores)])
    run_len = 0
    for i, b in enumerate(below):
        run_len = run_len + 1 if b else 0
        if run_len >= min_len:
            return i - min_len + 1
    return None


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, type=Path, help="folder of videos and/or frame folders")
    ap.add_argument("--out", type=Path, default=ROOT / "eval" / "results" / "tier2")
    ap.add_argument("--dataset", type=str, default=None, help="dataset name recorded in summary.md (defaults to --data folder name)")
    ap.add_argument("--detector", default="liveness_detector:FrameLivenessTracker")
    ap.add_argument("--attacks", default=",".join(ATTACKS))
    ap.add_argument("--width", type=int, default=640, help="downscale frames to this width for speed")
    ap.add_argument("--max-seconds", type=float, default=180)
    ap.add_argument("--min-seconds", type=float, default=20.0, help="minimum clip duration in seconds to include (default 20)")
    ap.add_argument("--dir-fps", type=float, default=25, help="fps to assume for frame folders")
    ap.add_argument("--min-alarm-seconds", type=float, default=1.0,
                    help="an alarm must persist this long to count (filters single-frame flicker)")
    args = ap.parse_args()

    detector_cls = load_detector(args.detector)
    attacks = [a.strip() for a in args.attacks.split(",") if a.strip()]
    unknown = [a for a in attacks if a not in ATTACKS]
    if unknown:
        sys.exit(f"Unknown attack(s): {', '.join(unknown)}. Choices: {', '.join(ATTACKS)}")

    print(f"Loading footage from {args.data} ...")
    clips = discover(args.data, args.width, args.max_seconds, args.dir_fps, args.min_seconds)
    if not clips:
        sys.exit(f"No usable videos found (each needs at least {args.min_seconds:g} seconds).")

    dataset_label = args.dataset or args.data.resolve().name
    run_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    cmd_str = "python3 eval/tier2_real_footage.py " + " ".join(shlex.quote(a) for a in sys.argv[1:])

    args.out.mkdir(parents=True, exist_ok=True)
    rows = []

    for c in clips:
        min_len = max(1, int(args.min_alarm_seconds * c.fps))
        clean = run(detector_cls, c.frames, c.fps)
        warm = min(int(10 * c.fps), int(0.35 * len(c.frames)))  # let baseline settle without exceeding clip length
        clean_secs = max(0.1, round((len(c.frames) - warm) / c.fps, 1))
        for level, thr, incl in (("degraded", DEGRADED, False), ("tripped", TRIPPED, True)):
            below = (clean[warm:] <= thr) if incl else (clean[warm:] < thr)
            rows.append(dict(video=c.name, run="clean", level=level, seconds=clean_secs,
                             false_alarms=episodes(below, min_len),
                             frac_time_alarmed=round(float(below.mean()), 4)))
        print(f"{c.name}: clean done")

        for a in attacks:
            tampered, t0 = ATTACKS[a](list(c.frames), c.fps)
            scores = run(detector_cls, tampered, c.fps)
            for level, thr, incl in (("degraded", DEGRADED, False), ("tripped", TRIPPED, True)):
                d = first_alarm(scores, clean, t0, thr, incl, min_len)
                rows.append(dict(video=c.name, run=a, level=level, detected=d is not None,
                                 delay_s=None if d is None else round(d / c.fps, 2),
                                 min_score_after=round(float(scores[t0:].min()), 3)))
            print(f"{c.name}: {a} done")

    per_run = args.out / "per_run.csv"
    keys = ["video", "run", "level", "seconds", "false_alarms", "frac_time_alarmed",
            "detected", "delay_s", "min_score_after"]
    with per_run.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)

    summary_rows = []
    lines = [
        f"# Tier 2 on real footage: {len(clips)} videos, detector {args.detector}",
        "",
        f"- Dataset: {dataset_label}",
        f"- Date: {run_utc}",
        f"- Command: `{cmd_str}`",
        "",
    ]
    for level in ("degraded", "tripped"):
        lines += [f"## Alarm level: {level}", "", "| Run | Detected | Median delay (s) |", "|---|---|---|"]
        cl = [r for r in rows if r["run"] == "clean" and r["level"] == level]
        hours = sum(r["seconds"] for r in cl) / 3600
        fa = sum(r["false_alarms"] for r in cl)
        fa_rate = (fa / hours) if hours > 0 else 0.0
        for a in attacks:
            rs = [r for r in rows if r["run"] == a and r["level"] == level]
            hits = [r for r in rs if r["detected"]]
            med = f"{statistics.median(r['delay_s'] for r in hits):.1f}" if hits else "n/a"
            lines.append(f"| {a} | {len(hits)}/{len(rs)} | {med} |")
            summary_rows.append({
                "level": level,
                "run": a,
                "detected": len(hits),
                "total": len(rs),
                "median_delay_s": med,
                "clean_false_alarms": "",
                "clean_hours": "",
                "clean_fa_per_hour": "",
            })
        summary_rows.append({
            "level": level,
            "run": "clean",
            "detected": "",
            "total": len(cl),
            "median_delay_s": "",
            "clean_false_alarms": fa,
            "clean_hours": f"{hours:.2f}",
            "clean_fa_per_hour": f"{fa_rate:.1f}",
        })
        lines += ["", f"Clean footage: {fa} false alarms over {hours:.2f} h "
                      f"({fa_rate:.1f} per hour), "
                      f"{sum(1 for r in cl if r['false_alarms'])}/{len(cl)} videos with at least one.", ""]

    summary_csv = args.out / "summary.csv"
    skeys = ["level", "run", "detected", "total", "median_delay_s", "clean_false_alarms", "clean_hours", "clean_fa_per_hour"]
    with summary_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=skeys)
        w.writeheader()
        w.writerows(summary_rows)

    summary = args.out / "summary.md"
    summary.write_text("\n".join(lines), encoding="utf-8")
    print("\n" + "\n".join(lines))
    print(f"Wrote {summary_csv}, {per_run}, and {summary}")


if __name__ == "__main__":
    main()
