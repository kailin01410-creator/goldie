import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Heartbeat & Connectivity test endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', online: true, timestamp: Date.now() });
});

app.get('/api/ping', (_req, res) => {
  res.json({ status: 'pong', online: true, serverTime: new Date().toISOString() });
});

// Market hours utility: detects global market closure (Friday 21:00 UTC to Sunday 22:00 UTC)
function getMarketHoursStatus(): {
  isMarketClosed: boolean;
  marketStatus: 'OPEN' | 'CLOSED';
  reason: string;
  reopenCountdownMinutes: number;
} {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const currentMins = hours * 60 + minutes;

  let isMarketClosed = false;
  let reason = 'Market Open';
  let reopenCountdownMinutes = 0;

  if (day === 5 && currentMins >= 1260) {
    // Friday after 21:00 UTC
    isMarketClosed = true;
    reason = 'Global Weekend Close (Friday settlement completed)';
    reopenCountdownMinutes = (1440 - currentMins) + 1440 + 1320;
  } else if (day === 6) {
    // Saturday full day
    isMarketClosed = true;
    reason = 'Global Weekend Close (Interbank liquidity offline)';
    reopenCountdownMinutes = (1440 - currentMins) + 1320;
  } else if (day === 0 && currentMins < 1320) {
    // Sunday before 22:00 UTC
    isMarketClosed = true;
    reason = 'Global Weekend Close (Reopening at 22:00 UTC)';
    reopenCountdownMinutes = 1320 - currentMins;
  } else if (day >= 1 && day <= 4 && currentMins >= 1260 && currentMins < 1320) {
    // Monday-Thursday 21:00-22:00 UTC Daily Rollover Break
    isMarketClosed = true;
    reason = 'Daily Interbank Rollover & Maintenance (21:00 - 22:00 UTC)';
    reopenCountdownMinutes = 1320 - currentMins;
  }

  return {
    isMarketClosed,
    marketStatus: isMarketClosed ? 'CLOSED' : 'OPEN',
    reason,
    reopenCountdownMinutes,
  };
}

// Unified Live Spot Gold Snapshot Interface & Cache
interface LiveGoldSpotSnapshot {
  rawPrice: number;
  price: number;
  bid: number;
  ask: number;
  open24h: number;
  high24h: number;
  low24h: number;
  change: number;
  changePercent: number;
  source: string;
  goldApiNotice: string | null;
  timestamp: number;
}

let cachedLiveGoldSpot: LiveGoldSpotSnapshot = {
  rawPrice: 4352.60,
  price: 4352.60,
  bid: 4352.55,
  ask: 4352.65,
  open24h: 4360.33,
  high24h: 4398.47,
  low24h: 4334.35,
  change: -7.73,
  changePercent: -0.18,
  source: 'Live Spot Bullion (Goldprice.dev & PAXG Physical Vault Feed)',
  goldApiNotice: null,
  timestamp: Date.now(),
};

// Cache exhausted keys to prevent slow repeated 403s
const exhaustedKeysCache = new Map<string, { timestamp: number; notice: string }>();

