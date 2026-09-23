/**
 * Institutional Trading Session Manager
 * Dynamically tracks, calculates, and highlights real-time Forex & Commodity trading sessions:
 * - Asian / Tokyo Session (00:00 - 08:00 UTC)
 * - London Session (07:00 - 15:30 UTC)
 * - New York Session (12:30 - 21:00 UTC)
 * - London / NY Overlap (12:30 - 15:30 UTC - Peak Institutional Liquidity)
 * 
 * Provides session context for strategy filters, chart shading, and signal feed confluences.
 */

import { Candle, ScalpSignal, StrategyId } from '../types';

export type TradingSessionId = 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'LONDON_NY_OVERLAP' | 'OFF_HOURS' | 'WEEKEND_CLOSED';

export interface MarketSessionDetail {
  id: TradingSessionId;
  name: string;
  shortName: string;
  code: string;
  flag: string;
  utcHours: string;
  startMinutes: number; // minutes from 00:00 UTC
  endMinutes: number;
  isActive: boolean;
  isPeakLiquidity?: boolean;
  progressPercent: number; // 0 - 100
  timeRemainingFormatted: string;
  volatilityRating: 'Low-Med (Accumulation)' | 'High (Breakouts & Sweeps)' | 'Very High (Wall St Flow)' | 'Extreme (Peak Institutional)' | 'Zero (Market Closed)';
  typicalSpreadStatus: 'Standard' | 'Tight' | 'Lowest (Ultra-Low)' | 'Widening' | 'Closed / Off-Market';
  dominantPairs: string[];
  keyStrategies: string[];
  strategyConfluenceHint: string;
  color: {
    bg: string;
    border: string;
    text: string;
    glow: string;
    chartShading: string;
    badgeBg: string;
  };
}

export interface CurrentSessionState {
  utcTimeString: string;
  utcHours: number;
  utcMinutes: number;
  utcSeconds: number;
  currentTotalMinutes: number;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  isMarketClosed: boolean;
  marketClosureReason: string;
  timeUntilMarketOpenFormatted: string;
  activeSessionsSummary: string;
  isAsiaActive: boolean;
  isLondonActive: boolean;
  isNyActive: boolean;
  isOverlapActive: boolean;
  isOffHours: boolean;
  primaryActiveSessionId: TradingSessionId;
  primaryActiveName: string;
  primaryActiveShort: string;
  primaryActiveFlag: string;
  primaryActiveVolatility: string;
  isHighLiquidityWindow: boolean;
  activeStrategyRecommendation: string;
  activeStrategyFilterHint: string;
  sessions: {
    asia: MarketSessionDetail;
    london: MarketSessionDetail;
    newYork: MarketSessionDetail;
    overlap: MarketSessionDetail;
  };
  activeSessionsList: MarketSessionDetail[];
}

