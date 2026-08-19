"""
One-time fix: هاشم → بو فاطمة في collection matches (البنية الجديدة)
"""
import json, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")

API_KEY = "AIzaSyDN9b5YojbAoIja22eVJXF1maeyxzwLPLY"
PROJECT = "baloot-ex47"
COL     = "matches"
BASE    = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{COL}"

NAME_MAP = { "هاشم": "بو فاطمة" }

def rep(n):
    if n is None: return n
    t = str(n).strip()
    return NAME_MAP.get(t, t)

def fs_to_py(v):
    if "stringValue"  in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue"  in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue"    in v: return None
    if "arrayValue"   in v: return [fs_to_py(i) for i in v["arrayValue"].get("values", [])]
    if "mapValue"     in v: return {k: fs_to_py(fv) for k, fv in v["mapValue"].get("fields", {}).items()}
    return None

def py_to_fs(obj):
    if obj is None:           return {"nullValue": None}
    if isinstance(obj, bool): return {"booleanValue": obj}
    if isinstance(obj, int):  return {"integerValue": str(obj)}
    if isinstance(obj, float):return {"doubleValue": obj}
    if isinstance(obj, str):  return {"stringValue": obj}
    if isinstance(obj, list): return {"arrayValue": {"values": [py_to_fs(i) for i in obj]}}
    if isinstance(obj, dict): return {"mapValue": {"fields": {k: py_to_fs(v) for k, v in obj.items()}}}
    return {"stringValue": str(obj)}

def fetch_all():
    url = f"{BASE}?key={API_KEY}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def patch_doc(doc_name, fields_fs):
    url = f"https://firestore.googleapis.com/v1/{doc_name}?key={API_KEY}&updateMask.fieldPaths=teamA&updateMask.fieldPaths=teamB&updateMask.fieldPaths=rounds"
    body = json.dumps({"fields": fields_fs}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def fix_match(m):
    changed = False
    new_teamA = [rep(n) for n in m.get("teamA", [])]
    new_teamB = [rep(n) for n in m.get("teamB", [])]
    if new_teamA != m.get("teamA"): changed = True
    if new_teamB != m.get("teamB"): changed = True
    new_rounds = []
    for r in m.get("rounds", []):
        nr = dict(r)
        if nr.get("qaidPlayer"):  nr["qaidPlayer"]  = rep(nr["qaidPlayer"])
        if nr.get("buyerPlayer"): nr["buyerPlayer"]  = rep(nr["buyerPlayer"])
        if nr.get("label"):
            for old, new in NAME_MAP.items():
                nr["label"] = nr["label"].replace(old, new)
        for pd in nr.get("projectDetails") or []:
            pd["player"] = rep(pd["player"])
        if nr != r: changed = True
        new_rounds.append(nr)
    return {**m, "teamA": new_teamA, "teamB": new_teamB, "rounds": new_rounds}, changed

print("⏳ جاري تحميل المستندات...")
result = fetch_all()
docs = result.get("documents", [])
print(f"📦 عدد الماتشات: {len(docs)}")

updated = 0
for d in docs:
    doc_name = d["name"]
    fields_fs = d.get("fields", {})
    m = {k: fs_to_py(v) for k, v in fields_fs.items()}
    fixed, changed = fix_match(m)
    if changed:
        new_fields = {k: py_to_fs(v) for k, v in fixed.items()}
        patch_doc(doc_name, new_fields)
        print(f"  ✅ عُدّل: {fixed.get('teamA')} vs {fixed.get('teamB')}")
        updated += 1

print(f"\n✅ تم! عُدّل {updated} ماتش من أصل {len(docs)}")
