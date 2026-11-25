"""
integrity_router.py
====================
Module G REST API — IG-DCTF Signal Integrity Gate Endpoints
Literature: §4.5 of the IG-DCTF research contribution document.

Endpoints:
  GET /api/integrity/stats                — Fleet-level integrity dashboard summary
  GET /api/integrity/{device_id}          — Per-device gate state, drift breakdown, fingerprint

Design notes:
  - These are READ-ONLY endpoints (no outbound probing, no DB mutations).
  - Data is sourced entirely from the columns populated by
    signal_integrity_service.record_device_drift_and_integrity() which is called
    on every POST /api/detection-event.
  - For devices with no detection event yet, signal_integrity_score defaults to 1.0
    (no evidence of compromise — conservative pass-through, not a fabricated trust).
  - The /stats endpoint is designed to feed the AnalyticsPanel.jsx dashboard component.
"""

from __future__ import annotations

import json

import aiosqlite
from fastapi import APIRouter, HTTPException, Query

from config import DATABASE_PATH, mask_ip_for_public
from services.signal_integrity_service import compute_banner_drift, extract_banner_fingerprint

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_device_integrity(device_id: str) -> dict | None:
    """Fetch IG-DCTF columns for a single device."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, city, ip, manufacturer, owner_type,
                   auth_required, known_cve_count, device_type, ports,
                   banner_snippet, raw_data, firmware_version,
                   signal_integrity_score, last_drift_score,
                   integrity_gate_tripped, banner_fingerprint,
                   fetched_at, geo_source
              FROM devices
             WHERE id = ?
            """,
            (device_id,),
        ) as cursor:
            row = await cursor.fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/integrity/stats")
async def get_integrity_fleet_stats(city: str | None = Query(None, description="Optional city filter")):
    """
    Fleet-Level IG-DCTF Signal Integrity Dashboard Summary.

    Returns:
    - Total devices monitored
    - Integrity gate trip counts (hard_gated, tapered, nominal)
    - Baseline fingerprint coverage (`has_baseline_count`, `without_baseline_count`)
    - Drift score distribution (mean, max, pct > 0.15 anomaly threshold)
    - Top-5 most anomalous devices by drift score
    - City-level breakdown
    """
    filter_city = city.strip() if city and city.strip() not in ("All India", "All", "all", "") else None

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if filter_city:
            async with db.execute(
                """
                SELECT id, city, manufacturer, ip, banner_fingerprint,
                       signal_integrity_score, last_drift_score, integrity_gate_tripped
                  FROM devices
                 WHERE id NOT LIKE 'SIM_%' AND city = ?
                """,
                (filter_city,),
            ) as cursor:
                rows = await cursor.fetchall()
        else:
            async with db.execute(
                """
                SELECT id, city, manufacturer, ip, banner_fingerprint,
                       signal_integrity_score, last_drift_score, integrity_gate_tripped
                  FROM devices
                 WHERE id NOT LIKE 'SIM_%'
                """
            ) as cursor:
                rows = await cursor.fetchall()

    if not rows:
        return {
            "total_devices": 0,
            "message": "No devices in database.",
        }

    devices = [dict(r) for r in rows]
    total = len(devices)
    has_baseline_count = sum(1 for d in devices if d.get("banner_fingerprint"))

    # Gate status distribution
    hard_gated = [d for d in devices if (d.get("signal_integrity_score") or 1.0) < 0.50]
    tapered = [d for d in devices if 0.50 <= (d.get("signal_integrity_score") or 1.0) < 0.85]
    nominal = [d for d in devices if (d.get("signal_integrity_score") or 1.0) >= 0.85]

    # Drift score stats
    drift_scores = [d.get("last_drift_score") or 0.0 for d in devices]
    anomalous_count = sum(1 for s in drift_scores if s >= 0.15)
    mean_drift = round(sum(drift_scores) / total, 4) if total > 0 else 0.0
    max_drift = round(max(drift_scores), 4) if drift_scores else 0.0

    # Top-5 most drifting devices
    top_drifting = sorted(devices, key=lambda d: d.get("last_drift_score") or 0.0, reverse=True)[:5]
    top_drifting_out = [
        {
            "device_id": d["id"],
            "city": d["city"],
            "manufacturer": d.get("manufacturer", "unknown"),
            "drift_score": round(d.get("last_drift_score") or 0.0, 4),
            "signal_integrity_score": round(d.get("signal_integrity_score") or 1.0, 4),
            "gate_tripped": bool(d.get("integrity_gate_tripped")),
        }
        for d in top_drifting
        if (d.get("last_drift_score") or 0.0) > 0.0
    ]

    # City-level breakdown
    city_map: dict[str, dict] = {}
    for d in devices:
        city = d.get("city") or "Unknown"
        if city not in city_map:
            city_map[city] = {"total": 0, "hard_gated": 0, "anomalous_drift": 0}
        city_map[city]["total"] += 1
        if (d.get("signal_integrity_score") or 1.0) < 0.50:
            city_map[city]["hard_gated"] += 1
        if (d.get("last_drift_score") or 0.0) >= 0.15:
            city_map[city]["anomalous_drift"] += 1

    return {
        "total_devices": total,
        "has_baseline_count": has_baseline_count,
        "without_baseline_count": total - has_baseline_count,
        "gate_distribution": {
            "hard_gated": len(hard_gated),         # signal_integrity < 0.50
            "tapered": len(tapered),               # 0.50 <= s < 0.85
            "nominal": len(nominal),               # s >= 0.85
        },
        "drift_stats": {
            "mean_drift_score": mean_drift,
            "max_drift_score": max_drift,
            "anomalous_count": anomalous_count,    # drift >= 0.15 threshold
            "anomalous_fraction": round(anomalous_count / total, 4) if total > 0 else 0.0,
        },
        "top_drifting_devices": top_drifting_out,
        "city_breakdown": city_map,
    }


