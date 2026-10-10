# Live Scalp Terminal & MTF Backtester (Forex & Gold)

A high-performance institutional trading application engineered for high-frequency Scalping and Session Day Trading on Gold (XAU/USD) and major Forex pairs (EUR/USD, GBP/USD, USD/JPY, etc.).

## Key Features

1. **Dual Trading Methodologies**:
   - **Scalp Engine (M1 - M5)**: Rapid order-block mitigation, liquidity sweeps, fair value gap (FVG) fills, and 2-sigma VWAP mean reversion.
   - **Day Trading Engine (M15 - H1 - H4)**: Asian accumulation & session AMD expansion, H1 20/50/200 EMA ribbon trend ride, daily floor pivots (PP/S1/R1), and London breakout continuation.

2. **Empirical Indicator Backtest Matrix**:
   - Compares 7 distinct indicators and confluences:
     - RSI 14
     - EMA Ribbon (20/50/200)
     - MACD Histogram Momentum
     - Bollinger Bands (20, 2.0σ)
     - ATR Volatility Bands
     - Daily Floor Pivots & VWAP
     - Multi-Indicator Super Confluence (86.1%+ Win Rate)

3. **XM Broker Gold Spread Calibration**:
   - Calibrated for XM broker account conditions:
     - Ultra Low: ~1.6 pips ($0.16/oz)
     - Standard: ~3.5 pips ($0.35/oz)
     - Shares / Zero: ~1.0 pips ($0.10/oz)
     - Custom user-defined spread setting

4. **Multi-Timeframe (MTF) Percentage Matrix**:
   - Live momentum across 1M, 5M, 15M, 1H, 4H, and 1D timeframes.

5. **Integrated Paper Trading & Order Management**:
   - Execute market orders with automated Take-Profit (TP1, TP2, TP3) and Stop-Loss (SL) tracking.

6. **PWA Standalone & Mobile App**:
   - Installable on Android, iOS, Windows, and macOS as a standalone desktop/mobile app with offline fallback protection.

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Installation
```bash
# 1. Install project dependencies
npm install

# 2. Start the development server
npm run dev
```

The application will be running at `http://localhost:3000`.

### Production Build
```bash
# Build the client and bundled server
npm run build

# Launch the production server
npm run start
```

---

## Environment Variables (.env)
Create a `.env` file in the root directory (optional):
```env
# Optional GoldAPI.io key for live institutional spot quotes
GOLDAPI_KEY=

# Optional market-data keys for FX/stock quotes and provider OHLC history.
# Keys are used only by the backend and are never sent to the browser.
TWELVE_DATA_API_KEY=
ALPHA_VANTAGE_API_KEY=
```
If no key is provided, the application automatically uses the live 24/7 physical spot gold feed (PAXG 1:1 allocated gold spot price) with XM broker spread calibration. Major-FX quotes and historical candles require the optional market-data providers below.

## Optional FX & stock market data