// Session Constants & Metadata
export const SESSION_DEFINITIONS: Record<'asia' | 'london' | 'newYork' | 'overlap', Omit<MarketSessionDetail, 'isActive' | 'progressPercent' | 'timeRemainingFormatted'>> = {
  asia: {
    id: 'ASIAN',
    name: 'Asian / Tokyo Session',
    shortName: 'Asia',
    code: 'TYO/SYD',
    flag: '🌏',
    utcHours: '00:00 - 08:00 UTC',
    startMinutes: 0,
    endMinutes: 480,
    volatilityRating: 'Low-Med (Accumulation)',
    typicalSpreadStatus: 'Standard',
    dominantPairs: ['XAU/USD (Range Accumulation)'],
    keyStrategies: [
      'Asian Range Accumulation (AMD Phase A)',
      'VWAP Mean Reversion (±2.0σ Bands)',
      'Session High/Low Liquidity Pool Marking'
    ],
    strategyConfluenceHint: 'Accumulation phase: Price builds liquidity. High win-rate strategies focus on range extremes, VWAP 2σ reversals, and marking key highs/lows for London sweeps.',
    color: {
      bg: 'bg-indigo-950/40',
      border: 'border-indigo-500/40',
      text: 'text-indigo-300',
      glow: 'shadow-indigo-500/20',
      chartShading: 'rgba(99, 102, 241, 0.09)',
      badgeBg: 'bg-indigo-500/15',
    }
  },
  london: {
    id: 'LONDON',
    name: 'London Session (European Flow)',
    shortName: 'London',
    code: 'LDN',
    flag: '🇬🇧',
    utcHours: '07:00 - 15:30 UTC',
    startMinutes: 420,
    endMinutes: 930,
    volatilityRating: 'High (Breakouts & Sweeps)',
    typicalSpreadStatus: 'Tight',
    dominantPairs: ['XAU/USD (Gold Breakouts & Sweeps)'],
    keyStrategies: [
      'Asian Range Breakout & Judas Swing (AMD Phase M)',
      'London Liquidity Sweep & Fair Value Gap (FVG)',
      'Order Flow CVD Absorption'
    ],
    strategyConfluenceHint: 'Manipulation & Expansion phase: High institutional activity. Watch for Judas swings hunting Asian highs/lows before rapid directional expansion into SMC order blocks.',
    color: {
      bg: 'bg-sky-950/40',
      border: 'border-sky-500/40',
      text: 'text-sky-300',
      glow: 'shadow-sky-500/20',
      chartShading: 'rgba(14, 165, 233, 0.09)',
      badgeBg: 'bg-sky-500/15',
    }
  },
  newYork: {
    id: 'NEW_YORK',
    name: 'New York Session (Wall Street Flow)',
    shortName: 'New York',
    code: 'NYC',
    flag: '🇺🇸',
    utcHours: '12:30 - 21:00 UTC',
    startMinutes: 750,
    endMinutes: 1260,
    volatilityRating: 'Very High (Wall St Flow)',
    typicalSpreadStatus: 'Lowest (Ultra-Low)',
    dominantPairs: ['XAU/USD (Wall Street Commodity Flow)'],
    keyStrategies: [
      'DXY vs Gold Inverse Macro Engine (+11% WR Boost)',
      'Order Flow POC Breakouts & Value Area Expansion',
      'Super Confluence Multi-Factor Matrix'
    ],
    strategyConfluenceHint: 'High-momentum continuation & Macro reactions: Peak US dollar and commodity volumes. Strategies factoring DXY inverse correlation and Order Flow POC achieve +85% win rates.',
    color: {
      bg: 'bg-amber-950/40',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      glow: 'shadow-amber-500/20',
      chartShading: 'rgba(245, 158, 11, 0.09)',
      badgeBg: 'bg-amber-500/15',
    }
  },
  overlap: {
    id: 'LONDON_NY_OVERLAP',
    name: 'London / NY Overlap (Golden Window)',
    shortName: 'London & NY Overlap',
    code: 'LDN/NYC',
    flag: '⚡',
    utcHours: '12:30 - 15:30 UTC',
    startMinutes: 750,
    endMinutes: 930,
    isPeakLiquidity: true,
    volatilityRating: 'Extreme (Peak Institutional)',
    typicalSpreadStatus: 'Lowest (Ultra-Low)',
    dominantPairs: ['XAU/USD (Peak Move Golden Window)'],
    keyStrategies: [
      'All Dual-Engine Scalping (M1/M5) & Day Swings (H1)',
      'DXY Macro Correlation Invalidation & Gold Surges',
      'High-Volume Delta POC Retests'
    ],
    strategyConfluenceHint: 'The Golden Window: Highest liquidity and tightest market spreads of the 24-hour cycle. 70%+ of daily Gold range occurs here. All institutional filters are fully active.',
    color: {
      bg: 'bg-emerald-950/50',
      border: 'border-emerald-500/50',
      text: 'text-emerald-300',
      glow: 'shadow-emerald-500/30',
      chartShading: 'rgba(16, 185, 129, 0.12)',
      badgeBg: 'bg-emerald-500/20',
    }
  }
};

