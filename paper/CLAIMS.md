# Claim ledger

Every substantive claim in `main.tex`, its evidence, and its status. Update the status whenever evidence changes.
Status values: **verified** (reproduced by `scripts/compute_results.py`), **proved** (follows from the equations, proof in paper),
**design** (argued from the design, not measured), **unverified** (no evidence yet), **at risk** (prior art or weakness found).

| ID | Claim (as in the paper) | Evidence / source | Status |
|---|---|---|---|
| C1 | IG-DCTF F1 = 0.976, recall 0.952, FP = 0 on 120 scenarios | `results.md` s1 | verified (synthetic corpus) |
| C2 | Best vulnerability-only baseline (Advanced) F1 = 0.811; WA 0.753; Bayesian 0.832 | `results.md` s1 | verified (synthetic corpus) |
| C3 | On 120 hand-authored scenarios, IG-DCTF agrees with Advanced on 90 attribute-only cases and differs on 17 Channel-B scenarios (0 reverse) | `results.md` s1 | **demoted** (synthetic sanity check; p-value omitted — corpus-designed pairing cannot show real-world significance) |
| C4 | No regression on the 90 attribute-only scenarios (identical to Advanced) | `results.md` s1 stratified | verified |
| C5 | Gain is entirely from Channel-B scenarios (Advanced catches 1 of 18) | `results.md` s1 stratified | verified; true by construction of the corpus |
| C6 | Multiplicative fusion beats additive fusion (3 vs 10 misses) | `results.md` s2 | verified; additive control `T = T_cve - 70(1-s)` is one choice of control |
| C7 | Threshold sweep flat (F1 0.976 at all 42 pairs); corpus cannot select thresholds | `results.md` s3 | verified |
| C8 | Tier 1 detector: 50/50 mutated flagged, 0/50 controls; 0.005 ms/device | `results.md` s4 | verified, but only 13 distinct cases (**weak**) |
| C9 | Single-field banner changes taper but never trip the gate | Prop. 3; `results.md` s4 | proved + verified |
| C10 | Tier 2: 50/50 attacks flagged, 0/30 controls, latency 9.6 frames; all categories end at T_final = 30 | `results.md` s5; real-footage extensions in `eval/results/avenue_*` and `docs/SPEED_BENCHMARK.md` | synthetic frames verified; weights revised before real CUHK Avenue tuning (see C14/C17) |
| C11 | Prop. 1 (non-compensation), 2 (blind spot), 3 (single-field tolerance), 4 (Lipschitz = 2), 5 (reachability w > 0.4) | proofs in `main.tex` | proved |
| C12 | Overhead 4.7 us vs 2.6 us per event (gate only); Tier 2 CPU throughput 281.9 FPS @ 320 px / 71.2 FPS @ 640 px (`v2`) | `results.md` s6; `docs/SPEED_BENCHMARK.md` (`synthetic_pattern`, i5-12450H) | verified (in-process Python / synthetic frame benchmark) |
| C13 | "To our knowledge no surveyed work fuses vulnerability posture with feed authenticity" | survey table (20 papers) + web searches 2026-10-09 | **at risk**: related prior art exists (ENF false-frame-injection, SurFi, PRNU surveillance authentication, IP-device spoofing patent, MATE). Narrow the claim and cite them. See `Q1.md` s2 |
| C14 | Tier 2 detects "stream freeze or loop", slow blur, occlusion, displacement, and downscale under simulated tamper onset on Avenue | `video_pipeline/liveness_detector.py` (`023c5c4`); `docs/comparisons/avenue_train/comparison.md`, `docs/comparisons/avenue_test/comparison.md` | **verified on CUHK Avenue only** (`training_videos` tuned 14/14, 2 dropped `<12s`, 0.131 clean h; `testing_videos` 16/21 kept, 5 dropped `<12s`, 0.120 clean h: `loop` 15/16 [71.7, 98.9]%, other 7 attacks 16/16, tripped FA 0.0/h [0.0, 30.9], degraded FA 8.4/h [0.2, 46.6]); shared camera/scene/lighting and co-developed attack generator mean this shows attack detection on that scene, not cross-scene generalisation |
| C15 | Codebase is strictly passive: zero outbound packets to discovered devices | code review + backend grep 2026-11-26: `heartbeat_service.py`, `heartbeat_router.py`, and `test_heartbeat_service.py` deleted completely; only catalog/OSINT feeds (`shodan_service`, `vulnerability_service`, `news_service`) remain | verified passive |
| C16 | Auxiliary modules (adaptive decay, cold start, collusion/GNN, security boundary, rules, eval harness) are implemented and unit-tested | repo tests: `439 passed, 1 skipped, 0 warnings` (`pytest backend/tests/ video_pipeline/tests/ eval/`, `2026-11-27`; 1 skip = untrained-GNN 503 test when trained weights exist) | verified functionally; not field-evaluated |
| C17 | Real-world effectiveness | `eval/results/avenue_test_tuned/` (16 held-out public clips, 0.119 clean h) & `data/censys/2026-11-26/snapshot.json` (104,218 India host aggregates, 0 IPs) | **partial (public video + OSINT aggregates)**; live camera field testbed & longitudinal Tier 1 banner drift remain **future work** |
| C18 | Bibliography accuracy | `references.bib` | **unverified**: entries marked VERIFY were transcribed from the survey table |
