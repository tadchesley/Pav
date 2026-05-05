# AlphaPulse — AI Stock Prediction App (PRD)

## Overview
Mobile-first Expo + FastAPI + MongoDB app delivering AI-powered stock predictions combining statistical indicators (RSI, SMA, momentum, volatility) with Claude Sonnet 4.5 reasoning via the Emergent Universal LLM Key.

## Tech stack
- Frontend: React Native (Expo Router, SDK 54), TypeScript, react-native-svg, AsyncStorage, axios
- Backend: FastAPI, Motor (MongoDB), httpx (Finnhub), bcrypt + python-jose (JWT), emergentintegrations (Claude Sonnet 4.5)
- Data: Finnhub (optional); seeded mock data for 54 major tickers across 8 sectors when FINNHUB_API_KEY is empty

## Features shipped
- **Auth**: Email/password JWT, Google/Apple social (demo — real OAuth deferred), Terms of Service acknowledgment required at signup
- **Dashboard**: Market sentiment gauge (compact 24px number), search button top-right opening live search with prediction previews, top predicted gainers (green) and losers (red force-colored)
- **Screener**: 54-stock universe; live filter count, direction chips (ALL/UP/DOWN/NEUTRAL) sorted by count, sector chips sorted by count desc, confidence chips (Any/60/75/85%), "Clear" button
- **Stock detail**: Price chart + AI forecast, Claude Sonnet 4.5 narrative, feature importance, key factors, risks, indicators
- **Watchlist**: Add/remove with live predictions
- **Alerts**: Price above/below with progress bar + triggered state
- **Settings**: Dark/light theme toggle (persisted), Premium upgrade (MOCKED)
- **Paywall**: Monthly $4.99 / Yearly $49.99 plan selector with "SAVE 17%" badge, ToS acknowledgment checkbox required
- **Terms of Service**: Full `/terms` screen with AI-predictions-not-financial-advice warning

## Key endpoints
- `/api/auth/{signup,login,social,me,theme}`
- `/api/stocks/{universe,search,quote/{symbol},candles/{symbol}}`
- `/api/predictions/{symbol}`, `/api/predictions/top/movers`, `/api/predictions/screener`
- `/api/watchlist`, `/api/alerts` (CRUD)
- `/api/subscription/upgrade` accepts `{plan: "monthly"|"yearly"}` (MOCKED)

## Mocked / deferred
- Finnhub (seeded mock data)
- Stripe (upgrade endpoint just toggles tier + plan in DB)
- Google/Apple OAuth (no ID token verification — accepts email)

## Smart business enhancement
Yearly plan priced at 2x monthly × 10 months (instead of 12) = 17% savings, incentivizing upfront commitment and improving LTV.

