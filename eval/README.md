# Evaluation Guide (`eval/`)

COBRA-WATCH separates **real-footage evaluation** (`eval/results/`) from the **pre-existing synthetic benchmark** (`eval/labeled_events.json`). They are never mixed.

## 1. Frozen Detector Versions (Do Not Modify Weights/Thresholds)

- **`liveness_detector_v1:FrameLivenessTracker`** (`video_pipeline/liveness_detector_v1.py`): original un-tuned baseline implementation (commit `3d87b37`).
- **`liveness_detector:FrameLivenessTracker`** (`video_pipeline/liveness_detector.py`): **frozen v2** detector tuned strictly on CUHK Avenue `training_videos` (`14` clips), frozen at commit `023c5c4457c986efd906b024631b3a59c6f593dd`. Held-out sets must be evaluated cleanly once without any further edits.

Each run of `eval/tier2_real_footage.py` writes **`summary.csv`**, **`per_run.csv`**, and **`summary.md`** (recording Dataset, UTC Date, evaluated/dropped clip counts, and exact Command) into `--out` under `eval/results/`.

> **Rule:** Run `tier2_real_footage.py` **only** on real public datasets (CUHK Avenue, CDnet) or researcher-owned clips (`~/datasets/own/...`) — never on synthetic noise clips as a research result.

---

## 2. Held-Out CUHK Avenue Evaluation (`testing_videos`)

`avenue_test_baseline` (`v1`) is already saved. Run the frozen `v2` detector **once** on held-out `testing_videos`:

```bash
python3 eval/tier2_real_footage.py \
  --data ~/datasets/avenue/"Avenue Dataset"/testing_videos \
  --dataset "CUHK Avenue (testing, held-out v2)" \
  --detector liveness_detector:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/avenue_test_tuned
```

---

## 3. Held-Out Self-Recorded Clips: `Own clips (day)` and `Own clips (night)`

Place 60 s real clips containing **no faces and no private spaces** into `~/datasets/own/day` and `~/datasets/own/night`. Evaluate **both** `v1` and `v2`:

### Own clips (day) — v1 (baseline) & v2 (frozen)
```bash
python3 eval/tier2_real_footage.py \
  --data ~/datasets/own/day \
  --dataset "Own clips (day)" \
  --detector liveness_detector_v1:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/own_day_v1

python3 eval/tier2_real_footage.py \
  --data ~/datasets/own/day \
  --dataset "Own clips (day)" \
  --detector liveness_detector:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/own_day_v2
```

### Own clips (night) — v1 (baseline) & v2 (frozen)
```bash
python3 eval/tier2_real_footage.py \
  --data ~/datasets/own/night \
  --dataset "Own clips (night)" \
  --detector liveness_detector_v1:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/own_night_v1

python3 eval/tier2_real_footage.py \
  --data ~/datasets/own/night \
  --dataset "Own clips (night)" \
  --detector liveness_detector:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/own_night_v2
```

---

## 4. Comparison Tables, Figures, and Throughput Benchmark

```bash
# Unified before/after comparison table (95% Wilson CIs + exact 95% Poisson FA/hour CIs)
python3 eval/compare_runs.py \
  --before eval/results/avenue_test_baseline \
  --after eval/results/avenue_test_tuned \
  --before-label "Avenue Test (v1)" \
  --after-label "Avenue Test (v2 held-out)" \
  --out-dir docs/comparisons/avenue_test

# Slide/report vector figures into docs/figures/ + CAPTIONS.md
python3 eval/make_figures.py \
  --before eval/results/avenue_test_baseline \
  --after eval/results/avenue_test_tuned \
  --before-label "Baseline (v1)" \
  --after-label "Frozen v2 (held-out)" \
  --out-dir docs/figures

# CPU throughput benchmark at 320 px and 640 px (use --source for real video/frames; default synthetic)
python3 eval/benchmark_speed.py \
  --detector liveness_detector_v1:FrameLivenessTracker,liveness_detector:FrameLivenessTracker \
  --source ~/datasets/avenue/"Avenue Dataset"/testing_videos \
  --widths 320,640 \
  --frames 300 \
  --out-md docs/SPEED_BENCHMARK.md

# Unseen attack-variant robustness sweep (loops 2/10/30 s, blur sigma 2/4/8, slow ramps 20/120 s, semi-transparent & small cover)
python3 eval/robustness_sweep.py \
  --data ~/datasets/avenue/"Avenue Dataset"/testing_videos \
  --dataset "CUHK Avenue (testing, robustness sweep)" \
  --detector liveness_detector:FrameLivenessTracker \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 90 \
  --out eval/results/robustness_sweep
```

