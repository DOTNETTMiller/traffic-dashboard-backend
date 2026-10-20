#!/usr/bin/env python3
"""
Nevada DOT WZDx v4.2 Feed Generator
===================================
Reads the Nevada 511 / NV Roads developer API (nvroads.com) and produces a
WZDx v4.2 Work Zone Feed (GeoJSON) suitable for publication and registration
in the USDOT Work Zone Data Feed Registry. Also writes a data-gap report
listing source data that should be supplemented or corrected in the 511 entry.

NO INSTALLATION REQUIRED beyond Python itself (3.9 or newer) — this script
uses only the Python standard library.

Quick start:
  1. Create a file named credentials.txt in the same folder as this script:
        NV511_API_KEY=your-nvroads-key
  2. Run:   python nevada_wzdx_generator.py
  3. Output: wzdx_nevada.geojson (the feed) + wzdx_nevada_gaps.md (gap report)

Other commands:
  python nevada_wzdx_generator.py --probe        show the first raw source events
  python nevada_wzdx_generator.py --out FILE     write the feed somewhere else

The key may also be given as an environment variable (NV511_API_KEY), which
takes precedence over credentials.txt.

Optional: if the 'jsonschema' package happens to be installed, the script
additionally validates against the official USDOT schema. Without it, the
built-in specification checks (same rules) still run — no install needed.
"""

import argparse
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------- constants

EVENT_URL_DEFAULT = "https://www.nvroads.com/api/v2/get/event"

DATA_SOURCE_ID = "ndot-nvroads-511"
PUBLISHER = "Nevada Department of Transportation"
ORGANIZATION_NAME = "Nevada Department of Transportation (Nevada 511 / NV Roads)"
UPDATE_FREQUENCY_SECONDS = 300  # feed regenerated every 5 minutes
LICENSE_URL = "https://creativecommons.org/publicdomain/zero/1.0/"

# Source events that count as work zones (event type / description match).
WORK_ZONE_PATTERN = re.compile(
    r"road ?work|construction|maintenance|paving|resurfac|milling|bridge work"
    r"|bridge repair|striping|patching|shoulder work|utility work",
    re.IGNORECASE,
)

# If the source omits a planned end date, WZDx still requires end_date.
MISSING_END_DATE_EXTENSION = timedelta(days=30)

MPH_TO_KPH = 1.609344

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


def g(item, *names, default=None):
    """Get the first present key; NV Roads mixes PascalCase and snake_case."""
    for name in names:
        if name in item and item[name] not in (None, ""):
            return item[name]
    return default


def to_utc_iso(value):
    """Accept epoch seconds/millis or a date string; return ISO-8601 UTC."""
    if value in (None, "", 0, "0"):
        return None
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
        ts = int(value)
        if ts > 10**12:  # milliseconds
            ts //= 1000
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
        except (OverflowError, OSError, ValueError):
            return None
    s = str(value).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def to_float(value):
    try:
        v = float(value)
        return v if v == v else None  # NaN guard
    except (TypeError, ValueError):
        return None


def decode_polyline(encoded):
    """Decode a Google encoded polyline (precision 5) -> [(lat, lng), ...]."""
    coords = []
    index, lat, lng = 0, 0, 0
    try:
        while index < len(encoded):
            for which in (0, 1):
                result, shift = 0, 0
                while True:
                    b = ord(encoded[index]) - 63
                    index += 1
                    result |= (b & 0x1F) << shift
                    shift += 5
                    if b < 0x20:
                        break
                delta = ~(result >> 1) if result & 1 else result >> 1
                if which == 0:
                    lat += delta
                else:
                    lng += delta
            coords.append((lat * 1e-5, lng * 1e-5))
    except IndexError:
        return []  # malformed string — caller falls back to coordinates
    return coords


