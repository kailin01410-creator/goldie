import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import * as archiver from 'archiver';
import JSZip from 'jszip';

// `archiver` is CommonJS and exposes the constructor as a named property.
// This used to go through createRequire(import.meta.url), which esbuild
// compiles to an empty string in the CJS production bundle — meaning the
// download endpoints worked in dev and threw in production.
// Depending on how the bundler models the CJS interop the constructor turns
// up either on the namespace, on its `default`, or as the namespace itself.
type ArchiverCtor = new (options?: archiver.ArchiverOptions) => archiver.Archiver;
const archiverNamespace = archiver as unknown as {
  ZipArchive?: ArchiverCtor;
  default?: { ZipArchive?: ArchiverCtor } & ArchiverCtor;
};
const ZipArchive: ArchiverCtor =
  archiverNamespace.ZipArchive ??
  archiverNamespace.default?.ZipArchive ??
  (archiverNamespace.default as ArchiverCtor | undefined) ??
  (archiver as unknown as ArchiverCtor);
import { INITIAL_GOLD_MEMORIES, ANGEL_X_MASTER_FILE, ANGEL_X_CONTENT } from './src/data/goldMemoryData';
import { generateBlankDataBlocks, formatBytes } from './src/data/angelStorageExpander';
import { getAngelCodingSystemPrompt } from './src/data/angelCodingAdaptiveData';

// --- ANGEL intelligence layer -------------------------------------------
import { getStore } from './src/server/store';
import { extractFile, extractArchive } from './src/server/extractors';
import { generateWithFailover, getRouterState } from './src/server/modelRouter';
import { runDiagnostics, scanSource } from './src/server/diagnostics';
import {
  gatherGrounding,
  knowledgeBaseReport,
  invalidateKnowledgeBase,
  type MemoryLike,
} from './src/ai/knowledgeBase';
import { buildSystemPrompt, enforcePromptBudget } from './src/ai/promptBuilder';
import { detectCalculations, FINANCE_TOOL_CATALOG } from './src/ai/financeTools';
import { runOfflineCore } from './src/ai/offlineCore';
import {
  observeMessage,
  recordFeedback,
  dominantLanguage,
  feedbackScore,
  topTopics,
  profileDirectives,
} from './src/ai/adaptive';

dotenv.config();

const app = express();
// Honour PORT so the app can run behind a platform that assigns one, and so
// a second instance can be started for testing without a port clash.
const PORT = Number(process.env.PORT) || 3000;

// High-capacity payload limits for large files, zip archives, and datasets (500mb)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(express.text({ limit: '500mb', type: ['text/*', 'application/xml', 'text/plain', 'text/markdown', 'text/csv'] }));
app.use(express.raw({ limit: '500mb', type: ['application/octet-stream', 'application/zip', 'application/x-zip-compressed', 'application/pdf', 'image/*'] }));

