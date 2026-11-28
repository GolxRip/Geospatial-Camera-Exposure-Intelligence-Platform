# Testing plan for the research paper (`paper/main.tex`): truly public data only

Written 2026-11-28. Scope: the **research paper**, not the college report. Constraint from the team: use only data that anyone can
download **without an application, agreement form, verified academic email or commercial licence**. Everything below was checked on
the dataset's own page or in the paper that released it on 2026-11-28 unless marked **not verified**.

Rules from `CLAUDE.md` still apply: real data only for results; never tune on a test set (log anything tuned after seeing data as
"tuned after seeing data" in `paper/LOG.md`); the frozen `v2` detector (`video_pipeline/liveness_detector.py`, `023c5c4`) is run once
per held-out set with no edits.

**Update later on 2026-11-28 (code only, nothing run on real data):** the code for Tests B, D, E, F and G now exists:
`eval/tier2_real_footage.py --clean-only --save-scores` (B), `eval/robustness_sweep.py --variants adaptive` (D),
`eval/calibrate_thresholds.py` (E) and `testbed/` (F, G). Each was smoke-tested on a few synthetic frames only, to check that it
runs; none has produced a result. Commands are in `eval/README.md` section 5. The paper's speed-figure mismatch (section 5) is fixed.

---

## 0. Where the paper stands today

| Paper component | Current evidence | Real data? |
|---|---|---|
| Tier 2 frame liveness (freeze, loop, blur, cover, move, downscale) | CUHK Avenue: 14 train clips (tuned) + 16 held-out test clips, 0.119 clean hours | Yes, but **one camera, one scene, about 7 minutes of clean footage** |
| Tier 1 banner drift | 13 synthetic banner pairs | **No** |
| IG-DCTF fusion accuracy (F1 0.976 vs 0.811) | 120 team-written scenarios | **No** |
| Gate thresholds (0.50 / 0.85) | Flat synthetic sweep, never calibrated | **No** |
| Adaptive attacker | Not studied; known failures: small cover 0/16, 30 s loops 10/16 | Partly (failures found on Avenue) |
| Exposure context | Censys 104,218-host aggregate, one day | Yes (aggregate, single day) |

---

## 1. Datasets excluded because they need verification

