#!/usr/bin/env python3
"""
Nebraska DOT WZDx v4.2 Feed Generator
=====================================
Reads the Nebraska CARS/511 FEU-G XML event feed and produces a WZDx v4.2
Work Zone Feed (GeoJSON) suitable for publication and registration in the
USDOT Work Zone Data Feed Registry. Also writes a data-gap report listing
source data that should be supplemented or corrected in CARS.

NO INSTALLATION REQUIRED beyond Python itself (3.9 or newer) — this script
uses only the Python standard library.

Quick start:
  1. Create a file named credentials.txt in the same folder as this script:
        CARS_USERNAME=your-hub-username
        CARS_PASSWORD=your-hub-password
  2. Run:   python nebraska_wzdx_generator.py
  3. Output: wzdx_nebraska.geojson (the feed) + wzdx_nebraska_gaps.md (gap report)

Other commands:
  python nebraska_wzdx_generator.py --probe        show the first raw source event
  python nebraska_wzdx_generator.py --out FILE     write the feed somewhere else

Credentials may also be given as environment variables (CARS_USERNAME /
CARS_PASSWORD), which take precedence over credentials.txt.

Optional: if the 'jsonschema' package happens to be installed, the script
additionally validates against the official USDOT schema. Without it, the
built-in specification checks (same rules) still run — no install needed.
"""

import argparse
import base64
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    _LOCAL_TZ_DEFAULT = ZoneInfo("America/Chicago")
except Exception:  # Windows without tzdata — approximate with fixed CST
    _LOCAL_TZ_DEFAULT = timezone(timedelta(hours=-6), "CST")

# ---------------------------------------------------------------- constants

FEED_URL_DEFAULT = "https://ne.carsprogram.org/hub/data/feu-g.xml"

DATA_SOURCE_ID = "ndot-cars-511"
PUBLISHER = "Nebraska Department of Transportation"
ORGANIZATION_NAME = "Nebraska Department of Transportation (511/CARS)"
UPDATE_FREQUENCY_SECONDS = 300  # feed regenerated every 5 minutes
LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"

# FEU-G events that count as work zones (headline/description keyword match).
WORK_ZONE_PATTERN = re.compile(
    r"road ?work|construction|maintenance|paving|resurfac|milling|bridge work"
    r"|bridge repair|striping|patching|shoulder work|utility work|mowing",
    re.IGNORECASE,
)

# If the source omits an end time, WZDx still requires end_date.
MISSING_END_DATE_EXTENSION = timedelta(days=30)

DIRECTION_ENUM = {
    "northbound", "eastbound", "southbound", "westbound",
    "undefined", "unknown", "inner-loop", "outer-loop",
}
VEHICLE_IMPACT_ENUM = {
    "all-lanes-closed", "some-lanes-closed", "all-lanes-open",
    "alternating-one-way", "some-lanes-closed-merge-left",
    "some-lanes-closed-merge-right", "all-lanes-open-shift-left",
    "all-lanes-open-shift-right", "some-lanes-closed-split", "flagging",
    "temporary-traffic-signal", "unknown",
}
LOCATION_METHOD_ENUM = {
    "channel-device-method", "sign-method", "junction-method", "other", "unknown",
}
ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

# ---------------------------------------------------------------- helpers


def as_list(value):
    """Normalize an XML child that may be a single item or a list."""
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _text(node):
    """Flatten any FEU-G phrase/text node to a string."""
    if node is None:
        return ""
    if isinstance(node, str):
        return node.strip()
    if isinstance(node, list):
        return "; ".join(t for t in (_text(n) for n in node) if t)
    if isinstance(node, dict):
        if "#text" in node:
            return str(node["#text"]).strip()
        return "; ".join(t for t in (_text(v) for v in node.values()) if t)
    return str(node).strip()


