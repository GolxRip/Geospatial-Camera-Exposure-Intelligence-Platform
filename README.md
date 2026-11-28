<p align="center">
  <img src="assets/logo/cobra-banner.png" alt="COBRA-WATCH: trust scores for exposed cameras. Vulnerability posture, gated by signal integrity." width="100%">
</p>

# COBRA-WATCH

**A camera can be secure and still lie.** COBRA-WATCH is a passive cyber-physical surveillance trust-scoring platform (FastAPI backend + Next.js 16 web application + YOLOv8/ByteTrack video pipeline). It evaluates alert reliability using two channels joined by a multiplicative integrity gate (**IG-DCTF**):

| Channel | Role | Scope in Review 2 |
|---|---|---|
| **A: Vulnerability Posture (`T_cve`)** | NVD + CISA KEV CVEs, authentication status, owner classification, firmware patch age, spatial corroboration | Implemented in `backend/services/trust_score_service.py` (field comparison on live devices is future scope) |
| **B: Signal Integrity (`s`)** | Tier 1 passive banner drift + Tier 2 visual frame liveness (`FrameLivenessTracker`) | **Tier 2** evaluated on public/real video into `eval/results/`; Tier 1 real history is future scope |
| **Multiplicative Gate (`G(s)`)** | Piece-wise multiplier (`theta_low = 0.50`, `theta_high = 0.85`, floor `0.30`, hard cap `30`) so spoofed feeds cannot score high trust | Unit-tested in `backend/tests/test_signal_integrity_gate.py` |

> **Milestone & Current Data Status (Nov 27, 2026)**  
> Primary target: **BE Major Project Review 2 (Saturday, December 19, 2026)**. `paper/` is maintained as a secondary manuscript.
> - **Real Censys India Camera Aggregates ([`data/censys/2026-11-26/snapshot.json`](data/censys/2026-11-26/snapshot.json)):** **104,218** real Indian camera hosts (`host.location.country: "India" AND host.services.hardware.type: "CAMERA"`) across 6 aggregate dimensions (ports: RTSP 554 = 81,285; top cities; protocols; vendors; products; ASNs) with **zero raw IP addresses**.
> - **Real Tier 2 Video Evaluation ([`eval/results/`](eval/results/)):** Real public CUHK Avenue surveillance clips evaluated with [`eval/tier2_real_footage.py`](eval/tier2_real_footage.py) comparing un-tuned `v1` baseline against frozen `v2` (`023c5c4`): on `training_videos` (`14` clips, `2` dropped `<12s`, `0.131 clean h`), `v2` detects `14/14` across all `8` attacks with `0.0/h [0.0, 28.2]` clean false alarms; on held-out `testing_videos` (`16` clips, `5` dropped `<12s`, `0.119 clean h`), `v2` raises `loop` detection from `1/16` (`6.2%`) to `15/16` (`93.8%`) and hits `16/16` across the remaining `7` tamper types with `0.0/h [0.0, 30.9]` clean false alarms at `tripped` (`1` FA = `8.4/h` at `degraded`). Comparisons, vector figures, and CPU throughput benchmarks live in [`docs/`](docs/).
> - **Console & Demo Database (`data/public.db` — Simulated):** Contains **9,320 simulated device fixtures** (`geo_source = 'synthetic_demo'`, private `10.x` addresses, built reproducibly with a fixed seed by [`scripts/build_demo_fixture.py`](scripts/build_demo_fixture.py)) with `/24` IP masking (`EXPOSE_FULL_IP=false`) and zero orphan alerts (click **Run scenario** in `/console` to stream live `demo: true` alerts and Merkle ledger entries). Explicitly labeled `Simulated fixture` / `Simulated data active` across `/console`, map legend, inspector, and `/console/devices/[id]`.
> - **Pre-existing Synthetic Benchmarks (`paper/data/results.json`, CI fixtures):** Hand-authored **120-scenario** formula sanity check and synthetic unit-test arrays, strictly separated under `<SyntheticChip />` (`Synthetic corpus, n = 120`).

---

## Data Governance: Real vs. Simulated Data (and Why Synthetic Data Is Used)