/**
 * Format minutes into "Xh Ym remaining" or "Xm remaining"
 */
function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) return 'Ending now';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

/**
 * Calculate detailed session context based on given or current UTC time
 */
export function getCurrentSessionDetails(targetDate?: Date): CurrentSessionState {
  const now = targetDate || new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  const currentTotalMinutes = utcHours * 60 + utcMinutes;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const utcTimeString = `${pad(utcHours)}:${pad(utcMinutes)}:${pad(utcSeconds)} UTC`;

  // Real-world Interbank Gold & Forex Market Hours
  // Markets close Friday at 21:00 UTC (17:00 NY)
  // Markets reopen Sunday at 22:00 UTC (18:00 NY / Sydney open)
  // Daily maintenance break: Monday - Thursday 21:00 - 22:00 UTC (1 hour rollover)
  let isMarketClosed = false;
  let marketClosureReason = '';
  let minutesUntilMarketOpen = 0;

  if (dayOfWeek === 5 && currentTotalMinutes >= 1260) {
    // Friday after 21:00 UTC
    isMarketClosed = true;
    marketClosureReason = 'Global Weekend Close (Friday settlement completed)';
    // Remaining mins on Friday + all Saturday (1440) + Sunday up to 22:00 (1320)
    minutesUntilMarketOpen = (1440 - currentTotalMinutes) + 1440 + 1320;
  } else if (dayOfWeek === 6) {
    // Saturday full 24 hours
    isMarketClosed = true;
    marketClosureReason = 'Global Weekend Close (Interbank liquidity offline)';
    minutesUntilMarketOpen = (1440 - currentTotalMinutes) + 1320;
  } else if (dayOfWeek === 0) {
    // Sunday before 22:00 UTC
    if (currentTotalMinutes < 1320) {
      isMarketClosed = true;
      marketClosureReason = 'Global Weekend Close (Reopening Sydney/Asia session at 22:00 UTC)';
      minutesUntilMarketOpen = 1320 - currentTotalMinutes;
    }
  } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // Monday - Thursday 21:00 - 22:00 UTC Daily Rollover
    if (currentTotalMinutes >= 1260 && currentTotalMinutes < 1320) {
      isMarketClosed = true;
      marketClosureReason = 'Daily Interbank Rollover & Maintenance Break (21:00 - 22:00 UTC)';
      minutesUntilMarketOpen = 1320 - currentTotalMinutes;
    }
  }

  const timeUntilMarketOpenFormatted = isMarketClosed
    ? formatRemainingTime(minutesUntilMarketOpen)
    : 'Market Active';

  // Asia: 00:00 - 08:00 UTC (0 to 480 mins)
  const isAsiaActive = !isMarketClosed && currentTotalMinutes >= 0 && currentTotalMinutes < 480;
  let asiaProgress = 0;
  let asiaRemaining = 0;
  if (isAsiaActive) {
    asiaProgress = Math.min(100, Math.round((currentTotalMinutes / 480) * 100));
    asiaRemaining = 480 - currentTotalMinutes;
  } else {
    // Minutes until next Asia open
    asiaRemaining = currentTotalMinutes < 480 ? 0 : (1440 - currentTotalMinutes);
  }

  // London: 07:00 - 15:30 UTC (420 to 930 mins)
  const isLondonActive = !isMarketClosed && currentTotalMinutes >= 420 && currentTotalMinutes < 930;
  let londonProgress = 0;
  let londonRemaining = 0;
  if (isLondonActive) {
    londonProgress = Math.min(100, Math.round(((currentTotalMinutes - 420) / (930 - 420)) * 100));
    londonRemaining = 930 - currentTotalMinutes;
  } else {
    londonRemaining = currentTotalMinutes < 420 ? (420 - currentTotalMinutes) : (1440 - currentTotalMinutes + 420);
  }

  // New York: 12:30 - 21:00 UTC (750 to 1260 mins)
  const isNyActive = !isMarketClosed && currentTotalMinutes >= 750 && currentTotalMinutes < 1260;
  let nyProgress = 0;
  let nyRemaining = 0;
  if (isNyActive) {
    nyProgress = Math.min(100, Math.round(((currentTotalMinutes - 750) / (1260 - 750)) * 100));
    nyRemaining = 1260 - currentTotalMinutes;
  } else {
    nyRemaining = currentTotalMinutes < 750 ? (750 - currentTotalMinutes) : (1440 - currentTotalMinutes + 750);
  }

  // London / NY Overlap: 12:30 - 15:30 UTC (750 to 930 mins)
  const isOverlapActive = !isMarketClosed && currentTotalMinutes >= 750 && currentTotalMinutes < 930;
  let overlapProgress = 0;
  let overlapRemaining = 0;
  if (isOverlapActive) {
    overlapProgress = Math.min(100, Math.round(((currentTotalMinutes - 750) / (930 - 750)) * 100));
    overlapRemaining = 930 - currentTotalMinutes;
  } else {
    overlapRemaining = currentTotalMinutes < 750 ? (750 - currentTotalMinutes) : (1440 - currentTotalMinutes + 750);
  }

  const isOffHours = !isMarketClosed && !isAsiaActive && !isLondonActive && !isNyActive;

  // Build detail objects
  const asiaDetail: MarketSessionDetail = {
    ...SESSION_DEFINITIONS.asia,
    isActive: isAsiaActive,
    progressPercent: asiaProgress,
    timeRemainingFormatted: isAsiaActive ? formatRemainingTime(asiaRemaining) : `Opens in ${Math.floor(asiaRemaining / 60)}h ${asiaRemaining % 60}m`,
  };

  const londonDetail: MarketSessionDetail = {
    ...SESSION_DEFINITIONS.london,
    isActive: isLondonActive,
    progressPercent: londonProgress,
    timeRemainingFormatted: isLondonActive ? formatRemainingTime(londonRemaining) : `Opens in ${Math.floor(londonRemaining / 60)}h ${londonRemaining % 60}m`,
  };

  const nyDetail: MarketSessionDetail = {
    ...SESSION_DEFINITIONS.newYork,
    isActive: isNyActive,
    progressPercent: nyProgress,
    timeRemainingFormatted: isNyActive ? formatRemainingTime(nyRemaining) : `Opens in ${Math.floor(nyRemaining / 60)}h ${nyRemaining % 60}m`,
  };

  const overlapDetail: MarketSessionDetail = {
    ...SESSION_DEFINITIONS.overlap,
    isActive: isOverlapActive,
    progressPercent: overlapProgress,
    timeRemainingFormatted: isOverlapActive ? formatRemainingTime(overlapRemaining) : `Opens at 12:30 UTC`,
  };

  // Determine primary active session
  let primaryActiveSessionId: TradingSessionId = 'OFF_HOURS';
  let primaryActiveName = 'Pacific / Late NY Off-Hours';
  let primaryActiveShort = 'Off-Hours';
  let primaryActiveFlag = '🌙';
  let primaryActiveVolatility = 'Low / Rollover Spread Widening';
  let isHighLiquidityWindow = false;
  let activeStrategyRecommendation = 'Consolidation / Reduced Position Sizing';
  let activeStrategyFilterHint = 'Market volume is light. Wait for Asian Open or trade wide range extremes with reduced risk.';

  if (isMarketClosed) {
    primaryActiveSessionId = 'WEEKEND_CLOSED';
    primaryActiveName = 'Market Closed';
    primaryActiveShort = 'Closed';
    primaryActiveFlag = '🔒';
    primaryActiveVolatility = 'Zero (Market Closed)';
    isHighLiquidityWindow = false;
    activeStrategyRecommendation = 'Market Closed - Interbank Liquidity Offline';
    activeStrategyFilterHint = `Global gold and FX spot markets are closed. Reopens Sunday 22:00 UTC (${timeUntilMarketOpenFormatted}). Live prices are frozen at the official weekend settlement price.`;
  } else if (isOverlapActive) {
    primaryActiveSessionId = 'LONDON_NY_OVERLAP';
    primaryActiveName = overlapDetail.name;
    primaryActiveShort = 'LDN / NY Overlap';
    primaryActiveFlag = '⚡';
    primaryActiveVolatility = 'Peak Institutional Liquidity';
    isHighLiquidityWindow = true;
    activeStrategyRecommendation = 'DXY Macro Correlation & High-Volume Scalping';
    activeStrategyFilterHint = overlapDetail.strategyConfluenceHint;
  } else if (isNyActive) {
    primaryActiveSessionId = 'NEW_YORK';
    primaryActiveName = nyDetail.name;
    primaryActiveShort = 'New York';
    primaryActiveFlag = '🇺🇸';
    primaryActiveVolatility = 'Very High / Wall Street Flow';
    isHighLiquidityWindow = currentTotalMinutes <= 960;
    activeStrategyRecommendation = 'DXY Inverse Macro & Order Flow Continuation';
    activeStrategyFilterHint = nyDetail.strategyConfluenceHint;
  } else if (isLondonActive) {
    primaryActiveSessionId = 'LONDON';
    primaryActiveName = londonDetail.name;
    primaryActiveShort = 'London';
    primaryActiveFlag = '🇬🇧';
    primaryActiveVolatility = 'High / European Breakouts';
    isHighLiquidityWindow = currentTotalMinutes <= 600;
    activeStrategyRecommendation = 'Asian Range AMD Breakout & Liquidity Sweeps';
    activeStrategyFilterHint = londonDetail.strategyConfluenceHint;
  } else if (isAsiaActive) {
    primaryActiveSessionId = 'ASIAN';
    primaryActiveName = asiaDetail.name;
    primaryActiveShort = 'Asia';
    primaryActiveFlag = '🌏';
    primaryActiveVolatility = 'Low-Medium / Initial Accumulation';
    isHighLiquidityWindow = false;
    activeStrategyRecommendation = 'VWAP Band Mean Reversion & Range Extremes';
    activeStrategyFilterHint = asiaDetail.strategyConfluenceHint;
  }

  const activeSessionsList: MarketSessionDetail[] = [];
  if (isOverlapActive) activeSessionsList.push(overlapDetail);
  if (isLondonActive && !isOverlapActive) activeSessionsList.push(londonDetail);
  if (isNyActive && !isOverlapActive) activeSessionsList.push(nyDetail);
  if (isAsiaActive) activeSessionsList.push(asiaDetail);

  const activeSessionsSummary = isMarketClosed
    ? 'Market Closed (Reopens Sun 22:00 UTC)'
    : activeSessionsList.length > 0
    ? activeSessionsList.map(s => s.shortName).join(' + ')
    : 'Off-Hours';

  return {
    utcTimeString,
    utcHours,
    utcMinutes,
    utcSeconds,
    currentTotalMinutes,
    dayOfWeek,
    isMarketClosed,
    marketClosureReason,
    timeUntilMarketOpenFormatted,
    activeSessionsSummary,
    isAsiaActive,
    isLondonActive,
    isNyActive,
    isOverlapActive,
    isOffHours,
    primaryActiveSessionId,
    primaryActiveName,
    primaryActiveShort,
    primaryActiveFlag,
    primaryActiveVolatility,
    isHighLiquidityWindow,
    activeStrategyRecommendation,
    activeStrategyFilterHint,
    sessions: {
      asia: asiaDetail,
      london: londonDetail,
      newYork: nyDetail,
      overlap: overlapDetail,
    },
    activeSessionsList,
  };
}