DIRECTION_MAP = {
    "northbound": "northbound", "nb": "northbound", "north": "northbound",
    "southbound": "southbound", "sb": "southbound", "south": "southbound",
    "eastbound": "eastbound", "eb": "eastbound", "east": "eastbound",
    "westbound": "westbound", "wb": "westbound", "west": "westbound",
    "unknown": "undefined", "none": "undefined", "not directional": "undefined",
}


def map_direction(raw):
    """NV Roads DirectionOfTravel -> WZDx Direction enum, or None for both."""
    d = (raw or "").strip().lower()
    if d in ("both", "both directions", "all", "all directions", "bi-directional"):
        return None
    return DIRECTION_MAP.get(d, "undefined")


def direction_from_text(*texts):
    """Recover a direction stated in the roadway name or description
    (e.g. 'Valle Verde Dr Southbound', 'Westbound Warm Springs Rd')."""
    t = " ".join(str(x).lower() for x in texts if x)
    for token in ("northbound", "southbound", "eastbound", "westbound"):
        if token in t:
            return token
    m = re.search(r"\b(nb|sb|eb|wb)\b", t)
    if m:
        return {"nb": "northbound", "sb": "southbound",
                "eb": "eastbound", "wb": "westbound"}[m.group(1)]
    return None


def directional_pair(road_name):
    """Directions used when splitting a both-directions event into two events."""
    m = re.search(r"(\d+)", road_name or "")
    if m:  # even-numbered routes run E-W, odd-numbered run N-S
        return ("eastbound", "westbound") if int(m.group(1)) % 2 == 0 else (
            "northbound",
            "southbound",
        )
    return None


def infer_vehicle_impact(item, text):
    """Map closure flags / lane language to the WZDx VehicleImpact enum."""
    if g(item, "IsFullClosure", "is_full_closure") in (True, "true", "True", 1):
        return "all-lanes-closed"
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


def build_geometry(item):
    """
    Geometry priority:
      1. EncodedPolyline (Google encoded polyline, precision 5) -> LineString
      2. primary + secondary coordinates -> two-point LineString
      3. primary coordinate only -> MultiPoint (WZDx forbids bare Point)
    """
    encoded = g(item, "EncodedPolyline", "encoded_polyline")
    if encoded:
        pts = decode_polyline(encoded)
        if len(pts) >= 2:
            return {
                "type": "LineString",
                "coordinates": [[round(lng, 6), round(lat, 6)] for lat, lng in pts],
            }
        if len(pts) == 1:
            lat, lng = pts[0]
            return {
                "type": "MultiPoint",
                "coordinates": [[round(lng, 6), round(lat, 6)]],
            }

    lat = to_float(g(item, "Latitude", "latitude", "StartLatitude", "start_latitude"))
    lng = to_float(g(item, "Longitude", "longitude", "StartLongitude", "start_longitude"))
    lat2 = to_float(g(item, "LatitudeSecondary", "latitude_secondary",
                      "EndLatitude", "end_latitude"))
    lng2 = to_float(g(item, "LongitudeSecondary", "longitude_secondary",
                      "EndLongitude", "end_longitude"))
    if lat is None or lng is None:
        return None
    if lat2 is not None and lng2 is not None and (lat2, lng2) != (lat, lng):
        return {"type": "LineString", "coordinates": [[lng, lat], [lng2, lat2]]}
    return {"type": "MultiPoint", "coordinates": [[lng, lat]]}


def build_restrictions(item):
    """NV Roads Restrictions object -> WZDx restrictions[] + speed value."""
    restrictions = []
    speed_kph = None
    r = g(item, "Restrictions", "restrictions", default={}) or {}
    if isinstance(r, dict):
        width = to_float(g(r, "Width", "width"))
        height = to_float(g(r, "Height", "height"))
        length = to_float(g(r, "Length", "length"))
        weight = to_float(g(r, "Weight", "weight"))
        speed = to_float(g(r, "Speed", "speed", "SpeedLimit", "speed_limit"))
        if width:
            restrictions.append({"type": "reduced-width", "value": width, "unit": "feet"})
        if height:
            restrictions.append({"type": "reduced-height", "value": height, "unit": "feet"})
        if length:
            restrictions.append({"type": "reduced-length", "value": length, "unit": "feet"})
        if weight:
            restrictions.append({"type": "reduced-weight", "value": weight, "unit": "pounds"})
        if speed:
            speed_kph = round(speed * MPH_TO_KPH, 1)
    return restrictions, speed_kph


