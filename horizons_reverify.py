"""Re-verify GET /api/predictions/{symbol}/horizons after decorator fix."""
import os
import requests
import sys

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pav-website.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

DEMO_EMAIL = "demo@alphapulse.app"
DEMO_PASS = "demo12345"

results = []
def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} - {name}: {detail}")

def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["access_token"], data["user"]

# Step 1: login as demo
token, demo_user = login(DEMO_EMAIL, DEMO_PASS)
demo_user_id = demo_user["id"]
print(f"Demo user id={demo_user_id}, is_admin={demo_user.get('is_admin')}, tier={demo_user.get('tier')}")

# Step 2: ensure premium via admin endpoint
r = requests.post(
    f"{API}/admin/users/{demo_user_id}/tier",
    json={"tier": "premium", "plan": "monthly"},
    headers={"Authorization": f"Bearer {token}"},
    timeout=30,
)
record("admin promote demo to premium monthly", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

# Step 3: re-login and verify horizons as premium
token, demo_user = login(DEMO_EMAIL, DEMO_PASS)
print(f"After re-login tier={demo_user.get('tier')}")

r = requests.get(f"{API}/predictions/AAPL/horizons", headers={"Authorization": f"Bearer {token}"}, timeout=60)
ok = r.status_code == 200
body = r.json() if ok else {}
record("GET /predictions/AAPL/horizons (premium) 200", ok, f"status={r.status_code}")

if ok:
    record("premium: tier == 'premium'", body.get("tier") == "premium", f"tier={body.get('tier')}")
    horizons = body.get("horizons") or []
    labels = [h.get("label") or h.get("horizon") for h in horizons]
    record("premium: 3 horizons present", len(horizons) == 3, f"labels={labels}")
    required_keys = ["direction", "expected_return_pct", "target_price", "confidence", "ai_score"]
    for h in horizons:
        lbl = h.get("label") or h.get("horizon")
        unlocked = not h.get("locked", False)
        has_all = all(k in h for k in required_keys)
        record(f"premium horizon {lbl}: unlocked", unlocked, f"locked={h.get('locked')}")
        record(f"premium horizon {lbl}: has full fields", has_all,
               f"keys_present={[k for k in required_keys if k in h]}")

# Step 4: demote to free
r = requests.post(
    f"{API}/admin/users/{demo_user_id}/tier",
    json={"tier": "free"},
    headers={"Authorization": f"Bearer {token}"},
    timeout=30,
)
record("admin demote demo to free", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")

# Step 5: re-login as free
token, demo_user = login(DEMO_EMAIL, DEMO_PASS)
print(f"After demote re-login tier={demo_user.get('tier')}")

r = requests.get(f"{API}/predictions/AAPL/horizons", headers={"Authorization": f"Bearer {token}"}, timeout=60)
ok = r.status_code == 200
body = r.json() if ok else {}
record("GET /predictions/AAPL/horizons (free) 200", ok, f"status={r.status_code}")

if ok:
    record("free: tier == 'free'", body.get("tier") == "free", f"tier={body.get('tier')}")
    horizons = body.get("horizons") or []
    by_label = {(h.get("label") or h.get("horizon")): h for h in horizons}
    
    one_d = by_label.get("1D")
    if one_d:
        unlocked_1d = not one_d.get("locked", False)
        required_keys = ["direction", "expected_return_pct", "target_price", "confidence", "ai_score"]
        has_all = all(k in one_d for k in required_keys)
        record("free 1D: unlocked", unlocked_1d, f"locked={one_d.get('locked')}")
        record("free 1D: has full fields", has_all,
               f"keys_present={[k for k in required_keys if k in one_d]}")
    else:
        record("free 1D: present", False, "1D missing")
    
    for lbl in ("1W", "1M"):
        h = by_label.get(lbl)
        if h is None:
            record(f"free {lbl}: present", False, "missing")
            continue
        record(f"free {lbl}: locked=true", h.get("locked") is True, f"locked={h.get('locked')}")
        record(f"free {lbl}: premium_required=true", h.get("premium_required") is True,
               f"premium_required={h.get('premium_required')}")
        stub_keys = ["direction", "target_price", "confidence", "ai_score"]
        absent = [k for k in stub_keys if k not in h]
        record(f"free {lbl}: stub has NO direction/target_price/confidence/ai_score",
               len(absent) == len(stub_keys), f"absent={absent}")

# Step 6: anonymous
r = requests.get(f"{API}/predictions/AAPL/horizons", timeout=30)
record("Anonymous (no auth) → 401", r.status_code == 401, f"status={r.status_code}")

# Summary
print("\n" + "="*60)
passed = sum(1 for _, ok, _ in results if ok)
print(f"TOTAL: {passed}/{len(results)} passed")
fails = [(n, d) for n, ok, d in results if not ok]
if fails:
    print("FAILURES:")
    for n, d in fails:
        print(f"  - {n}: {d}")
    sys.exit(1)
