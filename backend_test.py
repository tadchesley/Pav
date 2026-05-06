"""Round-2 Premium endpoint tests for Pav stock prediction app.

Tests:
  A. POST /api/predictions/compare
  B. GET /api/exports/screener.csv & /api/exports/watchlist.csv
  C. Regression: /api/predictions/AAPL/horizons, /api/predictions/screener, /api/admin/stats
"""
import os
import io
import csv
import time
import uuid
import json
import requests
from typing import Any, Dict, Tuple

# Resolve backend URL from frontend/.env
def _get_backend_url() -> str:
    p = "/app/frontend/.env"
    with open(p) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                if k.strip() in ("EXPO_PUBLIC_BACKEND_URL", "REACT_APP_BACKEND_URL"):
                    return v.strip().strip('"').strip("'")
    raise RuntimeError("Backend URL not found")

BASE = _get_backend_url().rstrip("/") + "/api"
print(f"[setup] BASE={BASE}")

ADMIN_EMAIL = "demo@alphapulse.app"
ADMIN_PW = "demo12345"

PASS = []
FAIL = []

def log_pass(name: str, info: str = ""):
    print(f"  PASS  {name} {info}")
    PASS.append(name)

def log_fail(name: str, info: str):
    print(f"  FAIL  {name} :: {info}")
    FAIL.append((name, info))


def post(path: str, json_body=None, token: str = None) -> Tuple[int, Any]:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = requests.post(f"{BASE}{path}", json=json_body, headers=h, timeout=60)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body


def get(path: str, token: str = None, params=None) -> Tuple[int, Any, requests.Response]:
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = requests.get(f"{BASE}{path}", headers=h, params=params, timeout=60)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body, r


# ---------- Setup ----------
print("\n[1] Login admin demo user")
sc, body = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PW})
assert sc == 200, f"admin login failed: {sc} {body}"
admin_token = body["access_token"]
assert body["user"]["is_admin"] is True
print("    admin token acquired, is_admin=True")

print("\n[2] Sign up fresh test user")
rand = uuid.uuid4().hex[:8]
test_email = f"cmp_{rand}@example.com"
test_pw = "test123456"
sc, body = post("/auth/signup", {"email": test_email, "password": test_pw, "full_name": "Compare Test"})
assert sc == 200, f"signup failed: {sc} {body}"
user_token = body["access_token"]
user_id = body["user"]["id"]
assert body["user"]["tier"] == "free"
print(f"    created {test_email} id={user_id} tier=free")


# ---------- A. Compare ----------
print("\n[A] POST /api/predictions/compare")

# A.2 free user → 403
sc, body = post("/predictions/compare", {"symbols": ["AAPL", "MSFT"]}, token=user_token)
if sc == 403 and "Premium required" in str(body):
    log_pass("A2 compare free->403", f"detail={body}")
else:
    log_fail("A2 compare free->403", f"got {sc} {body}")

# A.3 admin promotes user to premium monthly
sc, body = post(f"/admin/users/{user_id}/tier", {"tier": "premium", "plan": "monthly"}, token=admin_token)
if sc == 200 and body.get("tier") == "premium":
    log_pass("A3 admin upgrade premium-monthly", str(body))
else:
    log_fail("A3 admin upgrade", f"got {sc} {body}")

sc, body = post("/auth/login", {"email": test_email, "password": test_pw})
assert sc == 200, f"re-login failed: {sc} {body}"
user_token = body["access_token"]
assert body["user"]["tier"] == "premium", f"tier not premium: {body['user']}"
print("    re-logged in, tier=premium")

# A.4 premium with 4 symbols → 200, validate shape
sc, body = post("/predictions/compare", {"symbols": ["AAPL", "MSFT", "GOOGL", "NVDA"]}, token=user_token)
if sc != 200:
    log_fail("A4 compare premium 4 symbols", f"got {sc} {body}")
