# COBRA-WATCH — BE Major Project Review 2 Slide Deck & Examiner Q&A

**Target Milestone:** BE Major Project Review 2 (Saturday, December 19, 2026)  
**Tagline:** *A camera can be secure and still lie.*  
**Architecture Diagram:** [`docs/diagrams/architecture.svg`](diagrams/architecture.svg) · **Gate Diagram:** [`docs/diagrams/igdctf-pipeline.svg`](diagrams/igdctf-pipeline.svg) · **Live Demo Script:** [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

> **Presentation Rule (Real vs. Synthetic Hygiene):** Never blur real measurements (`104,218` Censys India host aggregates, real CUHK Avenue clips + programmatic tamper onset) with the `data/public.db` simulated fleet (`9,320` masked fixtures) or the `n = 120` synthetic formula check. State every boundary openly before the panel asks.

---

## Slide-by-Slide Outline (11 Slides, ~12 Minutes + Demo)

### Slide 1 — Title & Core Thesis
- **Title:** COBRA-WATCH: Passive Cyber-Physical Trust Scoring for Exposed Surveillance Cameras
- **Core Premise:** Vulnerability scanners assume a patched, un-exploited camera cannot lie. An attacker behind a reverse proxy, virtual camera, or RTSP MITM relay can leave CVE banners clean while replaying stale footage.
- **Contribution (IG-DCTF):** Two orthogonal evidence channels joined by a multiplicative Integrity Gate (`T_final = round(T_cve * G(s))`).

### Slide 2 — Motivation & Real India Exposure Footprint (Censys Aggregates Only)
- **Dataset:** [`data/censys/2026-11-26/snapshot.json`](../data/censys/2026-11-26/snapshot.json) (`host.location.country: "India" AND host.services.hardware.type: "CAMERA"`)
- **Scale:** **104,218** real Indian camera hosts across 6 aggregate dimensions (ports, cities, protocols, vendors, products, ASNs); **81,285** expose RTSP port **554**.
- **Strict Ethics Constraint:** Zero raw IPs stored or displayed; aggregate bucket counts only; `scripts/censys_ingest.py` hard-blocked; zero outbound probing (`heartbeat_*` permanently deleted).

### Slide 3 — Problem Gap: Why Single-Channel Trust Models Fail
- **Twin-Camera Intuition:** Two identical cameras (`dnvrs-webs`, firmware `v5.4.1`, ports `80, 554, 8000`, `0` known CVEs) both start with `T_cve = 100` (`high_trust`).
- **Feed A (Live)** vs. **Feed B (Frozen/Looped):** Channel A (Weighted Average, CVE-only, Bayesian log-odds) leaves Feed B at `100`. Additive fusion still struggles to cap strong posture when signal fails.
- **Design Goal:** A secure-looking feed with failed signal integrity (`s < 0.50`) must be **hard-capped at `T_final <= 30` (`low_trust`)** regardless of `T_cve`.

### Slide 4 — System Architecture & Passive Boundary
- **Visual:** [`docs/diagrams/architecture.svg`](diagrams/architecture.svg)
- **Three Services:**
  1. **FastAPI Backend (`backend/`):** Async SQLite persistence, IG-DCTF scoring, Merkle hash-chained audit ledger (`audit_ledger`), WebSocket live push (`/api/ws/alerts`), Groq NL query parser with deterministic regex fallback.
  2. **Next.js 16 + MapLibre GL JS Frontend (`frontend/`):** Landing walkthrough (`/`), Research evidence (`/research`), Interactive Gate & Replay Lab (`/lab`), Ethics & Provenance (`/ethics`), Operator Console (`/console`).
  3. **YOLOv8 + ByteTrack + `FrameLivenessTracker` (`video_pipeline/`):** Runs strictly offline on authorized local/dataset video files; refuses live third-party RTSP URLs (`_assert_source_is_authorized`).

### Slide 5 — IG-DCTF Mathematical Model (`T_cve * G(s)`)
- **Visual:** [`docs/diagrams/igdctf-pipeline.svg`](diagrams/igdctf-pipeline.svg)
- **Channel A (`T_cve`, 0–100):** Combines NVD + CISA KEV vulnerabilities, authentication posture, owner classification (`government`, `telecom`, `corporate`), firmware patch age, and spatial corroboration.
- **Channel B (`s in [0, 1]`):**
  - *Tier 1 (Passive Banner Drift):* Weighted comparison across 6 fields (`firmware_version` `0.25`, `http_server` `0.20`, `open_ports` `0.20`, `resolution` `0.20`, `product_string` `0.10`, `codec` `0.05`; anomaly threshold `0.15`).
  - *Tier 2 (Visual Frame Liveness `L(t)`):* Weighted deficit across freeze/loop (`w = 1.0`), quality/blur drift (`w = 0.6`), and spec mismatch (`w = 0.5`).
- **Multiplicative Integrity Gate (`G(s)`):**
  - `s >= 0.85` -> `G(s) = 1.0` (`nominal`)
  - `0.50 <= s < 0.85` -> linear taper from `0.30` to `1.0` (`tapered`)
  - `s < 0.50` -> `G(s) = 0.30` (`hard_gated`, forcing `T_final <= 30` even at `T_cve = 100`)

### Slide 6 — Tier 2 Freeze/Loop Fix (`v1` -> `v2` at `023c5c4`)
- **The `v1` Bug Discovered in Testing:** Comparing consecutive frames only caught identical static freezes (`0/14` training, `1/16` held-out loops), because replaying a 2–5 s real clip preserves natural frame-to-frame motion!
- **Wait-Free `v2` Upgrades (`video_pipeline/liveness_detector.py`):**
  - Un-smoothed `INTER_NEAREST` grayscale ring-buffer (`pHash`, Hamming threshold `1`) + prefix-sum motion check for replay loop detection
  - Anchored blur baselines (`slow_blur`)
  - `8x8` block grid check for `partial_cover`
  - Edge/layout correlation check for `moved` cameras + static-scene false-alarm guard

### Slide 7 — Real Public Video Evaluation: CUHK Avenue (`v1` vs. Held-Out `v2`)
- **Visuals:** [`docs/figures/detection_rate_tripped.svg`](figures/detection_rate_tripped.svg), [`docs/figures/false_alarms_per_hour.svg`](figures/false_alarms_per_hour.svg)
- **Protocol:** CUHK Avenue real surveillance clips (`training_videos`: `14/16` evaluated, `2` dropped `<12s`, `0.1306` clean h; held-out `testing_videos`: `16/21` evaluated, `5` dropped `<12s`, `0.1195` clean h) with programmatic tamper injection at `t0` across `8` failure modes (`320 px`).
- **Held-Out `testing_videos` (`v1 -> v2`, `tripped` level):**
  - `loop`: `1/16` (`6.2%`) -> **`15/16` (`93.8%` [71.7, 98.9]%**, median delay `0.56 s`; `video 13` `14.3 s` missed)
  - `slow_blur`: `0/16` -> **`16/16` (`100%`**, median delay `5.88 s`)
  - `moved`: `2/16` (`12.5%`) -> **`16/16` (`100%`**, median delay `1.96 s`)
  - `partial_cover`: `13/16` (`81.2%`) -> **`16/16` (`100%`**, median delay `0.76 s` vs `4.16 s`)
  - `freeze`, `blur`, `cover`, `downscale`: **`16/16` (`100%`)**
  - Clean False Alarms (`tripped`): `4` FAs (`33.5/h` [9.1, 85.7]) -> **`0` FAs (`0.0/h` [0.0, 30.9])**. At `degraded`: `4` -> **`1` FA** on `video 06` (`8.4/h` [0.2, 46.6]).

### Slide 8 — Runtime Throughput & Formula Sanity Checks
- **Real Tier 2 CPU Throughput ([`docs/SPEED_BENCHMARK.md`](SPEED_BENCHMARK.md)):** Intel `i5-12450H`, Python `3.12.6`, OpenCV `5.0.0`, `300` frames (`synthetic_pattern` `320x180`):
  - **`v2` (`023c5c4`):** **`281.9` FPS @ 320 px** (`3.55 ms/frame`), **`71.2` FPS @ 640 px** (`14.04 ms/frame`) vs `v1` (`606.8` / `84.8` FPS) — >2x real-time headroom at 640 px on CPU alone.
- **In-Process Gate Overhead ([`paper/results.md`](../paper/results.md)):** `4.69 us/call` full IG-DCTF vs `2.60 us/call` Channel A only (pure Python, excludes I/O).
- **Synthetic Formula Verification (`n = 120`, strictly labelled `Synthetic`):**
  - Verifies gate logic against baselines (`IG-DCTF` F1 `0.9756` vs `Bayesian` `0.8319`, `CVE-only` `0.8113`, `WA` `0.7525`; exact McNemar `17` vs `0`, `p = 1.53e-05`; multiplicative `FN = 3` vs additive `FN = 10`).
  - *Honest Caveat:* Only `30` of `120` carry Channel B fields (`Acc = 1.000`); on the `90` attribute-only scenarios `IG-DCTF = CVE-only` (`0.967`).

### Slide 9 — Hardening, Auditability & Automated Verification
- **Security & Forensic Integrity:**
  - Idempotent `POST /api/detection-event` (`DETECTION_API_KEY` + 60 s timestamp freshness + per-camera rate limiting + collusion velocity checks).
  - Tamper-evident `audit_ledger` Merkle chain (`SHA-256` hash linking + full verification endpoint).
  - Privacy-first IP masking (`a.b.c.0` `/24` when `EXPOSE_FULL_IP=false`), explicit `demo: true` isolation, and zero orphan alerts in `data/public.db` (`9,320` masked simulated devices).
- **Verified Engineering Quality (`2026-11-27`):**
  - **Backend + Pipeline + Eval (`pytest`):** **`439 passed, 1 skipped, 0 warnings`** (1 skip = untrained-GNN 503 test when trained `.pt` weights exist). Asyncio loop/SQLite lock races resolved (`timeout=30.0`, sync/async ledger split).
  - **Frontend (`Vitest` / `eslint` / `tsc`):** `7` files / `42` unit tests passing (including `265` Python-vs-TypeScript golden gate vectors), clean ESLint & TypeScript compilation.

### Slide 10 — Live Demo Plan (~4 Minutes)
*(Follow [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md) step-by-step)*
1. **`/` & `/research`:** Contrast *Real Tier 2 video evaluation* (`avenue_train_tuned` & held-out `avenue_test_tuned`) directly against the `<SyntheticChip />` `n = 120` corpus + limits block.
2. **`/lab`:** Run Interactive **Gate Explorer** (`T_cve = 100`, slide `s` past `0.85 -> 0.50 -> 0.49` to observe hard cap `30`); trigger **Scenario Replay** streaming `12` live `demo: true` events via `/api/ws/alerts` + **Attack Simulators**.
3. **`/console`:** Inspect India map with explicit **`Simulated data active`** chip (`/24` masked IPs, `Simulated fixture`), inspect factor breakdown + 5-model table + Merkle chain trail, toggle **Run scenario** and verify ledger.
4. **`/ethics`:** Confirm strictly passive posture, Censys aggregates-only rule, and zero-live-RTSP enforcement.

### Slide 11 — Honest Limitations & Future Work (Post-Review 2)
- **Tier 1 Field Evidence:** Passive banner-drift effectiveness on multi-month real Internet camera histories is **unverified** (synthetic `13`-case drift benchmark only; awaits longitudinal Censys snapshots `U3a`).
- **Narrow Clean Baseline Window:** `0.1195 h` (~7.2 min) across 16 held-out Avenue clips leaves the `0` FA Poisson upper 95% CI at **`30.9/h`** (`8.4/h` at `degraded` due to `video 06`).
- **Controlled Tamper & Adaptive Adversary (`U2`/`U4`):** Avenue uses programmatic onset on real surveillance clips; `video 13` (`14.3 s`) missed `loop`, and sub-perceptual frame noise against ring-buffer pHash remains open.
- **Infrastructure Scope:** Single-node SQLite (`surveillancewatch.db` / `public.db`) fits Review 2 demo/eval scale, not horizontal multi-writer deployment.

---

## Examiner Q&A Prep (Hard Questions & Direct Answers)

1. **Q: Did you really test on live CCTV cameras in India?**  
   **A:** No — and intentionally not. Intercepting or probing live third-party cameras violates India's IT Act, 2000 (§43, §66) and DPDP Act, 2023. Our real-world data consists of **104,218 Censys India aggregate host counts** (zero raw IPs) plus **held-out public CUHK Avenue surveillance videos** (`16` clips) with programmatic tamper onset. Testing on owned laboratory IP cameras (`U3b`) is future work beyond Review 2.

2. **Q: Wait — your synthetic `n = 120` accuracy is `97.5%`, yet you say real-world accuracy isn't `97.5%`. Why include `n = 120`?**  
   **A:** The `n = 120` corpus is strictly a **formula verification and ablation testbed** comparing four scoring functions when Channel B is active vs. absent (`90` scenarios lack Channel B where `IG-DCTF == CVE-only`). All real-footage claims are reported separately using **CUHK Avenue detection rates + false-alarm rates per hour**.

3. **Q: If held-out Avenue has `0` tripped clean false alarms, why is the upper confidence limit `30.9/h`?**  
   **A:** Across 16 clean Avenue clips >= 12 s, total un-tampered duration is `0.1195 h` (~7.2 minutes). By exact Poisson 95% confidence bounds (`docs/comparisons/avenue_test/comparison.csv`), `0` events over `0.1195 h` still cannot rule out a true rate up to `30.876/h` (`30.9/h`). That is why we state both `0.0/h` and `[0.0, 30.9]` explicitly rather than hiding sample size.

4. **Q: Why did `v2` miss `loop` on Avenue `video 13` and false-alarm once on `video 06` (`degraded`)?**  
   **A:** `video 13` is short (`14.3 s`) and had `min_score_after = 0.986`, failing to cross the ring-buffer replay recurrence criteria before clip end. On `video 06` (`41.3 s`), natural scene dynamics triggered `1` transient `degraded` flag (`2.61%` of clip time) without escalating to `tripped` (`0` FAs at `tripped`).

5. **Q: Can't an attacker evade `FrameLivenessTracker` by adding 1–2 bits of Gaussian noise to looped frames?**  
   **A:** An attacker explicitly targeting `v2`'s `pHash` Hamming tolerance *could* explore adaptive evasion (`U4`). That requires adaptive-attacker evaluation (`U2`/`U4`), which we list explicitly as future research work rather than claiming adversary-proof robustness today.

6. **Q: Why is `/console` showing 9,320 cameras if you don't store Censys IPs?**  
   **A:** Every device in `data/public.db` (`geo_source = 'synthetic_demo'`) is an **anonymized simulated fixture** (`/24`-masked IP) built so the console UI, map clustering, CVE scorer, simulator attacks, and Merkle chain can be demonstrated end-to-end safely. The UI explicitly labels them `Simulated data active` / `Simulated fixture`.

7. **Q: What happens if `torch` or Groq API keys are missing during deployment or demo?**  
   **A:** Core FastAPI + IG-DCTF + Merkle ledger + Tier 1/NL fallback run without `torch` or `GROQ_API_KEY`. The backend lazily loads GNN collusion scoring (`GET /api/audit/collusion/gnn`) and returns clean HTTP `503` if weights or `torch` are unavailable, while NL query falls back to deterministic regex filter extraction.
