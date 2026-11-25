"""
analytics_router.py
====================
Module G (Major Project) — Analytics Dashboard REST API
Literature: All 5 research clusters synthesized

Endpoints
---------
GET /api/analytics/trust-distribution   — fleet & alert trust tier bucket counts
GET /api/analytics/alert-timeline       — hourly alert counts (split by real vs demo)
GET /api/analytics/score-comparison     — average WA vs Probabilistic vs Decayed
GET /api/analytics/summary              — system overview for dashboard banner
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import aiosqlite
from fastapi import APIRouter, Query

from config import DATABASE_PATH
from services.trust_score_service import compute_ig_dctf_trust_score

router = APIRouter()

ALL_INDIA_ALIASES = {"All India", "All", "all", ""}


def _norm_city(city: str | None) -> str | None:
    if not city or city.strip() in ALL_INDIA_ALIASES:
        return None
    return city.strip()


def _parse_json_list(val) -> list:
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.strip():
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []
    return []


@router.get("/analytics/trust-distribution")
async def get_trust_distribution(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours (default 24h)"),
    city: str | None = Query(None, description="Filter by city"),
):
    """
    Trust score distribution across recent alerts AND fleet static-posture tiers.
    Real and demo alerts are counted separately (`real_total_alerts`, `demo_total_alerts`)
    so simulated traffic is never confused with real traffic.
    """
    filter_city = _norm_city(city)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if filter_city:
            alert_q = """
                SELECT trust_score, action_tier, probabilistic_score, decayed_score,
                       COALESCE(is_demo, 0) AS is_demo
                  FROM alerts
                 WHERE detected_at >= ? AND city = ?
            """
            alert_params: tuple = (cutoff, filter_city)
            dev_q = (
                "SELECT id, city, owner_type, auth_required, known_cve_count, last_patch_date, "
                "cve_categories, last_drift_score, geo_source "
                "FROM devices WHERE id NOT LIKE 'SIM_%' AND city = ?"
            )
            dev_params: tuple = (filter_city,)
        else:
            alert_q = """
                SELECT trust_score, action_tier, probabilistic_score, decayed_score,
                       COALESCE(is_demo, 0) AS is_demo
                  FROM alerts
                 WHERE detected_at >= ?
            """
            alert_params = (cutoff,)
            dev_q = (
                "SELECT id, city, owner_type, auth_required, known_cve_count, last_patch_date, "
                "cve_categories, last_drift_score, geo_source "
                "FROM devices WHERE id NOT LIKE 'SIM_%'"
            )
            dev_params = ()

        async with db.execute(alert_q, alert_params) as cursor:
            rows = await cursor.fetchall()
        async with db.execute(dev_q, dev_params) as cursor:
            dev_rows = await cursor.fetchall()

    # Real fleet device posture tiers
    fleet_tiers = {"high_trust": 0, "medium_trust": 0, "low_trust": 0, "unscored": 0}
    geo_sources: dict[str, int] = {}
    for dr in dev_rows:
        d = dict(dr)
        gs = d.get("geo_source") or "unknown"
        geo_sources[gs] = geo_sources.get(gs, 0) + 1
        try:
            res = compute_ig_dctf_trust_score(
                device=d,
                corroborating_cameras=[],
                drift_score=float(d.get("last_drift_score") or 0.0),
                cve_categories=_parse_json_list(d.get("cve_categories")) or None,
            )
            t = res.get("tier")
            if t in fleet_tiers:
                fleet_tiers[t] += 1
            else:
                fleet_tiers["unscored"] += 1
        except Exception:
            fleet_tiers["unscored"] += 1

    buckets = {"critical_low": 0, "low": 0, "medium": 0, "high": 0}
    tiers = {"high_trust": 0, "medium_trust": 0, "low_trust": 0}
    wa_scores, prob_scores, decayed_scores = [], [], []
    real_alerts = 0
    demo_alerts = 0

    for row in rows:
        if row["is_demo"]:
            demo_alerts += 1
        else:
            real_alerts += 1

        score = row["trust_score"] or 0
        if score <= 20:
            buckets["critical_low"] += 1
        elif score <= 49:
            buckets["low"] += 1
        elif score <= 79:
            buckets["medium"] += 1
        else:
            buckets["high"] += 1

        tier = row["action_tier"] or "low_trust"
        if tier in tiers:
            tiers[tier] += 1

        wa_scores.append(score)
        if row["probabilistic_score"] is not None:
            prob_scores.append(row["probabilistic_score"])
        if row["decayed_score"] is not None:
            decayed_scores.append(row["decayed_score"])

    def avg(lst):
        return round(sum(lst) / len(lst), 1) if lst else None

    return {
        "total_alerts": len(rows),
        "real_total_alerts": real_alerts,
        "demo_total_alerts": demo_alerts,
        "hours_window": hours,
        "city": filter_city,
        "buckets": buckets,
        "tiers": tiers,
        "fleet_tiers": fleet_tiers,
        "fleet_device_count": len(dev_rows),
        "geo_sources": geo_sources,
        "averages": {
            "wa": avg(wa_scores),
            "probabilistic": avg(prob_scores),
            "decayed": avg(decayed_scores),
        },
    }


@router.get("/analytics/alert-timeline")
async def get_alert_timeline(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
    city: str | None = Query(None),
):
    """
    Hourly alert frequency timeline for the last N hours.

    Returns `{hour, count, real_count, demo_count, high_trust, medium_trust, low_trust}`
    buckets using the actual `alerts.is_demo` flag.
    """
    filter_city = _norm_city(city)
    now = datetime.now(timezone.utc)
    start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=hours - 1)

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if filter_city:
            query = """
                SELECT detected_at, action_tier, COALESCE(is_demo, 0) AS is_demo
                  FROM alerts
                 WHERE detected_at >= ? AND city = ?
                 ORDER BY detected_at ASC
            """
            params: tuple = (start.isoformat(), filter_city)
        else:
            query = """
                SELECT detected_at, action_tier, COALESCE(is_demo, 0) AS is_demo
                  FROM alerts
                 WHERE detected_at >= ?
                 ORDER BY detected_at ASC
            """
            params = (start.isoformat(),)

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

    timeline: dict[int, dict] = {}
    for i in range(hours):
        bucket_time = start + timedelta(hours=i)
        timeline[i] = {
            "hour": bucket_time.strftime("%H:00"),
            "count": 0,
            "real_count": 0,
            "demo_count": 0,
            "high_trust": 0,
            "medium_trust": 0,
            "low_trust": 0,
        }

    for row in rows:
        try:
            detected = datetime.fromisoformat(
                str(row["detected_at"]).replace("Z", "+00:00")
            )
            if detected.tzinfo is None:
                detected = detected.replace(tzinfo=timezone.utc)
            bucket_dt = detected.replace(minute=0, second=0, microsecond=0)
            idx = int((bucket_dt - start).total_seconds() / 3600)
            if 0 <= idx < hours:
                timeline[idx]["count"] += 1
                if row["is_demo"]:
                    timeline[idx]["demo_count"] += 1
                else:
                    timeline[idx]["real_count"] += 1
                tier = row["action_tier"] or "low_trust"
                if tier in ("high_trust", "medium_trust", "low_trust"):
                    timeline[idx][tier] += 1
        except (ValueError, TypeError, AttributeError):
            continue

    return {
        "hours_window": hours,
        "city": filter_city,
        "total_alerts": len(rows),
        "timeline": list(timeline.values()),
    }


@router.get("/analytics/score-comparison")
async def get_score_comparison(
    city: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Per-alert comparison of WA, Probabilistic, and Decayed trust scores."""
    filter_city = _norm_city(city)
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if filter_city:
            query = """
                SELECT id, camera_id, event_type, detected_at, action_tier,
                       trust_score, probabilistic_score, decayed_score
                  FROM alerts
                 WHERE city = ?
                 ORDER BY detected_at DESC
                 LIMIT ?
            """
            params: tuple = (filter_city, limit)
        else:
            query = """
                SELECT id, camera_id, event_type, detected_at, action_tier,
                       trust_score, probabilistic_score, decayed_score
                  FROM alerts
                 ORDER BY detected_at DESC
                 LIMIT ?
            """
            params = (limit,)

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

    alerts = []
    for row in rows:
        d = dict(row)
        d["wa_vs_prob_delta"] = (
            (d["probabilistic_score"] or 0) - d["trust_score"]
            if d["probabilistic_score"] is not None else None
        )
        d["wa_vs_decayed_delta"] = (
            (d["decayed_score"] or 0) - d["trust_score"]
            if d["decayed_score"] is not None else None
        )
        alerts.append(d)

    return {
        "city": filter_city,
        "count": len(alerts),
        "alerts": alerts,
    }


