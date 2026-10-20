#!/usr/bin/env python3
"""
wzdx_geometry_fix.py
Correct 2-point ("crow-flies") WZDx work zone geometry into road-following polylines.

Primary mode (recommended for a DOT): CENTERLINE.
  You supply your authoritative routed centerline (e.g., the Caltrans State Highway
  Network, split by direction). For each work zone the tool snaps the begin/end
  points onto the matching centerline, extracts the true road path between them,
  sets the direction, and densifies the result. A closure marked "both" is emitted
  as one geometry per available carriageway.

Fallback mode: MATCH.
  If you only have lat/long endpoints and no centerline handy, the tool routes
  between the endpoints using an OSRM-compatible service (self-hosted OSRM/Valhalla,
  or any /route/v1 endpoint) and uses that road-following geometry.

Only the geometry is changed; every other WZDx field is preserved.

Usage:
  python wzdx_geometry_fix.py --selftest
  python wzdx_geometry_fix.py --input feed.json --output fixed.json \
         --mode centerline --centerline shn_centerline.geojson --epsg 3310
  python wzdx_geometry_fix.py --input feed.json --output fixed.json \
         --mode match --router-url http://localhost:5000

Requires: shapely, pyproj   (pip install shapely pyproj requests)
"""
import argparse, copy, json, math, sys

try:
    from shapely.geometry import shape, mapping, LineString, Point
    from shapely.ops import substring
except ImportError:
    sys.exit("This tool needs shapely.  Install with:  pip install shapely pyproj")
try:
    from pyproj import Transformer
except ImportError:
    sys.exit("This tool needs pyproj.  Install with:  pip install shapely pyproj")

DIRMAP = {"northbound":"N","southbound":"S","eastbound":"E","westbound":"W",
          "nb":"N","sb":"S","eb":"E","wb":"W","n":"N","s":"S","e":"E","w":"W"}

def norm_dir(s):
    if not s: return None
    return DIRMAP.get(str(s).strip().lower())

def transformers(epsg):
    to_p = Transformer.from_crs(4326, epsg, always_xy=True).transform
    to_g = Transformer.from_crs(epsg, 4326, always_xy=True).transform
    return to_p, to_g

def proj_line(coords, to_p):
    return LineString([to_p(x, y) for x, y, *_ in coords])

def is_two_point(geom):
    if geom["type"] == "LineString":
        return len(geom["coordinates"]) <= 2
    if geom["type"] == "MultiLineString":
        return all(len(ln) <= 2 for ln in geom["coordinates"])
    return False

def endpoints_proj(geom, to_p):
    if geom["type"] == "LineString":
        c = geom["coordinates"]
    else:  # MultiLineString
        c = [pt for ln in geom["coordinates"] for pt in ln]
    return Point(to_p(*c[0][:2])), Point(to_p(*c[-1][:2]))

