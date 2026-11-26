# CLAUDE.md: COBRA-WATCH / IG-DCTF project instructions

Read this first. It tells an agent how to work in this repository without redoing or undoing earlier work.

## Target Milestone
- **Primary deadline:** BE Major Project **Review 2 on Saturday, December 19, 2026**.
- **Scope for Review 2:** Real Tier 2 (`FrameLivenessTracker`) results on public video (and optional self-recorded clips) saved in `eval/results/`, plus real Censys Platform API aggregate snapshots saved in `data/censys/YYYY-MM-DD/snapshot.json`. Everything else (longitudinal banner drift history, real-device field testbed, CVE-vs-gated real-device comparison) is explicitly **future scope**.
- **`paper/` is a secondary manuscript.** The old IEEE TIFS journal submission target no longer drives our schedule.
- **`paper/data/results.json` and `paper/results.md` are synthetic-benchmark results** generated from the 120 hand-authored synthetic scenarios (`eval/labeled_events.json`), **not real-world evidence**. Never present synthetic numbers as real research findings.

## Hard rules (set by the user — never bend)
1. **REAL DATA ONLY.** Never create synthetic data and present it as research data. Synthetic data is allowed **only** as a labelled test fixture or clearly labelled demo scenario, never in real research results.
2. **Do not commit or push.** The user makes all git commits and pushes.
3. **Do not invent Censys field names or API syntax.** Check `https://docs.censys.com` first before writing or editing queries, auth headers, or aggregate fields. If unsure about a field path or endpoint behavior, say so explicitly.
4. **Censys is metadata only, aggregates only.** Never query, collect, ingest, or store individual IP addresses or host identifiers from Censys. `scripts/censys_ingest.py` is hard-guarded to refuse execution. Use `scripts/censys_snapshot.py` (aggregates only).
5. **Do not tune any detector threshold or weight without logging it** in `paper/LOG.md` as **"tuned after seeing data"**.
6. **Say what you will run and how long it takes** *before* running anything slow. Ask first for anything over ~30 s.
7. **Keep logs current** (append-only `paper/LOG.md`, `paper/CLAIMS.md`, `paper/TODO.md`). A change is not finished until the logs reflect it.
8. **Be honest.** Never state an unverified result, uncompiled artifact, or unexecuted check as done. Report negative findings and gaps plainly.

## Conventions
- Positive class in evaluations = `fabricated`; predicted positive iff final score < 50 (`low_trust`). Wilson 95% confidence intervals.
- Tiers: `high_trust >= 80`, `medium_trust 50..79`, `low_trust < 50`. Gate thresholds: `theta_low = 0.50`, `theta_high = 0.85`, `floor = 0.30`, `hard_cap = 30`.
- Tier 2 weights are `(1.0, 0.6, 0.5)` since 2026-10-09 (logged in `paper/LOG.md` — revised after seeing synthetic benchmark).
- `public.db` masking: `/24` masking on public device outputs (`mask_ip_for_public()`), and simulated demo traffic carries `demo: true` / `synthetic_demo`.

## Research-ethics boundary (strictly passive)
- Zero outbound probing: active heartbeat modules (`heartbeat_service.py`, `heartbeat_router.py`, `test_heartbeat_service.py`) have been **deleted completely**. No code in `backend/` sends probes or opens TCP/socket connections to discovered device IPs.
- Never fetch live video or probe third-party cameras. Video analysis operates solely on public datasets or researcher-owned clips.
- Never save third-party raw IPs in logs, results, or public database exports.

## Where things are
| Path | Purpose |
|---|---|
| `eval/tier2_real_footage.py`, `eval/results/` | Real-footage Tier 2 evaluation harness, CSV + `summary.md` outputs (real data only) |
| `data/censys/YYYY-MM-DD/snapshot.json` | Saved Censys Platform API v3 aggregate snapshots (metadata & counts only, no IPs) |
| `scripts/censys_snapshot.py` | Aggregate snapshot runner + `--from-paste` web UI converter (`CENSYS_API_TOKEN` Bearer auth) |
| `scripts/censys_ingest.py` | **Disabled by hard guard** (enforces Censys aggregates-only commitment) |
| `scripts/build_public_db.py` | Produces sanitized `data/public.db` (strips `SIM_*`, masks IPs to `/24`, verifies audit ledger) |
| `backend/` | FastAPI service (`backend/main.py`): passive scoring, audit ledger, scenarios, real/synthetic transparency routes |
| `video_pipeline/` | YOLOv8 + ByteTrack + `FrameLivenessTracker` (Tier 2 visual liveness) |
| `frontend/` | Next.js 16 web app (`/`, `/research`, `/lab`, `/ethics`, `/console`, `/console/devices/[id]`) |
| `paper/` | Secondary manuscript (`main.tex`), **synthetic** benchmark outputs (`results.md`, `data/results.json`), `LOG.md`, `CLAIMS.md`, `TODO.md` |
| `archive/` | Historical hackathon / early-phase dossiers preserved for reference only (contain placeholder figures) |
| `ETHICS_AND_SCOPE_POLICY.md` | Passive OSINT & data-handling policy |
| `FRONTEND_SPEC.md` | Design system & console architecture reference |

## Maintenance protocol
After any code or documentation change, before ending the turn:
1. If real Tier 2 results change, inspect `eval/results/` and verify `/research` displays dataset, date, and command accurately.
2. If synthetic benchmark code changed and user asks to recompute, run `python paper/scripts/compute_results.py` and keep `paper/results.md` and `paper/data/results.json` clearly marked **synthetic**.
3. Append a dated entry to `paper/LOG.md`: what changed, files touched, why, and what was *not* verified.
4. Update affected rows in `paper/CLAIMS.md` and `paper/TODO.md`.
Never delete log entries; correct them with a new dated entry.