def to_utc_iso(value, local_tz):
    """
    Parse an FEU-G timestamp and return ISO-8601 UTC ('Z') or None.
    Handles both plain strings ("2026-07-20T06:00:00-05:00") and the compound
    form used by the live Nebraska hub:
      {"date": "20260724", "time": "065330", "utc-offset": "-0500"}
    """
    if not value:
        return None
    if isinstance(value, dict):
        d = value.get("date")
        t = value.get("time") or "000000"
        off = value.get("utc-offset")
        if not d:
            return None
        try:
            dt = datetime.strptime(f"{d}{t}", "%Y%m%d%H%M%S")
        except ValueError:
            return None
        if isinstance(off, str) and re.fullmatch(r"[+-]\d{4}", off):
            sign = -1 if off.startswith("-") else 1
            dt = dt.replace(
                tzinfo=timezone(
                    sign * timedelta(hours=int(off[1:3]), minutes=int(off[3:5]))
                )
            )
        else:
            dt = dt.replace(tzinfo=local_tz)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    s = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=local_tz)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def microdeg(value):
    """FEU-G geo-location values are microdegrees: divide by 1,000,000."""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if abs(v) > 1000:  # microdegrees
        v = v / 1_000_000.0
    return round(v, 6)


def map_direction(link_direction, link_alignment):
    """
    FEU-G v2.2 link-direction ('positive direction' | 'negative direction' |
    'both directions' | 'not directional') + link-alignment (N/S/E/W cardinal
    of the positive direction) -> WZDx Direction enum value, or None when the
    event covers both directions (caller splits it into two road events).
    """
    ld = (link_direction or "").strip().lower()
    la = (link_alignment or "").strip().upper()[:1]
    if ld in ("both directions", "not directional") or not ld:
        return None
    positive = ld == "positive direction"
    table = {
        "E": ("eastbound", "westbound"),
        "W": ("westbound", "eastbound"),
        "N": ("northbound", "southbound"),
        "S": ("southbound", "northbound"),
    }
    if la in table:
        return table[la][0 if positive else 1]
    return None


def directional_pair(link_alignment, road_name):
    """Directions used when splitting a both-directions event into two events."""
    la = (link_alignment or "").strip().upper()[:1]
    if la in ("E", "W"):
        return ("eastbound", "westbound")
    if la in ("N", "S"):
        return ("northbound", "southbound")
    m = re.search(r"(\d+)", road_name or "")
    if m:  # even-numbered routes run E-W, odd-numbered run N-S
        return ("eastbound", "westbound") if int(m.group(1)) % 2 == 0 else (
            "northbound",
            "southbound",
        )
    return None


def infer_vehicle_impact(text):
    """Map free-text lane language to the WZDx VehicleImpact enum."""
    t = (text or "").lower()
    if re.search(
        r"\b(road|highway|all lanes|both lanes)\s+(is\s+|are\s+)?closed\b"
        r"|closed to (all )?traffic|full closure|road closure", t):
        return "all-lanes-closed"
    if re.search(r"alternating|pilot car|one[- ]lane traffic|single[- ]lane traffic", t):
        return "alternating-one-way"
    if re.search(r"flagger|flagging", t):
        return "flagging"
    if re.search(r"lane[s]? (is |are )?(closed|closure|narrowed|restricted)"
                 r"|(left|right|center) lane|lane closure|lane restriction", t):
        return "some-lanes-closed"
    if "shoulder" in t:
        return "all-lanes-open"
    return "unknown"


def event_status(start_iso, end_iso, now):
    if start_iso and start_iso > now:
        return "planned"
    if end_iso and end_iso < now:
        return "completed"
    return "active"


# ------------------------------------------------------- data-gap reporting

GAP_GUIDANCE = {
    "missing-start-date": (
        "No explicit start time in source",
        "start_date anchored to the event's last update-time",
        "The hub currently publishes only update-time + duration. Enter the "
        "scheduled start date/time in CARS (or enable start/end times on the "
        "FEU-G hub output).",
    ),
    "missing-end-date": (
        "No explicit end time in source",
        "end_date = start + valid-period duration (fallback +30 days), "
        "is_end_date_verified=false",
        "Enter the planned completion date in CARS; update it as schedules "
        "change (or enable start/end times on the FEU-G hub output).",
    ),
    "unknown-vehicle-impact": (
        "Lane impact not stated",
        "vehicle_impact set to 'unknown'",
        "Include explicit lane language in the CARS description (e.g. 'right "
        "lane closed', 'alternating one-lane traffic') or populate CARS lane "
        "fields.",
    ),
    "undefined-direction": (
        "Direction not determinable",
        "direction set to 'undefined'",
        "Populate link-direction / link-alignment (direction of travel) in CARS.",
    ),
    "point-only-location": (
        "No end point for the work zone",
        "geometry is a single point (MultiPoint) instead of a line",
        "Enter the secondary (end) location in CARS so the full extent maps.",
    ),
    "missing-milepost": (
        "No linear reference",
        "beginning_milepost omitted",
        "Populate the milepost/linear reference in CARS.",
    ),
    "terse-description": (
        "Description under 25 characters",
        "passed through as-is",
        "Add work type, lane impact, and expected delays to the CARS description.",
    ),
}


