# TODO and open decisions

Tick items with the date; add new ones at the bottom of their section. Mirror important changes in `LOG.md`.

## Decisions waiting for the user
- [ ] Q1 direction: which upgrades from `Q1.md` s3 to commit to (recommended package: U1 + U2 + U3 + U4).
- [ ] Target journal after the upgrade (TIFS vs TDSC vs Computers & Security vs IoT-J), see `Q1.md` s6.
- [ ] Whether to buy/borrow a few IP cameras for a controlled field testbed (U3b) and an account for Censys research access.
- [ ] Tier 2 mismatch weight 0.5: keep, or soften to 0.4 (tapers to medium instead of low)?

## Paper hygiene (small, do soon)
- [x] 2026-10-10 all figure PDFs final (fig 09 recompiled)
- [ ] Add missing prior art to Related Work and soften the novelty claim (C13): ENF false-frame injection (Sensors 2019),
      SurFi looping detection (arXiv 1904.01350), PRNU surveillance-camera authentication (Expert Syst. Appl. 2026),
      US 8,806,632 (IP-device spoofing via HTTP/TCP fingerprints), MATE trust-aware fusion (CCS 2025), camera tamper datasets (UHCTD).
- [ ] Verify every `references.bib` entry marked VERIFY.
- [ ] Fill in authors/affiliations in `main.tex`.
- [ ] Compile all 10 figures and `main.tex` in Overleaf; fix layout issues; tell the agent about compile errors.
- [x] 2026-11-27 Re-run full pytest suite: `backend/tests/` (`373 passed, 1 skipped`) and `video_pipeline/tests/` (`52 passed` after `conftest.py` path fix); single-source test totals (`439 pytest` / `81 Vitest across 11 suites` / `265 golden vectors`) synced in `frontend/src/lib/content/facts.manual.ts`.
      2026-11-28: frontend totals are now `76` Vitest tests across `10` suites after duplicate test files were removed (see LOG).
- [~] **2026-11-27** Slow/Linux verifications on Kali: Vitest (`11/11` files, `82` tests passed), `eval/robustness_sweep.py` (`v1` & `v2` on Avenue `testing_videos`), `eval/benchmark_speed.py --source` (Avenue `testing_videos`: `242.7/59.9` FPS `v2`), and `docker compose build` (`3/3` images built cleanly after `libgl1` fix) are DONE; still pending: self-recorded `Own clips (day/night)` tomorrow + two-laptop LAN demo check.
- [x] 2026-11-28 `main.tex` speed sentence and conclusion now quote the real-frame `v2` benchmark (242.7 FPS at 320 px, 59.9 FPS at 640 px) instead of the synthetic 281.9/606.8 FPS figures.
- [x] 2026-11-28 WA F1 printed as 0.753 in `main.tex` Table (tab:main), `CLAIMS.md` C2 and the spec; the stored value is 0.75248, so it is now 0.752 everywhere.
- [ ] Rebuild the report PDF and the Overleaf zip: `report/*.tex` changed on 2026-11-28 (frontend test counts) and no LaTeX install was available.

## Technical debt found in audit
- [x] 2026-11-27 Tier 2 freeze rule missed loops of real footage (C14): fixed with un-smoothed `INTER_NEAREST` ring-buffer + prefix-sum motion check, anchored blur baselines, $8{\times}8$ `partial_cover`, edge/layout `moved`, and static freeze guard (`v2` frozen at `023c5c4`).
- [ ] Tier 1 benchmark has 13 distinct cases (C8): replace with real or properly randomised cases.
- [ ] Evaluation corpus labels are partly tautological: replace with externally grounded labels (see `DATASETS.md`).
- [x] 2026-11-28 `eval/eval_report.md` now opens with a "Superseded" banner pointing to `paper/results.md` and `eval/results/`.
      `RESEARCH_NOVELTY.md`, `PAPER_DRAFT.md` and `PROJECT_SUMMARY_AND_FUTURE_SCOPE.md` are not in this repository, so nothing to mark.
- [ ] Figures 8-10 numbers are typed by hand; generate them from `results.json` if the figures change often (real-footage SVG/PDF figures in `docs/figures/` are generated directly from `eval/results/` via `eval/make_figures.py`).

## Q1 work (see Q1.md)
- [~] U1 Calibrated evidence + conformal gate: `eval/calibrate_thresholds.py` (split conformal on saved clean-footage scores) written 2026-11-28, smoke-tested only; needs clean scores from MEVA (see "Run next").
- [~] U2 Loop/replay detection solved in `v2` (`15/16` held-out Avenue); adaptive-attacker suite added to `eval/robustness_sweep.py` (`--variants adaptive`) on 2026-11-28, not run yet
- [~] U3 Real data: (a) longitudinal Censys (single-day `104,218`-host aggregate saved), (b) controlled physical camera testbed: scripts in `testbed/` (2026-11-28), no camera yet
- [ ] U4 Adaptive-adversary analysis (run the adaptive suite, then write it up)
- [ ] U5 Decision-theoretic dispatch evaluation (optional)