else:
    errs = []
    if body.get("count") != 4:
        errs.append(f"count={body.get('count')} expected 4")
    items = body.get("items", [])
    if len(items) != 4:
        errs.append(f"items length={len(items)} expected 4")
    required_keys = ["symbol", "name", "sector", "current_price", "rsi_14", "sma_20",
                     "sma_50", "momentum_10", "volatility", "predictions"]
    for it in items:
        missing = [k for k in required_keys if k not in it]
        if missing:
            errs.append(f"{it.get('symbol')} missing keys {missing}")
        preds = it.get("predictions", {})
        for h in ("1D", "1W", "1M"):
            if h not in preds:
                errs.append(f"{it.get('symbol')} predictions missing {h}")
            else:
                p = preds[h]
                req_pred = ["direction", "expected_return_pct", "target_price", "confidence", "ai_score"]
                missing_p = [k for k in req_pred if k not in p]
                if missing_p:
                    errs.append(f"{it.get('symbol')}.{h} missing {missing_p}")
    if errs:
        log_fail("A4 compare premium 4 symbols", "; ".join(errs[:5]))
    else:
        sample = items[0]
        log_pass("A4 compare premium 4 symbols", f"first={sample['symbol']} preds={list(sample['predictions'].keys())}")

# A.5 only 1 symbol → 400
sc, body = post("/predictions/compare", {"symbols": ["AAPL"]}, token=user_token)
if sc == 400:
    log_pass("A5 compare 1 symbol->400", str(body))
else:
    log_fail("A5 compare 1 symbol->400", f"got {sc} {body}")

