#!/usr/bin/env python3
"""
id-stability pass: single-snapshot check for road-event ids that embed a
rendered mutable field (e.g. _N vs _North) in a trailing segment.

Method: collapse the suspected volatile tail, count distinct ids per stem.
A stem carrying several ids is one subject possibly wearing several names.

Rejection rules (each one exists because the naive version was wrong):
  1. Only a year-anchored run (19xx/20xx) is stripped as a timestamp.
     A bare 2-4 digit run is usually a real key part (segment no.).
  2. The tail must read as a rendered word: letters only, <= 20 chars.
     A purely numeric tail (7409-1 / 7409-2) is a real key part, left alone.
  3. The stem must carry identity of its own (>= 8 chars), so a namespace
     prefix (AZTech.Mesa-mTrac29854) is not mistaken for a stem.
  4. A plain stem collision is a SUSPICION (direction splits are correct
     producer behaviour). Only a PREFIX PAIR -- one tail that is a prefix
     of another on the same stem -- is a FINDING.
  5. A feed whose ids cannot be located reports NO IDS AT ALL, never clean.
  6. A feed that cannot be PARSED says so too. An HTTP 200 carrying an HTML
     error page is not a feed, and must not crash (a traceback in a sweep
     reads as noise) nor exit 0 (which reads as a pass).

THE HALF THIS PASS CANNOT SEE. Collapsing a tail finds a producer that
renders one subject under several names AT THE SAME INSTANT. It is blind
to a producer whose ids change BETWEEN refreshes -- re-minted, or rebuilt
from state that moved -- because at any single instant that feed looks
immaculate. Iowa is the worked example: zero prefix pairs, and yet six
events in eighteen hours replaced every id they had. Their id embeds the
event's current segmentation, so re-segmenting a zone re-identifies it.

  snapshot  -> `snapshot <feed>`              (this pass)
  over time -> `snapshot <feed> --save d/`    (then, later)
               `compare d/`

Both are needed. Reading one pass's silence as a clean bill is the same
error as reading an unevaluable feed as a clean one.

stdlib only.
usage:
  check_id_stability.py <file.json|url> [label] [--save DIR]
  check_id_stability.py compare DIR [--key REGEX]
"""
import json, re, sys, urllib.request, collections

TS = re.compile(r'[-_.](19|20)\d{2}([-_.]\d{1,2}){2,5}$')
DELIM = re.compile(r'[-_.]')
WORD = re.compile(r'^[A-Za-z]+$')

class Unevaluable(Exception):
    """The input is not a feed we can read. Never a pass, never a crash."""

def load(src):
    try:
        if src.startswith('http'):
            req = urllib.request.Request(src, headers={'User-Agent': 'id-stability/1.0'})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
        else:
            raw = open(src, 'rb').read()
    except Exception as e:
        raise Unevaluable(f"could not fetch: {e}")
    head = raw.lstrip()[:200].decode('utf-8', 'replace')
    if head[:1] in ('<',):
        raise Unevaluable("payload is markup, not JSON -- an error page served as a feed"
                          f" (starts: {head[:60]!r})")
    try:
        doc = json.loads(raw)
    except Exception as e:
        raise Unevaluable(f"payload is not valid JSON: {e} (starts: {head[:60]!r})")
    if not isinstance(doc, dict) or 'features' not in doc:
        raise Unevaluable(f"payload is JSON but not a FeatureCollection (starts: {head[:60]!r})")
    return doc

def get_id(feat):
    for v in (feat.get('id'),
              feat.get('properties', {}).get('id'),
              feat.get('properties', {}).get('Id'),
              feat.get('properties', {}).get('core_details', {}).get('id')):
        if isinstance(v, (str, int)) and str(v).strip():
            return str(v).strip()
    return None

def stem_of(rid):
    """Return (stem, tail) if the id has a collapsible rendered tail, else (None, None)."""
    base = TS.sub('', rid)
    parts = DELIM.split(base)
    if len(parts) < 2:
        return None, None
    tail = parts[-1]
    stem = base[:len(base) - len(tail) - 1]
    if not WORD.match(tail):        # rule 2: numeric / mixed tails are real key parts
        return None, None
    if len(tail) > 20:              # rule 2: a long tail is not a rendered enum
        return None, None
    if len(stem) < 8:               # rule 3: a namespace prefix is not a stem
        return None, None
    return stem, tail

def run(src, label):
    print(f"\n=== {label}")
    try:
        doc = load(src)
    except Unevaluable as e:
        print(f"COULD NOT BE EVALUATED -- {e}")
        print("THIS RESULT IS NOT CLEAN. It is unknown.")
        return 3
    feats = doc.get('features') or []
    ids, anon = [], 0
    for f in feats:
        rid = get_id(f)
        if rid: ids.append(rid)
        else:   anon += 1

    print(f"road events: {len(feats)}   ids found: {len(ids)}   no identifier: {anon}")

    if not ids:
        print("NO IDS AT ALL -- this feed could not be evaluated.")
        print("THIS RESULT IS NOT CLEAN. It is unknown.")
        return 2

    stems = collections.defaultdict(set)
    collapsed = 0
    for rid in set(ids):
        s, t = stem_of(rid)
        if s:
            stems[s].add((rid, t))
            collapsed += 1

    coll = {s: v for s, v in stems.items() if len(v) > 1}
    findings = []
    for s, v in coll.items():
        tails = sorted({t.lower() for _, t in v})
        for i, a in enumerate(tails):
            for b in tails[i+1:]:
                if b.startswith(a):
                    findings.append((s, a, b))

    print(f"ids with a collapsible rendered tail: {collapsed} of {len(set(ids))} distinct")
    print(f"stem collisions (SUSPICION): {len(coll)}")
    print(f"prefix pairs  (FINDING):     {len(findings)}")
    for s, a, b in findings[:20]:
        print(f"   FINDING  {s}  carries  _{a}  and  _{b}")
    for s, v in list(coll.items())[:8]:
        print(f"   suspicion {s} -> {sorted(t for _, t in v)}")
    if collapsed == 0:
        print("No id in this feed has a rendered trailing word.")
        print("Nothing to collapse: this defect class does not apply here.")
    return 1 if findings else 0