| Component | Source | Classification | Why Not Live Third-Party Data? |
|---|---|---|---|
| **Censys Exposure Snapshot** (`data/censys/2026-11-26/`) | Censys Platform (`104,218` India camera hosts) | **Real OSINT Aggregates** | Storing or republishing raw third-party vulnerable camera IPs creates a dual-use attacker target list and violates Censys redistribution / responsible-disclosure boundaries. |
| **Tier 2 Video Evaluation** (`eval/results/`) | Real public **CUHK Avenue** CCTV clips + programmatic tamper onset | **Real Footage + Controlled Tamper Injection** | Intercepting live external RTSP camera streams violates India's **IT Act, 2000 (§43, §66)** and **DPDP Act, 2023**; public datasets also lack ground-truth RTSP freeze/loop timestamps unless injected reproducibly at `t0`. |
| **Console Fleet & Inspector** (`data/public.db`, `/console`) | Seeded DB fixtures (`geo_source = 'synthetic_demo'`, `/24` masked) | **Simulated (Labeled in UI)** | Demonstrates end-to-end trust scoring, triage filtering, map clustering, and Merkle auditing safely without exposing live vulnerable infrastructure on a web UI. |
| **Formula Comparison & CI Tests** (`eval/labeled_events.json`, `test_liveness_detector.py`) | Hand-authored scenarios (`n=120`) + synthetic numpy test frames | **Synthetic (Formula & CI Check)** | No public multi-month dataset links real camera banner drift history to physical compromise labels; deterministic synthetic arrays verify gate axioms (`Proposition 1–5`) and ~1-minute automated tests. |

---

## Ethics & Privacy Boundaries (Strictly Enforced)

- **Strictly Passive (Zero Outbound Probing):** All active network-probing code (`heartbeat_service.py`, `heartbeat_router.py`, `test_heartbeat_service.py`) has been **permanently removed** from the repository. The backend never sends probes or opens TCP connections to discovered device IPs.
- **Censys Metadata & Aggregates Only:** Censys is queried strictly for aggregate bucket counts (never raw hosts or IPs). `scripts/censys_ingest.py` is hard-guarded to refuse execution. Approved Platform v3 baseline query: `host.location.country: "India" AND host.services.hardware.type: "CAMERA"`.
- **Anonymization (`public.db`):** Read APIs mask host octets to `/24` (`a.b.c.0`) unless `EXPOSE_FULL_IP=true` is explicitly enabled locally.
- **Demo Transparency:** Simulated alerts carry `"demo": true` and `/console` displays dataset provenance when simulated records are loaded alongside visible OpenStreetMap attribution (`Natural Earth` self-hosted boundary fallback or optional Protomaps PMTiles).
- Full policy: [`ETHICS_AND_SCOPE_POLICY.md`](ETHICS_AND_SCOPE_POLICY.md).

---

## Repository Layout

