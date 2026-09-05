import json, re, math, urllib.request, urllib.parse, ssl, concurrent.futures as cf, sys
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
def get(u,t=30):
    try:
        req=urllib.request.Request(u, headers={'User-Agent':'Mozilla/5.0'})
        return json.load(urllib.request.urlopen(req,timeout=t,context=ctx))
    except Exception as e: return {"_err":str(e)[:90]}

# name score: prefer state-maintained route centrelines / LRS / ARNOLD
GOOD=[(r'state[_ ]?maintained.*(road|route|highway)',10),(r'\bARNOLD\b',9),(r'\bLRS\b',9),
      (r'state[_ ]?(route|highway)',8),(r'roadway[_ ]?network',7),(r'road[_ ]?network',7),
      (r'^Routes(_|$)',7),(r'primary_SHS|SHS',7),(r'\bhighways?$',6),(r'all[_ ]?roads',5),(r'centerline',5)]
def score(n):
    s=0
    for p,w in GOOD:
        if re.search(p,n,re.I): s=max(s,w)
    if re.search(r'rail|bike|hydro|historic|scenic|broadband|snowmobile|light|park|transit|truck|freight|buffer|adopt',n,re.I): s-=6
    return s

def layers_of(svc):
    j=get(svc+"?f=json",25)
    lays=j.get("layers") if "_err" not in j else None
    if not lays:                                  # some ArcGIS Server versions omit it at the root
        j2=get(svc+"/layers?f=json",25)
        lays=j2.get("layers") if "_err" not in j2 else None
    if not lays: return []
    out=[]
    for l in lays:
        gt=l.get("geometryType")
        if gt in (None,"esriGeometryPolyline"):
            out.append((l["id"], l.get("name","")))
    return out[:6]

def hits(qurl, lat, lon, tol_m):
    d=0.02
    bb=f"{lon-d},{lat-d},{lon+d},{lat+d}"
    u=(qurl+"?where=1%3D1&geometry="+urllib.parse.quote(bb)+
       "&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects"
       "&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=400&f=json")
    j=get(u,30)
    if "_err" in j or "features" not in j: return None
    k=math.cos(lat*math.pi/180)*111320; k2=110540
    best=1e9
    for f in j["features"]:
        for pa in (f.get("geometry") or {}).get("paths",[]):
            for i in range(1,len(pa)):
                ax=(pa[i-1][0]-lon)*k; ay=(pa[i-1][1]-lat)*k2
                bx=(pa[i][0]-lon)*k;   by=(pa[i][1]-lat)*k2
                dx=bx-ax; dy=by-ay; l2=dx*dx+dy*dy or 1e-9
                t=max(0,min(1,-(ax*dx+ay*dy)/l2))
                best=min(best, math.hypot(ax+t*dx, ay+t*dy))
    return best

cands=json.load(open("centerline_candidates.json"))
markers=json.load(open("markers.json"))
res={}
def work(st):
    if st not in markers or not markers[st]: return st,{"err":"no markers"}
    pts=markers[st][:6]
    ranked=cands.get(st,{}).get("cands",[])[:4]   # already relevance-ranked by find2.py
    out=[]
    for svc in ranked:
        for lid,lname in layers_of(svc)[:2]:
            q=f"{svc}/{lid}/query"
            on=[]; off=[]
            for p in pts:
                d=hits(q,p["lat"],p["lon"],60)
                if d is not None: on.append(d)
                # off-route probe: 700 m east
                olon=p["lon"]+700/(math.cos(p["lat"]*math.pi/180)*111320)
                d2=hits(q,p["lat"],olon,60)
                if d2 is not None: off.append(d2)
            if not on: continue
            onHit=sum(1 for d in on if d<=60)/len(on)
            offHit=(sum(1 for d in off if d<=60)/len(off)) if off else None
            out.append({"svc":svc,"layer":lid,"name":lname,
                        "onRouteHitRate":round(onHit,2),
                        "offRouteHitRate":(round(offHit,2) if offHit is not None else None),
                        "medianOn":round(sorted(on)[len(on)//2],1)})
    return st,{"err":None,"tested":out}
sts=list(markers.keys())
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    for st,v in ex.map(work, sts): res[st]=v
json.dump(res,open("centerline_verified.json","w"),indent=1)
for st,v in res.items():
    print(f"\n=== {st} {v.get('err') or ''}")
    for t in v.get("tested",[]):
        print(f"   on={t['onRouteHitRate']:.2f} off={t['offRouteHitRate']} med={t['medianOn']}m  {t['name'] or t['svc'].split('/')[-2]}")