# ---------------------------------------------------------------- over time

# The stable part of an id: what still names the same real-world subject after
# the volatile part has moved. Default fits OpenTMS (`...-3`, `...-3-NB`); any
# producer whose key is shaped differently passes its own --key.
DEFAULT_KEY = r'^(.*?)(?:-\d+)?(?:-(?:NB|SB|EB|WB|N|S|E|W))?$'

def snapshot_ids(src):
    doc = load(src)
    out, anon = [], 0
    for f in doc.get('features') or []:
        rid = get_id(f)
        if rid: out.append(rid)
        else:   anon += 1
    return doc, out, anon

def save_snapshot(directory, src, ids, feed_update):
    import os, datetime
    os.makedirs(directory, exist_ok=True)
    ts = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    path = os.path.join(directory, f'ids_{ts}.txt')
    with open(path, 'w') as o:
        o.write(f'#source {src}\n#update_date {feed_update}\n')
        for i in sorted(set(ids)): o.write(i + '\n')
    print(f'\nsnapshot saved: {path}')
    return path

def read_snapshot(path):
    meta, ids = {}, set()
    for line in open(path):
        line = line.rstrip('\n')
        if line.startswith('#'):
            k, _, v = line[1:].partition(' '); meta[k] = v
        elif line: ids.add(line)
    return meta, ids

def compare(directory, keyre=DEFAULT_KEY):
    """Re-identification: the subject stayed, its ids did not."""
    import glob
    key = re.compile(keyre)
    def subj(i):
        m = key.match(i)
        return m.group(1) if m else i
    files = sorted(glob.glob(f'{directory.rstrip("/")}/ids_*.txt'))
    if len(files) < 2:
        print(f'COULD NOT BE EVALUATED -- need 2+ snapshots in {directory}, found {len(files)}.')
        print('THIS RESULT IS NOT CLEAN. It is unknown.')
        return 3
    snaps = []
    for f in files:
        meta, ids = read_snapshot(f)
        d = collections.defaultdict(set)
        for i in ids: d[subj(i)].add(i)
        snaps.append((f.split('ids_')[-1][:-4], meta.get('update_date','?'), ids, d))

    print(f'\n=== between-refresh comparison: {len(snaps)} snapshots')
    print(f'{"snapshot (UTC)":18} {"feed update_date":22} {"ids":>6} {"lost":>5} {"new":>5}  re-identified')
    total = collections.OrderedDict()
    for n, (t, ud, ids, d) in enumerate(snaps):
        if n == 0:
            print(f'{t:18} {ud:22} {len(ids):6} {"-":>5} {"-":>5}  -'); continue
        pt, pud, pids, pd = snaps[n-1]
        # a subject in BOTH snapshots whose id set was wholly replaced
        reid = [s for s in set(pd) & set(d) if pd[s] != d[s] and not (pd[s] & d[s])]
        for s in reid: total.setdefault(s, (sorted(pd[s]), sorted(d[s])))
        print(f'{t:18} {ud:22} {len(ids):6} {len(pids-ids):5} {len(ids-pids):5}  '
              f'{len(reid) or "none"}')

    a, b = snaps[0], snaps[-1]
    # ids destroyed while their subject carried on -- the number that bites a consumer
    destroyed = set()
    for s in set(a[3]) & set(b[3]):
        if a[3][s] != b[3][s]: destroyed |= (a[3][s] - b[3][s])
    print(f'\nspan {a[0]} -> {b[0]}')
    print(f'ids present in both first and last:            {len(a[2] & b[2])} of {len(a[2])}')
    print(f'ids destroyed while their subject remained:    {len(destroyed)}')
    print(f'subjects RE-IDENTIFIED (every id replaced):    {len(total)}')
    if not total:
        print('\nNo subject in this window was re-identified.')
        print('That is clean FOR THIS WINDOW ONLY -- a slower producer needs a longer one.')
        return 0
    print('\nFINDING -- these kept their subject and threw away every id naming it:')
    for s, (was, now) in list(total.items())[:20]:
        print(f'   {s}')
        print(f'      was ({len(was)}): {was[:3]}{" ..." if len(was)>3 else ""}')
        print(f'      now ({len(now)}): {now[:3]}{" ..." if len(now)>3 else ""}')
    return 1

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print(__doc__.strip()); sys.exit(2)
    if args[0] == 'compare':
        if len(args) < 2: print('usage: check_id_stability.py compare DIR [--key REGEX]'); sys.exit(2)
        kv = args[args.index('--key')+1] if '--key' in args else DEFAULT_KEY
        sys.exit(compare(args[1], kv))
    save = None
    if '--save' in args:
        i = args.index('--save'); save = args[i+1]; del args[i:i+2]
    src = args[0]
    label = args[1] if len(args) > 1 else src
    rc = run(src, label)
    if save is not None and rc in (0, 1):
        try:
            doc, ids, _ = snapshot_ids(src)
            save_snapshot(save, src, ids,
                          (doc.get('road_event_feed_info') or {}).get('update_date'))
        except Unevaluable as e:
            print(f'not saved -- {e}')
    sys.exit(rc)
