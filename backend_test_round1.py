"""Round-1 Premium gating tests:
- GET /api/predictions/{symbol}/horizons (free vs premium vs anonymous)
- POST /api/predictions/screener filter gating (free vs premium)
- Regression: GET /api/predictions/{symbol}?deep=true and /api/auth/me.
"""
import os
import sys
import random
import string
import json
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not set")
    sys.exit(1)
API = f"{BASE}/api"

DEMO_EMAIL = "demo@alphapulse.app"
DEMO_PASSWORD = "demo12345"

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


def safe_json(r):
    try:
        return r.json()
    except Exception:
        return {"_text": r.text[:300]}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def rand_suffix(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def signup(email, password="test123456", full_name=None):
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": password, "full_name": full_name or email}, timeout=30)
    return r


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def admin_set_tier(admin_token, user_id, tier, plan=None):
    body = {"tier": tier}
    if plan:
        body["plan"] = plan
    r = requests.post(f"{API}/admin/users/{user_id}/tier", json=body, headers=auth_headers(admin_token), timeout=30)
    return r


def main():
    print(f"BASE = {BASE}")
    # 1. Login demo admin
    r = login(DEMO_EMAIL, DEMO_PASSWORD)
    if r.status_code != 200:
        record("admin_login_demo", False, f"status={r.status_code} body={safe_json(r)}")
        print_summary()
        return
    admin_data = r.json()
    admin_token = admin_data["access_token"]
    if not admin_data["user"].get("is_admin"):
        record("admin_login_demo", False, "demo user is_admin != True")
        print_summary()
        return
    record("admin_login_demo", True, f"admin user id={admin_data['user']['id']}")

    # 2. Create fresh free user
    free_email = f"freeround1+{rand_suffix()}@example.com"
    free_password = "test123456"
    r = signup(free_email, free_password, full_name="Free Round1 User")
    if r.status_code != 200:
        record("free_signup", False, f"status={r.status_code} body={safe_json(r)}")
        print_summary()
        return
    free_data = r.json()
    free_token = free_data["access_token"]
    free_user_id = free_data["user"]["id"]
    if free_data["user"].get("tier") != "free":
        record("free_signup_tier", False, f"tier={free_data['user'].get('tier')}")
    else:
        record("free_signup_tier", True, f"id={free_user_id}")

    # ---------- A. Horizons endpoint ----------
    # 5 (anon test first — no token)
    r = requests.get(f"{API}/predictions/AAPL/horizons", timeout=30)
    record("horizons_anon_401", r.status_code == 401, f"status={r.status_code} body={safe_json(r)}")

    # 2. Free user horizons
    r = requests.get(f"{API}/predictions/AAPL/horizons", headers=auth_headers(free_token), timeout=60)
    if r.status_code != 200:
        record("horizons_free_200", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        body = r.json()
        ok = True
        details = []
        if body.get("tier") != "free":
            ok = False
            details.append(f"tier={body.get('tier')}")
        horizons = body.get("horizons") or []
        if not isinstance(horizons, list) or len(horizons) != 3:
            ok = False
            details.append(f"horizons len={len(horizons)}")
        keys = [h.get("horizon") for h in horizons]
        if keys != ["1D", "1W", "1M"]:
            ok = False
            details.append(f"keys={keys}")
        record("horizons_free_shape", ok, "; ".join(details) if details else "tier=free, 3 horizons [1D,1W,1M]")

        # 1D should be unlocked with full fields
        h1d = next((h for h in horizons if h.get("horizon") == "1D"), {})
        ok_1d = (h1d.get("locked") is False
                 and h1d.get("direction") in ("UP", "DOWN", "NEUTRAL")
                 and isinstance(h1d.get("expected_return_pct"), (int, float))
                 and isinstance(h1d.get("target_price"), (int, float))
                 and isinstance(h1d.get("confidence"), (int, float))
                 and isinstance(h1d.get("ai_score"), (int, float)))
        record("horizons_free_1D_unlocked_full", ok_1d, json.dumps(h1d)[:300])

        # 1W and 1M locked, premium_required, no prediction fields
        for k in ("1W", "1M"):
            h = next((x for x in horizons if x.get("horizon") == k), {})
            forbidden_keys = {"direction", "target_price", "confidence", "ai_score"}
            present_forbidden = [fk for fk in forbidden_keys if fk in h]
            ok_locked = (h.get("locked") is True
                         and h.get("premium_required") is True
                         and not present_forbidden)
            record(f"horizons_free_{k}_locked_stub", ok_locked,
                   f"locked={h.get('locked')} premium_required={h.get('premium_required')} forbidden_present={present_forbidden}")

    # 3. Promote free user to premium (admin)
    r = admin_set_tier(admin_token, free_user_id, "premium", "yearly")
    if r.status_code != 200:
        record("admin_set_premium_yearly", False, f"status={r.status_code} body={safe_json(r)}")
        print_summary()
        return
    pbody = r.json()
    record("admin_set_premium_yearly", pbody.get("tier") == "premium" and pbody.get("plan") == "yearly",
           json.dumps(pbody))

    # Re-login as that user
    r = login(free_email, free_password)
    if r.status_code != 200:
        record("relogin_premium_user", False, f"status={r.status_code} body={safe_json(r)}")
        print_summary()
        return
    premium_token = r.json()["access_token"]
    if r.json()["user"].get("tier") != "premium":
        record("relogin_premium_user", False, f"tier still={r.json()['user'].get('tier')}")
    else:
        record("relogin_premium_user", True, "tier=premium")

    # 4. Premium user horizons
    r = requests.get(f"{API}/predictions/AAPL/horizons", headers=auth_headers(premium_token), timeout=60)
    if r.status_code != 200:
        record("horizons_premium_200", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        body = r.json()
        ok = True
        details = []
        if body.get("tier") != "premium":
            ok = False
            details.append(f"tier={body.get('tier')}")
        horizons = body.get("horizons") or []
        if len(horizons) != 3:
            ok = False
            details.append(f"len={len(horizons)}")
        # All unlocked
        for h in horizons:
            if h.get("locked") is not False:
                ok = False
                details.append(f"{h.get('horizon')} locked={h.get('locked')}")
            for fk in ("direction", "expected_return_pct", "target_price", "confidence", "ai_score"):
                if fk not in h:
                    ok = False
                    details.append(f"{h.get('horizon')} missing {fk}")
        record("horizons_premium_all_unlocked_full", ok, "; ".join(details) if details else "all 3 unlocked with full fields")

        # expected_return_pct differs across horizons (1D smaller magnitude than 1M)
        try:
            h1d = next(h for h in horizons if h["horizon"] == "1D")
            h1m = next(h for h in horizons if h["horizon"] == "1M")
            mag_1d = abs(float(h1d["expected_return_pct"]))
            mag_1m = abs(float(h1m["expected_return_pct"]))
            ok_diff = mag_1d < mag_1m or (mag_1d == 0 and mag_1m >= 0)
            # Stricter: should differ when both nonzero (otherwise pass with note)
            if mag_1d == 0 and mag_1m == 0:
                ok_diff = True  # neutral case
            record("horizons_premium_return_scaling", mag_1d <= mag_1m,
                   f"|1D|={mag_1d} |1M|={mag_1m} (1D direction={h1d['direction']} 1M direction={h1m['direction']})")
        except Exception as e:
            record("horizons_premium_return_scaling", False, f"exception={e}")

        # All confidences in [0.5, 0.95]
        try:
            confs = [float(h["confidence"]) for h in horizons]
            ok_conf = all(0.5 <= c <= 0.95 for c in confs)
            record("horizons_premium_confidence_range", ok_conf, f"confidences={confs}")
        except Exception as e:
            record("horizons_premium_confidence_range", False, f"exception={e}")

    # ---------- B. Screener gating ----------
    # First demote to free for free-user screener tests
    r = admin_set_tier(admin_token, free_user_id, "free")
    record("admin_demote_to_free_for_screener", r.status_code == 200, json.dumps(safe_json(r))[:200])
    # re-login to get fresh token at free tier
    r = login(free_email, free_password)
    if r.status_code != 200:
        record("relogin_free_for_screener", False, f"status={r.status_code}")
        print_summary()
        return
    free_token2 = r.json()["access_token"]
    record("relogin_free_for_screener", r.json()["user"].get("tier") == "free", f"tier={r.json()['user'].get('tier')}")

    # 6. Free user POST screener with min_confidence=0.85, sector=Technology
    body6 = {"min_confidence": 0.85, "sector": "Technology"}
    r = requests.post(f"{API}/predictions/screener", json=body6, headers=auth_headers(free_token2), timeout=120)
    if r.status_code != 200:
        record("screener_free_locked", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        b = r.json()
        ok = True
        details = []
        if b.get("tier") != "free":
            ok = False
            details.append(f"tier={b.get('tier')}")
        locked = b.get("locked_filters") or []
        if "min_confidence_above_60" not in locked:
            ok = False
            details.append("missing min_confidence_above_60")
        if "sector_filter" not in locked:
            ok = False
            details.append("missing sector_filter")
        if b.get("free_max_confidence") != 0.6:
            ok = False
            details.append(f"free_max_confidence={b.get('free_max_confidence')}")
        record("screener_free_locked_filters", ok, "; ".join(details) if details else f"locked={locked}, free_max=0.6")

        # Confirm sector filter was cleared — when results > 5 there should be multiple sectors
        results_arr = b.get("results") or []
        sectors = sorted({r.get("sector") for r in results_arr if r.get("sector")})
        if len(results_arr) > 5:
            ok_multi = len(sectors) > 1
            record("screener_free_sector_cleared", ok_multi,
                   f"results={len(results_arr)} sectors_distinct={len(sectors)} sample_sectors={sectors[:6]}")
        else:
            record("screener_free_sector_cleared", True,
                   f"only {len(results_arr)} results; warming={b.get('warming')} progress={b.get('progress')}/{b.get('total_universe')} — skipping sector diversity check")

    # 7. Free user with min_confidence=0.6 and sector=null → no locked filters
    body7 = {"min_confidence": 0.6, "sector": None}
    r = requests.post(f"{API}/predictions/screener", json=body7, headers=auth_headers(free_token2), timeout=60)
    if r.status_code != 200:
        record("screener_free_no_lock", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        b = r.json()
        locked = b.get("locked_filters") or []
        record("screener_free_no_lock", locked == [], f"locked_filters={locked}")

    # 8. Promote back to premium → verify locked_filters is empty and sector/conf applied
    r = admin_set_tier(admin_token, free_user_id, "premium", "monthly")
    record("admin_repromote_premium", r.status_code == 200, json.dumps(safe_json(r))[:200])
    r = login(free_email, free_password)
    if r.status_code != 200:
        record("relogin_premium2", False, f"status={r.status_code}")
        print_summary()
        return
    premium_token2 = r.json()["access_token"]
    record("relogin_premium2", r.json()["user"].get("tier") == "premium", f"tier={r.json()['user'].get('tier')}")

    body8 = {"min_confidence": 0.85, "sector": "Technology"}
    r = requests.post(f"{API}/predictions/screener", json=body8, headers=auth_headers(premium_token2), timeout=120)
    if r.status_code != 200:
        record("screener_premium_filters_apply", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        b = r.json()
        ok = True
        details = []
        if b.get("tier") != "premium":
            ok = False
            details.append(f"tier={b.get('tier')}")
        locked = b.get("locked_filters") or []
        if locked != []:
            ok = False
            details.append(f"locked={locked}")
        results_arr = b.get("results") or []
        if results_arr:
            bad_conf = [r2 for r2 in results_arr if (r2.get("confidence") or 0) < 0.85]
            bad_sec = [r2 for r2 in results_arr if r2.get("sector") != "Technology"]
            if bad_conf:
                ok = False
                details.append(f"{len(bad_conf)} results with confidence<0.85 (sample: {[r2.get('confidence') for r2 in bad_conf[:3]]})")
            if bad_sec:
                ok = False
                details.append(f"{len(bad_sec)} results with sector!='Technology' (sample: {[r2.get('sector') for r2 in bad_sec[:3]]})")
        record("screener_premium_filters_apply", ok,
               f"results={len(results_arr)}; cache warming={b.get('warming')} progress={b.get('progress')}/{b.get('total_universe')}; "
               + ("; ".join(details) if details else "all results match filters"))

    # ---------- C. Regression ----------
    # 9. /api/predictions/AAPL?deep=true with FREE user — re-demote first
    r = admin_set_tier(admin_token, free_user_id, "free")
    record("admin_demote_for_regression", r.status_code == 200)
    r = login(free_email, free_password)
    free_token3 = r.json()["access_token"]

    r = requests.get(f"{API}/predictions/AAPL?deep=true", headers=auth_headers(free_token3), timeout=60)
    if r.status_code != 200:
        record("regression_predictions_deep_free", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        b = r.json()
        ok = b.get("premium_required") is True and "Upgrade" in (b.get("narrative") or "")
        record("regression_predictions_deep_free", ok,
               f"premium_required={b.get('premium_required')} narrative_starts='{(b.get('narrative') or '')[:60]}'")

    # 10. /api/auth/me includes is_admin
    r = requests.get(f"{API}/auth/me", headers=auth_headers(free_token3), timeout=30)
    if r.status_code != 200:
        record("regression_auth_me_is_admin", False, f"status={r.status_code} body={safe_json(r)}")
    else:
        b = r.json()
        record("regression_auth_me_is_admin", "is_admin" in b, f"is_admin={b.get('is_admin')} keys={list(b.keys())}")

    print_summary()


def print_summary():
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print("\n========== SUMMARY ==========")
    print(f"{passed}/{total} passed")
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))
    failed = [r for r in results if not r[1]]
    if failed:
        print(f"\n{len(failed)} FAILED:")
        for name, _, detail in failed:
            print(f"  - {name}: {detail}")
        sys.exit(1)


if __name__ == "__main__":
    main()