@router.get("/analytics/summary")
async def get_analytics_summary(city: str | None = Query(None)):
    """
    High-level system overview for the AnalyticsPanel dashboard banner.
    Returns total devices, total alerts (24h, split real vs demo), tier distribution,
    and integrity status.
    """
    from services.audit_ledger import get_ledger_stats, verify_ledger_integrity_report

    filter_city = _norm_city(city)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row

        if filter_city:
            async with db.execute(
                "SELECT COUNT(*) FROM devices WHERE id NOT LIKE 'SIM_%' AND city = ?",
                (filter_city,),
            ) as cur:
                device_count = (await cur.fetchone())[0]
            async with db.execute(
                "SELECT action_tier, COALESCE(is_demo, 0) AS is_demo, COUNT(*) as n "
                "FROM alerts WHERE detected_at >= ? AND city = ? GROUP BY action_tier, COALESCE(is_demo, 0)",
                (cutoff, filter_city),
            ) as cur:
                tier_rows = await cur.fetchall()
        else:
            async with db.execute("SELECT COUNT(*) FROM devices WHERE id NOT LIKE 'SIM_%'") as cur:
                device_count = (await cur.fetchone())[0]
            async with db.execute(
                "SELECT action_tier, COALESCE(is_demo, 0) AS is_demo, COUNT(*) as n "
                "FROM alerts WHERE detected_at >= ? GROUP BY action_tier, COALESCE(is_demo, 0)",
                (cutoff,),
            ) as cur:
                tier_rows = await cur.fetchall()

    tiers = {"high_trust": 0, "medium_trust": 0, "low_trust": 0}
    real_alerts_24h = 0
    demo_alerts_24h = 0
    for row in tier_rows:
        t = row["action_tier"]
        n = row["n"]
        if t in tiers:
            tiers[t] += n
        if row["is_demo"]:
            demo_alerts_24h += n
        else:
            real_alerts_24h += n

    total_alerts_24h = real_alerts_24h + demo_alerts_24h

    ledger_stats = get_ledger_stats()
    integrity = verify_ledger_integrity_report()

    return {
        "city": filter_city or "All",
        "device_count": device_count,
        "total_alerts_24h": total_alerts_24h,
        "real_alerts_24h": real_alerts_24h,
        "demo_alerts_24h": demo_alerts_24h,
        "alert_tiers_24h": tiers,
        "audit_chain_length": ledger_stats["chain_length"],
        "audit_chain_valid": integrity["valid"],
        "head_hash_preview": ledger_stats["head_hash"][:16] + "..." if ledger_stats["head_hash"] != "0" * 64 else "genesis",
    }
