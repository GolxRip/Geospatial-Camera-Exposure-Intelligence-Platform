# Owned-camera testbed (paper Tests F and G in `testing_rp.md`)

A small lab with cameras **the team owns**, on a network the team controls, to produce the one kind of evidence no public
dataset has: real devices with known ground truth for the end-to-end IG-DCTF fusion claim (Test F), and real benign banner
changes over time for Tier 1 (Test G).

**Hard rules (`CLAUDE.md`, `ETHICS_AND_SCOPE_POLICY.md`):**
- Only devices you own, on an isolated LAN or VLAN. Never a third-party or discovered camera. The scripts refuse any address that is
  not private (RFC 1918 / link-local / ULA) **and** listed in `devices.json`.
- No faces or private spaces in view (point cameras at an empty desk, a wall poster, a window to the street at distance).
- Footage and logs stay local; nothing from the testbed is published except aggregated results.
- Nothing here is imported by `backend/`; the backend stays strictly passive.

## Hardware and software

- 2 to 4 consumer IP cameras with local RTSP. Checked example: TP-Link Tapo C200 (RTSP on 554, `rtsp://user:pass@IP/stream1`,
  ONVIF on 2020 after creating a camera account in the app; one firmware release reportedly broke RTSP on the C200 V3).
- One laptop running [MediaMTX](https://github.com/bluenviron/mediamtx) (RTSP relay, port 8554) and FFmpeg.
- Optional decoy: [SweetCam](https://vbn.aau.dk/en/publications/sweetcam-an-ip-camera-honeypot/), an open-source IP-camera honeypot
  with a configurable banner and RTSP stream, run on the lab network only, as the "substituted decoy" device.

## Files

| File | What it does |
|---|---|
| `devices.example.json` | Copy to `devices.json` and list your own devices (name, private IP, ports, RTSP URL). `devices.json` is git-ignored. |
| `mediamtx.yml` | Relay config: each camera is re-published at `rtsp://<laptop>:8554/<name>`; the pipeline reads the relay, so attacks can be injected at the relay. |
| `inject.py` | Prints or runs the FFmpeg commands that record a clip from a relay path and re-publish it as a **loop** or a **freeze** (the RTSP attacks the paper models). `--dry-run` by default. |
| `banner_log.py` | Once per run, records each allow-listed device's HTTP `Server` header, page title and RTSP `OPTIONS` reply to `logs/banners.jsonl`. Run daily (Task Scheduler / cron) for Test G. |
| `scenarios.csv` | Ground-truth sheet: one row per staged scenario with start/end times. Fill it in while staging. |

## Staged scenarios (Test F)

| Scenario | How | Ground truth |
|---|---|---|
| Genuine | Camera streams normally through the relay | genuine |
| Benign firmware update | Update a camera's firmware from the vendor app; keep logging banners | genuine (banner changed) |
| Decoy, same banner | Point the relay path at the decoy, configured to copy the real camera's banner | fabricated |
| Decoy, different banner | Same, default decoy banner | fabricated |
| RTSP loop | `python testbed/inject.py loop --path cam1 --seconds 10 --run` | fabricated |
| Freeze | `python testbed/inject.py freeze --path cam1 --run` | fabricated |
| Covered lens | Physically cover the lens | fabricated |
| Turned camera | Physically rotate the camera | fabricated |

For each scenario record the CVE-only score and the IG-DCTF score the platform gives, and the decision each would trigger. With a
handful of devices this is a **controlled case study**: report counts with Wilson intervals, not an accuracy estimate.
