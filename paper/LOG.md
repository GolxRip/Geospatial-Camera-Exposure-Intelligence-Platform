# Worklog (append-only)

Newest entries at the bottom. Never delete or rewrite an entry; correct it with a new dated entry.
Format: `## YYYY-MM-DD, title` then **Did / Files / Why / Not verified**.

## 2026-10-09, project read-through and baseline audit
**Did:** read the code, the research docs (`RESEARCH_NOVELTY.md`, `PAPER_DRAFT.md`, `CHANGES_AND_ROADMAP.md`, `eval/*`)
and the 20-paper survey table; re-ran the evals; ran the full pytest suite once (427 passed).
**Found:** (1) repo docs use "genuine" as the positive class while the ablation/sweep scripts use "fabricated"; the
threshold sweep used different tier cut-offs so its F1 (0.932) was not comparable to the main eval; (2) the Tier 1
benchmark has only 13 distinct cases; (3) the Tier 2 weights made L(t) >= 0.5, so only freezes reached low trust;
(4) the eval corpus injects liveness values (down to 0.25) the tracker could not produce; (5) labels for the 90
attribute-only scenarios follow the intended tier of each scenario.
**Not verified:** nothing was changed in this entry.

## 2026-10-09, paper scaffold and results pipeline
**Did:** created `paper/` with `main.tex` (IEEEtran journal), `references.bib`, 10 standalone figures,
`scripts/compute_results.py` (single source of truth), `results.md`, `data/results.json`, `scripts/lint_tex.py`, `README.md`.
Consistent protocol: positive = fabricated, predicted positive iff score < 50, Wilson CIs, exact McNemar.
**Headline numbers:** IG-DCTF F1 0.9756 / recall 0.9524 / FP 0 vs Advanced (Channel A only) F1 0.8113; McNemar p = 1.5e-5;
identical to Advanced on the 90 attribute-only scenarios; additive-fusion control F1 0.9138; threshold sweep flat (42/42).
**Not verified:** nothing compiled (no LaTeX installed); many `references.bib` entries are marked VERIFY; figure numbers are typed by hand.

## 2026-10-09, Tier 2 weights fixed
**Did:** changed Tier 2 weights (0.5, 0.3, 0.2) -> (1.0, 0.6, 0.5) in `video_pipeline/liveness_detector.py` and the default of
`compute_visual_liveness` in `backend/services/signal_integrity_service.py`; updated `test_tier2_compute_visual_liveness_formulation`;
re-ran the 5 dependent test files (32 passed) and `compute_results.py` (16 s); updated paper text, Prop. 5, Table VI, Fig. 5.
**Effect:** every Tier 2 attack category now ends at T_final = 30 (before: freeze 30, blur 70, mismatch 90). Main comparison unchanged.
**Why:** reachability condition w > 0.4 (Prop. 5). **Caveat recorded in paper:** weights were revised after seeing the benchmark; the
false-trip cost (a legitimate sub-stream below declared resolution trips the mismatch term) is unmeasured.
**Not verified:** full pytest suite was not re-run after the change.

## 2026-10-09, agent setup files and Q1 research
**Did:** created `CLAUDE.md`, `paper/LOG.md`, `paper/CLAIMS.md`, `paper/TODO.md`, `paper/Q1.md`, `paper/DATASETS.md`.
Ran 16 web searches (queries listed in `Q1.md` section 8) to audit novelty and survey datasets.
**Found:** prior art for Tier 2-type ideas (ENF false-frame-injection detection, SurFi looping detection, PRNU surveillance-camera
authentication), a patent on HTTP-header fingerprinting to detect IP-device spoofing (Tier 1-type), and MATE (CCS 2025) on Bayesian
trust estimation for compromised sensor agents. No work found that fuses vulnerability posture with stream integrity in one camera
trust score. A weakness of our own design was also identified: the freeze rule detects static frames, not loops of real footage.
**Not verified:** web results are search summaries; titles/claims must be checked against the actual papers before citing.

## 2026-10-09, Overleaf bundle
**Did:** added `scripts/make_preview.py` (builds `figures_preview.tex`: all 10 figures, one per page, styles kept local to each figure) and
`scripts/make_overleaf_zip.py` (builds `../COBRA_IGDCTF_paper_overleaf.zip` with `main.tex`, `references.bib`, `figures_preview.tex`,
`figures/*.tex`, `OVERLEAF_README.txt`). The zip is git-ignored (`*.zip`).
**Not verified:** nothing was compiled (no LaTeX installed). The figure PDFs do not exist yet; `main.tex` shows placeholders for them.
Re-run both scripts after editing any figure.

