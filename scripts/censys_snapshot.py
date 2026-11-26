#!/usr/bin/env python3
"""
censys_snapshot.py — Censys Platform API v3 aggregate-only snapshot for COBRA-WATCH.

Queries the Censys Platform API v3 aggregate endpoint:
  POST https://api.platform.censys.io/v3/global/search/aggregate
using CenQL (`host.*`) syntax and a Personal Access Token (`CENSYS_API_TOKEN`).

PRIVACY & SCOPE BOUNDARY:
  Metadata only, aggregates only. **No individual IP addresses or host
  identifiers are ever queried, downloaded, or stored** — only bucket keys
  and counts.

Verified against Censys Platform docs (https://docs.censys.com):
  - Auth header : Authorization: Bearer <CENSYS_API_TOKEN>
  - Org context : ?organization_id=<CENSYS_ORG_ID> (optional query param)
  - Body keys   : query, field, number_of_buckets (1..2000), filter_by_query (bool)
  - Response    : {"result": {"field": ..., "query": ..., "total_matching_records": int, "buckets": [{"key": ..., "count": int}]}}
  - Verified host fields: host.location.country, host.location.city,
    host.services.hardware.type, host.services.port, host.services.protocol,
    host.services.software.vendor, host.services.software.product,
    host.services.endpoints.http.html_title, host.autonomous_system.name

Each run writes `data/censys/{YYYY-MM-DD}/snapshot.json` with exact `query`,
`timestamp_utc`, `field`, `buckets`, and `total` count, plus `README.md`.

Also includes a `--from-paste` converter that parses aggregate tables, CSV, TSV,
or JSON copied from the Censys web Report Builder UI into the exact same
`snapshot.json` schema.

Usage
-----
    # Dry run (approved baseline + extra queries, zero network calls)
    python scripts/censys_snapshot.py --dry-run

    # Live run with Censys Platform PAT (only the approved baseline query)
    export CENSYS_API_TOKEN=censys_...
    export CENSYS_ORG_ID=00000000-0000-0000-0000-000000000000   # optional
    python scripts/censys_snapshot.py --baseline-only

    # Single-city snapshot
    python scripts/censys_snapshot.py --city Mumbai

    # Convert aggregate results copied from the Censys website into snapshot.json
    python scripts/censys_snapshot.py --from-paste pasted.txt \
        --query 'host.location.country: "India" AND host.services.hardware.type: "CAMERA"' \
        --field host.services.port
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "censys"

PLATFORM_AGGREGATE_URL = "https://api.platform.censys.io/v3/global/search/aggregate"

# Approved Censys Research Access baseline query (Platform CenQL syntax)
APPROVED_BASELINE_QUERY = 'host.location.country: "India" AND host.services.hardware.type: "CAMERA"'

# Never aggregate on host identifier fields.
FORBIDDEN_HOST_FIELDS = {
    "ip",
    "host.ip",
    "ipv4",
    "ipv6",
    "host.autonomous_system.bgp_prefix",
    "host.dns.names",
    "host.dns.reverse_dns.names",
}

# CenQL v3 query templates verified against Censys Platform documentation.
# {city_clause} is empty for all-India or `' and host.location.city = "<City>"'` for a city.
QUERY_TEMPLATES: list[dict[str, str]] = [
    {
        "label": "Approved baseline: cameras in India",
        "query": APPROVED_BASELINE_QUERY + "{city_clause}",
    },
    {
        "label": "RTSP services in India (port 554)",
        "query": 'host.location.country: "India" and host.services.port = 554{city_clause}',
    },
    {
        "label": "Hikvision software/HTTP in India",
        "query": (
            'host.location.country: "India" and '
            '(host.services.software.vendor: "Hikvision" '
            'or host.services.endpoints.http.headers: (key = "Server" and value: "Hikvision"))'
            "{city_clause}"
        ),
    },
    {
        "label": "Dahua software/HTTP in India",
        "query": (
            'host.location.country: "India" and '
            '(host.services.software.vendor: "Dahua" '
            'or host.services.endpoints.http.headers: (key = "Server" and value: "Dahua"))'
            "{city_clause}"
        ),
    },
    {
        "label": 'HTML title "Network Camera" in India',
        "query": 'host.location.country: "India" and host.services.endpoints.http.html_title: "Network Camera"{city_clause}',
    },
]

# Platform v3 host schema fields verified on docs.censys.com for aggregate bucket breakdowns.
AGGREGATE_FIELDS: list[dict[str, Any]] = [
    {"field": "host.location.city", "number_of_buckets": 20},
    {"field": "host.services.port", "number_of_buckets": 20},
    {"field": "host.services.protocol", "number_of_buckets": 15},
    {"field": "host.services.software.vendor", "number_of_buckets": 20},
    {"field": "host.services.software.product", "number_of_buckets": 20},
    {"field": "host.autonomous_system.name", "number_of_buckets": 20},
]

_IPV4_RE = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")


# ---------------------------------------------------------------------------
# Helpers & privacy guardrails
# ---------------------------------------------------------------------------


def _assert_safe_aggregate_field(field: str) -> None:
    norm = field.strip().lower()
    if norm in FORBIDDEN_HOST_FIELDS or norm.endswith(".ip") or norm == "ip":
        raise ValueError(
            f"Refusing to aggregate on host-identifying field '{field}'. "
            "COBRA-WATCH is strictly restricted to non-identifying Censys metadata aggregates."
        )


def _city_clause(city: str | None) -> str:
    """Return a CenQL city filter clause."""
    if city and city.lower() not in ("all", "all india"):
        safe = city.replace('"', '\\"')
        return f' and host.location.city = "{safe}"'
    return ""


def _build_queries(
    city: str | None,
    baseline_only: bool = False,
    custom_query: str | None = None,
) -> list[dict[str, str]]:
    """Expand query templates with optional city restriction."""
    clause = _city_clause(city)
    if custom_query:
        return [{"label": "Custom aggregate query", "query": custom_query}]
    templates = QUERY_TEMPLATES[:1] if baseline_only else QUERY_TEMPLATES
    return [
        {"label": t["label"], "query": t["query"].format(city_clause=clause)}
        for t in templates
    ]


def _resolve_fields(custom_fields: list[str] | None, num_buckets: int | None) -> list[dict[str, Any]]:
    if custom_fields:
        fields = [{"field": f, "number_of_buckets": num_buckets or 20} for f in custom_fields]
    else:
        fields = [
            {"field": af["field"], "number_of_buckets": num_buckets or af["number_of_buckets"]}
            for af in AGGREGATE_FIELDS
        ]
    for f in fields:
        _assert_safe_aggregate_field(f["field"])
    return fields


# ---------------------------------------------------------------------------
# Paste converter (Censys web UI text / CSV / TSV / JSON -> snapshot.json)
# ---------------------------------------------------------------------------


def _clean_int(raw: str) -> int | None:
    cleaned = raw.strip().replace(",", "").replace("_", "")
    if cleaned.isdigit():
        return int(cleaned)
    return None


def parse_pasted_aggregates(raw_text: str) -> list[dict[str, Any]]:
    """
    Convert pasted Censys Report Builder / web UI aggregate results into normalized
    `[{"key": str, "count": int}]` buckets without inventing counts.

    Supports:
      1. JSON API responses (`{"result": {"buckets": [...]}}`, `{"buckets": [...]}`, or `[...]`)
      2. CSV / TSV lines (`value,count` or `value\\tcount\\tpercent`)
      3. Pasted web table text (`Mumbai   1,234   24.5%` or paired lines `Mumbai\\n1,234`)
      4. Colon-separated (`554: 1234`)
    """
    text = raw_text.strip()
    if not text:
        raise ValueError("Input text is empty.")

    # 1. Try JSON first
    if text[0] in "{[":
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            parsed = None
        bucket_list: list[Any] | None = None
        if isinstance(parsed, dict):
            if isinstance(parsed.get("result"), dict) and isinstance(parsed["result"].get("buckets"), list):
                bucket_list = parsed["result"]["buckets"]
            elif isinstance(parsed.get("buckets"), list):
                bucket_list = parsed["buckets"]
        elif isinstance(parsed, list):
            bucket_list = parsed
        if bucket_list is not None:
            out: list[dict[str, Any]] = []
            for item in bucket_list:
                if not isinstance(item, dict):
                    continue
                key = str(item.get("key", "")).strip()
                count = item.get("count")
                if key and isinstance(count, (int, float)) and not _IPV4_RE.match(key):
                    out.append({"key": key, "count": int(count)})
            if out:
                return out

    # 2. CSV detection (explicit commas where not just numeric thousands inside tabs)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    buckets: list[dict[str, Any]] = []

    if all("\t" in ln or "," in ln for ln in lines[:min(3, len(lines))]) and any("," in ln and "\t" not in ln for ln in lines):
        reader = csv.reader(io.StringIO(text))
        for row in reader:
            cells = [c.strip() for c in row if c.strip()]
            if len(cells) < 2:
                continue
            if cells[0].lower() in ("key", "value", "term", "field", "name"):
                continue
            key = cells[0]
            count = _clean_int(cells[1])
            if count is not None and not _IPV4_RE.match(key):
                buckets.append({"key": key, "count": count})
        if buckets:
            return buckets

    # 3. Single-line tabular / whitespace / colon formats (e.g. `Hikvision   260   12.4%`)
    for ln in lines:
        low = ln.lower()
        if low in ("value", "count", "%", "results", "key") or re.match(r"^(value|key|term)\s+count\b", low):
            continue

        # Tab-separated
        if "\t" in ln:
            parts = [p.strip() for p in ln.split("\t") if p.strip()]
            if len(parts) >= 2:
                cnt = _clean_int(parts[1])
                if cnt is not None and not _IPV4_RE.match(parts[0]):
                    buckets.append({"key": parts[0], "count": cnt})
                    continue

        # Colon format: `554: 1,234`
        m_colon = re.match(r"^(.+?):\s+([\d,]+)(?:\s+[\d.]+%)?$", ln)
        if m_colon:
            key = m_colon.group(1).strip()
            cnt = _clean_int(m_colon.group(2))
            if cnt is not None and not _IPV4_RE.match(key):
                buckets.append({"key": key, "count": cnt})
                continue

        # Space-separated table row with optional trailing percentage: `New Delhi   1,234   12.3%`
        m_ws = re.match(r"^(.+?)\s+([\d,]+)(?:\s+\(?[\d.]+%\)?)?$", ln)
        if m_ws:
            key = m_ws.group(1).strip()
            cnt = _clean_int(m_ws.group(2))
            if cnt is not None and not _IPV4_RE.match(key):
                buckets.append({"key": key, "count": cnt})
                continue

    if buckets:
        return buckets

    # 4. Paired vertical lines copied from card lists:
    #    Mumbai
    #    1,234 (or 1,234 25.0%)
    cleaned_lines = [
        ln for ln in lines
        if ln.lower() not in ("value", "count", "%", "key", "results")
        and not re.match(r"^[\d.]+%$", ln)
    ]
    i = 0
    while i + 1 < len(cleaned_lines):
        key_cand = cleaned_lines[i]
        next_line = re.sub(r"\s*\(?[\d.]+%\)?$", "", cleaned_lines[i + 1]).strip()
        cnt = _clean_int(next_line)
        if cnt is not None and not _IPV4_RE.match(key_cand):
            buckets.append({"key": key_cand, "count": cnt})
            i += 2
        else:
            i += 1

    if not buckets:
        raise ValueError(
            "Could not parse any (key, count) buckets from the pasted input. "
            "Provide JSON buckets, CSV (`key,count`), or copied Censys table rows."
        )
    return buckets


# ---------------------------------------------------------------------------
# Output writers
# ---------------------------------------------------------------------------


def _write_snapshot_bundle(
    out_dir: Path,
    date_str: str,
    now_utc: datetime,
    records: list[dict[str, Any]],
    errors: list[str],
    append: bool = False,
) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = out_dir / "snapshot.json"

    final_records = list(records)
    if append and snapshot_path.exists():
        try:
            existing = json.loads(snapshot_path.read_text(encoding="utf-8"))
            if isinstance(existing, list):
                final_records = existing + records
        except (OSError, json.JSONDecodeError):
            pass

    snapshot_path.write_text(
        json.dumps(final_records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    readme_path = out_dir / "README.md"
    with open(readme_path, "w", encoding="utf-8") as fh:
        fh.write(f"# Censys Aggregate Snapshot — {date_str}\n\n")
        fh.write(f"**Updated (UTC):** {now_utc.isoformat()}  \n")
        fh.write(f"**Records:** {len(final_records)}  \n")
        fh.write(f"**Errors:** {len(errors)}  \n\n")
        fh.write("## Saved Aggregate Records\n\n")
        for rec in final_records:
            fh.write(
                f"- **{rec.get('label', 'Aggregate')}** | field=`{rec.get('field')}` | "
                f"total={rec.get('total')} | buckets={len(rec.get('buckets', []))} | "
                f"source={rec.get('source', 'censys_platform_v3')}  \n"
                f"  query: `{rec.get('query')}`\n"
            )
        if errors:
            fh.write("\n## Errors\n\n")
            for e in errors:
                fh.write(f"- {e}\n")
        fh.write(
            "\n---\n\n"
            "> **Privacy boundary:** Aggregates and metadata only. "
            "Zero individual IP addresses or host records are queried, stored, or published.\n"
        )

    return snapshot_path, readme_path


# ---------------------------------------------------------------------------
# Execution modes
# ---------------------------------------------------------------------------


def _run_dry(queries: list[dict[str, str]], fields: list[dict[str, Any]], org_id: str) -> None:
    """Print exact Censys Platform API v3 requests without hitting the network."""
    print("=== DRY RUN (Censys Platform API v3) ===\n")
    url = PLATFORM_AGGREGATE_URL + (f"?organization_id={org_id}" if org_id else "")
    print(f"Endpoint : POST {url}")
    print("Auth     : Authorization: Bearer <CENSYS_API_TOKEN>\n")
    for q in queries:
        print(f"  [{q['label']}]")
        print(f"    query: {q['query']}")
        for af in fields:
            payload = {
                "query": q["query"],
                "field": af["field"],
                "number_of_buckets": af["number_of_buckets"],
                "filter_by_query": True,
            }
            print(f"    -> payload: {json.dumps(payload)}")
        print()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"Output directory : {DATA_DIR / today}")
    print("No API calls were made.")


def _run_live(
    queries: list[dict[str, str]],
    fields: list[dict[str, Any]],
    org_id: str,
    append: bool,
    target_date: str | None,
) -> None:
    """Execute aggregate requests against Censys Platform API v3."""
    token = os.getenv("CENSYS_API_TOKEN") or os.getenv("CENSYS_PAT") or ""
    if not token:
        has_legacy = bool(os.getenv("CENSYS_API_ID") or os.getenv("CENSYS_API_SECRET"))
        legacy_hint = (
            "\nNote: CENSYS_API_ID / CENSYS_API_SECRET are Legacy Search 2.0 keys. "
            "Censys Platform API v3 requires a Personal Access Token (CENSYS_API_TOKEN)."
            if has_legacy
            else ""
        )
        print(
            "ERROR: CENSYS_API_TOKEN environment variable is required for Censys Platform API v3.\n"
            "       Create a Personal Access Token in Censys Platform Account Settings."
            + legacy_hint,
            file=sys.stderr,
        )
        sys.exit(1)

    now_utc = datetime.now(timezone.utc)
    date_str = target_date or now_utc.strftime("%Y-%m-%d")
    out_dir = DATA_DIR / date_str

    headers: dict[str, str] = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    params: dict[str, str] = {}
    if org_id:
        params["organization_id"] = org_id
        headers["X-Organization-ID"] = org_id

    records: list[dict[str, Any]] = []
    errors: list[str] = []

    print(f"Censys Platform API v3 aggregate snapshot — {now_utc.isoformat()}")
    print(f"Output directory: {out_dir}\n")

    with httpx.Client(timeout=30.0) as client:
        for q in queries:
            print(f"  [{q['label']}]  {q['query']}")
            for af in fields:
                field = af["field"]
                num_buckets = af["number_of_buckets"]
                payload = {
                    "query": q["query"],
                    "field": field,
                    "number_of_buckets": num_buckets,
                    "filter_by_query": True,
                }
                try:
                    resp = client.post(
                        PLATFORM_AGGREGATE_URL,
                        params=params or None,
                        headers=headers,
                        json=payload,
                    )
                    if resp.status_code >= 400:
                        msg = f"HTTP {resp.status_code} for [{q['label']}] field [{field}]: {resp.text[:300]}"
                        errors.append(msg)
                        print(f"    ✗ {field} — {msg}")
                        continue

                    body = resp.json()
                    res = body.get("result") if isinstance(body.get("result"), dict) else body
                    raw_buckets = res.get("buckets") or []
                    total = res.get("total_matching_records")
                    if total is None:
                        total = res.get("total", sum(int(b.get("count", 0)) for b in raw_buckets))

                    buckets = [
                        {"key": b.get("key", ""), "count": int(b.get("count", 0))}
                        for b in raw_buckets
                        if not _IPV4_RE.match(str(b.get("key", "")))
                    ]
                    record = {
                        "query": res.get("query") or q["query"],
                        "label": q["label"],
                        "source": "censys_platform_v3",
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                        "field": res.get("field") or field,
                        "total": int(total),
                        "buckets": buckets,
                    }
                    if res.get("potential_deviation") is not None:
                        record["potential_deviation"] = res["potential_deviation"]
                    if res.get("total_omitted") is not None:
                        record["total_omitted"] = res["total_omitted"]

                    records.append(record)
                    print(f"    ✓ {field} — total={record['total']}, buckets={len(buckets)}")
                except Exception as exc:
                    msg = f"Query [{q['label']}] field [{field}]: {exc}"
                    errors.append(msg)
                    print(f"    ✗ {field} — {exc}")

    snapshot_path, readme_path = _write_snapshot_bundle(
        out_dir=out_dir,
        date_str=date_str,
        now_utc=now_utc,
        records=records,
        errors=errors,
        append=append,
    )
    print(f"\n  -> Saved {len(records)} aggregate record(s) to {snapshot_path}")
    print(f"  -> Saved README to {readme_path}")


def _run_paste_converter(
    paste_source: str,
    query: str,
    field: str,
    label: str,
    total_override: int | None,
    append: bool,
    target_date: str | None,
) -> None:
    _assert_safe_aggregate_field(field)

    if paste_source == "-":
        raw_text = sys.stdin.read()
    else:
        raw_text = Path(paste_source).read_text(encoding="utf-8")

    buckets = parse_pasted_aggregates(raw_text)
    total = total_override if total_override is not None else sum(b["count"] for b in buckets)

    now_utc = datetime.now(timezone.utc)
    date_str = target_date or now_utc.strftime("%Y-%m-%d")
    out_dir = DATA_DIR / date_str

    record = {
        "query": query,
        "label": label,
        "source": "censys_web_paste",
        "timestamp_utc": now_utc.isoformat(),
        "field": field,
        "total": int(total),
        "buckets": buckets,
    }
    snapshot_path, readme_path = _write_snapshot_bundle(
        out_dir=out_dir,
        date_str=date_str,
        now_utc=now_utc,
        records=[record],
        errors=[],
        append=append,
    )
    print(f"Converted {len(buckets)} pasted buckets (total={total}) -> {snapshot_path}")
    print(f"Updated summary -> {readme_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="COBRA-WATCH Censys Platform API v3 aggregate snapshot (metadata & aggregates only, no IPs).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print exact Platform API v3 endpoints and CenQL payloads without making API calls.",
    )
    parser.add_argument(
        "--baseline-only",
        action="store_true",
        help="Run only the approved baseline query: host.location.country: \"India\" AND host.services.hardware.type: \"CAMERA\".",
    )
    parser.add_argument(
        "--city",
        type=str,
        default=None,
        help="Optional city filter (adds `and host.location.city = \"<City>\"`).",
    )
    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help="Custom CenQL query string (overrides preset templates).",
    )
    parser.add_argument(
        "--field",
        action="append",
        dest="fields",
        default=None,
        help="Specific field path to aggregate (repeatable; defaults to curated Platform v3 host fields).",
    )
    parser.add_argument(
        "--buckets",
        type=int,
        default=None,
        help="Number of buckets per aggregate (1..2000; default uses per-field preset 15-20).",
    )
    parser.add_argument(
        "--org-id",
        type=str,
        default=os.getenv("CENSYS_ORG_ID", ""),
        help="Optional Censys Organization UUID (or set CENSYS_ORG_ID).",
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Output YYYY-MM-DD folder under data/censys/ (defaults to current UTC date).",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append new records to an existing snapshot.json for that date instead of overwriting.",
    )
    parser.add_argument(
        "--from-paste",
        type=str,
        default=None,
        help="Convert aggregate results pasted from the Censys website (pass file path or '-' for stdin).",
    )
    parser.add_argument(
        "--label",
        type=str,
        default="Censys web aggregate",
        help="Human label for --from-paste record.",
    )
    parser.add_argument(
        "--total",
        type=int,
        default=None,
        help="Optional total matching count shown in Censys UI (defaults to sum of pasted buckets).",
    )
    args = parser.parse_args()

    if args.from_paste is not None:
        paste_query = args.query or APPROVED_BASELINE_QUERY
        paste_field = (args.fields[0] if args.fields else None) or "host.services.port"
        _run_paste_converter(
            paste_source=args.from_paste,
            query=paste_query,
            field=paste_field,
            label=args.label,
            total_override=args.total,
            append=args.append,
            target_date=args.date,
        )
        return

    queries = _build_queries(args.city, baseline_only=args.baseline_only, custom_query=args.query)
    fields = _resolve_fields(args.fields, args.buckets)

    if args.dry_run:
        _run_dry(queries, fields, org_id=args.org_id)
    else:
        _run_live(queries, fields, org_id=args.org_id, append=args.append, target_date=args.date)


if __name__ == "__main__":
    main()
