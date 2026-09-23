import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, 
  Layers, 
  Sparkles, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Globe, 
  CheckCircle2, 
  DollarSign, 
  ArrowRight,
  Maximize2,
  Minimize2,
  ChevronDown,
  Info,
  Radio,
  BarChart2,
  Activity,
  Compass,
  Flame,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { TimeframeId, StrategyId, IndicatorType } from '../types';
import { DominionTimeframeSelector } from './DominionTimeframeSelector';
import { calculateEMA, calculateVWAP, calculateRSI, calculateMACD, calculateATR } from '../utils/technicalAnalysis';
import { computeChartSessionZones, getTimestampSession } from '../utils/sessionManager';
import { STRATEGY_CONFIGS, runEmpiricalBacktest } from '../utils/backtester';
import { calculateVolumeProfile, calculateOrderFlowMetrics } from '../modules/volumeProfileAndOrderFlow';
import { detectLiquiditySweeps, analyzeAmdCycle } from '../modules/amdAndLiquidity';
import { calculateKeyPriceLevels, detectSwingPoints } from '../modules/marketContext';
import { TradingSessionHeaderCard } from './TradingSessionHeaderCard';

export type StudioLensMode = 'ALL' | 'STRATEGY' | 'INDICATOR' | 'CLEAN';

interface StrategyPreset {
  id: StrategyId;
  name: string;
  tag: string;
  badge: string;
  description: string;
  recommendedTf: TimeframeId;
  overlays: {
    ema: boolean;
    vwap: boolean;
    orderBlocks: boolean;
    liquidityZones: boolean;
    fvg: boolean;
    volumeProfile: boolean;
    rsiPanel: boolean;
    macdPanel: boolean;
    sessions: boolean;
    signals: boolean;
  };
}

interface IndicatorPreset {
  id: IndicatorType;
  name: string;
  shortLabel: string;
  category: string;
  formula: string;
  interpretation: string;
  overlays: {
    ema: boolean;
    vwap: boolean;
    orderBlocks: boolean;
    liquidityZones: boolean;
    fvg: boolean;
    volumeProfile: boolean;
    rsiPanel: boolean;
    macdPanel: boolean;
    sessions: boolean;
    signals: boolean;
  };
}