---

## 5. Research-Paper Additions (added 2026-11-28; code smoke-tested only, no results yet)

The datasets and the test plan are in [`testing_rp.md`](../testing_rp.md). None of the commands below has been run on real
footage yet, so nothing under `eval/results/` comes from them.

### Clean-footage false alarms on long video (Test B)

`--clean-only` streams each clip once (no tamper runs, no frame buffering), so hour-long clips such as MEVA fit in memory.
It writes the same `per_run.csv` / `summary.csv` / `summary.md` files, with `Mode: clean only` in the header. `--save-scores`
keeps each clip's per-frame liveness scores (`<clip>.npz`: scores, fps, warm-up) for calibration. `--extra-level NAME=T`
(repeatable) also counts alarms at liveness `<= T`; the detector itself is unchanged. `--max-seconds 0` means no per-clip limit.

```bash
python3 eval/tier2_real_footage.py \
  --data ~/datasets/meva/clips \
  --dataset "MEVA (clean, held-out)" \
  --detector liveness_detector:FrameLivenessTracker \
  --width 320 \
  --max-seconds 0 \
  --clean-only \
  --save-scores eval/scores/meva \
  --out eval/results/meva_clean_v2
```

`eval/scores/` is git-ignored (the scores are derived from third-party footage; commit only the summaries).

### Adaptive-attacker suite (Test D)

`--variants adaptive` runs attacks aimed at v2's own rules (partial cover of 2/5/12/20%, loops of 45/60 s, a cross-faded
loop, a noisy loop, slow blur over 300/600 s, a jittered freeze). Expect misses: report them as evasion curves and never tune
v2 on them. Loops of L seconds need clips of at least L / 0.4 seconds, hence `--max-seconds 180`; state the clip lengths.
`--variants all` runs the default and the adaptive sets together.

```bash
python3 eval/robustness_sweep.py \
  --data ~/datasets/avenue/"Avenue Dataset"/testing_videos \
  --dataset "CUHK Avenue (testing, adaptive suite)" \
  --detector liveness_detector:FrameLivenessTracker \
  --variants adaptive \
  --width 320 \
  --min-seconds 12 \
  --max-seconds 180 \
  --out eval/results/adaptive_sweep_v2
```

### Split-conformal threshold calibration (Test E)

`eval/calibrate_thresholds.py` reads the `--save-scores` files, splits clips (never frames) into calibration and test sets
by a hash of the clip name, and picks the liveness threshold whose false-alarm probability per clean window is at most
`--alpha`. It also reports the empirical rate at 0.50 and 0.85 on the test clips. Write its output **outside**
`eval/results/` (it is a calibration artifact, not a detector run):

```bash
python3 eval/calibrate_thresholds.py \
  --scores eval/scores/meva \
  --dataset "MEVA (clean)" \
  --alpha 0.01 \
  --window-seconds 60 \
  --out eval/calibration/meva
```

If a calibrated threshold is then used anywhere, log it in `paper/LOG.md` as "tuned after seeing data" and measure detection
with `--extra-level calibrated=<t>` on held-out tampered footage. The owned-camera testbed for Tests F and G is in
[`testbed/`](../testbed/README.md).

---

## 6. Legacy Synthetic Benchmark (Formula Sanity Check Only)

The scripts below run on the **hand-authored synthetic scenarios** (`130` total, `120` directly scoreable in `eval/labeled_events.json`). They verify formula behavior and are **not real-world evidence**:

```bash
python3 eval/run_eval.py --verbose
python3 eval/ablation_study.py
python3 eval/threshold_sensitivity.py
python3 paper/scripts/compute_results.py
```
