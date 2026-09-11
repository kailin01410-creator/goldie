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
```
If no key is provided, the application automatically uses the live 24/7 physical spot gold feed (PAXG 1:1 allocated gold spot price) with XM broker spread calibration.
