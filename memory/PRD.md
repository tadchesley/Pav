# Pav — AI Stock Prediction App (PRD)

## Overview
Mobile-first Expo + FastAPI + MongoDB app delivering AI-powered stock predictions across **418 tickers** (S&P 500 highlights + NASDAQ 100 + Dow 30 + 40 popular ETFs). Combines real Yahoo Finance prices, statistical indicators (RSI, SMA, momentum, volatility), and Claude Sonnet 4.5 reasoning via the Emergent Universal LLM Key.

## Tech stack
- Frontend: React Native (Expo Router SDK 54), TypeScript, react-native-svg, AsyncStorage, axios
- Backend: FastAPI, Motor (MongoDB), httpx (Finnhub), **yfinance (Yahoo real prices)**, bcrypt + JWT, emergentintegrations
- Data sourcing waterfall: Finnhub (when key set) → yfinance (real Yahoo data) → deterministic mock (last resort)

## Brand
- App name: **Pav** (was AlphaPulse)
- Tagline: "The pulse of the market."
- Splash screen: animated wordmark + heartbeat-pulse dot, 1.8s minimum display before routing to auth/dashboard
- Slug: `pav`

## Features
- **Auth**: Email/password JWT, Google/Apple social (demo), required Terms-of-Service acknowledgment at signup
- **Splash**: animated entrance + pulsing dot + bottom progress dots, "AI predictions · Not financial advice" disclaimer
- **Dashboard**: Market sentiment gauge, top-right stock search 🔍 (live results with prediction previews), gainers (green) + losers (red force-colored)
- **Screener**: 100 most-liquid mega-caps + ETFs pre-computed for performance, live filter count, direction/confidence/sector chips sorted by count desc, Clear button
- **Stock detail**: Real Yahoo price + 60d candles, Claude Sonnet 4.5 narrative, feature importance, key factors, risks, technical indicators
- **Watchlist + Alerts**: full CRUD, full 418-ticker search
- **Settings**: theme toggle (dark/light persisted), Pav Premium upgrade
- **Paywall**: Monthly $4.99 / Yearly $49.99 (SAVE 17% badge), required ToS acknowledgment
- **Terms**: full ToS at `/terms`

## Stock universe sourcing
- 418 tickers in `tickers_data.py`: S&P 500 mega-caps, NASDAQ 100, Dow 30, ADRs (ASML/TSM/BABA/NVO/SHEL/etc), top 40 ETFs (SPY/QQQ/VOO/sector SPDRs/ARKK/IBIT/FBTC/etc)
- `SCREENER_UNIVERSE_SYMBOLS` = curated top 100 by market cap (used for dashboard movers + screener pre-compute)
- Search & watchlist & alerts work across all 418 tickers + arbitrary symbols via Finnhub when key set
- Live prices: yfinance (60s cache) returns real Yahoo Finance data — works without any API key

## Mocked / deferred
- Stripe (subscription upgrade just toggles tier+plan in DB)
- Google/Apple OAuth ID-token verification
- Real Finnhub data (waterfalls to yfinance which gives real prices)

## Smart business enhancement
Yearly plan = 10 months equivalent → 17% savings, increasing LTV via upfront commitment. Free tier limited to 15 watchlist symbols, weekly predictions only.