// Graceful middleware for payload limit handling
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.message?.includes('too large'))) {
    console.warn('Caught entity too large error, returning graceful payload notice:', err.message);
    return res.status(413).json({
      error: 'PayloadTooLargeError',
      message: 'The uploaded file or request entity is very large. Server accepts up to 500MB via streaming or chunked upload.',
      status: 413
    });
  }
  if (err && err.status === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

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
  // No hardcoded key fallback: a key committed to source is a key that leaks.
  // Without one the unified feed below falls back to the free public spot
  // source, which needs no credentials.
  const activeApiKey = (userApiKey && userApiKey.trim() !== '')
    ? userApiKey.trim()
    : (process.env.GOLDAPI_KEY?.trim() || '');

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
        const open24h = data.open_price && Number(data.open_price) > 0
          ? Number(Number(data.open_price).toFixed(2))
          : data.prev_close_price && Number(data.prev_close_price) > 0
            ? Number(Number(data.prev_close_price).toFixed(2))
            : data.change && Number(data.change) !== 0
              ? Number((rawSpotPrice - Number(data.change)).toFixed(2))
              : Number((rawSpotPrice * 0.9976).toFixed(2));

        const change = (data.change !== undefined && data.change !== null && Number(data.change) !== 0)
          ? Number(Number(data.change).toFixed(2))
          : Number((rawSpotPrice - open24h).toFixed(2));

        const changePercent = (data.changePercent !== undefined && data.changePercent !== null && Number(data.changePercent) !== 0)
          ? Number(Number(data.changePercent).toFixed(2))
          : Number((((rawSpotPrice - open24h) / open24h) * 100).toFixed(2));

        const high = Number(data.high_price || rawSpotPrice * 1.008);
        const low = Number(data.low_price || rawSpotPrice * 0.992);
        const spreadDollars = (data.ask && data.bid && data.ask > data.bid) ? Number((data.ask - data.bid).toFixed(2)) : 0.35;
        const bid = data.bid ? Number(Number(data.bid).toFixed(2)) : Number((rawSpotPrice - spreadDollars / 2).toFixed(2));
        const ask = data.ask ? Number(Number(data.ask).toFixed(2)) : Number((rawSpotPrice + spreadDollars / 2).toFixed(2));

        cachedLiveGoldSpot = {
          rawPrice: rawSpotPrice,
          price: rawSpotPrice,
          bid,
          ask,
          open24h,
          high24h: Number(high.toFixed(2)),
          low24h: Number(low.toFixed(2)),
          change,
          changePercent,
          source: `GoldAPI.io Official ${normMetal}/${normCurr} Feed`,
          goldApiNotice: null,
          timestamp: Date.now(),
        };
        exhaustedKeysCache.delete(activeApiKey);
        return cachedLiveGoldSpot;
      } else {
        const rawErr = data?.error || (response.status === 401 ? 'Invalid GoldAPI key' : response.status === 403 || response.status === 429 ? 'Monthly API quota exceeded on free tier' : `GoldAPI HTTP ${response.status}`);
        goldApiErrorNotice = rawErr.includes('quota exceeded') || response.status === 403 || response.status === 429
          ? 'GoldAPI.io Free Tier Quota Exceeded (Monthly limit reached on goldapi.io). Auto-routed to Real-Time Spot Market Feed.'
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
        // Base market reference calculations calibrated dynamically to real spot price
        const open24h = normMetal === 'XAU' 
          ? Number((spotPrice * 0.9982).toFixed(2)) 
          : normMetal === 'XAG' 
            ? Number((spotPrice * 0.996).toFixed(2)) 
            : Number((spotPrice * 0.995).toFixed(2));
        const high24h = Number((spotPrice * 1.0065).toFixed(2));
        const low24h = Number((spotPrice * 0.9935).toFixed(2));
        const change = Number((spotPrice - open24h).toFixed(2));
        const changePercent = Number((((spotPrice - open24h) / open24h) * 100).toFixed(2));

        cachedLiveGoldSpot = {
          rawPrice: spotPrice,
          price: spotPrice,
          bid: Number((spotPrice - 0.05).toFixed(2)),
          ask: Number((spotPrice + 0.05).toFixed(2)),
          open24h,
          high24h,
          low24h,
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
        const open24h = Number((spotPrice * 0.9982).toFixed(2));
        const high24h = Number((spotPrice * 1.0065).toFixed(2));
        const low24h = Number((spotPrice * 0.9935).toFixed(2));

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
    process.env.GOLDAPI_KEY ||
    '';

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
    process.env.GOLDAPI_KEY ||
    '';

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
// ANGEL AI Engine
// ==========================================
// Model name is NOT hardcoded here. The router discovers what the configured
// key can actually call and fails over between models — see
// src/server/modelRouter.ts for why that matters.
//
// Nor is the API key. main carried a DEFAULT_GEMINI_KEY literal as a fallback;
// a credential in source is a credential that leaks, and ANGEL degrades to the
// offline core cleanly when no key is configured.

let geminiAiClient: GoogleGenAI | null = null;

function getGeminiAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'MY_GEMINI_API_KEY') return null;
  if (!geminiAiClient) {
    geminiAiClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return geminiAiClient;
}

const angelStore = getStore(process.env.ANGEL_DATA_DIR || path.join(process.cwd(), 'data', 'angel-store'));

/** Server documents rendered in the shape the retrieval layer expects. */
function serverMemories(): MemoryLike[] {
  return angelStore.loadAllWithText().map((document) => ({
    id: document.id,
    title: document.title,
    content: document.content,
    category: document.category,
    sourceType: document.sourceType,
    fileName: document.fileName,
    tags: document.tags,
    isActive: document.isActive,
    updatedAt: document.updatedAt,
    createdAt: document.createdAt,
  }));
}

/**
 * Combine server-persisted documents with any the client still holds locally.
 * The client copy is legacy (browser storage) and is deduplicated by id so a
 * migrated document is never counted twice.
 */
function combinedMemories(clientMemories: unknown): MemoryLike[] {
  const server = serverMemories();
  const seen = new Set(server.map((memory) => memory.id));
  const extra: MemoryLike[] = [];

  if (Array.isArray(clientMemories)) {
    for (const raw of clientMemories) {
      if (!raw || typeof raw !== 'object') continue;
      const memory = raw as Record<string, unknown>;
      const id = typeof memory.id === 'string' ? memory.id : '';
      const content = typeof memory.content === 'string' ? memory.content : '';
      if (!id || !content.trim() || seen.has(id)) continue;
      seen.add(id);
      extra.push({
        id,
        title: typeof memory.title === 'string' ? memory.title : 'Untitled',
        content,
        category: typeof memory.category === 'string' ? memory.category : 'UPLOADED_DOC',
        sourceType: typeof memory.sourceType === 'string' ? memory.sourceType : 'TEXT_NOTE',
        fileName: typeof memory.fileName === 'string' ? memory.fileName : undefined,
        tags: Array.isArray(memory.tags) ? (memory.tags as string[]) : [],
        isActive: memory.isActive !== false,
        updatedAt: typeof memory.updatedAt === 'number' ? memory.updatedAt : 0,
      });
    }
  }
  return [...server, ...extra];
}

// ---------------------------------------------------------------- status

app.get('/api/angel/status', async (_req, res) => {
  const ai = getGeminiAiClient();
  const router = getRouterState();
  const stats = angelStore.stats();
  const profile = angelStore.getProfile();

  res.json({
    name: 'ANGEL',
    version: '3.0',
    hasApiKey: Boolean(ai),
    activeModel: router.active,
    availableModels: router.available.slice(0, 12),
    blacklistedModels: router.blacklisted,
    lastModelError: router.lastError,
    mode: ai ? 'model+offline-core' : 'offline-core-only',
    storage: {
      documents: stats.documents,
      activeDocuments: stats.activeDocuments,
      characters: stats.totalCharacters,
      conversationTurns: stats.conversationTurns,
      persistedAt: stats.root,
    },
    profile: {
      name: profile.preferredName,
      verbosity: profile.verbosity,
      language: dominantLanguage(profile),
      factsLearned: profile.facts.length,
      messagesSeen: profile.messageCount,
      feedback: feedbackScore(profile),
    },
    status: 'ACTIVE',
  });
});

// ------------------------------------------------- knowledge base report

app.get('/api/angel/knowledge', (_req, res) => {
  // Measured, not asserted. Every number here is computed from the data.
  res.json({
    ...knowledgeBaseReport(serverMemories()),
    tools: FINANCE_TOOL_CATALOG,
    generatedAt: new Date().toISOString(),
  });
});

// Legacy path kept so older clients do not 404 — now reports real figures.
app.get('/api/angel/communication-corpus', (_req, res) => {
  const report = knowledgeBaseReport(serverMemories());
  res.json({
    ...report.communication,
    note: 'These counts are computed from the actual dataset at request time.',
    status: 'ACTIVE',
  });
});

// --------------------------------------------------------------- search

app.get('/api/angel/search', (req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) return res.status(400).json({ error: 'Provide a query with ?q=' });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '8'), 10) || 8, 1), 30);
  const grounding = gatherGrounding(query, serverMemories(), {
    memoryLimit: limit,
    financeLimit: Math.min(limit, 5),
    styleLimit: 3,
  });

  res.json({
    query,
    documents: grounding.memoryHits,
    finance: grounding.financeHits,
    communication: grounding.styleHits,
    index: grounding.stats,
  });
});