## Run next (code ready 2026-11-28, nothing below has been run; see `testing_rp.md`)
- [ ] Test B: clean-footage false alarms on MEVA: `python eval/tier2_real_footage.py --clean-only --save-scores eval/scores/meva ...`
- [ ] Test D: `python eval/robustness_sweep.py --variants adaptive` on Avenue `testing_videos` (`v1` and `v2`)
- [ ] Test E: `python eval/calibrate_thresholds.py` on the saved scores, output to `eval/calibration/` (not `eval/results/`); log any threshold change as "tuned after seeing data"
- [ ] Tests F/G: owned-camera testbed (`testbed/README.md`) once a camera is available
- [ ] Re-run the full pytest suite (440), `npm run build`, `npm run test:e2e` and `docker compose up` after the 2026-11-28 changes
- [ ] Add permanent tests for `/api/scenarios`, the configurable `CENSYS_DIR`/`RESULTS_JSON_PATH`, and the new `/api/eval/live` fields

## Ethics guard (found 2026-10-10)
- [x] 2026-11-26 Permanently removed `backend/services/heartbeat_service.py`, `/api/heartbeat/*`, and `test_heartbeat_service.py` (strictly zero outbound packets to third-party cameras).
- [ ] Send the Censys application answers (`CENSYS_APPLICATION.md`) after filling the mentor details.

## Frontend follow-ups (2026-10-12)
- [ ] Decide what to do with the dev DB ledger (`audit_ledger` has 32 chain starts; verify says tamper at entry 1): clear the table, or make tests use a temp DB.
      2026-11-28: the demo no longer needs the dev DB; `scripts/build_demo_fixture.py` builds `data/public.db` with a valid, empty chain.
- [x] **2026-11-27** Try `docker compose build` on Kali: all 3 services (`video-pipeline`, `backend`, `frontend`) built cleanly (`Built 3/3`) after replacing `libgl1-mesa-glx` with `libgl1` in `video_pipeline/Dockerfile`.
- [ ] Confirm the footer credit ("Built by Gokul Annamalai and team") and add the repo URL via `NEXT_PUBLIC_REPO_URL`.
- [ ] `/research` page: add the before/after trust-score table from `paper/results.md` (numbers not in the spec).
- [x] 2026-11-28 Satellites layer toggle: no longer in the frontend (nothing to do).

## Frontend follow-ups (2026-10-16)
- [ ] FULL AUDIT of frontend + backend edits: run backend tests (against a DB copy), `npm run lint/test/e2e`, check the Alerts timeline and demo labels after a reload
      2026-11-28: `tsc`, `eslint` and Vitest (`76/76`) pass on Windows; full pytest, `next build` and e2e not run.
- [ ] Tune basemap tones (land vs water contrast), Alerts chart axes and tooltips, remaining visual polish
- [~] Ledger tab shows "Chain broken at entry 1" on the dev DB: the public fixture has a valid chain (2026-11-28); the dev DB itself is unchanged
- [~] Dataset provenance is shown in the inspector, device page and simulated banner; `/api/eval/live` now returns `positive_class` and `convention_note` (2026-11-28), but the console's live-eval tab text has not been reworded yet
- [x] 2026-11-28 `frontend/AGENTS.md` and `frontend/qa` are not in this repository (nothing to decide)


## Frontend rebuild (FRONTEND_SPEC.md section 22)
- [x] 2026-10-14 Phase 1: scaffold, API contracts, facts sync, basemap config (basemap file NOT built)
- [x] 2026-10-14 Phase 2: tokens, primitives, HoodGauge, TierTag, SourceNote, contrast table re-verified
- [x] 2026-11-28 Built `public/tiles/india.pmtiles` (263,175,029 bytes, maxzoom 11, git-ignored); `basemap.json` says available; see `frontend/BASEMAP.md`
- [x] Phase 3 onward (nav/footer, landing sections, 3D hood, gate explorer, console): implemented (confirmed in the 2026-11-28 audit); on 2026-11-28 the WebGL hood (`HeroStage`) and the feed field (`FeedLayer`) were wired back into the landing page and unused section components were removed. Browser render not checked.
- [~] Backend touchpoints: B1 server-side IP masking (`mask_ip_for_public`, and `raw_data` sanitised in `build_public_db.py` 2026-11-28), B3 operation ids = function names + 12 tags (2026-11-28), B4 WS/SSE docs in `docs/API_STREAMS.md` (2026-11-28; response models still not added), B5 `GET /api/scenarios` (2026-11-28), B6 public demo fixture (2026-11-28; tests still share code paths with the dev DB), B7 `geo_precision` (in `routes/devices.py`), B8 `/api/results` (exists), B9 `LICENSE` MIT (2026-11-28). B2 heartbeat permanently removed 2026-11-26.
- [ ] Decide: keep the dev-only `/design-system` route (not in spec section 4)? It is still at `src/app/(site)/design-system`.
- [x] 2026-11-28 Spec 3.2 / 7.6: WA F1 changed from 0.753 to 0.752