# A.6 5 symbols → 400
sc, body = post("/predictions/compare", {"symbols": ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"]}, token=user_token)
if sc == 400:
    log_pass("A6 compare 5 symbols->400", str(body))
else:
    log_fail("A6 compare 5 symbols->400", f"got {sc} {body}")

# A.7 empty symbols → 400
sc, body = post("/predictions/compare", {"symbols": []}, token=user_token)
if sc == 400:
    log_pass("A7 compare empty->400", str(body))
else:
    log_fail("A7 compare empty->400", f"got {sc} {body}")


# ---------- B. CSV exports ----------
print("\n[B] CSV exports")

# B.8 demote to free → /exports/screener.csv → 403
sc, body = post(f"/admin/users/{user_id}/tier", {"tier": "free"}, token=admin_token)
assert sc == 200
sc, body = post("/auth/login", {"email": test_email, "password": test_pw})
user_token = body["access_token"]
assert body["user"]["tier"] == "free"

sc, body, r = get("/exports/screener.csv", token=user_token)
if sc == 403:
    log_pass("B8 screener.csv free->403", str(body)[:120])
else:
    log_fail("B8 screener.csv free->403", f"got {sc} body={str(body)[:200]}")

# Re-upgrade to premium
sc, body = post(f"/admin/users/{user_id}/tier", {"tier": "premium", "plan": "monthly"}, token=admin_token)
assert sc == 200
sc, body = post("/auth/login", {"email": test_email, "password": test_pw})
user_token = body["access_token"]

# B.9 screener.csv premium → 200, csv header, >50 rows
sc, _, r = get("/exports/screener.csv", token=user_token)
if sc != 200:
    log_fail("B9 screener.csv premium->200", f"got {sc} body={r.text[:200]}")
else:
    ct = r.headers.get("Content-Type", "")
    text = r.text
    lines = text.strip().splitlines()
    expected_header = "symbol,name,sector,ai_score,direction,current_price,target_price,expected_return_pct,confidence,rsi_14"
    errs = []
    if not ct.startswith("text/csv"):
        errs.append(f"Content-Type={ct}")
    if not lines or expected_header not in lines[0]:
        errs.append(f"header missing/incorrect: {lines[0] if lines else 'empty'}")
    data_rows = len(lines) - 1
    if data_rows <= 50:
        errs.append(f"only {data_rows} data rows (<=50)")
    if errs:
        log_fail("B9 screener.csv premium", "; ".join(errs))
    else:
        log_pass("B9 screener.csv premium->200", f"rows={data_rows}, content-type={ct}")

# B.10 screener.csv with min_confidence=0.7 & direction=UP
sc, _, r = get("/exports/screener.csv", token=user_token, params={"min_confidence": 0.7, "direction": "UP"})
if sc != 200:
    log_fail("B10 screener.csv filtered", f"got {sc} {r.text[:200]}")
else:
    text = r.text
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    bad = []
    for row in rows:
        try:
            conf = float(row["confidence"]) if row["confidence"] != "" else 0
        except Exception:
            conf = 0
        if row["direction"] != "UP" or conf < 0.7:
            bad.append((row.get("symbol"), row.get("direction"), row.get("confidence")))
    if bad:
        log_fail("B10 screener.csv filtered", f"{len(bad)} rows violate filter, e.g. {bad[:3]}")
    else:
        log_pass("B10 screener.csv filtered", f"all {len(rows)} rows direction=UP confidence>=0.7")

# B.11 watchlist.csv premium → 200, header present
sc, _, r = get("/exports/watchlist.csv", token=user_token)
if sc != 200:
    log_fail("B11 watchlist.csv premium->200", f"got {sc} {r.text[:200]}")
else:
    ct = r.headers.get("Content-Type", "")
    lines = r.text.strip().splitlines()
    expected_header = "symbol,name,sector,ai_score,direction,current_price,target_price,expected_return_pct,confidence"
    if not ct.startswith("text/csv"):
        log_fail("B11 watchlist.csv content-type", f"got {ct}")
    elif not lines or expected_header not in lines[0]:
        log_fail("B11 watchlist.csv header", f"header={lines[0] if lines else 'empty'}")
    else:
        log_pass("B11 watchlist.csv premium->200", f"rows={len(lines)-1}, header ok")

# B.12 watchlist.csv as free → 403
sc, body = post(f"/admin/users/{user_id}/tier", {"tier": "free"}, token=admin_token)
assert sc == 200
sc, body = post("/auth/login", {"email": test_email, "password": test_pw})
free_token = body["access_token"]
assert body["user"]["tier"] == "free"

sc, body, r = get("/exports/watchlist.csv", token=free_token)
if sc == 403:
    log_pass("B12 watchlist.csv free->403", str(body)[:120])
else:
    log_fail("B12 watchlist.csv free->403", f"got {sc} body={str(body)[:200]}")


# ---------- C. Regression ----------
print("\n[C] Regression checks")

sc, body = post(f"/admin/users/{user_id}/tier", {"tier": "premium", "plan": "monthly"}, token=admin_token)
assert sc == 200
sc, body = post("/auth/login", {"email": test_email, "password": test_pw})
user_token = body["access_token"]

# C.13 /predictions/AAPL/horizons (premium) → 200 with all 3 unlocked
sc, body, r = get("/predictions/AAPL/horizons", token=user_token)
if sc != 200:
    log_fail("C13 /predictions/AAPL/horizons premium->200", f"got {sc} body={str(body)[:200]}")
else:
    horizons = body.get("horizons", [])
    locked = [h for h in horizons if h.get("locked")]
    keys = [h.get("horizon") for h in horizons]
    if len(horizons) == 3 and not locked and set(keys) == {"1D", "1W", "1M"}:
        log_pass("C13 horizons premium", f"keys={keys}")
    else:
        log_fail("C13 horizons premium", f"horizons count={len(horizons)} locked={[h.get('horizon') for h in locked]} keys={keys}")

# C.14 /predictions/screener
sc, body = post("/predictions/screener", {"min_confidence": 0.5}, token=user_token)
if sc != 200:
    log_fail("C14 screener", f"got {sc} body={str(body)[:200]}")
else:
    n = len(body.get("results", []))
    if n > 0:
        log_pass("C14 screener", f"{n} results, total_in_cache={body.get('total_in_cache')}")
    else:
        log_fail("C14 screener", f"empty results: {body}")

# C.15 admin stats
sc, body, r = get("/admin/stats", token=admin_token)
if sc == 200 and "users" in body and "revenue" in body:
    log_pass("C15 admin/stats", f"users.total={body['users']['total']} mrr={body['revenue']['mrr']}")
else:
    log_fail("C15 admin/stats", f"got {sc} {body}")


print("\n========================================")
print(f"PASS: {len(PASS)}    FAIL: {len(FAIL)}")
for name, info in FAIL:
    print(f"  FAIL  {name} :: {info}")
print("========================================")
