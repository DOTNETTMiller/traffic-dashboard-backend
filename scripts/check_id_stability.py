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

stdlib only. usage: id_stability.py <file.json|url> [label]
"""
import json, re, sys, urllib.request, collections

TS = re.compile(r'[-_.](19|20)\d{2}([-_.]\d{1,2}){2,5}$')
DELIM = re.compile(r'[-_.]')
WORD = re.compile(r'^[A-Za-z]+$')

def load(src):
    if src.startswith('http'):
        req = urllib.request.Request(src, headers={'User-Agent': 'id-stability/1.0'})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    with open(src) as f:
        return json.load(f)

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
    doc = load(src)
    feats = doc.get('features') or []
    ids, anon = [], 0
    for f in feats:
        rid = get_id(f)
        if rid: ids.append(rid)
        else:   anon += 1

    print(f"\n=== {label}")
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

if __name__ == '__main__':
    sys.exit(run(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]))
