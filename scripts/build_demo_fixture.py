#!/usr/bin/env python3
"""
build_demo_fixture.py — Rebuild the simulated console fixture `data/public.db` from a fresh clone
====================================================================================================
`data/*.db` is git-ignored, so the 9,320-device demo database that the console was rehearsed on existed on
one machine only, and `seed_demo_data.py` produces a much smaller, CVE-less set. This script makes the demo
fixture reproducible: same seed -> same devices.

What it writes (all SIMULATED, labelled `geo_source = 'synthetic_demo'`, shown as "Simulated" in the UI):
  * N devices spread over the 8 supported cities in Gaussian clusters inside each city's bounding box.
  * Security attributes from the project's own documented model
    (`scripts/enrich_real_camera_locations.py::_assign_security_profile`: the CVE catalog in
    `backend/services/vulnerability_service.py`, owner mix, authentication mix). Not scan results.
  * Addresses from the private 10.0.0.0/8 range, so no generated address can belong to a real
    Internet host. They are then masked to /24 by `scripts/build_public_db.py`, which also strips
    simulator rows and builds a valid (empty) audit ledger.

This is a demo fixture, never research data (CLAUDE.md rule 1).

Usage:
    python scripts/build_demo_fixture.py                    # writes data/public.db (9,320 devices, seed 20261128)
    python scripts/build_demo_fixture.py --devices 2000 --out data/public_small.db
    python scripts/build_demo_fixture.py --force            # overwrite an existing output file

For the demo, leave SHODAN_API_KEY empty: with a key, a city whose cache is older than CACHE_TTL_HOURS
is re-fetched from Shodan and its simulated rows are replaced by live results.
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import importlib.util
import json
import os
import random
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# City cluster centres (lat, lon). The first eight-city layout comes from seed_demo_data.py.
CITY_CLUSTERS: dict[str, list[tuple[float, float]]] = {
    "Mumbai": [(19.0390, 72.8519), (18.9400, 72.8350), (19.0544, 72.8402), (19.1197, 72.8469)],
    "Delhi": [(28.6315, 77.2167), (28.7380, 77.0938), (28.5245, 77.2066)],
    "Bangalore": [(12.9758, 77.6045), (12.8399, 77.6770)],
    "Hyderabad": [(17.4435, 78.3772), (17.4156, 78.4347)],
    "Chennai": [(13.0418, 80.2341), (12.9226, 80.2312)],
    "Kolkata": [(22.5532, 88.3524), (22.5786, 88.4328)],
    "Pune": [(18.5912, 73.7389), (18.5362, 73.8940)],
    "Ahmedabad": [(23.1610, 72.6820), (23.0384, 72.5119)],
}
# Share of the fleet per city (fixed, so the fixture is reproducible; not derived from any real count).
CITY_WEIGHTS: dict[str, float] = {
    "Delhi": 0.25, "Mumbai": 0.20, "Bangalore": 0.15, "Hyderabad": 0.10,
    "Chennai": 0.10, "Pune": 0.08, "Kolkata": 0.07, "Ahmedabad": 0.05,
}
DEVICE_TYPES = ["IP Camera", "IP Camera", "IP Camera", "DVR/NVR", "RTSP Stream"]
PORT_CHOICES = [554, 80, 443, 8080, 8443, 37777]
CLUSTER_SIGMA_DEG = 0.015


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _in_mumbai_water(lat: float, lon: float) -> bool:
    """Rough Mumbai coastline (from seed_demo_data.py) so simulated cameras do not land in the sea."""
    if lon < 72.822 and lat < 18.98:
        return True
    if lon < 72.830 and 18.98 <= lat < 19.05:
        return True
    if lon < 72.810 and lat >= 19.05:
        return True
    if lon > 72.855 and lat < 18.96:
        return True
    if lon > 72.870 and 18.96 <= lat < 19.03:
        return True
    return False


def _position(rng: random.Random, city: str, bbox: tuple[float, float, float, float]) -> tuple[float, float]:
    s, w, n, e = bbox
    centre = rng.choice(CITY_CLUSTERS[city])
    for _ in range(30):
        lat = centre[0] + rng.gauss(0, CLUSTER_SIGMA_DEG)
        lon = centre[1] + rng.gauss(0, CLUSTER_SIGMA_DEG)
        if s <= lat <= n and w <= lon <= e and not (city == "Mumbai" and _in_mumbai_water(lat, lon)):
            return round(lat, 6), round(lon, 6)
    return centre


def _city_counts(total: int) -> dict[str, int]:
    counts = {c: int(total * w) for c, w in CITY_WEIGHTS.items()}
    counts["Delhi"] += total - sum(counts.values())  # rounding remainder
    return counts


async def _generate(src: Path, total: int, seed: int) -> int:
    # Point the backend modules at the scratch database BEFORE importing them.
    os.environ["DATABASE_PATH"] = str(src)
    sys.path.insert(0, str(ROOT / "backend"))
    import aiosqlite
    from database import init_db

    enrich = _load_module("enrich_real_camera_locations", ROOT / "scripts" / "enrich_real_camera_locations.py")

    await init_db()
    # _assign_security_profile() and the owner mix use the module-level `random`; seed it for reproducibility.
    random.seed(seed)
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    written = 0
    async with aiosqlite.connect(src) as db:
        for city, count in _city_counts(total).items():
            bbox = enrich.CITY_BBOXES[city]
            for i in range(count):
                profile = enrich._assign_security_profile()
                owner_type = random.choices(
                    [o for o, _ in enrich.OWNER_WEIGHTS], weights=[w for _, w in enrich.OWNER_WEIGHTS]
                )[0]
                org = rng.choice(enrich.ORGS[owner_type])
                lat, lon = _position(rng, city, bbox)
                ip = f"10.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 254)}"  # private range only
                device_id = hashlib.md5(f"demo-fixture:{seed}:{city}:{i}".encode()).hexdigest()
                ports = sorted(rng.sample(PORT_CHOICES, k=rng.randint(1, 3)))
                first_seen = (now - timedelta(days=rng.randint(60, 700))).date().isoformat()
                last_seen = (now - timedelta(days=rng.randint(0, 30))).date().isoformat()
                mfr = profile["manufacturer"]
                await db.execute(
                    """
                    INSERT INTO devices
                      (id, city, ip, lat, lon, device_type, manufacturer, ports,
                       owner_org, owner_type, ownership_confidence, first_seen, last_seen,
                       banner_snippet, raw_data, fetched_at,
                       auth_required, known_cve_count, cve_ids, cve_categories, max_cvss,
                       last_patch_date, geo_source)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        device_id, city, ip, lat, lon, rng.choice(DEVICE_TYPES), mfr, json.dumps(ports),
                        org, owner_type, "high" if owner_type != "unknown" else "low", first_seen, last_seen,
                        f"Server: {mfr}-WebServer/2.0",
                        json.dumps({"product": mfr, "org": org, "simulated": True}),
                        now.isoformat(),
                        profile["auth_required"], profile["known_cve_count"], json.dumps(profile["cve_ids"]),
                        json.dumps(profile["cve_categories"]), profile["max_cvss"], profile["last_patch_date"],
                        "synthetic_demo",
                    ),
                )
                written += 1
            centre = CITY_CLUSTERS[city][0]
            await db.execute(
                "INSERT OR REPLACE INTO cities (name, lat, lon, zoom_level, last_fetched) VALUES (?, ?, ?, ?, ?)",
                (city, centre[0], centre[1], 12, now.isoformat()),
            )
        await db.commit()
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description="Rebuild the simulated console fixture data/public.db (labelled demo data).")
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "public.db")
    ap.add_argument("--devices", type=int, default=9320, help="number of simulated devices (default 9320)")
    ap.add_argument("--seed", type=int, default=20261128)
    ap.add_argument("--force", action="store_true", help="overwrite --out if it exists")
    args = ap.parse_args()

    if args.out.exists() and not args.force:
        sys.exit(f"{args.out} exists; pass --force to overwrite it.")
    if args.devices < len(CITY_WEIGHTS):
        sys.exit(f"--devices must be at least {len(CITY_WEIGHTS)}.")

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "fixture_src.db"
        written = asyncio.run(_generate(src, args.devices, args.seed))
        public = _load_module("build_public_db", ROOT / "scripts" / "build_public_db.py")
        res = public.build_public_db(src, args.out)
    print(json.dumps({"output": str(args.out), "devices_written": written, "seed": args.seed, **res}, indent=2))


if __name__ == "__main__":
    main()