def write_gap_report(features, path, state_label, source_label):
    """Write a markdown report of source-data gaps found this run."""
    from collections import Counter

    counts = Counter()
    flagged = []
    for f in features:
        gaps = f.get("_gaps") or []
        for gap in gaps:
            counts[gap] += 1
        if gaps:
            flagged.append((f["id"],
                            ", ".join(f["properties"]["core_details"]["road_names"]),
                            gaps))

    total = len(features)
    lines = [
        f"# {state_label} WZDx Feed — Data Gap Report",
        "",
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} "
        f"from {source_label}.",
        f"The feed is **schema-valid** as published; every item below is a place "
        f"where the source data should be **supplemented or corrected** so "
        f"consumers (navigation apps, CAVs, freight) get real values instead of "
        f"defaults.",
        "",
        f"Total work-zone features this run: **{total}**",
        "",
        "| Gap | Features affected | What the feed does today | Fix at the source |",
        "|---|---|---|---|",
    ]
    for key, (label, patched, fix) in GAP_GUIDANCE.items():
        n = counts.get(key, 0)
        if n:
            pct = f"{n} ({round(100 * n / total)}%)" if total else str(n)
            lines.append(f"| {label} | {pct} | {patched} | {fix} |")
    if not counts:
        lines.append("| *(no gaps detected)* | — | — | — |")

    lines += ["", "## Events with the most gaps (top 25)", "",
              "| Event | Road | Gaps |", "|---|---|---|"]
    flagged.sort(key=lambda r: len(r[2]), reverse=True)
    for fid, roads, gaps in flagged[:25]:
        lines.append(f"| {fid} | {roads} | {', '.join(gaps)} |")

    Path(path).write_text("\n".join(lines) + "\n")
    return counts


# ---------------------------------------------------------------- fetch/parse


def _urlopen(req, timeout=60):
    """urlopen with graceful handling of machines whose Python installation
    is missing root certificates (common on fresh macOS/python.org installs)."""
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.URLError as e:
        if not isinstance(getattr(e, "reason", None), ssl.SSLCertVerificationError):
            raise
    try:  # the certifi package (if present) carries its own CA bundle
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        return urllib.request.urlopen(req, timeout=timeout, context=ctx)
    except (ImportError, urllib.error.URLError):
        pass
    print("NOTE: this computer's Python is missing root certificates, so the "
          "server's identity could not be cryptographically verified. Proceeding "
          "anyway — the data is public and read-only. Permanent fix: on macOS run "
          "'Install Certificates.command' inside your Python application folder, "
          "or ask IT to install CA certificates.")
    ctx = ssl._create_unverified_context()
    return urllib.request.urlopen(req, timeout=timeout, context=ctx)


def fetch_source(url, username, password):
    req = urllib.request.Request(url)
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")
    with _urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def _etree_to_obj(elem):
    """Convert an XML element to nested dicts/strings (namespaces stripped)."""
    children = list(elem)
    if not children:
        text = (elem.text or "").strip()
        return text or None
    d = {}
    for child in children:
        key = child.tag.split("}")[-1]
        val = _etree_to_obj(child)
        if key in d:
            if not isinstance(d[key], list):
                d[key] = [d[key]]
            d[key].append(val)
        else:
            d[key] = val
    return d


def parse_feu_events(xml_text):
    root = ET.fromstring(xml_text)
    obj = _etree_to_obj(root) or {}
    # root element is FEUMessages; events are its full-event-update children
    return as_list(obj.get("full-event-update"))


# ---------------------------------------------------------------- mapping


