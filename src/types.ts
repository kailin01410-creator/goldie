export type TimeframeId = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type MarketDirection = 'BUY' | 'SELL';

export type TradingStyle = 'SCALPING' | 'DAY_TRADING';

export type StrategyId = 
  // Scalping Strategies (M1 - M5 fast trades)
  | 'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC'
  | 'SMC_ORDER_BLOCK' 
  | 'VWAP_BAND_REVERSION' 
  | 'EMA_MOMENTUM_PULLBACK' 
  | 'LIQUIDITY_SWEEP_FVG' 
  | 'SUPER_CONFLUENCE_AI'
  // Day Trading Strategies (M15 - H1 - H4 session swings)
  | 'DAY_ORDER_FLOW_VOLUME_PROFILE_SMC'
  | 'DAY_SESSION_AMD_EXPANSION'
  | 'DAY_H1_EMA_TREND_RIDE'
  | 'DAY_PIVOT_FIBONACCI_CONFLUENCE'
  | 'DAY_BREAKOUT_LONDON_PULLBACK'
  | 'DAY_MULTI_INDICATOR_CONFLUENCE'
  // Macro & Intermarket Correlation Strategies
  | 'DXY_GOLD_INVERSE_CORRELATION';

export type IndicatorType = 
  | 'RSI_14'
  | 'EMA_TREND'
  | 'MACD'
  | 'BOLLINGER_BANDS'
  | 'ATR_VOLATILITY'
  | 'DAILY_PIVOTS'
  | 'ALL_INDICATORS_CONFLUENCE';

export interface IndicatorBacktestReport {
  indicator: IndicatorType;
  name: string;
  shortLabel: string;
  category: 'MOMENTUM' | 'TREND' | 'VOLATILITY' | 'STRUCTURE' | 'HYBRID';
  winRate: number;
  profitFactor: number;
  sampleTrades: number;
  tradesWon: number;
  tradesLost: number;
  netPipsWon: number;
  avgRiskReward: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  optimalTimeframe: string;
  recommendedStyle: 'SCALPING' | 'DAY_TRADING' | 'BOTH';
  entryLogic: string;
  exitLogic: string;
  keyObservation: string;
}

export interface Instrument {
  symbol: string;
  name: string;
  category: 'METALS' | 'FOREX_MAJOR' | 'CRYPTO';
  baseCurrency: string;
  quoteCurrency: string;
  decimals: number;
  pipMultiplier: number;
  currentPrice: number;
  bid: number;
  ask: number;
  spreadPips: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  change24h: number;
  change24hPips: number;
  tickDirection: 'UP' | 'DOWN' | 'EQUAL';
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isBullish: boolean;
  orderBlock?: 'BULLISH_OB' | 'BEARISH_OB';
  fvg?: 'BULLISH_FVG' | 'BEARISH_FVG';
}

export interface TimeframeMetrics {
  timeframe: TimeframeId;
  label: string;
  changePercent: number;
  changePips: number;
  high: number;
  low: number;
  trend: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  rsi: number;
  emaCross: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  vwapStatus: 'ABOVE' | 'BELOW' | 'AT_MEAN';
  volumeBias: 'ACCUMULATION' | 'DISTRIBUTION' | 'BALANCED';
  confluenceScore: number; // 0 - 100
}

export interface BacktestTradeSample {
  id: string;
  timeAgo: string;
  direction: MarketDirection;
  entryPrice: number;
  exitPrice: number;
  pips: number;
  outcome: 'WIN' | 'LOSS';
  exitReason: 'TP1' | 'TP2' | 'TP3' | 'SL';
  durationMinutes: number;
}

export interface StrategyBacktestResult {
  strategyId: StrategyId;
  strategyName: string;
  totalSampleTrades: number;
  tradesWon: number;
  tradesLost: number;
  winRate: number; // percentage, e.g. 78.4
  profitFactor: number; // e.g. 2.45
  maxDrawdownPercent: number; // e.g. 1.8
  avgRiskReward: number; // e.g. 2.3
  netPipsWon: number;
  expectedValuePipsPerTrade: number;
  sharpeRatio: number;
  verificationBadge: 'VERIFIED_INSTITUTIONAL_EDGE' | 'HIGH_PROBABILITY_SETUP' | 'MODERATE_EDGE';
  testedSampleTrades: BacktestTradeSample[];
}

