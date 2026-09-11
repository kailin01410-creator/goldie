import { 
  Candle, 
  KeyPriceLevels, 
  LiquiditySweepEvent, 
  AmdAnalysisResult, 
  AmdPhase,
  SwingPoint
} from '../types';

/**
 * Detects institutional Liquidity Sweeps (Buy-side liquidity BSL or Sell-side liquidity SSL)
 * A sweep occurs when price wicks beyond a major level (PDH, PDL, Asian H/L, Swing High/Low)
 * but immediately closes back inside the range, trapping breakout traders.
 */
export function detectLiquiditySweeps(
  candles: Candle[],
  keyLevels: KeyPriceLevels,
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): LiquiditySweepEvent[] {
  const sweeps: LiquiditySweepEvent[] = [];
  if (candles.length < 3) return sweeps;

  const recentCandles = candles.slice(-8); // analyze last 8 candles for recent sweeps

  for (const c of recentCandles) {
    // 1. Check Buy-Side Liquidity (BSL) Sweeps above PDH or Asian High
    if (c.high > keyLevels.pdh && c.close < keyLevels.pdh) {
      const sweepPips = Number(((c.high - keyLevels.pdh) * 10).toFixed(1));
      sweeps.push({
        poolType: 'BUY_SIDE_LIQUIDITY',
        sweptLevelName: 'PDH',
        sweptPrice: keyLevels.pdh,
        reversalPrice: c.close,
        wickDisplacementPips: sweepPips,
        timestamp: c.time,
        status: 'CONFIRMED',
      });
    } else if (c.high > keyLevels.asianSession.high && c.close < keyLevels.asianSession.high) {
      const sweepPips = Number(((c.high - keyLevels.asianSession.high) * 10).toFixed(1));
      sweeps.push({
        poolType: 'BUY_SIDE_LIQUIDITY',
        sweptLevelName: 'ASIAN_HIGH',
        sweptPrice: keyLevels.asianSession.high,
        reversalPrice: c.close,
        wickDisplacementPips: sweepPips,
        timestamp: c.time,
        status: 'CONFIRMED',
      });
    }

    // 2. Check Sell-Side Liquidity (SSL) Sweeps below PDL or Asian Low
    if (c.low < keyLevels.pdl && c.close > keyLevels.pdl) {
      const sweepPips = Number(((keyLevels.pdl - c.low) * 10).toFixed(1));
      sweeps.push({
        poolType: 'SELL_SIDE_LIQUIDITY',
        sweptLevelName: 'PDL',
        sweptPrice: keyLevels.pdl,
        reversalPrice: c.close,
        wickDisplacementPips: sweepPips,
        timestamp: c.time,
        status: 'CONFIRMED',
      });
    } else if (c.low < keyLevels.asianSession.low && c.close > keyLevels.asianSession.low) {
      const sweepPips = Number(((keyLevels.asianSession.low - c.low) * 10).toFixed(1));
      sweeps.push({
        poolType: 'SELL_SIDE_LIQUIDITY',
        sweptLevelName: 'ASIAN_LOW',
        sweptPrice: keyLevels.asianSession.low,
        reversalPrice: c.close,
        wickDisplacementPips: sweepPips,
        timestamp: c.time,
        status: 'CONFIRMED',
      });
    }

    // 3. Check Major Swing High/Low sweeps
    if (swingHighs.length > 0) {
      const lastMajorHigh = swingHighs[swingHighs.length - 1];
      if (c.high > lastMajorHigh.price && c.close < lastMajorHigh.price) {
        sweeps.push({
          poolType: 'BUY_SIDE_LIQUIDITY',
          sweptLevelName: 'MAJOR_SWING_HIGH',
          sweptPrice: lastMajorHigh.price,
          reversalPrice: c.close,
          wickDisplacementPips: Number(((c.high - lastMajorHigh.price) * 10).toFixed(1)),
          timestamp: c.time,
          status: 'CONFIRMED',
        });
      }
    }

    if (swingLows.length > 0) {
      const lastMajorLow = swingLows[swingLows.length - 1];
      if (c.low < lastMajorLow.price && c.close > lastMajorLow.price) {
        sweeps.push({
          poolType: 'SELL_SIDE_LIQUIDITY',
          sweptLevelName: 'MAJOR_SWING_LOW',
          sweptPrice: lastMajorLow.price,
          reversalPrice: c.close,
          wickDisplacementPips: Number(((lastMajorLow.price - c.low) * 10).toFixed(1)),
          timestamp: c.time,
          status: 'CONFIRMED',
        });
      }
    }
  }

  return sweeps;
}