| Dataset | Why excluded | Source |
|---|---|---|
| UHCTD (camera tampering, 288 h, 2 cameras) | Agreement form before download | [QIL datasets page](http://qil.uh.edu/main/datasets/), [UHCTD paper](https://ieeexplore.ieee.org/document/8909856/) |
| VIRAT Ground | "VIRAT Video Dataset Protection Agreement" | [viratdata.org](https://viratdata.org/) |
| Censys research access (5 years of daily snapshots) | Application, verified researchers only | [Censys research access](https://docs.censys.com/docs/research-access-to-censys-data) |
| Rapid7 Project Sonar | Commercial licence, organisations only | [Sonar Data](https://sonardata.rapid7.com/), [About](https://opendata.rapid7.com/about/) |
| Shodan academic upgrade (host `history=true`) | Verified academic email; history access on that plan unconfirmed | [Shodan academic upgrade](https://help.shodan.io/the-basics/academic-upgrade), [API docs](https://developer.shodan.io/api) |

UHCTD would be the best single dataset for real camera tampering. If the team later accepts one agreement form, it is the one to sign.

---

## 2. Truly public datasets that fit the tests

| Dataset | What it gives the paper | Size | Access (checked) | Licence |
|---|---|---|---|---|
| **MEVA** (Kitware / IARPA) | Long, multi-camera, real surveillance video at 19 sites: the source for many clean hours and cross-scene tests | Ground camera drop `drops-123-r13`: 3,956 clips, 444 GB, 324.2 h; clips are about 5 min | Public AWS bucket, `aws s3 sync s3://mevadata-public-01/drops-123-r13 . --no-sign-request` ([download readme](https://mevadata.org/resources/README-meva-kf1-data.html), [site](https://mevadata.org/), [paper](https://arxiv.org/abs/2012.00914)) | CC BY 4.0 |
| **UCF-Crime** (normal videos) | Real CCTV from many unrelated cameras and scenes; 950 normal videos (800 train, 150 test) at 320x240 | 1,900 videos / 128 h total | Direct links on the [project page](https://www.crcv.ucf.edu/projects/real-world/) (UNC Charlotte download page and Dropbox); no form mentioned | **Not stated**; research use, cite Sultani et al. CVPR 2018 |
| **ShanghaiTech Campus** | 13 scenes with "complex light conditions and camera angles"; 330 normal training videos | 437 videos, 856x480 | Direct OneDrive link on the [dataset page](https://svip-lab.github.io/dataset/campus_dataset.html) | **Not stated** |
| **UCSD Ped1/Ped2** | Two further fixed pedestrian scenes, low resolution (useful for a low-quality stress case) | About 700 MB | Direct tarball `http://www.svcl.ucsd.edu/projects/anomaly/UCSD_Anomaly_Dataset.tar.gz` ([SVCL page](http://www.svcl.ucsd.edu/projects/anomaly/dataset.htm)); **not verified that the URL still works** | **Not stated** |
| **CDnet 2014** | Real hard conditions: Camera Jitter (4 videos), Night (6), Bad Weather (4), PTZ (4 videos of real pan/zoom, i.e. real "camera moved" events), Low Framerate, Turbulence | 53 videos, 11 categories | Historically a free download at [changedetection.net](http://changedetection.net/); **the site refused connections today, so not verified**. Category facts from the [CDnet 2014 paper](https://openaccess.thecvf.com/content_cvpr_workshops_2014/W12/papers/Wang_CDnet_2014_An_2014_CVPR_paper.pdf). The harness already supports CDnet frame folders. | **Not verified** |
| **VIFFD** (video inter-frame forgery) | Real forged videos with frame insertion, deletion and **duplication**: a loop/replay-like forgery not made by our own generator | Mostly static, multi-resolution | [Mendeley Data](https://data.mendeley.com/datasets/r3ss3v53sj/6); page shows a sign-in link, **open download not confirmed**. Content per the [2025 survey](https://doi.org/10.3390/electronics14132680) | CC BY 4.0 |
| **CUHK Avenue** | Already used | 37 clips | Already downloaded | As used |
| **Own day/night clips** | Self-recorded, a camera the detector has never seen | Team's own | No restriction (no faces or private spaces, per `eval/README.md`) | Team-owned |
| **NVD, CISA KEV, FIRST EPSS** | Channel A inputs (already used by the platform) | Feeds | Public feeds; NVD API key optional | Public |
| **VISION** (optional, PRNU) | 1,914 smartphone videos from 35 devices; sensor-fingerprint adapter calibration only, not CCTV | Large; a smaller 315-video subset exists | [LESC datasets page](https://lesc.dinfo.unifi.it/en/datasets); click-through licence (downloading means agreeing), no form | VISION licence (click-through) |

**Not found:** no truly public dataset of **real** camera tampering (covered, defocused, moved) with labels other than UHCTD (form required).
CDnet PTZ is the closest public source of real camera motion. A 2026 paper used UHCTD only as an external check
([arXiv 2607.14760](https://arxiv.org/abs/2607.14760)), which suggests the field has no public alternative either.

---

## 3. The tests, what each needs, and how to run them

### Test A. Tier 2 cross-scene held-out evaluation (highest value, all public)

**Question:** does the frozen `v2` detector work on cameras and scenes it was never tuned on?

- **Data:** MEVA (pick at least 10 cameras across several sites), UCF-Crime normal test videos (150), ShanghaiTech (13 scenes), UCSD,
  plus own day/night clips. Keep Avenue results separate.
- **Run:** `eval/tier2_real_footage.py` and `eval/robustness_sweep.py` with the frozen `v2` and the `v1` baseline, once per dataset,
  output under `eval/results/<dataset>_{v1,v2}/`, then `eval/compare_runs.py` and `eval/make_figures.py`.
- **Report per scene type,** not only pooled: indoor/outdoor, day/night (MEVA has thermal IR cameras too; decide whether to include or
  exclude them and say so), crowded/empty, low resolution (UCSD).
- **Sample size target:** with `n/n` detections the 95% Wilson lower bound is `n/(n+3.84)`. 16 clips give 80.6% (today); 50 clips give
  92.9%; **74 clips give 95.1%**. Aim for at least 74 clips per attack across the new datasets.
- **Harness note:** each clip is loaded fully into memory and run once clean plus once per attack, and `--max-seconds` defaults to 180.
  Keep `--max-seconds 90` (as for Avenue) for the attack runs.

### Test B. Long clean footage for false-alarm rates (all public)

**Question:** how many false alarms per hour does `v2` raise on untouched real video?

- **Why it matters:** with zero false alarms over `H` hours, the exact two-sided 95% Poisson upper bound is about `3.69 / H` per hour.
  Today `H = 0.119 h`, so the bound is 30.9/h. To get the bound under 1/h needs **3.7 h**; under 0.5/h needs 7.4 h; under 0.1/h
  needs **36.9 h** of clean footage.
- **Data:** MEVA is the only verified public source with hundreds of hours (324 h). 24 to 40 hours is a realistic subset (MEVA's
  444 GB / 324 h is about 1.4 GB per hour, so about 35 to 55 GB). Add UCF-Crime normal videos for scene diversity, plus CDnet Night,
  Bad Weather and Camera Jitter as stress cases (report those separately: they are hard conditions, not typical ones).
- **Harness:** done 2026-11-28. `eval/tier2_real_footage.py --clean-only` streams frames as they are read (no attack runs, no
  full-clip buffering), `--max-seconds 0` removes the per-clip limit, `--save-scores DIR` keeps per-frame scores for Test E, and
  `--extra-level NAME=T` reports alarms at other liveness levels. The detector is unchanged. Not run on MEVA yet.

### Test C. Tamper not made by our own generator (public, limited)

**Question:** does `v2` catch tampering it was not co-developed with?

- **Data:**
  - **VIFFD** frame duplication: real forged videos made by other researchers.
  - **CDnet PTZ:** real pan and zoom as "camera moved".
  - **CDnet Camera Jitter:** real shake, which is a false-alarm stress test, not a positive.
- **Honest limit:** frame-duplication forgeries are short inserted segments, not a continuous RTSP loop, so expect partial overlap with
  the loop threat model; report it as an external check, not as loop detection.
- Real covered/defocused footage with labels is public only through UHCTD (form). Without it, real occlusion and defocus remain
  generator-made; state this in Threats to Validity.

### Test D. Adaptive attacker (public data, our own attack code)

**Question:** what does an attacker who knows the thresholds and rules do, and does `v2` still catch it?

- Done 2026-11-28 as `eval/robustness_sweep.py --variants adaptive` (not run yet). It adds variants aimed at the known rules and
  failures (the 120 s slow blur was already in the default set; the adaptive set adds 300 s and 600 s):
  - partial cover from 2% to 20% of the frame (the 8x8 / 12-block rule; 9% already gives 0/16)
  - loops longer than the 18 s / 450-frame horizon (30 s gives 10/16), crossfaded loop seams, and loops with injected sensor noise
  - very slow blur ramps (120 s to 600 s)
  - freezes with tiny per-frame jitter, aimed at the freeze guard
- Run on the public data from Test A. Report the detection rate as a function of attack strength (an "evasion curve"), not one number.
- Related work to cite on loop attacks: SurFi, Wi-Fi CSI against camera looping ([arXiv 1904.01350](https://arxiv.org/abs/1904.01350));
  a 2025 review of surveillance video forgery detection ([arXiv 2505.03832](https://arxiv.org/abs/2505.03832)).

### Test E. Gate threshold calibration (public data, depends on A and B)

**Question:** can `theta_low = 0.50` and `theta_high = 0.85` be justified or calibrated on real data instead of being design choices?

- **Method:** split conformal calibration on clean footage. Pick the threshold as a quantile of liveness scores on a calibration split
  of clean videos, which gives a distribution-free false-alarm guarantee on exchangeable clean data. Then measure detection on the
  attack runs with that threshold.
- **Data:** clean MEVA hours (calibration split) and a separate clean test split. Never calibrate on the test split.
- **Code:** done 2026-11-28, `eval/calibrate_thresholds.py`. It splits clips (not frames) by a hash of the name, uses one statistic
  per clean window (the lowest level the score stays at or below for the alarm duration), and reports the calibrated threshold and
  the test-split false-alarm rate at it and at 0.50 / 0.85. Output goes to `eval/calibration/`, not `eval/results/`. Not run yet.
- **Caveat to state:** the guarantee needs calibration and test data to be exchangeable; a new camera or season breaks that.
- **References:** Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction" ([arXiv 2107.07511](https://arxiv.org/abs/2107.07511));
  Angelopoulos, Barber & Bates, *Theoretical Foundations of Conformal Prediction* ([arXiv 2411.11824](https://arxiv.org/abs/2411.11824)).

### Test F. End-to-end IG-DCTF fusion on a controlled testbed (no dataset exists; build one)

**Question:** on real devices with known ground truth, does IG-DCTF beat the CVE-only score, as the synthetic corpus claims?

- **No public dataset links a camera's vulnerability posture to whether its feed is genuine.** The only honest way is a small testbed
  of cameras the team owns. Nothing here touches third-party devices.
- **Hardware:** 2 to 4 low-cost consumer cameras with local RTSP. Example checked: TP-Link Tapo C200 supports RTSP (port 554,
  `rtsp://user:pass@IP/stream1`) and ONVIF (port 2020) after creating a camera account in the app
  ([TP-Link FAQ](https://www.tp-link.com/us/support/faq/2680/), [Tapo RTSP/ONVIF FAQ](https://www.tapo.com/us/faq/724/)). Known issue: one
  firmware version broke RTSP on the C200 V3 ([community thread](https://community.tp-link.com/en/smart-home/forum/topic/642062)).
  Prices not checked.
- **Free, open-source tools:**
  - [MediaMTX](https://github.com/bluenviron/mediamtx) + FFmpeg to relay a camera and to inject a **loop** (`ffmpeg -re -stream_loop -1 -i clip.mp4 -c copy -f rtsp rtsp://localhost:8554/cam`) or a freeze, which is the real RTSP attack the paper models. Reference setups: [Camera-emulator](https://github.com/tyronechrisharris/Camera-emulator), [rtsp-streamer](https://github.com/mikayelbag/rtsp-streamer).
  - [SweetCam](https://vbn.aau.dk/en/publications/sweetcam-an-ip-camera-honeypot/), an open-source IP camera honeypot with a configurable banner and RTSP stream (ports 554/80/22). Use it, only on the lab network, as the "decoy substitution" target.
- **Ground-truth scenarios to stage:**
  - genuine camera
  - camera swapped for the decoy (same banner vs different banner)
  - RTSP loop
  - freeze
  - covered lens
  - turned camera
  - a legitimate firmware update (a benign banner change)
- **Scripts:** done 2026-11-28 in `testbed/` (`mediamtx.yml` relay config, `inject.py` for passthrough/record/loop/freeze FFmpeg
  commands, dry run unless `--run`, `scenarios.csv` with the scenarios above). No camera has been bought or run.
- **Measure:** CVE-only score vs IG-DCTF score per scenario and the decision each would trigger. Report on confusion counts with
  Wilson intervals. A handful of devices gives a small n, so present it as a controlled case study, not an accuracy estimate.

### Test G. Tier 1 banner drift on real data (hardest without verification)

**Question:** how often do real camera banners change for harmless reasons, and how often would the drift gate trip falsely?

- **Truly public longitudinal per-device banner data was not found.** Every source with history (Censys research access, Rapid7 Sonar,
  Shodan host history) needs an application, licence or verified account (Section 1).
- **What can be done without verification:**
  1. **Own-device measurement (Test F testbed):** record each owned camera's HTTP/RTSP banner daily for several weeks, including a
     real firmware update. This gives real benign drift on a few devices, i.e. a case study rather than a base rate.
     `testbed/banner_log.py` (2026-11-28) does this: one HTTP GET / and one RTSP OPTIONS per device per run, appended to
     `testbed/logs/banners.jsonl`; it refuses any address that is not private or not listed in the git-ignored `devices.json`.
  2. **Repeated aggregate snapshots:** keep taking the same Censys aggregate query (the 2026-11-26 snapshot) weekly. This shows
     population-level change (vendor, product, port mix) over time. Note: the Censys web UI needs a free account (email sign-up,
     not research verification). It measures fleet-level shifts, **not** per-device drift, so it cannot give a false-trip rate.
- **Paper wording until then:** keep Tier 1 as "design + synthetic regression check" and say plainly that per-device drift base rates
  need longitudinal data that is not public.

### Test H (optional). Extra evidence signals

- **PRNU (sensor fingerprint):** VISION (click-through licence). Smartphones only, so it calibrates an adapter, not CCTV results.
- **ENF (mains-frequency hum):** previously listed in `paper/DATASETS.md` (ENF Moving Video Database on Zenodo, ENF-WHU on GitHub);
  **not re-checked today**. Most CCTV lacks audio; low priority.

---

## 4. Order of work and what each unlocks

| Step | Test | Needs | Unlocks in the paper |
|---|---|---|---|
| 1 | B + A on MEVA subset | About 35 to 55 GB download (streaming mode done 2026-11-28) | Tight false-alarm bound; first cross-scene held-out result |
| 2 | A on UCF-Crime normal, ShanghaiTech, UCSD, own clips | Downloads (UCF-Crime about 25 GB for normal parts per the HyperAI listing, size **not verified**) | Scene diversity, per-condition table |
| 3 | C on VIFFD + CDnet (if reachable) | Small downloads | External tamper check not built by us |
| 4 | D adaptive sweep | Code done 2026-11-28; run only | Evasion curves; honest limits section |
| 5 | E conformal calibration | Steps 1 and 2 data (script done 2026-11-28) | Thresholds justified by data, with a stated guarantee |
| 6 | F testbed + G own-device drift | 2 to 4 owned cameras, a few weeks of daily banner logs (scripts done 2026-11-28) | First real end-to-end fusion evidence; real benign-drift case study |

## 5. Things the paper needs that are not testing

- **Speed figure mismatch (fixed 2026-11-28):** `main.tex` quoted 281.9 FPS from the synthetic-pattern benchmark; it now quotes the
  real-frame `v2` figures used by the report and `paper/CLAIMS.md` C12 (242.7 FPS at 320 px, 59.9 FPS at 640 px).
- **Missing related work (claim C13 at risk):** UHCTD, SurFi, PRNU and ENF are not cited in `main.tex`.
- **Unchecked references:** 16 entries in `references.bib` are still marked VERIFY.
- **Never compiled:** `main.tex` has not been compiled since the last edits.
- **Synthetic corpus:** keep the 120-scenario corpus labelled as a formula sanity check; once Test F exists, the headline fusion claim
  should move to it.

## 6. What could not be checked today

- CDnet 2014 (site refused connections), the UCSD tarball URL, and whether VIFFD downloads without signing in.
- Licences for UCF-Crime, ShanghaiTech and UCSD (none stated on their pages).
- Two searches (on firmware and banner topics) were blocked by a tool safety filter, so firmware-based approaches to Tier 1 were not
  researched and are not recommended here.
