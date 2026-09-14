#!/usr/bin/env python3
"""
cwz_normalize.py
Normalize an assembled multi-source work-zone GeoJSON into a conformant CWZ 1.0 /
WZDx 4.1+ feed.

Written for a feed built by aggregating upstream state WZDx/event feeds, where the
defects are INHERITED from publishers that are still on the pre-4.0 shape rather than
introduced by the aggregator. Everything here is a deterministic, lossless structural
fix applied at assembly time; nothing is invented.

What it fixes
  1. Adds the missing top-level `road_event_feed_info`, declaring every
     `data_source_id` the features actually reference.
  2. Migrates the pre-4.0 `*_accuracy` enums to the 4.1 boolean verification flags
     ("verified" -> true, "estimated" -> false). Lossless: the source enum is kept
     under x_ so nothing is destroyed.
  3. Completes unpaired position-verified flags (a start flag without its end).
  4. Renames non-spec underscore-prefixed top-level members to the `x_` extension
     convention.
  5. Flags — never fabricates — geometry it cannot repair.

What it deliberately does NOT do
  - Geometry correction. Two-point crow-flies lines need a centerline/LRS to fix;
    that is wzdx_geometry_fix.py's job (state LRS -> ARNOLD -> OSRM cascade). This
    tool only reports which features need it and whether they carry the mileposts
    that make the exact, measure-based correction possible.
  - Synthesize absent CWZ payload fields (worker_presence, restrictions, ...). If the
    upstream publisher never sent it, no post-processing can conjure it.

Usage
  python3 cwz_normalize.py --in feed.geojson --out feed.cwz.geojson \
      --publisher "MITRE iNODE" --contact-name "..." --contact-email "..."
  python3 cwz_normalize.py --in feed.geojson --report-only

Stdlib only — no install required.
"""
import argparse, json, sys, uuid, collections
from datetime import datetime, timezone

# pre-4.0 accuracy enum -> 4.1 boolean verification flag
ACCURACY_MIGRATION = {
    "start_date_accuracy":  "is_start_date_verified",
    "end_date_accuracy":    "is_end_date_verified",
    "beginning_accuracy":   "is_start_position_verified",
    "ending_accuracy":      "is_end_position_verified",
}
POSITION_PAIR = ("is_start_position_verified", "is_end_position_verified")
DATE_PAIR = ("is_start_date_verified", "is_end_date_verified")

# CWZ §5.4.2.1 payload fields — reported, never synthesized
CWZ_PAYLOAD = ["worker_presence", "reduced_speed_limit_kph", "restrictions",
               "types_of_work", "lanes"]


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def accuracy_to_bool(value):
    """'verified' -> True, 'estimated' -> False. Unknown -> None (leave it alone)."""
    v = str(value).strip().lower()
    if v == "verified":
        return True
    if v in ("estimated", "unverified"):
        return False
    return None


def geometry_state(geom):
    """Classify a feature's geometry: ok | two_point | single_point | missing."""
    if not geom:
        return "missing"
    coords = geom.get("coordinates") or []
    gtype = geom.get("type")
    if gtype == "MultiPoint" and len(coords) == 1:
        return "single_point"
    if len(coords) == 0:
        return "missing"
    if len(coords) == 2:
        return "two_point"
    if gtype in ("LineString", "MultiPoint") and len(coords) > 2:
        return "ok"
    return "ok"


def migrate_feature(feat, stats, keep_source_enums=True):
    """Apply every in-place structural fix to one feature. Returns the feature."""
    props = feat.setdefault("properties", {})
    core = props.setdefault("core_details", {})
    src = core.get("data_source_id")
    per = stats["by_source"][src]
    per["total"] += 1

    # --- 2. pre-4.0 accuracy enums -> 4.1 booleans -------------------------------
    for old, new in ACCURACY_MIGRATION.items():
        if old not in props:
            continue
        if new in props:
            # already has the modern flag; just retire the legacy one
            props.pop(old)
            continue
        flag = accuracy_to_bool(props[old])
        if flag is None:
            per["accuracy_unmapped"] += 1
            stats["accuracy_unmapped_values"][props[old]] += 1
            continue
        props[new] = flag
        legacy = props.pop(old)
        if keep_source_enums:
            props.setdefault("x_source_accuracy", {})[old] = legacy
        per["migrated"] += 1
        stats["migrated_fields"] += 1

    # --- 3. complete unpaired verification flags ---------------------------------
    # An unpaired flag is not a value we know; default the missing half to false
    # (unverified) rather than guessing true, and record that we did it.
    for pair in (POSITION_PAIR, DATE_PAIR):
        a, b = pair
        have_a, have_b = a in props, b in props
        if have_a != have_b:
            missing = b if have_a else a
            props[missing] = False
            props.setdefault("x_conformance_notes", []).append(
                f"{missing} absent upstream; defaulted to false (unverified)")
            per["paired"] += 1
            stats["paired_flags"] += 1

    # --- 5. classify geometry, flag what this tool cannot repair ------------------
    gs = geometry_state(feat.get("geometry"))
    per["geom_" + gs] += 1
    stats["geometry"][gs] += 1
    if gs in ("two_point", "single_point", "missing"):
        bm, em = props.get("beginning_milepost"), props.get("ending_milepost")
        has_extent = bm is not None and em is not None and bm != em
        if gs == "two_point":
            note = ("two-point geometry; correctable by measure (mileposts present)"
                    if has_extent else
                    "two-point geometry; correctable by endpoint snap (no distinct mileposts)")
            per["fixable_by_measure" if has_extent else "fixable_by_snap"] += 1
            stats["fixable_by_measure" if has_extent else "fixable_by_snap"] += 1
        else:
            note = ("zero-length extent upstream (begin == end milepost); "
                    "cannot be synthesized — requires publisher fix")
            per["needs_upstream"] += 1
            stats["needs_upstream"] += 1
        props.setdefault("x_conformance_notes", []).append(note)

    # --- CWZ payload coverage (reporting only) -----------------------------------
    if core.get("event_type") == "work-zone":
        stats["work_zones"] += 1
        for f in CWZ_PAYLOAD:
            v = props.get(f)
            if v is not None and not (isinstance(v, (list, dict, str)) and len(v) == 0):
                stats["cwz_payload"][f] += 1
    return feat


