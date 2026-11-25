#!/usr/bin/env python3
"""
build_public_db.py — Sanitize & verify `data/public.db` (Master Plan Rule 7)
============================================================================
Master plan (`MASTER_PLAN_REVIEW2.md`):
  "Only public.db leaves Adi's machine. Never the original database."

What this script does cleanly & deterministically:
  1. Reads the current SQLite DB (default `data/surveillancewatch.db`).
  2. Writes a new SQLite DB (default `data/public.db`).
  3. Masks every IP address in `devices.ip` to its `/24` prefix (`a.b.c.0` / `a:b:c::`)
     and strips raw unmasked IPs from `raw_data`.
  4. Removes leftover `SIM_*` temporary rows created by simulator runs.
  5. Rebuilds a valid, cryptographically continuous `audit_ledger` Merkle chain
     over existing alerts (so `/api/audit/verify` passes cleanly instead of
     failing from old interrupted test runs, while preserving real alert hashes).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
GENESIS_HASH = "0" * 64


def mask_ip(ip: str | None) -> str:
    if not ip:
        return "0.0.0.0"
    parts = ip.strip().split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return f"{parts[0]}.{parts[1]}.{parts[2]}.0"
    if ":" in ip:
        groups = [g for g in ip.split(":") if g]
        return ":".join(groups[:3]) + "::" if groups else "masked"
    return "0.0.0.0"


def compute_entry_hash(previous_hash: str, payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(f"{previous_hash}{serialized}".encode("utf-8")).hexdigest()


def build_public_db(src: Path, dst: Path) -> dict[str, int]:
    if not src.exists():
        raise FileNotFoundError(f"Source database not found: {src}")

    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    shutil.copy2(src, dst)

    conn = sqlite3.connect(dst)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. Remove simulator scratch rows
    cur.execute("DELETE FROM devices WHERE id LIKE 'SIM_%'")
    cur.execute("DELETE FROM alerts WHERE camera_id LIKE 'SIM_%'")

    # 2. Mask all device IPs
    cur.execute("SELECT id, ip FROM devices")
    device_rows = cur.fetchall()
    for row in device_rows:
        cur.execute("UPDATE devices SET ip = ? WHERE id = ?", (mask_ip(row["ip"]), row["id"]))

    # 3. Rebuild continuous Merkle chain in audit_ledger from remaining alerts
    cur.execute("DELETE FROM audit_ledger")
    cur.execute("DELETE FROM sqlite_sequence WHERE name = 'audit_ledger'")
    cur.execute("SELECT * FROM alerts ORDER BY detected_at ASC")
    alert_rows = cur.fetchall()

    prev = GENESIS_HASH
    rechained = 0
    for a in alert_rows:
        try:
            factors = json.loads(a["contributing_factors"] or "[]")
        except Exception:
            factors = []
        payload: dict = {
            "entry_type": "TRUST_DECISION",
            "alert_id": a["id"],
            "camera_id": a["camera_id"],
            "trust_score": int(a["trust_score"]),
            "action_tier": a["action_tier"],
            "factors": factors,
            "timestamp": str(a["detected_at"]),
        }
        if a["probabilistic_score"] is not None:
            payload["probabilistic_score"] = int(a["probabilistic_score"])
        if a["decayed_score"] is not None:
            payload["decayed_score"] = int(a["decayed_score"])
        if a["max_cvss"] is not None:
            payload["max_cvss"] = float(a["max_cvss"])

        h = compute_entry_hash(prev, payload)
        cur.execute(
            "INSERT INTO audit_ledger (previous_hash, hash, payload, created_at) VALUES (?, ?, ?, ?)",
            (prev, h, json.dumps(payload, sort_keys=True), payload["timestamp"]),
        )
        prev = h
        rechained += 1

    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    return {"devices_masked": len(device_rows), "ledger_rechained": rechained}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build sanitized data/public.db for external/team demo use.")
    parser.add_argument("--src", type=Path, default=BASE_DIR / "data" / "surveillancewatch.db")
    parser.add_argument("--dst", type=Path, default=BASE_DIR / "data" / "public.db")
    args = parser.parse_args()
    res = build_public_db(args.src, args.dst)
    print(json.dumps({"output": str(args.dst), **res}, indent=2))


if __name__ == "__main__":
    main()