def densify(line, spacing_m):
    if spacing_m <= 0:
        return line
    out = [line.coords[0]]
    for a, b in zip(line.coords, line.coords[1:]):
        seg = LineString([a, b]); d = seg.length
        if d > spacing_m:
            for i in range(1, int(d // spacing_m) + 1):
                p = seg.interpolate(i * spacing_m); out.append((p.x, p.y))
        out.append(b)
    return LineString(out)

def to_wgs84_linestring(line, to_g, ndigits=6):
    return {"type": "LineString",
            "coordinates": [[round(v, ndigits) for v in to_g(x, y)] for x, y in line.coords]}

# ---------------- CENTERLINE MODE ----------------
def load_centerlines(path, to_p, dir_field):
    """Return list of (projected_LineString, normalized_direction)."""
    fc = json.load(open(path))
    out = []
    for f in fc.get("features", []):
        g = f.get("geometry") or {}
        props = f.get("properties") or {}
        d = norm_dir(props.get(dir_field)) if dir_field else None
        if g.get("type") == "LineString":
            out.append((proj_line(g["coordinates"], to_p), d))
        elif g.get("type") == "MultiLineString":
            for ln in g["coordinates"]:
                out.append((proj_line(ln, to_p), d))
    if not out:
        sys.exit("No usable centerline geometry found in " + path)
    return out

def correct_via_centerline(p0, p1, centerlines, want_dir, max_snap_m):
    """Snap endpoints to the best-matching centerline and cut the sub-line."""
    straight = LineString([(p0.x, p0.y), (p1.x, p1.y)])
    best = None; best_cost = None
    for ln, d in centerlines:
        if want_dir and d and d != want_dir:
            continue
        if ln.distance(straight) > max_snap_m:
            continue
        cost = ln.distance(p0) + ln.distance(p1)
        if best_cost is None or cost < best_cost:
            best_cost, best = cost, (ln, d)
    if best is None:
        return None
    ln, d = best
    a, b = ln.project(p0), ln.project(p1)
    if a > b: a, b = b, a
    seg = substring(ln, a, b)
    if seg.is_empty or seg.length == 0:
        return None
    return seg, d

# ---------------- MATCH MODE (OSRM-compatible fallback) ----------------
def correct_via_router(coords_wgs, router_url):
    import requests
    lonlat = ";".join(f"{c[0]},{c[1]}" for c in coords_wgs)
    url = f"{router_url.rstrip('/')}/route/v1/driving/{lonlat}"
    r = requests.get(url, params={"overview": "full", "geometries": "geojson", "continue_straight": "true"}, timeout=20)
    r.raise_for_status()
    js = r.json()
    if js.get("code") != "Ok" or not js.get("routes"):
        return None
    return js["routes"][0]["geometry"]  # already WGS84 GeoJSON LineString

# ---------------- feed processing (cascading fallback) ----------------
def _fix_from_centerline(feat, geom, centerlines, to_p, to_g, opts):
    """Return list of corrected features from a centerline source, or [] on no match."""
    cd = (feat.get("properties") or {}).get("core_details", {}) or {}
    want = norm_dir(cd.get("direction"))
    both = str(cd.get("direction", "")).strip().lower() == "both"
    p0, p1 = endpoints_proj(geom, to_p)
    targets = sorted({d for _, d in centerlines if d}) if both else [want if want else None]
    made = []
    for tdir in targets:
        res = correct_via_centerline(p0, p1, centerlines, tdir, opts["max_snap_m"])
        if not res:
            continue
        seg, used_dir = res
        seg = densify(seg, opts["spacing_m"])
        nf = copy.deepcopy(feat)
        nf["geometry"] = to_wgs84_linestring(seg, to_g)
        if used_dir and both:
            nf["properties"]["core_details"]["direction"] = \
                {"N": "northbound", "S": "southbound", "E": "eastbound", "W": "westbound"}[used_dir]
        made.append(nf)
    return made

def _fix_from_router(feat, geom, opts):
    coords = geom["coordinates"] if geom["type"] == "LineString" else geom["coordinates"][0]
    newg = correct_via_router([coords[0], coords[-1]], opts["router_url"])
    if not newg:
        return []
    nf = copy.deepcopy(feat); nf["geometry"] = newg
    return [nf]

def process(feed, order, opts):
    """order: list of sources to try in turn, e.g. ['state','arnold','osrm']."""
    to_p, to_g = transformers(opts["epsg"])
    sets = {}
    if "state" in order and opts.get("centerline"):
        sets["state"] = load_centerlines(opts["centerline"], to_p, opts["dir_field"])
    if "arnold" in order and opts.get("arnold"):
        sets["arnold"] = load_centerlines(opts["arnold"], to_p, opts["dir_field"])
    active = [s for s in order if s == "osrm" and opts.get("router_url")] + \
             [s for s in order if s in sets]
    active = [s for s in order if (s in sets) or (s == "osrm" and opts.get("router_url"))]
    if not active:
        sys.exit("No usable sources. Provide --centerline (state), --arnold, and/or --router-url.")

    out_feats = []
    stats = {"total": 0, "two_point": 0, "corrected": 0, "multi_dir": 0, "skipped": 0,
             "by_source": {s: 0 for s in active}}
    for feat in feed.get("features", []):
        stats["total"] += 1
        geom = feat.get("geometry") or {}
        if geom.get("type") not in ("LineString", "MultiLineString") or not is_two_point(geom):
            out_feats.append(feat); continue
        stats["two_point"] += 1
        made, used = [], None
        for src in active:                       # cascade: first source that resolves wins
            if src in ("state", "arnold"):
                made = _fix_from_centerline(feat, geom, sets[src], to_p, to_g, opts)
            elif src == "osrm":
                made = _fix_from_router(feat, geom, opts)
            if made:
                used = src; break
        if not made:
            out_feats.append(feat); stats["skipped"] += 1
            continue
        if opts.get("tag_source"):
            for nf in made:
                nf.setdefault("properties", {})["x_geometry_source"] = used
        out_feats.append(made[0] if len(made) == 1 else made[0])
        for extra in made[1:]:
            out_feats.append(extra)
        stats["corrected"] += 1
        stats["by_source"][used] += 1
        if len(made) > 1:
            stats["multi_dir"] += 1
    out = copy.deepcopy(feed); out["features"] = out_feats
    return out, stats

# ---------------- LCS (Lane Closure System) reader: route + postmile + direction ----------------
def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def parse_lcs(path, fmt, fmap):
    """Read an LCS export (CSV or JSON) into normalized closure records."""
    import csv
    if fmt == "csv":
        with open(path, newline="") as f:
            rows = list(csv.DictReader(f))
    else:
        data = json.load(open(path))
        rows = data if isinstance(data, list) else (data.get("features") or data.get("closures") or data.get("data") or [])
        rows = [(r.get("properties") if isinstance(r, dict) and "properties" in r else r) for r in rows]
    recs = []
    for r in rows:
        gg = lambda k: r.get(fmap[k]) if fmap.get(k) else None
        recs.append({
            "route": gg("route"), "direction": gg("direction"),
            "begin_pm": _num(gg("begin_pm")), "end_pm": _num(gg("end_pm")),
            "begin_lon": _num(gg("begin_lon")), "begin_lat": _num(gg("begin_lat")),
            "end_lon": _num(gg("end_lon")), "end_lat": _num(gg("end_lat")),
            "raw": r})
    return recs

def build_route_index(path, to_p, route_field, dir_field, pmb_field, pme_field):
    """Merge a postmile-attributed centerline into calibrated per-(route,direction) lines."""
    fc = json.load(open(path)); groups = {}
    for feat in fc.get("features", []):
        g = feat.get("geometry") or {}; props = feat.get("properties") or {}
        route = str(props.get(route_field)); d = norm_dir(props.get(dir_field))
        pmb = _num(props.get(pmb_field)); pme = _num(props.get(pme_field))
        if pmb is None or pme is None:
            continue
        lines = [g["coordinates"]] if g.get("type") == "LineString" else (g["coordinates"] if g.get("type") == "MultiLineString" else [])
        for ln in lines:
            groups.setdefault((route, d), []).append((pmb, pme, proj_line(ln, to_p)))
    index = {}
    for key, segs in groups.items():
        segs.sort(key=lambda s: min(s[0], s[1]))
        coords = []
        for pmb, pme, line in segs:
            c = list(line.coords)
            if coords and c and math.dist(coords[-1], c[0]) < 1.0:
                c = c[1:]
            coords.extend(c)
        if len(coords) < 2:
            continue
        merged = LineString(coords)
        calib = []
        for pmb, pme, line in segs:
            ds = merged.project(Point(line.coords[0])); de = merged.project(Point(line.coords[-1]))
            calib.append((pmb, pme, ds, de))
        index[key] = {"line": merged, "calib": calib}
    return index

def locate_pm(entry, pm):
    for pmb, pme, ds, de in entry["calib"]:
        lo, hi = sorted((pmb, pme))
        if lo <= pm <= hi:
            frac = 0.0 if pme == pmb else (pm - pmb) / (pme - pmb)
            return ds + frac * (de - ds)
    return None

def pm_correct(rec, index, to_g, opts):
    """Build road-following feature(s) directly from route + begin/end postmile."""
    route = str(rec["route"]); both = str(rec["direction"] or "").strip().lower() == "both"
    dirs = [norm_dir(rec["direction"])] if not both else sorted({d for (rt, d) in index if rt == route and d})
    made = []
    for d in dirs:
        entry = index.get((route, d))
        if not entry:
            continue
        a, b = locate_pm(entry, rec["begin_pm"]), locate_pm(entry, rec["end_pm"])
        if a is None or b is None:
            continue
        if a > b: a, b = b, a
        seg = substring(entry["line"], a, b)
        if seg.is_empty or seg.length == 0:
            continue
        seg = densify(seg, opts["spacing_m"])
        dir_word = {"N": "northbound", "S": "southbound", "E": "eastbound", "W": "westbound"}.get(d, rec["direction"])
        made.append({"type": "Feature",
                     "properties": {"core_details": {"data_source_id": "lcs", "event_type": "work-zone",
                                                     "road_names": [route], "direction": dir_word},
                                    **({"x_geometry_source": "state-pm"} if opts.get("tag_source") else {})},
                     "geometry": to_wgs84_linestring(seg, to_g)})
    return made

def lcs_to_2point(rec):
    """When LCS has coordinates but no usable PM, emit a 2-point feature for the cascade."""
    if None in (rec["begin_lon"], rec["begin_lat"], rec["end_lon"], rec["end_lat"]):
        return None
    return {"type": "Feature",
            "properties": {"core_details": {"data_source_id": "lcs", "event_type": "work-zone",
                                            "road_names": [str(rec["route"])], "direction": rec["direction"]}},
            "geometry": {"type": "LineString",
                         "coordinates": [[rec["begin_lon"], rec["begin_lat"]], [rec["end_lon"], rec["end_lat"]]]}}

# ---------------- CIFS (Common Incident Feed Specification) output for Google/Waze ----------------
def wzdx_to_cifs(feed):
    """Convert corrected WZDx features to a CIFS incidents XML feed (string, count)."""
    from xml.sax.saxutils import escape
    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<incidents>"]
    n = 0
    for f in feed.get("features", []):
        g = f.get("geometry") or {}
        if g.get("type") == "LineString":
            coords = g["coordinates"]
        elif g.get("type") == "MultiLineString":
            coords = [c for ln in g["coordinates"] for c in ln]
        else:
            continue
        cd = (f.get("properties") or {}).get("core_details", {}) or {}
        iid = f.get("id") or f"{cd.get('data_source_id', 'wz')}-{n}"
        street = (cd.get("road_names") or [""])[0]
        poly = " ".join(f"{c[1]} {c[0]}" for c in coords)  # CIFS is "lat lng" pairs
        cifs_dir = "BOTH_DIRECTIONS" if str(cd.get("direction", "")).lower() == "both" else "ONE_DIRECTION"
        start = cd.get("start_date") or cd.get("start_time")
        end = cd.get("end_date") or cd.get("end_time")
        upd = cd.get("update_date")
        desc = cd.get("description") or (f"{street} work zone".strip())
        out.append(f'  <incident id="{escape(str(iid))}">')
        out.append("    <type>CONSTRUCTION</type>")
        out.append(f"    <description>{escape(str(desc))}</description>")
        out.append("    <location>")
        if street:
            out.append(f"      <street>{escape(str(street))}</street>")
        out.append(f"      <direction>{cifs_dir}</direction>")
        out.append(f"      <polyline>{poly}</polyline>")
        out.append("    </location>")
        if start: out.append(f"    <starttime>{escape(str(start))}</starttime>")
        if end:   out.append(f"    <endtime>{escape(str(end))}</endtime>")
        if upd:   out.append(f"    <updatetime>{escape(str(upd))}</updatetime>")
        out.append("  </incident>")
        n += 1
    out.append("</incidents>")
    return "\n".join(out), n

# ---------------- self test ----------------
def selftest():
    import tempfile, os
    to_p, to_g = transformers(3310)
    # a curved centerline (WGS84) roughly following a bend near Sacramento
    base_lon, base_lat = -121.49, 38.58
    cl = [[base_lon + i*0.01, base_lat + 0.02*math.sin(i/2.0)] for i in range(12)]
    centerline_fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"route": "SR-99", "direction": "northbound"},
         "geometry": {"type": "LineString", "coordinates": cl}}]}
    # a 2-point (straight) work zone spanning part of that bend
    feed = {"type": "FeatureCollection", "features": [
        {"type": "Feature",
         "properties": {"core_details": {"direction": "northbound", "road_names": ["SR-99"]}},
         "geometry": {"type": "LineString", "coordinates": [cl[2], cl[8]]}}]}
    d = tempfile.mkdtemp()
    clp = os.path.join(d, "cl.geojson"); json.dump(centerline_fc, open(clp, "w"))
    out, stats = process(feed, ["state", "arnold", "osrm"],
                         {"centerline": clp, "epsg": 3310, "dir_field": "direction",
                          "max_snap_m": 200, "spacing_m": 10})
    corrected = out["features"][0]["geometry"]["coordinates"]
    straight_pts = 2
    straight_len = LineString([to_p(*cl[2]), to_p(*cl[8])]).length
    fixed_line = LineString([to_p(x, y) for x, y in corrected])
    print("SELFTEST")
    print("  stats:", stats)
    print(f"  vertices: {straight_pts} (straight) -> {len(corrected)} (corrected)")
    print(f"  length:   {straight_len:.0f} m (straight) -> {fixed_line.length:.0f} m (road-following)")
    ok = len(corrected) > 5 and fixed_line.length >= straight_len
    print("  RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1

def main():
    ap = argparse.ArgumentParser(description="Correct 2-point WZDx work zone geometry into road-following polylines.")
    ap.add_argument("--selftest", action="store_true", help="run a built-in synthetic test and exit")
    ap.add_argument("--input"); ap.add_argument("--output")
    ap.add_argument("--fallback-order", default="state,arnold,osrm",
                    help="cascade order; first source that resolves a work zone wins "
                         "(default: state,arnold,osrm). Use e.g. state,osrm,arnold to prefer OSRM before ARNOLD.")
    ap.add_argument("--centerline", help="STATE authoritative routed centerline GeoJSON (source: state)")
    ap.add_argument("--arnold", help="ARNOLD national LRS centerline GeoJSON (source: arnold)")
    ap.add_argument("--router-url", help="OSRM-compatible base URL (source: osrm)")
    ap.add_argument("--dir-field", default="direction", help="centerline property holding direction")
    ap.add_argument("--epsg", type=int, default=3310, help="projected CRS for distance ops (default 3310 CA Albers)")
    ap.add_argument("--max-snap-m", type=float, default=200.0, help="max endpoint-to-centerline snap distance")
    ap.add_argument("--spacing-m", type=float, default=10.0, help="densify vertex spacing (0 = keep native)")
    ap.add_argument("--tag-source", action="store_true",
                    help="record which source fixed each event in properties.x_geometry_source")
    # LCS input (route + postmile + direction), zero coordinate prep
    ap.add_argument("--lcs", help="Lane Closure System export to read instead of a WZDx feed")
    ap.add_argument("--lcs-format", choices=["csv", "json"], default="csv")
    ap.add_argument("--f-route", default="route"); ap.add_argument("--f-direction", default="direction")
    ap.add_argument("--f-begin-pm", default="begin_pm"); ap.add_argument("--f-end-pm", default="end_pm")
    ap.add_argument("--f-begin-lon", default="begin_lon"); ap.add_argument("--f-begin-lat", default="begin_lat")
    ap.add_argument("--f-end-lon", default="end_lon"); ap.add_argument("--f-end-lat", default="end_lat")
    ap.add_argument("--route-field", default="route", help="centerline property: route id (PM locate)")
    ap.add_argument("--pm-begin-field", default="pm_b", help="centerline property: begin postmile")
    ap.add_argument("--pm-end-field", default="pm_e", help="centerline property: end postmile")
    # CIFS output for Google/Waze
    ap.add_argument("--cifs-out", help="also write a CIFS incidents XML feed to this path")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not a.output or not (a.input or a.lcs):
        ap.error("need --output plus either --input (WZDx feed) or --lcs (LCS export); or use --selftest")
    order = [s.strip().lower() for s in a.fallback_order.split(",") if s.strip()]
    opts = {"centerline": a.centerline, "arnold": a.arnold, "router_url": a.router_url,
            "epsg": a.epsg, "dir_field": a.dir_field, "max_snap_m": a.max_snap_m,
            "spacing_m": a.spacing_m, "tag_source": a.tag_source}

    if a.lcs:
        if not a.centerline:
            ap.error("--lcs needs --centerline (postmile-attributed) to locate closures")
        fmap = {"route": a.f_route, "direction": a.f_direction, "begin_pm": a.f_begin_pm, "end_pm": a.f_end_pm,
                "begin_lon": a.f_begin_lon, "begin_lat": a.f_begin_lat, "end_lon": a.f_end_lon, "end_lat": a.f_end_lat}
        recs = parse_lcs(a.lcs, a.lcs_format, fmap)
        to_p, to_g = transformers(a.epsg)
        index = build_route_index(a.centerline, to_p, a.route_field, a.dir_field, a.pm_begin_field, a.pm_end_field)
        direct, twopt = [], []
        for rec in recs:
            if rec["begin_pm"] is not None and rec["end_pm"] is not None and index:
                fs = pm_correct(rec, index, to_g, opts)
                if fs:
                    direct += fs; continue
            fp = lcs_to_2point(rec)
            if fp: twopt.append(fp)
        feed = {"type": "FeatureCollection", "features": twopt}
        out, stats = process(feed, order, opts)         # cascade for any coordinate-only rows
        out["features"] += direct                        # PM-located rows already road-following
        stats["lcs_records"] = len(recs); stats["lcs_pm_direct"] = len(direct)
    else:
        if not any([a.centerline, a.arnold, a.router_url]):
            ap.error("provide at least one source: --centerline (state), --arnold, and/or --router-url")
        feed = json.load(open(a.input))
        out, stats = process(feed, order, opts)

    json.dump(out, open(a.output, "w"))
    print("Wrote", a.output, "(%d features)" % len(out["features"]))
    print("Stats:", stats)
    if a.cifs_out:
        xml, ncifs = wzdx_to_cifs(out)
        open(a.cifs_out, "w").write(xml)
        print("Wrote", a.cifs_out, "(%d CIFS incidents)" % ncifs)

if __name__ == "__main__":
    main()
