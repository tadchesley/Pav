# AlphaPulse — AI Stock Prediction App (PRD)

## Overview
Mobile-first Expo + FastAPI + MongoDB app delivering AI-powered stock predictions combining statistical indicators (RSI, SMA, momentum, volatility) with Claude Sonnet 4.5 reasoning via the Emergent Universal LLM Key.

## Tech stack
- Frontend: React Native (Expo Router, SDK 54), TypeScript, react-native-svg for charts, AsyncStorage, axios
- Backend: FastAPI, Motor (MongoDB), httpx (Finnhub), bcrypt + python-jose (JWT), emergentintegrations (Claude Sonnet 4.5)
- Data: Finnhub (real key optional; seeded mock data for 20 major tickers with deterministic daily jitter when FINNHUB_API_KEY is empty)

## Features shipped (MVP)
- **Auth**: Email/password JWT, Google/Apple social sign-in (demo — backend accepts verified email; real OAuth verification requires Google/Apple client IDs on user's end)
- **Dashboard**: Market sentiment gauge, top predicted gainers/losers with AI score + confidence
- **Screener**: Filter by direction (UP/DOWN/NEUTRAL), min confidence, sector
- **Stock detail**: 60-day price chart + AI forecast line, AI score/direction/confidence, LLM narrative, feature importance bars, key factors, risks, technical indicators (RSI/SMA20/SMA50/momentum/volatility)
- **Watchlist**: Add/remove stocks, live predictions per entry
- **Alerts**: Price-above/below triggers with progress bar + triggered state
- **Settings**: Dark/light theme toggle (persisted per-user on backend), Premium upgrade (MOCKED — Stripe deferred), sign-out
- **Audit logging**: Every prediction request is persisted in MongoDB `predictions` collection

## Key endpoints
- `/api/auth/{signup,login,social,me,theme}`
- `/api/stocks/{universe,search,quote/{symbol},candles/{symbol}}`
- `/api/predictions/{symbol}` (deep LLM analysis), `/api/predictions/top/movers`, `/api/predictions/screener`
- `/api/watchlist` GET/POST, `/api/watchlist/{symbol}` DELETE
- `/api/alerts` GET/POST, `/api/alerts/{id}` DELETE
- `/api/subscription/upgrade` (MOCKED)

## Monetization hooks
- Free vs Premium tier stored on user; upgrade path opens full-screen paywall modal (MOCKED upgrade).
- Stripe integration deferred — ready to wire with Stripe Checkout + webhook.

## Not financial advice — explicit disclaimers on auth screen, stock detail, and settings.