/**
 * Evaluates the Accumulation–Manipulation–Distribution (AMD / Power of Three) Cycle
 * - Accumulation: Asian session consolidation range
 * - Manipulation: London open Judas swing sweeping Asian high or low
 * - Distribution: Real institutional expansion direction into NY session
 */
export function analyzeAmdCycle(
  currentPrice: number,
  keyLevels: KeyPriceLevels,
  sweeps: LiquiditySweepEvent[]
): AmdAnalysisResult {
  const asianHigh = keyLevels.asianSession.high;
  const asianLow = keyLevels.asianSession.low;
  const asianRange = { high: asianHigh, low: asianLow };

  const hasBullTrap = sweeps.some(s => s.poolType === 'BUY_SIDE_LIQUIDITY');
  const hasBearTrap = sweeps.some(s => s.poolType === 'SELL_SIDE_LIQUIDITY');

  let phase: AmdPhase = 'ACCUMULATION';
  let expectedExpansionDirection: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let manipulationJudas: AmdAnalysisResult['manipulationJudas'] = { direction: 'NONE', sweepPips: 0 };
  let description = '';

  if (hasBullTrap) {
    phase = 'DISTRIBUTION';
    expectedExpansionDirection = 'SELL';
    const sweep = sweeps.find(s => s.poolType === 'BUY_SIDE_LIQUIDITY');
    manipulationJudas = { direction: 'BULL_TRAP', sweepPips: sweep?.wickDisplacementPips || 14 };
    description = `Bearish AMD Confirmed: London Judas Swing swept Buy-Side Liquidity above $${asianHigh.toFixed(2)} (${manipulationJudas.sweepPips} pips false breakout). Smart money distributed longs; expecting downward expansion.`;
  } else if (hasBearTrap) {
    phase = 'DISTRIBUTION';
    expectedExpansionDirection = 'BUY';
    const sweep = sweeps.find(s => s.poolType === 'SELL_SIDE_LIQUIDITY');
    manipulationJudas = { direction: 'BEAR_TRAP', sweepPips: sweep?.wickDisplacementPips || 16 };
    description = `Bullish AMD Confirmed: London Judas Swing swept Sell-Side Liquidity below $${asianLow.toFixed(2)} (${manipulationJudas.sweepPips} pips false breakdown). Smart money accumulated discount orders; expecting upward expansion.`;
  } else if (currentPrice >= asianLow && currentPrice <= asianHigh) {
    phase = 'ACCUMULATION';
    expectedExpansionDirection = 'NEUTRAL';
    description = `Asian Accumulation Active: Price oscillating between $${asianLow.toFixed(2)} and $${asianHigh.toFixed(2)} (${keyLevels.asianSession.rangePips} pips range). Awaiting London manipulation Judas swing.`;
  } else if (currentPrice > asianHigh) {
    phase = 'MANIPULATION';
    expectedExpansionDirection = 'SELL'; // Potential Judas swing
    manipulationJudas = { direction: 'BULL_TRAP', sweepPips: Number(((currentPrice - asianHigh) * 10).toFixed(1)) };
    description = `Manipulation Stage: Price pushed above Asian High ($${asianHigh.toFixed(2)}). Monitoring for immediate failure back below level to confirm short distribution.`;
  } else {
    phase = 'MANIPULATION';
    expectedExpansionDirection = 'BUY'; // Potential Judas swing
    manipulationJudas = { direction: 'BEAR_TRAP', sweepPips: Number(((asianLow - currentPrice) * 10).toFixed(1)) };
    description = `Manipulation Stage: Price dipped below Asian Low ($${asianLow.toFixed(2)}). Monitoring for immediate reclamation above level to confirm long distribution.`;
  }

  return {
    phase,
    accumulationRange: asianRange,
    manipulationJudas,
    expectedExpansionDirection,
    description,
  };
}
