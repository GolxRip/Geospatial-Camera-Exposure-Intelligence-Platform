"""
censys_router.py
================
Read-only endpoints exposing real saved Censys aggregate snapshots, honest
device dataset provenance (Censys vs OSM vs Shodan vs synthetic demo fill), and
the canonical research benchmark metrics from `paper/data/results.json` (B8).

Zero outbound probing; zero unmasked third-party IPs exposed.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import aiosqlite
from fastapi import APIRouter, HTTPException, Query

from config import CENSYS_DIR as _CENSYS_DIR, DATABASE_PATH, RESULTS_JSON_PATH as _RESULTS_JSON_PATH

router = APIRouter()

# Configurable in config.py (env CENSYS_DIR / RESULTS_JSON_PATH) so the Docker image, which contains only
# backend/, can find the mounted research artifacts.
CENSYS_DIR = Path(_CENSYS_DIR)
RESULTS_JSON_PATH = Path(_RESULTS_JSON_PATH)

ALL_INDIA_ALIASES = {"All India", "All", "all", ""}


@router.get("/censys/snapshots")
async def list_censys_snapshots():
    """
    Load real saved Censys aggregate snapshots from `data/censys/*/snapshot.json`.
    Never fabricates data: returns an empty list with `available: false` when
    no snapshot has been saved yet.
    """
    if not CENSYS_DIR.exists():
        return {
            "available": False,
            "snapshots": [],
            "message": "No Censys snapshot directory found. Run python scripts/censys_snapshot.py first.",
        }

    snapshots: list[dict[str, Any]] = []
    for snap_file in sorted(CENSYS_DIR.glob("*/snapshot.json"), reverse=True):
        date_dir = snap_file.parent.name
        try:
            raw = json.loads(snap_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        # censys_snapshot.py writes either a list of records or {"meta": ..., "results": [...]}
        if isinstance(raw, list):
            records = raw
            meta = {"date": date_dir}
        elif isinstance(raw, dict):
            records = raw.get("results", [])
            meta = {"date": date_dir, **(raw.get("meta") or {})}
        else:
            continue

        snapshots.append({
            "date": date_dir,
            "meta": meta,
            "record_count": len(records),
            "records": records,
        })

    if not snapshots:
        return {
            "available": False,
            "snapshots": [],
            "message": "No saved Censys aggregate snapshot yet. Run `python scripts/censys_snapshot.py` with Censys credentials.",
        }

    return {
        "available": True,
        "count": len(snapshots),
        "snapshots": snapshots,
    }


@router.get("/devices/provenance")
async def get_device_provenance(city: str | None = Query(None)):
    """
    Honest device dataset composition breakdown by `geo_source` and city.
    Used by the UI to tell operators plainly what fraction of points come from
    Censys metadata, OpenStreetMap nodes, live scanner results, or demo fill.
    """
    filter_city = city if city and city not in ALL_INDIA_ALIASES else None

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if filter_city:
            async with db.execute(
                "SELECT COALESCE(geo_source, 'unknown') AS geo_source, COUNT(*) AS n "
                "FROM devices WHERE id NOT LIKE 'SIM_%' AND city = ? GROUP BY geo_source",
                (filter_city,),
            ) as cur:
                rows = await cur.fetchall()
        else:
            async with db.execute(
                "SELECT COALESCE(geo_source, 'unknown') AS geo_source, COUNT(*) AS n "
                "FROM devices WHERE id NOT LIKE 'SIM_%' GROUP BY geo_source"
            ) as cur:
                rows = await cur.fetchall()

    by_source = {r["geo_source"]: r["n"] for r in rows}
    total = sum(by_source.values())
    synthetic = by_source.get("synthetic_demo", 0)
    real_total = total - synthetic

    return {
        "city": filter_city or "All India",
        "total_devices": total,
        "real_devices": real_total,
        "synthetic_devices": synthetic,
        "by_geo_source": by_source,
        "is_predominantly_synthetic": total > 0 and real_total == 0,
    }


@router.get("/results")
async def get_paper_results():
    """Serve `paper/data/results.json` read-only (FRONTEND_SPEC.md section 16 B8)."""
    if not RESULTS_JSON_PATH.exists():
        raise HTTPException(status_code=404, detail="paper/data/results.json not found.")
    try:
        return json.loads(RESULTS_JSON_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read results.json: {exc}") from exc
