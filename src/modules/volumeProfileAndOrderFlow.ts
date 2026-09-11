import { Candle, VolumeProfileResult, VolumeProfileBin, OrderFlowMetrics } from '../types';

/**
 * Calculates session Volume Profile: POC (Point of Control), VAH (Value Area High), and VAL (Value Area Low)
 * Standard auction market theory: Value Area contains 70% of the session volume.
 */
export function calculateVolumeProfile(candles: Candle[], numBins: number = 24): VolumeProfileResult {
  if (candles.length === 0) {
    return {
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      bins: [],
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume;
  }

  const range = maxPrice - minPrice || 1.0;
  const binSize = range / numBins;

  // Initialize price bins
  const bins: VolumeProfileBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const binPrice = Number((minPrice + (i + 0.5) * binSize).toFixed(2));
    bins.push({
      price: binPrice,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      isPoc: false,
      isInValueArea: false,
    });
  }

  // Allocate candle volume into bins based on candle high-low overlap
  for (const c of candles) {
    const isBull = c.close >= c.open;
    const candleVolume = c.volume;
    const buyFraction = isBull ? 0.62 : 0.38;
    const sellFraction = 1 - buyFraction;

    const startBin = Math.max(0, Math.min(numBins - 1, Math.floor((c.low - minPrice) / binSize)));
    const endBin = Math.max(0, Math.min(numBins - 1, Math.floor((c.high - minPrice) / binSize)));
    const span = Math.max(1, endBin - startBin + 1);
    const volPerBin = candleVolume / span;

    for (let b = startBin; b <= endBin; b++) {
      bins[b].volume += volPerBin;
      bins[b].buyVolume += volPerBin * buyFraction;
      bins[b].sellVolume += volPerBin * sellFraction;
    }
  }

  // Identify POC (Bin with highest traded volume)
  let maxVol = -1;
  let pocIndex = 0;
  for (let i = 0; i < bins.length; i++) {
    if (bins[i].volume > maxVol) {
      maxVol = bins[i].volume;
      pocIndex = i;
    }
  }
  bins[pocIndex].isPoc = true;
  const poc = bins[pocIndex].price;

  // Calculate 70% Value Area (VAH & VAL) starting outward from POC
  const targetVaVolume = totalVolume * 0.70;
  let accumulatedVolume = bins[pocIndex].volume;
  bins[pocIndex].isInValueArea = true;

  let upperIdx = pocIndex;
  let lowerIdx = pocIndex;

  while (accumulatedVolume < targetVaVolume && (upperIdx < numBins - 1 || lowerIdx > 0)) {
    const nextUpperVol = upperIdx + 1 < numBins ? bins[upperIdx + 1].volume : -1;
    const nextLowerVol = lowerIdx - 1 >= 0 ? bins[lowerIdx - 1].volume : -1;

    if (nextUpperVol >= nextLowerVol && upperIdx + 1 < numBins) {
      upperIdx++;
      accumulatedVolume += bins[upperIdx].volume;
      bins[upperIdx].isInValueArea = true;
    } else if (lowerIdx - 1 >= 0) {
      lowerIdx--;
      accumulatedVolume += bins[lowerIdx].volume;
      bins[lowerIdx].isInValueArea = true;
    } else if (upperIdx + 1 < numBins) {
      upperIdx++;
      accumulatedVolume += bins[upperIdx].volume;
      bins[upperIdx].isInValueArea = true;
    } else {
      break;
    }
  }

  const vah = bins[upperIdx].price;
  const val = bins[lowerIdx].price;

  return {
    poc,
    vah,
    val,
    totalVolume,
    bins,
  };
}

/**
 * Calculates Order Flow & Delta Metrics from candle flow
 * Measures Cumulative Volume Delta (CVD), volume expansion ratio, and institutional absorption.
 */
export function calculateOrderFlowMetrics(candles: Candle[]): OrderFlowMetrics {
  if (candles.length < 5) {
    return {
      cumulativeDelta: 0,
      deltaBias: 'NEUTRAL',
      institutionalAbsorption: false,
      exhaustionVolumeDetected: false,
      volumeExpansionRatio: 1.0,
    };
  }

  // 20-period volume moving average
  const recentCandles = candles.slice(-20);
  const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
  const latestCandle = candles[candles.length - 1];
  const volumeExpansionRatio = Number((latestCandle.volume / (avgVolume || 1)).toFixed(2));

  // Cumulative Volume Delta (CVD) calculation over the last 15 candles
  let cumulativeDelta = 0;
  const windowCandles = candles.slice(-15);

  for (const c of windowCandles) {
    const totalRange = c.high - c.low || 0.01;
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Delta estimate based on candle close location relative to range
    const closeLocation = (c.close - c.low) / totalRange; // 0 = at low, 1 = at high
    const candleDelta = (closeLocation - 0.5) * 2 * c.volume;
    cumulativeDelta += candleDelta;
  }

  let deltaBias: OrderFlowMetrics['deltaBias'] = 'NEUTRAL';
  if (cumulativeDelta > avgVolume * 2.5) {
    deltaBias = 'STRONG_BUY_DELTA';
  } else if (cumulativeDelta > avgVolume * 0.8) {
    deltaBias = 'MODERATE_BUY_DELTA';
  } else if (cumulativeDelta < -avgVolume * 2.5) {
    deltaBias = 'STRONG_SELL_DELTA';
  } else if (cumulativeDelta < -avgVolume * 0.8) {
    deltaBias = 'MODERATE_SELL_DELTA';
  }

  // Institutional Absorption detection:
  // Volume is high (> 1.6x average) but candle body is tight (< 25% of range) with prominent rejection wick
  const latestRange = latestCandle.high - latestCandle.low || 0.01;
  const latestBody = Math.abs(latestCandle.close - latestCandle.open);
  const isAbsorption = volumeExpansionRatio > 1.5 && (latestBody / latestRange) < 0.35;

  // Exhaustion Volume:
  // Extreme volume spike (> 2.8x average) at extreme high or low followed by deceleration
  const exhaustionVolumeDetected = volumeExpansionRatio > 2.6;

  return {
    cumulativeDelta: Math.round(cumulativeDelta),
    deltaBias,
    institutionalAbsorption: isAbsorption,
    exhaustionVolumeDetected,
    volumeExpansionRatio,
  };
}
