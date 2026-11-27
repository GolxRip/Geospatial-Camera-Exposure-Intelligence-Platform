# COBRA-WATCH: Review 2 Implementation Scope & Evidence Matrix

**Target Milestone:** BE Major Project Review 2 (Saturday, December 19, 2026)  
**Policy Baseline:** Strictly passive OSINT + local/public video evaluation (`CLAUDE.md`, `ETHICS_AND_SCOPE_POLICY.md`). Active TCP heartbeat modules were permanently deleted.

> **Legend:**  
> - **Real data** = verified against real Censys Platform aggregate reports or real public/owned surveillance video (`eval/results/`).  
> - **Code implemented / Future scope** = working software covered by unit/integration tests, but live multi-month field evidence on third-party deployments is outside Review 2 scope.  
> - **Simulated / Synthetic** = clearly labeled demo fixtures or counterfactual arithmetic checks (never claimed as field results).

---

## 1. Core Research Components (Review 2 Primary Scope)

| Component | Code Path | Test Coverage | Evidence / Output Artifact | Review 2 Status |
|---|---|---|---|---|
| **Tier 2 Visual Liveness v1 (baseline)** | `video_pipeline/liveness_detector_v1.py` (`FrameLivenessTracker`, git `3d87b37`) | `backend/tests/test_liveness_detector.py`, `backend/tests/test_liveness_freeze_benchmark.py` | `eval/results/avenue_train_baseline/`, `eval/results/avenue_test_baseline/` | **Real public video** (un-tuned baseline) |
| **Tier 2 Visual Liveness v2 (frozen)** | `video_pipeline/liveness_detector.py` (`FrameLivenessTracker`, frozen at git `023c5c4`) | `backend/tests/test_liveness_detector.py` (11 unit tests incl. loop, wrap past 900 frames, slow blur, sustained cover, `partial_cover`, displacement, static jitter guard), `backend/tests/test_liveness_freeze_benchmark.py` (12 tests incl. 80-scenario suite) | Tuned on CUHK Avenue `training_videos` (`eval/results/avenue_train_tuned/`: 14/14 all 8 attacks, 0 FA); held-out `eval/results/avenue_test_tuned/` (`15/16` `loop` 93.8%, `16/16` other 7 attacks, `0.0/h` tripped FA, `8.4/h` degraded FA over 0.119 h); `own_day_v1`/`v2` & `own_night_v1`/`v2` optional pending clips | **Real public video** (`training_videos` tuned; `testing_videos` held-out verified) |
| **Tier 2 Real-Footage Harness & Stats** | `eval/tier2_real_footage.py`, `eval/compare_runs.py`, `eval/make_figures.py`, `eval/benchmark_speed.py` | `py_compile`, `--help`, Poisson CI parity vs `scipy.stats.chi2`, SVG XML validation, CPU throughput benchmark (`281.9` FPS @ 320 px / `71.2` FPS @ 640 px `v2`) | `eval/results/avenue_*` CSV & `summary.md`, `docs/comparisons/avenue_{train,test}/`, `docs/figures/{detection_rate_tripped,detection_rate_degraded,false_alarms_per_hour}.{svg,pdf}`, `docs/figures/CAPTIONS.md`, `docs/SPEED_BENCHMARK.md` | **Implemented & verified** |
| **Censys Exposure Aggregates (No IPs)** | `scripts/censys_snapshot.py`, `backend/routes/censys_router.py` (`/api/censys/snapshots`, `/api/devices/provenance`, `/api/results`) | `--dry-run --baseline-only`, Markdown pipe-table unit check, live HTTP `200` on `/api/censys/snapshots` (`6` records, `104,218` hosts); host-IP query refusal check | `data/censys/2026-11-26/snapshot.json` (`104,218` real India camera hosts across 6 aggregate fields, 0 IPs) | **Real OSINT aggregates** |
| **Aggregates-Only Guard** | `scripts/censys_ingest.py` (`_enforce_aggregates_only_guard`) | CLI execution check verifying exit code `1` refusal | Hard-blocked by policy (`CLAUDE.md` rule 4) | **Enforced safety guard** |

---

## 2. Backend Platform Architecture (`backend/`)