/**
 * Determine which session a given timestamp falls into (based on UTC time)
 */
export function getTimestampSession(timestamp: number): {
  sessionId: TradingSessionId;
  label: string;
  shortLabel: string;
  color: string;
  fillColor: string;
} {
  const d = new Date(timestamp);
  const totalMins = d.getUTCHours() * 60 + d.getUTCMinutes();

  if (totalMins >= 750 && totalMins < 930) {
    return {
      sessionId: 'LONDON_NY_OVERLAP',
      label: 'London / NY Overlap',
      shortLabel: 'LDN/NY',
      color: '#10B981',
      fillColor: 'rgba(16, 185, 129, 0.12)',
    };
  }
  if (totalMins >= 750 && totalMins < 1260) {
    return {
      sessionId: 'NEW_YORK',
      label: 'New York Session',
      shortLabel: 'NEW YORK',
      color: '#F59E0B',
      fillColor: 'rgba(245, 158, 11, 0.08)',
    };
  }
  if (totalMins >= 420 && totalMins < 930) {
    return {
      sessionId: 'LONDON',
      label: 'London Session',
      shortLabel: 'LONDON',
      color: '#38BDF8',
      fillColor: 'rgba(14, 165, 233, 0.08)',
    };
  }
  if (totalMins >= 0 && totalMins < 480) {
    return {
      sessionId: 'ASIAN',
      label: 'Asian Session',
      shortLabel: 'ASIA',
      color: '#818CF8',
      fillColor: 'rgba(99, 102, 241, 0.08)',
    };
  }

  return {
    sessionId: 'OFF_HOURS',
    label: 'Late NY / Off-Hours',
    shortLabel: 'OFF-HOURS',
    color: '#64748B',
    fillColor: 'rgba(100, 116, 139, 0.04)',
  };
}

