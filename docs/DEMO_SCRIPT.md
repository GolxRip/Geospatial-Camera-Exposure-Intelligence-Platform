# COBRA-WATCH: 8-Minute Review 2 Live Demo Script

**Total Runtime:** 8 minutes (6:30 walkthrough + 1:30 panel Q&A buffer)  
**Pre-flight Rule:** Run cleanly from `data/public.db` (zero raw third-party IPs; zero outbound camera probes). Always state aloud which screens display **real OSINT/video evidence** versus **simulated console fixtures**.

---

## 0. Pre-Flight Startup (2 Minutes Before Panel)

```powershell
# Terminal 1 — Backend API (passive mode on sanitized public DB)
cd c:\Users\goldi\Downloads\COBRA-WATCH-Project
$env:DATABASE_PATH = "data/public.db"
python backend/main.py
# Verify: http://localhost:8000/health -> {"status": "ok"}

# Terminal 2 — Frontend production server (enable console-preview fallback cleanly in build)
cd c:\Users\goldi\Downloads\COBRA-WATCH-Project\frontend
$env:NEXT_PUBLIC_DESIGN_PREVIEW = "true"
npm run build
npm run start
# Verify: http://localhost:3000 (and fallback http://localhost:3000/console-preview)
```

Check once before starting:
- `/api/censys/snapshots` returns `available: true` (`104,218` real India camera hosts).
- `/research` renders real CUHK Avenue tables from `eval/results/`.

---

## 1. Timed Click Path (8 Minutes)

### `0:00 – 1:00` | The Problem & Landing Overview (`http://localhost:3000/`)
- **Open:** Home page `/` (`Hero`: *"A secure camera can still lie."*).
- **Scroll slowly** to the two-channel model & `Results, with their limits` section.
- **Say:**  
  > "Traditional scanner scores only measure Channel A vulnerability posture (`T_cve`). An attacker who freezes, loops, covers, blurs, or rotates a fully patched camera keeps getting high trust. COBRA-WATCH adds Channel B signal integrity (`s = (1 - Drift) * L(t)`) and joins them with a non-compensating multiplicative gate `G(s)` so a tampered feed cannot be rescued by clean CVEs."
- **Real vs. Simulated callout:** Point directly at the `Real Tier 2 video evaluation` box vs. the `Synthetic corpus, n = 120` badge ("we never mix real video results with synthetic formula checks").

### `1:00 – 2:15` | Ethics Boundary & Real Censys Baseline (`http://localhost:3000/ethics` + API tab)
- **Click:** Top nav -> **Ethics** (`/ethics`), scroll to **Strict passive boundary** and **Why simulated and synthetic data are used**.
- **Optional quick tab check:** Show `http://localhost:8000/api/censys/snapshots` in a browser tab (`104,218` total hosts, ports `554 = 81,285`, cities, protocols, vendors, ASNs — **zero raw IPs**).
- **Say:**  
  > "We do zero outbound probing — our earlier prototype TCP heartbeat router was completely removed from the codebase (`404` on `/api/heartbeat/status`, deleted from `schema.d.ts`). Under India's IT Act 2000 §§43/66 and DPDP Act 2023, we store Censys purely as aggregate counts across 104,218 exposed India cameras, never raw camera IP targets or live RTSP streams."

### `2:15 – 4:15` | Real Tier 2 Evidence (`http://localhost:3000/research#results`)
- **Click:** Top nav -> **Research** (`/research`) -> jump to **Results** (`#results`).
- **Point out clearly:**
  1. **Real CUHK Avenue baseline (`v1`) vs. frozen (`v2`) side-by-side** tables.
  2. Explicit split badges: **`development set (tuned)`** (`training_videos`: 14 evaluated, 2 dropped < 12s) vs. **`held-out`** (`testing_videos`: 16 evaluated, 5 dropped < 12s; plus any self-recorded `Own clips (day/night)`).
  3. Clean false-alarm rate column with **clean hours (`0.131 h` / `0.119 h`)** and **exact 95% Poisson intervals** (`45.9/h -> 0.0/h [0.0, 28.2]` on training; `33.5/h -> 0.0/h [0.0, 30.9]` at `tripped` and `8.4/h [0.2, 46.6]` at `degraded` on held-out `testing_videos`, alongside `15/16` (`93.8%`) on `loop` and `16/16` across the other 7 transforms).
  4. **Expand** one `Per-video breakdown: per_run.csv` `<details>` toggle briefly so panel sees every single clip row is parsed dynamically from `eval/results/`, not hardcoded.
  5. **Scroll to `#limits`:** Show `Synthetic corpus, n = 120` clearly separated + why `slow_blur`, `loop`, `partial_cover`, and `moved` improved after fixing `FrameLivenessTracker` without fitting to test footage.