def build_feed_info(feed, features, args, feed_info_warnings):
    """Synthesize road_event_feed_info, declaring every referenced data source."""
    referenced = collections.Counter()
    latest = {}
    for f in features:
        core = (f.get("properties") or {}).get("core_details") or {}
        sid = core.get("data_source_id")
        if sid is None:
            continue
        referenced[sid] += 1
        ud = core.get("update_date")
        if ud and (sid not in latest or ud > latest[sid]):
            latest[sid] = ud

    # carry any attribution the assembler already recorded, if it is shaped usefully
    attribution = {}
    for entry in (feed.get("_source_attributions") or []):
        if isinstance(entry, dict):
            key = entry.get("data_source_id") or entry.get("id") or entry.get("source")
            if key:
                attribution[key] = entry

    sources = []
    unknown_org, guessed_date = [], []
    for sid, n in referenced.most_common():
        att = attribution.get(sid, {})
        org = (att.get("organization_name") or att.get("organization")
               or att.get("name"))
        if not org:
            org = "UNKNOWN — must be supplied"
            unknown_org.append(str(sid))
        # A source whose features carry no update_date has unknown freshness. Falling
        # back to "now" would assert currency we cannot observe, so flag it loudly.
        if sid not in latest:
            guessed_date.append(str(sid))
        src = {
            "data_source_id": str(sid),
            "organization_name": org,
            "update_date": latest.get(sid) or args.update_date or now_iso(),
        }
        if att.get("contact_name"):
            src["contact_name"] = att["contact_name"]
        if att.get("contact_email"):
            src["contact_email"] = att["contact_email"]
        src["x_feature_count"] = n
        sources.append(src)
    feed_info_warnings["unknown_org"] = unknown_org
    feed_info_warnings["guessed_update_date"] = guessed_date

    info = {
        "feed_info_id": args.feed_info_id or str(uuid.uuid4()),
        "update_date": args.update_date or now_iso(),
        "publisher": args.publisher,
        "version": args.version,
        "update_frequency": args.update_frequency,
        "license": args.license,
        "data_sources": sources,
    }
    if args.contact_name:
        info["contact_name"] = args.contact_name
    if args.contact_email:
        info["contact_email"] = args.contact_email
    return info, referenced


def normalize(feed, args):
    features = feed.get("features") or []
    stats = {
        "features": len(features),
        "work_zones": 0,
        "migrated_fields": 0,
        "paired_flags": 0,
        "fixable_by_measure": 0,
        "fixable_by_snap": 0,
        "needs_upstream": 0,
        "geometry": collections.Counter(),
        "cwz_payload": collections.Counter(),
        "accuracy_unmapped_values": collections.Counter(),
        "by_source": collections.defaultdict(collections.Counter),
        "renamed_members": [],
        "feed_info_warnings": {},
    }

    for feat in features:
        migrate_feature(feat, stats, keep_source_enums=not args.drop_source_enums)

    out = {"type": "FeatureCollection"}

    # --- 1. road_event_feed_info -----------------------------------------------
    if "road_event_feed_info" in feed and not args.force_feed_info:
        out["road_event_feed_info"] = feed["road_event_feed_info"]
        stats["feed_info"] = "preserved"
    else:
        out["road_event_feed_info"], referenced = build_feed_info(
            feed, features, args, stats["feed_info_warnings"])
        stats["feed_info"] = "synthesized"
        stats["declared_sources"] = len(out["road_event_feed_info"]["data_sources"])

    out["features"] = features

    # --- 4. underscore members -> x_ extension convention ------------------------
    for key, value in feed.items():
        if key in ("type", "features", "road_event_feed_info"):
            continue
        new_key = ("x_" + key.lstrip("_")) if key.startswith("_") else key
        if not new_key.startswith("x_"):
            new_key = "x_" + new_key
        out[new_key] = value
        if new_key != key:
            stats["renamed_members"].append(f"{key} -> {new_key}")

    return out, stats


