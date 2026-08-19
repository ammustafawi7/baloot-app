"""
One-time Firestore name migration for baloot-app.
Uses only Python stdlib (urllib) — no pip installs needed.
"""
import json, urllib.request, urllib.parse, sys
sys.stdout.reconfigure(encoding="utf-8")

API_KEY   = "AIzaSyDN9b5YojbAoIja22eVJXF1maeyxzwLPLY"
PROJECT   = "baloot-ex47"
DOC_PATH  = "baloot/matches"
BASE      = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{DOC_PATH}"

# ── Name map ───────────────────────────────────────────────────────────────
NAME_MAP = {
    "بوسعيد":   "بو سعيد",
    "بودانة":   "بو دانه",
    "بوشهاب":   "بو دانه",
    "بو فاطمه": "هاشم",
    "احمد":     "احمد ع",
    "خالد":     "بو شمه",
}
def rep(n):
    if n is None: return n
    t = str(n).strip()
    return NAME_MAP.get(t, t)

# ── Firestore value helpers ────────────────────────────────────────────────
def fs_to_py(v):
    """Convert a Firestore typed value to a plain Python object."""
    if "stringValue"  in v: return v["stringValue"]
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue"  in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    if "nullValue"    in v: return None
    if "arrayValue"   in v:
        return [fs_to_py(i) for i in v["arrayValue"].get("values", [])]
    if "mapValue"     in v:
        return {k: fs_to_py(fv) for k, fv in v["mapValue"].get("fields", {}).items()}
    return None

def py_to_fs(obj):
    """Convert a plain Python object to a Firestore typed value."""
    if obj is None:           return {"nullValue": None}
    if isinstance(obj, bool): return {"booleanValue": obj}
    if isinstance(obj, int):  return {"integerValue": str(obj)}
    if isinstance(obj, float):return {"doubleValue": obj}
    if isinstance(obj, str):  return {"stringValue": obj}
    if isinstance(obj, list):
        return {"arrayValue": {"values": [py_to_fs(i) for i in obj]}}
    if isinstance(obj, dict):
        return {"mapValue": {"fields": {k: py_to_fs(v) for k, v in obj.items()}}}
    return {"stringValue": str(obj)}

# ── Fetch ──────────────────────────────────────────────────────────────────
def fetch_doc():
    url = f"{BASE}?key={API_KEY}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# ── Patch ──────────────────────────────────────────────────────────────────
def patch_doc(fields_fs):
    url = f"{BASE}?key={API_KEY}&updateMask.fieldPaths=list"
    body = json.dumps({"fields": fields_fs}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

# ── Migration logic ────────────────────────────────────────────────────────
def migrate_match(m):
    m["teamA"] = [rep(n) for n in m.get("teamA", [])]
    m["teamB"] = [rep(n) for n in m.get("teamB", [])]
    for r in m.get("rounds", []):
        if r.get("qaidPlayer"):  r["qaidPlayer"]  = rep(r["qaidPlayer"])
        if r.get("buyerPlayer"): r["buyerPlayer"]  = rep(r["buyerPlayer"])
        if r.get("label"):
            lbl = r["label"]
            for old, new in NAME_MAP.items():
                lbl = lbl.replace(old, new)
            r["label"] = lbl
        for pd in r.get("projectDetails") or []:
            pd["player"] = rep(pd["player"])
    return m

# ── Main ───────────────────────────────────────────────────────────────────
print("⏳ Fetching from Firestore...")
raw = fetch_doc()
fields_fs = raw.get("fields", {})
list_val   = fs_to_py(fields_fs.get("list", {"arrayValue": {}}))

print(f"📦 Matches found: {len(list_val)}")

# show names before
before = set()
for m in list_val:
    before.update(m.get("teamA", []) + m.get("teamB", []))
print("Before:", sorted(before))

migrated = [migrate_match(m) for m in list_val]

# show names after
after = set()
for m in migrated:
    after.update(m.get("teamA", []) + m.get("teamB", []))
print("After:", sorted(after))

print("💾 Writing back to Firestore...")
patch_doc({"list": py_to_fs(migrated)})
print("✅ Done!")