| Path | Description |
|---|---|
| [`backend/`](backend/) | FastAPI service (`main.py`), passive trust scoring (`services/trust_score_service.py`), signal integrity gate, Merkle audit ledger, Censys/provenance routes |
| [`frontend/`](frontend/) | Next.js 16 + MapLibre GL JS console, `/research`, `/lab`, `/ethics`, `/console`, `/console/devices/[id]` |
| [`video_pipeline/`](video_pipeline/) | YOLOv8 + ByteTrack + `FrameLivenessTracker` (Tier 2 pHash freeze, Laplacian blur drift, spec check) |
| [`eval/`](eval/) | [`eval/README.md`](eval/README.md), `eval/results/` (real-footage CSV + `summary.md`), `tier2_real_footage.py` (incl. `--clean-only` streaming), `robustness_sweep.py` (incl. `--variants adaptive`), `calibrate_thresholds.py` (split conformal), `compare_runs.py`, `make_figures.py`, `benchmark_speed.py`, and legacy synthetic harness (`run_eval.py`) |
| [`docs/`](docs/) | [`REVIEW2_SCOPE.md`](docs/REVIEW2_SCOPE.md), [`DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md), [`SPEED_BENCHMARK.md`](docs/SPEED_BENCHMARK.md), [`API_STREAMS.md`](docs/API_STREAMS.md) (WebSocket/SSE message formats), [`comparisons/`](docs/comparisons/), [`figures/`](docs/figures/), [`diagrams/`](docs/diagrams/) |
| [`scripts/`](scripts/) | `censys_snapshot.py` (Platform v3 aggregate runner + web paste converter), `build_demo_fixture.py` (simulated demo DB), `build_public_db.py` (masks a working DB into `public.db`), `censys_ingest.py` (blocked by guard) |
| [`testbed/`](testbed/) | Owned-camera testbed for the paper (MediaMTX relay, FFmpeg loop/freeze injection, banner logging restricted to your own devices); no camera run yet |
| [`data/censys/`](data/censys/) | Dated Censys aggregate snapshots (`YYYY-MM-DD/snapshot.json`, no IPs) |
| [`paper/`](paper/) | Secondary manuscript sources, `LOG.md`, `CLAIMS.md`, `TODO.md`, and synthetic-corpus outputs |
| [`archive/`](archive/) | Old hackathon dossiers and superseded drafts (kept for history; contain placeholder figures) |

---

## Quick Start (Local Demo)

Requires **Python 3.12** and **Node >= 20.9**.

### 1. Backend (`http://localhost:8000`)

```powershell
cp .env.example .env
pip install -r backend/requirements.txt

# Build the simulated demo DB once (data/*.db is git-ignored): 9,320 devices, fixed seed, /24 masked
python scripts/build_demo_fixture.py
# (Alternative, if you have a private working DB: python scripts/build_public_db.py masks surveillancewatch.db into public.db)

# Point backend at the sanitized public DB for demo rehearsal
$env:DATABASE_PATH = "data/public.db"
python backend/main.py
```

Interactive API documentation is served at `http://localhost:8000/docs`.

### 2. Frontend (`http://localhost:3000`)

```powershell
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Map rendering works out of the box with the self-hosted India & South Asia boundary fallback (`/map/india-states.geojson`, `/map/south-asia-countries.geojson`) and OpenStreetMap attribution. Street-level Protomaps tiles (`frontend/public/tiles/india.pmtiles`, about 263 MB, git-ignored) are used when present; build them with `bash frontend/scripts/build-basemap.sh 11 <planet-url>` (see [`frontend/BASEMAP.md`](frontend/BASEMAP.md)).

### 3. Docker (alternative)

```powershell
python scripts/build_demo_fixture.py
docker compose up --build
```

The backend uses `data/public.db` unless `COBRA_DATABASE_PATH` is set, and reads `data/censys/` and `paper/data/results.json`
from mounted folders; the frontend mounts `eval/results/` read-only so `/research` shows the real runs. `docker compose build`
was checked on Kali on 2026-11-27; a full `docker compose up` with these mounts has not been run yet.

---

## Reproducing Real Snapshot & Evaluation Runs

### Censys Platform API v3 Aggregate Snapshot (Aggregates Only)

```powershell
# Inspect planned CenQL v3 payloads without making API calls
python scripts/censys_snapshot.py --dry-run --baseline-only

# Run live approved baseline aggregate query (requires Censys Platform PAT)
$env:CENSYS_API_TOKEN = "censys_..."
python scripts/censys_snapshot.py --baseline-only

# Convert aggregate tables/JSON/CSV copied from the Censys web UI into snapshot.json
python scripts/censys_snapshot.py --from-paste pasted.txt --query 'host.location.country: "India" AND host.services.hardware.type: "CAMERA"' --field host.services.port
```

### Real-Footage Tier 2 Evaluation

See [`eval/README.md`](eval/README.md) for the CUHK Avenue reproduction commands. The research-paper test plan (truly public datasets, clean-footage false alarms on long video, the adaptive-attacker suite, conformal calibration, the owned-camera testbed) is in [`testing_rp.md`](testing_rp.md); that code is written but has not been run on real footage yet.

### Running Tests

```powershell
# Full backend + pipeline + eval harness suites (440 collected: 374 backend, 52 video_pipeline, 14 eval -> 439 passed, 1 skipped)
# Single source of truth for all test counts: frontend/src/lib/content/facts.manual.ts (eval.tests)
python -m pytest backend/tests/ video_pipeline/tests/ eval/ -q
python -m pytest backend/tests/ -q
python -m pytest video_pipeline/tests/ -q
python -m pytest eval/test_eval_harness.py eval/test_full_system_stress_and_benchmark.py eval/test_run_eval_api_mode_indepth.py -q

# Frontend checks (10 Vitest suites / 76 tests = 7 unit suites / 46 tests + 3 contract suites / 30 tests; 265 golden vectors; run 2026-11-28)
cd frontend
npm run test
npx eslint src tests
npx tsc --noEmit
npm run build
```

---

## Future Scope (Explicitly Out of Review 2 Scope)

- Longitudinal Tier 1 passive banner-drift evaluation across historical Censys device snapshots
- Multi-month empirical drift rate studies on real camera populations
- Controlled testbed evaluation on owned laboratory IP cameras (scripts in `testbed/`, no camera yet)
- Vulnerability-only vs. IG-DCTF comparative field study on real live deployments

## Documentation & Governance

- [`CLAUDE.md`](CLAUDE.md) - Project rules, real-data mandate, and Censys boundaries
- [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md) - Web UI design system and contracts
- [`ETHICS_AND_SCOPE_POLICY.md`](ETHICS_AND_SCOPE_POLICY.md) - Legal, privacy, and responsible disclosure policy
- [`paper/LOG.md`](paper/LOG.md) - Append-only chronological worklog
- [`testing_rp.md`](testing_rp.md) - Research-paper testing plan and public datasets
- [`docs/API_STREAMS.md`](docs/API_STREAMS.md) - WebSocket and SSE message formats
- [`LICENSE`](LICENSE) - MIT