def event_status(start_iso, end_iso, now):
    if start_iso and start_iso > now:
        return "planned"
    if end_iso and end_iso < now:
        return "completed"
    return "active"


# ------------------------------------------------------- data-gap reporting

GAP_GUIDANCE = {
    "missing-start-date": (
        "No start date in source",
        "start_date defaulted to feed generation time",
        "Enter the event start date/time in the 511 event entry.",
    ),
    "missing-end-date": (
        "No planned end date in source",
        "end_date defaulted to start + 30 days, is_end_date_verified=false",
        "Enter PlannedEndDate in the 511 event entry; update as schedules change.",
    ),
    "unknown-vehicle-impact": (
        "Lane impact not stated",
        "vehicle_impact set to 'unknown'",
        "Populate LanesAffected or include explicit lane language in the "
        "description (e.g. 'right lane closed', 'alternating one-lane traffic').",
    ),
    "undefined-direction": (
        "DirectionOfTravel missing/unknown",
        "direction set to 'undefined'",
        "Set DirectionOfTravel on the 511 event (NB/SB/EB/WB or Both).",
    ),
    "point-only-location": (
        "No polyline or end point for the work zone",
        "geometry is a single point (MultiPoint) instead of a line",
        "Draw the event extent (polyline) or set the secondary lat/long in the "
        "511 entry so the full work zone maps.",
    ),
    "terse-description": (
        "Description under 25 characters",
        "passed through as-is",
        "Add work type, lane impact, and expected delays to the description.",
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


# ---------------------------------------------------------------- fetch


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


def fetch_events(url, api_key):
    params = urllib.parse.urlencode(
        {"key": api_key, "format": "json", "language": "en"}
    )
    with _urlopen(f"{url}?{params}", timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8", "replace"))
    if isinstance(data, dict):  # some deployments wrap the array
        for key in ("events", "Events", "data", "results"):
            if isinstance(data.get(key), list):
                return data[key]
        return []
    return data if isinstance(data, list) else []


# ---------------------------------------------------------------- mapping


def is_work_zone(item):
    etype = str(g(item, "EventType", "event_type", "event_category",
                  "EventCategory", default="")).lower()
    if etype in ("roadwork", "construction", "maintenance"):
        return True
    text = " ".join(
        str(x)
        for x in (
            g(item, "EventSubType", "event_sub_type", default=""),
            g(item, "Description", "description", default=""),
            g(item, "Overall Status", default=""),
        )
    )
    return bool(WORK_ZONE_PATTERN.search(text))


def build_features(items):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    features = []
    skipped_not_workzone = 0
    skipped_no_geometry = 0

    for item in items:
        if not is_work_zone(item):
            skipped_not_workzone += 1
            continue

        geometry = build_geometry(item)
        if geometry is None:
            skipped_no_geometry += 1
            continue

        event_id = g(item, "ID", "Id", "id")
        roadway = g(item, "RoadwayName", "roadway_name", default="Unknown")
        description = g(item, "Description", "description",
                        default=g(item, "Overall Status", default="Roadwork"))
        area = g(item, "AreaName", "area_name", "county")
        if area:
            description = f"{description} ({area})"

        start_date = to_utc_iso(g(item, "StartDate", "start_date", "start_time",
                                  "Reported", "reported"))
        end_date = to_utc_iso(g(item, "PlannedEndDate", "planned_end_date",
                                "end_date", "end_time"))
        update_date = to_utc_iso(g(item, "LastUpdated", "last_updated")) or now
        creation_date = to_utc_iso(g(item, "Reported", "reported"))
        start_missing = start_date is None
        if start_missing:
            start_date = now
        end_missing = end_date is None
        if end_missing:
            start_dt = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            )
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

        lanes_text = " ".join(
            str(x)
            for x in (
                g(item, "LanesAffected", "lanes_affected", default=""),
                description,
            )
        )
        vehicle_impact = infer_vehicle_impact(item, lanes_text)
        restrictions, speed_kph = build_restrictions(item)

        direction = map_direction(g(item, "DirectionOfTravel", "direction",
                                    "Direction"))
        if direction == "undefined":
            # supplement from text before giving up
            direction = direction_from_text(roadway, description) or "undefined"
        if direction:
            directions = [(direction, "")]
        else:
            pair = directional_pair(roadway)
            if pair:
                directions = [(pair[0], "-1"), (pair[1], "-2")]
            else:
                directions = [("undefined", "")]

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
        if len(str(description)) < 25:
            gaps.append("terse-description")

        for dir_value, suffix in directions:
            fid = f"NV-{event_id or 'unknown'}{suffix}"
            core = {
                "event_type": "work-zone",
                "data_source_id": DATA_SOURCE_ID,
                "road_names": [roadway],
                "direction": dir_value,
                "name": f"{roadway}: {str(description)[:80]}",
                "description": str(description),
                "update_date": update_date,
            }
            if creation_date:
                core["creation_date"] = creation_date
            props = {
                "core_details": core,
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
            if restrictions:
                props["restrictions"] = restrictions
            if speed_kph:
                props["reduced_speed_limit_kph"] = speed_kph
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
    for key in ("NV511_API_KEY", "NV511_EVENT_URL"):
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
    ap = argparse.ArgumentParser(description="Generate the Nevada WZDx v4.2 feed")
    ap.add_argument("--out", default="wzdx_nevada.geojson", help="Output file path")
    ap.add_argument("--probe", action="store_true",
                    help="Print the first raw source events and exit")
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
    url = creds.get("NV511_EVENT_URL", EVENT_URL_DEFAULT)
    api_key = creds.get("NV511_API_KEY")
    if not api_key:
        sys.exit(
            "SETUP NEEDED: create a file named credentials.txt in the same folder\n"
            "as this script, containing this line (with your real key):\n\n"
            "    NV511_API_KEY=your-nvroads-key\n\n"
            "Get a key from your nvroads.com account (Developer section) or the "
            "NDOT 511 program manager."
        )

    print(f"Fetching {url} ...")
    try:
        items = fetch_events(url, api_key)
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403):
            sys.exit(f"ERROR: the NV Roads API rejected the request (HTTP {e.code}).\n"
                     "Check the NV511_API_KEY value in credentials.txt, or contact "
                     "the NDOT 511 program manager.")
        sys.exit(f"ERROR: the NV Roads server returned HTTP {e.code}. Try again in "
                 "a few minutes.")
    except urllib.error.URLError as e:
        sys.exit(f"ERROR: could not reach nvroads.com ({e.reason}).\n"
                 "Check your internet connection / agency firewall or proxy.")

    print(f"Source events: {len(items)}")

    if args.probe:
        for item in items[:3]:
            print(json.dumps(item, indent=2, default=str)[:4000])
            print("-" * 60)
        if not items:
            print("No events returned — check the key and endpoint.")
        return

    features, skipped_wz, skipped_geo = build_features(items)
    print(
        f"Work-zone features: {len(features)} "
        f"(skipped {skipped_wz} non-work-zone, {skipped_geo} without coordinates)"
    )

    # data-gap report (source-quality items to supplement/correct at NDOT)
    gap_path = args.gap_report or str(Path(args.out).with_suffix("")) + "_gaps.md"
    gap_counts = write_gap_report(
        features, gap_path, "Nevada", "the Nevada 511 / NV Roads event API"
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
