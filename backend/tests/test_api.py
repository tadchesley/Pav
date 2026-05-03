"""Backend API tests for AI Stock Prediction."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://market-forecast-ai-12.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@alphapulse.app"
DEMO_PASS = "demo12345"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    # try login, if fails signup
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    if r.status_code != 200:
        r = session.post(f"{API}/auth/signup", json={"email": DEMO_EMAIL, "password": DEMO_PASS, "full_name": "Demo"})
    assert r.status_code == 200, f"Login/signup failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def fresh_token(session):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": "testpass123", "full_name": "Test"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"], email


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_signup_and_token(self, fresh_token):
        token, email = fresh_token
        assert token

    def test_login_demo(self, demo_token):
        assert demo_token

    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_social_login(self, session):
        email = f"social_{uuid.uuid4().hex[:8]}@test.com"
        r = session.post(f"{API}/auth/social", json={"provider": "google", "email": email, "full_name": "Soc"})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == email
        assert data["access_token"]
        # second call same email -> login
        r2 = session.post(f"{API}/auth/social", json={"provider": "google", "email": email})
        assert r2.status_code == 200
        assert r2.json()["user"]["email"] == email

    def test_social_invalid_provider(self, session):
        r = session.post(f"{API}/auth/social", json={"provider": "facebook", "email": "x@y.com"})
        assert r.status_code == 400

    def test_me(self, session, demo_token):
        r = session.get(f"{API}/auth/me", headers=auth_headers(demo_token))
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_theme_persist(self, session, demo_token):
        r = session.put(f"{API}/auth/theme", json={"theme": "light"}, headers=auth_headers(demo_token))
        assert r.status_code == 200
        assert r.json()["theme"] == "light"
        # verify
        r2 = session.get(f"{API}/auth/me", headers=auth_headers(demo_token))
        assert r2.json()["theme"] == "light"
        # restore
        session.put(f"{API}/auth/theme", json={"theme": "dark"}, headers=auth_headers(demo_token))


# ---------- Stocks ----------
class TestStocks:
    def test_quote(self, session):
        r = session.get(f"{API}/stocks/quote/AAPL")
        assert r.status_code == 200
        d = r.json()
        assert d["symbol"] == "AAPL"
        assert d["price"] > 0
        assert "change" in d and "change_pct" in d

    def test_candles(self, session):
        r = session.get(f"{API}/stocks/candles/AAPL")
        assert r.status_code == 200
        d = r.json()
        assert len(d["close"]) > 0
        assert len(d["timestamps"]) == len(d["close"])

    def test_search(self, session):
        r = session.get(f"{API}/stocks/search", params={"q": "apple"})
        assert r.status_code == 200
        results = r.json()["results"]
        assert any(x["symbol"] == "AAPL" for x in results)

    def test_universe(self, session):
        r = session.get(f"{API}/stocks/universe")
        assert r.status_code == 200
        assert len(r.json()["stocks"]) >= 20


# ---------- Predictions ----------
class TestPredictions:
    def test_prediction_shallow(self, session, demo_token):
        r = session.get(f"{API}/predictions/AAPL", params={"deep": "false"}, headers=auth_headers(demo_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("ai_score", "direction", "confidence", "narrative", "key_factors", "risks", "feature_importance", "indicators"):
            assert k in d

    def test_prediction_deep_llm(self, session, demo_token):
        r = session.get(f"{API}/predictions/MSFT", params={"deep": "true"}, headers=auth_headers(demo_token), timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["narrative"]
        assert isinstance(d["key_factors"], list) and len(d["key_factors"]) >= 1
        assert isinstance(d["feature_importance"], dict)

    def test_top_movers(self, session, demo_token):
        r = session.get(f"{API}/predictions/top/movers", headers=auth_headers(demo_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["gainers"]) > 0 and len(d["losers"]) > 0
        assert "market_sentiment" in d
        assert "sentiment_label" in d

    def test_screener(self, session, demo_token):
        r = session.post(f"{API}/predictions/screener", json={"direction": "UP", "min_confidence": 0.5}, headers=auth_headers(demo_token), timeout=30)
        assert r.status_code == 200
        results = r.json()["results"]
        for it in results:
            assert it["direction"] == "UP"
            assert it["confidence"] >= 0.5

    def test_screener_sector(self, session, demo_token):
        r = session.post(f"{API}/predictions/screener", json={"sector": "Technology"}, headers=auth_headers(demo_token), timeout=30)
        assert r.status_code == 200
        for it in r.json()["results"]:
            assert it.get("sector") == "Technology"


# ---------- Watchlist ----------
class TestWatchlist:
    def test_watchlist_crud(self, session, fresh_token):
        token, _ = fresh_token
        h = auth_headers(token)
        # add
        r = session.post(f"{API}/watchlist", json={"symbol": "AAPL"}, headers=h)
        assert r.status_code == 200
        # duplicate
        r2 = session.post(f"{API}/watchlist", json={"symbol": "AAPL"}, headers=h)
        assert r2.status_code == 400
        # get enriched
        r3 = session.get(f"{API}/watchlist", headers=h, timeout=30)
        assert r3.status_code == 200
        items = r3.json()["items"]
        assert any(it["symbol"] == "AAPL" for it in items)
        item = next(i for i in items if i["symbol"] == "AAPL")
        for k in ("current_price", "ai_score", "direction", "confidence"):
            assert k in item
        # delete
        r4 = session.delete(f"{API}/watchlist/AAPL", headers=h)
        assert r4.status_code == 200
        # delete again -> 404
        r5 = session.delete(f"{API}/watchlist/AAPL", headers=h)
        assert r5.status_code == 404


# ---------- Alerts ----------
class TestAlerts:
    def test_alert_crud(self, session, fresh_token):
        token, _ = fresh_token
        h = auth_headers(token)
        r = session.post(f"{API}/alerts", json={"symbol": "MSFT", "target_price": 1.0, "direction": "above"}, headers=h)
        assert r.status_code == 200
        alert_id = r.json()["id"]
        # invalid direction
        r_bad = session.post(f"{API}/alerts", json={"symbol": "MSFT", "target_price": 1.0, "direction": "sideways"}, headers=h)
        assert r_bad.status_code in (400, 422)
        # list
        r2 = session.get(f"{API}/alerts", headers=h)
        assert r2.status_code == 200
        items = r2.json()["items"]
        assert any(a["id"] == alert_id for a in items)
        a = next(x for x in items if x["id"] == alert_id)
        assert "current_price" in a
        # since target is $1 above and price > $1 always, should be triggered
        assert a.get("triggered") is True
        # delete
        r3 = session.delete(f"{API}/alerts/{alert_id}", headers=h)
        assert r3.status_code == 200
        r4 = session.delete(f"{API}/alerts/{alert_id}", headers=h)
        assert r4.status_code == 404


# ---------- Subscription ----------
class TestSubscription:
    def test_upgrade(self, session, fresh_token):
        token, _ = fresh_token
        r = session.post(f"{API}/subscription/upgrade", headers=auth_headers(token))
        assert r.status_code == 200
        assert r.json()["tier"] == "premium"
        # verify via me
        r2 = session.get(f"{API}/auth/me", headers=auth_headers(token))
        assert r2.json()["tier"] == "premium"