const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: 'LIQUIDITY_SWEEP_FVG',
    name: 'Liquidity Sweep & FVG Retest',
    tag: 'SMC / ICT',
    badge: '81.3% WR',
    description: 'Automatic detection of Asian/London High-Low sweeps with Fair Value Gap (FVG) imbalances & entry triggers.',
    recommendedTf: '5m',
    overlays: {
      ema: false,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: true,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'SMC_ORDER_BLOCK',
    name: 'Order Block & CHoCH Mitigation',
    tag: 'Smart Money',
    badge: '78.6% WR',
    description: 'Highlights institutional supply/demand order blocks with Change of Character (CHoCH) break lines.',
    recommendedTf: '5m',
    overlays: {
      ema: false,
      vwap: false,
      orderBlocks: true,
      liquidityZones: false,
      fvg: true,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC',
    name: 'Order Flow & Volume Profile (POC/VAH/VAL)',
    tag: 'Volume Profile',
    badge: '85.2% WR',
    description: 'Volume Profile value area (70% liquidity node) with Point of Control (POC) baseline & CVD delta absorption.',
    recommendedTf: '1m',
    overlays: {
      ema: false,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: false,
      volumeProfile: true,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'VWAP_BAND_REVERSION',
    name: 'VWAP 2σ Band Mean Reversion',
    tag: 'Statistical Mean',
    badge: '74.2% WR',
    description: 'Institutional volume-weighted mean with ±2 standard deviation dynamic volatility bands.',
    recommendedTf: '5m',
    overlays: {
      ema: false,
      vwap: true,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: true,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'EMA_MOMENTUM_PULLBACK',
    name: 'EMA 9 / 21 / 50 Dynamic Ribbon',
    tag: 'Trend Following',
    badge: '76.5% WR',
    description: 'Fast 9 EMA momentum curve over 21 EMA pullback zone and 50 EMA baseline macro trend barrier.',
    recommendedTf: '15m',
    overlays: {
      ema: true,
      vwap: false,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: true,
      macdPanel: true,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'DAY_SESSION_AMD_EXPANSION',
    name: 'Asian Accumulation & London AMD Judas',
    tag: 'Session Cycles',
    badge: '81.4% WR',
    description: 'Asian consolidation range box with London Judas false-break trap & New York sustained expansion.',
    recommendedTf: '15m',
    overlays: {
      ema: false,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: true,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'SUPER_CONFLUENCE_AI',
    name: 'Full 5-Layer Master Confluence',
    tag: 'All-in-One Confluence',
    badge: '83.7% WR',
    description: 'Synthesizes SMC Order Blocks, Liquidity Sweeps, VWAP, EMA Ribbon & Live MTF alignment simultaneously.',
    recommendedTf: '5m',
    overlays: {
      ema: true,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: true,
      volumeProfile: true,
      rsiPanel: true,
      macdPanel: true,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'DXY_GOLD_INVERSE_CORRELATION',
    name: 'DXY Dollar Index Inverse Macro Engine',
    tag: 'Macro Correlation',
    badge: 'r = -0.91',
    description: 'US Dollar Index real-time divergence against spot gold with institutional safe-haven capital flow tracker.',
    recommendedTf: '1h',
    overlays: {
      ema: true,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: false,
      volumeProfile: true,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  }
];

const INDICATOR_PRESETS: IndicatorPreset[] = [
  {
    id: 'RSI_14',
    name: 'RSI (14) Momentum Oscillator',
    shortLabel: 'RSI 14',
    category: 'MOMENTUM',
    formula: '100 - (100 / (1 + RS)) across 14 periods',
    interpretation: 'Overbought > 70, Oversold < 30. Bullish divergence above 50 midline.',
    overlays: {
      ema: false,
      vwap: false,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: true,
      macdPanel: false,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'EMA_TREND',
    name: 'EMA 9 / 21 Trend Ribbon',
    shortLabel: 'EMA 9/21',
    category: 'TREND',
    formula: 'Exponential Moving Average with smoothing factor 2 / (N + 1)',
    interpretation: 'Fast 9 EMA crossing above 21 EMA confirms instantaneous bullish momentum.',
    overlays: {
      ema: true,
      vwap: false,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'MACD',
    name: 'MACD (12, 26, 9) Fast Trend Momentum',
    shortLabel: 'MACD',
    category: 'MOMENTUM',
    formula: '12 EMA - 26 EMA with 9 EMA signal line & histogram',
    interpretation: 'Histogram above zero confirms bullish acceleration; signal cross signals fast shift.',
    overlays: {
      ema: true,
      vwap: false,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: true,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'BOLLINGER_BANDS',
    name: 'VWAP & 2σ Volatility Envelopes',
    shortLabel: 'VWAP 2σ',
    category: 'VOLATILITY',
    formula: 'Cumulative Volume-Weighted Average Price with 2-Sigma Standard Deviation',
    interpretation: 'Measures institutional mean execution price; price at lower band is discounted.',
    overlays: {
      ema: false,
      vwap: true,
      orderBlocks: false,
      liquidityZones: false,
      fvg: false,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'ATR_VOLATILITY',
    name: 'ATR (14) Volatility Expansion',
    shortLabel: 'ATR 14',
    category: 'VOLATILITY',
    formula: '14-period Average True Range with 2x Volatility Bands',
    interpretation: 'Measures market expansion & compression; essential for stop loss & dynamic target sizing.',
    overlays: {
      ema: false,
      vwap: false,
      orderBlocks: false,
      liquidityZones: true,
      fvg: false,
      volumeProfile: true,
      rsiPanel: false,
      macdPanel: false,
      sessions: false,
      signals: true,
    }
  },
  {
    id: 'DAILY_PIVOTS',
    name: 'Institutional Order Blocks & Fair Value Gaps',
    shortLabel: 'SMC Blocks',
    category: 'STRUCTURE',
    formula: 'Last opposing candle prior to structural displacement / 3-candle imbalance',
    interpretation: 'Unmitigated institutional liquidity pools waiting for retest mitigation.',
    overlays: {
      ema: false,
      vwap: false,
      orderBlocks: true,
      liquidityZones: true,
      fvg: true,
      volumeProfile: false,
      rsiPanel: false,
      macdPanel: false,
      sessions: true,
      signals: true,
    }
  },
  {
    id: 'ALL_INDICATORS_CONFLUENCE',
    name: 'Universal Multi-Indicator Confluence',
    shortLabel: 'Master Stack',
    category: 'HYBRID',
    formula: 'Weighted confluence of RSI + EMA + VWAP + SMC Structure + Sessions',
    interpretation: 'All indicators combined into a unified master perspective for maximum precision.',
    overlays: {
      ema: true,
      vwap: true,
      orderBlocks: true,
      liquidityZones: true,
      fvg: true,
      volumeProfile: true,
      rsiPanel: true,
      macdPanel: true,
      sessions: true,
      signals: true,
    }
  }
];

export const UnifiedTradingStudio: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    timeframe, 
    setTimeframe, 
    activeScalpSignal,
    executeScalpOrder,
    generateSignal,
    goldSpreadPips,
    currentSession,
    isMarketClosed,
    marketClosureReason,
    mtfMetrics,
    dxyMacroDetails,
    setActiveTab,
    studioTargetStrategy,
    studioTargetIndicator,
    clearStudioTargets
  } = useTrading();

  // Primary Workspace Mode: Strategy Lens vs Indicator Lens vs Full Master
  const [lensMode, setLensMode] = useState<StudioLensMode>('STRATEGY');
  const [selectedStrategyId, setSelectedStrategyId] = useState<StrategyId>('LIQUIDITY_SWEEP_FVG');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<IndicatorType>('ALL_INDICATORS_CONFLUENCE');
  
  // Respond to cross-tab studio navigation target (e.g., from Strategy Lab or Dashboard)
  useEffect(() => {
    if (studioTargetStrategy) {
      setSelectedStrategyId(studioTargetStrategy);
      setLensMode('STRATEGY');
      const strat = STRATEGY_PRESETS.find(s => s.id === studioTargetStrategy);
      if (strat?.recommendedTf) {
        setTimeframe(strat.recommendedTf);
      }
      clearStudioTargets();
    } else if (studioTargetIndicator) {
      setSelectedIndicatorId(studioTargetIndicator);
      setLensMode('INDICATOR');
      clearStudioTargets();
    }
  }, [studioTargetStrategy, studioTargetIndicator, clearStudioTargets, setTimeframe]);

  // Custom manual overlay overrides
  const [manualOverlays, setManualOverlays] = useState({
    ema: true,
    vwap: true,
    orderBlocks: true,
    liquidityZones: true,
    fvg: true,
    volumeProfile: true,
    rsiPanel: false,
    macdPanel: false,
    sessions: true,
    signals: true,
  });

  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showOrderBook, setShowOrderBook] = useState<boolean>(true);
  const [showMtfDrawer, setShowMtfDrawer] = useState<boolean>(false);

  // Current active Strategy Preset
  const activeStrategyPreset = useMemo(() => {
    return STRATEGY_PRESETS.find(s => s.id === selectedStrategyId) || STRATEGY_PRESETS[0];
  }, [selectedStrategyId]);

  // Current active Indicator Preset
  const activeIndicatorPreset = useMemo(() => {
    return INDICATOR_PRESETS.find(i => i.id === selectedIndicatorId) || INDICATOR_PRESETS[0];
  }, [selectedIndicatorId]);

  // Active Overlays computed from current lens mode
  const activeOverlays = useMemo(() => {
    if (lensMode === 'STRATEGY') {
      return activeStrategyPreset.overlays;
    }
    if (lensMode === 'INDICATOR') {
      return activeIndicatorPreset.overlays;
    }
    if (lensMode === 'CLEAN') {
      return {
        ema: false,
        vwap: false,
        orderBlocks: false,
        liquidityZones: false,
        fvg: false,
        volumeProfile: false,
        rsiPanel: false,
        macdPanel: false,
        sessions: false,
        signals: false,
      };
    }
    // 'ALL' / Master
    return manualOverlays;
  }, [lensMode, activeStrategyPreset, activeIndicatorPreset, manualOverlays]);

  // Switch Strategy Preset
  const handleSelectStrategy = (strat: StrategyPreset) => {
    setSelectedStrategyId(strat.id);
    setLensMode('STRATEGY');
    // If recommended timeframe differs and user wants optimal perspective
    if (strat.recommendedTf) {
      setTimeframe(strat.recommendedTf);
    }
  };

  // Switch Indicator Preset
  const handleSelectIndicator = (ind: IndicatorPreset) => {
    setSelectedIndicatorId(ind.id);
    setLensMode('INDICATOR');
  };

  // Toggle manual overlay in ALL mode
  const toggleOverlay = (key: keyof typeof manualOverlays) => {
    setManualOverlays(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    if (lensMode !== 'ALL') {
      setLensMode('ALL');
    }
  };

  // Technical calculations
  const closes = useMemo(() => candles.map(c => c.close), [candles]);
  const ema9 = useMemo(() => calculateEMA(closes, 9), [closes]);
  const ema21 = useMemo(() => calculateEMA(closes, 21), [closes]);
  const ema50 = useMemo(() => calculateEMA(closes, 50), [closes]);
  const vwapData = useMemo(() => calculateVWAP(candles), [candles]);
  const currentRsi = useMemo(() => calculateRSI(closes, 14), [closes]);
  const macdData = useMemo(() => calculateMACD(closes), [closes]);
  const atrData = useMemo(() => calculateATR(candles, 14), [candles]);

  // Volume Profile calculation (POC, VAH, VAL, and distribution bins)
  const volumeProfileData = useMemo(() => {
    return calculateVolumeProfile(candles, 24);
  }, [candles]);

  // Real-time order flow and cumulative delta metrics
  const orderFlowMetrics = useMemo(() => {
    return calculateOrderFlowMetrics(candles);
  }, [candles]);

  // Dynamic liquidity sweeps detection
  const detectedSweeps = useMemo(() => {
    if (candles.length < 15) return [];
    const keyLevels = calculateKeyPriceLevels(activeInstrument.currentPrice, candles);
    const swings = detectSwingPoints(candles, 3);
    return detectLiquiditySweeps(candles, keyLevels, swings.highs, swings.lows);
  }, [candles, activeInstrument.currentPrice]);

  // Historical RSI array for lower sub-panel
  const rsiSeries = useMemo(() => {
    const series: number[] = [];
    for (let i = 14; i < closes.length; i++) {
      series.push(calculateRSI(closes.slice(0, i + 1), 14));
    }
    return series;
  }, [closes]);

  // Backtest metrics for the active strategy
  const backtestEdge = useMemo(() => {
    return runEmpiricalBacktest(
      selectedStrategyId,
      activeInstrument.symbol,
      'BUY',
      activeInstrument.currentPrice,
      activeInstrument.pipMultiplier
    );
  }, [selectedStrategyId, activeInstrument]);

  // Chart dimensions & scaling
  const chartHeight = 380;
  const chartWidth = 760;
  const paddingY = 28;
  const paddingX = 18;

  const minPrice = useMemo(() => {
    if (candles.length === 0) return 0;
    return Math.min(...candles.map(c => c.low)) * 0.9988;
  }, [candles]);

  const maxPrice = useMemo(() => {
    if (candles.length === 0) return 1;
    return Math.max(...candles.map(c => c.high)) * 1.0012;
  }, [candles]);

  const priceRange = maxPrice - minPrice || 1;

  // Convert price to SVG Y coordinate
  const getY = (price: number) => {
    return chartHeight - paddingY - ((price - minPrice) / priceRange) * (chartHeight - paddingY * 2);
  };

  // Convert index to SVG X coordinate
  const getX = (index: number) => {
    const usableWidth = chartWidth - paddingX * 2;
    return paddingX + (index / (candles.length - 1 || 1)) * usableWidth;
  };

  // Build SVG path for EMAs
  const ema9Path = useMemo(() => {
    if (ema9.length === 0) return '';
    return ema9.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }, [ema9, minPrice, maxPrice]);

  const ema21Path = useMemo(() => {
    if (ema21.length === 0) return '';
    return ema21.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }, [ema21, minPrice, maxPrice]);

  const ema50Path = useMemo(() => {
    if (ema50.length === 0) return '';
    return ema50.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }, [ema50, minPrice, maxPrice]);

  // Detect recent Liquidity Sweep High / Low zones (Highest high / Lowest low of last 30 candles)
  const liquidityZones = useMemo(() => {
    if (candles.length < 15) return null;
    const slice = candles.slice(-35);
    const highestCandle = slice.reduce((max, c) => c.high > max.high ? c : max, slice[0]);
    const lowestCandle = slice.reduce((min, c) => c.low < min.low ? c : min, slice[0]);
    return {
      buySideLiquidity: highestCandle.high,
      sellSideLiquidity: lowestCandle.low,
      isSweptHigh: activeInstrument.currentPrice >= highestCandle.high * 0.9997,
      isSweptLow: activeInstrument.currentPrice <= lowestCandle.low * 1.0003,
    };
  }, [candles, activeInstrument.currentPrice]);

  // Active Candle
  const activeCandle = hoveredCandle !== null && candles[hoveredCandle] 
    ? candles[hoveredCandle] 
    : candles[candles.length - 1];

  // Session zones
  const sessionZones = useMemo(() => {
    return computeChartSessionZones(candles, getX, currentSession.primaryActiveSessionId);
  }, [candles, chartWidth, currentSession.primaryActiveSessionId]);

  const activeCandleSession = useMemo(() => {
    if (!activeCandle) return null;
    return getTimestampSession(activeCandle.time);
  }, [activeCandle]);

  // Order Book depth
  const depthBids = useMemo(() => {
    const current = activeInstrument.bid;
    const step = activeInstrument.spreadPips / activeInstrument.pipMultiplier;
    return [
      { price: current, volume: 16.4 },
      { price: current - step, volume: 24.8 },
      { price: current - step * 2, volume: 42.1 },
      { price: current - step * 3, volume: 58.7 },
      { price: current - step * 4, volume: 89.2 },
    ];
  }, [activeInstrument]);

  const depthAsks = useMemo(() => {
    const current = activeInstrument.ask;
    const step = activeInstrument.spreadPips / activeInstrument.pipMultiplier;
    return [
      { price: current, volume: 13.9 },
      { price: current + step, volume: 21.3 },
      { price: current + step * 2, volume: 34.5 },
      { price: current + step * 3, volume: 49.2 },
      { price: current + step * 4, volume: 81.0 },
    ];
  }, [activeInstrument]);

  return (
    <div className="space-y-4">
      {/* Session Context Banner */}
      <TradingSessionHeaderCard compact={false} />

      {/* TOP COMMAND BAR: Unified Lens Switcher & One-Click Presets */}
      <div className="bg-[#101622] border border-[#1E2638] rounded-xl p-3 sm:p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1E2638]/70">
          
          {/* Workspace Lens Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 pr-2 border-r border-[#1E2638]">
              <Layers className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Chart Lens:
              </span>
            </div>

            <div className="flex items-center bg-[#090D14] border border-[#1E2638] rounded-lg p-1 gap-1">
              <button
                onClick={() => setLensMode('STRATEGY')}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  lensMode === 'STRATEGY'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Strategy Live Chart</span>
              </button>

              <button
                onClick={() => setLensMode('INDICATOR')}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  lensMode === 'INDICATOR'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Indicator Live Chart</span>
              </button>

              <button
                onClick={() => setLensMode('ALL')}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  lensMode === 'ALL'
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Master Confluence (All)</span>
              </button>

              <button
                onClick={() => setLensMode('CLEAN')}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                  lensMode === 'CLEAN'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Clean Raw Price Action"
              >
                <span>Raw Candles</span>
              </button>
            </div>
          </div>

          {/* Instrument Price & Timeframe Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-baseline gap-2 px-2.5 py-1 rounded bg-[#090D14] border border-[#1E2638]">
              <span className="text-white font-mono font-bold text-sm">{activeInstrument.symbol}</span>
              <span className={`font-mono text-xs font-bold ${
                activeInstrument.tickDirection === 'UP' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
              </span>
            </div>

            {/* Dominion Markets Timeframe Selector */}
            <DominionTimeframeSelector 
              activeTimeframe={timeframe} 
              onSelectTimeframe={setTimeframe} 
              themeColor="amber" 
            />

            <button
              onClick={() => setShowMtfDrawer(!showMtfDrawer)}
              className={`px-2.5 py-1 rounded text-xs font-mono border transition-all flex items-center gap-1.5 cursor-pointer ${
                showMtfDrawer ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold' : 'bg-[#090D14] text-slate-400 border-[#1E2638]'
              }`}
              title="Toggle Multi-Timeframe Alignment Ribbon"
            >
              <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">MTF Ribbon</span>
            </button>
          </div>

        </div>

        {/* PRESET PILLS ROW: Instant Live Chart Switcher for Every Strategy & Indicator */}
        <div className="pt-3">
          {lensMode === 'STRATEGY' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Select Strategy To Automatically Apply Live Overlays:
                </span>
                <span className="text-[11px] font-mono text-amber-400">
                  Current: <strong>{activeStrategyPreset.name}</strong> ({activeStrategyPreset.badge})
                </span>
              </div>

              {/* Horizontal Scroll of All Strategies */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {STRATEGY_PRESETS.map(strat => {
                  const isSelected = strat.id === selectedStrategyId;
                  return (
                    <button
                      key={strat.id}
                      onClick={() => handleSelectStrategy(strat)}
                      className={`px-3 py-2 rounded-lg text-left transition-all border shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                          : 'bg-[#0B0E14] border-[#1E2638] hover:border-slate-600 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{strat.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          isSelected ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {strat.badge}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Tag: {strat.tag} • Optimal TF: {strat.recommendedTf}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : lensMode === 'INDICATOR' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Select Technical Indicator To Display On Live Chart:
                </span>
                <span className="text-[11px] font-mono text-cyan-400">
                  Active Indicator: <strong>{activeIndicatorPreset.name}</strong>
                </span>
              </div>

              {/* Horizontal Scroll of All Indicators */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {INDICATOR_PRESETS.map(ind => {
                  const isSelected = ind.id === selectedIndicatorId;
                  return (
                    <button
                      key={ind.id}
                      onClick={() => handleSelectIndicator(ind)}
                      className={`px-3 py-2 rounded-lg text-left transition-all border shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/60 shadow-md ring-1 ring-cyan-500/30'
                          : 'bg-[#0B0E14] border-[#1E2638] hover:border-slate-600 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{ind.name}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          isSelected ? 'bg-cyan-400 text-black' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {ind.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {ind.interpretation}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Manual Overlay Checkbox Toggles */
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400 mr-1">Active Layers:</span>
              <button
                onClick={() => toggleOverlay('liquidityZones')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.liquidityZones ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                Liquidity Sweeps (BSL/SSL)
              </button>
              <button
                onClick={() => toggleOverlay('orderBlocks')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.orderBlocks ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                SMC Order Blocks
              </button>
              <button
                onClick={() => toggleOverlay('fvg')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.fvg ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                Fair Value Gaps (FVG)
              </button>
              <button
                onClick={() => toggleOverlay('volumeProfile')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.volumeProfile ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-bold shadow-sm' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                Volume Profile (POC/VAH/VAL)
              </button>
              <button
                onClick={() => toggleOverlay('vwap')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.vwap ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                VWAP 2σ Bands
              </button>
              <button
                onClick={() => toggleOverlay('ema')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.ema ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                EMA 9 / 21 / 50
              </button>
              <button
                onClick={() => toggleOverlay('sessions')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.sessions ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                Session Shading
              </button>
              <button
                onClick={() => toggleOverlay('rsiPanel')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.rsiPanel ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                RSI (14) Sub-Panel
              </button>
              <button
                onClick={() => toggleOverlay('macdPanel')}
                className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  activeOverlays.macdPanel ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold' : 'bg-[#090D14] text-slate-500 border-[#1E2638]'
                }`}
              >
                MACD (12,26,9) Sub-Panel
              </button>
            </div>
          )}
        </div>

      </div>

      {/* OPTIONAL MULTI-TIMEFRAME RIBBON: Quick parity across all timeframes */}
      {showMtfDrawer && (
        <div className="bg-[#0B0E14] border border-[#1E2638] rounded-xl p-3 shadow-lg overflow-x-auto">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E2638]">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Multi-Timeframe Alignment Ribbon (1M - 1D)
            </span>
            <span className="text-[11px] font-mono text-slate-400">Click any timeframe to view</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {mtfMetrics.map(m => (
              <button
                key={m.timeframe}
                onClick={() => setTimeframe(m.timeframe)}
                className={`p-2 rounded-lg border text-left font-mono transition-all cursor-pointer ${
                  timeframe === m.timeframe
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-[#121824] border-[#1E2638] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{m.label.split(' ')[0]}</span>
                  <span className={`text-[10px] font-bold ${
                    m.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {m.changePercent >= 0 ? '+' : ''}{m.changePercent}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>RSI: {m.rsi}</span>
                  <span className={m.trend.includes('BULL') ? 'text-emerald-400' : 'text-rose-400'}>
                    {m.trend.replace('STRONG_', '')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MAIN LIVE CHART DESK & LEVEL II DEPTH */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Candlestick SVG Surface (3 cols on desktop) */}
        <div className="lg:col-span-3 bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-xl relative flex flex-col justify-between">
          
          {/* Active Hover / Strategy Context Banner */}
          <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-400 pb-3 border-b border-[#1E2638] mb-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {activeCandle && (
                <>
                  <span>Time: <strong className="text-slate-200">{new Date(activeCandle.time).toLocaleTimeString()}</strong></span>
                  <span>O: <strong className="text-white">${activeCandle.open}</strong></span>
                  <span>H: <strong className="text-emerald-400">${activeCandle.high}</strong></span>
                  <span>L: <strong className="text-rose-400">${activeCandle.low}</strong></span>
                  <span>C: <strong className="text-white">${activeCandle.close}</strong></span>
                  <span>Vol: <strong className="text-amber-400">{(activeCandle.volume ?? 0).toLocaleString()}</strong></span>
                </>
              )}
            </div>

            {/* Active Strategy / Indicator Badge */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#090D14] border border-[#232D42] text-[11px] text-amber-300 font-bold">
                {lensMode === 'STRATEGY' ? `🎯 ${activeStrategyPreset.name}` : lensMode === 'INDICATOR' ? `📊 ${activeIndicatorPreset.name}` : '⚡ Master Lens'}
              </span>

              {isMarketClosed && (
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  CLOSED • SETTLED QUOTE
                </span>
              )}
            </div>
          </div>

          {/* Strategy Context Summary Bar */}
          {lensMode === 'STRATEGY' && (
            <div className="mb-2 p-2 rounded-lg bg-[#0B0E14] border border-amber-500/30 text-xs font-mono flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span>
                  <strong>Applied Strategy Rule:</strong> {activeStrategyPreset.description}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-bold">Backtest Edge: {backtestEdge.winRate}% WR</span>
                <span className="text-slate-500">|</span>
                <span className="text-amber-300 font-bold">{backtestEdge.profitFactor} PF</span>
                <button
                  onClick={() => generateSignal(selectedStrategyId)}
                  className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase cursor-pointer"
                >
                  Generate Setup
                </button>
              </div>
            </div>
          )}

          {/* SVG Interactive Chart Canvas */}
          <div className="relative w-full overflow-hidden select-none bg-[#090D14] rounded-lg border border-[#1A2234]">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-[360px] sm:h-[420px] transition-all"
            >
              <defs>
                <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="rsiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Background Session Shading */}
              {activeOverlays.sessions && sessionZones.map((zone, i) => (
                <rect 
                  key={i} 
                  x={zone.xStart} 
                  y={0} 
                  width={zone.width} 
                  height={chartHeight} 
                  fill={zone.color} 
                />
              ))}

              {/* Grid Lines */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => {
                const y = paddingY + ratio * (chartHeight - paddingY * 2);
                const priceLevel = maxPrice - ratio * priceRange;
                return (
                  <g key={i}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={chartWidth - paddingX} 
                      y2={y} 
                      stroke="#1A2234" 
                      strokeDasharray="3 3" 
                      strokeWidth="1" 
                    />
                    <text 
                      x={chartWidth - 6} 
                      y={y + 3} 
                      fill="#64748B" 
                      fontSize="9" 
                      fontFamily="monospace" 
                      textAnchor="end"
                    >
                      {priceLevel.toFixed(activeInstrument.decimals)}
                    </text>
                  </g>
                );
              })}

              {/* SMC Order Blocks Zones */}
              {activeOverlays.orderBlocks && candles.map((c, idx) => {
                if (!c.orderBlock) return null;
                const x = getX(idx);
                const yTop = getY(c.high);
                const yBottom = getY(c.low);
                const isBull = c.orderBlock === 'BULLISH_OB';
                return (
                  <g key={`ob-${idx}`}>
                    <rect
                      x={x - 6}
                      y={Math.min(yTop, yBottom)}
                      width={65}
                      height={Math.max(5, Math.abs(yBottom - yTop))}
                      fill={isBull ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)'}
                      stroke={isBull ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={x - 4}
                      y={Math.min(yTop, yBottom) - 3}
                      fill={isBull ? '#10B981' : '#EF4444'}
                      fontSize="8"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {isBull ? '+OB (Demand)' : '-OB (Supply)'}
                    </text>
                  </g>
                );
              })}

              {/* Fair Value Gaps (FVG) */}
              {activeOverlays.fvg && candles.map((c, idx) => {
                if (!c.fvg) return null;
                const x = getX(idx);
                const yTop = getY(c.high);
                const yBottom = getY(c.low);
                const isBull = c.fvg === 'BULLISH_FVG';
                return (
                  <rect
                    key={`fvg-${idx}`}
                    x={x - 4}
                    y={Math.min(yTop, yBottom)}
                    width={45}
                    height={Math.max(4, Math.abs(yBottom - yTop))}
                    fill={isBull ? 'rgba(56, 189, 248, 0.12)' : 'rgba(249, 115, 22, 0.12)'}
                    stroke={isBull ? 'rgba(56, 189, 248, 0.4)' : 'rgba(249, 115, 22, 0.4)'}
                    strokeWidth="1"
                  />
                );
              })}

              {/* Liquidity Sweep (BSL / SSL) Level Lines */}
              {activeOverlays.liquidityZones && liquidityZones && (
                <>
                  {/* Buy-Side Liquidity (BSL) */}
                  <g>
                    <line
                      x1={paddingX}
                      y1={getY(liquidityZones.buySideLiquidity)}
                      x2={chartWidth - paddingX}
                      y2={getY(liquidityZones.buySideLiquidity)}
                      stroke="#EF4444"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX + 8}
                      y={getY(liquidityZones.buySideLiquidity) - 4}
                      fill="#EF4444"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ▲ Buy-Side Liquidity Pool (Asian/London High) ${liquidityZones.buySideLiquidity.toFixed(2)}
                    </text>
                  </g>

                  {/* Sell-Side Liquidity (SSL) */}
                  <g>
                    <line
                      x1={paddingX}
                      y1={getY(liquidityZones.sellSideLiquidity)}
                      x2={chartWidth - paddingX}
                      y2={getY(liquidityZones.sellSideLiquidity)}
                      stroke="#10B981"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX + 8}
                      y={getY(liquidityZones.sellSideLiquidity) + 11}
                      fill="#10B981"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ▼ Sell-Side Liquidity Pool (Asian/London Low) ${liquidityZones.sellSideLiquidity.toFixed(2)}
                    </text>
                  </g>
                </>
              )}

              {/* VWAP line and bands */}
              {activeOverlays.vwap && vwapData.vwap > 0 && (
                <>
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.vwap)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.vwap)}
                    stroke="#F59E0B"
                    strokeWidth="1.3"
                  />
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.upperBand)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.upperBand)}
                    stroke="#06B6D4"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.lowerBand)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.lowerBand)}
                    stroke="#06B6D4"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </>
              )}

              {/* Volume Profile & Order Flow Levels (POC, VAH, VAL) */}
              {activeOverlays.volumeProfile && volumeProfileData.poc > 0 && (
                <>
                  {/* Point of Control (POC) Line */}
                  <g>
                    <line
                      x1={paddingX}
                      y1={getY(volumeProfileData.poc)}
                      x2={chartWidth - paddingX}
                      y2={getY(volumeProfileData.poc)}
                      stroke="#F59E0B"
                      strokeWidth="1.8"
                    />
                    <text
                      x={paddingX + 8}
                      y={getY(volumeProfileData.poc) - 4}
                      fill="#F59E0B"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ★ POC (Point of Control) ${volumeProfileData.poc.toFixed(2)}
                    </text>
                  </g>

                  {/* Value Area High (VAH 70%) */}
                  <g>
                    <line
                      x1={paddingX}
                      y1={getY(volumeProfileData.vah)}
                      x2={chartWidth - paddingX}
                      y2={getY(volumeProfileData.vah)}
                      stroke="#06B6D4"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={paddingX + 8}
                      y={getY(volumeProfileData.vah) - 4}
                      fill="#06B6D4"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ▲ VAH (Value Area High) ${volumeProfileData.vah.toFixed(2)}
                    </text>
                  </g>

                  {/* Value Area Low (VAL 70%) */}
                  <g>
                    <line
                      x1={paddingX}
                      y1={getY(volumeProfileData.val)}
                      x2={chartWidth - paddingX}
                      y2={getY(volumeProfileData.val)}
                      stroke="#06B6D4"
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={paddingX + 8}
                      y={getY(volumeProfileData.val) + 11}
                      fill="#06B6D4"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ▼ VAL (Value Area Low) ${volumeProfileData.val.toFixed(2)}
                    </text>
                  </g>

                  {/* Volume Profile Histogram Distribution on Right Edge */}
                  {(() => {
                    const maxBinVolume = Math.max(...volumeProfileData.bins.map(b => b.volume), 1);
                    return volumeProfileData.bins.map((bin, bIdx) => {
                      const y = getY(bin.price);
                      const totalBarWidth = Math.min(80, (bin.volume / maxBinVolume) * 80);
                      const buyFraction = bin.volume > 0 ? bin.buyVolume / bin.volume : 0.5;
                      const buyW = totalBarWidth * buyFraction;
                      const sellW = totalBarWidth - buyW;
                      const isPoc = bin.isPoc || Math.abs(bin.price - volumeProfileData.poc) < 0.2;
                      const barY = y - 3;

                      return (
                        <g key={`vp-bin-${bIdx}`} opacity={bin.isInValueArea ? 0.9 : 0.4}>
                          {/* Sell volume segment (rose/red) */}
                          <rect
                            x={chartWidth - paddingX - totalBarWidth}
                            y={barY}
                            width={sellW}
                            height={5}
                            fill={isPoc ? '#F59E0B' : '#EF4444'}
                            rx={1}
                          />
                          {/* Buy volume segment (emerald/green) */}
                          <rect
                            x={chartWidth - paddingX - totalBarWidth + sellW}
                            y={barY}
                            width={buyW}
                            height={5}
                            fill={isPoc ? '#FBBF24' : '#10B981'}
                            rx={1}
                          />
                        </g>
                      );
                    });
                  })()}
                </>
              )}

              {/* EMA Curves */}
              {activeOverlays.ema && (
                <>
                  {ema9Path && <path d={ema9Path} fill="none" stroke="#38BDF8" strokeWidth="1.5" />}
                  {ema21Path && <path d={ema21Path} fill="none" stroke="#F97316" strokeWidth="1.5" />}
                  {ema50Path && <path d={ema50Path} fill="none" stroke="#A855F7" strokeWidth="1.5" strokeDasharray="3 3" />}
                </>
              )}

              {/* Candlesticks */}
              {candles.map((candle, idx) => {
                const x = getX(idx);
                const yOpen = getY(candle.open);
                const yClose = getY(candle.close);
                const yHigh = getY(candle.high);
                const yLow = getY(candle.low);
                const isBull = candle.close >= candle.open;
                const candleColor = isBull ? '#10B981' : '#EF4444';
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));
                const candleWidth = Math.max(3.5, (chartWidth / candles.length) * 0.65);

                return (
                  <g 
                    key={candle.time} 
                    onMouseEnter={() => setHoveredCandle(idx)}
                    onMouseLeave={() => setHoveredCandle(null)}
                    className="cursor-crosshair"
                  >
                    {/* Wick */}
                    <line 
                      x1={x} 
                      y1={yHigh} 
                      x2={x} 
                      y2={yLow} 
                      stroke={candleColor} 
                      strokeWidth="1.2" 
                    />
                    {/* Body */}
                    <rect 
                      x={x - candleWidth / 2} 
                      y={bodyY} 
                      width={candleWidth} 
                      height={bodyHeight} 
                      fill={candleColor} 
                      rx="1" 
                    />
                  </g>
                );
              })}

              {/* Active Signal Stop Loss & Take Profit Projection */}
              {activeOverlays.signals && activeScalpSignal && (
                <g>
                  {/* Entry Price */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.entryPrice)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.entryPrice)} 
                    stroke="#F59E0B" 
                    strokeWidth="1.2" 
                    strokeDasharray="4 2"
                  />
                  <text 
                    x={chartWidth - paddingX - 10} 
                    y={getY(activeScalpSignal.entryPrice) - 3} 
                    fill="#F59E0B" 
                    fontSize="9" 
                    fontFamily="monospace" 
                    textAnchor="end"
                  >
                    Entry: ${activeScalpSignal.entryPrice}
                  </text>

                  {/* Stop Loss */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.stopLoss)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.stopLoss)} 
                    stroke="#EF4444" 
                    strokeWidth="1.5" 
                  />
                  <text 
                    x={paddingX + 6} 
                    y={getY(activeScalpSignal.stopLoss) - 3} 
                    fill="#EF4444" 
                    fontSize="9" 
                    fontFamily="monospace" 
                    fontWeight="bold"
                  >
                    SL: ${activeScalpSignal.stopLoss}
                  </text>

                  {/* Take Profit 1 */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.takeProfit1)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.takeProfit1)} 
                    stroke="#10B981" 
                    strokeWidth="1.5" 
                  />
                  <text 
                    x={paddingX + 6} 
                    y={getY(activeScalpSignal.takeProfit1) - 3} 
                    fill="#10B981" 
                    fontSize="9" 
                    fontFamily="monospace" 
                    fontWeight="bold"
                  >
                    TP1: ${activeScalpSignal.takeProfit1}
                  </text>
                </g>
              )}

              {/* Current Settled Price Horizontal Line */}
              <line 
                x1={paddingX} 
                y1={getY(activeInstrument.currentPrice)} 
                x2={chartWidth - paddingX} 
                y2={getY(activeInstrument.currentPrice)} 
                stroke={activeInstrument.tickDirection === 'UP' ? '#10B981' : '#EF4444'} 
                strokeWidth="1.5" 
              />
            </svg>

            {/* Floating Real-time Order Flow & CVD Badge */}
            {activeOverlays.volumeProfile && (
              <div className="absolute top-2 right-2 bg-[#0B0E14]/90 backdrop-blur-sm border border-[#1E2638] rounded-lg px-2.5 py-1.5 text-[10px] font-mono space-y-1 shadow-lg pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">CVD Delta:</span>
                  <span className={orderFlowMetrics.cumulativeDelta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {orderFlowMetrics.cumulativeDelta >= 0 ? '+' : ''}{Math.round(orderFlowMetrics.cumulativeDelta).toLocaleString()}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300">{orderFlowMetrics.deltaBias.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <span>Vol Exp: <strong className="text-white">{orderFlowMetrics.volumeExpansionRatio}x</strong></span>
                  {orderFlowMetrics.institutionalAbsorption && (
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3 text-cyan-400" /> Absorption
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lower Indicator Sub-Panel (RSI 14) when toggled */}
          {activeOverlays.rsiPanel && (
            <div className="mt-3 pt-3 border-t border-[#1E2638] bg-[#090D14] p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  RSI (14) Momentum: <strong className={currentRsi > 70 ? 'text-rose-400' : currentRsi < 30 ? 'text-emerald-400' : 'text-slate-200'}>{currentRsi}</strong>
                </span>
                <span className="text-[10px] text-slate-400">Overbought: 70 • Oversold: 30</span>
              </div>
              <div className="h-10 w-full flex items-center">
                <div className="w-full bg-[#121824] h-3 rounded-full overflow-hidden relative border border-[#1E2638]">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      currentRsi > 70 ? 'bg-rose-500' : currentRsi < 30 ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${currentRsi}%` }}
                  />
                  {/* 50 Midline marker */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400" />
                </div>
              </div>
            </div>
          )}

          {/* Lower Indicator Sub-Panel (MACD 12, 26, 9) when toggled */}
          {activeOverlays.macdPanel && (
            <div className="mt-3 pt-3 border-t border-[#1E2638] bg-[#090D14] p-2.5 rounded-lg">
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-orange-400" />
                  MACD (12, 26, 9) Momentum: 
                  <strong className={macdData.latestHistogram >= 0 ? 'text-emerald-400 ml-1' : 'text-rose-400 ml-1'}>
                    {macdData.latestHistogram >= 0 ? '+' : ''}{macdData.latestHistogram.toFixed(2)}
                  </strong>
                </span>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Fast EMA (12-26)</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Signal (9)</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Histogram</span>
                </div>
              </div>
              {/* Histogram bars visualizer */}
              <div className="h-10 w-full flex items-center gap-0.5 px-1 bg-[#121824] rounded border border-[#1E2638] overflow-hidden">
                {macdData.histogram.length > 0 ? (
                  macdData.histogram.slice(-36).map((val, hIdx) => {
                    const maxH = Math.max(...macdData.histogram.slice(-36).map(v => Math.abs(v)), 0.05);
                    const barHeight = Math.min(18, (Math.abs(val) / maxH) * 16);
                    const isPos = val >= 0;
                    return (
                      <div key={hIdx} className="flex-1 flex flex-col justify-center items-center h-full">
                        <div 
                          className={`w-full rounded-sm ${isPos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ height: `${Math.max(2, barHeight)}px` }}
                          title={`Histogram: ${val.toFixed(2)}`}
                        />
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Calculating MACD momentum bars...</span>
                )}
              </div>
            </div>
          )}

          {/* Chart Legend Footer */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-3 border-t border-[#1E2638] flex-wrap mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> EMA 9</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> EMA 21</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> EMA 50</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> VWAP 2σ</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> POC (Volume Profile)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> VAH / VAL (70% Value)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Demand OB / FVG</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Liquidity Sweep Pools</span>
          </div>

        </div>

        {/* RIGHT COLUMN: Real-Time Order Depth & Fast Execution */}
        <div className="space-y-4">
          
          {/* Level II Market Depth */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2638] mb-2">
              <span className="text-slate-200 font-bold uppercase flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                Level II Market Depth
              </span>
              <span className="text-[10px] text-amber-400">Spread: {activeInstrument.spreadPips}p</span>
            </div>

            {/* Asks (Sellers) */}
            <div className="space-y-1 mb-2">
              {depthAsks.map((ask, i) => (
                <div key={i} className="flex justify-between items-center relative py-0.5 px-1 text-[11px]">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded" 
                    style={{ width: `${(ask.volume / 90) * 100}%` }}
                  />
                  <span className="text-rose-400 font-bold z-10">${ask.price.toFixed(activeInstrument.decimals)}</span>
                  <span className="text-slate-400 z-10">{ask.volume} lots</span>
                </div>
              ))}
            </div>

            {/* Spread Row */}
            <div className="py-1.5 px-2 rounded bg-[#0B0E14] border border-[#1E2638] text-center my-2 font-bold text-white flex justify-between text-[11px]">
              <span className="text-slate-400 text-[10px]">SPREAD</span>
              <span className="text-amber-300">{activeInstrument.spreadPips} PIPS</span>
            </div>

            {/* Bids (Buyers) */}
            <div className="space-y-1">
              {depthBids.map((bid, i) => (
                <div key={i} className="flex justify-between items-center relative py-0.5 px-1 text-[11px]">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded" 
                    style={{ width: `${(bid.volume / 90) * 100}%` }}
                  />
                  <span className="text-emerald-400 font-bold z-10">${bid.price.toFixed(activeInstrument.decimals)}</span>
                  <span className="text-slate-400 z-10">{bid.volume} lots</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instant Setup & Execution Box */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2638] mb-2">
              <span className="text-slate-200 font-bold uppercase flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Live Setup Execution
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">Verified Edge</span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Active Setup:</span>
                <span className="text-amber-300 font-bold">{activeStrategyPreset.name.split(' ')[0]}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Win Rate:</span>
                <span className="text-emerald-400 font-bold">{backtestEdge.winRate}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Avg Risk/Reward:</span>
                <span className="text-slate-200 font-bold">1:{backtestEdge.avgRiskReward}</span>
              </div>
            </div>

            {activeScalpSignal ? (
              <button
                onClick={() => executeScalpOrder(activeScalpSignal, 1.0)}
                className={`w-full py-2.5 rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer ${
                  activeScalpSignal.direction === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                }`}
              >
                <DollarSign className="w-4 h-4 font-bold" />
                <span>Execute 1.0 Lot ({activeScalpSignal.direction})</span>
              </button>
            ) : (
              <button
                onClick={() => generateSignal(selectedStrategyId)}
                className="w-full py-2.5 rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Trigger Strategy Signal</span>
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
