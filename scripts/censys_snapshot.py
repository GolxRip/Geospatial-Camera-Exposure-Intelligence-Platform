#!/usr/bin/env python3
"""
censys_snapshot.py — Censys aggregate‑only snapshot for COBRA‑WATCH.

Queries the Censys Search 2.0 API for aggregate metadata about
Indian surveillance cameras.  **No individual host data or IP addresses
are ever retrieved or stored** — only bucket counts.

Each run writes a dated directory under  data/censys/{YYYY-MM-DD}/
containing:
  • snapshot.json  — machine‑readable aggregate records
  • README.md      — human‑readable summary of the run

Usage
-----
    # Set up credentials (standard Censys SDK env vars)
    export CENSYS_API_ID=your_api_id
    export CENSYS_API_SECRET=your_api_secret

    # Full snapshot  — all queries, all India
    python scripts/censys_snapshot.py

    # Dry run  — show what would be queried, hit nothing
    python scripts/censys_snapshot.py --dry-run

    # Single‑city snapshot
    python scripts/censys_snapshot.py --city Mumbai
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "censys"

# Queries to aggregate.  {city_clause} is replaced at runtime.
QUERY_TEMPLATES: list[dict[str, str]] = [
    {
        "label": "RTSP cameras (port 554)",
        "query": "services.port: 554 AND location.country: India{city_clause}",
    },
    {
        "label": "Hikvision devices",
        "query": 'services.http.response.headers.server: Hikvision AND location.country: India{city_clause}',
    },
    {
        "label": "Dahua devices",
        "query": 'services.http.response.headers.server: Dahua AND location.country: India{city_clause}',
    },
    {
        "label": 'HTML title "Network Camera"',
        "query": 'services.http.response.html_title: "Network Camera" AND location.country: India{city_clause}',
    },
    {
        "label": 'HTML title "DVR"',
        "query": 'services.http.response.html_title: "DVR" AND location.country: India{city_clause}',
    },
]

# Fields to aggregate per query, with desired bucket count.
AGGREGATE_FIELDS: list[dict[str, Any]] = [
    {"field": "location.city", "num_buckets": 20},
    {"field": "services.http.response.headers.server", "num_buckets": 20},
    {"field": "services.port", "num_buckets": 10},
    {"field": "services.tls.certificates.leaf_data.issuer.common_name", "num_buckets": 10},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _city_clause(city: str | None) -> str:
    """Return a Censys query fragment to restrict results to *city*."""
    if city:
        return f' AND location.city: "{city}"'
    return ""


def _build_queries(city: str | None) -> list[dict[str, str]]:
    """Expand query templates with the optional city filter."""
    clause = _city_clause(city)
    return [
        {"label": t["label"], "query": t["query"].format(city_clause=clause)}
        for t in QUERY_TEMPLATES
    ]


def _run_dry(queries: list[dict[str, str]]) -> None:
    """Print what would happen without hitting the API."""
    print("=== DRY RUN ===\n")
    for q in queries:
        print(f"  [{q['label']}]")
        print(f"    query: {q['query']}")
        for af in AGGREGATE_FIELDS:
            print(f"    → aggregate on  {af['field']}  (top {af['num_buckets']})")
        print()
    print(f"Results would be saved to: {DATA_DIR / '<date>'}")
    print("No API calls were made.")


def _run_live(queries: list[dict[str, str]]) -> None:
    """Execute aggregate queries via the Censys Python SDK."""
    # Late import so --dry-run works even without the package installed.
    try:
        from censys.search import CensysHosts  # type: ignore[import-untyped]
    except ImportError:
        print(
            "ERROR: The 'censys' Python package is not installed.\n"
            "       Install it with:  pip install censys",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        from censys.common.exceptions import (  # type: ignore[import-untyped]
            CensysException,
            CensysUnauthorizedException,
        )
    except ImportError:
        # Older SDK versions might not split these out.
        from censys.common.exceptions import CensysException  # type: ignore[import-untyped]
        CensysUnauthorizedException = CensysException  # type: ignore[misc]

    # --- authenticate ---------------------------------------------------
    api_id = os.getenv("CENSYS_API_ID", "")
    api_secret = os.getenv("CENSYS_API_SECRET", "")

    if not api_id or not api_secret:
        print(
            "ERROR: CENSYS_API_ID and CENSYS_API_SECRET environment variables must be set.\n"
            "       Get free API credentials at https://search.censys.io/account/api",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        hosts = CensysHosts(api_id=api_id, api_secret=api_secret)
    except CensysUnauthorizedException:
        print(
            "ERROR: Censys authentication failed — check your API ID and secret.",
            file=sys.stderr,
        )
        sys.exit(1)

    # --- timestamp & output dir -----------------------------------------
    now_utc = datetime.now(timezone.utc)
    date_str = now_utc.strftime("%Y-%m-%d")
    out_dir = DATA_DIR / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, Any]] = []
    errors: list[str] = []

    print(f"Censys snapshot — {now_utc.isoformat()}")
    print(f"Output directory: {out_dir}\n")

    for q in queries:
        print(f"  [{q['label']}]  {q['query']}")
        for af in AGGREGATE_FIELDS:
            field = af["field"]
            num = af["num_buckets"]
            try:
                result = hosts.aggregate(
                    q["query"],
                    field=field,
                    num_buckets=num,
                )
                # The SDK returns a dict with 'total', 'buckets', etc.
                total = result.get("total", 0)
                buckets = [
                    {"key": b.get("key", ""), "count": b.get("count", 0)}
                    for b in result.get("buckets", [])
                ]
                record = {
                    "query": q["query"],
                    "label": q["label"],
                    "timestamp_utc": now_utc.isoformat(),
                    "field": field,
                    "total": total,
                    "buckets": buckets,
                }
                records.append(record)
                print(f"    ✓ {field}  —  total={total}, buckets={len(buckets)}")
            except CensysException as exc:
                msg = f"Query [{q['label']}] field [{field}]: {exc}"
                errors.append(msg)
                print(f"    ✗ {field}  —  {exc}")

    # --- write snapshot.json --------------------------------------------
    snapshot_path = out_dir / "snapshot.json"
    with open(snapshot_path, "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2, ensure_ascii=False)
    print(f"\n  → Saved {len(records)} aggregate records to {snapshot_path}")

    # --- write README.md ------------------------------------------------
    readme_path = out_dir / "README.md"
    with open(readme_path, "w", encoding="utf-8") as fh:
        fh.write(f"# Censys Aggregate Snapshot — {date_str}\n\n")
        fh.write(f"**Generated:** {now_utc.isoformat()}  \n")
        fh.write(f"**Records:** {len(records)}  \n")
        fh.write(f"**Errors:** {len(errors)}  \n\n")
        fh.write("## Queries\n\n")
        for q in queries:
            fh.write(f"- **{q['label']}** — `{q['query']}`\n")
        fh.write("\n## Aggregate fields\n\n")
        for af in AGGREGATE_FIELDS:
            fh.write(f"- `{af['field']}` (top {af['num_buckets']})\n")
        if errors:
            fh.write("\n## Errors\n\n")
            for e in errors:
                fh.write(f"- {e}\n")
        fh.write(
            "\n---\n\n"
            "> **Privacy note:** This snapshot contains aggregate counts only.\n"
            "> No individual IP addresses or host‑level data were stored.\n"
        )
    print(f"  → Saved README to {readme_path}")

    if errors:
        print(f"\n⚠  {len(errors)} error(s) occurred — see README for details.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="COBRA‑WATCH Censys aggregate snapshot (metadata only, no IPs).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show planned queries without calling the API.",
    )
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help="Restrict queries to a specific Indian city (e.g. Mumbai).",
    )
    args = parser.parse_args()

    queries = _build_queries(args.city)

    if args.dry_run:
        _run_dry(queries)
    else:
        _run_live(queries)


if __name__ == "__main__":
    main()