## 2026-10-09, fig07 compile errors fixed
**Did:** the user's Overleaf showed errors on the two `\node[cap,...]` lines of `figures/fig07_event_pipeline.tex`. `cap` is also a built-in TikZ key
(line cap), so the custom style was renamed `stagelabel`; the two `\foreach` arrow loops were replaced by explicit `\draw` lines.
Regenerated `figures_preview.tex` and the Overleaf zip.
**Not verified:** still not compiled locally; the diagnosis (name clash with TikZ's `cap` key) is the most likely cause, not confirmed from the error text.
Lesson: do not reuse TikZ/pgf key names (`cap`, `thin`, `frame`, `rule`...) for custom styles.

## 2026-10-10, figure PDFs adopted, five figures corrected, zip rebuilt
**Did:** the user compiled the figures in Overleaf and put `1.pdf`..`10.pdf` in `figures/`; they were checked (all single-page, contents match, widths 213-519 pt)
and renamed to `figNN_<name>.pdf` so `main.tex` embeds them. Rendered each to PNG and inspected: fixed `.tex` of fig02 (Corroboration box touched the
Cyber-trust box), fig03 (hyphenation, width 260 -> ~250 pt), fig05 (weight labels collided with the connector), fig09 (xbar plots were offset
against each other; added `bar shift=0pt`), fig10 (legend replaces overlapping curve labels). Moved the broken fig09 PDF to `figures/_superseded/`.
Updated the fig10 caption in `main.tex`. Zip script now includes `figures/*.pdf`; `OVERLEAF_README.txt` lists which figures to recompile.
**Not verified:** the corrected `.tex` for figs 02, 03, 05, 09, 10 have NOT been compiled; the PDFs for 02, 03, 05, 10 in the zip are the older versions.
Zip: `COBRA_IGDCTF_paper_overleaf.zip`.

## 2026-10-10, updated PDFs adopted, zip rebuilt
**Did:** user recompiled figs 02, 03, 05, 09, 10 in Overleaf and saved the PDFs into `figures/` (09 as `9.pdf`, renamed to `fig09_ablation.pdf`).
Rendered and inspected them: 02, 03, 05, 10 are clean. Fig 09 bars are now correct but the value labels ran into the right axis frame, so `fig09_ablation.tex`
was edited (frame removed with `axis x line*=bottom, axis y line*=left`; labels on a white background). Zip rebuilt with all PDFs.
**Not verified:** the edited `fig09_ablation.tex` is uncompiled; the PDF in the zip is the previous (label-overlap) version, so fig 09 must be recompiled once.

## 2026-10-10, fig 09 PDF adopted; all figures final
**Did:** user recompiled `fig09_ablation.tex`; inspected the new PDF (labels clean, no axis-frame overlap). All ten figure PDFs now match their `.tex`. Zip rebuilt.
**Not verified:** `main.tex` itself has still not been compiled by the agent; the user should confirm the full paper builds in Overleaf.

## 2026-10-10, Censys application draft and a passivity finding
**Did:** drafted the answers a Censys research-access form asked for (mentor details left as placeholders at the user's request; RQ1 clarification
restricted to metadata; venue = IEEE TIFS primary) in `CENSYS_APPLICATION.md`.
**Found:** `backend/services/heartbeat_service.py` (`tcp_ping`, `ping_camera`, routes `/api/heartbeat/*`) opens TCP connections to device IPs, which contradicts the
paper's "sends no packets to discovered devices". It is not in the scoring path (`alerts.py` passes `ping_latency_ms=None`). Paper text narrowed to "scoring path"
in the Introduction, Section III-C and the Discussion ethics paragraph; `CLAIMS.md` C15 marked at risk; code NOT changed.
**Not verified:** whether anything calls the heartbeat router in the deployed dashboard (frontend not audited); `main.tex` edits not compiled.

## 2026-10-12, new frontend integrated (old Vite dashboard replaced)
**Did:** replaced `frontend/` (36 tracked Vite/React files) with the Next.js 15 app from `cobra-watch-web.zip` (same folder, so compose/launch paths hold).
`npm install` (530 packages), `tsc`, `eslint`, `vitest` (7), `next build` all clean after fixing 4 Anime.js v4 typing errors, a clock hydration mismatch,
the deprecated `createSpring`, and a missing `metadataBase`. Verified live in the browser against the real backend: landing (WebGL), console (4,429 devices,
map, news, WebSocket alerts), analytics tabs, device page, demo scenario, no console errors.
**Frontend changes to match the real backend:** routes (`/api/simulate/*`, `/api/audit/ledger`, `/api/integrity/{id}`), GeoJSON device parsing, one request for "All India",
detection-event body (`detected_at`, `idempotency_key`), brief request built from the zone's real devices, SSE event types, map tiles (CARTO now needs a key -> OSM + CSS dark filter),
new Analytics tabs (Alerts/Integrity/Ledger/Accuracy), operator verdict buttons, per-device scoring-model comparison.
**Backend changes (additive):** CORS default + `.env.example` + local `.env` now allow :3000; `/api/devices` adds city, trust_score (static posture, no corroboration), tier, cves;
new `GET /api/config/thresholds`, `GET /api/devices/{id}/audit-trail`, `POST /api/scenarios/run`; alerts carry `demo: true` for simulator/scenario traffic (ContextVar `DEMO_MODE`);
`fetch_and_cache_city("All India")` is cache-only (it retried a failing live Shodan fetch on every request: 8 s -> 0.3 s, no external calls).
**Found, not fixed:** (1) dev DB `audit_ledger` has 32 chain starts from past test runs, so `/api/audit/verify` reports "Tamper detected at entry 1"; tests that use the real DB (`test_api.py` etc.) keep appending.
(2) My profiling and the first two console loads sent ~18 Shodan queries for the pseudo-city "All India"; all were denied (403, key has no credits/permission). (3) `DETECTION_API_KEY` is empty locally; if it is ever set, the browser's detection-event and verdict calls get 403 by design.
(4) The landing page showed a stale "309/309 tests"; updated to 431 (verified run, same command as README) in `facts.ts` and `README.md`.
**Not verified:** Docker build of the new frontend (Dockerfile + compose written, never built); satellites layer has no backend source (shows an honest empty state); the Claude-written risk brief was not triggered (costs API tokens);
`/research` still lacks the before/after trust-score table the spec asked for (no numbers supplied).

## 2026-10-13, project mark and banner (assets/logo/)
Read `FRONTEND_SPEC.md` and the DIDA web app (extracted for reference to `Downloads/sentinel_project/dida_ref/frontend`, not into this repo). DIDA's 3D hero is driven by one mark whose geometry is a script (`build_logo.py`), so I built the same kind of source for COBRA-WATCH.
**Mark ("hood"):** nine annular-sector ribs fanned over 236 degrees around one eye; the eye is the lens-shaped overlap of two circles (secure AND authentic, i.e. the IG-DCTF trust intersection; also a cobra eye and a camera aperture). Palette is the site's (void, bone, signal #00E5FF). Rejected during design: hood outline with two rings (reads as a light bulb), two rings with a bridge (reads as a smiley), plain Venn rings (generic).
**Files:** `assets/logo/build_logo.py` (single source of numbers; run it to regenerate everything), `cobra-mark.svg`, `cobra-mark-transparent.svg`, `cobra-favicon.svg` (7 fat ribs for 16 px), `cobra-logo-dark.svg` / `cobra-logo-light.svg` (light uses #0097B2 for the eye so it holds contrast on white), `cobra-banner.svg/.png` (1280x640, GitHub social preview), `cobra-mark.png`, `cobra-mark.geometry.json` (rib angles, radii, eye, for the 3D scene).
**Found:** `frontend/` is not on disk any more. `git status` shows the old Vite files deleted and no untracked new files, and `FRONTEND_SPEC.md` + `frontend.zip` (DIDA's spec and app) sit in the repo root. The Next.js app I integrated on 2026-10-12 was not committed; only `cobra-watch-web.zip` (the original, without my backend wiring) remains.
**Not verified:** the banner tagline uses a system font stack in the SVG (the PNG is the canonical copy); the mark has not been placed in a 3D scene yet.

## 2026-10-13, palette change, README rewrite, new FRONTEND_SPEC.md
**Palette:** the cyan-on-navy identity (`#00E5FF` on `#04060B`) was dropped as generic "cyber" styling. New identity: ink `#0A0C0B`, lichen bone `#E7EAE3`, sodium amber `#F3A33A` (9.5:1 on ink; light-background variant `#A85F00`, 4.9:1 on white). Contrast ratios computed with WCAG relative luminance. `assets/logo/build_logo.py` updated and all assets (SVGs, PNGs, geometry JSON) regenerated; rejected-colour audit is in `FRONTEND_SPEC.md` 1.3.
**README.md rewritten** (banner, the idea and gate formula, verified results with their limits, architecture diagram, layout, quick start, API table, tests, ethics, honest status). Numbers taken from `paper/results.md`; the stale September `eval/eval_report.md` numbers were not used. Fixed: broken links that pointed at another user's absolute path, emoji headings, the claim that a dashboard exists.
**FRONTEND_SPEC.md replaced** (the previous file was a byte-identical copy of the DIDA spec). New content: COBRA-specific ground rules (truth, estimated positions, IP masking, no active probes, synthetic-corpus chip), truth sheet from `results.md` with generated facts, "the hood is a gauge" (opening angle = gate multiplier, eye = T_final), feed-field shader that can drift/freeze/blur, twin-camera blind-spot section, gate explorer with a Python-golden parity test, MapLibre v5 + Protomaps PMTiles, contracts verified against the router files, backend touchpoints B1-B9.
**Research done (web, 2026-10-13, secondary sources):** Next.js 16 (Turbopack default; custom webpack config breaks `next build`; View Transitions via React 19.2+), MapLibre v5 globe + PMTiles, deck.gl 9.4 `@deck.gl/maplibre`, Anime.js v4 API names, Three.js WebGPURenderer/TSL status, openapi-typescript. Exact versions must be confirmed at scaffold time.
**Found, not fixed:** `frontend/` is still absent, so `docker-compose.yml` references a missing build context (README says so). No `LICENSE` file although the README states MIT. Public read routes return full IP addresses (spec B1).
**Not verified:** the India PMTiles extract size (unmeasured); deck.gl interleaved-rendering issues may still be open; nothing in the spec has been built or run; the hero line and palette are proposals awaiting the owner's approval (spec section 25).

## 2026-10-16, v1 frontend integrated into the repo; first backend alignment pass (UNTESTED, owner asked to stop)
**What:** `cobra-watch-frontend-v1/frontend` mirrored into `frontend/` (stale placeholder `src/app/page.tsx` and `tsconfig.tsbuildinfo` from the earlier phase removed; it made `/` show "Under construction" and conflicts with `(site)/page.tsx`). `npm run sync` works once `paper/` is the parent folder. Ran the backend on a COPY of the dev DB (`%TEMP%\cobra_dev`), so demo runs did not touch `data/surveillancewatch.db`.
**Frontend fixes:** WebGL "Cannot read properties of null (reading 'precision')" in `next dev`: both engines called `forceContextLoss()` on dispose and React StrictMode remounts on the same canvas (now only when the canvas is disconnected; engines guard against drawing after dispose; creation deferred one tick; idle-callback creation is cancelled on cleanup; probe context is cached and released; feed bus cleared). Zod schemas vs the real backend: `/api/alerts` returns `integrity_gate_tripped` as 0/1, `trust-distribution.averages` can be null, `/api/integrity/stats` has no `gate_distribution` on an empty DB. `stats`/`news`/`heatmap` were called without `city` for "All India" (backend then defaults to Mumbai). Demo labelling after reload (history rows had no demo flag). `geo_source` provenance labels (osm_verified = mapped camera node but SEEDED record; shodan_live = IP geolocation; synthetic_demo). Top-bar gauge from signal integrity. Forensics page looks the device up in "All India". WebSocket connect deferred a tick.
**Backend (additive, NOT run or tested):** `alerts.is_demo` column + migration, set from `DEMO_MODE` in `_save_alert`; `analytics_router` alert-timeline buckets now end with the current hour (old code dropped the newest hour: off-by-one). Labels changed from `HH:MM` to `HH:00`.
**Basemap:** built `frontend/public/tiles/india.pmtiles` (z0-11, 263 MB, source build.protomaps.com/20261015, bbox 68.1,6.7,97.4,35.7; git-ignored); measured sizes: z9 52 MB, z11 263 MB, z12 667 MB. pmtiles CLI v1.31.2 was downloaded to `%TEMP%\cobra_dev\pmtiles_bin` (outside the repo). Range requests verified (206).
**Verified (dev + prod builds, headless Chromium):** `next build` passes; production build has no WebGL warnings; dev console clean after the fixes; console against the real backend: devices, stream, demo tags, inspector, analytics tabs, no HTTP errors. **Not verified:** the backend edits above, lint after the last edits, unit and e2e tests, reload-time demo labels, the timeline fix, mobile, Docker.
**Found, not fixed:** dev DB ledger reports "Chain broken at entry 1" (32 chain starts from past test runs; spec B6); `/api/eval/live` treats `high_trust` as the positive class (opposite of the paper); `/api/stats` density for "All India" divides by a 500 km2 default area; backend returns full IPs (B1); Next 16 generated `frontend/AGENTS.md`.

## 2026-10-16 (later), audit pass after the owner said "continue"
**Verified:** `tsc`, `eslint`, 49 vitest unit tests pass; backend full suite `pytest backend/tests video_pipeline/tests eval/test_eval_harness.py` = **434 passed** (431 + 3 new regression tests in `backend/tests/test_alert_timeline_and_demo_flag.py`), run on a copy of the dev DB (`DATABASE_PATH` set, so `data/surveillancewatch.db` was not migrated or written). `next build` passes. Live check against the real backend on a DB copy: run scenario -> reload -> demo tags persist (is_demo works end to end), Alerts timeline shows the current hour, no console warnings or HTTP errors, hydration clean (one transient hydration warning seen during hot reload did not recur).
**Changed:** basemap land tone `#151917` / water `#070908` (coastline contrast); Alerts chart now has y-axis, tooltips, legend, "Hours are UTC"; console map shows a data-provenance note from `geo_source` (e.g. "238 OpenStreetMap camera node, 5 Simulated. Seeded records, not scan results."); Accuracy tab explains that `/api/eval/live` treats high_trust as the positive class (the paper does the opposite); test count 431 -> 434 in README, CLAIMS C16 and `facts.manual.ts`; README and CLAUDE.md now describe the web app as built, with run steps.
**Playwright e2e (39 checks):** the Node Playwright 1.56 needs its own Chromium build (1194), which was not installed; `npx playwright install chromium` was run (large download). See the next entry for the result.
**Not verified:** Docker build of the frontend; Firefox/Safari; real screen reader; real (non-seeded) scanned device data.
**Playwright e2e result (same day):** 39/39 passed (7 pages x axe serious/critical, keyboard, focus ring, reduced motion, no horizontal scroll; 3 viewports) against the production build, backend running on a DB copy, console populated. Real findings fixed on the way: stream timestamps and several captions used `bone-3` at 12 px (4.09:1, below 4.5:1) and were switched to `bone-2`; the e2e spec now waits 2.2 s for entrance animations before axe (it measured the hero CTA mid-fade, 4.49:1, a timing artifact). Ran with a temporary local config pointing at the Chromium already installed (build 1223) because `npx playwright install` of build 1194 stalled; the temp config was deleted. `chromium-1194` is partially downloaded in `%LOCALAPPDATA%\ms-playwright` and can be deleted.

## (merged from paper-append/LOG.append.md, written by the chat that built the v1 frontend)

## 2026-10-14, frontend rebuild, phases 1 and 2 (scaffold, contracts, design system)
**What:** built `frontend/` from `FRONTEND_SPEC.md` sections 1-5, 14-15 and 22 (phases 1-2 only). Next.js 16.4.0 (Turbopack, no webpack key), React 19.3, TypeScript 5.9 strict + `noUncheckedIndexedAccess`, Tailwind 4.3, Anime.js 4.5 (one wrapper module), MapLibre 5.24 + pmtiles + @protomaps/basemaps, zustand, TanStack Query, zod, openapi-fetch/typescript, Radix primitives, Vitest, Playwright 1.56 + axe.
**Phase 1:** configs, Dockerfile, `scripts/sync-facts.mjs` (results.json -> `facts.generated.ts`, SHA-256 guarded), `sync-brand.mjs` (hood geometry JSON, logo assets, favicon), `gen-api.mjs` (live `/openapi.json` -> snapshot + types, `--check` mode), `build-basemap.sh`; API layer (`client`, zod `schemas`, `normalize` GeoJSON flattening, `maskIp`, WebSocket with backoff, SSE reader where HTTP errors escape the parse loop, console store); map style in the palette with self-hosted Noto fonts (OFL) under `public/map/fonts`.
**Phase 2:** tokens + z-scale + grain + focus ring + reduced-motion/transparency fallbacks; Geist; primitives (Button, Badge, Kbd, Stat, SourceNote, SyntheticChip, DemoTag, TierTag/TierShape, Skeleton, EmptyState, InlineError, OfflineState, CodeBlock, Tabs, Tooltip, Separator); `HoodGauge` (SVG, spread = 236 deg x G, eye = T/100, shares `src/lib/brand/hood.ts` with the future WebGL hood); branded 404; holding page; dev-only `/design-system`.
**Files:** everything under `frontend/` (new); nothing outside `frontend/` was edited. Backend untouched.
**Verified (sandbox, Chromium via Playwright 1.56, `next start`):** `npm run lint`, `typecheck`, `build` clean; 44 unit tests pass (facts freshness, hood geometry vs `cobra-mark.geometry.json`, contrast table, maskIp, GeoJSON flattening on a recorded `/api/devices` response, recorded WebSocket ALERT messages, recorded SSE stream, backoff, ring buffer); 27 e2e checks pass (9 x 3 viewports: no console errors or hydration warnings, axe serious/critical = 0, no horizontal scroll, skip link, 2px amber focus ring reached by Tab, hood tween vs reduced-motion snap, skeleton pulse off). Screenshots in `frontend/qa/phase-1-2/`. Contrast (recomputed from `tokens.css`): bone/ink-0 16.14, bone/ink-2 14.31, bone-2/ink-0 8.26, bone-2/ink-2 7.32, bone-3/ink-0 4.09, bone-3/ink-2 3.63, signal/ink-0 9.45, signal/ink-2 8.38.
**Fixtures:** recorded from the real backend running on a sandbox copy of `scripts/seed_demo_data.py` (synthetic, `geo_source = synthetic_demo`); IPs rewritten to 203.0.113.x before saving. `INTEGRITY_GATE_TRIPPED` and the SSE `chunk`/`error` types are built from the source of `alerts.py` / `claude_service.py`, not recorded.
**Found:** (1) spec 3.2 / 7.6 print WA F1 as 0.753; the stored value is 0.752475, which is 0.752 rounded once (results.md prints 0.7525). The site uses 0.752. (2) The backend's OpenAPI has response schemas for almost nothing (routes return bare dicts), so responses are typed with zod, not generated types. (3) npm now serves maplibre-gl 6.14, TypeScript 7.0, ESLint 10: pinned to maplibre 5.24 (spec), TypeScript 5.9 and ESLint 9.39 (tooling compatibility). (4) A rib at the gate floor is 3.87 degrees wide (spec says 3.9).
**Not verified:** the India PMTiles basemap was not built (the planet build host is not reachable from the sandbox), so no map has been rendered and `buildMapStyle` is only type-checked; WebSocket reconnect in a real browser; Firefox/Safari; screen reader pass; Docker build; WebGL (nothing 3D exists yet); `npm audit`.
**Not done (later phases):** MagneticButton and other Anime motion components, Dialog/ScrollArea/Popover, cmdk, KaTeX, d3, TanStack Virtual, Three.js, `scripts/export-golden.py`, nav/footer, all marketing and console pages.

## 2026-11-26, Day 1 Master Plan Review 2 Alignment & Frontend Integration
**What:** Integrated new controlled view-model frontend (`cobra-watch-frontend.zip`) into `frontend/` matching `FRONTEND_SPEC.md` and `MASTER_PLAN_REVIEW2.md`. Resolved duplicate route groups (`(console)` and `(dev)`), implemented `DeviceForensicsApp` on `/console/devices/[id]`, configured `force-dynamic` for dynamic console routes to prevent Turbopack client bailout during static generation, and restored API client utility exports.
**Backend & Privacy Alignment:**
- Decommissioned active heartbeat route (`heartbeat_router.py`) in `backend/main.py` ensuring pure passive OSINT operations (Master Plan Rule 4).
- Added `/24` subnet masking via `mask_ip_for_public()` in `backend/config.py` and applied to `backend/routes/devices.py` (with `geo_precision`).
- Added Censys tooling: `scripts/censys_snapshot.py` (aggregate metadata queries without IPs), `scripts/censys_ingest.py` (real host record ingestion with Tier 1 banner extraction and CVE matching), and `backend/routes/censys_router.py` exposing `/api/censys/snapshots`, `/api/devices/provenance`, and `/api/results`.
- Added public database sanitization script `scripts/build_public_db.py` to strip simulated records and output `data/public.db` with valid cryptographic audit chain.
- Updated `backend/routes/stats.py`, `backend/routes/analytics_router.py`, `backend/routes/alerts.py`, and `backend/routes/integrity_router.py` to properly handle "All India" queries, distinct real vs demo alerts, exact signed factor deltas, and real device posture distributions.
**Verification:**
- Full backend pytest suite passed: 377 passed, 1 skipped (0 failures).
- Frontend typecheck passed (`npx tsc --noEmit` = 0 errors) and build succeeded (`npm run build` generated all 10 routes).
- ESLint passed on `frontend/src` and `frontend/tests` (0 errors, 3 warnings).
- Backend routes verified via automated test client.
**Not verified:** Live Censys API calls (awaiting user API credentials in `.env`), live camera WebRTC/RTSP stream connections (disabled by ethics policy).

## 2026-11-26 (later), Heartbeat removal, Censys Platform v3 fix, Review 2 alignment
**Did:**
1. Permanently deleted active heartbeat modules (`backend/services/heartbeat_service.py`, `backend/routes/heartbeat_router.py`, `backend/tests/test_heartbeat_service.py`) and removed all references from `backend/main.py`, `backend/routes/alerts.py`, `backend/services/trust_score_service.py` (removed `ping_latency_ms` arg/branch), `backend/services/cold_start_service.py`, `frontend/src/app/(site)/ethics/page.tsx`, `frontend/src/components/sections/ethics.tsx`, and `frontend/src/lib/api/client.ts`. Grepped `backend/` to verify zero outbound probes or socket calls to camera IPs remain.
2. Rewrote `scripts/censys_snapshot.py` for Censys Platform API v3 (`POST https://api.platform.censys.io/v3/global/search/aggregate`, `Authorization: Bearer <CENSYS_API_TOKEN>`, CenQL `host.*` fields verified against `docs.censys.com`), added approved baseline query `host.location.country: "India" AND host.services.hardware.type: "CAMERA"`, `--baseline-only`, `--dry-run`, and `--from-paste` web UI converter. Added hard guard `_enforce_aggregates_only_guard()` in `scripts/censys_ingest.py` refusing individual host ingestion.
3. Prepared `eval/results/.gitkeep` and `eval/README.md`; updated `/research` (`frontend/src/app/(site)/research/page.tsx`, `frontend/src/lib/content/real-tier2.ts`) and landing `Results` section (`frontend/src/components/sections/results.tsx`) to render real Tier 2 results from `eval/results/` separately from the synthetic 120-scenario corpus benchmark (`SyntheticChip`).
4. Updated `CLAUDE.md` (real-data-only mandate, Dec 19 Review 2 target, Censys aggregates-only rule, `paper/` secondary status).
5. Updated map demo readiness (`frontend/public/tiles/basemap.json` set honestly to `available: false`, `DeviceMap` upgraded with self-hosted Natural Earth GeoJSON boundary fallback + visible OpenStreetMap attribution + city zoom transitions; `ConsoleApp` displays simulated-data provenance banner when connected to DB), moved 19 old hackathon/early dossiers & exports into `archive/` with `archive/README.md` placeholder note, and rewrote `README.md` with real status/numbers only.
6. Added missing `QueryClientProvider` in `frontend/src/components/providers.tsx` (discovered when live HTTP check on `/console` returned HTTP 500).
**Verified:**
- Touched backend pytest tests (`test_tier2_live_wiring.py`, `test_audit_and_decay_indepth.py`, `test_signal_integrity_gate.py`, `test_api.py` on a copy of `data/public.db`): 20 passed in 10.13 s.
- Censys paste converter & host-field guard verified in Python (`parse_pasted_aggregates` JSON, TSV, card text; `host.ip` refused); `--dry-run --baseline-only` and `censys_ingest.py` hard guard verified.
- Frontend ESLint (`src` + `tests`): 0 errors (3 warnings); `npx tsc --noEmit` + `npm run build`: exited 0 across all 11 routes.
- Live combined HTTP smoke check against `data/public.db`: FE `/`, `/research`, `/ethics`, `/console`, `/lab`, `/console/devices/demo-1` and map GeoJSON assets all returned 200; `/api/devices?city=Mumbai`, `/api/devices/provenance`, `/api/censys/snapshots` returned 200; `/api/heartbeat/status` returned 404.
**Not verified / Not done:**
- `eval/tier2_real_footage.py` was not yet copied into `eval/` by the user, so it could not be reviewed/edited or run on public footage.
- Headless Chromium / WebGL canvas pixel rendering (`npm run e2e`) and Vitest (`npm run test`, blocked earlier by missing `@rolldown/binding-win32-x64-msvc`) were not run in this pass.
- Live Censys Platform API call not executed (no `CENSYS_API_TOKEN` configured).
- Protomaps `india.pmtiles` not built (missing `pmtiles` CLI / daily planet URL; GeoJSON boundary fallback active).
- No git commit or push performed (per user rule).

## 2026-11-26 (night), Saved real Censys India camera aggregate baseline
**Did:** Converted the user's real Censys Platform aggregate report for `host.location.country: "India" AND host.services.hardware.type: "CAMERA"` (`total = 104,218` hosts across 6 aggregate fields: `host.services.port`, `host.location.city`, `host.services.protocol`, `host.services.software.vendor`, `host.services.software.product`, `host.autonomous_system.name`) into [data/censys/2026-11-26/snapshot.json](data/censys/2026-11-26/snapshot.json) and `README.md` (`source: censys_web_paste`, metadata/aggregates only, zero IPs). Added Markdown pipe-table parsing support to `parse_pasted_aggregates()` in `scripts/censys_snapshot.py`.
**Verified:** `GET /api/censys/snapshots` returns `available: true` with 6 aggregate records and `total: 104218`; Markdown pipe-table parser check passed.
**Not verified / Pending:** No git commit or push performed. Real Tier 2 runs (`eval/tier2_real_footage.py`) still pending sync from Kali.

## 2026-11-26 (late night), Reviewed and wired Tier 2 real-footage evaluation harness
**Did:** Pulled `eval/tier2_real_footage.py` from Kali (`9867c83`). Added `--dataset` and `--min-seconds` CLI flags, non-existent `--data` path error check, skip logging and CDnet `groundtruth`/`ROI` directory filtering (`SKIP_FRAME_DIRS`, ignoring sequence roots that contain `input/`) in `discover()`, unknown-attack validation, `Dataset`/`Date`/`Command` metadata header in `summary.md`, `warm` clamp (`min(10*fps, 0.35*len)`), `hours > 0` division guard, and aggregate `summary.csv` alongside `per_run.csv`. Rewrote [eval/README.md](eval/README.md) with verified flags and CUHK Avenue / CDnet commands, and updated [frontend/src/lib/content/real-tier2.ts](frontend/src/lib/content/real-tier2.ts) to sort `summary.csv` before `per_run.csv`.
**Verified:** `python -m py_compile eval/tier2_real_footage.py`, `python eval/tier2_real_footage.py --help`, `npx eslint src/lib/content/real-tier2.ts`, and `npx tsc --noEmit` all exited 0; confirmed `eval/results/` contains only `.gitkeep` (zero synthetic outputs generated).
**Not verified / Pending:** No full `next build` re-run after sorting change in `real-tier2.ts`; no git commit or push performed; awaiting real public dataset download and baseline execution on Kali (`~/datasets/cdnet` was empty).

## 2026-11-26 (baseline pulled), Recorded CUHK Avenue Tier 2 baseline & updated /research CSV disclosure
**Did:** Pulled real un-tuned Tier 2 baseline runs from Kali (`c33b562`) covering CUHK Avenue testing (`16` clips >= 12s, `0.12 h` clean evaluation window) and training (`14` clips >= 12s, `0.13 h` clean evaluation window) in [eval/results/avenue_test_baseline](eval/results/avenue_test_baseline/summary.md) and [eval/results/avenue_train_baseline](eval/results/avenue_train_baseline/summary.md). Wrapped `per_run.csv` (`288` + `252` rows) in collapsible `<details>` on `/research` in [frontend/src/app/(site)/research/page.tsx](frontend/src/app/(site)/research/page.tsx) while keeping `summary.csv` directly visible.
**Baseline numbers (un-tuned `FrameLivenessTracker`, prior to any detector changes):**
- CUHK Avenue testing (`16` videos): `degraded` — `freeze 16/16 (1.0s)`, `loop 1/16 (0.0s)`, `blur 16/16 (0.0s)`, `slow_blur 16/16 (3.5s)`, `cover 16/16 (0.0s)`, `partial_cover 13/16 (4.2s)`, `moved 16/16 (0.0s)`, `downscale 16/16 (0.0s)`; `tripped` — `freeze 16/16 (1.0s)`, `loop 1/16 (0.0s)`, `blur 16/16 (0.0s)`, `slow_blur 0/16 (n/a)`, `cover 16/16 (0.0s)`, `partial_cover 13/16 (4.2s)`, `moved 2/16 (13.2s)`, `downscale 16/16 (0.0s)`; clean false alarms = `4` over `0.12 h` (`33.5/hr`, `3/16` videos).
- CUHK Avenue training (`14` videos): `degraded` — `freeze 14/14 (0.9s)`, `loop 0/14 (n/a)`, `blur 14/14 (0.0s)`, `slow_blur 14/14 (3.5s)`, `cover 14/14 (0.0s)`, `partial_cover 13/14 (2.6s)`, `moved 14/14 (0.0s)`, `downscale 14/14 (0.0s)`; `tripped` — `freeze 14/14 (0.9s)`, `loop 0/14 (n/a)`, `blur 14/14 (0.0s)`, `slow_blur 1/14 (24.4s)`, `cover 14/14 (0.0s)`, `partial_cover 13/14 (2.6s)`, `moved 2/14 (13.7s)`, `downscale 14/14 (0.0s)`; clean false alarms = `6` over `0.13 h` (`45.9/hr`, `4/14` videos).
**Verified:** `npx eslint "src/app/(site)/research/page.tsx"` and `npx tsc --noEmit` exited `0`; `eval/results/avenue_*` files read cleanly.
**Not verified / Pending:** Wait for v2 detector work below before pushing.

## 2026-11-26 (late night 2), Upgraded FrameLivenessTracker & verified Next.js build (tuned on CUHK Avenue train diagnosis; test held out)
**Did:** Updated `FrameLivenessTracker` in [video_pipeline/liveness_detector.py](video_pipeline/liveness_detector.py) (thresholds and logic **tuned after diagnosing CUHK Avenue `training_videos` (14 clips); `testing_videos` held out untouched**):
1. Added strided pixel-MAD freeze guard (`_FREEZE_PIXEL_MAD_MAX = 0.25`) alongside DCT pHash Hamming distance so clean static surveillance scenes with sensor/codec jitter do not accumulate false freezes (`45.9/hr` baseline issue).
2. Added `16x16` trajectory cyclic replay detector (`_loop_maxlen = max(450, window_size * 15)` frames, `lag >= min_lag`, sustained `>= loop_confirm` aligned frames with `motion >= loop_confirm * 0.30`) to catch multi-second RTSP loops.
3. Added anchored blur and contrast baselines (`_anchor_blur`, `_anchor_contrast`, warmup alpha `0.05`, steady alpha `0.002`) frozen during blur/occlusion/freeze/loop, plus `4x4` spatial dead-block check (`partial_cover`) and sustained dark/uniform occlusion detection (preventing `ewma_blur <= 10.0` recovery after full cover while keeping dark-from-frame-0 scenes exempt).
4. Added coherent background warmup lock (`_coherent_warmup >= 10`) + Sobel edge & `32x32` layout correlation (`edge_corr < 0.50 or scene_corr < 0.60` sustained `>= max(45, consecutive_freeze_frames * 2)` frames) for camera displacement (`moved`).
5. Added 5 regression unit tests in [backend/tests/test_liveness_detector.py](backend/tests/test_liveness_detector.py).
**Verified:** `pytest backend/tests/test_liveness_detector.py backend/tests/test_liveness_freeze_benchmark.py -v` (`21 passed in 71.75s` after final edit; earlier 33-test run including `test_tier2_live_wiring.py` and `video_pipeline/tests/test_main_tier2_wiring.py` also passed `33 passed`); `cd frontend && npm run build` exited `0` across all 11 routes (note: Turbopack emitted 10 expected `Dynamic filesystem access` warnings in `src/lib/content/real-tier2.ts` for runtime loading of `eval/results/`).
**Not verified / Pending:** Detector v2 has **not yet run on Kali real CUHK Avenue `training_videos` or held-out `testing_videos`**; baseline folders `eval/results/avenue_train_baseline/` and `eval/results/avenue_test_baseline/` remain untouched for before/after comparison. No git commit or push performed.

## 2026-11-27 (midnight), Refined loop & partial_cover on Avenue train_v2 diagnosis (testing_videos still held out)
**Did:** Reviewed Aditya's `avenue_train_v2` run on Kali (`14` CUHK Avenue training clips: `freeze/blur/cover/downscale/moved 14/14`, `slow_blur 14/14 (6.0s)`, `loop 13/14 (0.4s)`, `partial_cover 12/14 (2.0s)`, clean FPs halved to `3` over `0.13 h` = `23.0/hr` across `2/14` clips). Diagnostic on `01.avi`, `02.avi`, `03.avi` showed zero FPs from freeze/moved/blur/occlusion; all 3 clean FPs came from short-lag (`12-26`) smoothed-thumbnail loop matches, while `01/02` `partial_cover` had `< 4` interior `4x4` blocks flat.
Updated [video_pipeline/liveness_detector.py](video_pipeline/liveness_detector.py) (`_extract_compact_features`, `_update_loop_detector`):
1. Switched loop matching buffer from smoothed `INTER_AREA` (`16x16 <= 1.2`) to un-smoothed `INTER_NEAREST` (`16x16 <= 0.45`), raised minimum loop lag to `max(10, consecutive_freeze_frames)` (`25` frames = `1.0s`), checked total cycle motion via O(1) prefix sums (`_loop_prefix_motion`, `>= lag * 0.12`), and avoided wiping loop streaks across brief `<= 0.25` pauses unless `is_frozen`.
2. Switched partial-cover check from `4x4` (`16`) to `8x8` (`64`) blocks (`dead_blocks >= 12`, combining textured blocks fading/flattening with `>= 12` mean shift or `>= 25` flat shift, and freezing anchor block updates when `dead_blocks >= 8`).
3. Added `test_frame_liveness_tracker_partial_cover` and `test_long_stream_ring_buffer_wrap_and_loop` (covering streams past `900` frames) to [backend/tests/test_liveness_detector.py](backend/tests/test_liveness_detector.py), and moved `_update_loop_detector` ring-buffer wrap before `_loop_prefix_motion[self._loop_end + 1]` write to fix `IndexError` past `900` frames on `01.avi`.
**Verified:** `pytest backend/tests/test_liveness_detector.py backend/tests/test_liveness_freeze_benchmark.py -v` -> `23 passed in 74.37s` after final edit; Kali run on `CUHK Avenue (training, tuned)` (`14` clips >= 12s, `0.13 h`, `2026-11-26 19:05:12 UTC`) wrote `eval/results/avenue_train_tuned/` with `14/14` detection across all 8 attacks at both `degraded` (`freeze 1.0s`, `loop 0.6s`, `blur 0.0s`, `slow_blur 3.1s`, `cover 0.0s`, `partial_cover 0.8s`, `moved 0.0s`, `downscale 0.0s`) and `tripped` (`slow_blur 5.9s`, `moved 2.0s`), and `0` clean false alarms (`0.0/hr`, `0/14` clips — down from `6` / `45.9/hr` baseline).
**Not verified / Pending:** `eval/results/avenue_train_tuned/` is saved on Kali (pending `git push` -> `master` pull on Windows); held-out `testing_videos` (`avenue_test_tuned`) and CDnet still pending run on Kali; no git commit or push performed on Windows.

## 2026-11-27 (00:58 IST), Labeled all simulated surfaces & documented synthetic/simulated data rationale
**Did:**
1. Created [frontend/src/components/console/simulated-banner.tsx](frontend/src/components/console/simulated-banner.tsx) and wired `<SimulatedBanner>` into both [console-app.tsx](frontend/src/components/console/console-app.tsx) (`/console`) and [device-forensics-app.tsx](frontend/src/components/console/device-forensics-app.tsx) (`/console/devices/[id]`, previously unbannered).
2. Propagated `geoSource` through [types.ts](frontend/src/lib/data/types.ts), [use-console-data.ts](frontend/src/lib/data/use-console-data.ts), and [demo.ts](frontend/src/lib/data/demo.ts); added explicit `Simulated fixture` badges & provenance rows in [inspector.tsx](frontend/src/components/console/inspector.tsx) and [device-forensics.tsx](frontend/src/components/console/device-forensics.tsx), map legend label in [map-pane.tsx](frontend/src/components/console/map-pane.tsx), and simulated inventory notes in [analytics-drawer.tsx](frontend/src/components/console/analytics-drawer.tsx) (`Fleet` & `Integrity` tabs).
3. Added explicit **"Why synthetic and simulated data are used instead of live camera feeds"** sections to [research/page.tsx](frontend/src/app/(site)/research/page.tsx) (`#limits`) and [ethics/page.tsx](frontend/src/app/(site)/ethics/page.tsx) (`#simulated-data`).
4. Updated [README.md](README.md) with current Censys (`104,218` hosts) + CUHK Avenue real status and a **Data Governance: Real vs. Simulated Data** table; updated [paper/main.tex](paper/main.tex) (`Discussion`) with `\textbf{Justification for synthetic and simulated components.}` and removed the stale heartbeat sentence.
**Verified:** Frontend em/en-dash check, `eslint` across all 12 modified UI files, `tsc --noEmit`, and `npm run build` across all 11 routes exited `0` cleanly.
**Not verified / Pending:** No live HTTP browser check re-run after this edit (`next build` verified compilation); no git commit or push performed.

## 2026-11-27 (09:01 IST), Detector freeze, evaluation tooling, OpenAPI schema cleanup, docs, SVG diagrams & verification runs
**Did:**
1. **Detector freeze (Task 1):** Verified [video_pipeline/liveness_detector.py](video_pipeline/liveness_detector.py) is byte-identical to commit `023c5c4457c986efd906b024631b3a59c6f593dd` (`023c5c4`) — frozen without further weight or threshold changes. Restored original un-tuned v1 baseline detector from commit `3d87b37` to [video_pipeline/liveness_detector_v1.py](video_pipeline/liveness_detector_v1.py).
2. **Comparison, figures & throughput benchmark (Tasks 2–4):** Created [eval/compare_runs.py](eval/compare_runs.py) (95% Wilson intervals + exact Garwood 95% Poisson FA/hr intervals, Markdown + CSV), [eval/make_figures.py](eval/make_figures.py) (SVG/PDF vector plots >= 17pt typography, black/grey/`#1F4E79` accent, grayscale hatch, `CAPTIONS.md`), and [eval/benchmark_speed.py](eval/benchmark_speed.py) (320/640 px FPS, CPU model, Python/CV2 versions). Ran `eval/benchmark_speed.py` (300 measured frames + 30 warmup, `synthetic_pattern (320x180)` on 12th Gen Intel Core i5-12450H, Python 3.12.6, OpenCV 5.0.0) and saved [docs/SPEED_BENCHMARK.md](docs/SPEED_BENCHMARK.md): v1 `606.8` FPS @ 320 px (`1.647 ms` mean) / `84.8` FPS @ 640 px (`11.788 ms`); v2 `281.9` FPS @ 320 px (`3.546 ms` mean) / `71.2` FPS @ 640 px (`14.036 ms`). Updated [eval/tier2_real_footage.py](eval/tier2_real_footage.py) logging only (no detector changes) to record dropped-clip counts in `summary.md`.
3. **Held-out own-footage commands (Task 5):** Updated [eval/README.md](eval/README.md) with `Own clips (day)` and `Own clips (night)` commands for both `v1` and `v2`, plus `avenue_test_tuned`, `compare_runs.py`, `make_figures.py`, and `benchmark_speed.py`.
4. **Frontend & OpenAPI schema (Task 6):** Regenerated [frontend/openapi.snapshot.json](frontend/openapi.snapshot.json) (`42` paths) and [frontend/src/lib/api/schema.d.ts](frontend/src/lib/api/schema.d.ts) directly from `backend.main.app.openapi()` (`0` heartbeat references remaining). Fixed heartbeat sentence grammar in [ethics/page.tsx](frontend/src/app/(site)/ethics/page.tsx). Upgraded [real-tier2.ts](frontend/src/lib/content/real-tier2.ts), [research/page.tsx](frontend/src/app/(site)/research/page.tsx), and [results.tsx](frontend/src/components/sections/results.tsx) to show baseline vs v2 side-by-side labeled `development set (tuned)` / `held-out`, with dropped-video counts and clean hours beside every false-alarm rate.
5. **Scope, demo script & SVG diagrams (Tasks 7–9):** Wrote [docs/REVIEW2_SCOPE.md](docs/REVIEW2_SCOPE.md), [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), [docs/diagrams/architecture.svg](docs/diagrams/architecture.svg), and [docs/diagrams/igdctf-pipeline.svg](docs/diagrams/igdctf-pipeline.svg).
**Verified:**
- `py_compile` on all 6 Python scripts/detectors exited `0`; `compare_runs.py` ran cleanly on baseline folders and Poisson CI fallback matched `scipy.stats.chi2.ppf` within `1e-7`; `make_figures.py` rendered all 3 SVG+PDF plots + `CAPTIONS.md` to temp dir; `git grep heartbeat` on `schema.d.ts`/`openapi.snapshot.json` returned 0 hits; both SVGs parsed cleanly via `xml.etree.ElementTree`; `frontend` em/en-dash check, `sections/results.tsx` digit check, `eslint` (11 modified UI files), and `tsc --noEmit` exited `0`.
- `eval/benchmark_speed.py` -> exit `0`, wrote [docs/SPEED_BENCHMARK.md](docs/SPEED_BENCHMARK.md).
- `cd frontend; npm run build` -> exit `0` (compiled in 9.4s, TypeScript 25.6s, 8/8 static pages generated; 10 non-fatal Turbopack warnings on dynamic `fs` paths in `real-tier2.ts`).
- `pytest backend/tests/ -q --tb=short` -> exit `0`: `373 passed, 1 skipped, 9 warnings in 129.63s (0:02:09)`. The 1 skipped test is `TestGnnEndpointUntrainedState::test_endpoint_returns_503_when_untrained` in `backend/tests/test_gnn_collusion_model.py` (skipped because trained GNN weights exist on disk); warnings are 9 `PytestUnhandledThreadExceptionWarning` (`RuntimeError: Event loop is closed` in `aiosqlite` cleanup threads).
**Not verified / Pending:**
- `docs/figures/` remains empty because `avenue_train_tuned` (on Kali, unpushed) and held-out `avenue_test_tuned` / `own/day` / `own/night` runs have not been pushed to this workspace yet.
- Frontend `npm run test` (Vitest) blocked on Windows (`@rolldown/binding-win32-x64-msvc` missing); live browser/Playwright UI smoke after final edits and standalone `video_pipeline/tests/` run were not executed. No `git commit` or `git push` performed.

## 2026-11-27 (09:53 IST), Pulled Kali held-out Avenue results, comparisons, figures & fixed UI clip-count bug
**Did:**
1. Pulled commit `6173eb0` from Kali (`eval/results/avenue_train_tuned/`, `eval/results/avenue_test_tuned/`, `docs/comparisons/avenue_train/`, `docs/comparisons/avenue_test/`, `docs/figures/{detection_rate_degraded,detection_rate_tripped,false_alarms_per_hour}.{svg,pdf}`, and `docs/figures/CAPTIONS.md`).
2. Reviewed held-out CUHK Avenue `testing_videos` (`16` clips evaluated, `5` dropped `< 12s`, `0.119` clean h): frozen `v2` improved over baseline `v1` on `loop` (`1/16` `6.2%` -> `15/16` `93.8%` `[71.7, 98.9]%`, `0.56s` median delay; `video 13` missed at `min_score_after = 0.986`), `slow_blur` tripped (`0/16` -> `16/16`, `5.88s`), `partial_cover` (`13/16` `81.2%` -> `16/16`, `0.76s`), and `moved` tripped (`2/16` `12.5%` -> `16/16`, `1.96s`); clean false alarms dropped from `4` (`33.5/h` `[9.1, 85.7]`) to **`0` (`0.0/h` `[0.0, 30.9]`) at `tripped`** and `1` (`8.4/h` `[0.2, 46.6]` on `video 06`) at `degraded`.
3. Caught and fixed an object-literal evaluation-order bug in [frontend/src/lib/content/real-tier2.ts](frontend/src/lib/content/real-tier2.ts) where `evaluatedVideos` inside `buildLevels()` was read before `parseLevel()` ran (causing `? evaluated (dropped clip count not recorded in summary.md)` on live SSR).
**Verified:**
- XML parse across all 3 SVGs in `docs/figures/` passed (`svg_xml_ok`).
- `npx eslint src/lib/content/real-tier2.ts`, `npx tsc --noEmit`, `cd frontend && npm run build` (`exit 0`, all routes built), and live `next start` SSR probe on `/` and `/research` (`HTTP 200`, `home_dropped_5=True`, `home_dropped_2=True`, `home_no_qmark=True`, `research_dropped_5=True`, `research_dropped_2=True`, `research_no_qmark=True`, `research_has_0_0_ci=True`, `research_has_93_8=True`).
**Not verified / Pending:**
- Push the [real-tier2.ts](frontend/src/lib/content/real-tier2.ts) fix and `paper/LOG.md` update to `origin/master`; held-out `Own clips (day)` and `Own clips (night)` evaluations on Kali (`v1` & `v2`) remain pending; Playwright/Vitest and standalone `video_pipeline/tests/` not re-run. No `git commit` or `git push` performed.

## 2026-11-27 (10:07 IST), Fixed console Inspector TrustScoreSchema mismatch (`factor_details`) & Research delay polish
**Did:**
1. Diagnosed live browser rehearsal failure on `/console` (`Inspector: Device could not be loaded / Could not load device detail`): `backend/routes/alerts.py` (`GET /api/devices/{camera_id}/trust-score`) returned `200 OK` with `factor_details: [{"key": ..., "delta": ..., "kev": ...}]`, while `TrustScoreSchema` in [frontend/src/lib/api/schemas.ts](frontend/src/lib/api/schemas.ts) strictly expected `{"label": ..., "delta": ..., "is_kev": ...}`, triggering a Zod `502 Unexpected response shape` error in `fetchJson()`.
2. Updated `TrustScoreSchema` in [frontend/src/lib/api/schemas.ts](frontend/src/lib/api/schemas.ts) to accept both `{key, delta, kev}` and `{label, delta, is_kev}` plus `ip`, `device_type`, `owner_org`, `ownership_confidence`, and `geo_source`; updated [frontend/src/lib/data/use-console-data.ts](frontend/src/lib/data/use-console-data.ts) (`toDeviceDetail`) to read those fields cleanly.
3. Polished `formatDelayCell` in [frontend/src/app/(site)/research/page.tsx](frontend/src/app/(site)/research/page.tsx) so missing median delays print `n/a` instead of `n/a s`.
**Verified:** `eslint` (3 modified UI files), `tsc --noEmit`, `cd frontend && $env:NEXT_PUBLIC_DESIGN_PREVIEW='true'; npm run build` (all exited `0`), restarted Next.js server outside sandbox (`http://localhost:3000`) alongside FastAPI (`http://localhost:8000`, `data/public.db`).
**Not verified / Pending:** Re-verify `/console` Inspector & Forensics click in browser (`chrome_devtools` MCP unavailable for subagent); two legacy alerts (`cam-eval-225`, `cam-eval-185`) in `data/public.db` lack device rows (`404` on `/trust-score`). Push pending.

## 2026-11-27 (10:17 IST), Fixed standalone `video_pipeline/tests/` `conftest.py` import collision & updated manuscript/claims
**Did:**
1. **Fixed standalone `video_pipeline/tests/` import collision:** Root [conftest.py](conftest.py) previously ran `from database import init_db` while `video_pipeline/` sat ahead of `backend/` on `sys.path`, causing `ImportError: cannot import name 'DATABASE_PATH' from 'config' (video_pipeline/config.py)` across all 52 tests. Updated [conftest.py](conftest.py) (`initialize_real_database`) to ensure `backend/` is temporarily at `sys.path[0]` without cached `video_pipeline/config.py` during `init_db()`, then restore `video_pipeline`'s `config` module cleanly.
2. **Updated secondary manuscript ([paper/main.tex](paper/main.tex)):** Added real-footage `v2` architecture summary under Channel B Tier 2, a new **Real-Footage Liveness and Passive Exposure Baseline** subsection + `tab:avenue` (baseline `v1` vs `v2` across CUHK Avenue `training_videos` tuned and held-out `testing_videos`, 95% Wilson & exact Garwood Poisson CIs, CPU throughput benchmark from [docs/SPEED_BENCHMARK.md](docs/SPEED_BENCHMARK.md), and Censys `104,218`-host India aggregates from [data/censys/2026-11-26/snapshot.json](data/censys/2026-11-26/snapshot.json)), and aligned `Threats to Validity`, `Discussion`, and `Conclusion` (keeping the 120-scenario synthetic corpus clearly separate).
3. **Updated [paper/CLAIMS.md](paper/CLAIMS.md) (`C10`, `C12`, `C14`, `C16`, `C17`) and [paper/TODO.md](paper/TODO.md).**
**Verified:**
- `pytest video_pipeline/tests/ -q --tb=short` -> **`52 passed in 2.45s`** (`52 passed in 1.31s` initial, `52 passed in 2.45s` combined pass).
- `pytest backend/tests/test_api.py video_pipeline/tests/ -q --tb=short` -> **`57 passed in 6.56s`**.
- [paper/main.tex](paper/main.tex) LaTeX environment/brace balance check: zero unmatched environments, `unescaped_brace_delta: 0`.
**Not verified / Pending:** `pdflatex` / `xelatex` / `tectonic` is not installed on Windows, so compiling [paper/main.tex](paper/main.tex) to PDF was not run (compile in Overleaf or on Linux TeX Live). No git commit or push performed.

## 2026-11-27 (10:24 IST), Orphan-alert DB hygiene, `api.test.ts` contract guard, eval suite run & doc sync
**Did:**
1. Updated [scripts/build_public_db.py](scripts/build_public_db.py) to strip orphan alerts (`DELETE FROM alerts WHERE camera_id NOT IN (SELECT id FROM devices)`) before rebuilding the Merkle chain, eliminating the two `cam-eval-225`/`cam-eval-185` 404 rows, and rebuilt local `data/public.db` (`9,320` masked devices, `0` orphan alerts).
2. Added regression case in [frontend/tests/api.test.ts](frontend/tests/api.test.ts) verifying `TrustScoreSchema` parses the live `alerts.py` shape (`factor_details` `{key, delta, kev}` + provenance fields).
3. Synced [README.md](README.md), [docs/REVIEW2_SCOPE.md](docs/REVIEW2_SCOPE.md), and [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) with held-out CUHK Avenue `testing_videos` outcomes (`avenue_test_tuned`), generated comparisons/figures/speed benchmark artifacts, `NEXT_PUBLIC_DESIGN_PREVIEW=true` build flag for `/console-preview`, and clean test totals.
**Verified:**
- `pytest eval/test_eval_harness.py eval/test_full_system_stress_and_benchmark.py eval/test_run_eval_api_mode_indepth.py -q --tb=short` -> **`14 passed in 2.06s`**.
- `npx eslint tests/api.test.ts` and `npx tsc --noEmit` -> exited `0`.
**Not verified / Pending:** Vitest (`npm run test`, blocked on Windows by missing `@rolldown/binding-win32-x64-msvc`), Playwright E2E, `Own clips (day/night)` real footage runs, and PDF LaTeX compile (`pdflatex` absent on Windows). No git commit or push performed.
