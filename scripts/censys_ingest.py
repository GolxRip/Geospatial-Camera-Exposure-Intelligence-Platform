#!/usr/bin/env python3
"""
censys_ingest.py — Real Censys Host Metadata Ingestor for COBRA-WATCH
======================================================================
Loads REAL Censys Search 2.0 / Platform host records (either from a downloaded
Censys JSON / JSONL dataset export OR directly via Censys Search API) into the
local SQLite `devices` table — passively, with ZERO probes or connections to any
discovered host.

Every stored record uses ONLY fields present in the Censys record plus NVD/CISA
KEV vulnerability matching (`vulnerability_service.py`) and passive Tier-1 banner
fingerprinting (`signal_integrity_service.extract_banner_fingerprint()`).
Missing attributes stay None/unknown — nothing is invented.

Privacy guard:
  - By default (`--mask-ips` enabled), host IPs are anonymized to `/24` (`a.b.c.0`)
    and device IDs are derived from SHA-256 of the raw IP (one-way) so third-party
    IPs do not need to sit in plaintext on disk. Pass `--keep-raw-ip` only for
    offline/local research storage on an encrypted volume.

Usage:
  # Ingest from a downloaded Censys JSON/JSONL/NDJSON export file:
  python scripts/censys_ingest.py --input path/to/censys_export.jsonl

  # Query Censys Search API directly (requires CENSYS_API_ID + CENSYS_API_SECRET):
  python scripts/censys_ingest.py --city Mumbai --max-results 100

  # Replace synthetic_demo rows in DB with ingested real records:
  python scripts/censys_ingest.py --input export.jsonl --replace-synthetic
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import aiosqlite

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from config import CITIES, DATABASE_PATH  # noqa: E402
from database import init_db  # noqa: E402
from services.classifier import classify_owner_by_keywords  # noqa: E402
from services.signal_integrity_service import (  # noqa: E402
    compute_banner_drift,
    compute_composite_signal_integrity,
    evaluate_integrity_gate,
    extract_banner_fingerprint,
)
from services.vulnerability_service import (  # noqa: E402
    KNOWN_CAMERA_CVES,
    KNOWN_CVE_CATEGORIES,
)

KNOWN_MANUFACTURERS = [
    "Hikvision", "Dahua", "Axis", "Bosch", "Samsung", "Sony",
    "Panasonic", "Hanwha", "Vivotek", "Uniview", "ZTE", "Huawei",
    "TP-Link", "D-Link", "Honeywell", "Pelco", "Avigilon",
]

KNOWN_CVSS: dict[str, float] = {
    "CVE-2021-36260": 9.8, "CVE-2017-7921": 8.8, "CVE-2022-28171": 9.8,
    "CVE-2021-33044": 9.8, "CVE-2021-33045": 9.8, "CVE-2022-30563": 7.5,
    "CVE-2023-21407": 8.0, "CVE-2021-31986": 6.5, "CVE-2021-23847": 8.8,
    "CVE-2020-24916": 8.1, "CVE-2021-28372": 9.6,
}


def _mask_ipv4_for_storage(ip: str) -> str:
    parts = ip.strip().split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return f"{parts[0]}.{parts[1]}.{parts[2]}.0"
    if ":" in ip:
        groups = [g for g in ip.split(":") if g]
        return ":".join(groups[:3]) + "::" if groups else "masked"
    return "masked"


def _device_id(raw_ip: str, city: str) -> str:
    """Stable pseudonymous hash ID — never exposes raw IP in identifier."""
    return hashlib.sha256(f"censys:{raw_ip}:{city}".encode("utf-8")).hexdigest()[:32]


def _closest_supported_city(raw_city: str | None, lat: float | None, lon: float | None) -> str:
    if raw_city:
        for c in CITIES:
            if c != "All India" and c.lower() in raw_city.lower():
                return c
    if lat is not None and lon is not None:
        best_city = "Mumbai"
        best_dist = float("inf")
        for c, meta in CITIES.items():
            if c == "All India":
                continue
            d = (lat - meta["lat"]) ** 2 + (lon - meta["lon"]) ** 2
            if d < best_dist:
                best_dist = d
                best_city = c
        return best_city
    return raw_city or "Unknown"


def _parse_censys_host(hit: dict[str, Any], mask_ip_storage: bool) -> dict[str, Any] | None:
    """Convert a Censys Host Search 2.0 / Platform host dict into our schema without inventing fields."""
    raw_ip = str(hit.get("ip") or hit.get("host_identifier", {}).get("ipv4") or "").strip()
    if not raw_ip:
        return None

    loc = hit.get("location") or {}
    coords = loc.get("coordinates") or {}
    lat = coords.get("latitude")
    lon = coords.get("longitude")
    if lat is None or lon is None:
        return None

    raw_city = loc.get("city")
    city = _closest_supported_city(raw_city, float(lat), float(lon))

    asn = hit.get("autonomous_system") or {}
    whois = hit.get("whois") or {}
    owner_org = str(
        whois.get("organization", {}).get("name")
        or asn.get("name")
        or asn.get("description")
        or ""
    ).strip() or "Unknown"
    owner_type, ownership_conf = classify_owner_by_keywords(owner_org, str(asn.get("description") or ""))

    services: list[dict[str, Any]] = hit.get("services") or []
    ports: list[int] = sorted({int(s["port"]) for s in services if s.get("port") is not None})

    banners: list[str] = []
    products: list[str] = []
    http_servers: list[str] = []
    html_titles: list[str] = []
    firmware_ver: str | None = None
    auth_required: bool | None = None

    for svc in services:
        if svc.get("banner"):
            banners.append(str(svc["banner"])[:200])
        http = svc.get("http") or {}
        resp = http.get("response") or {}
        headers = resp.get("headers") or {}
        for k, v in headers.items():
            if str(k).lower() == "server":
                val = v[0] if isinstance(v, list) and v else str(v)
                http_servers.append(str(val))
            if str(k).lower() == "www-authenticate":
                auth_required = True
        if resp.get("status_code") == 401:
            auth_required = True
        elif resp.get("status_code") == 200 and auth_required is None:
            # Open HTTP 200 without WWW-Authenticate suggests unauthenticated endpoint, though not guaranteed
            auth_required = False
        if resp.get("html_title"):
            html_titles.append(str(resp["html_title"]))
        for sw in svc.get("software") or []:
            parts = [str(sw.get(x) or "").strip() for x in ("vendor", "product") if sw.get(x)]
            if parts:
                products.append(" ".join(parts))
            if not firmware_ver and sw.get("version"):
                firmware_ver = str(sw["version"])
        rtsp = svc.get("rtsp") or {}
        if rtsp and auth_required is None and rtsp.get("auth_required") is not None:
            auth_required = bool(rtsp.get("auth_required"))

    combined_text = " ".join([*products, *http_servers, *html_titles, *banners, owner_org])
    manufacturer = "Unknown"
    for known in KNOWN_MANUFACTURERS:
        if known.lower() in combined_text.lower():
            manufacturer = known
            break

    device_type = "IP Camera"
    low = combined_text.lower()
    if "dvr" in low or "nvr" in low or "video recorder" in low:
        device_type = "DVR/NVR"
    elif 554 in ports or "rtsp" in low:
        device_type = "RTSP Stream"

    # Match real documented CVEs only if Censys service/software/catalog identifies the vendor
    cve_ids: list[str] = []
    cve_categories: list[str] = []
    last_patch_date: str | None = None
    max_cvss: float | None = None
    m_key = manufacturer.lower()
    if m_key in KNOWN_CAMERA_CVES:
        cat_set: set[str] = set()
        cve_ids = list(KNOWN_CAMERA_CVES[m_key]["cve_ids"])
        last_patch_date = KNOWN_CAMERA_CVES[m_key]["last_patch_date"]
        for cid in cve_ids:
            cat_set.update(KNOWN_CVE_CATEGORIES.get(cid, []))
        cve_categories = sorted(cat_set)
        scores = [KNOWN_CVSS[c] for c in cve_ids if c in KNOWN_CVSS]
        max_cvss = max(scores) if scores else None

    raw_payload = {
        "source": "censys",
        "product": manufacturer if manufacturer != "Unknown" else (products[0] if products else ""),
        "org": owner_org,
        "asn": asn,
        "ports": ports,
        "http": {
            "server": http_servers[0] if http_servers else "",
            "title": html_titles[0] if html_titles else "",
        },
        "firmware_version": firmware_ver or "",
        "data": "\n".join(banners)[:500],
    }

    last_updated = str(hit.get("last_updated_at") or datetime.now(timezone.utc).isoformat())
    return {
        "id": _device_id(raw_ip, city),
        "city": city,
        "ip": _mask_ipv4_for_storage(raw_ip) if mask_ip_storage else raw_ip,
        "lat": float(lat),
        "lon": float(lon),
        "device_type": device_type,
        "manufacturer": manufacturer,
        "ports": ports,
        "owner_org": owner_org,
        "owner_type": owner_type,
        "ownership_confidence": ownership_conf,
        "first_seen": last_updated[:10],
        "last_seen": last_updated[:10],
        "banner_snippet": (banners[0] if banners else (f"Server: {http_servers[0]}" if http_servers else ""))[:200],
        "raw_data": raw_payload,
        "fetched_at": last_updated,
        "firmware_version": firmware_ver,
        "auth_required": auth_required,
        "known_cve_count": len(cve_ids),
        "cve_ids": cve_ids,
        "last_patch_date": last_patch_date,
        "cve_categories": cve_categories,
        "max_cvss": max_cvss,
    }


def _iter_file_records(path: Path) -> Iterable[dict[str, Any]]:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.startswith("["):
        data = json.loads(text)
        return data if isinstance(data, list) else []
    if text.startswith("{"):
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                if isinstance(obj.get("result"), dict) and isinstance(obj["result"].get("hits"), list):
                    return obj["result"]["hits"]
                if isinstance(obj.get("hits"), list):
                    return obj["hits"]
                return [obj]
        except json.JSONDecodeError:
            pass
    # JSONL / NDJSON
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _query_censys_api(city: str | None, max_results: int) -> list[dict[str, Any]]:
    api_id = os.getenv("CENSYS_API_ID", "")
    api_secret = os.getenv("CENSYS_API_SECRET", "")
    if not api_id or not api_secret:
        raise RuntimeError("CENSYS_API_ID and CENSYS_API_SECRET must be set (or provide --input JSON/JSONL file).")
    from censys.search import CensysHosts  # type: ignore[import-untyped]

    hosts = CensysHosts(api_id=api_id, api_secret=api_secret)
    city_filter = f' AND location.city: "{city}"' if city and city != "All India" else ""
    query = (
        f'(services.port: 554 OR services.http.response.headers.server: ("Hikvision" OR "Dahua" OR "Axis")) '
        f'AND location.country: "India"{city_filter}'
    )
    hits: list[dict[str, Any]] = []
    per_page = min(100, max_results)
    pages = max(1, (max_results + per_page - 1) // per_page)
    for page in hosts.search(query, per_page=per_page, pages=pages):
        for h in page:
            hits.append(h)
            if len(hits) >= max_results:
                return hits
    return hits


async def ingest_records(
    raw_hits: Iterable[dict[str, Any]],
    geo_source: str,
    mask_ips: bool,
    replace_synthetic: bool,
) -> dict[str, int]:
    await init_db()
    inserted = 0
    updated_drift = 0
    skipped = 0

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if replace_synthetic:
            await db.execute("DELETE FROM devices WHERE geo_source = 'synthetic_demo'")

        for hit in raw_hits:
            dev = _parse_censys_host(hit, mask_ip_storage=mask_ips)
            if dev is None:
                skipped += 1
                continue

            current_fp = extract_banner_fingerprint(dev["raw_data"])
            async with db.execute(
                "SELECT banner_fingerprint FROM devices WHERE id = ?", (dev["id"],)
            ) as cur:
                existing = await cur.fetchone()

            if existing and existing["banner_fingerprint"]:
                try:
                    baseline_fp = json.loads(existing["banner_fingerprint"])
                except Exception:
                    baseline_fp = current_fp
                drift_res = compute_banner_drift(baseline_fp, current_fp)
                drift_score = drift_res["drift_score"]
                comp = compute_composite_signal_integrity(drift_score, None)
                sig = comp["signal_integrity"]
                gate = evaluate_integrity_gate(sig)
                tripped = 1 if gate["gate_tripped"] else 0
                updated_drift += 1
            else:
                drift_score = 0.0
                sig = 1.0
                tripped = 0

            await db.execute(
                """
                INSERT OR REPLACE INTO devices
                (id, city, ip, lat, lon, device_type, manufacturer, ports,
                 owner_org, owner_type, ownership_confidence,
                 first_seen, last_seen, banner_snippet, raw_data, fetched_at,
                 firmware_version, auth_required, known_cve_count, cve_ids,
                 last_patch_date, cve_categories, max_cvss,
                 banner_fingerprint, last_drift_score, signal_integrity_score,
                 integrity_gate_tripped, geo_source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    dev["id"], dev["city"], dev["ip"], dev["lat"], dev["lon"],
                    dev["device_type"], dev["manufacturer"], json.dumps(dev["ports"]),
                    dev["owner_org"], dev["owner_type"], dev["ownership_confidence"],
                    dev["first_seen"], dev["last_seen"], dev["banner_snippet"],
                    json.dumps(dev["raw_data"]), dev["fetched_at"],
                    dev["firmware_version"], dev["auth_required"], dev["known_cve_count"],
                    json.dumps(dev["cve_ids"]), dev["last_patch_date"],
                    json.dumps(dev["cve_categories"]), dev["max_cvss"],
                    json.dumps(current_fp), drift_score, sig, tripped, geo_source,
                ),
            )
            inserted += 1

        await db.commit()

    return {"inserted": inserted, "updated_drift": updated_drift, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest real Censys host metadata into COBRA-WATCH SQLite DB.")
    parser.add_argument("--input", type=Path, default=None, help="Path to Censys JSON/JSONL export file")
    parser.add_argument("--city", type=str, default=None, help="City to query from Censys API (when --input omitted)")
    parser.add_argument("--max-results", type=int, default=100, help="Max hosts to fetch from API (default 100)")
    parser.add_argument("--keep-raw-ip", action="store_true", help="Store raw IPs instead of masking last octet to /24")
    parser.add_argument("--replace-synthetic", action="store_true", help="Delete synthetic_demo rows before inserting real Censys records")
    args = parser.parse_args()

    if args.input:
        hits = list(_iter_file_records(args.input))
        geo_source = "censys_dataset"
    else:
        hits = _query_censys_api(args.city, args.max_results)
        geo_source = "censys_live"

    summary = asyncio.run(
        ingest_records(
            hits,
            geo_source=geo_source,
            mask_ips=not args.keep_raw_ip,
            replace_synthetic=args.replace_synthetic,
        )
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