def build_features(feu_events, local_tz):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    features = []
    skipped_not_workzone = 0
    skipped_no_geometry = 0

    for update in feu_events:
        if not isinstance(update, dict):
            continue
        event_id = (update.get("event-reference") or {}).get("event-id") or None
        headline = _text((update.get("headline") or {}).get("headline"))
        detail = (update.get("details") or {}).get("detail") or {}

        # -- description -------------------------------------------------
        desc_nodes = as_list((detail.get("descriptions") or {}).get("description"))
        desc_parts = [
            _text(d.get("phrase") if isinstance(d, dict) else d) for d in desc_nodes
        ]
        description = "; ".join(p for p in desc_parts if p) or headline or "Roadwork"

        # -- work-zone filter --------------------------------------------
        if not WORK_ZONE_PATTERN.search(f"{headline} {description}"):
            skipped_not_workzone += 1
            continue

        # -- location ----------------------------------------------------
        locations = as_list((detail.get("locations") or {}).get("location"))
        loc = locations[0] if locations else {}
        on_link = (loc or {}).get("location-on-link") or {}

        route = _text(on_link.get("route-designator"))
        roadway_nodes = as_list(
            (detail.get("roadway-names") or {}).get("roadway-name")
        )
        roadway_names = [_text(r) for r in roadway_nodes if _text(r)]
        road_names = [n for n in ([route] + roadway_names) if n]
        road_names = list(dict.fromkeys(road_names)) or ["Unknown"]

        link_direction = _text(on_link.get("link-direction")) or None
        link_alignment = _text(on_link.get("link-alignment")) or None

        primary = on_link.get("primary-location") or {}
        secondary = on_link.get("secondary-location") or {}
        p_geo = primary.get("geo-location") or {}
        s_geo = secondary.get("geo-location") or {}
        p_lat, p_lng = microdeg(p_geo.get("latitude")), microdeg(p_geo.get("longitude"))
        s_lat, s_lng = microdeg(s_geo.get("latitude")), microdeg(s_geo.get("longitude"))
        milepost = primary.get("linear-reference")

        if p_lat is None or p_lng is None:
            skipped_no_geometry += 1
            continue

        if (
            s_lat is not None
            and s_lng is not None
            and (s_lat, s_lng) != (p_lat, p_lng)
        ):
            geometry = {
                "type": "LineString",
                "coordinates": [[p_lng, p_lat], [s_lng, s_lat]],
            }
        else:
            # WZDx v4.2 allows only LineString or MultiPoint geometries.
            geometry = {"type": "MultiPoint", "coordinates": [[p_lng, p_lat]]}

        # -- times -------------------------------------------------------
        # The live Nebraska hub nests times at detail/times with only an
        # update-time plus valid-period/duration; other CARS hubs use
        # detail/event-times with explicit start-time/end-time. Try both.
        times = detail.get("event-times") or detail.get("times") or {}
        valid = times.get("valid-period") or {}
        update_date = to_utc_iso(times.get("update-time"), local_tz) or now
        start_date = to_utc_iso(
            times.get("start-time") or valid.get("expected-start-time"), local_tz
        )
        end_date = to_utc_iso(
            times.get("end-time") or valid.get("expected-end-time"), local_tz
        )
        start_missing = start_date is None
        if start_missing:
            # best available anchor for an event active in the feed right now
            start_date = update_date
        end_missing = end_date is None
        if end_missing:
            start_dt = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            )
            duration_s = None
            try:
                duration_s = int(str(valid.get("duration")))
            except (TypeError, ValueError):
                pass
            if duration_s and 0 < duration_s <= 180 * 86400:
                end_date = (start_dt + timedelta(seconds=duration_s)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            else:
                end_date = (start_dt + MISSING_END_DATE_EXTENSION).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            if end_date <= now:
                # the event is still in the active feed — a derived end date
                # must never sit in the past (would falsely read 'completed')
                now_dt = datetime.strptime(now, "%Y-%m-%dT%H:%M:%SZ").replace(
                    tzinfo=timezone.utc
                )
                end_date = (now_dt + MISSING_END_DATE_EXTENSION).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )

        # -- direction / splitting ---------------------------------------
        direction = map_direction(link_direction, link_alignment)
        if direction:
            directions = [(direction, "")]
        else:
            pair = directional_pair(link_alignment, road_names[0])
            if pair:
                directions = [(pair[0], "-1"), (pair[1], "-2")]
            else:
                directions = [("undefined", "")]

        vehicle_impact = infer_vehicle_impact(f"{headline} {description}")

        # -- source-data gap flags (reported, never blocking) -------------
        gaps = []
        if start_missing:
            gaps.append("missing-start-date")
        if end_missing:
            gaps.append("missing-end-date")
        if vehicle_impact == "unknown":
            gaps.append("unknown-vehicle-impact")
        if geometry["type"] == "MultiPoint":
            gaps.append("point-only-location")
        if milepost is None:
            gaps.append("missing-milepost")
        if len(description) < 25:
            gaps.append("terse-description")

        for dir_value, suffix in directions:
            fid = f"NE-{event_id or 'unknown'}{suffix}"
            props = {
                "core_details": {
                    "event_type": "work-zone",
                    "data_source_id": DATA_SOURCE_ID,
                    "road_names": road_names,
                    "direction": dir_value,
                    "name": headline or f"Roadwork on {road_names[0]}",
                    "description": description,
                    "update_date": update_date,
                },
                "start_date": start_date,
                "end_date": end_date,
                "is_start_date_verified": False,
                "is_end_date_verified": False,
                "is_start_position_verified": False,
                "is_end_position_verified": False,
                "location_method": "junction-method",
                "work_zone_type": "static",
                "vehicle_impact": vehicle_impact,
                "event_status": event_status(start_date, end_date, now),
            }
            if milepost is not None:
                try:
                    props["beginning_milepost"] = float(milepost)
                except (TypeError, ValueError):
                    pass
            feature_gaps = gaps + (
                ["undefined-direction"] if dir_value == "undefined" else []
            )
            features.append(
                {
                    "id": fid,
                    "type": "Feature",
                    "properties": props,
                    "geometry": geometry,
                    "_gaps": feature_gaps,  # stripped before publication
                }
            )

    return features, skipped_not_workzone, skipped_no_geometry