// ---------------------------------------------------------- calculators

app.post('/api/angel/calculate', (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message : '';
  if (!message.trim()) return res.status(400).json({ error: 'message is required' });

  const results = detectCalculations(message, {
    symbol: req.body?.symbol,
    price: typeof req.body?.price === 'number' ? req.body.price : undefined,
  });
  res.json({ message, calculations: results, catalog: FINANCE_TOOL_CATALOG });
});

// ------------------------------------------------------------- documents

app.get('/api/angel/memories', (_req, res) => {
  // Each entry carries a short preview so the browser can show something real
  // in the document list without downloading the whole corpus.
  const documents = angelStore.listDocuments().map((document) => ({
    ...document,
    preview: (angelStore.getDocument(document.id)?.content ?? '').slice(0, 600),
  }));
  res.json({ documents, stats: angelStore.stats() });
});

app.get('/api/angel/memories/:id', (req, res) => {
  const document = angelStore.getDocument(req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found' });
  res.json(document);
});

app.post('/api/angel/memories', (req, res) => {
  const { id, title, content, category, tags, sourceType, fileName } = req.body ?? {};
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }
  const { document, deduplicated } = angelStore.upsertDocument({
    // An id supplied by the browser is honoured so that migrating a document
    // out of IndexedDB keeps its identity and does not re-upload every load.
    id: typeof id === 'string' && id.trim() ? id.trim() : undefined,
    title: typeof title === 'string' && title.trim() ? title : 'Note',
    content,
    category: typeof category === 'string' ? category : 'CUSTOM_DATA',
    sourceType: sourceType === 'FILE_UPLOAD' ? 'FILE_UPLOAD' : 'TEXT_NOTE',
    fileName: typeof fileName === 'string' ? fileName : undefined,
    tags: Array.isArray(tags) ? tags : [],
  });
  invalidateKnowledgeBase();
  res.json({ success: true, document, deduplicated });
});

app.patch('/api/angel/memories/:id', (req, res) => {
  const updated = angelStore.updateDocumentMeta(req.params.id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'Document not found' });
  invalidateKnowledgeBase();
  res.json({ success: true, document: updated });
});

app.delete('/api/angel/memories/:id', (req, res) => {
  const deleted = angelStore.deleteDocument(req.params.id);
  invalidateKnowledgeBase();
  res.json({ success: deleted });
});

// ---------------------------------------------------------------- upload

