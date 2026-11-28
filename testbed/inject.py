#!/usr/bin/env python3
"""
inject.py: stage RTSP loop and freeze attacks on the OWNED-camera testbed through the MediaMTX relay.

The pipeline reads rtsp://<relay>:8554/<path>_attack. Normally `passthrough` copies the real camera path into it;
to stage an attack, stop the passthrough (Ctrl+C) and publish a loop or a freeze into the same path. The camera
itself is never touched. Everything runs on localhost against the local relay; nothing contacts any other host.

    python testbed/inject.py passthrough --path cam1            # print the command (dry run, the default)
    python testbed/inject.py passthrough --path cam1 --run      # run it (Ctrl+C to stop)
    python testbed/inject.py record --path cam1 --seconds 10 --run
    python testbed/inject.py loop   --path cam1 --run           # replays recordings/cam1.mp4 forever
    python testbed/inject.py freeze --path cam1 --run           # re-sends one frame of recordings/cam1.mp4

Log the start and end time of every staged attack in testbed/scenarios.csv (ground truth).
Requires FFmpeg on PATH and MediaMTX running with testbed/mediamtx.yml.
"""
from __future__ import annotations

import argparse
import shlex
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RELAY = "rtsp://127.0.0.1:8554"  # local relay only


def commands(action: str, path: str, seconds: float) -> list[list[str]]:
    src = f"{RELAY}/{path}"
    dst = f"{RELAY}/{path}_attack"
    rec = HERE / "recordings" / f"{path}.mp4"
    still = HERE / "recordings" / f"{path}_still.png"
    if action == "passthrough":
        return [["ffmpeg", "-rtsp_transport", "tcp", "-i", src, "-c", "copy", "-f", "rtsp", dst]]
    if action == "record":
        return [["ffmpeg", "-y", "-rtsp_transport", "tcp", "-i", src, "-t", f"{seconds:g}", "-c:v", "libx264",
                 "-preset", "veryfast", "-an", str(rec)]]
    if action == "loop":
        return [["ffmpeg", "-re", "-stream_loop", "-1", "-i", str(rec), "-c:v", "libx264", "-preset", "ultrafast",
                 "-tune", "zerolatency", "-an", "-f", "rtsp", dst]]
    if action == "freeze":
        return [
            ["ffmpeg", "-y", "-i", str(rec), "-frames:v", "1", str(still)],
            ["ffmpeg", "-re", "-loop", "1", "-i", str(still), "-r", "25", "-c:v", "libx264", "-preset", "ultrafast",
             "-tune", "zerolatency", "-pix_fmt", "yuv420p", "-f", "rtsp", dst],
        ]
    raise ValueError(action)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["passthrough", "record", "loop", "freeze"])
    ap.add_argument("--path", required=True, help="relay path name of an owned camera, e.g. cam1")
    ap.add_argument("--seconds", type=float, default=10.0, help="length of the recording used for loop/freeze")
    ap.add_argument("--run", action="store_true", help="execute (default: only print the commands)")
    args = ap.parse_args()

    if not args.path.replace("_", "").isalnum():
        sys.exit("--path must be a plain relay path name such as cam1")
    if args.action in ("loop", "freeze") and not (HERE / "recordings" / f"{args.path}.mp4").exists() and args.run:
        sys.exit(f"Record first: python testbed/inject.py record --path {args.path} --run")
    (HERE / "recordings").mkdir(exist_ok=True)

    for cmd in commands(args.action, args.path, args.seconds):
        print(" ".join(shlex.quote(c) for c in cmd))
        if args.run:
            subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