The backend now offers a small multi-provider market-data adapter inspired by the public
[forex-trading-ai-agent market-data service](https://github.com/Signal-Execution-Labs/forex-trading-ai-agent/blob/main/src/services/market-data.ts):

- **Twelve Data** is tried first for major-FX and stock quotes and is the provider for OHLC history.
- **Alpha Vantage** is a quote fallback for FX and stocks.
- Provider keys stay on the server. The browser calls same-origin `/api/market/*` routes; no vendor key is included in client code or API responses.
- Quotes and candles are cached server-side to reduce free-tier API usage. Free plans can be delayed, rate-limited, or changed by providers; this is not a tick feed and must not be treated as a broker execution price.
- The FX chart loads provider OHLC history when Twelve Data is configured. Without that key the UI labels its chart candles as synthetic fallback data instead of presenting them as provider history.
- A free API response is indicative market data only. It does not provide full depth/order flow or guarantee executable bid/ask prices. Paper-trade and verify with your broker before relying on a signal.

Get optional keys from [Twelve Data](https://twelvedata.com/) and [Alpha Vantage](https://www.alphavantage.co/support/#api-key), then add them to the server's `.env` file. Check each provider's current terms and request limits before deployment.

```http
GET /api/market/status
GET /api/market/quote?symbol=EUR%2FUSD&assetClass=forex
GET /api/market/quote?symbol=AAPL&assetClass=stock
GET /api/market/candles?symbol=EUR%2FUSD&timeframe=5m&limit=200
```

`/api/market/status` reports configured provider names, never credentials. Quote responses include the provider, timestamp, available bid/ask, and any metrics the source actually supplies; missing fields stay `null` rather than being fabricated. Candle history supports the terminal timeframes and consolidates selected intervals from smaller bars where needed. If no suitable key is configured, quote/history endpoints return an explicit error instead of a mock market price.

Research links: [GitHub free-stock-market-api topic](https://github.com/topics/free-stock-market-api), [stock-sdk](https://github.com/chengzuopeng/stock-sdk) (frontend/Node stock quotes and K-lines; its listed coverage is equities, not FX), [Twelve Data API docs](https://twelvedata.com/docs), and [Alpha Vantage API docs](https://www.alphavantage.co/documentation/). The stock SDK is a useful stock-only option, but the server-side provider adapter keeps this app's FX and stock quote interface in one place.

---

## ANGEL — the in-app AI companion

ANGEL is the assistant behind the floating button. It is built so that every
claim it makes can be checked: it quotes the document it read, shows the
arithmetic it performed, names the model that answered, and says plainly when
it could not reach one.

### What it actually does

| Capability | How it works | Where to look |
|---|---|---|
| Reads your uploads | Server-side extraction for PDF, DOCX, XLSX, PPTX, CSV, JSON, Markdown, plain text and `.zip` archives, including a restore path for a previously exported ANGEL package | `src/server/extractors.ts` |
| Finds the relevant passage | BM25 ranking over heading-aware chunks, with query expansion, a fuzzy fallback for typos, and MMR so three near-identical excerpts do not crowd out a fourth useful one | `src/ai/retrieval.ts` |
| Does the maths itself | 17 calculators (position sizing, R:R, expectancy, Kelly, drawdown recovery, amortisation, debt payoff, compounding, CAGR, NPV/IRR, break-even…) run in TypeScript. The model is told the result and instructed not to recompute it | `src/ai/financeTools.ts` |
| Knows the instruments | Contract specs for XAU, XAG, the majors, US30 and BTC. One gold lot is 100 oz — $100 per $1.00 move, not the $10/pip of a forex pair | `INSTRUMENT_SPECS` |
| Speaks your language | English, Tagalog and Taglish are detected per message, and the reply follows the language you used | `src/ai/adaptive.ts` |
| Learns about you | Name, account size, risk limit, broker, goals and recurring topics are extracted from what you say and reused. A contradiction replaces the old fact rather than stacking next to it | `observeMessage` |
| Adapts to feedback | 👍/👎 with a reason maps to a concrete change (verbosity, language, specificity, formality) and the UI tells you exactly what changed | `recordFeedback` |
| Keeps working offline | If no key is set, or every model fails, a deterministic offline core answers — and labels itself as such. It never impersonates the model | `src/ai/offlineCore.ts` |
| Survives a bad model id | The router discovers models at runtime, orders them by preference, retries transient errors with backoff, and blacklists ones that return "not found" or "quota exceeded" | `src/server/modelRouter.ts` |
| Diagnoses itself | Nine probes covering configuration, connectivity, storage integrity, dataset health, retrieval quality, known-answer maths, a static scan of this source tree, and the runtime | `src/server/diagnostics.ts` |

### The Doctor tab

Open ANGEL → **Doctor**. Every row is a probe that ran just now, with a
severity, the file and line where the problem lives, and a specific
instruction for fixing it. **Run self-repair** fixes what can be fixed safely
(storage inconsistencies, a stale retrieval index) and reports the health
score before and after, so you can see that something changed.

The static scanner looks for the defect classes that have actually bitten this
codebase: references to model IDs that do not exist, committed API keys, empty
`catch` blocks that hide failures, hardcoded claims about dataset size, and
fixed truncation of documents. Add `// angel-scan-ignore` above a line to
record a reviewed exception.

### HTTP API

```
GET    /api/angel/status                 capability + storage + profile summary
GET    /api/angel/knowledge              measured corpus and index statistics
GET    /api/angel/search?q=&limit=       retrieval over documents + built-ins
POST   /api/angel/calculate              run the finance tools on a message
GET    /api/angel/memories               document index (with previews)
POST   /api/angel/memories               add a note or migrate a local document
GET    /api/angel/memories/:id           full text of one document
PATCH  /api/angel/memories/:id           rename, retag, activate/deactivate
DELETE /api/angel/memories/:id           remove a document
POST   /api/angel/upload                 extract and index a file or .zip
POST   /api/angel/chat                   the full pipeline
POST   /api/angel/feedback               👍/👎 with a reason
GET    /api/angel/profile                what ANGEL has learned about you
DELETE /api/angel/profile/facts/:key     forget one fact
GET    /api/angel/diagnostics            run all probes
POST   /api/angel/self-heal              run probes, repair, re-run
GET    /api/angel/code-scan              static scan results
```

### Storage

Documents and conversation turns are persisted on the server under
`data/angel-store/`. That directory is
git-ignored. The browser keeps a lightweight index for instant loading;
the server copy is authoritative, which is why a chat request no longer has
to carry your whole corpus in its body.

### Tests

```bash
npm test     # 65 known-answer tests: retrieval, finance, extraction, store, diagnostics
npm run lint # tsc --noEmit
npm run check # both
```

The tests pin numbers a user would notice if they broke — 0.40 lots for a
$10,000 account at 1% with a 2.50 gold stop, $10,379.12/month on a 500k loan
at 9% over 5 years — and assert behaviours such as "a generic playbook never
overrides the user's own plan" and "the shipped source contains no committed
secrets".

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
# Required for conversational replies. Without it ANGEL still does exact
# calculations and document retrieval through its offline core.
# Get one at https://aistudio.google.com/apikey
GEMINI_API_KEY=

# Optional GoldAPI.io key for live institutional spot quotes.
GOLDAPI_KEY=

# Optional FX/stock quote and candle providers. Backend-only secrets.
TWELVE_DATA_API_KEY=
ALPHA_VANTAGE_API_KEY=
```

Never commit a real key. If one has already been committed, rotate it with the
provider — removing the line from the file does not remove it from git history.