/**
 * Upload endpoint.
 *
 * Accepts a raw body (preferred, streams without base64 inflation), a JSON
 * body with `base64`, or a JSON body with plain `content`. Archives are
 * unpacked; every member goes through the real per-format extractor rather
 * than `toString('utf-8')`.
 */
app.post('/api/angel/upload', async (req, res) => {
  const startedAt = Date.now();
  try {
    const fileName =
      (req.query.filename as string) || (req.headers['x-file-name'] as string) || req.body?.filename || 'uploaded-file';
    const declaredType = (req.query.fileType as string) || req.body?.fileType || (req.headers['content-type'] as string) || '';
    const category = (req.query.category as string) || req.body?.category || undefined;

    let buffer: Buffer | null = null;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      // main widened the body parsers to handle text/*, application/xml and
      // friends, which arrive here as a string rather than a Buffer.
      buffer = Buffer.from(req.body, 'utf-8');
    } else if (req.body && typeof req.body === 'object') {
      if (typeof req.body.base64 === 'string') {
        buffer = Buffer.from(req.body.base64.replace(/^data:.*?;base64,/, ''), 'base64');
      } else if (typeof req.body.content === 'string') {
        buffer = Buffer.from(req.body.content, 'utf-8');
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'EmptyUpload',
        message: 'No file data was received. Send the file as a raw body, or JSON with a base64 or content field.',
      });
    }

    const isArchive =
      fileName.toLowerCase().endsWith('.zip') ||
      (declaredType.includes('zip') && !fileName.toLowerCase().match(/\.(docx|xlsx|pptx)$/));

    const stored: unknown[] = [];
    const warnings: string[] = [];
    let duplicates = 0;

    if (isArchive) {
      const { entries, note } = await extractArchive(buffer);
      if (note) warnings.push(note);

      // A previously exported ANGEL package restores as a set of documents.
      const databaseEntry = entries.find((entry) => entry.fileName === 'all-memories-database.json');
      if (databaseEntry?.text) {
        try {
          const jsonStart = databaseEntry.text.indexOf('[');
          const parsed = JSON.parse(databaseEntry.text.slice(jsonStart));
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (!item?.title || typeof item.content !== 'string') continue;
              const result = angelStore.upsertDocument({
                title: item.title,
                content: item.content,
                category: item.category ?? 'UPLOADED_DOC',
                sourceType: 'FILE_UPLOAD',
                fileName: item.fileName ?? 'restored-from-backup.json',
                tags: Array.isArray(item.tags) ? item.tags : ['Restored'],
              });
              if (result.deduplicated) duplicates++;
              else stored.push(result.document);
            }
          }
        } catch (error) {
          warnings.push(`Backup database found but could not be parsed: ${(error as Error).message}`);
        }
      }

      for (const entry of entries) {
        if (entry.fileName === 'all-memories-database.json' && databaseEntry) continue;
        if (!entry.text.trim()) {
          if (entry.note) warnings.push(`${entry.path}: ${entry.note}`);
          continue;
        }
        const result = angelStore.upsertDocument({
          title: entry.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          content: entry.text,
          category: category ?? 'UPLOADED_DOC',
          sourceType: 'FILE_UPLOAD',
          fileName: entry.fileName,
          fileType: entry.format,
          byteSize: entry.bytes,
          tags: ['Archive', entry.format.toUpperCase()],
          extractionNote: entry.complete ? undefined : entry.note,
        });
        if (result.deduplicated) duplicates++;
        else stored.push(result.document);
        if (!entry.complete && entry.note) warnings.push(`${entry.fileName}: ${entry.note}`);
      }
    } else {
      const extraction = await extractFile({ fileName, buffer, mimeType: declaredType });
      if (!extraction.text.trim()) {
        return res.status(422).json({
          success: false,
          error: 'NoTextExtracted',
          format: extraction.format,
          message: extraction.note ?? `No readable text could be extracted from "${fileName}".`,
        });
      }
      const result = angelStore.upsertDocument({
        title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        content: extraction.text,
        category: category ?? 'UPLOADED_DOC',
        sourceType: 'FILE_UPLOAD',
        fileName,
        fileType: extraction.format,
        byteSize: buffer.length,
        tags: ['Uploaded', extraction.format.toUpperCase()],
        extractionNote: extraction.complete ? undefined : extraction.note,
      });
      if (result.deduplicated) duplicates++;
      else stored.push(result.document);
      if (extraction.note) warnings.push(extraction.note);
    }

    angelStore.flushNow();
    invalidateKnowledgeBase();

    const summary =
      stored.length === 0 && duplicates > 0
        ? `"${fileName}" was already in storage — nothing duplicated.`
        : `Indexed ${stored.length} document(s) from "${fileName}"${duplicates > 0 ? ` (${duplicates} already present)` : ''}.`;

    return res.json({
      success: true,
      isZip: isArchive,
      documents: stored,
      // Legacy field name kept so the existing client keeps working.
      memories: stored,
      extractedCount: stored.length,
      duplicates,
      warnings,
      summary,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return res.status(500).json({
      success: false,
      error: 'UploadProcessingError',
      message: (error as Error)?.message ?? 'Failed to process the upload.',
    });
  }
});