| Module / Router / Service | Code Path | Test Coverage | Evidence / Data Provenance | Review 2 Status |
|---|---|---|---|---|
| **FastAPI App & WebSocket Pub/Sub** | `backend/main.py` (`/health`, `/api/ws/alerts`), `backend/config.py` (`mask_ip_for_public`), `backend/database.py` | `backend/tests/test_api.py`, `backend/tests/test_database_migrations_and_integrity.py`, `backend/tests/test_concurrency_stress.py` | Runs against `data/public.db` (`9,320` simulated rows, `/24` IP masking) | **Implemented** (DB is simulated demo fixtures) |
| **Alerts & Detection Event Ingestion** | `backend/routes/alerts.py` (`POST /api/detection-event`, `GET /api/alerts`, `POST /api/alerts/{id}/verdict`, `GET /api/eval/live`, `GET /api/devices/{id}/trust-score`) | `backend/tests/test_alerts_routes.py`, `backend/tests/test_tier2_live_wiring.py`, `backend/tests/test_security_replay_indepth.py` | End-to-end API gate test with `visual_liveness` -> hard cap `30` | **Implemented & wired** |
| **IG-DCTF Gate & Tier 1 Banner Drift** | `backend/services/signal_integrity_service.py`, `backend/routes/integrity_router.py` (`/api/integrity/stats`, `/api/integrity/{id}`) | `backend/tests/test_signal_integrity_gate.py`, `backend/tests/test_banner_drift_benchmark.py`, `backend/tests/test_liveness_freeze_benchmark.py` | Synthetic 13 distinct banner mutations (`frontend/src/lib/scoring/gate.ts` verified on 748 vectors) | **Implemented**; real longitudinal Tier 1 banner-drift history is **future scope** |
| **Channel A Vulnerability Posture & Decay** | `backend/services/trust_score_service.py`, `backend/services/vulnerability_service.py`, `backend/services/ownership_service.py`, `backend/services/auth_detection.py`, `backend/services/cold_start_service.py`, `backend/services/classifier.py`, `backend/routes/decay_router.py` (`/api/decay-curve`, `/api/decay-preview`) | `backend/tests/test_trust_score_service.py`, `backend/tests/test_trust_score_indepth.py`, `backend/tests/test_vulnerability_service.py`, `backend/tests/test_cve_categories.py`, `backend/tests/test_cisa_kev_and_temporal.py`, `backend/tests/test_epss_adaptive_decay_live.py`, `backend/tests/test_auth_detection.py`, `backend/tests/test_cold_start_service.py`, `backend/tests/test_decay_pipeline.py` | Uses NVD / CISA KEV / EPSS logic; fleet comparison on live unpatched real cameras is **future scope** | **Implemented**; field deployment validation is **future scope** |
| **Spatial Corroboration & Collusion Graph** | `backend/services/corroboration_service.py`, `backend/services/collusion_graph_service.py`, `backend/services/gnn_collusion_model.py`, `backend/routes/audit_router.py` | `backend/tests/test_corroboration_service.py`, `backend/tests/test_corroboration_indepth.py`, `backend/tests/test_reid_corroboration.py`, `backend/tests/test_collusion_graph_service.py`, `backend/tests/test_gnn_collusion_model.py`, `backend/tests/test_velocity_and_anchoring.py` | Graph/GNN weights require explicit training (`scripts/train_gnn_collusion_model.py`); returns explicit `503` if model weights absent | **Implemented** (trained field collusion study is **future scope**) |
| **Tamper-Evident Merkle Audit Ledger** | `backend/services/audit_ledger.py`, `backend/routes/audit_router.py` (`/api/audit/*`, `/api/devices/{id}/audit-trail`), `backend/services/notification_service.py` | `backend/tests/test_audit_and_decay_indepth.py`, `backend/tests/test_audit_gate_trip_entries.py`, `backend/tests/test_audit_merkle_tamper_indepth.py`, `backend/tests/test_audit_persistence.py`, `backend/tests/test_chain_proof_and_verdicts.py`, `backend/tests/test_notification_tier_routing_indepth.py` | Hash-chained audit rows in `data/public.db` (`2` seeded entries) | **Implemented** |
| **Fleet Analytics, Stats, Map & News** | `backend/routes/devices.py`, `backend/routes/stats.py`, `backend/routes/heatmap.py`, `backend/routes/analytics_router.py`, `backend/routes/news.py`, `backend/routes/brief.py`, `backend/routes/nl_query_router.py`, `backend/services/claude_service.py`, `backend/services/news_service.py`, `backend/services/shodan_service.py` | `backend/tests/test_api.py`, `backend/tests/test_alert_timeline_and_demo_flag.py`, `backend/tests/test_auxiliary_routes_services.py`, `backend/tests/test_claude_ai_brief_indepth.py`, `backend/tests/test_nl_query_router.py`, `backend/tests/test_shodan_and_osint_indepth.py` | Serves sanitized `public.db`; AI briefs & live Shodan/News require API keys (`future scope` without keys) | **Implemented** (optional live external keys; DB devices simulated) |
| **Demo Scenario & Attack Simulators** | `backend/routes/scenarios_router.py` (`/api/scenarios/run`), `backend/routes/attack_simulator_router.py` (`/api/simulate/*`), `backend/routes/config_router.py` (`/api/config/thresholds`) | `backend/tests/test_attack_simulator.py`, `frontend/tests/e2e/phase2.spec.ts` (`/api/config/thresholds`) | Explicitly flagged `demo: true` | **Simulated demo fixtures** |

