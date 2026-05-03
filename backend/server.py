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
from jose import jwt, JWTError
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

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

# Fallback seed data for demo when no Finnhub key is configured
SEED_TICKERS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology", "price": 189.50, "market_cap": 2950000000000},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology", "price": 421.30, "market_cap": 3130000000000},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology", "price": 172.15, "market_cap": 2120000000000},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "price": 188.20, "market_cap": 1950000000000},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology", "price": 875.40, "market_cap": 2160000000000},
    {"symbol": "META", "name": "Meta Platforms Inc.", "sector": "Communication Services", "price": 497.80, "market_cap": 1270000000000},
    {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Consumer Cyclical", "price": 248.30, "market_cap": 789000000000},
    {"symbol": "BRK.B", "name": "Berkshire Hathaway", "sector": "Financial Services", "price": 412.10, "market_cap": 895000000000},
    {"symbol": "JPM", "name": "JPMorgan Chase", "sector": "Financial Services", "price": 198.70, "market_cap": 568000000000},
    {"symbol": "V", "name": "Visa Inc.", "sector": "Financial Services", "price": 276.50, "market_cap": 558000000000},
    {"symbol": "JNJ", "name": "Johnson & Johnson", "sector": "Healthcare", "price": 156.20, "market_cap": 376000000000},
    {"symbol": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive", "price": 62.40, "market_cap": 502000000000},
    {"symbol": "PG", "name": "Procter & Gamble", "sector": "Consumer Defensive", "price": 166.30, "market_cap": 391000000000},
    {"symbol": "UNH", "name": "UnitedHealth Group", "sector": "Healthcare", "price": 524.80, "market_cap": 484000000000},
    {"symbol": "HD", "name": "Home Depot", "sector": "Consumer Cyclical", "price": 382.10, "market_cap": 380000000000},
    {"symbol": "BAC", "name": "Bank of America", "sector": "Financial Services", "price": 38.90, "market_cap": 301000000000},
    {"symbol": "XOM", "name": "Exxon Mobil", "sector": "Energy", "price": 118.40, "market_cap": 471000000000},
    {"symbol": "DIS", "name": "Walt Disney Co.", "sector": "Communication Services", "price": 112.60, "market_cap": 205000000000},
    {"symbol": "NFLX", "name": "Netflix Inc.", "sector": "Communication Services", "price": 641.20, "market_cap": 278000000000},
    {"symbol": "AMD", "name": "Advanced Micro Devices", "sector": "Technology", "price": 168.70, "market_cap": 273000000000},
]

SEED_BY_SYMBOL = {t["symbol"]: t for t in SEED_TICKERS}


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


def mock_quote(symbol: str) -> dict:
    base = SEED_BY_SYMBOL.get(symbol, {"price": 100.0})
    # Deterministic daily jitter based on symbol + date
    seed = hash(symbol + datetime.now(timezone.utc).strftime("%Y-%m-%d")) % 10000
    rng = random.Random(seed)
    price = base["price"] * (1 + rng.uniform(-0.02, 0.02))
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
    base = SEED_BY_SYMBOL.get(symbol, {"price": 100.0})["price"]
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
    data = await finnhub_get("quote", {"symbol": symbol})
    if data and data.get("c"):
        return data
    return mock_quote(symbol)


async def get_candles(symbol: str, days: int = 90) -> dict:
    to_ts = int(datetime.now(timezone.utc).timestamp())
    from_ts = to_ts - days * 86400
    data = await finnhub_get("stock/candle", {"symbol": symbol, "resolution": "D", "from": from_ts, "to": to_ts})
    if data and data.get("s") == "ok":
        return data
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
    direction = "UP" if score > 55 else ("DOWN" if score < 45 else "NEUTRAL")
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
        ).with_model("anthropic", "claude-sonnet-4-5").with_max_tokens(700)

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
    return {"stocks": SEED_TICKERS}


@api.get("/stocks/search")
async def search_stocks(q: str):
    q = q.upper()
    data = await finnhub_get("search", {"q": q})
    if data and data.get("result"):
        return {"results": [
            {"symbol": r["symbol"], "description": r.get("description", ""), "type": r.get("type", "")}
            for r in data["result"][:10]
        ]}
    # fallback filter
    results = [
        {"symbol": t["symbol"], "description": t["name"], "type": "Common Stock"}
        for t in SEED_TICKERS if q in t["symbol"] or q.lower() in t["name"].lower()
    ]
    return {"results": results[:10]}


@api.get("/stocks/quote/{symbol}")
async def quote(symbol: str):
    symbol = symbol.upper()
    q = await get_quote(symbol)
    seed = SEED_BY_SYMBOL.get(symbol, {})
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
async def candles(symbol: str, days: int = 90):
    symbol = symbol.upper()
    c = await get_candles(symbol, days)
    return {
        "symbol": symbol,
        "timestamps": c.get("t", []),
        "close": c.get("c", []),
        "open": c.get("o", []),
        "high": c.get("h", []),
        "low": c.get("l", []),
        "volume": c.get("v", []),
    }


# ---------- Prediction routes ----------
async def build_prediction(symbol: str, use_llm: bool) -> dict:
    symbol = symbol.upper()
    quote_data, candle_data = await asyncio.gather(get_quote(symbol), get_candles(symbol, 90))
    indicators = compute_indicators(candle_data)
    if indicators["current"] == 0:
        indicators["current"] = quote_data.get("c", 0)
    stat_pred = statistical_prediction(symbol, indicators, candle_data)

    profile = SEED_BY_SYMBOL.get(symbol, {"name": symbol, "sector": "Unknown"})

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
    result = await build_prediction(symbol, use_llm=deep)
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
    """Top predicted gainers and losers (statistical only for speed)."""
    tasks = [build_prediction(t["symbol"], use_llm=False) for t in SEED_TICKERS]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    valid = [r for r in results if isinstance(r, dict)]
    gainers = sorted(valid, key=lambda x: -x["ai_score"])[:5]
    losers = sorted(valid, key=lambda x: x["ai_score"])[:5]
    # market sentiment = avg score
    sentiment_score = round(sum(r["ai_score"] for r in valid) / len(valid), 1) if valid else 50
    return {
        "gainers": [{k: v for k, v in g.items() if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")} for g in gainers],
        "losers": [{k: v for k, v in l.items() if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")} for l in losers],
        "market_sentiment": sentiment_score,
        "sentiment_label": "Bullish" if sentiment_score > 55 else ("Bearish" if sentiment_score < 45 else "Neutral"),
    }


@api.post("/predictions/screener")
async def screener(body: dict, user=Depends(current_user)):
    min_conf = body.get("min_confidence", 0)
    min_return = body.get("min_return", -100)
    direction = body.get("direction")  # UP, DOWN, NEUTRAL, or None
    sector = body.get("sector")

    tasks = [build_prediction(t["symbol"], use_llm=False) for t in SEED_TICKERS]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    out = []
    for r in results:
        if not isinstance(r, dict):
            continue
        if r["confidence"] < min_conf:
            continue
        if r["expected_return_pct"] < min_return:
            continue
        if direction and r["direction"] != direction:
            continue
        if sector and r.get("sector") != sector:
            continue
        out.append({k: v for k, v in r.items() if k not in ("indicators", "narrative", "key_factors", "risks", "feature_importance")})
    out.sort(key=lambda x: -x["ai_score"])
    return {"results": out}


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
async def upgrade(user=Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"tier": "premium"}})
    return {"tier": "premium", "message": "Upgraded (MOCKED — Stripe integration deferred)"}


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


@app.on_event("shutdown")
async def _shutdown():
    client.close()