/**
 * Calculate contiguous session bands across candles for chart rendering
 */
export interface ChartSessionZone {
  startIndex: number;
  endIndex: number;
  xStart: number;
  xEnd: number;
  width: number;
  sessionId: TradingSessionId;
  label: string;
  shortLabel: string;
  color: string;
  fillColor: string;
  isCurrentActive: boolean;
}

export function computeChartSessionZones(
  candles: Candle[],
  getX: (index: number) => number,
  currentActiveSessionId: TradingSessionId
): ChartSessionZone[] {
  if (candles.length === 0) return [];

  const zones: ChartSessionZone[] = [];
  let currentZoneStart = 0;
  let currentSession = getTimestampSession(candles[0].time);

  for (let i = 1; i < candles.length; i++) {
    const candleSession = getTimestampSession(candles[i].time);
    if (candleSession.sessionId !== currentSession.sessionId) {
      // Close previous zone
      const xStart = Math.max(0, getX(currentZoneStart) - 4);
      const xEnd = getX(i - 1) + 4;
      zones.push({
        startIndex: currentZoneStart,
        endIndex: i - 1,
        xStart,
        xEnd,
        width: Math.max(20, xEnd - xStart),
        sessionId: currentSession.sessionId,
        label: currentSession.label,
        shortLabel: currentSession.shortLabel,
        color: currentSession.color,
        fillColor: currentSession.fillColor,
        isCurrentActive: currentSession.sessionId === currentActiveSessionId || 
          (currentSession.sessionId === 'LONDON_NY_OVERLAP' && (currentActiveSessionId === 'LONDON' || currentActiveSessionId === 'NEW_YORK')),
      });

      currentZoneStart = i;
      currentSession = candleSession;
    }
  }

  // Close final zone
  const lastIndex = candles.length - 1;
  const xStart = Math.max(0, getX(currentZoneStart) - 4);
  const xEnd = getX(lastIndex) + 12;
  zones.push({
    startIndex: currentZoneStart,
    endIndex: lastIndex,
    xStart,
    xEnd,
    width: Math.max(20, xEnd - xStart),
    sessionId: currentSession.sessionId,
    label: currentSession.label,
    shortLabel: currentSession.shortLabel,
    color: currentSession.color,
    fillColor: currentSession.fillColor,
    isCurrentActive: currentSession.sessionId === currentActiveSessionId || 
      (currentSession.sessionId === 'LONDON_NY_OVERLAP' && (currentActiveSessionId === 'LONDON' || currentActiveSessionId === 'NEW_YORK')),
  });

  return zones;
}

