"""AI Stock Prediction Backend — FastAPI + MongoDB + Finnhub + Emergent LLM."""
import os
import uuid
import logging
import asyncio
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

import httpx
import bcrypt
import yfinance as yf
from jose import jwt, JWTError
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

from tickers_data import TICKERS, TICKERS_DICT, TICKER_COUNT

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------- Config ----------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
FINNHUB_API_KEY = os.environ.get("FINNHUB_API_KEY", "")
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ["JWT_ALGORITHM"]
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"])

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="AI Stock Prediction API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ---------- Models ----------
class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class SocialReq(BaseModel):
    provider: str  # "google" or "apple"
    email: EmailStr
    full_name: Optional[str] = None

class ProfileUpdateReq(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None  # required if changing email

class PasswordChangeReq(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)

class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    tier: str = "free"
    theme: str = "dark"
    created_at: datetime

class AuthResp(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class WatchlistAdd(BaseModel):
    symbol: str

class AlertCreate(BaseModel):
    symbol: str
    target_price: float
    direction: str  # "above" or "below"

# ---------- Auth helpers ----------
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False

def create_token(user_id: str, email: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "email": email, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def user_to_out(doc: dict) -> UserOut:
    return UserOut(
        id=doc["id"],
        email=doc["email"],
        full_name=doc.get("full_name"),
        tier=doc.get("tier", "free"),
        theme=doc.get("theme", "dark"),
        created_at=doc["created_at"],
    )

async def current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    if not cred:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

# ---------- Finnhub service ----------
FINNHUB_BASE = "https://finnhub.io/api/v1"

# Top 100 by market cap (curated mega-caps + popular liquid names) — used for dashboard movers (fast)
SCREENER_UNIVERSE_SYMBOLS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "AVGO", "LLY",
    "JPM", "V", "XOM", "UNH", "MA", "PG", "JNJ", "HD", "COST", "ORCL",
    "ABBV", "BAC", "CVX", "MRK", "KO", "WMT", "NFLX", "CRM", "AMD", "PEP",
    "TMO", "LIN", "ADBE", "CSCO", "WFC", "MCD", "ACN", "ABT", "DIS", "DHR",
    "VZ", "INTC", "QCOM", "CAT", "TXN", "PFE", "INTU", "AMGN", "AMAT", "MS",
    "IBM", "NEE", "GS", "RTX", "UNP", "HON", "LOW", "PM", "COP", "UPS",
    "BKNG", "GE", "AXP", "SPGI", "ELV", "ISRG", "CMCSA", "MDT", "LMT", "NOW",
    "PLD", "T", "BA", "BLK", "DE", "SCHW", "SBUX", "ADI", "GILD", "MDLZ",
    "TSM", "ASML", "BABA", "NVO", "SHEL", "TM", "BHP", "AZN", "NVS", "UL",
    "SPY", "QQQ", "VOO", "IVV", "VTI", "DIA", "IWM", "GLD", "TLT", "XLK",
]

# Full universe = ALL 871 tickers (used for screener)
ALL_UNIVERSE_SYMBOLS = list(TICKERS_DICT.keys())

# In-memory screener cache (5-min TTL)
_screener_cache: dict = {"data": None, "ts": 0, "warming": False, "progress": 0, "total": 0}
_SCREENER_CACHE_TTL = 300


async def _warm_screener_cache():
    """Background task: build screener predictions for all 871 tickers in batches."""
    if _screener_cache["warming"]:
        return
    _screener_cache["warming"] = True
    _screener_cache["progress"] = 0
    _screener_cache["total"] = len(ALL_UNIVERSE_SYMBOLS)
    try:
        partial: list = []
        chunk_size = 50
        for i in range(0, len(ALL_UNIVERSE_SYMBOLS), chunk_size):
            chunk = ALL_UNIVERSE_SYMBOLS[i:i + chunk_size]
            chunk_results = await asyncio.gather(
                *[build_prediction(s, use_llm=False) for s in chunk],
                return_exceptions=True,
            )
            for r in chunk_results:
                if isinstance(r, dict):
                    partial.append({k: v for k, v in r.items()
                                    if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")})
            _screener_cache["progress"] = i + len(chunk)
            # Update partial cache so frontend can show data progressively
            _screener_cache["data"] = list(partial)
        _screener_cache["data"] = partial
        _screener_cache["ts"] = datetime.now(timezone.utc).timestamp()
        logger.info(f"Screener cache warm complete: {len(partial)} predictions")
    finally:
        _screener_cache["warming"] = False

# Use ticker list as the primary ticker source
SEED_BY_SYMBOL = TICKERS_DICT


# yfinance cache (in-memory, 60s TTL)
_yf_cache: dict = {}
_yf_cache_ttl = 60  # seconds


def yf_quote(symbol: str) -> Optional[dict]:
    """Fetch real quote from Yahoo Finance via yfinance. Cached 60s."""
    now = datetime.now(timezone.utc).timestamp()
    cached = _yf_cache.get(symbol)
    if cached and now - cached["ts"] < _yf_cache_ttl:
        return cached["data"]
    try:
        t = yf.Ticker(symbol)
        info = t.fast_info
        price = float(info.get("last_price") or 0) or float(info.get("lastPrice") or 0) or 0
        prev = float(info.get("previous_close") or 0) or float(info.get("previousClose") or 0) or 0
        if price <= 0:
            return None
        change = price - prev if prev > 0 else 0
        data = {
            "c": round(price, 2),
            "d": round(change, 2),
            "dp": round((change / prev) * 100, 2) if prev > 0 else 0,
            "h": round(float(info.get("day_high") or info.get("dayHigh") or price), 2),
            "l": round(float(info.get("day_low") or info.get("dayLow") or price), 2),
            "o": round(float(info.get("open") or price - change * 0.3), 2),
            "pc": round(prev, 2),
            "t": int(now),
        }
        _yf_cache[symbol] = {"ts": now, "data": data}
        return data
    except Exception as e:
        logger.debug(f"yfinance quote failed for {symbol}: {e}")
        return None


def yf_candles(symbol: str, days: int = 90) -> Optional[dict]:
    """Fetch historical OHLCV from Yahoo Finance."""
    try:
        t = yf.Ticker(symbol)
        period = "1y" if days > 90 else ("6mo" if days > 60 else "3mo")
        hist = t.history(period=period, interval="1d")
        if hist is None or hist.empty:
            return None
        hist = hist.tail(days)
        return {
            "c": [round(float(x), 2) for x in hist["Close"].tolist()],
            "o": [round(float(x), 2) for x in hist["Open"].tolist()],
            "h": [round(float(x), 2) for x in hist["High"].tolist()],
            "l": [round(float(x), 2) for x in hist["Low"].tolist()],
            "v": [int(x) for x in hist["Volume"].tolist()],
            "t": [int(ts.timestamp()) for ts in hist.index],
            "s": "ok",
        }
    except Exception as e:
        logger.debug(f"yfinance candles failed for {symbol}: {e}")
        return None

# Fallback seed data for demo when no Finnhub key is configured
# (Old SEED_TICKERS list removed — now sourced from tickers_data.TICKERS)

async def finnhub_get(path: str, params: dict) -> Optional[dict]:
    if not FINNHUB_API_KEY:
        return None
    params = {**params, "token": FINNHUB_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(f"{FINNHUB_BASE}/{path}", params=params)
            if r.status_code == 200:
                return r.json()
    except Exception as e:
        logger.warning(f"Finnhub call failed: {e}")
    return None


# Hash-based deterministic price for unknown tickers (last-resort fallback)
def _seed_price_for(symbol: str) -> float:
    h = abs(hash(symbol)) % 100000
    return 20 + (h % 800)  # $20-$820 range


def mock_quote(symbol: str) -> dict:
    base_price = _seed_price_for(symbol)
    seed = hash(symbol + datetime.now(timezone.utc).strftime("%Y-%m-%d")) % 10000
    rng = random.Random(seed)
    price = base_price * (1 + rng.uniform(-0.02, 0.02))
    change = price * rng.uniform(-0.03, 0.03)
    return {
        "c": round(price, 2),
        "d": round(change, 2),
        "dp": round((change / price) * 100, 2),
        "h": round(price * 1.01, 2),
        "l": round(price * 0.99, 2),
        "o": round(price - change * 0.3, 2),
        "pc": round(price - change, 2),
        "t": int(datetime.now(timezone.utc).timestamp()),
    }


def mock_candles(symbol: str, days: int = 90) -> dict:
    base = _seed_price_for(symbol)
    rng = random.Random(hash(symbol) % 10000)
    price = base * 0.92
    closes, opens, highs, lows, vols, ts = [], [], [], [], [], []
    now = int(datetime.now(timezone.utc).timestamp())
    for i in range(days):
        drift = rng.uniform(-0.025, 0.028)
        o = price
        price = price * (1 + drift)
        h = max(o, price) * (1 + abs(rng.uniform(0, 0.01)))
        l = min(o, price) * (1 - abs(rng.uniform(0, 0.01)))
        closes.append(round(price, 2))
        opens.append(round(o, 2))
        highs.append(round(h, 2))
        lows.append(round(l, 2))
        vols.append(int(rng.uniform(1e6, 5e7)))
        ts.append(now - (days - i) * 86400)
    return {"c": closes, "o": opens, "h": highs, "l": lows, "v": vols, "t": ts, "s": "ok"}


async def get_quote(symbol: str) -> dict:
    """Order: Finnhub (if key) → yfinance (real) → mock fallback."""
    data = await finnhub_get("quote", {"symbol": symbol})
    if data and data.get("c"):
        return data
    yf_data = await asyncio.to_thread(yf_quote, symbol)
    if yf_data:
        return yf_data
    return mock_quote(symbol)


async def get_candles(symbol: str, days: int = 90) -> dict:
    """Order: Finnhub (if key) → yfinance (real) → mock fallback."""
    to_ts = int(datetime.now(timezone.utc).timestamp())
    from_ts = to_ts - days * 86400
    data = await finnhub_get("stock/candle", {"symbol": symbol, "resolution": "D", "from": from_ts, "to": to_ts})
    if data and data.get("s") == "ok":
        return data
    yf_data = await asyncio.to_thread(yf_candles, symbol, days)
    if yf_data:
        return yf_data
    return mock_candles(symbol, days)


# ---------- Technical indicators ----------
def calc_rsi(closes: List[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(-period, 0):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    avg_g = sum(gains) / period
    avg_l = sum(losses) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return round(100 - 100 / (1 + rs), 2)


def calc_sma(closes: List[float], period: int) -> Optional[float]:
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 2)


def calc_momentum(closes: List[float], period: int = 10) -> float:
    if len(closes) < period + 1:
        return 0.0
    return round(((closes[-1] - closes[-period - 1]) / closes[-period - 1]) * 100, 2)


def calc_volatility(closes: List[float]) -> float:
    if len(closes) < 2:
        return 0.0
    returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
    mean = sum(returns) / len(returns)
    var = sum((r - mean) ** 2 for r in returns) / len(returns)
    return round((var ** 0.5) * 100, 2)


def compute_indicators(candles: dict) -> dict:
    closes = candles["c"]
    return {
        "rsi_14": calc_rsi(closes, 14),
        "sma_20": calc_sma(closes, 20),
        "sma_50": calc_sma(closes, 50),
        "sma_200": calc_sma(closes, 200) if len(closes) >= 200 else calc_sma(closes, len(closes)),
        "momentum_10": calc_momentum(closes, 10),
        "volatility": calc_volatility(closes[-30:] if len(closes) >= 30 else closes),
        "current": closes[-1] if closes else 0,
    }


def statistical_prediction(symbol: str, indicators: dict, candles: dict) -> dict:
    """Fast heuristic prediction based on indicators."""
    score = 50  # neutral baseline
    rsi = indicators["rsi_14"]
    current = indicators["current"]
    sma20 = indicators["sma_20"] or current
    sma50 = indicators["sma_50"] or current
    momentum = indicators["momentum_10"]

    if rsi < 30:
        score += 15  # oversold
    elif rsi > 70:
        score -= 15  # overbought
    else:
        score += (50 - rsi) * 0.2

    if current > sma20:
        score += 8
    if sma20 > sma50:
        score += 10
    score += max(min(momentum * 1.2, 15), -15)

    score = max(0, min(100, score))
    direction = "UP" if score > 52 else ("DOWN" if score < 48 else "NEUTRAL")
    expected_return_pct = round((score - 50) * 0.15, 2)
    target_price = round(current * (1 + expected_return_pct / 100), 2)
    confidence = round(min(0.95, 0.5 + abs(score - 50) / 100), 2)

    return {
        "symbol": symbol,
        "ai_score": round(score, 1),
        "direction": direction,
        "expected_return_pct": expected_return_pct,
        "target_price": target_price,
        "confidence": confidence,
        "horizon_days": 30,
    }


# ---------- LLM analysis ----------
async def llm_analysis(symbol: str, indicators: dict, stat_pred: dict, profile: dict) -> dict:
    """Use Emergent LLM (Claude Sonnet 4.5) for deep analysis."""
    if not EMERGENT_LLM_KEY:
        return {
            "narrative": "LLM analysis unavailable. Statistical model indicates " + stat_pred["direction"] + " bias.",
            "key_factors": ["RSI: " + str(indicators["rsi_14"]), "20-day SMA trend", "10-day momentum"],
            "risks": ["Market volatility", "Macro events"],
            "feature_importance": {"rsi": 0.3, "moving_avg": 0.3, "momentum": 0.25, "volatility": 0.15},
        }

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        session_id = f"analyze-{symbol}-{uuid.uuid4().hex[:8]}"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=(
                "You are a seasoned equities analyst. Return ONLY valid JSON with keys: "
                "narrative (2-3 sentences, investor-friendly), "
                "key_factors (array of 3-4 short strings), "
                "risks (array of 2-3 short strings), "
                "feature_importance (object with keys rsi, moving_avg, momentum, volatility, sentiment — numeric values summing to 1). "
                "No markdown, no prose outside JSON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5")

        prompt = (
            f"Analyze {symbol} ({profile.get('name','')}).\n"
            f"Current: ${indicators['current']} | RSI: {indicators['rsi_14']} | "
            f"SMA20: {indicators['sma_20']} | SMA50: {indicators['sma_50']} | "
            f"Momentum10: {indicators['momentum_10']}% | Volatility: {indicators['volatility']}%\n"
            f"Statistical model: {stat_pred['direction']} with {int(stat_pred['confidence']*100)}% confidence, "
            f"target ${stat_pred['target_price']} over {stat_pred['horizon_days']} days.\n"
            f"Return the JSON now."
        )
        reply = await chat.send_message(UserMessage(text=prompt))

        import json as _json
        text = reply.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = _json.loads(text[start:end])
            # normalize
            fi = parsed.get("feature_importance", {})
            return {
                "narrative": parsed.get("narrative", "")[:500],
                "key_factors": parsed.get("key_factors", [])[:5],
                "risks": parsed.get("risks", [])[:5],
                "feature_importance": {k: float(v) for k, v in fi.items()} if fi else {
                    "rsi": 0.25, "moving_avg": 0.3, "momentum": 0.25, "volatility": 0.1, "sentiment": 0.1
                },
            }
    except Exception as e:
        logger.warning(f"LLM analysis failed for {symbol}: {e}")

    return {
        "narrative": f"Statistical model projects {stat_pred['direction']} with {int(stat_pred['confidence']*100)}% confidence.",
        "key_factors": ["RSI " + str(indicators["rsi_14"]), "Trend vs SMA20/50", "Recent momentum"],
        "risks": ["Market volatility", "Macro headwinds"],
        "feature_importance": {"rsi": 0.3, "moving_avg": 0.3, "momentum": 0.25, "volatility": 0.15},
    }


# ---------- Tier limits ----------
FREE_LIMITS = {
    "watchlist_max": 15,
    "alerts_max": 3,
    "candles_days_max": 7,
    "deep_analysis": False,  # LLM narrative is premium-only
}
PREMIUM_LIMITS = {
    "watchlist_max": 99999,
    "alerts_max": 99999,
    "candles_days_max": 365,
    "deep_analysis": True,
}


def get_limits(user: dict) -> dict:
    return PREMIUM_LIMITS if user.get("tier") == "premium" else FREE_LIMITS


# ---------- Auth routes ----------
@api.get("/")
async def root():
    return {"message": "AI Stock Prediction API", "version": "1.0"}


@api.post("/auth/signup", response_model=AuthResp)
async def signup(req: SignupReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": req.email.lower(),
        "password_hash": hash_pw(req.password),
        "full_name": req.full_name,
        "tier": "free",
        "theme": "dark",
        "provider": "email",
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, req.email.lower())
    return AuthResp(access_token=token, user=user_to_out(doc))


@api.post("/auth/login", response_model=AuthResp)
async def login(req: LoginReq):
    doc = await db.users.find_one({"email": req.email.lower()})
    if not doc or not doc.get("password_hash") or not verify_pw(req.password, doc["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(doc["id"], doc["email"])
    return AuthResp(access_token=token, user=user_to_out(doc))


@api.post("/auth/social", response_model=AuthResp)
async def social_login(req: SocialReq):
    """Demo social login — accepts provider + email (Google/Apple). In prod, verify ID token."""
    if req.provider not in ("google", "apple"):
        raise HTTPException(400, "Unsupported provider")
    email = req.email.lower()
    doc = await db.users.find_one({"email": email})
    if not doc:
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "email": email,
            "password_hash": None,
            "full_name": req.full_name,
            "tier": "free",
            "theme": "dark",
            "provider": req.provider,
            "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(doc)
    token = create_token(doc["id"], email)
    return AuthResp(access_token=token, user=user_to_out(doc))


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return user_to_out(user)


@api.get("/auth/limits")
async def my_limits(user=Depends(current_user)):
    """Returns tier limits + current usage for free vs premium awareness."""
    limits = get_limits(user)
    watch_count = await db.watchlist.count_documents({"user_id": user["id"]})
    alerts_count = await db.alerts.count_documents({"user_id": user["id"], "status": "active"})
    return {
        "tier": user.get("tier", "free"),
        "limits": limits,
        "usage": {"watchlist": watch_count, "alerts_active": alerts_count},
    }


@api.put("/auth/profile", response_model=UserOut)
async def update_profile(req: ProfileUpdateReq, user=Depends(current_user)):
    full = await db.users.find_one({"id": user["id"]})
    updates: dict = {}
    if req.full_name is not None:
        updates["full_name"] = req.full_name
    if req.email and req.email.lower() != user["email"]:
        # Email change requires current password verification (for email-tier users)
        if full and full.get("password_hash"):
            if not req.current_password or not verify_pw(req.current_password, full["password_hash"]):
                raise HTTPException(401, "Current password is required to change email")
        # Ensure email isn't taken
        existing = await db.users.find_one({"email": req.email.lower()})
        if existing and existing["id"] != user["id"]:
            raise HTTPException(400, "Email already in use")
        updates["email"] = req.email.lower()
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    refreshed = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return user_to_out(refreshed)


@api.put("/auth/password")
async def change_password(req: PasswordChangeReq, user=Depends(current_user)):
    # Fetch full record (current_user excludes password_hash)
    full = await db.users.find_one({"id": user["id"]})
    if not full or not full.get("password_hash"):
        raise HTTPException(400, "Account uses social sign-in — no password to change")
    if not verify_pw(req.current_password, full["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(req.new_password)}})
    return {"status": "password_updated"}


@api.put("/auth/theme")
async def update_theme(body: dict, user=Depends(current_user)):
    theme = body.get("theme", "dark")
    if theme not in ("dark", "light"):
        raise HTTPException(400, "Invalid theme")
    await db.users.update_one({"id": user["id"]}, {"$set": {"theme": theme}})
    return {"theme": theme}


# ---------- Stock routes ----------
@api.get("/stocks/universe")
async def get_universe():
    return {"stocks": list(TICKERS_DICT.values()), "count": TICKER_COUNT}


@api.get("/stocks/search")
async def search_stocks(q: str):
    q_upper = q.upper()
    q_lower = q.lower()
    # First try Finnhub for global search
    data = await finnhub_get("search", {"q": q_upper})
    if data and data.get("result"):
        return {"results": [
            {"symbol": r["symbol"], "description": r.get("description", ""), "type": r.get("type", "")}
            for r in data["result"][:15]
        ]}
    # Fallback: filter our embedded ticker list
    results = []
    for t in TICKERS:
        sym, name, _ = t
        if q_upper in sym or q_lower in name.lower():
            results.append({"symbol": sym, "description": name, "type": "Common Stock"})
            if len(results) >= 15:
                break
    return {"results": results}


@api.get("/stocks/quote/{symbol}")
async def quote(symbol: str):
    symbol = symbol.upper()
    q = await get_quote(symbol)
    seed = TICKERS_DICT.get(symbol, {})
    return {
        "symbol": symbol,
        "name": seed.get("name", symbol),
        "sector": seed.get("sector"),
        "price": q.get("c", 0),
        "change": q.get("d", 0),
        "change_pct": q.get("dp", 0),
        "high": q.get("h", 0),
        "low": q.get("l", 0),
        "open": q.get("o", 0),
        "prev_close": q.get("pc", 0),
    }


@api.get("/stocks/candles/{symbol}")
async def candles(symbol: str, days: int = 90, user=Depends(current_user)):
    symbol = symbol.upper()
    max_days = get_limits(user)["candles_days_max"]
    capped_days = min(days, max_days)
    c = await get_candles(symbol, capped_days)
    return {
        "symbol": symbol,
        "timestamps": c.get("t", []),
        "close": c.get("c", []),
        "open": c.get("o", []),
        "high": c.get("h", []),
        "low": c.get("l", []),
        "volume": c.get("v", []),
        "days_returned": capped_days,
        "days_max_for_tier": max_days,
    }


# ---------- Prediction routes ----------
async def build_prediction(symbol: str, use_llm: bool) -> dict:
    symbol = symbol.upper()
    quote_data, candle_data = await asyncio.gather(get_quote(symbol), get_candles(symbol, 90))
    indicators = compute_indicators(candle_data)
    if indicators["current"] == 0:
        indicators["current"] = quote_data.get("c", 0)
    stat_pred = statistical_prediction(symbol, indicators, candle_data)

    profile = TICKERS_DICT.get(symbol, {"name": symbol, "sector": "Unknown"})

    narrative_data = await llm_analysis(symbol, indicators, stat_pred, profile) if use_llm else {
        "narrative": f"Quick statistical signal: {stat_pred['direction']} with {int(stat_pred['confidence']*100)}% confidence.",
        "key_factors": [f"RSI {indicators['rsi_14']}", f"SMA20 ${indicators['sma_20']}", f"Momentum {indicators['momentum_10']}%"],
        "risks": ["Market volatility"],
        "feature_importance": {"rsi": 0.3, "moving_avg": 0.3, "momentum": 0.25, "volatility": 0.15},
    }

    return {
        **stat_pred,
        "name": profile.get("name", symbol),
        "sector": profile.get("sector"),
        "current_price": indicators["current"],
        "indicators": indicators,
        "narrative": narrative_data["narrative"],
        "key_factors": narrative_data["key_factors"],
        "risks": narrative_data["risks"],
        "feature_importance": narrative_data["feature_importance"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/predictions/{symbol}")
async def prediction(symbol: str, deep: bool = True, user=Depends(current_user)):
    # Gate deep LLM analysis to premium tier
    use_deep = deep and get_limits(user)["deep_analysis"]
    result = await build_prediction(symbol, use_llm=use_deep)
    if deep and not use_deep:
        # Free tier: signal that deep analysis is gated
        result["narrative"] = "🔒 Upgrade to Pav Premium for AI-powered narrative analysis with Claude Sonnet 4.5."
        result["key_factors"] = []
        result["risks"] = []
        result["feature_importance"] = {}
        result["premium_required"] = True
    # audit log
    await db.predictions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": symbol.upper(),
        "ai_score": result["ai_score"],
        "direction": result["direction"],
        "confidence": result["confidence"],
        "created_at": datetime.now(timezone.utc),
    })
    return result


@api.get("/predictions/top/movers")
async def top_movers(user=Depends(current_user)):
    """Top predicted gainers and losers (statistical only for speed) — top 100 universe."""
    tasks = [build_prediction(s, use_llm=False) for s in SCREENER_UNIVERSE_SYMBOLS]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    valid = [r for r in results if isinstance(r, dict)]
    gainers = sorted(valid, key=lambda x: -x["ai_score"])[:5]
    losers = sorted(valid, key=lambda x: x["ai_score"])[:5]
    sentiment_score = round(sum(r["ai_score"] for r in valid) / len(valid), 1) if valid else 50
    return {
        "gainers": [{k: v for k, v in g.items() if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")} for g in gainers],
        "losers": [{k: v for k, v in l.items() if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")} for l in losers],
        "market_sentiment": sentiment_score,
        "sentiment_label": "Bullish" if sentiment_score > 55 else ("Bearish" if sentiment_score < 45 else "Neutral"),
    }


@api.post("/predictions/screener")
async def screener(body: dict, user=Depends(current_user)):
    """Returns cached predictions for ALL 871 tickers. Cache rebuilds in background — never blocks request."""
    min_conf = body.get("min_confidence", 0)
    min_return = body.get("min_return", -100)
    direction = body.get("direction")
    sector = body.get("sector")

    now = datetime.now(timezone.utc).timestamp()
    cache_stale = _screener_cache["data"] is None or (now - _screener_cache["ts"]) > _SCREENER_CACHE_TTL
    if cache_stale and not _screener_cache["warming"]:
        # Kick off background warm — DON'T await
        asyncio.create_task(_warm_screener_cache())

    data = _screener_cache["data"] or []
    out = []
    for r in data:
        if r["confidence"] < min_conf:
            continue
        if r["expected_return_pct"] < min_return:
            continue
        if direction and r["direction"] != direction:
            continue
        if sector and r.get("sector") != sector:
            continue
        out.append(r)
    out.sort(key=lambda x: -x["ai_score"])
    return {
        "results": out,
        "total_in_cache": len(data),
        "warming": _screener_cache["warming"],
        "progress": _screener_cache["progress"],
        "total_universe": _screener_cache["total"] or len(ALL_UNIVERSE_SYMBOLS),
        "cache_age_seconds": int(now - _screener_cache["ts"]) if _screener_cache["ts"] else None,
    }


# ---------- Watchlist ----------
@api.get("/watchlist")
async def get_watchlist(user=Depends(current_user)):
    items = await db.watchlist.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    if not items:
        return {"items": []}
    # enrich with quote + quick prediction
    preds = await asyncio.gather(*[build_prediction(it["symbol"], use_llm=False) for it in items])
    enriched = []
    for it, p in zip(items, preds):
        enriched.append({
            "symbol": it["symbol"],
            "added_at": it["added_at"],
            "name": p["name"],
            "current_price": p["current_price"],
            "ai_score": p["ai_score"],
            "direction": p["direction"],
            "expected_return_pct": p["expected_return_pct"],
            "confidence": p["confidence"],
        })
    return {"items": enriched}


@api.post("/watchlist")
async def add_watchlist(req: WatchlistAdd, user=Depends(current_user)):
    symbol = req.symbol.upper()
    limits = get_limits(user)
    count = await db.watchlist.count_documents({"user_id": user["id"]})
    if count >= limits["watchlist_max"]:
        raise HTTPException(403, f"Free tier limit reached ({limits['watchlist_max']} symbols). Upgrade to Pav Premium for unlimited watchlist.")
    existing = await db.watchlist.find_one({"user_id": user["id"], "symbol": symbol})
    if existing:
        raise HTTPException(400, "Already in watchlist")
    await db.watchlist.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": symbol,
        "added_at": datetime.now(timezone.utc),
    })
    return {"symbol": symbol, "status": "added"}


@api.delete("/watchlist/{symbol}")
async def remove_watchlist(symbol: str, user=Depends(current_user)):
    res = await db.watchlist.delete_one({"user_id": user["id"], "symbol": symbol.upper()})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"symbol": symbol.upper(), "status": "removed"}


# ---------- Alerts ----------
@api.get("/alerts")
async def get_alerts(user=Depends(current_user)):
    items = await db.alerts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # evaluate trigger status
    symbols = list({a["symbol"] for a in items if a.get("status") == "active"})
    quotes_map = {}
    for s in symbols:
        q = await get_quote(s)
        quotes_map[s] = q.get("c", 0)
    for a in items:
        current = quotes_map.get(a["symbol"], 0)
        a["current_price"] = current
        if a["status"] == "active":
            triggered = (a["direction"] == "above" and current >= a["target_price"]) or \
                        (a["direction"] == "below" and current <= a["target_price"])
            if triggered:
                a["triggered"] = True
    return {"items": items}


@api.post("/alerts")
async def create_alert(req: AlertCreate, user=Depends(current_user)):
    if req.direction not in ("above", "below"):
        raise HTTPException(400, "direction must be 'above' or 'below'")
    limits = get_limits(user)
    active = await db.alerts.count_documents({"user_id": user["id"], "status": "active"})
    if active >= limits["alerts_max"]:
        raise HTTPException(403, f"Free tier limit reached ({limits['alerts_max']} active alerts). Upgrade to Pav Premium for unlimited alerts.")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "symbol": req.symbol.upper(),
        "target_price": req.target_price,
        "direction": req.direction,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    await db.alerts.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, user=Depends(current_user)):
    res = await db.alerts.delete_one({"id": alert_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"id": alert_id, "status": "removed"}


# ---------- Subscription (mock) ----------
@api.post("/subscription/upgrade")
async def upgrade(body: dict, user=Depends(current_user)):
    plan = body.get("plan", "monthly")
    if plan not in ("monthly", "yearly"):
        raise HTTPException(400, "plan must be 'monthly' or 'yearly'")
    price = 4.99 if plan == "monthly" else 49.99
    await db.users.update_one({"id": user["id"]}, {"$set": {"tier": "premium", "plan": plan, "plan_price": price}})
    return {"tier": "premium", "plan": plan, "price": price, "message": "Upgraded (MOCKED — Stripe integration deferred)"}


# ---------- Startup ----------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.watchlist.create_index([("user_id", 1), ("symbol", 1)], unique=True)
    await db.alerts.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("Indexes ensured. FINNHUB_KEY set: %s | EMERGENT_LLM_KEY set: %s", bool(FINNHUB_API_KEY), bool(EMERGENT_LLM_KEY))
    # Warm screener cache in background — non-blocking
    asyncio.create_task(_warm_screener_cache())


@app.on_event("shutdown")
async def _shutdown():
    client.close()
