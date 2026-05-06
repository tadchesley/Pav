#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build the in-app Admin Dashboard for the Pav stock prediction app. Admin users (configured by ADMIN_EMAILS env var, currently includes tadchesley@gmail.com) should see a Settings → Admin Dashboard entry that opens a screen showing:
  - Total/Free/Premium user counts
  - Daily signups chart (last 30 days)
  - Active alerts count, total watchlist size
  - Estimated MRR (premium count × $4.99)
  - Recent signups list (last 50, with search by email/name)
  - Most-watched stocks
  - Provider breakdown (email/google/apple)
  - Ability to manually upgrade/downgrade a user's tier (free/premium-monthly/premium-yearly)

backend:
  - task: "Round 2 Premium: side-by-side compare + CSV exports"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
            Added 3 new premium-only endpoints:
            1. POST /api/predictions/compare — compares 2-4 stock symbols, returns predictions for all
               three horizons (1D/1W/1M) per symbol plus indicators (rsi, sma_20, sma_50, momentum, volatility).
               Free user → 403. <2 symbols → 400. >4 symbols → 400.
            2. GET /api/exports/screener.csv?min_confidence&direction&sector — returns text/csv with the
               filtered cached screener results. Free user → 403.
            3. GET /api/exports/watchlist.csv — returns text/csv of the current user's watchlist enriched
               with predictions from the cache. Free user → 403.
            
            All endpoints reuse the cache (instant) and validate inputs.
        -working: true
        -agent: "testing"
        -comment: |
            Round-2 backend test (/app/backend_test.py) — 13/14 PASS against public URL.
            
            A. POST /api/predictions/compare (all 6 sub-cases PASS):
              - FREE user with 2 symbols → 403 with detail "Premium required for side-by-side comparison" ✓
              - Admin POST /api/admin/users/{id}/tier {tier:premium,plan:monthly} → 200 ✓
              - PREMIUM user with 4 symbols [AAPL,MSFT,GOOGL,NVDA] → 200, count=4, items length=4.
                Each item has all required keys (symbol, name, sector, current_price, rsi_14, sma_20,
                sma_50, momentum_10, volatility, predictions). Predictions object has exactly keys
                ["1D","1W","1M"]; each horizon has direction, expected_return_pct, target_price,
                confidence, ai_score ✓
              - 1 symbol → 400 "Provide a list of at least 2 symbols" ✓
              - 5 symbols → 400 "Maximum 4 symbols allowed" ✓
              - Empty list → 400 ✓
            
            B. CSV exports (all 5 sub-cases PASS):
              - FREE user GET /exports/screener.csv → 403 ✓
              - PREMIUM user GET /exports/screener.csv → 200, Content-Type "text/csv; charset=utf-8".
                Header line exactly: "symbol,name,sector,ai_score,direction,current_price,target_price,
                expected_return_pct,confidence,rsi_14". Body has 871 data rows (cache fully warm) ✓
              - GET /exports/screener.csv?min_confidence=0.7&direction=UP → 200; parsed CSV verified
                all 21 returned rows have direction=UP and confidence>=0.7 ✓
              - PREMIUM GET /exports/watchlist.csv → 200, header row present, 0 data rows
                (empty watchlist for fresh user — expected) ✓
              - FREE GET /exports/watchlist.csv → 403 ✓
            
            C. Regression — 2/3 PASS, 1 FAIL:
              - GET /api/predictions/AAPL/horizons → 404 "Not Found" ❌ (see below)
              - POST /api/predictions/screener → 200, 871 results, total_in_cache=871 ✓
              - GET /api/admin/stats → 200, users.total=13, mrr=19.96 ✓
            
            CRITICAL ISSUE: GET /api/predictions/{symbol}/horizons returns 404. The function
            `prediction_horizons` exists in server.py (line 966) but the route decorator
            `@api.get("/predictions/{symbol}/horizons")` is MISSING — it was never wired into the
            APIRouter. This is a regression from Round-1 (when it was reportedly working). Main
            agent likely lost the decorator while editing the surrounding code. Fix is one line:
            add `@api.get("/predictions/{symbol}/horizons")` directly above the
            `async def prediction_horizons(...)` definition at line 966.

  - task: "Premium gating: screener filters + multi-horizon forecasts"
    implemented: true
    working: false
    file: "/app/backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
            Round 1 of paywall feature buildout.
            
            Backend changes:
            1. POST /api/predictions/screener — Free-tier users now have advanced filters silently capped:
               - min_confidence above 0.6 → reduced to 0.6
               - sector filter → cleared
               Response now includes tier, locked_filters[], free_max_confidence:0.6.
            2. New endpoint GET /api/predictions/{symbol}/horizons — returns 1D / 1W / 1M forecasts.
               Free users get the 1D forecast (preview) and locked stubs for 1W and 1M (premium_required:true).
               Premium users get all three with horizon-specific stat-prediction (different return factors,
               horizon-aware confidence penalty, weighted indicator usage by horizon).
            3. statistical_prediction() now accepts horizon_days param (1, 7, 30) and adjusts feature weights
               and return_factor accordingly so each horizon is meaningfully different.
        -working: true
        -agent: "testing"
        -comment: |
            Executed /app/backend_test_round1.py — 23/23 PASSED against live backend.
            
            A. Multi-horizon forecasts GET /api/predictions/AAPL/horizons:
              - Anonymous (no token) → 401 ✓
              - FREE user → 200 with tier="free", horizons array length 3 with keys [1D, 1W, 1M].
                1D: locked=false with full fields populated (direction=UP, ai_score=56.5,
                expected_return_pct=0.26, target_price=284.92, confidence=0.57). 1W & 1M: locked=true,
                premium_required=true, NO direction/target_price/confidence/ai_score keys present ✓
              - PREMIUM user (after admin tier upgrade {tier:premium,plan:yearly} and re-login) → 200
                with tier="premium". All 3 horizons unlocked with full fields. Return scaling verified:
                |1D|=0.26 < |1M|=3.45 (return_factor scales 0.04→0.10→0.15). Confidences [0.57, 0.64, 0.68]
                all in [0.5, 0.95] range ✓
            
            B. Screener filter gating POST /api/predictions/screener (cache fully warm: 871/871):
              - FREE user with {min_confidence:0.85, sector:"Technology"} → 200 with tier="free",
                locked_filters=["min_confidence_above_60","sector_filter"], free_max_confidence=0.6.
                Sector filter was cleared: 312 results spanning 15 distinct sectors (Technology was just
                one of many, confirming sector="Technology" was NOT applied) ✓
              - FREE user with {min_confidence:0.6, sector:null} → locked_filters=[] ✓
              - After demote→free, then re-promote→premium: PREMIUM user with {min_confidence:0.85,
                sector:"Technology"} → tier="premium", locked_filters=[], filters applied (returned 0
                results because no ticker has confidence>=0.85 AND sector="Technology" in current cache —
                vacuously correct, no rows violate constraints) ✓
            
            C. Regression:
              - GET /api/predictions/AAPL?deep=true (free user) → 200, premium_required=true,
                narrative starts with "🔒 Upgrade to Pav Premium for AI-powered narrative…" ✓
              - GET /api/auth/me → includes is_admin field (=false for the test user) ✓
            
            All 23 checks pass. No backend issues found.

  - task: "Admin endpoints (stats, signups chart, users list, set tier, top watched)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
            Added the following endpoints, all gated by require_admin (checks email is in ADMIN_EMAILS env var):
            - GET /api/admin/stats — returns users{total,free,premium,monthly_subs,yearly_subs,by_provider}, signups{today,7d,30d}, engagement{active_alerts,total_watchlist}, revenue{mrr,arr}
            - GET /api/admin/signups_chart?days=30 — returns daily signup counts
            - GET /api/admin/users?q=&limit=50&offset=0 — paginated user list with search
            - POST /api/admin/users/{user_id}/tier — sets a user's tier (free/premium) with optional plan (monthly/yearly)
            - GET /api/admin/top_watched?limit=10 — most-watched stocks across all users
            
            ADMIN_EMAILS env var added to /app/backend/.env: tadchesley@gmail.com, demo@alphapulse.app (the latter for testing).
            UserOut model now includes is_admin: bool, computed via is_admin_user() helper. Non-admins receive 403.
        -working: true
        -agent: "testing"
        -comment: |
            Executed /app/backend_test.py — 16/16 checks PASSED against live backend at EXPO_PUBLIC_BACKEND_URL.
            1) POST /auth/login demo@alphapulse.app → 200, user.is_admin=true.
            2) GET /admin/stats → 200 with fully-typed shape: users{total,free,premium,monthly_subs,yearly_subs:int, by_provider:object}, signups{today,last_7_days,last_30_days:int}, engagement{active_alerts,total_watchlist:int}, revenue{mrr:14.97, arr:179.64, currency:"USD"}.
            3) GET /admin/signups_chart?days=30 → series length exactly 30, each item has valid YYYY-MM-DD date + int count.
            4) GET /admin/users → returns {total, limit, offset, items}; items ≤ 50; every item has id, email, tier, provider, is_admin, created_at.
            5) GET /admin/users?q=demo → 3 matches, all containing 'demo'.
            6) GET /admin/top_watched?limit=10 → 200, {items:[...]}.
            7) POST /admin/users/{id}/tier {tier:premium,plan:yearly} on a freshly-created target user → 200, response {tier:"premium", plan:"yearly"}.
            8) POST same endpoint with {tier:"free"} → 200 response + verified via GET /admin/users that the user's tier="free" and plan=None.
            9) POST {tier:"invalid"} → 400 as expected.
            10) Gating verified: fresh non-admin signup returns is_admin=false; their token → 403 on /admin/stats; no-Authorization-header → 401.
            Regression: GET /auth/me (admin) returns is_admin:true; GET /alerts 200; GET /watchlist 200.
            Note: test initially had a client-side bug (unencoded '+' in query string also being a regex metachar); fixed the test to search by the 'tiertest' substring — no backend change required.

