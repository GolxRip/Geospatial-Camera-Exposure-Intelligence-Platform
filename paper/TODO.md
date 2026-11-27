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
- [ ] Run pending slow/Linux verifications on Kali after Review 2 doc updates: full `pytest`, Playwright E2E, `docker compose build`, `eval/robustness_sweep.py`, `eval/benchmark_speed.py --source <avenue_testing>`, and self-recorded `Own clips (day/night)`.

## Technical debt found in audit
- [x] 2026-11-27 Tier 2 freeze rule missed loops of real footage (C14): fixed with un-smoothed `INTER_NEAREST` ring-buffer + prefix-sum motion check, anchored blur baselines, $8{\times}8$ `partial_cover`, edge/layout `moved`, and static freeze guard (`v2` frozen at `023c5c4`).
- [ ] Tier 1 benchmark has 13 distinct cases (C8): replace with real or properly randomised cases.
- [ ] Evaluation corpus labels are partly tautological: replace with externally grounded labels (see `DATASETS.md`).
- [ ] `RESEARCH_NOVELTY.md`, `PAPER_DRAFT.md`, `eval/eval_report.md`, `PROJECT_SUMMARY_AND_FUTURE_SCOPE.md` still carry the old
      metric convention and numbers; mark them superseded by `paper/results.md` (needs user's OK to edit).
- [ ] Figures 8-10 numbers are typed by hand; generate them from `results.json` if the figures change often (real-footage SVG/PDF figures in `docs/figures/` are generated directly from `eval/results/` via `eval/make_figures.py`).

## Q1 work (see Q1.md)
- [ ] U1 Calibrated evidence + conformal gate
- [~] U2 Loop/replay detection solved in `v2` (`15/16` held-out Avenue); adaptive-attacker evaluation remains open
- [ ] U3 Real data: (a) longitudinal Censys (single-day `104,218`-host aggregate saved), (b) controlled physical camera testbed
- [ ] U4 Adaptive-adversary analysis
- [ ] U5 Decision-theoretic dispatch evaluation (optional)

## Ethics guard (found 2026-10-10)
- [x] 2026-11-26 Permanently removed `backend/services/heartbeat_service.py`, `/api/heartbeat/*`, and `test_heartbeat_service.py` (strictly zero outbound packets to third-party cameras).
- [ ] Send the Censys application answers (`CENSYS_APPLICATION.md`) after filling the mentor details.

## Frontend follow-ups (2026-10-12)
- [ ] Decide what to do with the dev DB ledger (`audit_ledger` has 32 chain starts; verify says tamper at entry 1): clear the table, or make tests use a temp DB.
- [ ] Try `docker compose build frontend` once; the new Dockerfile/compose were never built.
- [ ] Confirm the footer credit ("Built by Gokul Annamalai and team") and add the repo URL via `NEXT_PUBLIC_REPO_URL`.
- [ ] `/research` page: add the before/after trust-score table from `paper/results.md` (numbers not in the spec).
- [ ] Optional: a real satellite source, or remove the Satellites layer toggle.

## Frontend follow-ups (2026-10-16)
- [ ] FULL AUDIT of frontend + backend edits: run backend tests (against a DB copy), `npm run lint/test/e2e`, check the Alerts timeline and demo labels after a reload
- [ ] Tune basemap tones (land vs water contrast), Alerts chart axes and tooltips, remaining visual polish
- [ ] Ledger tab shows "Chain broken at entry 1" on the dev DB: clear or archive `audit_ledger`, make tests use a temp DB (B6)
- [ ] Add a "dataset provenance" chip in the console (seeded vs scanned) and word the live-eval tab (high_trust = positive there)
- [ ] Decide on `frontend/AGENTS.md` (Next 16 generates it) and commit/ignore `frontend/qa` screenshots


## Frontend rebuild (FRONTEND_SPEC.md section 22)
- [x] 2026-10-14 Phase 1: scaffold, API contracts, facts sync, basemap config (basemap file NOT built)
- [x] 2026-10-14 Phase 2: tokens, primitives, HoodGauge, TierTag, SourceNote, contrast table re-verified
- [ ] Build `public/tiles/india.pmtiles` locally: `bash frontend/scripts/build-basemap.sh 11 <planet URL>`; record the size
- [ ] Phase 3 onward (nav/footer, landing sections, 3D hood, gate explorer, console)
- [ ] Backend touchpoints still awaiting approval: B1 server-side IP masking (implemented in `mask_ip_for_public`), B3 operation ids/tags, B4 OpenAPI + WS/SSE docs and response models, B5 demo scenario list, B6 temp test DB / ledger reset, B7 `geo_precision`, B8 `/api/results`, B9 LICENSE (B2 heartbeat permanently removed 2026-11-26)
- [ ] Decide: keep the dev-only `/design-system` route (not in spec section 4)?
- [ ] Spec 3.2 / 7.6: change WA F1 from 0.753 to 0.752
