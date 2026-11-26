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

> **Milestone & Current Data Status (Nov 26, 2026)**  
> Primary target: **BE Major Project Review 2 (Saturday, December 19, 2026)**. `paper/` is maintained as a secondary manuscript.
> - **Real Tier 2 video results (`eval/results/`):** Awaiting public-video evaluation runs (`eval/tier2_real_footage.py`). No real-footage numbers are published here yet.
> - **Censys aggregates (`data/censys/`):** Aggregate-only snapshot pipeline verified in `--dry-run` mode (`scripts/censys_snapshot.py`) against the Censys Platform API v3 endpoint; awaiting live `CENSYS_API_TOKEN` / web Report Builder aggregate capture.
> - **Console & Demo Database (`data/public.db`):** Sanitized copy contains **9,320 simulated device fixtures** (`geo_source = 'synthetic_demo'`) with `/24` IP masking (`EXPOSE_FULL_IP=false`) and **2** audit entries. No synthetic numbers are reported as real findings.
> - **Pre-existing synthetic benchmark (`paper/data/results.json`):** Contains outputs from the 120 hand-authored synthetic scenarios only (formula sanity check, not real-world evidence). See [`paper/CLAIMS.md`](paper/CLAIMS.md).

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
| [`eval/`](eval/) | [`eval/README.md`](eval/README.md), `eval/results/` (destination for real-footage CSV + `summary.md`), and legacy synthetic harness (`run_eval.py`) |
| [`scripts/`](scripts/) | `censys_snapshot.py` (Platform v3 aggregate runner + web paste converter), `build_public_db.py`, `censys_ingest.py` (blocked by guard) |
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

# Optional: rebuild sanitized public demo DB from surveillancewatch.db
python scripts/build_public_db.py

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

Map rendering works out of the box with the self-hosted India & South Asia boundary fallback (`/map/india-states.geojson`, `/map/south-asia-countries.geojson`) and OpenStreetMap attribution. To upgrade to full Protomaps street-level tiles (`frontend/public/tiles/india.pmtiles`), run `bash frontend/scripts/build-basemap.sh 11 <planet-url>`.

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

See [`eval/README.md`](eval/README.md) for reproduction commands once public video clips are evaluated into `eval/results/`.

### Running Tests

```powershell
# Targeted backend integrity & wiring tests (runs in ~10s against a temp DB copy)
python -m pytest backend/tests/test_tier2_live_wiring.py backend/tests/test_audit_and_decay_indepth.py backend/tests/test_signal_integrity_gate.py backend/tests/test_api.py -q

# Frontend checks
cd frontend
npx eslint src tests
npx tsc --noEmit
npm run build
```

---

## Future Scope (Explicitly Out of Review 2 Scope)

- Longitudinal Tier 1 passive banner-drift evaluation across historical Censys device snapshots
- Multi-month empirical drift rate studies on real camera populations
- Controlled testbed evaluation on owned laboratory IP cameras
- Vulnerability-only vs. IG-DCTF comparative field study on real live deployments

## Documentation & Governance

- [`CLAUDE.md`](CLAUDE.md) - Project rules, real-data mandate, and Censys boundaries
- [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md) - Web UI design system and contracts
- [`ETHICS_AND_SCOPE_POLICY.md`](ETHICS_AND_SCOPE_POLICY.md) - Legal, privacy, and responsible disclosure policy
- [`paper/LOG.md`](paper/LOG.md) - Append-only chronological worklog
