"""
Throughput benchmark for Tier 2 FrameLivenessTracker at 320 px and 640 px widths.

Records frames per second (FPS), mean / p50 / p95 milliseconds per frame, CPU model,
Python version, OpenCV / NumPy versions, and whether timing ran on real video or
deterministic test frames.

Note: never writes files into eval/results/ so Research page CSV discovery remains pure.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "video_pipeline"))


def get_cpu_model() -> str:
    """Return human-readable CPU model name cleanly across Windows and Linux."""
    if sys.platform.startswith("win"):
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
            )
            name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            winreg.CloseKey(key)
            if str(name).strip():
                return str(name).strip()
        except OSError:
            pass
    else:
        cpuinfo = Path("/proc/cpuinfo")
        if cpuinfo.exists():
            for line in cpuinfo.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.lower().startswith("model name") and ":" in line:
                    return line.split(":", 1)[1].strip()
    try:
        out = subprocess.check_output(["lscpu"], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            if "Model name:" in line:
                return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return platform.processor() or platform.machine()


def _load_detector(spec: str):
    mod, cls = spec.split(":")
    return getattr(importlib.import_module(mod), cls)


_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
_VIDEO_EXT = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


def _load_real_source_frames(source_path: Path, width: int, count: int) -> tuple[list[np.ndarray], str]:
    """Load real frames from a single video file, frame folder, or directory of videos/folders."""
    if not source_path.exists():
        sys.exit(f"Real frame source does not exist: {source_path}")

    loaded: list[np.ndarray] = []

    def _read_video_into(vpath: Path) -> None:
        cap = cv2.VideoCapture(str(vpath))
        while len(loaded) < count:
            ok, frame = cap.read()
            if not ok:
                break
            h, w = frame.shape[:2]
            loaded.append(cv2.resize(frame, (width, int(h * width / w)), interpolation=cv2.INTER_AREA))
        cap.release()

    def _read_images_into(imgs: list[Path]) -> None:
        for ipath in imgs:
            if len(loaded) >= count:
                break
            img = cv2.imread(str(ipath))
            if img is None:
                continue
            h, w = img.shape[:2]
            loaded.append(cv2.resize(img, (width, int(h * width / w)), interpolation=cv2.INTER_AREA))

    if source_path.is_file():
        _read_video_into(source_path)
        label = f"real_video:{source_path.name}"
    else:
        direct_imgs = sorted(
            p for p in source_path.iterdir()
            if p.is_file() and not p.name.startswith("._") and p.suffix.lower() in _IMAGE_EXT
        )
        if direct_imgs:
            _read_images_into(direct_imgs)
            label = f"real_frames:{source_path.name}"
        else:
            clips_used = 0
            for child in sorted(source_path.iterdir()):
                if len(loaded) >= count:
                    break
                if child.name.startswith("._"):
                    continue
                before = len(loaded)
                if child.is_file() and child.suffix.lower() in _VIDEO_EXT:
                    _read_video_into(child)
                elif child.is_dir():
                    imgs = sorted(
                        p for p in child.iterdir()
                        if p.is_file() and not p.name.startswith("._") and p.suffix.lower() in _IMAGE_EXT
                    )
                    if imgs:
                        _read_images_into(imgs)
                if len(loaded) > before:
                    clips_used += 1
            label = f"real_dataset:{source_path.name} ({clips_used} clip(s), {len(loaded)} unique)"

    if not loaded:
        sys.exit(f"No readable real frames found under --source: {source_path}")

    out = [loaded[i % len(loaded)] for i in range(count)]
    return out, label


def _prepare_frames(width: int, count: int, source: str) -> tuple[list[np.ndarray], str]:
    height = int(round(width * 9 / 16))
    if source.lower() != "synthetic":
        return _load_real_source_frames(Path(source), width, count)

    rng = np.random.default_rng(2026)
    base = np.full((height, width, 3), 96, dtype=np.uint8)
    base[: height // 3, : width // 2] = (170, 175, 180)
    base[height // 2 :, width // 2 :] = (50, 55, 60)
    frames: list[np.ndarray] = []
    for i in range(count):
        f = base.copy()
        x = (i * 3) % max(1, width - 24)
        cv2.rectangle(f, (x, height // 2), (x + 20, height // 2 + 40), (210, 140, 80), -1)
        noise = rng.integers(-2, 3, size=f.shape, dtype=np.int16)
        frames.append(np.clip(f.astype(np.int16) + noise, 0, 255).astype(np.uint8))
    return frames, f"synthetic_pattern ({width}x{height})"


def benchmark_one(
    detector_spec: str,
    width: int,
    n_frames: int,
    warmup: int,
    source: str,
) -> dict[str, object]:
    cls = _load_detector(detector_spec)
    frames, src = _prepare_frames(width, warmup + n_frames, source)
    tracker = cls(camera_id=f"bench_{width}")

    for i in range(warmup):
        tracker.process_frame(frames[i], i, i / 25.0)

    lat_ms: list[float] = []
    t_start = time.perf_counter()
    for i in range(warmup, warmup + n_frames):
        t0 = time.perf_counter()
        tracker.process_frame(frames[i], i, i / 25.0)
        lat_ms.append((time.perf_counter() - t0) * 1000.0)
    elapsed = time.perf_counter() - t_start

    s_lat = sorted(lat_ms)
    p95 = s_lat[min(len(s_lat) - 1, int(0.95 * len(s_lat)))]
    return {
        "detector": detector_spec,
        "width_px": width,
        "height_px": frames[0].shape[0],
        "warmup_frames": warmup,
        "measured_frames": n_frames,
        "total_seconds": round(elapsed, 4),
        "fps": round(n_frames / elapsed, 1),
        "mean_ms": round(statistics.mean(lat_ms), 3),
        "p50_ms": round(statistics.median(lat_ms), 3),
        "p95_ms": round(p95, 3),
        "frame_source": src,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--detector",
        default="liveness_detector:FrameLivenessTracker",
        help="comma-separated module:Class specs",
    )
    ap.add_argument("--widths", default="320,640")
    ap.add_argument("--frames", type=int, default=300)
    ap.add_argument("--warmup", type=int, default=30)
    ap.add_argument(
        "--source",
        default="synthetic",
        help="'synthetic' (default) or path to a real video file, frame folder, or clip directory (e.g. Avenue testing_videos)",
    )
    ap.add_argument("--video", type=Path, default=None, help="deprecated alias for --source <video>")
    ap.add_argument("--out-md", type=Path, default=None)
    ap.add_argument("--out-json", type=Path, default=None)
    args = ap.parse_args()

    if args.video is not None and args.source != "synthetic":
        sys.exit("Pass either --source or --video, not both.")
    source = str(args.video) if args.video is not None else args.source

    detectors = [d.strip() for d in args.detector.split(",") if d.strip()]
    widths = [int(w.strip()) for w in args.widths.split(",") if w.strip()]

    meta = {
        "timestamp_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "cpu_model": get_cpu_model(),
        "cpu_cores": os.cpu_count(),
        "os_platform": platform.platform(),
        "python_version": platform.python_version(),
        "opencv_version": cv2.__version__,
        "numpy_version": np.__version__,
        "source": source,
    }

    results = [
        benchmark_one(det, w, args.frames, args.warmup, source)
        for det in detectors
        for w in widths
    ]

    lines = [
        "# FrameLivenessTracker Speed Benchmark",
        "",
        f"- **Date (UTC):** {meta['timestamp_utc']}",
        f"- **CPU:** {meta['cpu_model']} ({meta['cpu_cores']} logical cores)",
        f"- **Python:** {meta['python_version']} | **OpenCV:** {meta['opencv_version']} | **NumPy:** {meta['numpy_version']}",
        f"- **OS:** {meta['os_platform']}",
        f"- **Workload:** {args.frames} measured frames (+ {args.warmup} warmup) per run; frame source: `{results[0]['frame_source'] if results else 'n/a'}`",
        "",
        "| Detector | Width | FPS | Mean (ms/frame) | p50 (ms) | p95 (ms) |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in results:
        lines.append(
            f"| `{r['detector']}` | {r['width_px']} px | **{r['fps']}** | {r['mean_ms']} | {r['p50_ms']} | {r['p95_ms']} |"
        )
    lines.append("")
    md_text = "\n".join(lines)

    if args.out_md:
        args.out_md.parent.mkdir(parents=True, exist_ok=True)
        args.out_md.write_text(md_text, encoding="utf-8")
    if args.out_json:
        args.out_json.parent.mkdir(parents=True, exist_ok=True)
        args.out_json.write_text(json.dumps({"meta": meta, "results": results}, indent=2) + "\n", encoding="utf-8")

    print(md_text)


if __name__ == "__main__":
    main()