### `4:15 – 5:30` | Interactive Integrity Gate Lab (`http://localhost:3000/lab`)
- **Click:** Top nav -> **Lab** (`/lab`).
- **Interact:** Drag Signal Integrity `s` below `0.85` (taper region) and below `0.50` (hard gate cap `<= 30`), while keeping `T_cve = 95`.
- **Say:**  
  > "Notice the exact multiplicative curve verified against our Python backend on 748 vectors: once visual liveness drops signal integrity below 0.50, even a device with zero CVEs is hard-capped at trust 30 (`low_trust`), forcing operator inspection before acting on an alert."

### `5:30 – 7:15` | Passive Triage Console & Audit Trail (`http://localhost:3000/console`)
- **Click:** **Open console** -> `/console`.
- **Point out the top banner first:**  
  > *"Simulated data active: 9320 of 9320 displayed devices in All India use synthetic fixtures with /24 IP masking..."*
- **Explicitly state what is simulated:**  
  > "All 9,320 device markers here are intentionally simulated (`synthetic_demo`) with `/24` IP masking so the demo never exposes real third-party camera targets."
- **Click 1 (City Filter):** Change **All India** -> **Mumbai** -> show map smooth zoom over India/South Asia OpenStreetMap-attributed boundary layer + cluster badges.
- **Click 2 (Alert Stream -> Inspector):** If the feed starts empty after a clean `scripts/build_public_db.py` rebuild, click **Run scenario** to stream labeled `demo: true` events; then click any device marker or alert row in **Alert Stream** to inspect the right-hand **Inspector**:
  - Point to the **`Simulated fixture`** badge and `Provenance` row (`geoProvenance`), Channel A CVE factors, Channel B status (`Tier 2 unavailable: no authorized footage` for internet cameras), and **Gate** curve.
- **Click 3 (Device Forensics + Analytics Drawer):** Click **Open forensics** (`/console/devices/...`) -> verify **`SimulatedBanner`** persists at the top! Return/open **Analytics** bottom drawer -> show `Ledger` tab (`Verify full chain` cryptographic Merkle check) and `Alerts` tab (`Real` vs `Demo` dashed series kept apart).

### `7:15 – 8:00` | Scope Honesty & Panel Q&A Wrap-Up
- **Close by showing:** [`docs/REVIEW2_SCOPE.md`](REVIEW2_SCOPE.md) summary slide / table: what is real right now (`104,218` Censys aggregates + real CUHK Avenue / self-recorded video runs) vs. what is explicitly labeled future scope (multi-month historical banner drift, live owned testbed field comparison).

---

## 2. Offline / Backend-Down Fallback Plan

Use these immediate fallbacks if Wi-Fi, FastAPI (`:8000`), or database state fails during the live evaluation:

1. **If backend API (`localhost:8000`) is down or crashes during demo:**
   - Open **`http://localhost:3000/console-preview`** directly! It renders the identical 3-pane console layout, city filters, inspector, Gate curve, and interactive scenario runner locally in React using RFC 5737 (`192.0.2.x`) scripted fixtures under a persistent **"Demo data"** banner — zero backend required.
   - Note `/research` and `/lab` and `/ethics` are server/client Next.js pages backed by local files (`eval/results/`, `gate.ts`), so **`/` , `/research`, `/ethics`, and `/lab` keep working 100% offline** even if FastAPI stops!
2. **If `data/public.db` becomes locked or altered during rehearsal:**
   ```powershell
   python scripts/build_public_db.py
   ```
   This rebuilds `data/public.db` deterministically with clean `/24` masking and a valid Merkle chain in a few seconds.
3. **If local map server or localhost ports are blocked altogether:**
   - Show saved static artifacts directly from `docs/figures/*.svg` (`CAPTIONS.md`), `docs/diagrams/architecture.svg`, `docs/diagrams/igdctf-pipeline.svg`, `eval/results/*/summary.md`, and `data/censys/2026-11-26/README.md`.
