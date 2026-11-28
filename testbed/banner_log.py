#!/usr/bin/env python3
"""
banner_log.py: daily banner snapshot of the team's OWN testbed cameras (paper Test G, real benign drift).

For each device in testbed/devices.json it makes one HTTP GET / and one RTSP OPTIONS request and appends what the
device says about itself (HTTP `Server` header, page title, RTSP `Server` and `Public` headers) to logs/banners.jsonl.
Run it once a day (Windows Task Scheduler or cron) for several weeks, including across a real firmware update.

Guards (testbed/README.md): a device is contacted only if it is listed in devices.json AND its address is private
(RFC 1918, link-local or IPv6 ULA). Anything else is refused before any connection is opened. One request of each
kind per device per run. This script is not part of backend/, which stays strictly passive.

    python testbed/banner_log.py            # contacts the allow-listed owned devices once
    python testbed/banner_log.py --check    # only validates devices.json; no network traffic
"""
from __future__ import annotations

import argparse
import ipaddress
import json
import re
import socket
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
TIMEOUT_S = 5.0


def load_devices() -> list[dict]:
    path = HERE / "devices.json"
    if not path.exists():
        sys.exit("testbed/devices.json not found: copy devices.example.json and list ONLY your own lab devices.")
    devices = json.loads(path.read_text(encoding="utf-8")).get("devices", [])
    for d in devices:
        ip = ipaddress.ip_address(d["ip"])
        if not (ip.is_private or ip.is_link_local) or ip.is_loopback or ip.is_unspecified:
            sys.exit(f"Refusing {d.get('name')}: {d['ip']} is not a private lab address. Only owned devices on the lab LAN.")
    return devices


def http_banner(ip: str, port: int) -> dict:
    url = f"http://{ip}:{port}/"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cobra-watch-testbed-banner-log"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:  # noqa: S310 (allow-listed private lab device)
            body = r.read(65536).decode("utf-8", "replace")
            title = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
            return {"status": r.status, "server": r.headers.get("Server"),
                    "www_authenticate": r.headers.get("WWW-Authenticate"),
                    "title": title.group(1).strip()[:200] if title else None}
    except urllib.error.HTTPError as e:  # 401/403 still carry the banner headers
        return {"status": e.code, "server": e.headers.get("Server"), "www_authenticate": e.headers.get("WWW-Authenticate"), "title": None}
    except Exception as e:  # noqa: BLE001
        return {"error": type(e).__name__}


def rtsp_banner(ip: str, port: int) -> dict:
    req = f"OPTIONS rtsp://{ip}:{port}/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: cobra-watch-testbed-banner-log\r\n\r\n"
    try:
        with socket.create_connection((ip, port), timeout=TIMEOUT_S) as s:
            s.sendall(req.encode())
            data = s.recv(4096).decode("utf-8", "replace")
        headers = dict(
            (k.strip().lower(), v.strip()) for k, _, v in (line.partition(":") for line in data.split("\r\n")[1:]) if v
        )
        return {"status_line": data.split("\r\n", 1)[0][:100], "server": headers.get("server"), "public": headers.get("public")}
    except Exception as e:  # noqa: BLE001
        return {"error": type(e).__name__}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="validate devices.json only; no network traffic")
    args = ap.parse_args()

    devices = load_devices()
    if args.check:
        print(f"devices.json OK: {len(devices)} private lab device(s): {', '.join(d['name'] for d in devices)}")
        return
    out = HERE / "logs" / "banners.jsonl"
    out.parent.mkdir(exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    with out.open("a", encoding="utf-8") as f:
        for d in devices:
            rec = {"time_utc": now, "device": d["name"],
                   "http": http_banner(d["ip"], int(d.get("http_port", 80))),
                   "rtsp": rtsp_banner(d["ip"], int(d.get("rtsp_port", 554)))}
            f.write(json.dumps(rec) + "\n")
            print(json.dumps(rec))


if __name__ == "__main__":
    main()