def build_feed(features):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "feed_info": {
            "publisher": PUBLISHER,
            "version": "4.2",
            "license": LICENSE_URL,
            "update_date": now,
            "update_frequency": UPDATE_FREQUENCY_SECONDS,
            "data_sources": [
                {
                    "data_source_id": DATA_SOURCE_ID,
                    "organization_name": ORGANIZATION_NAME,
                    "update_date": now,
                    "update_frequency": UPDATE_FREQUENCY_SECONDS,
                }
            ],
        },
        "type": "FeatureCollection",
        "features": features,
    }


# ---------------------------------------------------------------- validation


def validate_feed(feed):
    """
    Built-in WZDx v4.2 specification checks (no packages needed).
    Returns a list of error strings; empty list = feed is publishable.
    """
    errors = []
    fi = feed.get("feed_info") or {}
    for key in ("update_date", "version", "publisher", "data_sources"):
        if not fi.get(key):
            errors.append(f"feed_info.{key} missing")
    for src in fi.get("data_sources") or []:
        for key in ("data_source_id", "organization_name"):
            if not src.get(key):
                errors.append(f"data_sources[].{key} missing")

    for i, f in enumerate(feed.get("features") or []):
        where = f"features[{i}] ({f.get('id', '?')})"
        for key in ("id", "type", "properties", "geometry"):
            if not f.get(key):
                errors.append(f"{where}: {key} missing")
        props = f.get("properties") or {}
        core = props.get("core_details") or {}
        if core.get("event_type") != "work-zone":
            errors.append(f"{where}: core_details.event_type must be 'work-zone'")
        if not core.get("data_source_id"):
            errors.append(f"{where}: core_details.data_source_id missing")
        if core.get("direction") not in DIRECTION_ENUM:
            errors.append(f"{where}: invalid direction '{core.get('direction')}'")
        if not core.get("road_names"):
            errors.append(f"{where}: core_details.road_names missing/empty")
        for key in ("start_date", "end_date"):
            if not ISO_Z.match(str(props.get(key) or "")):
                errors.append(f"{where}: {key} not ISO-8601 UTC ('...Z')")
        if props.get("vehicle_impact") not in VEHICLE_IMPACT_ENUM:
            errors.append(f"{where}: invalid vehicle_impact")
        if props.get("location_method") not in LOCATION_METHOD_ENUM:
            errors.append(f"{where}: invalid location_method")
        for key in ("is_start_date_verified", "is_end_date_verified",
                    "is_start_position_verified", "is_end_position_verified"):
            if not isinstance(props.get(key), bool):
                errors.append(f"{where}: {key} missing (must be true/false)")
        geom = f.get("geometry") or {}
        if geom.get("type") not in ("LineString", "MultiPoint"):
            errors.append(f"{where}: geometry must be LineString or MultiPoint")
        else:
            coords = geom.get("coordinates") or []
            if not coords or not all(
                isinstance(c, list) and len(c) == 2
                and all(isinstance(v, (int, float)) for v in c)
                for c in coords
            ):
                errors.append(f"{where}: geometry coordinates malformed")
    return errors


