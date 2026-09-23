import { GoldTick } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateSimpleRSI(closes: number[], period = 14): number {
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

export function calculateEMA(values: number[], period: number): number[] {
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

export function calculateMacdHistogram(closes: number[]): number {
  if (closes.length < 35) return 0;

  const fast = calculateEMA(closes, 12);
  const slow = calculateEMA(closes, 26);
  const macdLine = fast.map((value, index) => value - slow[index]);
  const signalLine = calculateEMA(macdLine, 9);

  return macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
}

export function calculateHorizonScore(closes: number[], lookback: number): number {
  if (closes.length < lookback + 2) return 2;

  const slice = closes.slice(-lookback);
  const change = slice[slice.length - 1] - slice[0];
  const momentumRsi = calculateSimpleRSI(slice, Math.min(10, Math.max(2, slice.length - 1)));

  if (change > 0 && momentumRsi > 52) return 4;
  if (change > 0) return 3;
  if (change < 0 && momentumRsi < 48) return 1;
  if (change < 0) return 0;

  return 2;
}

export function computeGoldScalpSignal(
  history: { t: number; spot: number }[],
  bid: number,
  ask: number,
  dailyOpen: number,
  dailyHigh: number,
  dailyLow: number
): GoldTick {
  const closes = history.map((point) => point.spot);
  const spot = +((bid + ask) / 2).toFixed(2);
  const spread = +(ask - bid).toFixed(2);
  const spreadPips = +(spread / 0.1).toFixed(2);

  const rsi1 = +calculateSimpleRSI(closes.slice(-90), 14).toFixed(1);
  const rsi5 = +calculateSimpleRSI(closes.slice(-360), 14).toFixed(1);
  const macdHist = +calculateMacdHistogram(closes).toFixed(5);

  const pipsFromOpen = +((spot - dailyOpen) / 0.1).toFixed(2);
  const pctFromOpen = +(((spot - dailyOpen) / (dailyOpen || spot)) * 100).toFixed(2);

  let signal: GoldTick['signal'] = 'NEUTRAL';
  let signalStrength = 0;

  if (rsi1 > 52 && rsi1 > rsi5 && macdHist > 0) {
    signal = 'STRONG BUY';
    signalStrength = clamp(0.55 + Math.abs(macdHist) * 25, 0, 1);
  }

  if (rsi1 < 48 && rsi1 < rsi5 && macdHist < 0) {
    signal = 'SCALPING SHORT';
    signalStrength = clamp(0.55 + Math.abs(macdHist) * 25, 0, 1);
  }

  const bias: GoldTick['bias'] =
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
    clamp(50 + (rsi1 - 50) * 0.9 + macdHist * 90, 8, 92)
  );

  return {
    t: Date.now(),
    bid,
    ask,
    spot,
    spread,
    spreadPips,
    dailyOpen,
    dailyHigh,
    dailyLow,
    pipsFromOpen,
    pctFromOpen,
    signal,
    signalStrength,
    rsi1,
    rsi5,
    macdHist,
    bias,
    sentimentBuy,
    score1m: calculateHorizonScore(closes, 30),
    score5m: calculateHorizonScore(closes, 80),
    score15m: calculateHorizonScore(closes, 180),
    history: history.slice(-220)
  };
}
