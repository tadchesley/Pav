"""Round-3 Premium endpoint tests for Pav stock prediction app.
Tests:
  A. Quote split (delayed cache for free, live for premium)
  B. AI confidence alerts gating + validation
  C. Regression of compare/exports/horizons/screener/admin
"""
import os
import re
import random
import string
import sys
from datetime import datetime, timezone

import requests

BASE = "https://pav-website.preview.emergentagent.com/api"

ADMIN_EMAIL = "demo@alphapulse.app"
ADMIN_PASS = "demo12345"

results = []

def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} {('- ' + detail) if detail else ''}")
    results.append((name, ok, detail))


def rand_email():
    s = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"q+{s}@example.com"


def post(path, json=None, token=None, params=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.post(BASE + path, json=json, headers=h, params=params, timeout=30)


def get(path, token=None, params=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(BASE + path, headers=h, params=params, timeout=30)


def login(email, password):
    r = post("/auth/login", {"email": email, "password": password})
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]


def signup(email, password):
    r = post("/auth/signup", {"email": email, "password": password, "full_name": "QA Test User"})
    r.raise_for_status()
    j = r.json()
    return j["access_token"], j["user"]


def admin_set_tier(admin_token, user_id, tier, plan=None):
    body = {"tier": tier}
    if plan:
        body["plan"] = plan
    r = post(f"/admin/users/{user_id}/tier", body, token=admin_token)
    return r


# ---------- Setup ----------
print("\n--- Setup: admin login + create q user ---")
admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASS)
print(f"  admin login OK, is_admin={admin_user.get('is_admin')}")
assert admin_user.get("is_admin") is True, "demo user is not admin"

q_email = rand_email()
q_pass = "test123456"
q_token, q_user = signup(q_email, q_pass)
q_id = q_user["id"]
print(f"  signed up {q_email} id={q_id} tier={q_user.get('tier')}")
assert q_user.get("tier") == "free"


# ============================================================
# A. Quote split
# ============================================================
print("\n=== A. Quote split GET /api/stocks/quote/{symbol} ===")

# 1) Anonymous → 401
r = requests.get(BASE + "/stocks/quote/AAPL", timeout=20)
log("A1 anon → 401", r.status_code == 401, f"got {r.status_code}")

# 2) FREE user → 200 with delayed:true, source cache or live-fallback
r = get("/stocks/quote/AAPL", token=q_token)
ok = r.status_code == 200
log("A2.0 free 200", ok, f"got {r.status_code} body={r.text[:200]}")
if ok:
    body = r.json()
    log("A2.1 delayed==true", body.get("delayed") is True, f"delayed={body.get('delayed')}")
    log("A2.2 data_source in {cache,live-fallback}",
        body.get("data_source") in ("cache", "live-fallback"),
        f"data_source={body.get('data_source')}")
    as_of = body.get("as_of")
    iso_ok = as_of is None or bool(re.match(r"^\d{4}-\d{2}-\d{2}T", str(as_of)))
    log("A2.3 as_of valid ISO or null", iso_ok, f"as_of={as_of}")
    log("A2.4 price > 0", float(body.get("price", 0)) > 0, f"price={body.get('price')}")

# 3) Upgrade q user to premium
r = admin_set_tier(admin_token, q_id, "premium", "monthly")
log("A3.0 admin upgrade to premium", r.status_code == 200, f"got {r.status_code} body={r.text[:200]}")

# Re-login as q
q_token, q_user = login(q_email, q_pass)
log("A3.1 q user tier=premium after re-login", q_user.get("tier") == "premium", f"tier={q_user.get('tier')}")

# 4) PREMIUM user → live
r = get("/stocks/quote/AAPL", token=q_token)
ok = r.status_code == 200
log("A4.0 premium 200", ok, f"got {r.status_code} body={r.text[:200]}")
if ok:
    body = r.json()
    log("A4.1 delayed==false", body.get("delayed") is False, f"delayed={body.get('delayed')}")
    log("A4.2 data_source==live", body.get("data_source") == "live", f"data_source={body.get('data_source')}")
    log("A4.3 price > 0", float(body.get("price", 0)) > 0, f"price={body.get('price')}")


# ============================================================
# B. AI confidence alerts
# ============================================================
print("\n=== B. AI confidence alerts ===")

# 5) Demote to free, expect 403
r = admin_set_tier(admin_token, q_id, "free")
log("B5.0 demote to free", r.status_code == 200, f"got {r.status_code}")
q_token, q_user = login(q_email, q_pass)
log("B5.1 q tier=free", q_user.get("tier") == "free", f"tier={q_user.get('tier')}")

r = post("/alerts", {"symbol": "AAPL", "target_price": 0.8, "direction": "above", "type": "ai_confidence"}, token=q_token)
log("B5.2 free + ai_confidence → 403", r.status_code == 403, f"got {r.status_code} body={r.text[:200]}")

# 6) Re-upgrade to premium
r = admin_set_tier(admin_token, q_id, "premium", "monthly")
log("B6.0 promote to premium", r.status_code == 200, f"got {r.status_code}")
q_token, q_user = login(q_email, q_pass)
log("B6.1 q tier=premium", q_user.get("tier") == "premium")