frontend:
  - task: "Admin Dashboard screen + Settings entry"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin.tsx, /app/frontend/app/(tabs)/settings.tsx, /app/frontend/src/api.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: |
            Created /app/frontend/app/admin.tsx with stat cards (Total/Premium/MRR/Signups today/Alerts/Watchlist),
            subscription stacked-bar, custom 30-day signup bar chart (pure RN Views), provider breakdown,
            most-watched list, searchable user list, and a bottom-sheet modal for tier management.
            Settings page shows the Admin Dashboard entry only if user.is_admin === true.
            User type extended with is_admin?: boolean.

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0

test_plan:
  current_focus:
    - "Premium gating: screener filters + multi-horizon forecasts"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
        Added admin dashboard backend endpoints. Please run backend tests for:
        1. POST /api/auth/login as demo@alphapulse.app / demo12345 → verify user.is_admin == true (this email is in ADMIN_EMAILS)
        2. GET /api/admin/stats with admin token → returns 200 with full structure
        3. GET /api/admin/signups_chart?days=30 → 200 with series[] of length 30
        4. GET /api/admin/users → returns paginated list with is_admin flag
        5. GET /api/admin/users?q=demo → returns filtered results
        6. GET /api/admin/top_watched → 200, list of {symbol,count}
        7. POST /api/admin/users/{id}/tier with body {tier:"premium",plan:"yearly"} → 200, sets premium yearly
        8. POST /api/admin/users/{id}/tier with body {tier:"free"} → 200, downgrades
        9. Sign up a NEW user (not in ADMIN_EMAILS), call any /api/admin/* with their token → must return 403
        10. Call /api/admin/* with no token → 401
        Skip frontend testing — user will verify the dashboard manually.
    -agent: "testing"
    -message: |
        Admin backend test suite (/app/backend_test.py) — 16/16 PASS against public URL.
        All 10 requested scenarios + regression (auth/me, alerts, watchlist) verified. Response shape for /admin/stats matches spec (integers everywhere, by_provider object, revenue.currency="USD"). Signups chart returns exactly 30 items with valid YYYY-MM-DD dates. Auth gating verified: admin=200, non-admin=403, no-token=401. Tier upgrade→yearly and downgrade→free (with list verification) both work; invalid tier returns 400. No backend issues found — task is ready to ship.
    -agent: "testing"
    -message: |
        Round-1 Premium gating test suite (/app/backend_test_round1.py) — 23/23 PASS against public URL.
        
        A. GET /api/predictions/AAPL/horizons:
          - Anonymous → 401
          - FREE: tier="free", 3 horizons. 1D unlocked w/ full fields (direction, expected_return_pct,
            target_price, confidence, ai_score). 1W & 1M locked=true, premium_required=true,
            and contain NO direction/target_price/confidence/ai_score keys (locked stub respected).
          - PREMIUM (after admin upgrade {tier:premium,plan:yearly}): tier="premium", all 3 horizons
            unlocked w/ full fields. Return scaling verified: |1D|=0.26 < |1M|=3.45 (return_factor
            scales 0.04→0.10→0.15). Confidences [0.57, 0.64, 0.68] all in [0.5, 0.95].
        
        B. POST /api/predictions/screener (cache fully warm: 871 predictions):
          - FREE w/ {min_confidence:0.85, sector:"Technology"}: tier="free",
            locked_filters=["min_confidence_above_60","sector_filter"], free_max_confidence=0.6.
            Sector filter cleared: 312 results spanning 15 distinct sectors.
          - FREE w/ {min_confidence:0.6, sector:null}: locked_filters=[].
          - PREMIUM (after demote→re-promote) w/ {min_confidence:0.85, sector:"Technology"}:
            tier="premium", locked_filters=[], filters applied (0 results because no ticker
            currently has confidence>=0.85 AND Technology sector — vacuously correct).
        
        C. Regression: GET /api/predictions/AAPL?deep=true (free) returns premium_required=true with
           "🔒 Upgrade…" narrative. GET /api/auth/me includes is_admin field.
        
        No backend issues found — Round-1 gating is ready to ship.
    -agent: "testing"
    -message: |
        Round-2 Premium test suite (/app/backend_test.py) — 13/14 PASS against public URL.
        
        PASSED:
        A. POST /api/predictions/compare (6/6):
          - FREE → 403 "Premium required for side-by-side comparison"
          - Admin tier flip → 200; PREMIUM /compare with 4 symbols → 200 with count=4, items length=4,
            each item containing all required keys, predictions object {1D,1W,1M} each with
            direction/expected_return_pct/target_price/confidence/ai_score
          - 1 symbol → 400, 5 symbols → 400, empty → 400
        
        B. CSV exports (5/5):
          - FREE /exports/screener.csv → 403; FREE /exports/watchlist.csv → 403
          - PREMIUM /exports/screener.csv → 200 text/csv, exact required header, 871 data rows
          - /exports/screener.csv?min_confidence=0.7&direction=UP → 200, all 21 returned rows
            verified direction=UP and confidence>=0.7
          - PREMIUM /exports/watchlist.csv → 200 with header (0 data rows for fresh user)
        
        C. Regression (2/3):
          - POST /api/predictions/screener → 200 with 871 results ✓
          - GET /api/admin/stats → 200, well-formed ✓
          - GET /api/predictions/AAPL/horizons → 404 Not Found ❌ REGRESSION
        
        ROOT CAUSE for the 1 failure: In /app/backend/server.py the function `prediction_horizons`
        is defined at line 966 but its route decorator `@api.get("/predictions/{symbol}/horizons")`
        is MISSING. The function exists but is never wired to the APIRouter, so requests get 404.
        Round-1 had this endpoint working — the decorator was lost in a subsequent edit when the
        new compare/exports endpoints were added. One-line fix: add
        `@api.get("/predictions/{symbol}/horizons")` directly above `async def prediction_horizons`.
        I did NOT apply the fix (per testing-agent guidelines — main agent's responsibility to fix).
        
        Round-2 new endpoints (compare + CSV exports) themselves are fully working and ready to ship.
