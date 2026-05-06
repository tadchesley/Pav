"""Backend tests for Pav Admin Dashboard endpoints."""
import os
import sys
import random
import string
import json
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

# Load frontend env for BASE URL
load_dotenv(Path("/app/frontend/.env"))
BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not set")
    sys.exit(1)
API = f"{BASE}/api"

DEMO_EMAIL = "demo@alphapulse.app"
DEMO_PASSWORD = "demo12345"

results = []  # list of (name, ok, detail)


def record(name: str, ok: bool, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail else ""))


def rand_suffix(n=8):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def safe_json(r):
    try:
        return r.json()
    except Exception:
        return {"_raw": r.text[:500]}


def main():
    print(f"API base: {API}")

    # --- 1. Login demo admin ---
    admin_token = None
    admin_user = None
    try:
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
        body = safe_json(r)
        if r.status_code == 200 and body.get("user", {}).get("is_admin") is True:
            admin_token = body["access_token"]
            admin_user = body["user"]
            record("1. Login demo admin & is_admin=true", True, f"user_id={admin_user['id']}")
        else:
            record("1. Login demo admin & is_admin=true", False, f"status={r.status_code} body={body}")
    except Exception as e:
        record("1. Login demo admin & is_admin=true", False, str(e))

    if not admin_token:
        print("Cannot continue without admin token")
        return

    H = {"Authorization": f"Bearer {admin_token}"}

    # --- 2. GET /api/admin/stats shape ---
    try:
        r = requests.get(f"{API}/admin/stats", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code != 200:
            record("2. GET /admin/stats 200 + shape", False, f"status={r.status_code} body={body}")
        else:
            problems = []
            u = body.get("users", {})
            for k in ("total", "free", "premium", "monthly_subs", "yearly_subs"):
                if not isinstance(u.get(k), int):
                    problems.append(f"users.{k} not int: {u.get(k)!r}")
            if not isinstance(u.get("by_provider"), dict):
                problems.append(f"users.by_provider not object: {type(u.get('by_provider'))}")
            s = body.get("signups", {})
            for k in ("today", "last_7_days", "last_30_days"):
                if not isinstance(s.get(k), int):
                    problems.append(f"signups.{k} not int: {s.get(k)!r}")
            e = body.get("engagement", {})
            for k in ("active_alerts", "total_watchlist"):
                if not isinstance(e.get(k), int):
                    problems.append(f"engagement.{k} not int: {e.get(k)!r}")
            rev = body.get("revenue", {})
            for k in ("mrr", "arr"):
                if not isinstance(rev.get(k), (int, float)):
                    problems.append(f"revenue.{k} not number: {rev.get(k)!r}")
            if rev.get("currency") != "USD":
                problems.append(f"revenue.currency={rev.get('currency')!r}")
            if problems:
                record("2. GET /admin/stats 200 + shape", False, "; ".join(problems))
            else:
                record("2. GET /admin/stats 200 + shape", True,
                       f"users.total={u['total']} mrr={rev['mrr']}")
    except Exception as e:
        record("2. GET /admin/stats 200 + shape", False, str(e))

    # --- 3. GET /api/admin/signups_chart?days=30 ---
    try:
        r = requests.get(f"{API}/admin/signups_chart?days=30", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code != 200:
            record("3. GET /admin/signups_chart?days=30", False, f"status={r.status_code} body={body}")
        else:
            series = body.get("series")
            problems = []
            if not isinstance(series, list):
                problems.append(f"series not list: {type(series)}")
            elif len(series) != 30:
                problems.append(f"len(series)={len(series)}, expected 30")
            else:
                for i, it in enumerate(series):
                    d = it.get("date")
                    c = it.get("count")
                    # validate date YYYY-MM-DD
                    try:
                        datetime.strptime(d, "%Y-%m-%d")
                    except Exception:
                        problems.append(f"series[{i}].date invalid: {d!r}")
                        break
                    if not isinstance(c, int):
                        problems.append(f"series[{i}].count not int: {c!r}")
                        break
            if problems:
                record("3. GET /admin/signups_chart?days=30", False, "; ".join(problems))
            else:
                record("3. GET /admin/signups_chart?days=30", True, f"series len=30 first={series[0]} last={series[-1]}")
    except Exception as e:
        record("3. GET /admin/signups_chart?days=30", False, str(e))

    # --- 4. GET /api/admin/users ---
    users_list = []
    try:
        r = requests.get(f"{API}/admin/users", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code != 200:
            record("4. GET /admin/users", False, f"status={r.status_code} body={body}")
        else:
            problems = []
            for k in ("total", "limit", "offset", "items"):
                if k not in body:
                    problems.append(f"missing {k}")
            items = body.get("items", [])
            if not isinstance(items, list):
                problems.append("items not list")
            elif len(items) > 50:
                problems.append(f"len(items)={len(items)} > 50")
            else:
                for i, it in enumerate(items[:3]):
                    for k in ("id", "email", "tier", "provider", "is_admin", "created_at"):
                        if k not in it:
                            problems.append(f"items[{i}] missing {k}")
                            break
            if problems:
                record("4. GET /admin/users", False, "; ".join(problems))
            else:
                users_list = items
                record("4. GET /admin/users", True, f"total={body['total']} items={len(items)}")
    except Exception as e:
        record("4. GET /admin/users", False, str(e))

    # --- 5. GET /api/admin/users?q=demo ---
    try:
        r = requests.get(f"{API}/admin/users?q=demo", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code != 200:
            record("5. GET /admin/users?q=demo", False, f"status={r.status_code} body={body}")
        else:
            items = body.get("items", [])
            bad = [it["email"] for it in items if "demo" not in it.get("email", "").lower() and "demo" not in (it.get("full_name") or "").lower()]
            if bad:
                record("5. GET /admin/users?q=demo", False, f"non-demo emails returned: {bad}")
            else:
                record("5. GET /admin/users?q=demo", True, f"{len(items)} result(s)")
    except Exception as e:
        record("5. GET /admin/users?q=demo", False, str(e))

    # --- 6. GET /api/admin/top_watched?limit=10 ---
    try:
        r = requests.get(f"{API}/admin/top_watched?limit=10", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code != 200:
            record("6. GET /admin/top_watched?limit=10", False, f"status={r.status_code} body={body}")
        else:
            items = body.get("items")
            if not isinstance(items, list):
                record("6. GET /admin/top_watched?limit=10", False, f"items not list: {type(items)}")
            else:
                record("6. GET /admin/top_watched?limit=10", True, f"{len(items)} item(s)")
    except Exception as e:
        record("6. GET /admin/top_watched?limit=10", False, str(e))

    # Pick a non-admin user (or create one) for tier changes
    target_user_id = None
    target_email = None

    # Create a fresh non-admin user for safe tier manipulation
    rand_email_target = f"tiertest+{rand_suffix()}@example.com"
    try:
        r = requests.post(f"{API}/auth/signup",
                          json={"email": rand_email_target, "password": "TierTest123!", "full_name": "Tier Target"},
                          timeout=30)
        body = safe_json(r)
        if r.status_code == 200 and body.get("user", {}).get("id"):
            target_user_id = body["user"]["id"]
            target_email = body["user"]["email"]
            # Ensure not admin
            if body["user"].get("is_admin"):
                record("Pre-7. Create non-admin target user", False, "signup returned is_admin=true")
            else:
                record("Pre-7. Create non-admin target user", True, f"id={target_user_id} email={target_email}")
        else:
            record("Pre-7. Create non-admin target user", False, f"status={r.status_code} body={body}")
    except Exception as e:
        record("Pre-7. Create non-admin target user", False, str(e))

    # --- 7. POST /api/admin/users/{id}/tier premium yearly ---
    if target_user_id:
        try:
            r = requests.post(f"{API}/admin/users/{target_user_id}/tier", headers=H,
                              json={"tier": "premium", "plan": "yearly"}, timeout=30)
            body = safe_json(r)
            if r.status_code == 200 and body.get("tier") == "premium" and body.get("plan") == "yearly":
                record("7. POST set tier premium/yearly", True, json.dumps(body))
            else:
                record("7. POST set tier premium/yearly", False, f"status={r.status_code} body={body}")
        except Exception as e:
            record("7. POST set tier premium/yearly", False, str(e))

        # --- 8. POST set tier free, verify via list ---
        try:
            r = requests.post(f"{API}/admin/users/{target_user_id}/tier", headers=H,
                              json={"tier": "free"}, timeout=30)
            body = safe_json(r)
            if r.status_code != 200 or body.get("tier") != "free":
                record("8. POST set tier free + verify", False, f"status={r.status_code} body={body}")
            else:
                # Verify via GET /admin/users?q=<simple-substring> (avoid '+' in email which is regex meta + URL space)
                q_token = "tiertest"
                r2 = requests.get(f"{API}/admin/users", headers=H, params={"q": q_token, "limit": 200}, timeout=30)
                body2 = safe_json(r2)
                items = body2.get("items", [])
                found = next((it for it in items if it["id"] == target_user_id), None)
                if not found:
                    record("8. POST set tier free + verify", False, f"target user not found in list search; items={items}")
                elif found.get("tier") != "free":
                    record("8. POST set tier free + verify", False, f"tier not free: {found}")
                else:
                    record("8. POST set tier free + verify", True, f"tier={found['tier']} plan={found.get('plan')}")
        except Exception as e:
            record("8. POST set tier free + verify", False, str(e))

        # --- 9. POST tier invalid -> 400 ---
        try:
            r = requests.post(f"{API}/admin/users/{target_user_id}/tier", headers=H,
                              json={"tier": "invalid"}, timeout=30)
            if r.status_code == 400:
                record("9. POST invalid tier returns 400", True, f"status=400")
            else:
                record("9. POST invalid tier returns 400", False, f"status={r.status_code} body={safe_json(r)}")
        except Exception as e:
            record("9. POST invalid tier returns 400", False, str(e))
    else:
        record("7. POST set tier premium/yearly", False, "no target user")
        record("8. POST set tier free + verify", False, "no target user")
        record("9. POST invalid tier returns 400", False, "no target user")

    # --- 10. Auth gating ---
    # 10a. Sign up non-admin, verify is_admin false, 403 on /admin/stats
    rand_email = f"nonadmin+{rand_suffix()}@example.com"
    try:
        r = requests.post(f"{API}/auth/signup",
                          json={"email": rand_email, "password": "test123456", "full_name": "Non Admin"},
                          timeout=30)
        body = safe_json(r)
        if r.status_code == 200:
            non_admin_token = body["access_token"]
            is_admin_flag = body["user"].get("is_admin")
            if is_admin_flag is False:
                record("10a. Non-admin signup is_admin=false", True, f"email={rand_email}")
            else:
                record("10a. Non-admin signup is_admin=false", False, f"is_admin={is_admin_flag}")
            # 10b. 403 on /admin/stats
            r2 = requests.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {non_admin_token}"}, timeout=30)
            if r2.status_code == 403:
                record("10b. Non-admin /admin/stats returns 403", True, "status=403")
            else:
                record("10b. Non-admin /admin/stats returns 403", False, f"status={r2.status_code} body={safe_json(r2)}")
        else:
            record("10a. Non-admin signup is_admin=false", False, f"status={r.status_code} body={body}")
            record("10b. Non-admin /admin/stats returns 403", False, "could not signup")
    except Exception as e:
        record("10a. Non-admin signup is_admin=false", False, str(e))
        record("10b. Non-admin /admin/stats returns 403", False, str(e))

    # 10c. No auth header -> 401
    try:
        r = requests.get(f"{API}/admin/stats", timeout=30)
        if r.status_code == 401:
            record("10c. /admin/stats w/o auth returns 401", True, "status=401")
        else:
            record("10c. /admin/stats w/o auth returns 401", False, f"status={r.status_code} body={safe_json(r)}")
    except Exception as e:
        record("10c. /admin/stats w/o auth returns 401", False, str(e))

    # --- Regression: /auth/me, /alerts, /watchlist ---
    try:
        r = requests.get(f"{API}/auth/me", headers=H, timeout=30)
        body = safe_json(r)
        if r.status_code == 200 and body.get("is_admin") is True:
            record("R1. GET /auth/me (admin) is_admin=true", True, "ok")
        else:
            record("R1. GET /auth/me (admin) is_admin=true", False, f"status={r.status_code} body={body}")
    except Exception as e:
        record("R1. GET /auth/me (admin) is_admin=true", False, str(e))

    try:
        r = requests.get(f"{API}/alerts", headers=H, timeout=60)
        if r.status_code == 200:
            record("R2. GET /alerts", True, f"items={len(safe_json(r).get('items', []))}")
        else:
            record("R2. GET /alerts", False, f"status={r.status_code} body={safe_json(r)}")
    except Exception as e:
        record("R2. GET /alerts", False, str(e))

    try:
        r = requests.get(f"{API}/watchlist", headers=H, timeout=120)
        if r.status_code == 200:
            record("R3. GET /watchlist", True, f"items={len(safe_json(r).get('items', []))}")
        else:
            record("R3. GET /watchlist", False, f"status={r.status_code} body={safe_json(r)}")
    except Exception as e:
        record("R3. GET /watchlist", False, str(e))

    # Summary
    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"Passed: {passed} | Failed: {failed}")
    for name, ok, detail in results:
        if not ok:
            print(f"  [FAIL] {name}: {detail}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
