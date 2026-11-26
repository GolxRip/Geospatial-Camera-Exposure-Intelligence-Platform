# Evaluation Guide (`eval/`)

COBRA-WATCH separates **real-footage evaluation** (`eval/results/`) from the **pre-existing synthetic benchmark** (`eval/labeled_events.json`). They are never mixed.

## 1. Real-Footage Tier 2 Evaluation (`eval/tier2_real_footage.py`)

`eval/tier2_real_footage.py` takes real surveillance videos (`.mp4`, `.avi`, `.mov`, `.mkv`, `.m4v`) or extracted frame sequences (`.jpg`, `.png`, `.bmp`, e.g., CDnet's `<sequence>/input/`), runs a clean baseline pass, injects known tampering at 40% into the clip (`freeze`, `loop`, `blur`, `slow_blur`, `cover`, `partial_cover`, `moved`, `downscale`), and measures:
- **Detection rate** (comparing tampered alarms against the clip's own clean run at the same frames so false-alarm-prone detectors cannot cheat)
- **Median detection delay** in seconds at both gate thresholds: `degraded` (`< 0.85`) and `tripped` (`<= 0.50`)
- **Clean false alarms per hour** (after a warm-up window)

Each run writes **`summary.csv`**, **`per_run.csv`**, and **`summary.md`** (recording Dataset, UTC Date, and exact Command) into `--out` under `eval/results/`.

> **Rule:** Run `tier2_real_footage.py` **only** on real public datasets (CUHK Avenue, CDnet, own recordings) — never on synthetic noise clips as a research result.

### Reproduction Commands

```bash
# 1. CUHK Avenue training clips (set --min-seconds 12 if shorter Avenue clips are skipped)
python3 eval/tier2_real_footage.py \
  --data ~/datasets/avenue/training_videos \
  --dataset "CUHK Avenue (training)" \
  --width 320 \
  --max-seconds 90 \
  --out eval/results/avenue_train

# 2. CUHK Avenue testing clips (natural jitter / camera shake false-alarm test)
python3 eval/tier2_real_footage.py \
  --data ~/datasets/avenue/testing_videos \
  --dataset "CUHK Avenue (testing)" \
  --width 320 \
  --max-seconds 90 \
  --out eval/results/avenue_test

# 3. CDnet frame sequences (static/weather/night scenes)
python3 eval/tier2_real_footage.py \
  --data ~/datasets/cdnet \
  --dataset "CDnet-2014" \
  --dir-fps 25 \
  --width 320 \
  --out eval/results/cdnet_baseline
```

### Supported Flags

| Flag | Default | Purpose |
|---|---|---|
| `--data` | *(required)* | Root directory of `.avi`/`.mp4` videos or `.jpg`/`.png` frame folders |
| `--out` | `eval/results/tier2` | Output directory for `summary.csv`, `per_run.csv`, and `summary.md` |
| `--dataset` | `--data` folder name | Human-readable dataset label written into `summary.md` |
| `--detector` | `liveness_detector:FrameLivenessTracker` | `module:Class` under `video_pipeline/` |
| `--attacks` | all 8 attacks | Comma-separated subset (`freeze,loop,blur,slow_blur,cover,partial_cover,moved,downscale`) |
| `--width` | `640` | Downscale width for evaluation throughput |
| `--max-seconds` | `180` | Cap per clip in seconds |
| `--min-seconds` | `20.0` | Minimum clip duration required |
| `--dir-fps` | `25` | Assumed FPS when reading image-sequence directories |
| `--min-alarm-seconds` | `1.0` | Minimum sustained alarm duration to filter single-frame flicker |

---

## 2. Legacy Synthetic Benchmark (Formula Sanity Check Only)

The scripts below run on the **hand-authored synthetic scenarios** (`130` total, `120` directly scoreable in `eval/labeled_events.json`). They verify formula behavior and are **not real-world evidence**:

```bash
python3 eval/run_eval.py --verbose
python3 eval/ablation_study.py
python3 eval/threshold_sensitivity.py
python3 paper/scripts/compute_results.py
```