/**
 * Match a signal to its primary trading session
 */
export function getSignalSessionContext(
  signal: ScalpSignal, 
  activeSessionId: TradingSessionId
): {
  sessionId: TradingSessionId;
  sessionName: string;
  shortName: string;
  flag: string;
  badgeClass: string;
  isCurrentSessionMatch: boolean;
  strategyConfluence: string;
} {
  // Check explicit indicatorReadings or strategy type
  const ctx = signal.indicatorReadings?.sessionContext || '';
  let sessionId: TradingSessionId = 'NEW_YORK';
  let sessionName = 'New York Session';
  let shortName = 'NY Session';
  let flag = '🇺🇸';
  let badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  let strategyConfluence = 'High momentum Wall Street order flow';

  if (ctx.toLowerCase().includes('asian') || (signal.strategyId as string) === 'DAY_ASIAN_RANGE_BREAKOUT_AMD' || signal.strategyId === 'DAY_SESSION_AMD_EXPANSION') {
    sessionId = 'ASIAN';
    sessionName = 'Asian / Tokyo Session';
    shortName = 'Asia';
    flag = '🌏';
    badgeClass = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    strategyConfluence = 'Asian range accumulation & liquidity pool boundary';
  } else if (ctx.toLowerCase().includes('overlap') || signal.strategyId === 'DXY_GOLD_INVERSE_CORRELATION') {
    sessionId = 'LONDON_NY_OVERLAP';
    sessionName = 'London / NY Overlap';
    shortName = 'LDN/NY Overlap';
    flag = '⚡';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    strategyConfluence = 'Peak institutional liquidity & DXY macro inverse surge';
  } else if (ctx.toLowerCase().includes('london') || signal.strategyId === 'DAY_BREAKOUT_LONDON_PULLBACK') {
    sessionId = 'LONDON';
    sessionName = 'London Session';
    shortName = 'London';
    flag = '🇬🇧';
    badgeClass = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    strategyConfluence = 'European open liquidity sweep & rapid directional expansion';
  } else {
    // Fall back to timestamp check
    const timestampSession = getTimestampSession(signal.generatedAt || Date.now());
    sessionId = timestampSession.sessionId;
    if (sessionId === 'ASIAN') {
      sessionName = 'Asian Session';
      shortName = 'Asia';
      flag = '🌏';
      badgeClass = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      strategyConfluence = 'Range accumulation & liquidity establishment';
    } else if (sessionId === 'LONDON') {
      sessionName = 'London Session';
      shortName = 'London';
      flag = '🇬🇧';
      badgeClass = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      strategyConfluence = 'London Judas swing & breakout continuation';
    } else if (sessionId === 'LONDON_NY_OVERLAP') {
      sessionName = 'London / NY Overlap';
      shortName = 'LDN/NY';
      flag = '⚡';
      badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      strategyConfluence = 'High-liquidity overlap & institutional continuation';
    } else {
      sessionName = 'New York Session';
      shortName = 'New York';
      flag = '🇺🇸';
      badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      strategyConfluence = 'Wall Street order flow & macro trend alignment';
    }
  }

  const isCurrentSessionMatch = 
    sessionId === activeSessionId || 
    (sessionId === 'LONDON_NY_OVERLAP' && (activeSessionId === 'LONDON' || activeSessionId === 'NEW_YORK')) ||
    (activeSessionId === 'LONDON_NY_OVERLAP' && (sessionId === 'LONDON' || sessionId === 'NEW_YORK'));

  return {
    sessionId,
    sessionName,
    shortName,
    flag,
    badgeClass,
    isCurrentSessionMatch,
    strategyConfluence,
  };
}