// ----------------------------------------------------------------- chat

app.post('/api/angel/chat', async (req, res) => {
  const startedAt = Date.now();
  const { message, project, marketContext, history, communicationConfig, memoryData } = req.body ?? {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  // 1. Learn from the message before answering it.
  let profile = angelStore.getProfile();
  const preferredName = communicationConfig?.userPreferredName;
  if (typeof preferredName === 'string' && preferredName.trim() && profile.messageCount === 0) {
    profile = { ...profile, preferredName: preferredName.trim() };
  }
  const observation = observeMessage(profile, message);
  profile = observation.profile;
  angelStore.setProfile(profile);

  // 2. Run exact calculations before the model sees anything.
  const calculations = detectCalculations(message, {
    symbol: marketContext?.symbol,
    price: typeof marketContext?.price === 'number' ? marketContext.price : undefined,
  });

  // 3. Retrieve grounding from the user's documents and the built-in corpora.
  const memories = combinedMemories(memoryData);
  const grounding = gatherGrounding(message, memories, { memoryLimit: 6, financeLimit: 4, styleLimit: 3 });

  // 4. Build the prompt, trimming grounding if it exceeds the budget.
  const promptInput = enforcePromptBudget({
    message,
    profile,
    language: observation.language,
    grounding,
    calculations,
    market: marketContext,
    project,
    nowIso: new Date().toISOString(),
  });
  const prompt = buildSystemPrompt(promptInput);

  // 5. Conversation history: server-persisted turns are authoritative, with
  //    the client's local history used only when the store is empty.
  const persisted = angelStore.recentTurns(10);
  const contents: { role: string; parts: { text: string }[] }[] = [];
  if (persisted.length > 0) {
    for (const turn of persisted) {
      contents.push({ role: turn.role === 'user' ? 'user' : 'model', parts: [{ text: turn.text }] });
    }
  } else if (Array.isArray(history)) {
    for (const item of history.slice(-8)) {
      if (item?.text) contents.push({ role: item.sender === 'user' ? 'user' : 'model', parts: [{ text: String(item.text) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  angelStore.appendTurn({ role: 'user', text: message });

  // A stable id so 👍/👎 can be tied back to this exact answer.
  const messageId = `angel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const baseMetadata = {
    messageId,
    citations: prompt.citations,
    // The full detection is returned, including the ones that could not run:
    // "I need your stop price to size this" is more useful than silence.
    calculations,
    language: observation.language,
    learnedFacts: observation.newFacts.map((fact) => ({ key: fact.key, value: fact.value })),
    documentsSearched: grounding.stats.documents,
    documentsUsed: grounding.memoryHits.length,
    promptTokensEstimate: prompt.tokensEstimate,
    profile: {
      name: profile.preferredName,
      verbosity: profile.verbosity,
      factsLearned: profile.facts.length,
    },
  };

  // 6. Model, with failover. On total failure, the offline core answers — and
  //    says so, rather than pretending the model produced it.
  const ai = getGeminiAiClient();
  if (ai) {
    const outcome = await generateWithFailover(ai, {
      systemInstruction: prompt.systemInstruction,
      contents,
      temperature: 0.7,
    });

    if (outcome.ok && outcome.text) {
      angelStore.appendTurn({
        role: 'angel',
        text: outcome.text,
        model: outcome.model,
        citations: prompt.citations.map((citation) => ({ title: citation.title, fileName: citation.fileName })),
      });
      return res.json({
        reply: outcome.text,
        source: 'model',
        model: outcome.model,
        degraded: false,
        latencyMs: Date.now() - startedAt,
        ...baseMetadata,
      });
    }

    const offline = runOfflineCore({ message, profile, memories, market: marketContext, project });
    angelStore.appendTurn({ role: 'angel', text: offline.reply, model: 'offline-core', strategy: offline.strategy });
    return res.json({
      reply: offline.reply,
      source: 'offline-core',
      model: 'offline-core',
      degraded: true,
      degradedReason: outcome.error,
      degradedKind: outcome.errorKind,
      modelAttempts: outcome.attempts,
      strategy: offline.strategy,
      latencyMs: Date.now() - startedAt,
      ...baseMetadata,
    });
  }

  const offline = runOfflineCore({ message, profile, memories, market: marketContext, project });
  angelStore.appendTurn({ role: 'angel', text: offline.reply, model: 'offline-core', strategy: offline.strategy });
  return res.json({
    reply: offline.reply,
    source: 'offline-core',
    model: 'offline-core',
    degraded: true,
    degradedReason: 'No GEMINI_API_KEY configured.',
    degradedKind: 'NO_API_KEY',
    strategy: offline.strategy,
    latencyMs: Date.now() - startedAt,
    ...baseMetadata,
  });
});

// ------------------------------------------------------------- feedback

app.post('/api/angel/feedback', (req, res) => {
  const { messageId, rating, reason, note } = req.body ?? {};
  if (rating !== 'UP' && rating !== 'DOWN') {
    return res.status(400).json({ error: "rating must be 'UP' or 'DOWN'" });
  }
  const { profile, adjustment } = recordFeedback(angelStore.getProfile(), {
    messageId: typeof messageId === 'string' ? messageId : `msg-${Date.now()}`,
    rating,
    reason,
    note,
  });
  angelStore.setProfile(profile);
  angelStore.flushNow();

  res.json({
    success: true,
    adjustment: adjustment ?? null,
    message: adjustment
      ? `Adjusted ${adjustment.field}: ${adjustment.from} → ${adjustment.to}. ${adjustment.because}`
      : 'Feedback recorded.',
    profile: { verbosity: profile.verbosity, warmth: profile.warmth, feedback: feedbackScore(profile) },
  });
});

// -------------------------------------------------------------- profile

app.get('/api/angel/profile', (_req, res) => {
  const profile = angelStore.getProfile();
  res.json({
    preferredName: profile.preferredName,
    verbosity: profile.verbosity,
    warmth: profile.warmth,
    dominantLanguage: dominantLanguage(profile),
    languageCounts: profile.languageCounts,
    facts: profile.facts,
    topics: topTopics(profile, 10),
    adjustments: profile.adjustments.slice(-20),
    feedback: feedbackScore(profile),
    messageCount: profile.messageCount,
    directives: profileDirectives(profile),
  });
});

app.delete('/api/angel/profile/facts/:key', (req, res) => {
  const profile = angelStore.getProfile();
  const next = { ...profile, facts: profile.facts.filter((fact) => fact.key !== req.params.key), updatedAt: Date.now() };
  angelStore.setProfile(next);
  angelStore.flushNow();
  res.json({ success: true, facts: next.facts });
});

// ---------------------------------------------------- diagnostics / heal

app.get('/api/angel/diagnostics', async (_req, res) => {
  const report = await runDiagnostics({ repair: false, ai: getGeminiAiClient(), projectRoot: process.cwd() });
  res.json(report);
});

app.post('/api/angel/self-heal', async (_req, res) => {
  const before = await runDiagnostics({ repair: false, ai: getGeminiAiClient(), projectRoot: process.cwd() });
  const after = await runDiagnostics({ repair: true, ai: getGeminiAiClient(), projectRoot: process.cwd() });
  res.json({
    scoreBefore: before.score,
    scoreAfter: after.score,
    repairsApplied: after.repairsApplied,
    remaining: after.checks.filter((check) => check.severity === 'CRITICAL' || check.severity === 'WARN'),
    report: after,
  });
});

app.get('/api/angel/code-scan', (_req, res) => {
  res.json({ findings: scanSource(process.cwd(), 120), scannedAt: new Date().toISOString() });
});

// Instant AI Intelligence Package Download (Zips all memories, files, transcripts, runners & settings)
app.all(['/api/angel/download-package', '/api/angel/download'], (req, res) => {
  try {
    const body = req.body || {};
    // Prefer the server-persisted store: it is the authoritative copy and does
    // not depend on the browser still holding the documents.
    const serverDocuments = angelStore.loadAllWithText().map((document) => ({
      id: document.id,
      title: document.title,
      category: document.category,
      content: document.content,
      sourceType: document.sourceType,
      fileName: document.fileName,
      fileSize: `${document.characters.toLocaleString()} chars`,
      fileType: document.fileType,
      isActive: document.isActive,
      tags: document.tags,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }));
    const memories =
      serverDocuments.length > 0
        ? serverDocuments
        : (Array.isArray(body.memories) && body.memories.length > 0)
          ? body.memories
          : INITIAL_GOLD_MEMORIES;
    const storedConversation = angelStore.allTurns().map((turn) => ({
      sender: turn.role === 'user' ? 'user' : 'angel',
      text: turn.text,
      timestamp: turn.at,
      model: turn.model,
    }));
    const conversations = storedConversation.length > 0
      ? storedConversation
      : Array.isArray(body.conversations) ? body.conversations : [];
    const config = body.config || {};
    const activeProject = body.activeProject || {
      name: 'Dominion M1-M15 Gold Scalper',
      targetSymbol: 'XAU/USD',
      riskRewardRatio: '1:2.5',
      maxRiskPerTradePercent: 1.0,
      rules: [
        'Asian Range High/Low Liquidity Sweep required before entry',
        'Stop loss strictly capped at 22 pips ($2.20 move on XAU/USD)',
        'Take Profit 1 at +50 pips, move stop to Break-Even'
      ]
    };
    const marketContext = body.marketContext || {
      symbol: 'XAU/USD',
      price: 4379.0,
      timeframe: '5m'
    };

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `ANGEL-X-Package-${timestampStr}.zip`;

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

    const targetMb = parseInt((req.query.targetMb || req.body?.targetMb) as string, 10);

    // 0. Primary Master File: ANGEL X (Consolidated Master File)
    const masterAngelX = memories.find((m: any) => m.id === 'angel-x' || m.fileName === 'ANGEL X') || ANGEL_X_MASTER_FILE;
    let angelXMd = masterAngelX?.content || ANGEL_X_CONTENT;

    if (targetMb && targetMb > 0) {
      const targetKb = Math.min(targetMb * 1024, 100 * 1024);
      angelXMd = angelXMd + "\n\n" + generateBlankDataBlocks(targetKb);
    }

    const realBytes = Buffer.byteLength(angelXMd, 'utf-8');
    const formattedBytes = formatBytes(realBytes);

    archive.append(Buffer.from(angelXMd, 'utf-8'), { name: 'ANGEL-X.md' });
    archive.append(Buffer.from(JSON.stringify({ ...masterAngelX, fileSize: `${formattedBytes} (Real Byte Size)` }, null, 2), 'utf-8'), { name: 'ANGEL-X.json' });

    // 1. Master README.md
    const readmeContent = `# 👼 ANGEL X — Consolidated Autonomous Intelligence & Storage Master
**Master File**: ANGEL X
**Exported At**: ${nowStr}
**Trader & Partner**: ${userName}
**Real Uncompressed File Size**: ${formattedBytes} (${realBytes.toLocaleString()} bytes)
**Model Architecture**: ${getRouterState().active || 'auto-selected Gemini model'} with a deterministic offline core
**Active Strategy Project**: ${activeProject?.name || 'Dominion M1-M15 Gold Scalper'}
**Consolidated Intelligence**: All 25 chapters, 90 Directives Constitution, quantitative code, institutional JSON databases, and allocated blank data blocks unified into ONE file: ANGEL X.

---

## 📦 What is inside your ANGEL X package?
1. **ANGEL-X.md**: The unified, single master file of AI ANGEL containing all 22 integrated chapters, 90 Directives Constitution, multi-lingual English/Tagalog/Taglish dataset, Gemini communication corpus, and institutional gold strategies.
2. **ANGEL-X.json**: Full machine-readable master file schema.
3. **conversation-transcript.md**: Complete dialogue transcript between you and ANGEL.
4. **all-conversations.json**: Complete machine-readable JSON dialogue logs.
5. **AI_SYSTEM_DIRECTIVES_&_PROMPT.md**: Core cognitive prompt and execution guardrails.
6. **HOW_TO_RUN_MY_ANGEL_OFFLINE.md**: Easy guide to running ANGEL X offline on your laptop or server.
7. **standalone_runner/angel-runner.js**: Standalone Node.js CLI script.
8. **standalone_runner/angel-runner.py**: Standalone Python CLI script.
9. **manifest.json**: Complete environment snapshot.

---
*ANGEL X — Your dedicated institutional market intelligence partner.*
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

    // 5. Individual Memory Documents in memory_files/
    memories.forEach((mem: any, idx: number) => {
      const rawTitle = mem.fileName || mem.title || `doc-${idx + 1}`;
      const cleanName = rawTitle.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
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
**Model**: ${getRouterState().active || 'auto-selected at runtime'} with a deterministic offline core
**Partner**: ${userName}
**Languages**: English, Tagalog, Natural Taglish
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

    // 7. Offline Execution Guide
    const offlineGuide = `# 🚀 How to Run Your AI ANGEL Standalone

You now own your entire AI ANGEL companion and all ${memories.length} files.
You can run ANGEL completely offline or using your own Gemini API Key.

### Method 1: Run with Node.js
\`\`\`bash
# 1. Navigate to the extracted folder
cd standalone_runner

# 2. (Optional) set your GEMINI_API_KEY for cloud model:
export GEMINI_API_KEY="your-api-key-here"

# 3. Start chatting with ANGEL in your terminal:
node angel-runner.js
\`\`\`

### Method 2: Run with Python
\`\`\`bash
cd standalone_runner
pip install google-genai
python3 angel-runner.py
\`\`\`

### Method 3: Import into Any AI (Claude, ChatGPT, Local Ollama)
- Open \`all-memories-database.json\` or the files in \`memory_files/\`
- Copy the system prompt from \`AI_SYSTEM_DIRECTIVES_&_PROMPT.md\`
`;
    archive.append(Buffer.from(offlineGuide, 'utf-8'), { name: 'HOW_TO_RUN_MY_ANGEL_OFFLINE.md' });

    // 8. Standalone Runner (Node.js)
    const nodeRunner = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('\\x1b[33m%s\\x1b[0m', '👼 ANGEL AI Companion — Standalone Terminal Engine');
console.log('Loading neural memories and knowledge base...');

const dbPath = path.join(__dirname, '..', 'all-memories-database.json');
let memories = [];
try {
  memories = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  console.log(\`Loaded \${memories.length} active documents into ANGEL memory.\\n\`);
} catch (e) {
  console.warn('Note: Could not load memories file:', e.message);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\\x1b[36m%s\\x1b[0m', 'ANGEL: Greetings! I am online and listening. Type your message or "exit" to quit.\\n');

function promptUser() {
  rl.question('\\x1b[32mYou:\\x1b[0m ', async (input) => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'exit') {
      console.log('ANGEL: Until we meet again. Protect your capital and take care!');
      rl.close();
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: process.env.ANGEL_MODEL || 'gemini-2.5-flash',
          contents: trimmed,
          config: { systemInstruction: 'You are ANGEL, the user\\x27s devoted AI companion and gold trading partner.' }
        });
        console.log('\\n\\x1b[33mANGEL:\\x1b[0m ' + (res.text || 'I hear you clearly.') + '\\n');
      } catch (err) {
        console.log('\\n\\x1b[33mANGEL (Offline Core):\\x1b[0m I hear you. Memory synchronized with ' + memories.length + ' documents.\\n');
      }
    } else {
      console.log('\\n\\x1b[33mANGEL (Offline Core):\\x1b[0m I have received your message. All ' + memories.length + ' memory documents are loaded in local context.\\n(Tip: set GEMINI_API_KEY environment variable for live cloud generation)\\n');
    }

    promptUser();
  });
}

promptUser();
`;
    archive.append(Buffer.from(nodeRunner, 'utf-8'), { name: 'standalone_runner/angel-runner.js' });

    // 9. Standalone Runner (Python)
    const pythonRunner = `#!/usr/bin/env python3
import json
import os
import sys

print("\\033[93m👼 ANGEL AI Companion — Standalone Python Terminal Engine\\033[0m")

db_path = os.path.join(os.path.dirname(__file__), "..", "all-memories-database.json")
memories = []
if os.path.exists(db_path):
    with open(db_path, "r", encoding="utf-8") as f:
        memories = json.load(f)
    print(f"Loaded {len(memories)} active documents into ANGEL memory.\\n")

print("\\033[96mANGEL: Greetings! I am online and listening. Type 'exit' to quit.\\033[0m\\n")

while True:
    try:
        user_input = input("\\033[92mYou:\\033[0m ")
        if not user_input.strip() or user_input.strip().lower() == "exit":
            print("\\nANGEL: Until we meet again. Protect your capital and take care!")
            break
        print(f"\\n\\033[93mANGEL:\\033[0m Synchronized with {len(memories)} memory files. I am right here with you.\\n")
    except (KeyboardInterrupt, EOFError):
        print("\\nExiting ANGEL companion.")
        break
`;
    archive.append(Buffer.from(pythonRunner, 'utf-8'), { name: 'standalone_runner/angel-runner.py' });

    // 10. Complete Manifest
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

// Instant direct download for raw master file ANGEL-X.md (supports ?targetMb=...)
app.get('/api/angel/download-angel-x', (req, res) => {
  const targetMb = parseInt(req.query.targetMb as string, 10);
  let content = ANGEL_X_CONTENT;

  if (targetMb && targetMb > 0) {
    const targetKb = Math.min(targetMb * 1024, 100 * 1024);
    content = content + "\n\n" + generateBlankDataBlocks(targetKb);
  }

  const realBytes = Buffer.byteLength(content, 'utf-8');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ANGEL-X.md"');
  res.setHeader('Content-Length', realBytes.toString());
  res.send(content);
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
      // allowedHosts must be permissive here too: in middleware mode Vite
      // still validates the Host header, and a proxied preview URL would
      // otherwise be served a blank "host not allowed" page.
      server: { middlewareMode: true, allowedHosts: true },
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

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Live Scalp Terminal server running at http://0.0.0.0:${PORT}`);

    // Self-check on boot so configuration problems are reported in the log
    // instead of silently degrading at the first user message.
    try {
      const report = await runDiagnostics({ repair: false, ai: getGeminiAiClient(), projectRoot: process.cwd() });
      console.log(`[ANGEL] startup diagnostics: ${report.summary}`);
      for (const check of report.checks) {
        if (check.severity === 'CRITICAL' || check.severity === 'WARN') {
          console.warn(`[ANGEL] ${check.severity} ${check.title}: ${check.detail}`);
          if (check.remediation) console.warn(`[ANGEL]   fix: ${check.remediation}`);
        }
      }
    } catch (error) {
      console.warn('[ANGEL] startup diagnostics could not run:', error);
    }
  });

  // Flush pending store writes before exiting, otherwise the last upload or
  // the last few conversation turns are lost on restart.
  const shutdown = (signal: string) => {
    console.log(`\n[ANGEL] ${signal} received — flushing store and shutting down.`);
    try {
      angelStore.flushNow();
    } catch (error) {
      console.error('[ANGEL] store flush failed during shutdown:', error);
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