def print_report(stats, args):
    w = sys.stderr if args.out and not args.report_only else sys.stdout
    p = lambda *a: print(*a, file=w)
    g = stats["geometry"]
    n = stats["features"]

    p("")
    p("CWZ 1.0 normalization report")
    p("=" * 66)
    p(f"  features processed          {n}")
    p(f"  road_event_feed_info        {stats['feed_info']}"
      + (f" ({stats.get('declared_sources')} data sources declared)"
         if stats["feed_info"] == "synthesized" else ""))
    for r in stats["renamed_members"]:
        p(f"  renamed member              {r}")
    w_ = stats.get("feed_info_warnings") or {}
    if w_.get("unknown_org"):
        p(f"  !! organization_name unknown — YOU MUST SUPPLY: {', '.join(w_['unknown_org'])}")
    if w_.get("guessed_update_date"):
        p(f"  !! no upstream update_date, freshness unverifiable: {', '.join(w_['guessed_update_date'])}")
    p("")
    p("  FIXED")
    p(f"    accuracy enums migrated to booleans   {stats['migrated_fields']}")
    p(f"    unpaired verification flags completed {stats['paired_flags']}")
    if stats["accuracy_unmapped_values"]:
        p(f"    !! unmapped accuracy values          {dict(stats['accuracy_unmapped_values'])}")
    p("")
    p("  GEOMETRY  (not corrected here — run wzdx_geometry_fix.py)")
    p(f"    already road-following                {g['ok']}")
    p(f"    two-point, fixable by measure         {stats['fixable_by_measure']}  <- exact, uses mileposts")
    p(f"    two-point, fixable by endpoint snap   {stats['fixable_by_snap']}")
    p(f"    zero-length, NEEDS PUBLISHER FIX      {stats['needs_upstream']}")
    if g["missing"]:
        p(f"    missing geometry                      {g['missing']}")
    p("")
    p(f"  CWZ §5.4.2.1 PAYLOAD COVERAGE  (upstream — cannot be synthesized), N={stats['work_zones']}")
    for f in CWZ_PAYLOAD:
        c = stats["cwz_payload"][f]
        pct = (100.0 * c / stats["work_zones"]) if stats["work_zones"] else 0
        p(f"    {f:<26} {c:>6}  {pct:5.1f}%")
    p("")
    p("  BY SOURCE")
    hdr = f"    {'data_source_id':<40}{'total':>7}{'migrated':>10}{'paired':>8}{'geom ok':>9}{'measure':>9}{'snap':>7}{'upstream':>10}"
    p(hdr)
    for src, r in sorted(stats["by_source"].items(), key=lambda kv: -kv[1]["total"]):
        label = str(src)
        if len(label) > 38:
            label = label[:18] + "…" + label[-19:]
        p(f"    {label:<40}{r['total']:>7}{r['migrated']:>10}{r['paired']:>8}"
          f"{r['geom_ok']:>9}{r['fixable_by_measure']:>9}{r['fixable_by_snap']:>7}{r['needs_upstream']:>10}")
    p("")


def main():
    ap = argparse.ArgumentParser(
        description="Normalize an aggregated work-zone GeoJSON to CWZ 1.0 / WZDx 4.1+.")
    ap.add_argument("--in", dest="infile", required=True)
    ap.add_argument("--out", dest="out")
    ap.add_argument("--report-only", action="store_true",
                    help="analyze and report without writing an output feed")
    ap.add_argument("--publisher", default="MITRE iNODE")
    ap.add_argument("--version", default="4.2", help="WZDx base version to declare")
    ap.add_argument("--license", default="https://creativecommons.org/publicdomain/zero/1.0/")
    ap.add_argument("--update-frequency", type=int, default=300, help="seconds")
    ap.add_argument("--update-date", help="ISO 8601; defaults to now")
    ap.add_argument("--feed-info-id", help="stable UUID for this feed; generated if absent")
    ap.add_argument("--contact-name")
    ap.add_argument("--contact-email")
    ap.add_argument("--force-feed-info", action="store_true",
                    help="rebuild road_event_feed_info even if one is present")
    ap.add_argument("--drop-source-enums", action="store_true",
                    help="do not retain migrated legacy values under x_source_accuracy")
    args = ap.parse_args()

    if not args.out and not args.report_only:
        ap.error("need --out, or --report-only")

    with open(args.infile) as fh:
        feed = json.load(fh)
    if feed.get("type") != "FeatureCollection":
        sys.exit(f"not a FeatureCollection: {feed.get('type')!r}")

    out, stats = normalize(feed, args)
    print_report(stats, args)

    if args.out and not args.report_only:
        with open(args.out, "w") as fh:
            json.dump(out, fh)
        print(f"Wrote {args.out} ({stats['features']} features)", file=sys.stderr)
        remaining = stats["fixable_by_measure"] + stats["fixable_by_snap"]
        if remaining:
            print(f"Next: run wzdx_geometry_fix.py over {args.out} to correct "
                  f"{remaining} geometries.", file=sys.stderr)


if __name__ == "__main__":
    main()
