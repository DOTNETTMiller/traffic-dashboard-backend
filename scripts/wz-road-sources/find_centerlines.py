import json,re,urllib.request,ssl,concurrent.futures as cf
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
def get(u,t=25):
    try:
        r=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
        return json.load(urllib.request.urlopen(r,timeout=t,context=ctx))
    except Exception as e: return {"_err":str(e)[:80]}
PAT=re.compile(r'road|route|centerline|center_line|linear|lrs|highway|network|arnold|rte|shn|shs|street',re.I)
GOOD=[(r'state[_ ]?maintained.*(road|route|highway)',10),(r'\bARNOLD\b',10),(r'\bLRS\b',10),
      (r'statewide[_ ]?(route|road|highway)',10),(r'state[_ ]?(route|highway)[_ ]?(network|system|lines?)?',9),
      (r'\bSHN\b|\bSHS\b',9),(r'roadway[_ ]?network',8),(r'road[_ ]?network',8),(r'county[_ ]?log',8),
      (r'^Routes?(_|$)',7),(r'^Highways?(_|$)',7),(r'all[_ ]?roads',6),(r'centerline',6),(r'linear[_ ]?ref',9)]
BAD=re.compile(r'rail|bike|ped|hydro|historic|scenic|broadband|snowmobile|lightout|park|transit|truck|freight|buffer|adopt|crash|sign|bridge|culvert|guardrail|project|closure|camera|weather|traffic|count|aadt|pavement|maint_?unit|district|boundary|plan|study|test',re.I)
def score(n):
    s=0
    for p,w in GOOD:
        if re.search(p,n,re.I): s=max(s,w)
    if BAD.search(n): s-=7
    return s
def enum(st,root):
    j=get(root+"?f=json")
    if "_err" in j: return st,{"err":j["_err"],"cands":[]}
    svcs=list(j.get("services",[]))
    for fld in j.get("folders",[])[:20]:
        jf=get(f"{root}/{fld}?f=json",20)
        if "_err" not in jf: svcs+=jf.get("services",[])
    scored=[]
    for s in svcs:
        nm=s.get("name",""); ty=s.get("type","")
        if ty not in ("FeatureServer","MapServer"): continue
        short=nm.split('/')[-1]
        if not PAT.search(short): continue
        sc=score(short)
        if sc<=0: continue
        scored.append((sc,f"{root}/{nm}/{ty}"))   # keep the folder: catalog name may be "Folder/Service"
    scored.sort(key=lambda x:-x[0])
    seen=set(); out=[]
    for sc,u in scored:
        k=u.rsplit('/',2)[1]
        if k in seen: continue
        seen.add(k); out.append(u)
    return st,{"err":None,"cands":out[:8],"totalServices":len(svcs)}
roots=json.load(open("point_states.json"))
res={}
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    for st,v in ex.map(lambda kv:enum(kv[0],kv[1]["root"]),roots.items()): res[st]=v
json.dump(res,open("centerline_candidates.json","w"),indent=1)
for st,v in res.items():
    print(f"{st:10} {len(v['cands'])} cands  {v['err'] or ''}")
    for c in v["cands"][:4]: print("     ",c.rsplit('/',2)[1])