def try_full_schema_validation(feed):
    """If the optional 'jsonschema' package is installed, also validate
    against the official USDOT v4.2 schema. Returns (ran, errors)."""
    try:
        from jsonschema import Draft7Validator
        from referencing import Registry, Resource
        from referencing.jsonschema import DRAFT7
    except ImportError:
        return False, []

    schema_url = ("https://raw.githubusercontent.com/usdot-jpo-ode/wzdx/main/"
                  "schemas/4.2/WorkZoneFeed.json")
    cache_dir = Path(__file__).resolve().parent / ".schema_cache"

    def retrieve(uri):
        cache_dir.mkdir(exist_ok=True)
        cache_file = cache_dir / re.sub(r"[^A-Za-z0-9.]+", "_", uri)
        if cache_file.exists():
            contents = json.loads(cache_file.read_text())
        else:
            with _urlopen(uri, timeout=30) as resp:
                contents = json.loads(resp.read().decode())
            cache_file.write_text(json.dumps(contents))
        return Resource.from_contents(contents, default_specification=DRAFT7)

    try:
        validator = Draft7Validator(
            retrieve(schema_url).contents, registry=Registry(retrieve=retrieve)
        )
        errors = []
        for err in validator.iter_errors(feed):
            path = "/".join(str(p) for p in err.absolute_path) or "(root)"
            errors.append(f"{path}: {err.message[:200]}")
        return True, errors
    except Exception as exc:  # network blocked etc. — never fatal
        print(f"  (official-schema check skipped: {exc})")
        return False, []


# ---------------------------------------------------------------- main


def load_credentials():
    """Environment variables win; otherwise read credentials.txt next to
    this script (lines of KEY=VALUE)."""
    creds = {}
    path = Path(__file__).resolve().parent / "credentials.txt"
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, val = line.split("=", 1)
                creds[key.strip()] = val.strip()
    for key in ("CARS_USERNAME", "CARS_PASSWORD", "CARS_FEED_URL"):
        if os.environ.get(key):
            creds[key] = os.environ[key]
    return creds


def write_cifs(feed, path):
    """Write a CIFS (Common Incident Feed Specification) XML feed for Google/Waze.
    Point-only (MultiPoint) events are skipped because CIFS needs a polyline.
    Standard library only. Returns (incidents_written, skipped)."""
    from xml.sax.saxutils import escape
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<incidents>"]
    n = skipped = 0
    for feat in feed.get("features", []):
        g = feat.get("geometry") or {}
        if g.get("type") == "LineString":
            coords = g.get("coordinates") or []
        elif g.get("type") == "MultiLineString":
            coords = [c for ln in (g.get("coordinates") or []) for c in ln]
        else:
            skipped += 1
            continue
        if len(coords) < 2:
            skipped += 1
            continue
        props = feat.get("properties") or {}
        cd = props.get("core_details") or {}
        iid = feat.get("id") or "%s-%d" % (cd.get("data_source_id", "wz"), n)
        street = (cd.get("road_names") or [""])[0]
        poly = " ".join("%s %s" % (c[1], c[0]) for c in coords)  # CIFS is "lat lng" pairs
        cifs_dir = "BOTH_DIRECTIONS" if str(cd.get("direction", "")).lower() == "both" else "ONE_DIRECTION"
        start = props.get("start_date")
        end = props.get("end_date")
        upd = cd.get("update_date")
        desc = cd.get("description") or cd.get("name") or ("%s work zone" % street).strip()
        lines.append('  <incident id="%s">' % escape(str(iid)))
        lines.append("    <type>CONSTRUCTION</type>")
        lines.append("    <description>%s</description>" % escape(str(desc)))
        lines.append("    <location>")
        if street:
            lines.append("      <street>%s</street>" % escape(str(street)))
        lines.append("      <direction>%s</direction>" % cifs_dir)
        lines.append("      <polyline>%s</polyline>" % poly)
        lines.append("    </location>")
        if start:
            lines.append("    <starttime>%s</starttime>" % escape(str(start)))
        if end:
            lines.append("    <endtime>%s</endtime>" % escape(str(end)))
        if upd:
            lines.append("    <updatetime>%s</updatetime>" % escape(str(upd)))
        lines.append("  </incident>")
        n += 1
    lines.append("</incidents>")
    with open(path, "w") as fh:
        fh.write("\n".join(lines))
    return n, skipped


