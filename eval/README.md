# Evaluation Guide (`eval/`)

COBRA-WATCH separates **real-footage evaluation** (`eval/results/`) from the **pre-existing synthetic benchmark** (`eval/labeled_events.json`). They are never mixed.

## 1. Real-Footage Tier 2 Evaluation (`eval/results/`)

### Directory purpose
`eval/results/` holds outputs produced strictly from real public video datasets (e.g., CUHK Avenue) or self-recorded local camera clips evaluated with `eval/tier2_real_footage.py`.

Each evaluated run writes:
- Per-clip / summary **CSV** metric files in `eval/results/`
- **`summary.md`** recording the dataset name, UTC date, exact CLI command, and measured metrics (detection latency, true/false freeze, blur drift, loop/spec detections)

> **Rule:** Never run `tier2_real_footage.py` on synthetic noise frames and place the output in `eval/results/`. Synthetic clips belong only in unit tests (`video_pipeline/tests/`) or the synthetic benchmark below.

### How to reproduce
Once `eval/tier2_real_footage.py` is placed in `eval/`:

```powershell
# Evaluate real footage directory and save CSV + summary.md into eval/results/
python eval/tier2_real_footage.py --input <path-to-real-videos> --dataset <dataset-name> --output-dir eval/results
```

*Note: Check `python eval/tier2_real_footage.py --help` after copying the script in for exact dataset/mode flags.*

---

## 2. Synthetic Benchmark (Pre-recorded Baseline Only)

The files below evaluate the scoring equations on **hand-authored synthetic scenarios** (`130` total scenarios, `120` directly scoreable in `eval/labeled_events.json`). These numbers test formula behavior only and are **not real-world evidence**:

```powershell
# 4-model comparison on the 120 scoreable synthetic scenarios
python eval/run_eval.py --verbose

# Ablation & threshold sensitivity checks (synthetic corpus)
python eval/ablation_study.py
python eval/threshold_sensitivity.py

# Regenerate canonical synthetic metrics in paper/results.md & paper/data/results.json
python paper/scripts/compute_results.py
```