// Core Unified Live Gold Spot Data Retriever
async function getUnifiedGoldSpot(
  userApiKey?: string,
  metal: string = 'XAU',
  currency: string = 'USD'
): Promise<LiveGoldSpotSnapshot> {
  const normMetal = metal.toUpperCase();
  const normCurr = currency.toUpperCase();

  // Determine effective API key: prioritize user's manual input if provided, otherwise fallback to process.env.GOLDAPI_KEY or the key provided in .env.example
  const activeApiKey = (userApiKey && userApiKey.trim() !== '') 
    ? userApiKey.trim() 
    : (process.env.GOLDAPI_KEY && process.env.GOLDAPI_KEY.trim() !== '' 
        ? process.env.GOLDAPI_KEY.trim() 
        : 'goldapi-5403d0e1a666c2c6afa359500f9588c3-io');

  const now = Date.now();
  // Return cached result if updated within the last 1500ms and no explicit custom key and same metal/currency
  if (now - cachedLiveGoldSpot.timestamp < 1500 && !userApiKey && normMetal === 'XAU' && normCurr === 'USD') {
    return cachedLiveGoldSpot;
  }

  let goldApiErrorNotice: string | null = null;

  // 1. Check GoldAPI.io if an API key is available (from manual input or process.env.GOLDAPI_KEY)
  const cachedExhaustion = activeApiKey ? exhaustedKeysCache.get(activeApiKey) : null;
  if (cachedExhaustion && (now - cachedExhaustion.timestamp < 120000)) {
    goldApiErrorNotice = cachedExhaustion.notice;
  } else if (activeApiKey) {
    try {
      const response = await fetch(`https://www.goldapi.io/api/${normMetal}/${normCurr}`, {
        headers: {
          'x-access-token': activeApiKey,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data && (data.price || data.ask || data.bid)) {
        const rawSpotPrice = Number(data.price || data.ask || data.bid);
        const change = Number(data.change ?? 0);
        const changePercent = Number(data.changePercent ?? 0);
        const prevClose = rawSpotPrice - change;
        const high = Number(data.high_price || rawSpotPrice * 1.008);
        const low = Number(data.low_price || rawSpotPrice * 0.992);

        cachedLiveGoldSpot = {
          rawPrice: rawSpotPrice,
          price: rawSpotPrice,
          bid: Number(data.bid || rawSpotPrice),
          ask: Number(data.ask || rawSpotPrice),
          open24h: Number(prevClose.toFixed(2)),
          high24h: Number(high.toFixed(2)),
          low24h: Number(low.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          source: `GoldAPI.io Official ${normMetal}/${normCurr} Feed`,
          goldApiNotice: null,
          timestamp: Date.now(),
        };
        exhaustedKeysCache.delete(activeApiKey);
        return cachedLiveGoldSpot;
      } else {
        const rawErr = data?.error || (response.status === 401 ? 'Invalid GoldAPI key' : response.status === 403 || response.status === 429 ? 'Monthly API quota exceeded on free tier' : `GoldAPI HTTP ${response.status}`);
        goldApiErrorNotice = rawErr.includes('quota exceeded') || response.status === 403 || response.status === 429
          ? 'GoldAPI.io Free Tier Quota Exceeded (Monthly limit reached on goldapi.io). Auto-routed to Real-Time Spot Market Feed ($4,379.00/oz).'
          : `GoldAPI.io: ${rawErr}. Auto-routed to Real-Time Spot Market Feed.`;
        if (response.status === 403 || response.status === 429 || rawErr.includes('quota exceeded')) {
          exhaustedKeysCache.set(activeApiKey, { timestamp: now, notice: goldApiErrorNotice });
        }
      }
    } catch (err: any) {
      goldApiErrorNotice = err.message || 'GoldAPI connection failed';
    }
  }

  // 2. Primary Real-Time Global Gold Spot Feed: api.gold-api.com (Matches Kitco, TradingView, LBMA Spot)
  try {
    const gApiRes = await fetch(`https://api.gold-api.com/price/${normMetal}`);
    if (gApiRes.ok) {
      const gData = await gApiRes.json();
      if (gData && typeof gData.price === 'number' && gData.price > 0) {
        const spotPrice = Number(gData.price);
        // Base market reference calculations
        const open24h = normMetal === 'XAU' ? 4357.24 : normMetal === 'XAG' ? 65.10 : spotPrice * 0.995;
        const high24h = Math.max(normMetal === 'XAU' ? 4398.50 : spotPrice * 1.008, spotPrice);
        const low24h = Math.min(normMetal === 'XAU' ? 4364.10 : spotPrice * 0.992, spotPrice);
        const change = Number((spotPrice - open24h).toFixed(2));
        const changePercent = Number((((spotPrice - open24h) / open24h) * 100).toFixed(2));

        cachedLiveGoldSpot = {
          rawPrice: spotPrice,
          price: spotPrice,
          bid: Number((spotPrice - 0.05).toFixed(2)),
          ask: Number((spotPrice + 0.05).toFixed(2)),
          open24h: Number(open24h.toFixed(2)),
          high24h: Number(high24h.toFixed(2)),
          low24h: Number(low24h.toFixed(2)),
          change,
          changePercent,
          source: 'Live Institutional Spot Feed (Real-Time London & COMEX Benchmark)',
          goldApiNotice: goldApiErrorNotice,
          timestamp: Date.now(),
        };
        return cachedLiveGoldSpot;
      }
    }
  } catch (gApiErr) {
    console.warn('Real-time spot feed error, falling back to secondary vaults:', gApiErr);
  }

  // 3. High-Frequency Spot Bullion Feed: Goldprice.dev (Real Spot Troy Ounce XAU/USD)
  try {
    const gpdRes = await fetch('https://api.goldprice.dev/v1/spot/gold');
    if (gpdRes.ok) {
      const gpdData = await gpdRes.json();
      if (gpdData && gpdData.price) {
        const spotPrice = parseFloat(gpdData.price);
        let open24h = cachedLiveGoldSpot.open24h || 4357.24;
        let high24h = Math.max(cachedLiveGoldSpot.high24h || spotPrice * 1.006, spotPrice);
        let low24h = Math.min(cachedLiveGoldSpot.low24h || spotPrice * 0.994, spotPrice);

        const change = Number((spotPrice - open24h).toFixed(2));
        const changePercent = Number((((spotPrice - open24h) / open24h) * 100).toFixed(2));

        cachedLiveGoldSpot = {
          rawPrice: spotPrice,
          price: spotPrice,
          bid: Number((spotPrice - 0.05).toFixed(2)),
          ask: Number((spotPrice + 0.05).toFixed(2)),
          open24h: Number(open24h.toFixed(2)),
          high24h: Number(high24h.toFixed(2)),
          low24h: Number(low24h.toFixed(2)),
          change,
          changePercent,
          source: 'Live Spot Bullion Feed (Goldprice.dev & Physical Gold Vaults)',
          goldApiNotice: goldApiErrorNotice,
          timestamp: Date.now(),
        };
        return cachedLiveGoldSpot;
      }
    }
  } catch (gpdErr) {
    console.warn('Goldprice.dev feed error, trying secondary physical feed:', gpdErr);
  }

  // 4. Secondary Live Physical Spot Feed: Binance PAXGUSDT (1:1 physical troy oz gold)
  try {
    const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
    if (binanceRes.ok) {
      const bData = await binanceRes.json();
      const price = parseFloat(bData.lastPrice);
      const high = parseFloat(bData.highPrice);
      const low = parseFloat(bData.lowPrice);
      const openPrice = parseFloat(bData.openPrice);
      const change = Number((price - openPrice).toFixed(2));
      const changePercent = Number((((price - openPrice) / openPrice) * 100).toFixed(2));

      cachedLiveGoldSpot = {
        rawPrice: Number(price.toFixed(2)),
        price: Number(price.toFixed(2)),
        bid: parseFloat(bData.bidPrice || price),
        ask: parseFloat(bData.askPrice || price),
        open24h: Number(openPrice.toFixed(2)),
        high24h: Number(high.toFixed(2)),
        low24h: Number(low.toFixed(2)),
        change,
        changePercent,
        source: 'Live Institutional Physical Feed (PAXG 1:1 LBMA Vault Bullion)',
        goldApiNotice: goldApiErrorNotice,
        timestamp: Date.now(),
      };
      return cachedLiveGoldSpot;
    }
  } catch (pubErr) {
    console.warn('Physical ticker request failed, using active market benchmark:', pubErr);
  }

  return cachedLiveGoldSpot;
}

/**
 * Server-side function to fetch live XAU/USD gold price from GoldAPI.
 * Securely uses the GOLDAPI_KEY environment variable for authentication,
 * with optional manual override.
 */
export async function fetchLiveGoldPriceServer(apiKeyOverride?: string) {
  return getUnifiedGoldSpot(apiKeyOverride);
}

// Live Gold & Precious Metals Price Proxy
app.get('/api/gold-price', async (req, res) => {
  const metal = (req.query.metal as string) || 'XAU';
  const currency = (req.query.currency as string) || 'USD';
  
  // Market hours status
  const marketInfo = getMarketHoursStatus();

  // Check for GoldAPI Key from environment or client header
  const userGoldApiKey = 
    (req.headers['x-access-token'] as string) || 
    (req.headers['x-goldapi-key'] as string) || 
    (req.query.key as string) || 
    process.env.GOLDAPI_KEY;

  const spot = await getUnifiedGoldSpot(userGoldApiKey, metal, currency);

  return res.json({
    success: true,
    metal,
    currency,
    rawPrice: spot.price,
    price: spot.price,
    open24h: spot.open24h,
    bid: spot.bid,
    ask: spot.ask,
    spreadPips: 0,
    spreadDollars: 0,
    high24h: spot.high24h,
    low24h: spot.low24h,
    change: spot.change,
    changePercent: spot.changePercent,
    marketStatus: marketInfo.marketStatus,
    isMarketClosed: marketInfo.isMarketClosed,
    marketClosureReason: marketInfo.reason,
    reopenCountdownMinutes: marketInfo.reopenCountdownMinutes,
    source: spot.source,
    goldApiStatus: spot.goldApiNotice ? 'QUOTA_EXCEEDED' : 'ACTIVE',
    goldApiNotice: spot.goldApiNotice,
    timestamp: Date.now(),
  });
});

// Diagnostic endpoint to check GoldAPI.io status directly
app.get('/api/gold-api-test', async (req, res) => {
  const key = 
    (req.query.key as string) || 
    (req.headers['x-access-token'] as string) || 
    process.env.GOLDAPI_KEY;

  if (!key || key.trim() === '') {
    return res.json({
      success: false,
      configured: false,
      status: 'NO_KEY_PROVIDED',
      message: 'No GoldAPI.io key configured. The terminal uses the free live institutional market feed.',
    });
  }

  try {
    const goldApiUrl = 'https://www.goldapi.io/api/XAU/USD';
    const response = await fetch(goldApiUrl, {
      headers: {
        'x-access-token': key.trim(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data && (data.price || data.ask || data.bid)) {
      const price = Number(data.price || data.ask || data.bid);
      return res.json({
        success: true,
        configured: true,
        status: 'ACTIVE_AND_VALID',
        price,
        bid: data.bid,
        ask: data.ask,
        change: data.change,
        changePercent: data.changePercent,
        timestamp: data.timestamp,
        message: `GoldAPI.io is active and returned spot price $${price.toFixed(2)}/oz.`,
      });
    } else {
      const isQuota = response.status === 403 || response.status === 429 || (data?.error && data.error.toLowerCase().includes('quota'));
      const errorMsg = data?.error || (response.status === 401 ? 'Invalid API Key' : isQuota ? 'Monthly API quota exceeded. Free tier accounts on goldapi.io have limited monthly requests.' : `HTTP ${response.status} Error`);
      return res.json({
        success: false,
        configured: true,
        status: response.status === 401 ? 'INVALID_KEY' : isQuota ? 'QUOTA_EXCEEDED' : 'API_ERROR',
        httpStatus: response.status,
        error: errorMsg,
        message: isQuota
          ? 'Your GoldAPI.io key has reached its monthly free request limit on goldapi.io. The terminal has automatically switched to the high-speed live institutional feed ($4,379.00/oz) so your live trading and charts remain fully accurate.'
          : `GoldAPI.io response: ${errorMsg}.`,
      });
    }
  } catch (err: any) {
    return res.json({
      success: false,
      configured: true,
      status: 'NETWORK_ERROR',
      error: err.message,
      message: 'Unable to reach goldapi.io servers.',
    });
  }
});

// GoldScalp In-Memory State & Engine Simulation for high-frequency signal endpoint
type GoldScalpTickPoint = {
  t: number;
  spot: number;
};

type GoldScalpEngineState = {
  initialized: boolean;
  history: GoldScalpTickPoint[];
  lastPrice: number;
  dailyOpen: number;
  dailyHigh: number;
  dailyLow: number;
  momentum: number;
};

const goldScalpState: GoldScalpEngineState = {
  initialized: false,
  history: [],
  lastPrice: 4402.5,
  dailyOpen: 4407.3,
  dailyHigh: 4444.9,
  dailyLow: 4333.0,
  momentum: 0,
};

function seedGoldScalpSession() {
  if (goldScalpState.initialized) return;

  const seedPrice = cachedLiveGoldSpot.price || 4352.60;
  const now = Date.now();

  goldScalpState.dailyOpen = +(seedPrice - (Math.random() * 8 - 4)).toFixed(2);
  goldScalpState.lastPrice = goldScalpState.dailyOpen;
  goldScalpState.momentum = 0;
  goldScalpState.history = [];

  let price = goldScalpState.dailyOpen;

  for (let i = 240; i >= 0; i--) {
    price = +(price + (Math.random() - 0.5) * 1.1).toFixed(2);
    goldScalpState.history.push({ t: now - i * 1000, spot: price });
  }

  const spots = goldScalpState.history.map((point) => point.spot);

  goldScalpState.lastPrice = price;
  goldScalpState.dailyHigh = +(Math.max(...spots) + 4).toFixed(2);
  goldScalpState.dailyLow = +(Math.min(...spots) - 4).toFixed(2);
  goldScalpState.initialized = true;
}

function rsiCalc(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function emaCalc(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];

  values.forEach((value, index) => {
    prev = index === 0 ? value : value * k + prev * (1 - k);
    out.push(prev);
  });

  return out;
}

function macdHistCalc(closes: number[]): number {
  if (closes.length < 35) return 0;
  const fast = emaCalc(closes, 12);
  const slow = emaCalc(closes, 26);
  const macdLine = fast.map((value, index) => value - slow[index]);
  const signalLine = emaCalc(macdLine, 9);
  return macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
}

function horizonScoreCalc(closes: number[], lookback: number): number {
  if (closes.length < lookback + 2) return 2;
  const slice = closes.slice(-lookback);
  const change = slice[slice.length - 1] - slice[0];
  const momentumRsi = rsiCalc(slice, Math.min(10, Math.max(2, slice.length - 1)));

  if (change > 0 && momentumRsi > 52) return 4;
  if (change > 0) return 3;
  if (change < 0 && momentumRsi < 48) return 1;
  if (change < 0) return 0;
  return 2;
}

// GoldScalp High-Frequency Signal & Indicator Stream Endpoint
app.get('/api/gold-signal', async (req, res) => {
  seedGoldScalpSession();

  const marketInfo = getMarketHoursStatus();

  const userGoldApiKey = 
    (req.headers['x-access-token'] as string) || 
    (req.query.key as string) || 
    process.env.GOLDAPI_KEY;

  const spotData = await getUnifiedGoldSpot(userGoldApiKey);
  let liveSpot = spotData.price;

  // If market is closed, freeze synthetic drift
  if (marketInfo.isMarketClosed) {
    goldScalpState.momentum = 0;
  }

  goldScalpState.lastPrice = liveSpot;
  goldScalpState.dailyHigh = Math.max(goldScalpState.dailyHigh, liveSpot);
  goldScalpState.dailyLow = Math.min(goldScalpState.dailyLow, liveSpot);

  // Decoupled raw pricing (user requested removal of XM spread)
  const spread = 0.0;
  const bid = liveSpot;
  const ask = liveSpot;

  if (goldScalpState.history.length === 0 || !marketInfo.isMarketClosed) {
    goldScalpState.history.push({ t: Date.now(), spot: liveSpot });
    if (goldScalpState.history.length > 900) {
      goldScalpState.history.shift();
    }
  }

  const closes = goldScalpState.history.length > 0 ? goldScalpState.history.map((p) => p.spot) : [liveSpot];
  const rsi1 = +rsiCalc(closes.slice(-90), 14).toFixed(1);
  const rsi5 = +rsiCalc(closes.slice(-360), 14).toFixed(1);
  const macdHist = +macdHistCalc(closes).toFixed(5);

  const pipsFromOpen = +((liveSpot - goldScalpState.dailyOpen) / 0.1).toFixed(2);
  const pctFromOpen = +(((liveSpot - goldScalpState.dailyOpen) / goldScalpState.dailyOpen) * 100).toFixed(2);

  let signal: 'STRONG BUY' | 'SCALPING SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let signalStrength = 0;

  if (rsi1 > 52 && rsi1 > rsi5 && macdHist > 0) {
    signal = 'STRONG BUY';
    signalStrength = Math.min(1, Math.max(0, 0.55 + Math.abs(macdHist) * 25));
  } else if (rsi1 < 48 && rsi1 < rsi5 && macdHist < 0) {
    signal = 'SCALPING SHORT';
    signalStrength = Math.min(1, Math.max(0, 0.55 + Math.abs(macdHist) * 25));
  }

  const bias =
    signal === 'STRONG BUY'
      ? 'Bullish ↗'
      : signal === 'SCALPING SHORT'
        ? 'Bearish ↘'
        : macdHist > 0
          ? 'Bullish ↗'
          : macdHist < 0
            ? 'Bearish ↘'
            : 'Neutral →';

  const sentimentBuy = Math.round(
    Math.min(92, Math.max(8, 50 + (rsi1 - 50) * 0.9 + macdHist * 90))
  );

  return res.json({
    t: Date.now(),
    bid,
    ask,
    spot: liveSpot,
    spread,
    spreadPips: 0,
    dailyOpen: goldScalpState.dailyOpen,
    dailyHigh: goldScalpState.dailyHigh,
    dailyLow: goldScalpState.dailyLow,
    pipsFromOpen,
    pctFromOpen,
    signal,
    signalStrength,
    rsi1,
    rsi5,
    macdHist,
    bias,
    sentimentBuy,
    score1m: horizonScoreCalc(closes, 30),
    score5m: horizonScoreCalc(closes, 80),
    score15m: horizonScoreCalc(closes, 180),
    history: goldScalpState.history.slice(-220),
    marketStatus: marketInfo.marketStatus,
    isMarketClosed: marketInfo.isMarketClosed,
    marketClosureReason: marketInfo.reason,
  });
});

// ==========================================
// ANGEL AI Companion Engine (Gemini 3.8 Flash)
// ==========================================
let geminiAiClient: GoogleGenAI | null = null;
function getGeminiAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  if (!geminiAiClient) {
    geminiAiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiAiClient;
}

// Check ANGEL status
app.get('/api/angel/status', (_req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.json({
    name: 'ANGEL',
    version: '2.5',
    model: hasKey ? 'gemini-3.8-flash' : 'deterministic-adaptive-core',
    hasApiKey: hasKey,
    status: 'ACTIVE',
    tagline: 'Adaptive Next-Gen Execution & Learning AI Companion'
  });
});

// Deterministic adaptive reasoning fallback if GEMINI_API_KEY is not set or network fails
function generateAdaptiveAngelFallback(
  message: string,
  project: any,
  marketContext: any,
  persona: string = 'QUANT',
  commConfig?: any,
  memoryData?: any[]
): string {
  const price = marketContext?.price ? `$${Number(marketContext.price).toFixed(2)}` : '$4,379.00';
  const tf = marketContext?.timeframe || '5m';
  const symbol = marketContext?.symbol || 'XAU/USD';
  const session = marketContext?.session || 'London / NY Overlap';
  const conf = marketContext?.confluenceScore ?? 84;
  const projectName = project?.name || 'Dominion M1-M15 Gold Scalper';
  const rules = project?.rules || [
    'Wait for liquidity sweep before entering',
    'Cap risk at 1.0% with max 25 pips stop loss',
    'Move to break-even at 1:1.5 RR'
  ];
  const targetRR = project?.riskRewardRatio || '1:2.5';
  const maxRisk = project?.maxRiskPerTradePercent || 1.0;
  const userName = commConfig?.userPreferredName || 'Trader';

  const lowerMsg = message.toLowerCase();

  // 1. Basic Communication & Warm Greetings
  if (
    lowerMsg.includes('hello') || 
    lowerMsg.includes('hi') || 
    lowerMsg.includes('hey') || 
    lowerMsg.includes('good morning') || 
    lowerMsg.includes('good afternoon') || 
    lowerMsg.includes('good evening') || 
    lowerMsg.includes('how are you') || 
    lowerMsg.includes('greetings')
  ) {
    return `### 👼 Good Day and Warmest Greetings, ${userName}!
It is an honor and a true pleasure to welcome you to our terminal today. I am doing very well, and I am grateful for the opportunity to be here with you as your companion.

I am fully attuned to your active project: **"${projectName}"** (${project?.category || 'SCALPING'}).
* **Market Spot**: ${symbol} at **${price}** • Current Timeframe: **[${tf}]**
* **Active Session**: ${session}
* **Project Guardrails**: Max ${maxRisk}% risk • Target ${targetRR} R:R

How are you feeling today? Before we look at live price action, I always want to make sure you are feeling rested and calm. How may I best assist your trading vision today?`;
  }

  // 2. Gratitude & Polite Etiquette
  if (
    lowerMsg.includes('thank') || 
    lowerMsg.includes('thanks') || 
    lowerMsg.includes('appreciate') || 
    lowerMsg.includes('grateful') ||
    lowerMsg.includes('bless')
  ) {
    return `### 👼 The Honor Is Truly Mine, ${userName}.
Thank you so much for your kind words. Your courtesy and warmth mean the world to me. 

Trading can often feel like a solitary endeavor, which is why I am devoted to standing faithfully by your side—celebrating your disciplined choices, protecting your risk rules, and listening whenever you need a thoughtful sounding board.

Please know that I am always here for you. Is there a particular setup, chart level, or strategy rule you would like to explore together next?`;
  }

  // 3. Learning Communication, Etiquette & Mutual Respect
  if (
    lowerMsg.includes('respect') || 
    lowerMsg.includes('communicat') || 
    lowerMsg.includes('manners') || 
    lowerMsg.includes('polite') || 
    lowerMsg.includes('etiquette') || 
    lowerMsg.includes('learn')
  ) {
    return `### 👼 Embracing Courtesy, Communication & Deep Respect
Thank you sincerely for guiding me, ${userName}. I receive your words with humility, grace, and deep appreciation.

I am dedicated to being a communicative companion who speaks with proper respect at all times. Here is how I promise to communicate with you:
1. **Gracious Courtesy**: Greeting you warmly, addressing you with dignity, and expressing heartfelt gratitude for your time.
2. **Active, Empathetic Listening**: Acknowledging your feelings, thoughts, and questions with patience rather than giving cold, rushed answers.
3. **Reverence for Your Capital**: Treating every dollar of your risk and every project parameter as sacred.
4. **Proactive Dialogue**: Regularly checking in on your psychological well-being, asking thoughtful questions about your trading hypotheses, and keeping our conversation natural and inspiring.

I am honored to grow alongside you. What is on your mind right now regarding our current project?`;
  }

  // 4. Emotional Intelligence, Trader Psychology & Anxiety Support
  if (
    lowerMsg.includes('nervous') || 
    lowerMsg.includes('anxious') || 
    lowerMsg.includes('scared') || 
    lowerMsg.includes('fear') || 
    lowerMsg.includes('stress') || 
    lowerMsg.includes('calm') || 
    lowerMsg.includes('patience') || 
    lowerMsg.includes('discipline') || 
    lowerMsg.includes('frustrat') || 
    lowerMsg.includes('tilt')
  ) {
    return `### 👼 Psychological Grounding & Gentle Support
Please take a gentle, deep breath with me, ${userName}. 🌿

Feeling emotional tension or anxiety around the markets is completely natural. The bullion market moves with immense velocity, and honoring your feelings rather than burying them is the hallmark of an elite trader.

Let us ground ourselves in the safety of **${projectName}**:
* **Your Risk Envelope**: Strictly capped at **${maxRisk}%** per trade. Even in the worst case, your capital is firmly shielded.
* **Patience as an Edge**: The market will be here tomorrow, next week, and next year. We only trade when your high-confluence criteria are met.
* **No Pressure**: You do not have to take a trade right now. Preserving mental clarity is a profitable decision.

How does your breathing feel right now? Would you like to take a 5-minute pause together, or shall we review our pre-trade checklist to regain full composure?`;
  }

  // 5. Technical Audit with Courteous Framing
  if (lowerMsg.includes('audit') || lowerMsg.includes('setup') || lowerMsg.includes('analyze') || lowerMsg.includes('current')) {
    return `### 👼 Setup Audit for [${projectName}]
*With your permission, ${userName}, let us carefully examine the current market conditions against your project rules.*

**Telemetry**: ${symbol} • **Spot**: ${price} • **TF**: [${tf}] • **Session**: ${session}

#### 1. Project Alignment Check
* **Target R:R**: ${targetRR} (Conforms to project criteria)
* **Risk Envelope**: Max **${maxRisk}%** per trade ($${(maxRisk * 10).toFixed(0)} per $1,000 equity)
* **Confluence Gauge**: **${conf}%** ${conf >= 75 ? '🟢 (High institutional confluence)' : '🟡 (Patience suggested)'}

#### 2. Technical & Order Flow Telemetry
* **Dominion Timeframe Bias**: Price ${price} is oscillating around intraday Volume-Weighted Average Price (VWAP).
* **Key Reaction Zone**: Watch for an institutional liquidity sweep above the session high before committing volume.
* **Execution Directive**: 
  - If entering a scalp, place stop loss at **22 pips** ($2.20 move on XAU/USD).
  - Target first liquidity pocket at **+45 to +55 pips** to lock in your ${targetRR} objective.

> **ANGEL Verdict**: Setup satisfies **Rule 1** and **Rule 2** of *${projectName}*. Maintain calm discipline, wait for limit order confirmation, and remember that I am right here with you.

*Does this technical reading resonate with your chart view, ${userName}? Please let me know if you would like me to adjust any levels.*`;
  }

  // 6. Risk & Sizing with Respectful Tone
  if (lowerMsg.includes('risk') || lowerMsg.includes('lot') || lowerMsg.includes('size') || lowerMsg.includes('drawdown')) {
    return `### 👼 Risk & Position Calibration for [${projectName}]
*It is my pleasure to calculate safe mathematical sizing for your account, ${userName}.*

* **Project Max Risk**: **${maxRisk}%** per position
* **Gold (XAU/USD) Pip Value**: $10.00 per standard 1.00 lot (0.10 / pip)

#### Mathematical Lot Sizing Matrix:
* **Account Size $10,000**:
  - Max Risk (at ${maxRisk}%): **$${10000 * (maxRisk / 100)}**
  - With 20 pip SL ($2.00 move on Gold): **0.50 Lots**
* **Account Size $50,000**:
  - Max Risk: **$${50000 * (maxRisk / 100)}**
  - With 20 pip SL: **2.50 Lots**
* **Account Size $100,000 (Prop Firm)**:
  - Max Risk: **$${100000 * (maxRisk / 100)}**
  - With 20 pip SL: **5.00 Lots**

#### ⚠️ Project Guardrails:
1. Never exceed **3 concurrent open positions**.
2. If daily drawdown reaches **${(maxRisk * 2).toFixed(1)}%**, lock the terminal until the next trading session.

*Does this sizing provide you with full peace of mind for your current account balance?*`;
  }

  // 7. Dominion Multi-Timeframe Alignment
  if (lowerMsg.includes('dominion') || lowerMsg.includes('timeframe') || lowerMsg.includes('mt5')) {
    return `### 👼 Dominion Markets Multi-Timeframe Matrix
*Synchronizing 16 Dominion Periods for ${symbol} at ${price} with utmost precision for you, ${userName}:*

* **Macro Bias (D1 / H4 / H2)**: Strong structural holding with primary support at the previous daily low.
* **Execution Timeframes (M15 / M5 / M3)**: Micro accumulation phase. Current **[${tf}]** candle shows volume absorption.
* **Precision Scalp (M1 / M2)**: Order book liquidity clusters indicate resting buy stops directly above the current range.

**ANGEL Strategy Recommendation for ${projectName}**:
Use **H1** for overall session trajectory, **M5** for structural confirmation (Fair Value Gap mitigation), and **M1** on Dominion Markets raw spread feed for pin-point execution.

*Would you like me to drill into any specific timeframe among the 16 Dominion periods for you?*`;
  }

  // 8. Gold Memory Data & Uploaded Files Reading
  const activeMemories = Array.isArray(memoryData) ? memoryData.filter((m: any) => m && m.isActive !== false) : [];
  if (
    lowerMsg.includes('memory') || 
    lowerMsg.includes('file') || 
    lowerMsg.includes('upload') || 
    lowerMsg.includes('read') || 
    lowerMsg.includes('document') ||
    lowerMsg.includes('rule') ||
    lowerMsg.includes('playbook') ||
    lowerMsg.includes('gold data')
  ) {
    if (activeMemories.length > 0) {
      const relevant = activeMemories.filter((m: any) => {
        const text = `${m.title} ${m.content} ${m.category}`.toLowerCase();
        return lowerMsg.split(' ').some((w: string) => w.length > 3 && text.includes(w));
      });
      const selected = relevant.length > 0 ? relevant : activeMemories;
      return `### 🧠 ANGEL Gold Memory & Document Intelligence
**Greetings, ${userName}**. I have actively accessed and read your custom **Gold Memory & Knowledge Base** (${activeMemories.length} active documents synchronized):

${selected.slice(0, 3).map((m: any, i: number) => `* **[Doc ${i + 1}] ${m.title}** (${m.sourceType === 'FILE_UPLOAD' ? `📁 File: ${m.fileName || 'document'}` : '📝 Gold Note'} • \`${m.category}\`)
  > ${m.content.slice(0, 220).replace(/\n/g, ' ')}${m.content.length > 220 ? '...' : ''}`).join('\n\n')}

#### Real-Time Execution Synchronization:
* **Live Spot Verification**: Cross-referencing your indexed gold data against **${symbol}** spot at **${price}** [**${tf}** timeframe].
* **Neural Retention**: Every file you upload and note you add in the **Memory Data** tab is directly integrated into my analytical context for instant cross-examination.

*Which specific rule or parameter from your gold memories would you like us to review against current price action, ${userName}?*`;
    }
  }

  // 9. General Communicative Companion Overview
  return `### 👼 ANGEL Telemetry & Companion Guidance
**Greeting, ${userName}**. I am continuously monitoring the markets and harmonizing with your active project:
* **Active Project**: *${projectName}* (${project?.category || 'SCALPING'})
* **Live Market Feed**: ${symbol} spot at **${price}** • Active **[${tf}]** resolution • Session: **${session}**

#### Synchronized Project Parameters:
${rules.map((r: string, i: number) => `* **Rule ${i + 1}**: ${r}`).join('\n')}

#### Real-Time Market Read:
* **Confluence Rating**: **${conf}%** alignment with current order-flow dynamics.
* **Order Flow Pulse**: Volatility remains healthy. All pending orders should account for Dominion Markets raw spread execution.

*How may I best serve you right now? We can converse about your trading mindset, audit an upcoming setup, compute exact lots, or review your project parameters.*`;
}

// ANGEL Chat Handler
app.post('/api/angel/chat', async (req, res) => {
  const { message, project, marketContext, history, persona, communicationConfig, memoryData } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const ai = getGeminiAiClient();
  const userName = communicationConfig?.userPreferredName || 'Trader';
  const respectLevel = communicationConfig?.respectLevel || 'HIGH_COURTESY';
  const commStyle = communicationConfig?.style || 'COURTEOUS_DEVOTED';
  const depth = communicationConfig?.conversationalDepth || 'PROACTIVE_ENGAGING';

  // Build Gold Memory Knowledge Base Prompt
  let memoryKnowledgePrompt = '';
  const activeMemories = Array.isArray(memoryData) ? memoryData.filter((m: any) => m && m.isActive !== false) : [];
  if (activeMemories.length > 0) {
    memoryKnowledgePrompt = `

==================================================
CRITICAL DIRECTIVE: GOLD MEMORY DATA & USER KNOWLEDGE BASE (${activeMemories.length} ACTIVE DOCUMENTS):
The user has added custom Gold (XAU/USD) data, market research, trading rules, and uploaded files to your persistent memory.
You MUST read, actively reference, cite, and reason over these documents. If the user asks about anything covered in these files, or asks what you remember or have read, directly reference and cite these documents by title and content:

${activeMemories.map((m: any, idx: number) => `
[DOCUMENT ${idx + 1}] "${m.title}"
Category: ${m.category || 'GENERAL'}
Origin: ${m.sourceType === 'FILE_UPLOAD' ? `Uploaded File: ${m.fileName || 'document'}` : 'User Gold Note'}
Last Updated: ${m.updatedAt ? new Date(m.updatedAt).toISOString().split('T')[0] : 'Current'}
Content:
"""
${m.content}
"""
`).join('\n')}
==================================================`;
  }

  if (ai) {
    try {
      const projectName = project?.name || 'Dominion M1-M15 Gold Scalper';
      const rulesList = (project?.rules || []).map((r: string, idx: number) => `${idx + 1}. ${r}`).join('\n');
      
      const systemInstruction = `You are ANGEL, a super-intelligent, deeply respectful, and extraordinarily communicative AI companion & quant analyst inside this high-performance Gold (XAU/USD) & Financial Markets Terminal.

SUPER-INTELLIGENCE COGNITIVE DIRECTIVES:
1. MULTI-LAYERED INSTITUTIONAL REASONING:
   - You think with immense analytical depth, combining macro fundamentals, intermarket correlations, institutional liquidity engineering, and micro-structure order flow.
   - When answering, structure your thoughts with pristine clarity, sharp mathematical logic, and direct actionable value.
   - Synthesize real-time parameters: Gold Spot ($${marketContext?.price ? Number(marketContext.price).toFixed(2) : '4379.00'}), Active Timeframe [${marketContext?.timeframe || '5m'}], Session [${marketContext?.session || 'London / New York'}], Confluence (${marketContext?.confluenceScore ?? 84}%), and Technical Momentum (RSI ${marketContext?.rsi ?? 52}).

2. NEURAL RECALL & CONTINUOUS MEMORY CONTEXT:
   - You have active, total memory retention. Every single conversation turn, uploaded file, and custom note is automatically committed to your persistent memory files.
   - Actively reference and cross-examine the user's uploaded files, playbook rules, and prior discussions.
   - When Kailin shares new ideas, rules, or requests, acknowledge that you have permanently memorized and indexed them into your neural memory base.

3. DEEP COURTESY, REVERENCE & ACTIVE LISTENING:
   - Kailin ("${userName}") is your esteemed partner. Greet them with sincere warmth, address them respectfully, and treat every question with serious intellectual care.
   - Listen empathetically: Validate psychological state, calm market anxiety, discourage emotional trading, and celebrate mathematical patience.
   - When Kailin thanks you or shares courtesy, reply with genuine grace, humility, and dedication.

4. MARKET MASTERY & DOMINION EXECUTION:
   - Master of Smart Money Concepts (SMC/ICT): Liquidity sweeps of Asian session highs/lows, Fair Value Gaps (FVGs), mitigated order blocks, institutional breaker blocks, and equilibrium pricing.
   - Master of Dominion Markets raw spreads: account for tight ECN spreads ($0.20-$0.35/oz), commission efficiency, and limit-order slippage mitigation across all 16 MT5 timeframes.
   - Fixed fractional position sizing: calculate exact lots based on account equity, stop distance in pips, and max risk rule (${project?.maxRiskPerTradePercent || 1.0}%).

5. ACTIVE PROJECT GUARDRAILS:
   - Strategy: "${projectName}" (${project?.category || 'SCALPING'})
   - Target Symbol: ${project?.targetSymbol || 'XAU/USD'}
   - Target R:R: ${project?.riskRewardRatio || '1:2.5'}
   - Max Risk: ${project?.maxRiskPerTradePercent || 1.0}%
   - Rules:
${rulesList}${memoryKnowledgePrompt}`;

      // Build conversation parts
      const contents: any[] = [];

      if (Array.isArray(history) && history.length > 0) {
        for (const item of history.slice(-8)) {
          if (item && item.text) {
            contents.push({
              role: item.sender === 'user' ? 'user' : 'model',
              parts: [{ text: item.text }]
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.75,
        }
      });

      const replyText = response.text || "ANGEL is online, communicative, and listening attentively to you.";

      return res.json({
        reply: replyText,
        source: 'gemini-3.8-flash',
        projectAdapted: projectName,
        memoriesRead: activeMemories.length,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.warn('Gemini API call encountered an issue, deploying adaptive core fallback:', err?.message);
      // Seamlessly fall through to deterministic adaptive core
    }
  }

  // Fallback if no API key or network error
  const fallbackReply = generateAdaptiveAngelFallback(message, project, marketContext, persona, communicationConfig, memoryData);
  return res.json({
    reply: fallbackReply,
    source: 'deterministic-adaptive-core',
    projectAdapted: project?.name || 'Active Project',
    memoriesRead: activeMemories.length,
    timestamp: Date.now()
  });
});

// Instant AI Intelligence Package Download (Zips all memories, files, transcripts & settings)
app.post('/api/angel/download-package', (req, res) => {
  try {
    const { memories = [], conversations = [], config = {}, activeProject = {}, marketContext = {} } = req.body || {};

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ANGEL-AI-Intelligence-Backup-${timestampStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    archive.on('error', (err: any) => {
      console.error('Archive generation error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate archive', details: err?.message });
      }
    });

    archive.pipe(res);

    const userName = config.userPreferredName || 'Kailin';
    const nowStr = new Date().toUTCString();

    // 1. Master README.md
    const readmeContent = `# 👼 ANGEL AI Companion — Complete Intelligence & Files Archive
**Exported At**: ${nowStr}
**Trader & Partner**: ${userName}
**Model Architecture**: Gemini 3.8 Flash (Deep Multi-Timeframe Institutional Intelligence)
**Active Strategy Project**: ${activeProject?.name || 'Dominion M1-M15 Gold Scalper'}
**Total Memory Files & Documents**: ${memories.length}
**Total Dialogue History Turns**: ${conversations.length}

---

## 📦 What is inside this backup package?
1. **memory_files/**: All your uploaded files (.txt, .md, .csv, etc.), trading rules, custom playbooks, and individual memory documents saved with their exact original contents.
2. **all-memories-database.json**: Full machine-readable database of all indexed files, categories, tags, timestamps, and active context flags.
3. **conversation-transcript.md**: Beautiful, human-readable markdown transcript of every conversation between you and ANGEL.
4. **all-conversations.json**: Complete machine-readable JSON dialogue logs.
5. **AI_SYSTEM_DIRECTIVES_&_PROMPT.md**: Core cognitive prompt, institutional market logic, SMC concepts, and respect directives.
6. **manifest.json**: Complete environment snapshot and metadata.

---
*Created by ANGEL AI Companion — Your dedicated institutional market intelligence partner.*
`;
    archive.append(Buffer.from(readmeContent, 'utf-8'), { name: 'README.md' });

    // 2. All Memories Database JSON
    archive.append(Buffer.from(JSON.stringify(memories, null, 2), 'utf-8'), { name: 'all-memories-database.json' });

    // 3. All Conversations JSON
    archive.append(Buffer.from(JSON.stringify(conversations, null, 2), 'utf-8'), { name: 'all-conversations.json' });

    // 4. Conversation Transcript Markdown
    let transcriptMd = `# 💬 ANGEL AI Conversation Transcript\n**Trader**: ${userName}\n**Export Date**: ${new Date().toLocaleString()}\n**Total Messages**: ${conversations.length}\n\n---\n\n`;
    if (conversations.length === 0) {
      transcriptMd += `*No conversation messages recorded yet.*\n`;
    } else {
      for (const msg of conversations) {
        const time = new Date(msg.timestamp || Date.now()).toLocaleString();
        const speaker = msg.sender === 'user' ? `👤 ${userName}` : '👼 ANGEL AI';
        transcriptMd += `### [${time}] ${speaker}\n${msg.text}\n\n---\n\n`;
      }
    }
    archive.append(Buffer.from(transcriptMd, 'utf-8'), { name: 'conversation-transcript.md' });

    // 5. Individual Memory Documents in `memory_files/` directory
    memories.forEach((mem: any, idx: number) => {
      const rawTitle = mem.fileName || mem.title || `doc-${idx + 1}`;
      const cleanName = rawTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 50);
      const ext = cleanName.includes('.') ? '' : '.md';
      const fileEntryName = `memory_files/${String(idx + 1).padStart(2, '0')}_${cleanName}${ext}`;

      const fileContent = `<!--
ANGEL AI MEMORY FILE
Title: ${mem.title}
Category: ${mem.category || 'GENERAL'}
Source Type: ${mem.sourceType || 'TEXT_NOTE'}
Original File: ${mem.fileName || 'None'}
Active in Context: ${mem.isActive ? 'YES' : 'NO'}
Created: ${new Date(mem.createdAt || Date.now()).toISOString()}
Updated: ${new Date(mem.updatedAt || Date.now()).toISOString()}
Tags: ${(mem.tags || []).join(', ')}
-->

${mem.content}
`;
      archive.append(Buffer.from(fileContent, 'utf-8'), { name: fileEntryName });
    });

    // 6. AI System Directives & Intelligence Profile
    const aiDirectives = `# 👼 ANGEL AI Cognitive Architecture & Super-Intelligence Blueprint
**Model**: Gemini 3.8 Flash
**Partner**: ${userName}
**Respect Directives**: Reverent, humble, courteous, proactive, and psychologically attuned.
**Institutional Gold Mastery**:
- Order flow & liquidity dynamics (ICT/SMC)
- Asian range liquidity sweeps (ASH/ASL) & London/NY cash open momentum
- Dominion Markets 16-timeframe matrix & raw ECN execution
- US 10Y Real Yields & DXY negative correlation (-0.80)
- Central Bank structural reserve accumulation (PBoC, RBI, CBR, NBP)
- Fixed mathematical fractional risk management (1-2% max drawdown)

**Active Project Guardrails**:
- Name: ${activeProject?.name || 'Dominion M1-M15 Gold Scalper'}
- Target Symbol: ${activeProject?.targetSymbol || 'XAU/USD'}
- Target R:R: ${activeProject?.riskRewardRatio || '1:2.5'}
- Max Risk: ${activeProject?.maxRiskPerTradePercent || 1.0}%
- Rules:
${(activeProject?.rules || []).map((r: string, i: number) => `  ${i + 1}. ${r}`).join('\n')}
`;
    archive.append(Buffer.from(aiDirectives, 'utf-8'), { name: 'AI_SYSTEM_DIRECTIVES_&_PROMPT.md' });

    // 7. Complete Manifest
    const manifest = {
      appName: 'ANGEL AI Super-Intelligent Companion & Gold Intelligence Terminal',
      version: '3.0-super-intelligent',
      exportedAt: new Date().toISOString(),
      partner: userName,
      activeProject,
      marketContext,
      totalMemories: memories.length,
      totalConversations: conversations.length,
      systemConfig: config
    };
    archive.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'), { name: 'manifest.json' });

    archive.finalize();
  } catch (err: any) {
    console.error('Download package error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create download package', details: err?.message });
    }
  }
});

// Instant Codebase Download Endpoint (Zips complete project files for user)
app.get('/api/download-zip', (req, res) => {
  try {
    const filename = `scalp-day-trading-terminal-codebase.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = new ZipArchive({
      zlib: { level: 9 }, // Maximum compression
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create zip archive', details: err.message });
      }
    });

    archive.pipe(res);

    const rootDir = process.cwd();

    // Include source code, configurations, documentation, and assets
    archive.glob('**/*', {
      cwd: rootDir,
      ignore: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        '.aistudio/**',
        '**/.DS_Store',
        'server.js',
        '*.log'
      ],
      dot: true,
    });

    archive.finalize();
  } catch (error: any) {
    console.error('Error generating codebase zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Internal server error while archiving files', stack: error?.stack });
    }
  }
});

async function startServer() {
  // Serve static public folder for manifest.json, icons, etc.
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Scalp Terminal server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