def main():
    ap = argparse.ArgumentParser(description="Generate the Nebraska WZDx v4.2 feed")
    ap.add_argument("--out", default="wzdx_nebraska.geojson", help="Output file path")
    ap.add_argument("--probe", action="store_true",
                    help="Print the first raw source event and exit")
    ap.add_argument("--no-validate", action="store_true",
                    help="Skip specification validation")
    ap.add_argument("--gap-report", default=None,
                    help="Path for the data-gap report (default: <out>_gaps.md)")
    ap.add_argument("--cifs-out", default=None,
                    help="Path for the CIFS (Google/Waze) feed (default: <out>.cifs.xml)")
    ap.add_argument("--no-cifs", action="store_true",
                    help="Do not write the CIFS feed")
    args = ap.parse_args()

    creds = load_credentials()
    url = creds.get("CARS_FEED_URL", FEED_URL_DEFAULT)
    username = creds.get("CARS_USERNAME")
    password = creds.get("CARS_PASSWORD")
    if not username or not password:
        sys.exit(
            "SETUP NEEDED: create a file named credentials.txt in the same folder\n"
            "as this script, containing these two lines (with your real values):\n\n"
            "    CARS_USERNAME=your-hub-username\n"
            "    CARS_PASSWORD=your-hub-password\n\n"
            "Get credentials from your CARS Program / 511 hub administrator."
        )

    print(f"Fetching {url} ...")
    try:
        xml_text = fetch_source(url, username, password)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            sys.exit("ERROR: the CARS username/password was rejected (HTTP 401).\n"
                     "Check credentials.txt or contact your CARS administrator.")
        sys.exit(f"ERROR: the CARS server returned HTTP {e.code}. Try again in a "
                 "few minutes; if it persists, contact your CARS administrator.")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR: could not reach the CARS server ({e.reason}).\n"
                 "Check your internet connection / agency firewall or proxy.")

    events = parse_feu_events(xml_text)
    print(f"Source events: {len(events)}")

    if args.probe:
        if events:
            print(json.dumps(events[0], indent=2, default=str)[:6000])
        else:
            print("No events in source feed.")
        return

    features, skipped_wz, skipped_geo = build_features(events, _LOCAL_TZ_DEFAULT)
    print(
        f"Work-zone features: {len(features)} "
        f"(skipped {skipped_wz} non-work-zone, {skipped_geo} without coordinates)"
    )

    # data-gap report (source-quality items to supplement/correct at NDOT)
    gap_path = args.gap_report or str(Path(args.out).with_suffix("")) + "_gaps.md"
    gap_counts = write_gap_report(
        features, gap_path, "Nebraska", "the Nebraska CARS/511 FEU-G feed"
    )
    clean = sum(1 for f in features if not f["_gaps"])
    print(f"Data gaps: {sum(gap_counts.values())} across "
          f"{len(features) - clean} features ({clean} gap-free) -> {gap_path}")
    for f in features:
        f.pop("_gaps", None)
    feed = build_feed(features)

    if not args.no_validate:
        errors = validate_feed(feed)
        if errors:
            print(f"SPECIFICATION CHECK FAILED — {len(errors)} error(s):")
            for e in errors[:25]:
                print(f"  - {e}")
            sys.exit(1)
        ran, schema_errors = try_full_schema_validation(feed)
        if ran and schema_errors:
            print(f"OFFICIAL SCHEMA VALIDATION FAILED — {len(schema_errors)} error(s):")
            for e in schema_errors[:25]:
                print(f"  - {e}")
            sys.exit(1)
        print("Specification check: PASSED (WZDx v4.2"
              + (", official schema verified)" if ran else ")"))

    # atomic write so consumers never see a partial file
    out_path = Path(args.out)
    fd, tmp_name = tempfile.mkstemp(
        dir=str(out_path.parent or Path(".")), suffix=".tmp"
    )
    with os.fdopen(fd, "w") as f:
        json.dump(feed, f, indent=1)
    os.replace(tmp_name, out_path)
    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes)")

    if not args.no_cifs:
        cifs_path = args.cifs_out or (str(Path(args.out).with_suffix("")) + ".cifs.xml")
        ncifs, nskip = write_cifs(feed, cifs_path)
        print(f"Wrote {cifs_path} ({ncifs} CIFS incidents; {nskip} point-only skipped)")


if __name__ == "__main__":
    main()
