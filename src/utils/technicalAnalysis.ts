import { Candle, TimeframeId, TimeframeMetrics } from '../types';

/**
 * Generate realistic historical candles for an instrument
 */
export function generateCandles(
  basePrice: number,
  count: number = 70,
  volatilityPercent: number = 0.002,
  timeframe: TimeframeId = '5m'
): Candle[] {
  const candles: Candle[] = [];
  let currentClose = basePrice;
  const now = Date.now();
  
  const tfMinutesMap: Record<TimeframeId, number> = {
    '1m': 1,
    '5m': 5,
    '15m': 15,
    '1h': 60,
    '4h': 240,
    '1d': 1440,
  };
  const intervalMs = (tfMinutesMap[timeframe] || 5) * 60 * 1000;

  for (let i = count - 1; i >= 0; i--) {
    const time = now - i * intervalMs;
    // Micro trend cycle
    const cycle = Math.sin((count - i) / 8) * (volatilityPercent * 0.4);
    const randomShift = (Math.random() - 0.49) * volatilityPercent + cycle;
    const open = currentClose;
    const close = open * (1 + randomShift);
    const wickHigh = Math.max(open, close) + Math.random() * (open * volatilityPercent * 0.7);
    const wickLow = Math.min(open, close) - Math.random() * (open * volatilityPercent * 0.7);
    const volume = Math.floor(800 + Math.random() * 2400 + (Math.abs(close - open) / open) * 100000);

    const isBullish = close >= open;

    // Detect Order Blocks and FVGs on every 6-10 candles
    let orderBlock: 'BULLISH_OB' | 'BEARISH_OB' | undefined = undefined;
    if (i % 9 === 0) {
      orderBlock = isBullish ? 'BULLISH_OB' : 'BEARISH_OB';
    }

    let fvg: 'BULLISH_FVG' | 'BEARISH_FVG' | undefined = undefined;
    if (i % 7 === 0) {
      fvg = isBullish ? 'BULLISH_FVG' : 'BEARISH_FVG';
    }

    candles.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(wickHigh.toFixed(5)),
      low: Number(wickLow.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume,
      isBullish,
      orderBlock,
      fvg,
    });

    currentClose = close;
  }

  return candles;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const ema = values[i] * k + emaValues[i - 1] * (1 - k);
    emaValues.push(ema);
  }
  return emaValues;
}

/**
 * Calculate Relative Strength Index (RSI)
 */
export function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length <= period) return 50.0;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

/**
 * Calculate Volume Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): { vwap: number; upperBand: number; lowerBand: number } {
  if (candles.length === 0) return { vwap: 0, upperBand: 0, lowerBand: 0 };
  
  let totalPV = 0;
  let totalVolume = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    totalPV += typicalPrice * c.volume;
    totalVolume += c.volume;
  }

  const vwap = totalVolume > 0 ? totalPV / totalVolume : candles[candles.length - 1].close;
  
  // Standard deviation calculation
  let varianceSum = 0;
  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    varianceSum += Math.pow(typicalPrice - vwap, 2) * c.volume;
  }
  const stdDev = totalVolume > 0 ? Math.sqrt(varianceSum / totalVolume) : vwap * 0.0015;

  return {
    vwap: Number(vwap.toFixed(4)),
    upperBand: Number((vwap + 2 * stdDev).toFixed(4)),
    lowerBand: Number((vwap - 2 * stdDev).toFixed(4)),
  };
}

/**
 * Live Multi-Timeframe percentage and trend calculator across 1m, 5m, 15m, 1h, 4h, 1d
 */
export function calculateMultiTimeframeMetrics(
  currentPrice: number,
  pipMultiplier: number
): TimeframeMetrics[] {
  // We model realistic MTF anchor opens with persistent relative distance
  const tfConfigs: Array<{
    id: TimeframeId;
    label: string;
    factor: number;
    baseRsi: number;
    trendBias: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  }> = [
    { id: '1m', label: '1M (1 Min)', factor: 0.0003, baseRsi: 54.2, trendBias: 'BULL' },
    { id: '5m', label: '5M (5 Min)', factor: 0.0009, baseRsi: 61.8, trendBias: 'STRONG_BULL' },
    { id: '15m', label: '15M (15 Min)', factor: 0.0018, baseRsi: 58.4, trendBias: 'BULL' },
    { id: '1h', label: '1H (1 Hour)', factor: 0.0034, baseRsi: 52.1, trendBias: 'BULL' },
    { id: '4h', label: '4H (4 Hours)', factor: 0.0068, baseRsi: 48.6, trendBias: 'NEUTRAL' },
    { id: '1d', label: '1D (Daily)', factor: 0.0125, baseRsi: 64.0, trendBias: 'STRONG_BULL' },
  ];

  return tfConfigs.map((cfg, idx) => {
    // Generate organic live % change based on current price relative to anchor
    const pseudoNoise = Math.sin(currentPrice * 10 + idx * 1.5) * cfg.factor;
    const changePercent = Number((pseudoNoise * 100).toFixed(2));
    const openPrice = currentPrice / (1 + changePercent / 100);
    const changePips = Number(((currentPrice - openPrice) * pipMultiplier).toFixed(1));
    const range = Math.abs(currentPrice - openPrice) * 1.4;
    const high = Math.max(currentPrice, openPrice) + range * 0.4;
    const low = Math.min(currentPrice, openPrice) - range * 0.4;

    const rsi = Math.min(92, Math.max(18, Number((cfg.baseRsi + pseudoNoise * 200).toFixed(1))));
    
    let trend = cfg.trendBias;
    if (changePercent > 0.3) trend = 'STRONG_BULL';
    else if (changePercent > 0.05) trend = 'BULL';
    else if (changePercent < -0.3) trend = 'STRONG_BEAR';
    else if (changePercent < -0.05) trend = 'BEAR';
    else trend = 'NEUTRAL';

    const emaCross = changePercent > 0.05 ? 'BULLISH' : changePercent < -0.05 ? 'BEARISH' : 'NEUTRAL';
    const vwapStatus = changePercent >= 0 ? 'ABOVE' : 'BELOW';
    const volumeBias = changePercent >= 0 ? 'ACCUMULATION' : 'DISTRIBUTION';
    const confluenceScore = Math.min(98, Math.max(35, Math.round(50 + changePercent * 25 + (rsi > 50 ? 15 : -15))));

    return {
      timeframe: cfg.id,
      label: cfg.label,
      changePercent,
      changePips,
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      trend,
      rsi,
      emaCross,
      vwapStatus,
      volumeBias,
      confluenceScore,
    };
  });
}