export interface ScalpSignal {
  id: string;
  symbol: string;
  tradingStyle?: TradingStyle;
  strategyId: StrategyId;
  strategyName: string;
  direction: MarketDirection;
  generatedAt: number;
  timeframe: TimeframeId;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskPips: number;
  tp1Pips: number;
  tp2Pips: number;
  tp3Pips?: number;
  riskReward: number;
  confluences: string[];
  indicatorReadings: {
    rsiM5: number;
    rsiH1?: number;
    emaBias: string;
    vwapDeviation: string;
    smcStructure: string;
    liquiditySweep: string;
    macdSignal?: string;
    atrValuePips?: number;
    dailyPivotContext?: string;
    sessionContext?: string;
  };
  backtest: StrategyBacktestResult;
  status: 'ACTIVE' | 'TRIGGERED' | 'EXPIRED';
  orderFlowContext?: {
    poc: number;
    vah: number;
    val: number;
    cumulativeDelta: number;
    deltaBias: string;
    volumeExpansionRatio: number;
    institutionalAbsorption: boolean;
    confluenceScore: number;
    sweepsDetected: string[];
    amdPhase?: string;
    htfTrend?: string;
    bosStatus?: string;
    chochStatus?: string;
  };
  dxyCorrelation?: {
    dxyPrice: number;
    dxyTrend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATION';
    dxyChange24h: number;
    correlationCoefficient: number; // e.g. -0.91
    alignment: 'STRONGLY_ALIGNED' | 'MODERATELY_ALIGNED' | 'CONFLICT_WARNING' | 'NEUTRAL';
    winRateBoostPercent: number; // e.g. +9.4%
    goldImpactSummary: string;
    dxyResistanceLevel: number;
    dxySupportLevel: number;
    dxyRsi: number;
  };
}

export interface StrategyPersistenceConfig {
  enabledStrategies: Record<StrategyId, boolean>;
  minConfluenceScore: number;
  minWinRateThreshold: number;
  requireDxyAlignment: boolean;
  autoExecuteSignals: boolean;
  audioAlertsEnabled: boolean;
  preferredLotSize: number;
  activeFeedFilter: {
    symbol: string;
    tradingStyle: string;
    direction: string;
    minWinRate: number;
  };
}

export interface PaperPosition {
  id: string;
  symbol: string;
  direction: MarketDirection;
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  openTime: number;
  pnlDollars: number;
  pnlPips: number;
  status: 'OPEN' | 'CLOSED';
  closeTime?: number;
  closePrice?: number;
  closeReason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'BREAK_EVEN';
  strategyName: string;
}

export interface TerminalRiskSettings {
  maxDailyDrawdownPercent: number;
  defaultLotSize: number;
  accountLeverage: number; // e.g. 100 for 1:100
  riskPerTradePercent: number;
  slippageSimulationPips: number;
  autoBreakevenAtR: number; // move to BE at 1R
  goldApiKey?: string;
  xmBrokerTier?: XmBrokerTier;
  xmGoldSpreadPips?: number;
}

export type AdminProfile = TerminalRiskSettings;
export type RiskSettings = TerminalRiskSettings;

export type XmBrokerTier = 'XM_ULTRA_LOW' | 'XM_STANDARD' | 'XM_MICRO' | 'CUSTOM';

export interface XmBrokerSettings {
  tier: XmBrokerTier;
  goldSpreadPips: number;
  label: string;
  description: string;
}

export type NetworkConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'CHECKING';

// ============================================================================
// Multi-Factor Institutional Strategy Types (Market Structure, AMD, Order Flow)
// ============================================================================

export type StructureTrendType = 'BULLISH' | 'BEARISH' | 'RANGE_BOUND';

export type SwingPointType = 'HIGHER_HIGH' | 'HIGHER_LOW' | 'LOWER_HIGH' | 'LOWER_LOW' | 'EQUILIBRIUM';

export interface SwingPoint {
  price: number;
  time: number;
  candleIndex: number;
  type: SwingPointType;
  isHigh: boolean;
}

export interface StructureEvent {
  type: 'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  brokenLevelPrice: number;
  brokenLevelTime: number;
  confirmationPrice: number;
  confirmationTime: number;
  description: string;
}

export interface SessionPriceLevels {
  high: number;
  low: number;
  rangePips: number;
  pocPrice?: number;
  status: 'ACTIVE' | 'CLOSED';
}

export interface KeyPriceLevels {
  pdh: number; // Previous Day High
  pdl: number; // Previous Day Low
  pdeq: number; // Previous Day Equilibrium (50%)
  pwh: number; // Previous Week High
  pwl: number; // Previous Week Low
  asianSession: SessionPriceLevels;
  londonSession: SessionPriceLevels;
  nySession: SessionPriceLevels;
  dailyOpen: number;
  weeklyOpen: number;
}

export interface VolumeProfileBin {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  isPoc: boolean;
  isInValueArea: boolean;
}

export interface VolumeProfileResult {
  poc: number; // Point of Control
  vah: number; // Value Area High (70% volume)
  val: number; // Value Area Low (70% volume)
  totalVolume: number;
  bins: VolumeProfileBin[];
}

export interface OrderFlowMetrics {
  cumulativeDelta: number;
  deltaBias: 'STRONG_BUY_DELTA' | 'MODERATE_BUY_DELTA' | 'NEUTRAL' | 'MODERATE_SELL_DELTA' | 'STRONG_SELL_DELTA';
  institutionalAbsorption: boolean;
  exhaustionVolumeDetected: boolean;
  volumeExpansionRatio: number; // relative to 20-bar SMA
}