@router.get("/integrity/{device_id}")
async def get_device_integrity_state(device_id: str):
    """
    Per-Device IG-DCTF Signal Integrity Gate State.

    Returns the current Tier-1 banner-fingerprint state, drift score,
    composite signal integrity, gate status, and stored fingerprint vector
    for the specified device.

    Used by:
    - Security analyst console (per-camera inspection)
    - Paper evaluation: comparing CVE-only vs IG-DCTF scores for labeled scenarios
    - Forensic audit (cross-reference with audit_ledger entries for same camera)
    """
    device = await _get_device_integrity(device_id)
    if device is None:
        raise HTTPException(
            status_code=404,
            detail=f"Device '{device_id}' not found. Run Shodan ingest or seed_demo_data.py first.",
        )

    sig_integrity: float = device.get("signal_integrity_score") or 1.0
    drift_score: float = device.get("last_drift_score") or 0.0
    gate_tripped: bool = bool(device.get("integrity_gate_tripped", 0))

    # Derive gate status from stored signal integrity score
    if sig_integrity >= 0.85:
        gate_status = "nominal"
        gate_multiplier = 1.0
    elif sig_integrity >= 0.50:
        slope = (1.0 - 0.3) / (0.85 - 0.50)
        gate_multiplier = round(0.3 + slope * (sig_integrity - 0.50), 4)
        gate_status = "tapered"
    else:
        gate_status = "hard_gated"
        gate_multiplier = 0.30

    # Parse stored baseline fingerprint and extract current scan fingerprint
    banner_fp = None
    raw_fp = device.get("banner_fingerprint")
    if raw_fp:
        try:
            banner_fp = json.loads(raw_fp)
        except (json.JSONDecodeError, TypeError):
            banner_fp = None

    raw_payload: dict | str | None = device.get("raw_data")
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except (json.JSONDecodeError, TypeError):
            raw_payload = {"data": device.get("banner_snippet") or ""}
    if not isinstance(raw_payload, dict):
        raw_payload = {"data": device.get("banner_snippet") or ""}
    if "ports" not in raw_payload and device.get("ports"):
        try:
            raw_payload["ports"] = json.loads(device["ports"])
        except Exception:
            pass
    if "firmware_version" not in raw_payload and device.get("firmware_version"):
        raw_payload["firmware_version"] = device["firmware_version"]
    if "data" not in raw_payload and device.get("banner_snippet"):
        raw_payload["data"] = device["banner_snippet"]

    current_fp = extract_banner_fingerprint(raw_payload)
    drift_breakdown = compute_banner_drift(banner_fp, current_fp) if banner_fp else None

    # Fetch the most recent alert for this device to show last event context
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT id, event_type, detected_at, trust_score, action_tier,
                   signal_integrity_score, drift_score, integrity_gate_tripped
              FROM alerts
             WHERE camera_id = ?
             ORDER BY detected_at DESC
             LIMIT 1
            """,
            (device_id,),
        ) as cursor:
            last_alert_row = await cursor.fetchone()

    last_alert = dict(last_alert_row) if last_alert_row else None

    return {
        "device_id": device_id,
        "city": device.get("city"),
        "manufacturer": device.get("manufacturer", "unknown"),
        "ip": mask_ip_for_public(device.get("ip")),
        "last_scanned_at": device.get("fetched_at"),
        "has_baseline": banner_fp is not None,
        # IG-DCTF gate state
        "signal_integrity_score": round(sig_integrity, 4),
        "drift_score": round(drift_score, 4),
        "integrity_gate_tripped": gate_tripped,
        "gate_status": gate_status,
        "gate_multiplier": gate_multiplier,
        # Anomaly interpretation
        "drift_anomalous": drift_score >= 0.15,
        "anomaly_threshold": 0.15,
        # Tier-1 banner fingerprint (most recently stored baseline & extracted current banner)
        "banner_fingerprint": banner_fp,
        "current_fingerprint": current_fp,
        "component_distances": drift_breakdown["component_distances"] if drift_breakdown else None,
        # Thresholds (for client-side visualization)
        "thresholds": {
            "theta_high": 0.85,
            "theta_low": 0.50,
            "hard_cap_score": 30,
        },
        # Last alert context
        "last_alert": last_alert,
        # Advisory message for operators
        "operator_advisory": (
            "INTEGRITY GATE TRIPPED: Dispatch technician for physical camera inspection. "
            "High probability of device substitution, feed relay, or honeypot insertion."
            if gate_tripped else
            "Feed authenticity tapered — marginal drift detected. Monitor for further changes."
            if gate_status == "tapered" else
            "Feed integrity nominal. No anomalous banner drift detected."
        ),
    }