---

## 3. Video Detection Pipeline (`video_pipeline/`)

| Module | Code Path | Test Coverage | Evidence / Role | Review 2 Status |
|---|---|---|---|---|
| **YOLO + ByteTrack Pipeline** | `video_pipeline/main.py`, `video_pipeline/detector.py`, `video_pipeline/tracker.py`, `video_pipeline/rules.py`, `video_pipeline/config.py` | `video_pipeline/tests/` (`52 passed` standalone on `test_main_tier2_wiring.py`, `test_detector_security_boundary.py`, `test_rules.py`, `test_rules_indepth.py`, `test_tracker_motion_indepth.py`) | Bridges declared resolution & feeds `FrameLivenessTracker` into `/api/detection-event` (`visual_liveness`) | **Implemented**; live field RTSP integration is **future scope** (blocked by ethics on unowned cameras) |

---

## 4. Web Application (`frontend/`)

| Route / Area | Code Path | Test / Build Check | Real vs. Simulated Disclosure | Review 2 Status |
|---|---|---|---|---|
| **Landing & Methodology Overview** | `frontend/src/app/(site)/page.tsx`, `frontend/src/components/sections/*` | `next build`, `eslint`, `tsc --noEmit` | Real Tier 2 run cards separate from `SyntheticChip` (`Synthetic corpus, n = 120`) | **Implemented** |
| **Research & Reproducible Evidence** | `frontend/src/app/(site)/research/page.tsx`, `frontend/src/lib/content/real-tier2.ts` | `next build`, `eslint`, `tsc --noEmit` | Side-by-side baseline (`v1`) vs tuned (`v2`), labeled `development set (tuned)` / `held-out`, dropped counts, clean hours, 95% Wilson & Poisson CIs, plus `"Why synthetic data is used"` | **Implemented** |
| **Ethics & Scope** | `frontend/src/app/(site)/ethics/page.tsx` | `next build`, `eslint` | Discloses permanent removal of earlier heartbeat module, strict passive scope, IT Act / DPDP compliance, and simulated data rationale | **Implemented** |
| **Interactive IG-DCTF Lab** | `frontend/src/app/(site)/lab/page.tsx`, `frontend/src/components/lab/*`, `frontend/src/lib/scoring/gate.ts` | `frontend/tests/unit/gate.test.ts`, `next build` | Pure formula explorer synced with Python gate (`748` vectors) | **Implemented** |
| **Passive Triage Console & Forensics** | `frontend/src/app/console/page.tsx`, `frontend/src/app/console/devices/[id]/page.tsx`, `frontend/src/components/console/*`, `frontend/src/components/map/device-map.tsx` | `next build`, `eslint`, `tsc --noEmit`, live `/console` Inspector & Forensics verification against `:8000` (`data/public.db`), `frontend/src/lib/api/schema.d.ts` regenerated without `/heartbeat` | `SimulatedBanner` pinned top of `/console` and `/console/devices/[id]`, `Simulated fixture` badges in Inspector & Device Forensics, OSM attribution + Natural Earth GeoJSON boundary fallback | **Implemented** (serves simulated `public.db` inventory) |
| **Offline Design Preview** | `frontend/src/app/console-preview/page.tsx`, `frontend/src/app/console-preview/lab/page.tsx` | `next build` | `DemoBanner` ("Demo data: scripted sample devices") | **Implemented** |

---

## 5. Explicitly Future Scope (Not Claimed for Review 2)

- Longitudinal Tier 1 passive banner-drift base rates across multi-month Censys snapshots.
- Controlled physical laboratory camera testbed on owned public hardware comparing CVE-only vs. IG-DCTF dispatches in deployment.
- Live external Shodan/News/Claude LLM briefs when API keys are omitted in offline environments.
- Trained GNN weights on real collusion topologies (`scripts/train_gnn_collusion_model.py`).
- Full-detail India Protomaps PMTiles street basemap (`frontend/public/tiles/india.pmtiles`, replaced honestly by self-hosted Natural Earth GeoJSON boundaries).