export interface LiquiditySweepEvent {
  poolType: 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY';
  sweptLevelName: 'PDH' | 'PDL' | 'ASIAN_HIGH' | 'ASIAN_LOW' | 'MAJOR_SWING_HIGH' | 'MAJOR_SWING_LOW' | 'EQUAL_HIGHS' | 'EQUAL_LOWS';
  sweptPrice: number;
  reversalPrice: number;
  wickDisplacementPips: number;
  timestamp: number;
  status: 'CONFIRMED' | 'PENDING_RETEST';
}

export type AmdPhase = 'ACCUMULATION' | 'MANIPULATION' | 'DISTRIBUTION' | 'COMPLETED';

export interface AmdAnalysisResult {
  phase: AmdPhase;
  accumulationRange: { high: number; low: number };
  manipulationJudas: { direction: 'BULL_TRAP' | 'BEAR_TRAP' | 'NONE'; sweepPips: number };
  expectedExpansionDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  description: string;
}

export interface DxyMacroContext {
  dxyPrice: number;
  dxyTrend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATION';
  change24h: number;
  goldImpactBias: 'BULLISH_FOR_GOLD' | 'BEARISH_FOR_GOLD' | 'NEUTRAL';
  correlationDescription: string;
}

export interface SessionContext {
  activeSession: 'ASIAN' | 'LONDON' | 'LONDON_NY_OVERLAP' | 'NEW_YORK' | 'OFF_HOURS';
  sessionName: string;
  isHighLiquidityWindow: boolean;
  sessionElapsedMinutes: number;
}

export interface NewsEventFilter {
  isClearToTrade: boolean;
  status: 'CLEAR_TO_TRADE' | 'HIGH_IMPACT_NEWS_IMMOBILE' | 'ELEVATED_VOLATILITY_CAUTION';
  minutesToNextHighImpactNews: number;
  nextEventTitle: string;
  recommendation: string;
}

// 8 Discrete Stages of the Core Institutional Strategy Model
export interface StrategyStagesBreakdown {
  context: {
    higherTimeframe: TimeframeId;
    trend: StructureTrendType;
    trendSummary: string;
    keyLevelsNearPrice: string[];
    dxyBias: string;
    sessionBias: string;
    newsStatus: string;
  };
  setup: {
    setupTimeframe: TimeframeId;
    pattern: string;
    locationDescription: string;
    amdPhase: AmdPhase;
    isLocationValid: boolean;
  };
  confirmation: {
    entryTimeframe: TimeframeId;
    liquiditySweepConfirmed: boolean;
    volumeExpansionConfirmed: boolean;
    orderFlowDeltaConfirmed: boolean;
    marketStructureChochConfirmed: boolean;
    confluenceList: string[];
  };
  entry: {
    direction: MarketDirection;
    entryPrice: number;
    entryType: 'LIMIT_RETEST' | 'MARKET_MOMENTUM';
    retestLevel: number;
    triggerDescription: string;
  };
  stopLoss: {
    stopLossPrice: number;
    riskPips: number;
    invalidationBasis: string;
  };
  takeProfit: {
    tp1Price: number;
    tp1Pips: number;
    tp1RiskReward: number;
    tp2Price: number;
    tp2Pips: number;
    tp2RiskReward: number;
    tp3Price: number;
    tp3Pips: number;
    tp3RiskReward: number;
  };
  tradeManagement: {
    breakEvenTriggerPrice: number;
    breakEvenDescription: string;
    partialCloseAtTp1Percent: number;
    trailingStopStrategy: string;
  };
  invalidation: {
    invalidationPrice: number;
    cancellationConditions: string[];
  };
}

export interface ConfluenceFactorScore {
  id: string;
  name: string;
  weight: number;
  score: number; // 0 to weight
  passed: boolean;
  detail: string;
}

export interface MultiFactorConfluenceResult {
  totalScore: number; // 0 - 100
  minimumThreshold: number;
  isSignalEligible: boolean;
  direction: MarketDirection;
  factors: ConfluenceFactorScore[];
  stages: StrategyStagesBreakdown;
  generatedAt: number;
}

export interface MultiFactorStrategyConfig {
  contextTimeframe: TimeframeId; // default '1h'
  setupTimeframe: TimeframeId;   // default '15m'
  entryTimeframe: TimeframeId;   // default '5m'
  enableMarketStructure: boolean;
  enableLiquiditySweeps: boolean;
  enableAmdAnalysis: boolean;
  enableVolumeProfile: boolean;
  enableOrderFlowDelta: boolean;
  enableDxyFilter: boolean;
  enableSessionFilter: boolean;
  enableNewsFilter: boolean;
  minConfluenceScore: number;    // default 75
  liveExecutionEnabled: boolean; // default false (strict safety: paper trading only unless explicitly enabled)
}