r = post("/alerts", {"symbol": "AAPL", "target_price": 0.8, "direction": "above", "type": "ai_confidence"}, token=q_token)
ok = r.status_code == 200
log("B6.2 premium + ai_confidence → 200", ok, f"got {r.status_code} body={r.text[:200]}")
if ok:
    body = r.json()
    log("B6.3 type=ai_confidence", body.get("type") == "ai_confidence", f"type={body.get('type')}")
    log("B6.4 target_price=0.8", body.get("target_price") == 0.8, f"target_price={body.get('target_price')}")
    log("B6.5 direction=above", body.get("direction") == "above", f"direction={body.get('direction')}")
    log("B6.6 status=active", body.get("status") == "active", f"status={body.get('status')}")

# 7) direction below → 400
r = post("/alerts", {"symbol": "AAPL", "target_price": 0.8, "direction": "below", "type": "ai_confidence"}, token=q_token)
log("B7 ai_conf + below → 400", r.status_code == 400, f"got {r.status_code} body={r.text[:200]}")

# 8) target=1.5 → 400
r = post("/alerts", {"symbol": "AAPL", "target_price": 1.5, "direction": "above", "type": "ai_confidence"}, token=q_token)
log("B8 ai_conf + 1.5 → 400", r.status_code == 400, f"got {r.status_code} body={r.text[:200]}")

# 9) target=85 → 400
r = post("/alerts", {"symbol": "AAPL", "target_price": 85, "direction": "above", "type": "ai_confidence"}, token=q_token)
log("B9 ai_conf + 85 → 400", r.status_code == 400, f"got {r.status_code} body={r.text[:200]}")

# 10) type=bogus → 400
r = post("/alerts", {"symbol": "AAPL", "target_price": 100, "direction": "above", "type": "bogus"}, token=q_token)
log("B10 bogus type → 400", r.status_code == 400, f"got {r.status_code} body={r.text[:200]}")

# 11) Default (no type) → 200, creates price alert
r = post("/alerts", {"symbol": "AAPL", "target_price": 50, "direction": "above"}, token=q_token)
ok = r.status_code == 200
log("B11.0 default type → 200", ok, f"got {r.status_code} body={r.text[:200]}")
if ok:
    body = r.json()
    log("B11.1 type=price", body.get("type") == "price", f"type={body.get('type')}")

# 12) GET /alerts — premium user — ai_confidence alert has current_confidence
r = get("/alerts", token=q_token)
ok = r.status_code == 200
log("B12.0 GET /alerts 200", ok, f"got {r.status_code}")
if ok:
    items = r.json().get("items", [])
    ai = [a for a in items if a.get("type") == "ai_confidence"]
    log("B12.1 has ai_confidence alert", len(ai) >= 1, f"found {len(ai)}")
    if ai:
        a = ai[0]
        cc = a.get("current_confidence")
        is_num = isinstance(cc, (int, float))
        in_range = is_num and (0 <= cc <= 1)
        log("B12.2 current_confidence is number 0..1", in_range, f"cc={cc}")
        log("B12.3 type==ai_confidence", a.get("type") == "ai_confidence")


# ============================================================
# C. Regression
# ============================================================
print("\n=== C. Regression ===")

# 13) Horizons (premium) — all 3 unlocked
r = get("/predictions/AAPL/horizons", token=q_token)
ok = r.status_code == 200
log("C13.0 horizons 200", ok, f"got {r.status_code}")
if ok:
    body = r.json()
    horizons = body.get("horizons", [])
    keys = sorted([h.get("horizon") for h in horizons])
    unlocked = sum(1 for h in horizons if h.get("locked") is False)
    log("C13.1 3 horizons present", len(horizons) == 3 and keys == ["1D", "1M", "1W"], f"keys={keys}")
    log("C13.2 all unlocked", unlocked == 3, f"unlocked={unlocked}")

# 14) Screener
r = post("/predictions/screener", {}, token=q_token)
ok = r.status_code == 200
log("C14.0 screener 200", ok, f"got {r.status_code}")
if ok:
    j = r.json()
    log("C14.1 results present", isinstance(j.get("results"), list) and len(j["results"]) > 0, f"n={len(j.get('results', []))}")

# 15) Admin stats
r = get("/admin/stats", token=admin_token)
log("C15 admin/stats 200", r.status_code == 200, f"got {r.status_code}")

# 16) Compare
r = post("/predictions/compare", {"symbols": ["AAPL", "MSFT"]}, token=q_token)
ok = r.status_code == 200
log("C16.0 compare 200", ok, f"got {r.status_code} body={r.text[:200]}")
if ok:
    j = r.json()
    log("C16.1 2 items", j.get("count") == 2 and len(j.get("items", [])) == 2, f"count={j.get('count')}")

# 17) Exports CSV
r = get("/exports/screener.csv", token=q_token)
ok = r.status_code == 200
ct_ok = "text/csv" in (r.headers.get("content-type") or "")
log("C17.0 screener.csv 200", ok, f"got {r.status_code}")
log("C17.1 content-type text/csv", ct_ok, f"ct={r.headers.get('content-type')}")


# ============================================================
# Summary
# ============================================================
print("\n========== SUMMARY ==========")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"PASS: {passed}/{total}")
fails = [(n, d) for n, ok, d in results if not ok]
if fails:
    print("\nFAILED:")
    for n, d in fails:
        print(f"  - {n}: {d}")
    sys.exit(1)
print("ALL PASS")
