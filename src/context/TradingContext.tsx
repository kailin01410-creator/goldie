import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Instrument, 
  Candle, 
  TimeframeId, 
  TimeframeMetrics, 
  ScalpSignal, 
  PaperPosition, 
  AdminProfile, 
  RiskSettings, 
  StrategyId,
  NetworkConnectivityStatus,
  BrokerTier,
  XmBrokerTier,
  TradingStyle,
  IndicatorType,
  IndicatorBacktestReport,
  StrategyPersistenceConfig,
  AngelProject,
  GoldMemoryItem,
  PriceAlert,
  PriceAlertNotification,
  PriceAlertDirection
} from '../types';
import { soundAlertService } from '../utils/audioAlerts';
import { saveMemoriesToIndexedDb, loadMemoriesFromIndexedDb } from '../utils/indexedDbStorage';
import { INITIAL_ANGEL_PROJECTS } from '../data/angelProjects';
import { INITIAL_GOLD_MEMORIES, mergeAllMemoriesIntoAngelX, ANGEL_X_MASTER_FILE } from '../data/goldMemoryData';
import { readJson, readString, writeJson, writeString, removeKey } from '../utils/safeStorage';
import { INITIAL_INSTRUMENTS } from '../data/instruments';
import { getDominionTimeframe } from '../data/timeframes';
import { generateCandles, calculateMultiTimeframeMetrics } from '../utils/technicalAnalysis';
import { generatePreBacktestedScalp, runIndicatorBacktestMatrix } from '../utils/backtester';
import { getDetailedDxyCorrelation, DxyCorrelationDetails } from '../modules/macroFilters';
import { 
  CurrentSessionState, 
  TradingSessionId, 
  getCurrentSessionDetails 
} from '../utils/sessionManager';

export interface BrokerPresetInfo {
  tier: XmBrokerTier;
  label: string;
  spreadPips: number;
  spreadDollars: number;
  leverage: number;
  description: string;
  recommendedFor: string;
}

export type XmPresetInfo = BrokerPresetInfo;

export const BROKER_PRESETS: Record<string, BrokerPresetInfo> = {
  STANDARD: {
    tier: 'STANDARD',
    label: 'Standard Account',
    spreadPips: 3.5,
    spreadDollars: 0.35,
    leverage: 1000,
    description: 'Standard Account with 1000:1 leverage & typical 3.5 pip ($0.35/oz) spread',
    recommendedFor: 'Standard account (1000:1 leverage default)',
  },
  ULTRA_LOW: {
    tier: 'ULTRA_LOW',
    label: 'Raw / Ultra-Low',
    spreadPips: 3.0,
    spreadDollars: 0.30,
    leverage: 1000,
    description: 'Ultra Low Spread Account (Typical: 2.8 - 3.2 pips / ~$0.30 per oz)',
    recommendedFor: 'Ultra-Low accounts (Zero commission)',
  },
  MICRO: {
    tier: 'MICRO',
    label: 'Micro Account',
    spreadPips: 16.0,
    spreadDollars: 1.60,
    leverage: 1000,
    description: 'Micro Account (Micro-contract pricing ~16.0 pips / $1.60 per oz)',
    recommendedFor: 'Micro-lots accounts',
  },
  CUSTOM: {
    tier: 'CUSTOM',
    label: 'Custom Broker Spread',
    spreadPips: 3.5,
    spreadDollars: 0.35,
    leverage: 1000,
    description: 'Calibrated to match exact spread on your active MT4/MT5 terminal',
    recommendedFor: 'Precision matching to live broker quotes',
  },
};

// Backwards compatibility mappings
BROKER_PRESETS['XM_STANDARD'] = BROKER_PRESETS['STANDARD'];
BROKER_PRESETS['XM_ULTRA_LOW'] = BROKER_PRESETS['ULTRA_LOW'];
BROKER_PRESETS['XM_MICRO'] = BROKER_PRESETS['MICRO'];

export const XM_BROKER_PRESETS = BROKER_PRESETS;

interface TradingContextType {
  // Market & Instruments
  instruments: Instrument[];
  activeInstrument: Instrument;
  setActiveSymbol: (symbol: string) => void;
  candles: Candle[];
  timeframe: TimeframeId;
  setTimeframe: (tf: TimeframeId) => void;
  mtfMetrics: TimeframeMetrics[];
  isLiveFeedActive: boolean;
  setIsLiveFeedActive: (active: boolean) => void;
  tickSpeedMs: number;
  setTickSpeedMs: (speed: number) => void;
  lastTickTime: number;

  // Real-time Gold & Live Data Integration
  goldDataSource: string;
  lastGoldSyncTime: number;
  goldApiKey: string;
  goldApiNotice: string | null;
  marketStatus: 'OPEN' | 'CLOSED';
  isMarketClosed: boolean;
  marketClosureReason: string | null;
  setGoldApiKey: (key: string) => void;
  refreshGoldPrice: () => Promise<void>;
  testGoldApiKey: (keyToCheck?: string) => Promise<{ success: boolean; status: string; message: string; price?: number; httpStatus?: number; error?: string }>;
  calibrateGoldQuote: (price: number, changePercent?: number, openPrice?: number) => void;

  // Broker Spread Configuration
  brokerTier: BrokerTier;
  xmBrokerTier: BrokerTier;
  goldSpreadPips: number;
  updateBrokerSpread: (tier: BrokerTier, customPips?: number) => void;
  updateXmSpread: (tier: BrokerTier, customPips?: number) => void;
  isXmModalOpen: boolean;
  setIsXmModalOpen: (open: boolean) => void;

  // Internet Connection & Automatic Logout Security
  isOnline: boolean;
  networkStatus: NetworkConnectivityStatus;
  isOfflineLocked: boolean;
  testConnectivity: () => Promise<boolean>;
  simulateNetworkDrop: (simulateOffline: boolean) => void;
  dismissOfflineLockForDev: () => void;

  // Trading Methodology (Scalping vs Day Trading)
  tradingStyle: TradingStyle;
  setTradingStyle: (style: TradingStyle) => void;

  // Scalp & Day Trade Signal Generation with Multi-Indicator Backtesting
  scalpSignals: ScalpSignal[];
  activeScalpSignal: ScalpSignal | null;
  isGeneratingSignal: boolean;
  generateScalp: (preferredStrategy?: StrategyId) => void;
  generateSignal: (preferredStrategy?: StrategyId, styleOverride?: TradingStyle) => void;
  setActiveScalpSignal: (signal: ScalpSignal | null) => void;
  
  // Indicator Backtesting Matrix
  indicatorBacktests: IndicatorBacktestReport[];
  refreshIndicatorBacktests: () => void;
  
  // Paper Trading & Positions
  balance: number;
  equity: number;
  openPositions: PaperPosition[];
  closedPositions: PaperPosition[];
  executeScalpOrder: (signal: ScalpSignal, customLotSize?: number) => void;
  closePosition: (positionId: string, reason?: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'BREAK_EVEN') => void;
  setBreakEven: (positionId: string) => void;
  resetPaperAccount: (newBalance?: number) => void;

  // Terminal Risk & Execution Settings
  adminProfile: AdminProfile;
  riskSettings: RiskSettings;
  updateAdminRiskSettings: (settings: Partial<AdminProfile>) => void;
  updateRiskSettings: (settings: Partial<RiskSettings>) => void;

  // Android & PWA App Installation
  isAndroidInstallModalOpen: boolean;
  setIsAndroidInstallModalOpen: (open: boolean) => void;
  canInstallPwa: boolean;
  promptInstallPwa: () => Promise<void>;

  // Codebase & Project Download
  isDownloadModalOpen: boolean;
  setIsDownloadModalOpen: (open: boolean) => void;

  // GoldAPI Manual Key Modal
  isGoldKeyModalOpen: boolean;
  setIsGoldKeyModalOpen: (open: boolean) => void;

  // Settings Modal State
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Strategy Dashboard & Persistence State
  strategyConfig: StrategyPersistenceConfig;
  updateStrategyConfig: (patch: Partial<StrategyPersistenceConfig>) => void;
  toggleStrategyEnabled: (strategyId: StrategyId) => void;
  resetStrategyConfig: () => void;

  // Unified Signal Feed Management
  clearSignalHistory: () => void;
  batchScanMarketSignals: () => void;

  // Real-time DXY Macro Context
  dxyMacroDetails: DxyCorrelationDetails;

  // Trading Sessions (Asia, London, NY, Overlap)
  currentSession: CurrentSessionState;
  sessionSimulationOverride: TradingSessionId | 'LIVE';
  setSessionSimulationOverride: (override: TradingSessionId | 'LIVE') => void;

  // Navigation & Unified Studio Target
  activeTab: string;
  setActiveTab: (tab: string) => void;
  studioTargetStrategy: StrategyId | null;
  studioTargetIndicator: IndicatorType | null;
  openStudioForStrategy: (strategyId: StrategyId) => void;
  openStudioForIndicator: (indicatorId: IndicatorType) => void;
  clearStudioTargets: () => void;

  // ANGEL AI Companion & Adaptive Projects Engine
  projects: AngelProject[];
  activeProject: AngelProject;
  setActiveProject: (project: AngelProject) => void;
  addProject: (project: Omit<AngelProject, 'id' | 'createdDate'>) => AngelProject;
  updateProject: (project: AngelProject) => void;
  deleteProject: (id: string) => void;
  isAngelModalOpen: boolean;
  setIsAngelModalOpen: (open: boolean) => void;

  // Gold Memory Data & Knowledge Base
  goldMemories: GoldMemoryItem[];
  addGoldMemory: (item: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'>) => GoldMemoryItem;
  addGoldMemoriesBatch: (items: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'>[]) => GoldMemoryItem[];
  updateGoldMemory: (item: GoldMemoryItem) => void;
  deleteGoldMemory: (id: string) => void;
  toggleGoldMemoryActive: (id: string) => void;
  clearAllGoldMemories: () => void;
  consolidateAllIntoAngelX: () => void;
  /** Re-pull the authoritative document index from the server store. */
  syncMemoriesWithServer: () => Promise<void>;
  downloadAngelPackage: () => Promise<boolean>;
  isDownloadingAngel: boolean;

  // Price Alert System
  priceAlerts: PriceAlert[];
  alertToasts: PriceAlertNotification[];
  isPriceAlertModalOpen: boolean;
  setIsPriceAlertModalOpen: (open: boolean) => void;
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => PriceAlert;
  removePriceAlert: (id: string) => void;
  togglePriceAlertActive: (id: string) => void;
  rearmPriceAlert: (id: string) => void;
  clearTriggeredAlerts: () => void;
  clearAllPriceAlerts: () => void;
  dismissAlertToast: (id: string) => void;
  clearAllAlertToasts: () => void;
  triggerTestAlert: (targetPrice?: number, direction?: PriceAlertDirection) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const ADMIN_STORAGE_KEY = 'scalp_terminal_risk_profile_v1';
const PAPER_BALANCE_KEY = 'scalp_terminal_paper_balance_v1';
const GOLD_API_KEY_STORAGE = 'scalp_goldapi_key_v1';
const XM_TIER_STORAGE_KEY = 'scalp_xm_tier_v1';
const XM_SPREAD_STORAGE_KEY = 'scalp_xm_spread_v1';
const STRATEGY_PERSISTENCE_KEY = 'scalp_terminal_strategy_config_v2';
const SIGNAL_FEED_STORAGE_KEY = 'scalp_terminal_signal_feed_v2';
const OPEN_POSITIONS_STORAGE_KEY = 'scalp_terminal_open_positions_v2';
const CLOSED_POSITIONS_STORAGE_KEY = 'scalp_terminal_closed_positions_v2';
const PRICE_ALERTS_STORAGE_KEY = 'goldflow_price_alerts_v1';

export const DEFAULT_STRATEGY_CONFIG: StrategyPersistenceConfig = {
  enabledStrategies: {
    SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC: true,
    SMC_ORDER_BLOCK: true,
    VWAP_BAND_REVERSION: true,
    EMA_MOMENTUM_PULLBACK: true,
    LIQUIDITY_SWEEP_FVG: true,
    SUPER_CONFLUENCE_AI: true,
    DAY_ORDER_FLOW_VOLUME_PROFILE_SMC: true,
    DAY_SESSION_AMD_EXPANSION: true,
    DAY_H1_EMA_TREND_RIDE: true,
    DAY_PIVOT_FIBONACCI_CONFLUENCE: true,
    DAY_BREAKOUT_LONDON_PULLBACK: true,
    DAY_MULTI_INDICATOR_CONFLUENCE: true,
    DXY_GOLD_INVERSE_CORRELATION: true,
    GOLDSCALP_FAST_MOMENTUM_RSI_MACD: true,
  },
  minConfluenceScore: 75,
  minWinRateThreshold: 75,
  requireDxyAlignment: false,
  autoExecuteSignals: false,
  audioAlertsEnabled: true,
  preferredLotSize: 1.0,
  activeFeedFilter: {
    symbol: 'ALL',
    tradingStyle: 'ALL',
    direction: 'ALL',
    minWinRate: 75,
  },
};

const DEFAULT_ADMIN_PROFILE: AdminProfile = {
  maxDailyDrawdownPercent: 3.5,
  defaultLotSize: 1.0,
  accountLeverage: 1000, // 1000:1 Standard Account
  riskPerTradePercent: 1.5,
  slippageSimulationPips: 0.2,
  autoBreakevenAtR: 1.0,
  goldApiKey: '',
  brokerTier: 'STANDARD',
  goldSpreadPips: 3.5,
  xmBrokerTier: 'STANDARD',
  xmGoldSpreadPips: 3.5,
};

const ensureUniqueSignals = (signals: ScalpSignal[]): ScalpSignal[] => {
  const seenIds = new Set<string>();
  const result: ScalpSignal[] = [];
  signals.forEach((s, idx) => {
    if (!s) return;
    let safeId = s.id;
    if (!safeId || seenIds.has(safeId)) {
      const prefix = s.tradingStyle === 'DAY_TRADING' ? 'DAY' : 'SCALP';
      safeId = `${prefix}-${Date.now().toString().slice(-6)}-${idx + 1}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    seenIds.add(safeId);
    result.push({ ...s, id: safeId });
  });
  return result;
};

const ensureUniquePositions = (positions: PaperPosition[]): PaperPosition[] => {
  const seenIds = new Set<string>();
  const result: PaperPosition[] = [];
  positions.forEach((pos, idx) => {
    if (!pos) return;
    let safeId = pos.id;
    if (!safeId || seenIds.has(safeId)) {
      safeId = `POS-${Date.now().toString().slice(-6)}-${idx + 1}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    seenIds.add(safeId);
    result.push({ ...pos, id: safeId });
  });
  return result;
};

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation - default directly to live gold chart
  const [activeTab, setActiveTab] = useState<string>('chart'); // 'chart' | 'goldscalp' | 'scalp' | 'mtf' | 'orders' | 'strategy_lab' | 'settings'
  const [studioTargetStrategy, setStudioTargetStrategy] = useState<StrategyId | null>(null);
  const [studioTargetIndicator, setStudioTargetIndicator] = useState<IndicatorType | null>(null);

  const openStudioForStrategy = useCallback((strategyId: StrategyId) => {
    setStudioTargetStrategy(strategyId);
    setActiveTab('chart');
  }, []);

  const openStudioForIndicator = useCallback((indicatorId: IndicatorType) => {
    setStudioTargetIndicator(indicatorId);
    setActiveTab('chart');
  }, []);

  const clearStudioTargets = useCallback(() => {
    setStudioTargetStrategy(null);
    setStudioTargetIndicator(null);
  }, []);

  // Instruments & Market state
  const [instruments, setInstruments] = useState<Instrument[]>(INITIAL_INSTRUMENTS);
  const [activeSymbol, setActiveSymbolState] = useState<string>('XAU/USD');
  const [timeframe, setTimeframeState] = useState<TimeframeId>('5m');
  const [isLiveFeedActive, setIsLiveFeedActive] = useState<boolean>(true);
  const [tickSpeedMs, setTickSpeedMs] = useState<number>(2000);
  const [lastTickTime, setLastTickTime] = useState<number>(Date.now());

  // Trading Sessions State (Asia, London, New York, Overlap)
  const [sessionSimulationOverride, setSessionSimulationOverride] = useState<TradingSessionId | 'LIVE'>('LIVE');
  const [sessionClock, setSessionClock] = useState<Date>(() => new Date());

  useEffect(() => {
    // Session state changes across hours, throttle check to every 15s to eliminate root context thrashing
    const timer = setInterval(() => {
      setSessionClock(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const currentSession = useMemo(() => {
    if (sessionSimulationOverride === 'LIVE') {
      return getCurrentSessionDetails(sessionClock);
    }
    const sim = new Date();
    if (sessionSimulationOverride === 'ASIAN') {
      sim.setUTCHours(3, 30, 0, 0);
    } else if (sessionSimulationOverride === 'LONDON') {
      sim.setUTCHours(9, 30, 0, 0);
    } else if (sessionSimulationOverride === 'LONDON_NY_OVERLAP') {
      sim.setUTCHours(13, 45, 0, 0);
    } else if (sessionSimulationOverride === 'NEW_YORK') {
      sim.setUTCHours(16, 30, 0, 0);
    } else if (sessionSimulationOverride === 'OFF_HOURS') {
      sim.setUTCHours(22, 15, 0, 0);
    }
    return getCurrentSessionDetails(sim);
  }, [sessionClock, sessionSimulationOverride]);

  // GoldAPI / Live Data State
  const [goldDataSource, setGoldDataSource] = useState<string>('Live Institutional Spot Feed');
  const [goldApiNotice, setGoldApiNotice] = useState<string | null>(null);
  const [lastGoldSyncTime, setLastGoldSyncTime] = useState<number>(Date.now());
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [marketClosureReason, setMarketClosureReason] = useState<string | null>('Global Weekend Close');
  const [goldApiKey, setGoldApiKeyState] = useState<string>(() => {
    // Empty by default. A key committed in source is a key that leaks; the
    // user supplies their own through the GoldAPI settings modal, and the app
    // falls back to the free public spot feed when there is none.
    return localStorage.getItem(GOLD_API_KEY_STORAGE) || '';
  });

  // Internet Connection & Network Monitoring
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [networkStatus, setNetworkStatus] = useState<NetworkConnectivityStatus>('ONLINE');
  const [isOfflineLocked, setIsOfflineLocked] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? !navigator.onLine : false;
  });

  // Active Instrument
  const activeInstrument = useMemo(() => {
    return instruments.find(i => i.symbol === activeSymbol) || instruments[0];
  }, [instruments, activeSymbol]);

  // Historical Candles (200 bars depth for MT5-grade smooth zoom & pan)
  const [candles, setCandles] = useState<Candle[]>(() => {
    return generateCandles(INITIAL_INSTRUMENTS[0].currentPrice, 200, undefined, '5m');
  });

  // Regenerate candles when symbol or timeframe changes
  const setActiveSymbol = useCallback((symbol: string) => {
    setActiveSymbolState(symbol);
    const target = instruments.find(i => i.symbol === symbol) || instruments[0];
    const effectivePrice = (symbol === activeSymbol && realMarketPriceRef.current) ? realMarketPriceRef.current : target.currentPrice;
    setCandles(generateCandles(effectivePrice, 200, undefined, timeframe));
  }, [instruments, timeframe, activeSymbol]);

  const setTimeframe = useCallback((tfOrUpdater: TimeframeId | ((prev: TimeframeId) => TimeframeId)) => {
    setTimeframeState(prevTf => {
      const nextTf = typeof tfOrUpdater === 'function' ? tfOrUpdater(prevTf) : tfOrUpdater;
      const target = instruments.find(i => i.symbol === activeSymbol) || instruments[0];
      const effectivePrice = realMarketPriceRef.current || target.currentPrice;
      setCandles(generateCandles(effectivePrice, 200, undefined, nextTf));
      return nextTf;
    });
  }, [instruments, activeSymbol]);

  // Strategy Dashboard & Persistence Configuration
  const [strategyConfig, setStrategyConfig] = useState<StrategyPersistenceConfig>(() => {
    try {
      const saved = localStorage.getItem(STRATEGY_PERSISTENCE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { 
          ...DEFAULT_STRATEGY_CONFIG, 
          ...parsed,
          enabledStrategies: {
            ...DEFAULT_STRATEGY_CONFIG.enabledStrategies,
            ...(parsed.enabledStrategies || {}),
          },
          activeFeedFilter: {
            ...DEFAULT_STRATEGY_CONFIG.activeFeedFilter,
            ...(parsed.activeFeedFilter || {}),
          }
        };
      }
    } catch {
      // ignore
    }
    return DEFAULT_STRATEGY_CONFIG;
  });

  // Scalp / Unified Signals Feed State (Hydrated from localStorage)
  const [scalpSignals, setScalpSignals] = useState<ScalpSignal[]>(() => {
    try {
      const saved = localStorage.getItem(SIGNAL_FEED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return ensureUniqueSignals(parsed);
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [activeScalpSignal, setActiveScalpSignal] = useState<ScalpSignal | null>(null);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState<boolean>(false);

  // Paper Trading Account (Hydrated from localStorage)
  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem(PAPER_BALANCE_KEY);
    return saved ? Number(saved) : 50000;
  });
  const [openPositions, setOpenPositions] = useState<PaperPosition[]>(() => {
    try {
      const saved = localStorage.getItem(OPEN_POSITIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return ensureUniquePositions(parsed);
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [closedPositions, setClosedPositions] = useState<PaperPosition[]>(() => {
    try {
      const saved = localStorage.getItem(CLOSED_POSITIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return ensureUniquePositions(parsed);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Persist strategy configuration
  useEffect(() => {
    try {
      localStorage.setItem(STRATEGY_PERSISTENCE_KEY, JSON.stringify(strategyConfig));
    } catch {
      // ignore
    }
  }, [strategyConfig]);

  // Persist signals feed
  useEffect(() => {
    if (scalpSignals.length > 0) {
      try {
        localStorage.setItem(SIGNAL_FEED_STORAGE_KEY, JSON.stringify(scalpSignals.slice(0, 35)));
      } catch {
        // ignore
      }
    }
  }, [scalpSignals]);

  // Persist open & closed positions
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_POSITIONS_STORAGE_KEY, JSON.stringify(openPositions));
    } catch {
      // ignore
    }
  }, [openPositions]);

  useEffect(() => {
    try {
      localStorage.setItem(CLOSED_POSITIONS_STORAGE_KEY, JSON.stringify(closedPositions));
    } catch {
      // ignore
    }
  }, [closedPositions]);

  // Persist paper balance
  useEffect(() => {
    try {
      localStorage.setItem(PAPER_BALANCE_KEY, balance.toString());
    } catch {
      // ignore
    }
  }, [balance]);

  // Strategy persistence modifiers
  const updateStrategyConfig = useCallback((patch: Partial<StrategyPersistenceConfig>) => {
    setStrategyConfig(prev => ({
      ...prev,
      ...patch,
      enabledStrategies: {
        ...prev.enabledStrategies,
        ...(patch.enabledStrategies || {}),
      },
      activeFeedFilter: {
        ...prev.activeFeedFilter,
        ...(patch.activeFeedFilter || {}),
      },
    }));
  }, []);

  const toggleStrategyEnabled = useCallback((strategyId: StrategyId) => {
    setStrategyConfig(prev => ({
      ...prev,
      enabledStrategies: {
        ...prev.enabledStrategies,
        [strategyId]: !prev.enabledStrategies[strategyId],
      },
    }));
  }, []);

  const resetStrategyConfig = useCallback(() => {
    setStrategyConfig(DEFAULT_STRATEGY_CONFIG);
  }, []);

  const clearSignalHistory = useCallback(() => {
    setScalpSignals([]);
    setActiveScalpSignal(null);
    localStorage.removeItem(SIGNAL_FEED_STORAGE_KEY);
  }, []);

  // Real-time DXY Macro Context
  const dxyMacroDetails = useMemo(() => {
    const goldInst = instruments.find(i => i.symbol.startsWith('XAU')) || activeInstrument;
    return getDetailedDxyCorrelation(goldInst.currentPrice, 'BUY');
  }, [instruments, activeInstrument]);

  // Administrator State
  const [adminProfile, setAdminProfile] = useState<AdminProfile>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.accountLeverage === 200 || !parsed.accountLeverage) {
          parsed.accountLeverage = 1000;
        }
        if (parsed.xmBrokerTier === 'XM_ULTRA_LOW' || !parsed.xmBrokerTier) {
          parsed.xmBrokerTier = 'XM_STANDARD';
          parsed.xmGoldSpreadPips = 3.5;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_ADMIN_PROFILE;
  });

  const [isAndroidInstallModalOpen, setIsAndroidInstallModalOpen] = useState<boolean>(false);
  const [isXmModalOpen, setIsXmModalOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [isGoldKeyModalOpen, setIsGoldKeyModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAngelModalOpen, setIsAngelModalOpen] = useState<boolean>(false);

  // ANGEL Adaptive Projects State & Persistence
  const ANGEL_PROJECTS_STORAGE_KEY = 'scalp_angel_projects_v2';
  const ANGEL_ACTIVE_PROJECT_KEY = 'scalp_angel_active_project_id_v2';

  const [projects, setProjects] = useState<AngelProject[]>(() => {
    const saved = readJson<AngelProject[] | null>(ANGEL_PROJECTS_STORAGE_KEY, null, Array.isArray);
    if (saved && saved.length > 0) return saved;
    return INITIAL_ANGEL_PROJECTS;
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const saved = readString(ANGEL_ACTIVE_PROJECT_KEY);
    if (saved) return saved;
    return INITIAL_ANGEL_PROJECTS[0].id;
  });

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || INITIAL_ANGEL_PROJECTS[0];
  }, [projects, activeProjectId]);

  const setActiveProject = useCallback((proj: AngelProject) => {
    setActiveProjectId(proj.id);
    writeString(ANGEL_ACTIVE_PROJECT_KEY, proj.id);
  }, []);

  const addProject = useCallback((newProjData: Omit<AngelProject, 'id' | 'createdDate'>) => {
    const newProject: AngelProject = {
      ...newProjData,
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdDate: new Date().toISOString().split('T')[0],
    };
    setProjects(prev => {
      const updated = [newProject, ...prev];
      writeJson(ANGEL_PROJECTS_STORAGE_KEY, updated);
      return updated;
    });
    setActiveProjectId(newProject.id);
    writeString(ANGEL_ACTIVE_PROJECT_KEY, newProject.id);
    return newProject;
  }, []);

  const updateProject = useCallback((updatedProject: AngelProject) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === updatedProject.id ? updatedProject : p);
      writeJson(ANGEL_PROJECTS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      const finalProjects = filtered.length > 0 ? filtered : INITIAL_ANGEL_PROJECTS;
      writeJson(ANGEL_PROJECTS_STORAGE_KEY, finalProjects);
      return finalProjects;
    });
    if (activeProjectId === id) {
      setActiveProjectId(INITIAL_ANGEL_PROJECTS[0].id);
      writeString(ANGEL_ACTIVE_PROJECT_KEY, INITIAL_ANGEL_PROJECTS[0].id);
    }
  }, [activeProjectId]);

  // Gold Memory Data & Knowledge Base State
  const ANGEL_GOLD_MEMORIES_STORAGE_KEY = 'angel_gold_memory_data_v1';

  const [goldMemories, setGoldMemories] = useState<GoldMemoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(ANGEL_GOLD_MEMORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Documents are kept as separate items on purpose.
          //
          // The previous version collapsed every memory into one giant "ANGEL X"
          // blob on load. That destroyed per-document identity, so retrieval
          // could never cite a source, deleting one upload was impossible, and
          // the blob grew past what could be sent to the model — which is why
          // ANGEL kept "forgetting" files that had definitely been uploaded.
          // Consolidation is still available, but only as an explicit export
          // action (consolidateAllIntoAngelX), never silently on load.
          return parsed;
        }
      }
    } catch (error) {
      console.warn('Could not read stored memories, starting from defaults:', error);
    }
    return INITIAL_GOLD_MEMORIES;
  });

  const safePersistMemories = useCallback((items: GoldMemoryItem[]) => {
    // 1. Persist to high-capacity IndexedDB (hundreds of MB/GB support)
    saveMemoriesToIndexedDb(items).catch(() => {});

    // 2. Persist lightweight index to localStorage for instant synchronous hydration
    try {
      const lightweight = items.map(m => ({
        ...m,
        content: m.content && m.content.length > 8000 
          ? m.content.slice(0, 8000) + '\n\n[... Full content persisted in IndexedDB memory database ...]' 
          : m.content
      }));
      localStorage.setItem(ANGEL_GOLD_MEMORIES_STORAGE_KEY, JSON.stringify(lightweight));
    } catch (quotaErr) {
      console.warn('Storage quota limit hit on localStorage, safely relying on IndexedDB:', quotaErr);
      try {
        const minimal = items.map(m => ({
          id: m.id,
          title: m.title,
          category: m.category,
          sourceType: m.sourceType,
          fileName: m.fileName,
          isActive: m.isActive,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          tags: m.tags,
          content: m.content ? m.content.slice(0, 500) + '...' : ''
        }));
        if (!writeJson(ANGEL_GOLD_MEMORIES_STORAGE_KEY, minimal)) {
          // Even the index does not fit. IndexedDB and the server store still
          // hold the documents; only the instant-load cache is lost.
          console.error(
            '[storage] Could not persist even the document index to localStorage. ' +
              'Documents remain in IndexedDB and on the server, but this browser will load them more slowly.',
          );
        }
      } catch (indexError) {
        console.error('[storage] Failed to build the lightweight document index:', indexError);
      }
    }
  }, []);

  // Hydrate full-text memories from IndexedDB (localStorage only holds a
  // truncated index) and merge them with anything already in state, keeping
  // each document separate and deduplicating by id.
  const syncMemoriesWithServer = useCallback(async () => {
    {
      const [idbMemories, serverResponse] = await Promise.all([
        loadMemoriesFromIndexedDb().catch(() => [] as GoldMemoryItem[]),
        // The server store is now the authoritative copy. Pull its index so a
        // fresh browser still sees every document the user has uploaded.
        fetch('/api/angel/memories')
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ]);
      const serverDocuments: GoldMemoryItem[] = Array.isArray(serverResponse?.documents)
        ? serverResponse.documents.map((document: any) => ({
            id: document.id,
            title: document.title,
            category: document.category ?? 'UPLOADED_DOC',
            // Full text stays on the server; it is fetched on demand and used
            // for retrieval there, so the browser never holds the whole corpus.
            content:
              typeof document.preview === 'string' && document.preview.length > 0
                ? `${document.preview}${(document.characters ?? 0) > document.preview.length ? `\n\n[…${((document.characters ?? 0) - document.preview.length).toLocaleString()} more characters stored on the server. ANGEL searches the full text there.]` : ''}${document.extractionNote ? `\n\nExtraction note: ${document.extractionNote}` : ''}`
                : `[Stored on server · ${(document.characters ?? 0).toLocaleString()} characters. ANGEL reads the full text server-side.]${document.extractionNote ? `\n${document.extractionNote}` : ''}`,
            sourceType: document.sourceType ?? 'FILE_UPLOAD',
            fileName: document.fileName,
            fileSize: `${(document.characters ?? 0).toLocaleString()} chars`,
            fileType: document.fileType,
            createdAt: document.createdAt ?? Date.now(),
            updatedAt: document.updatedAt ?? Date.now(),
            isActive: document.isActive !== false,
            tags: document.tags ?? [],
          }))
        : [];

      setGoldMemories((previous) => {
        const byId = new Map<string, GoldMemoryItem>();
        for (const memory of [...previous, ...(Array.isArray(idbMemories) ? idbMemories : []), ...serverDocuments]) {
          if (!memory?.id) continue;
          const existing = byId.get(memory.id);
          // Prefer whichever copy actually carries the longer content.
          if (!existing || (memory.content?.length ?? 0) > (existing.content?.length ?? 0)) {
            byId.set(memory.id, memory);
          }
        }
        const merged = [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        safePersistMemories(merged);

        // One-way migration: anything that exists only in this browser is
        // pushed up so the server store holds every document. After this the
        // chat request no longer has to carry the corpus in its body.
        const serverIds = new Set(serverDocuments.map((document) => document.id));
        const pending = merged.filter(
          (memory) =>
            !serverIds.has(memory.id) &&
            typeof memory.content === 'string' &&
            memory.content.trim().length > 40 &&
            !memory.content.startsWith('[Stored on server'),
        );
        if (pending.length > 0) {
          void (async () => {
            for (const memory of pending.slice(0, 200)) {
              try {
                await fetch('/api/angel/memories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: memory.id,
                    title: memory.title,
                    content: memory.content,
                    category: memory.category,
                    sourceType: memory.sourceType,
                    fileName: memory.fileName,
                    tags: memory.tags,
                    isActive: memory.isActive !== false,
                  }),
                });
              } catch {
                // Offline or server down: the browser copy is still intact and
                // the migration retries on the next load.
                break;
              }
            }
          })();
        }

        return merged;
      });
    }
  }, [safePersistMemories]);

  useEffect(() => {
    syncMemoriesWithServer().catch((error) => console.warn('Memory hydration failed:', error));
  }, [syncMemoriesWithServer]);

  const addGoldMemory = useCallback((itemData: (Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number; updatedAt?: number })) => {
    if (itemData.id === 'angel-x' || itemData.fileName === 'ANGEL X') {
      const updatedMaster: GoldMemoryItem = {
        ...ANGEL_X_MASTER_FILE,
        ...itemData,
        id: 'angel-x',
        title: 'ANGEL X',
        fileName: 'ANGEL X',
        createdAt: itemData.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      setGoldMemories([updatedMaster]);
      safePersistMemories([updatedMaster]);
      return updatedMaster;
    }

    const newItem: GoldMemoryItem = {
      ...itemData,
      id: itemData.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: itemData.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    setGoldMemories(prev => {
      const consolidated = mergeAllMemoriesIntoAngelX([newItem, ...prev]);
      safePersistMemories([consolidated]);
      return [consolidated];
    });
    return newItem;
  }, [safePersistMemories]);

  const addGoldMemoriesBatch = useCallback((itemsData: (Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: number; updatedAt?: number })[]) => {
    if (!itemsData || itemsData.length === 0) return [];
    const newItems: GoldMemoryItem[] = itemsData.map((itemData, idx) => ({
      ...itemData,
      id: itemData.id || `mem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: itemData.createdAt || (Date.now() + idx),
      updatedAt: Date.now() + idx,
    }));

    setGoldMemories(prev => {
      const consolidated = mergeAllMemoriesIntoAngelX([...newItems, ...prev]);
      safePersistMemories([consolidated]);
      return [consolidated];
    });

    return newItems;
  }, [safePersistMemories]);

  const updateGoldMemory = useCallback((updated: GoldMemoryItem) => {
    setGoldMemories(prev => {
      const updatedList = prev.map(m => m.id === updated.id ? { ...updated, updatedAt: Date.now() } : m);
      safePersistMemories(updatedList);
      return updatedList;
    });
  }, [safePersistMemories]);

  const deleteGoldMemory = useCallback((id: string) => {
    setGoldMemories(prev => {
      const filtered = prev.filter(m => m.id !== id);
      safePersistMemories(filtered);
      return filtered;
    });
  }, [safePersistMemories]);

  const toggleGoldMemoryActive = useCallback((id: string) => {
    setGoldMemories(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, isActive: !m.isActive, updatedAt: Date.now() } : m);
      writeJson(ANGEL_GOLD_MEMORIES_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const clearAllGoldMemories = useCallback(() => {
    setGoldMemories([ANGEL_X_MASTER_FILE]);
    safePersistMemories([ANGEL_X_MASTER_FILE]);
  }, [safePersistMemories]);

  const consolidateAllIntoAngelX = useCallback(() => {
    setGoldMemories(prev => {
      const consolidated = mergeAllMemoriesIntoAngelX(prev);
      safePersistMemories([consolidated]);
      return [consolidated];
    });
  }, [safePersistMemories]);

  const [isDownloadingAngel, setIsDownloadingAngel] = useState<boolean>(false);

  const downloadAngelPackage = useCallback(async () => {
    if (isDownloadingAngel) return false;
    setIsDownloadingAngel(true);
    try {
      const res = await fetch('/api/angel/download-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memories: goldMemories,
          conversations: [],
          activeProject,
          marketContext: {
            symbol: activeInstrument?.symbol || 'XAU/USD',
            price: activeInstrument?.currentPrice || 4379.0,
            timeframe
          }
        })
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ANGEL-X-Package-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      console.warn('POST download failed, triggering GET fallback:', err);
      try {
        const fallbackLink = document.createElement('a');
        fallbackLink.href = '/api/angel/download';
        fallbackLink.download = `ANGEL-X.zip`;
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        fallbackLink.remove();
        return true;
      } catch (fallbackErr) {
        console.error('All download methods failed:', fallbackErr);
        return false;
      }
    } finally {
      setIsDownloadingAngel(false);
    }
  }, [goldMemories, activeProject, activeInstrument, timeframe, isDownloadingAngel]);

  // Price Alert System State & Methods
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>(() => {
    const saved = readJson<PriceAlert[] | null>(PRICE_ALERTS_STORAGE_KEY, null, Array.isArray);
    if (saved && saved.length > 0) return saved;
    const defaultSpot = INITIAL_INSTRUMENTS[0].currentPrice || 3018.5;
    return [
      {
        id: 'alert-xau-res-breakout',
        symbol: 'XAU/USD',
        targetPrice: Math.round((defaultSpot + 6.0) * 10) / 10,
        direction: 'ABOVE',
        status: 'ACTIVE',
        createdAt: Date.now() - 3600000,
        note: 'Upper Resistance Breakout Target',
        soundEnabled: true,
        initialPrice: defaultSpot,
      },
      {
        id: 'alert-xau-sup-test',
        symbol: 'XAU/USD',
        targetPrice: Math.round((defaultSpot - 6.0) * 10) / 10,
        direction: 'BELOW',
        status: 'ACTIVE',
        createdAt: Date.now() - 3600000,
        note: 'Demand Zone Key Support Test',
        soundEnabled: true,
        initialPrice: defaultSpot,
      }
    ];
  });

  const [alertToasts, setAlertToasts] = useState<PriceAlertNotification[]>([]);
  const [isPriceAlertModalOpen, setIsPriceAlertModalOpen] = useState<boolean>(false);

  const addPriceAlert = useCallback((alertData: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => {
    const newAlert: PriceAlert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'ACTIVE',
      createdAt: Date.now(),
    };
    setPriceAlerts(prev => {
      const updated = [newAlert, ...prev];
      writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
      return updated;
    });
    return newAlert;
  }, []);

  const removePriceAlert = useCallback((id: string) => {
    setPriceAlerts(prev => {
      const updated = prev.filter(a => a.id !== id);
      writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const togglePriceAlertActive = useCallback((id: string) => {
    setPriceAlerts(prev => {
      const updated = prev.map(a => {
        if (a.id === id) {
          const nextStatus = a.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
          return { ...a, status: nextStatus };
        }
        return a;
      });
      writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const rearmPriceAlert = useCallback((id: string) => {
    setPriceAlerts(prev => {
      const updated = prev.map(a => {
        if (a.id === id) {
          const inst = instruments.find(i => i.symbol === a.symbol) || activeInstrument;
          return {
            ...a,
            status: 'ACTIVE' as const,
            initialPrice: inst.currentPrice,
            triggeredAt: undefined,
            triggeredPrice: undefined,
          };
        }
        return a;
      });
      writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
      return updated;
    });
  }, [instruments, activeInstrument]);

  const clearTriggeredAlerts = useCallback(() => {
    setPriceAlerts(prev => {
      const updated = prev.filter(a => a.status !== 'TRIGGERED');
      writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
      return updated;
    });
  }, []);

  const clearAllPriceAlerts = useCallback(() => {
    setPriceAlerts([]);
    removeKey(PRICE_ALERTS_STORAGE_KEY);
  }, []);

  const dismissAlertToast = useCallback((id: string) => {
    setAlertToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllAlertToasts = useCallback(() => {
    setAlertToasts([]);
  }, []);

  const triggerTestAlert = useCallback((customTargetPrice?: number, customDir?: PriceAlertDirection) => {
    const currentSpot = activeInstrument.currentPrice;
    const target = customTargetPrice !== undefined ? customTargetPrice : Math.round((currentSpot + 2.5) * 10) / 10;
    const dir = customDir || (target >= currentSpot ? 'ABOVE' : 'BELOW');
    const testToast: PriceAlertNotification = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      alertId: 'test-simulated',
      symbol: activeInstrument.symbol,
      targetPrice: target,
      crossedPrice: currentSpot,
      direction: dir,
      timestamp: Date.now(),
      note: 'Target Threshold Crossed (Live Test)',
    };
    setAlertToasts(prev => [testToast, ...prev.slice(0, 4)]);
    soundAlertService.playChime(dir);
  }, [activeInstrument]);

  // Broker spread state
  const [brokerTier, setBrokerTier] = useState<BrokerTier>(() => {
    const saved = localStorage.getItem(XM_TIER_STORAGE_KEY);
    if (!saved || saved === 'XM_ULTRA_LOW' || saved === 'ULTRA_LOW') return 'STANDARD';
    if (saved === 'XM_STANDARD' || saved === 'STANDARD') return 'STANDARD';
    if (saved === 'XM_MICRO' || saved === 'MICRO') return 'MICRO';
    if (saved === 'CUSTOM') return 'CUSTOM';
    return 'STANDARD';
  });

  const [goldSpreadPips, setGoldSpreadPips] = useState<number>(() => {
    const saved = localStorage.getItem(XM_SPREAD_STORAGE_KEY);
    if (!saved || saved === '3' || saved === '3.0') return 3.5;
    return saved ? parseFloat(saved) : 3.5;
  });

  // Dynamic Broker spread calibration
  const updateBrokerSpread = useCallback((tier: BrokerTier, customPips?: number) => {
    const targetPips = tier === 'CUSTOM' && customPips !== undefined
      ? customPips
      : (BROKER_PRESETS[tier]?.spreadPips ?? 3.5);

    setBrokerTier(tier);
    setGoldSpreadPips(targetPips);
    localStorage.setItem(XM_TIER_STORAGE_KEY, tier);
    localStorage.setItem(XM_SPREAD_STORAGE_KEY, targetPips.toString());

    // Also update leverage if preset defines one
    setAdminProfile(prev => {
      const updated = {
        ...prev,
        brokerTier: tier,
        goldSpreadPips: targetPips,
        xmBrokerTier: tier,
        xmGoldSpreadPips: targetPips,
        accountLeverage: BROKER_PRESETS[tier]?.leverage || prev.accountLeverage,
      };
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    setInstruments(prev => prev.map(inst => {
      if (inst.symbol === 'XAU/USD') {
        const spreadDollars = targetPips / inst.pipMultiplier;
        const halfSpread = spreadDollars / 2;
        return {
          ...inst,
          spreadPips: targetPips,
          bid: Number((inst.currentPrice - halfSpread).toFixed(inst.decimals)),
          ask: Number((inst.currentPrice + halfSpread).toFixed(inst.decimals)),
        };
      }
      return inst;
    }));
  }, []);

  const updateXmSpread = updateBrokerSpread;
  const xmBrokerTier = brokerTier;

  // Real-time authoritative market spot anchor to prevent synthetic random-walk drift
  const realMarketPriceRef = useRef<number | null>(null);

  // Trading Methodology: Scalping vs Day Trading
  const [tradingStyle, setTradingStyleState] = useState<TradingStyle>('SCALPING');

  // Indicator Backtest Matrix Report State
  const [indicatorBacktests, setIndicatorBacktests] = useState<IndicatorBacktestReport[]>(() => {
    return runIndicatorBacktestMatrix(
      INITIAL_INSTRUMENTS[0].symbol, 
      'SCALPING', 
      INITIAL_INSTRUMENTS[0].currentPrice, 
      INITIAL_INSTRUMENTS[0].pipMultiplier
    );
  });

  const refreshIndicatorBacktests = useCallback(() => {
    const reports = runIndicatorBacktestMatrix(
      activeInstrument.symbol,
      tradingStyle,
      activeInstrument.currentPrice,
      activeInstrument.pipMultiplier
    );
    setIndicatorBacktests(reports);
  }, [activeInstrument.symbol, activeInstrument.pipMultiplier, tradingStyle]);

  // Refresh indicator backtests when symbol or trading style changes
  useEffect(() => {
    refreshIndicatorBacktests();
  }, [activeInstrument.symbol, tradingStyle, refreshIndicatorBacktests]);

  // Switching Trading Style also defaults the timeframe appropriately
  const setTradingStyle = useCallback((newStyle: TradingStyle) => {
    setTradingStyleState(newStyle);
    if (newStyle === 'DAY_TRADING') {
      setTimeframe(prev => (prev === '1m' || prev === '5m' ? '1h' : prev));
    } else {
      setTimeframe(prev => (prev === '4h' || prev === '1d' || prev === '1h' ? '5m' : prev));
    }
  }, []);

  // PWA App Installation Detection & Handler
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setCanInstallPwa(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const promptInstallPwa = useCallback(async () => {
    if (deferredInstallPrompt) {
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setCanInstallPwa(false);
        }
        setDeferredInstallPrompt(null);
      } catch {
        setIsAndroidInstallModalOpen(true);
      }
    } else {
      setIsAndroidInstallModalOpen(true);
    }
  }, [deferredInstallPrompt]);

  // Set GoldAPI key
  const setGoldApiKey = useCallback((key: string) => {
    setGoldApiKeyState(key.trim());
    localStorage.setItem(GOLD_API_KEY_STORAGE, key.trim());
    setAdminProfile(prev => ({ ...prev, goldApiKey: key.trim() }));
  }, []);

  // Save risk profile
  useEffect(() => {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminProfile));
  }, [adminProfile]);

  useEffect(() => {
    localStorage.setItem(PAPER_BALANCE_KEY, balance.toString());
  }, [balance]);

  // Handler when offline is triggered
  const handleOfflineDetected = useCallback(() => {
    setIsOnline(false);
    setNetworkStatus('OFFLINE');
    setIsOfflineLocked(true);
  }, []);

  // Heartbeat / ping connectivity test
  const testConnectivity = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOfflineDetected();
      return false;
    }

    setNetworkStatus('CHECKING');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/health?t=' + Date.now(), { 
        signal: controller.signal,
        cache: 'no-store' 
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setIsOnline(true);
        setNetworkStatus('ONLINE');
        setIsOfflineLocked(false);
        return true;
      }
    } catch {
      // In sandbox/preview, if browser navigator says offline, lock immediately
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        handleOfflineDetected();
        return false;
      }
    }
    return true;
  }, [handleOfflineDetected]);

  // Manual toggle to simulate network disconnection for testing
  const simulateNetworkDrop = useCallback((simulateOffline: boolean) => {
    if (simulateOffline) {
      handleOfflineDetected();
    } else {
      setIsOnline(true);
      setNetworkStatus('ONLINE');
      setIsOfflineLocked(false);
    }
  }, [handleOfflineDetected]);

  const dismissOfflineLockForDev = useCallback(() => {
    setIsOfflineLocked(false);
  }, []);

  // Listen to browser network events
  useEffect(() => {
    const handleBrowserOffline = () => {
      handleOfflineDetected();
    };

    const handleBrowserOnline = () => {
      setNetworkStatus('CHECKING');
      testConnectivity().then(connected => {
        if (connected) {
          setIsOnline(true);
          setNetworkStatus('ONLINE');
          setIsOfflineLocked(false);
          refreshGoldPrice();
        }
      });
    };

    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOfflineDetected();
    }

    // Periodic heartbeat every 8 seconds to check real internet access
    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        handleOfflineDetected();
      }
    }, 8000);

    return () => {
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
      clearInterval(interval);
    };
  }, [handleOfflineDetected, testConnectivity]);

  // Fetch live Gold price from backend proxy (GoldAPI.io + Live Physical Spot + COMEX)
  const refreshGoldPrice = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOfflineDetected();
      return;
    }

    try {
      const headers: Record<string, string> = {};
      const keyToUse = goldApiKey || adminProfile.goldApiKey;
      if (keyToUse) {
        headers['x-access-token'] = keyToUse;
      }

      const base = activeInstrument.baseCurrency || 'XAU';
      const quote = activeInstrument.quoteCurrency || 'USD';
      const res = await fetch(`/api/gold-price?metal=${encodeURIComponent(base)}&currency=${encodeURIComponent(quote)}&spread=${goldSpreadPips}&t=` + Date.now(), {
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.marketStatus) {
          setMarketStatus(data.marketStatus);
          if (data.marketClosureReason) {
            setMarketClosureReason(data.marketClosureReason);
          }
        }
        if (data.success && (data.rawPrice || data.price)) {
          // Pure raw market price matching live market settlement strictly
          const livePrice = Number(data.rawPrice || data.price);
          realMarketPriceRef.current = livePrice;
          setInstruments(prev => prev.map(inst => {
            if (inst.symbol === activeInstrument.symbol) {
              const newBid = data.bid ? Number(data.bid) : Number((livePrice - 0.20).toFixed(inst.decimals));
              const newAsk = data.ask ? Number(data.ask) : Number((livePrice + 0.20).toFixed(inst.decimals));
              const openPrice = data.open24h && Number(data.open24h) > 0
                ? Number(data.open24h)
                : (inst.open24h || Number((livePrice * 0.9976).toFixed(inst.decimals)));
              const finalChangePercent = data.changePercent !== undefined && data.changePercent !== null && Number(data.changePercent) !== 0
                ? Number(data.changePercent)
                : Number((((livePrice - openPrice) / openPrice) * 100).toFixed(2));
              const finalChangePips = data.change !== undefined && data.change !== null && Number(data.change) !== 0
                ? Number((Number(data.change) * inst.pipMultiplier).toFixed(1))
                : Number(((livePrice - openPrice) * inst.pipMultiplier).toFixed(1));

              return {
                ...inst,
                currentPrice: livePrice,
                open24h: openPrice,
                bid: newBid,
                ask: newAsk,
                spreadPips: Number(((newAsk - newBid) * inst.pipMultiplier).toFixed(1)),
                high24h: data.high24h ? Number(data.high24h) : Math.max(inst.high24h, livePrice),
                low24h: data.low24h ? Number(data.low24h) : Math.min(inst.low24h, livePrice),
                change24h: finalChangePercent,
                change24hPips: finalChangePips,
                tickDirection: livePrice >= inst.currentPrice ? 'UP' : 'DOWN',
              };
            }
            return inst;
          }));

          setGoldDataSource(data.source || 'Live Institutional Spot Feed');
          setLastGoldSyncTime(Date.now());
          if (data.goldApiNotice) {
            setGoldApiNotice(data.goldApiNotice);
          } else if (data.goldApiStatus === 'ACTIVE') {
            setGoldApiNotice(null);
          }

          // Calibrate candles around active instrument's live price
          setCandles(prev => {
            // If empty or if last bar close diverges > 0.5% from real live price, regenerate full 200 bars contiguously
            if (prev.length === 0 || Math.abs(prev[prev.length - 1].close - livePrice) / livePrice > 0.005) {
              return generateCandles(livePrice, 200, undefined, timeframe);
            }
            const last = { ...prev[prev.length - 1] };
            last.close = livePrice;
            last.high = Math.max(last.high, livePrice);
            last.low = Math.min(last.low, livePrice);
            last.isBullish = last.close >= last.open;
            return [...prev.slice(0, -1), last];
          });
        }
      }
    } catch (err) {
      console.warn('Live gold price fetch notice:', err);
    }
  }, [goldApiKey, adminProfile.goldApiKey, handleOfflineDetected, activeSymbol, timeframe, goldSpreadPips]);

  // Test GoldAPI key directly and return diagnostic payload
  const testGoldApiKey = useCallback(async (keyToCheck?: string) => {
    const key = keyToCheck !== undefined ? keyToCheck : (goldApiKey || adminProfile.goldApiKey);
    try {
      const res = await fetch(`/api/gold-api-test?key=${encodeURIComponent(key || '')}`);
      const data = await res.json();
      if (data.status === 'ACTIVE_AND_VALID') {
        setGoldApiNotice(null);
      } else if (data.error || data.message) {
        setGoldApiNotice(data.error || data.message);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        status: 'NETWORK_ERROR',
        message: err?.message || 'Failed to connect to GoldAPI test service',
      };
    }
  }, [goldApiKey, adminProfile.goldApiKey]);

  // Manual / Instant XM Terminal Quote Calibration
  const calibrateGoldQuote = useCallback((calibratedPrice: number, calibratedChangePercent?: number, calibratedOpen?: number) => {
    const price = Number(calibratedPrice);
    if (isNaN(price) || price <= 0) return;

    setInstruments(prev => prev.map(inst => {
      if (inst.symbol === 'XAU/USD') {
        const spreadDollars = goldSpreadPips / inst.pipMultiplier;
        const halfSpread = spreadDollars / 2;
        const newBid = Number((price - halfSpread).toFixed(2));
        const newAsk = Number((price + halfSpread).toFixed(2));

        let openPrice = calibratedOpen;
        let changePct = calibratedChangePercent;

        if (openPrice !== undefined && !isNaN(openPrice) && openPrice > 0) {
          changePct = Number((((price - openPrice) / openPrice) * 100).toFixed(2));
        } else if (changePct !== undefined && !isNaN(changePct)) {
          openPrice = Number((price / (1 + changePct / 100)).toFixed(2));
        } else {
          openPrice = inst.open24h || 4407.30;
          changePct = Number((((price - openPrice) / openPrice) * 100).toFixed(2));
        }

        const changePips = Number(((price - openPrice) * inst.pipMultiplier).toFixed(1));

        return {
          ...inst,
          currentPrice: price,
          open24h: openPrice,
          bid: newBid,
          ask: newAsk,
          spreadPips: goldSpreadPips,
          high24h: Math.max(inst.high24h, price),
          low24h: Math.min(inst.low24h, price),
          change24h: changePct,
          change24hPips: changePips,
          tickDirection: price >= inst.currentPrice ? 'UP' : 'DOWN',
        };
      }
      return inst;
    }));

    setGoldDataSource('Calibrated to Terminal Feed');
    setLastGoldSyncTime(Date.now());
    realMarketPriceRef.current = price;

    if (activeSymbol === 'XAU/USD') {
      setCandles(prev => {
        if (prev.length === 0 || Math.abs(prev[prev.length - 1].close - price) > 30) {
          return generateCandles(price, 200, undefined, timeframe);
        }
        const last = { ...prev[prev.length - 1] };
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.isBullish = last.close >= last.open;
        return [...prev.slice(0, -1), last];
      });
    }
  }, [goldSpreadPips, activeSymbol, timeframe]);

  // Initial and periodic price fetch
  useEffect(() => {
    refreshGoldPrice();
    const interval = setInterval(() => {
      refreshGoldPrice();
    }, 2500); // sync real live spot every 2.5s

    return () => clearInterval(interval);
  }, [refreshGoldPrice]);

  // Update risk settings
  const updateAdminRiskSettings = useCallback((settings: Partial<AdminProfile>) => {
    setAdminProfile(prev => ({ ...prev, ...settings }));
  }, []);

  // Determine consolidated market closed state (from session manager or server status)
  const isMarketClosedEffective = useMemo(() => {
    return currentSession.isMarketClosed || marketStatus === 'CLOSED';
  }, [currentSession.isMarketClosed, marketStatus]);

  // Real-time ticking engine - strictly FROZEN when the global gold market is closed
  useEffect(() => {
    // If market is closed, offline, or live feed toggled off, do not simulate ticks
    if (!isLiveFeedActive || isOfflineLocked || isMarketClosedEffective) return;

    const interval = setInterval(() => {
      setInstruments(prevInstruments => {
        return prevInstruments.map(inst => {
          let newPrice: number;
          if (inst.symbol.startsWith('XAU')) {
            const anchor = realMarketPriceRef.current ?? inst.currentPrice;
            // Pull tightly towards the latest live physical spot feed without wandering
            const meanReversion = (anchor - inst.currentPrice) * 0.45;
            const microJitter = (Math.random() - 0.49) * 0.14;
            newPrice = Number((inst.currentPrice + meanReversion + microJitter).toFixed(inst.decimals));
          } else {
            const volatility = inst.symbol.includes('BTC') ? 22.0 : 0.00015;
            const delta = (Math.random() - 0.49) * volatility;
            newPrice = Number((inst.currentPrice + delta).toFixed(inst.decimals));
          }
          const tickDir: 'UP' | 'DOWN' | 'EQUAL' = newPrice > inst.currentPrice ? 'UP' : newPrice < inst.currentPrice ? 'DOWN' : 'EQUAL';
          
          const halfSpread = (inst.spreadPips / inst.pipMultiplier) / 2;
          const newBid = Number((newPrice - halfSpread).toFixed(inst.decimals));
          const newAsk = Number((newPrice + halfSpread).toFixed(inst.decimals));
          const newHigh = Math.max(inst.high24h, newPrice);
          const newLow = Math.min(inst.low24h, newPrice);

          // Broker-aligned mathematical change calculation relative to fixed daily open anchor
          const openPrice = inst.open24h || (inst.currentPrice / (1 + (inst.change24h || 0) / 100));
          const change24h = Number((((newPrice - openPrice) / openPrice) * 100).toFixed(2));
          const change24hPips = Number(((newPrice - openPrice) * inst.pipMultiplier).toFixed(1));

          return {
            ...inst,
            currentPrice: newPrice,
            open24h: openPrice,
            bid: newBid,
            ask: newAsk,
            high24h: newHigh,
            low24h: newLow,
            change24h,
            change24hPips,
            tickDirection: tickDir,
          };
        });
      });

      setLastTickTime(Date.now());

      // Update current live candle with timeframe interval rollover
      setCandles(prevCandles => {
        if (prevCandles.length === 0) return prevCandles;
        const price = activeInstrument.currentPrice;
        const last = { ...prevCandles[prevCandles.length - 1] };
        const tfSpec = getDominionTimeframe(timeframe);
        const intervalMs = tfSpec.intervalMs;
        const now = Date.now();
        const currentBarTime = Math.floor(now / intervalMs) * intervalMs;

        // If the candle time has elapsed into a new bar interval, form the next candle
        if (currentBarTime > last.time) {
          last.isComplete = true;
          const nextCandle: Candle = {
            time: currentBarTime,
            open: last.close,
            high: Math.max(last.close, price),
            low: Math.min(last.close, price),
            close: price,
            volume: 1,
            isBullish: price >= last.close,
            isComplete: false,
          };
          return [...prevCandles.slice(1), last, nextCandle];
        }

        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.isBullish = last.close >= last.open;
        last.volume += Math.floor(10 + Math.random() * 20);

        return [...prevCandles.slice(0, -1), last];
      });

      // Update open paper positions PnL
      setOpenPositions(prevPositions => {
        if (prevPositions.length === 0) return prevPositions;
        return prevPositions.map(pos => {
          const inst = instruments.find(i => i.symbol === pos.symbol) || activeInstrument;
          const price = pos.direction === 'BUY' ? inst.bid : inst.ask;
          const pipsDiff = pos.direction === 'BUY'
            ? (price - pos.entryPrice) * inst.pipMultiplier
            : (pos.entryPrice - price) * inst.pipMultiplier;
          
          // Forex standard 1 standard lot = $10 per pip; Gold 1 lot (100 oz) = $10 per pip
          const pipValue = pos.symbol.startsWith('XAU') ? 10 : pos.symbol.includes('BTC') ? 1 : 10;
          const pnlDollars = Number((pipsDiff * pipValue * pos.lotSize).toFixed(2));

          return {
            ...pos,
            currentPrice: price,
            pnlPips: Number(pipsDiff.toFixed(1)),
            pnlDollars,
          };
        });
      });

    }, tickSpeedMs);

    return () => clearInterval(interval);
  }, [isLiveFeedActive, isOfflineLocked, isMarketClosedEffective, tickSpeedMs, activeInstrument, instruments]);

  // Compute live multi-timeframe metrics for the active instrument
  const mtfMetrics = useMemo(() => {
    return calculateMultiTimeframeMetrics(activeInstrument.currentPrice, activeInstrument.pipMultiplier);
  }, [activeInstrument.currentPrice, activeInstrument.pipMultiplier]);

  // Calculate paper account equity
  const totalUnrealizedPnL = useMemo(() => {
    return openPositions.reduce((sum, pos) => sum + pos.pnlDollars, 0);
  }, [openPositions]);

  const equity = useMemo(() => {
    return Number((balance + totalUnrealizedPnL).toFixed(2));
  }, [balance, totalUnrealizedPnL]);

  // Auto-SL / Auto-TP check on open positions
  useEffect(() => {
    openPositions.forEach(pos => {
      const inst = instruments.find(i => i.symbol === pos.symbol) || activeInstrument;
      const price = inst.currentPrice;

      if (pos.direction === 'BUY') {
        if (price >= pos.takeProfit) {
          closePosition(pos.id, 'TAKE_PROFIT');
        } else if (price <= pos.stopLoss) {
          closePosition(pos.id, 'STOP_LOSS');
        }
      } else {
        if (price <= pos.takeProfit) {
          closePosition(pos.id, 'TAKE_PROFIT');
        } else if (price >= pos.stopLoss) {
          closePosition(pos.id, 'STOP_LOSS');
        }
      }
    });
  }, [instruments, openPositions, activeInstrument]);

  // Price Alert Crossing Detection Engine
  const lastCheckedAlertPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    instruments.forEach(inst => {
      const lastPrice = lastCheckedAlertPricesRef.current[inst.symbol];
      const currentPrice = inst.currentPrice;

      if (lastPrice === undefined) {
        lastCheckedAlertPricesRef.current[inst.symbol] = currentPrice;
        return;
      }

      if (lastPrice === currentPrice) return;

      // Find any active alerts for this symbol that have crossed
      const triggeredAlertsList: { alert: PriceAlert; crossedPrice: number }[] = [];

      priceAlerts.forEach(alert => {
        if (alert.symbol === inst.symbol && alert.status === 'ACTIVE') {
          let hasCrossed = false;

          if (alert.direction === 'ABOVE') {
            // Price crossed upward through the target threshold
            if ((lastPrice < alert.targetPrice && currentPrice >= alert.targetPrice) ||
                (alert.initialPrice < alert.targetPrice && currentPrice >= alert.targetPrice)) {
              hasCrossed = true;
            }
          } else if (alert.direction === 'BELOW') {
            // Price crossed downward through the target threshold
            if ((lastPrice > alert.targetPrice && currentPrice <= alert.targetPrice) ||
                (alert.initialPrice > alert.targetPrice && currentPrice <= alert.targetPrice)) {
              hasCrossed = true;
            }
          }

          if (hasCrossed) {
            triggeredAlertsList.push({ alert, crossedPrice: currentPrice });
          }
        }
      });

      lastCheckedAlertPricesRef.current[inst.symbol] = currentPrice;

      if (triggeredAlertsList.length > 0) {
        setPriceAlerts(prev => {
          const updated = prev.map(a => {
            const match = triggeredAlertsList.find(t => t.alert.id === a.id);
            if (match) {
              return {
                ...a,
                status: 'TRIGGERED' as const,
                triggeredAt: Date.now(),
                triggeredPrice: match.crossedPrice,
              };
            }
            return a;
          });
          writeJson(PRICE_ALERTS_STORAGE_KEY, updated);
          return updated;
        });

        // Trigger visual toast notifications
        const newToasts: PriceAlertNotification[] = triggeredAlertsList.map(({ alert, crossedPrice }) => ({
          id: `toast-${Date.now()}-${alert.id}`,
          alertId: alert.id,
          symbol: alert.symbol,
          targetPrice: alert.targetPrice,
          crossedPrice,
          direction: alert.direction,
          timestamp: Date.now(),
          note: alert.note,
        }));

        setAlertToasts(prev => [...newToasts, ...prev].slice(0, 5));

        // Play audio chime if enabled on any triggered alert
        if (triggeredAlertsList.some(t => t.alert.soundEnabled)) {
          soundAlertService.playChime(triggeredAlertsList[0].alert.direction);
        }
      }
    });
  }, [instruments, priceAlerts]);

  // Generate Pre-Backtested Signal (Scalping or Day Trading)
  const generateSignal = useCallback((preferredStrategy?: StrategyId, styleOverride?: TradingStyle) => {
    setIsGeneratingSignal(true);
    const targetStyle = styleOverride || tradingStyle;
    setTimeout(() => {
      const newSignal = generatePreBacktestedScalp(
        activeInstrument.symbol,
        activeInstrument.currentPrice,
        activeInstrument.pipMultiplier,
        preferredStrategy,
        targetStyle
      );
      setScalpSignals(prev => ensureUniqueSignals([newSignal, ...prev.slice(0, 24)]));
      setActiveScalpSignal(newSignal);
      setIsGeneratingSignal(false);
    }, 550);
  }, [activeInstrument, tradingStyle]);

  const generateScalp = useCallback((preferredStrategy?: StrategyId) => {
    generateSignal(preferredStrategy, tradingStyle);
  }, [generateSignal, tradingStyle]);

  // Batch Scan Market Signals across enabled strategies and watchlists
  const batchScanMarketSignals = useCallback(() => {
    setIsGeneratingSignal(true);
    setTimeout(() => {
      const generated: ScalpSignal[] = [];
      const symbolsToScan = ['XAU/USD'];
      
      symbolsToScan.forEach(sym => {
        const inst = instruments.find(i => i.symbol === sym) || activeInstrument;
        
        // Scalp setup
        if (strategyConfig.enabledStrategies['SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC']) {
          generated.push(generatePreBacktestedScalp(
            inst.symbol,
            inst.currentPrice,
            inst.pipMultiplier,
            'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC',
            'SCALPING'
          ));
        }

        // Gold-specific Macro and Day Trading strategies
        if (sym === 'XAU/USD') {
          if (strategyConfig.enabledStrategies['DXY_GOLD_INVERSE_CORRELATION']) {
            generated.push(generatePreBacktestedScalp(
              inst.symbol,
              inst.currentPrice,
              inst.pipMultiplier,
              'DXY_GOLD_INVERSE_CORRELATION',
              'DAY_TRADING'
            ));
          }
          if (strategyConfig.enabledStrategies['DAY_ORDER_FLOW_VOLUME_PROFILE_SMC']) {
            generated.push(generatePreBacktestedScalp(
              inst.symbol,
              inst.currentPrice,
              inst.pipMultiplier,
              'DAY_ORDER_FLOW_VOLUME_PROFILE_SMC',
              'DAY_TRADING'
            ));
          }
          if (strategyConfig.enabledStrategies['SUPER_CONFLUENCE_AI']) {
            generated.push(generatePreBacktestedScalp(
              inst.symbol,
              inst.currentPrice,
              inst.pipMultiplier,
              'SUPER_CONFLUENCE_AI',
              'SCALPING'
            ));
          }
        }
      });

      setScalpSignals(prev => {
        const combined = ensureUniqueSignals([...generated, ...prev]).slice(0, 40);
        return combined;
      });

      if (generated.length > 0) {
        setActiveScalpSignal(generated[0]);
      }
      setIsGeneratingSignal(false);
    }, 600);
  }, [instruments, activeInstrument, strategyConfig]);

  // Generate initial scalp, day trade, and DXY macro signals on startup if feed empty
  useEffect(() => {
    if (scalpSignals.length === 0) {
      const initialScalp = generatePreBacktestedScalp(
        activeInstrument.symbol,
        activeInstrument.currentPrice,
        activeInstrument.pipMultiplier,
        'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC',
        'SCALPING'
      );
      const initialDxyMacro = generatePreBacktestedScalp(
        activeInstrument.symbol,
        activeInstrument.currentPrice,
        activeInstrument.pipMultiplier,
        'DXY_GOLD_INVERSE_CORRELATION',
        'DAY_TRADING'
      );
      const initialDay = generatePreBacktestedScalp(
        activeInstrument.symbol,
        activeInstrument.currentPrice,
        activeInstrument.pipMultiplier,
        'DAY_ORDER_FLOW_VOLUME_PROFILE_SMC',
        'DAY_TRADING'
      );
      const initialSuperAi = generatePreBacktestedScalp(
        activeInstrument.symbol,
        activeInstrument.currentPrice,
        activeInstrument.pipMultiplier,
        'SUPER_CONFLUENCE_AI',
        'SCALPING'
      );
      setScalpSignals(ensureUniqueSignals([initialDxyMacro, initialScalp, initialDay, initialSuperAi]));
      setActiveScalpSignal(initialDxyMacro);
    }
  }, []);

  // Execute paper trading order from a signal
  const executeScalpOrder = useCallback((signal: ScalpSignal, customLotSize?: number) => {
    const lotSize = customLotSize || adminProfile.defaultLotSize;
    const inst = instruments.find(i => i.symbol === signal.symbol) || activeInstrument;
    const executionPrice = signal.direction === 'BUY' ? inst.ask : inst.bid;

    const newPosition: PaperPosition = {
      id: `POS-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      symbol: signal.symbol,
      direction: signal.direction,
      lotSize,
      entryPrice: executionPrice,
      currentPrice: executionPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit2,
      openTime: Date.now(),
      pnlDollars: -Number((inst.spreadPips * lotSize * (inst.symbol.startsWith('XAU') ? 10 : 10)).toFixed(2)),
      pnlPips: -inst.spreadPips,
      status: 'OPEN',
      strategyName: signal.strategyName,
    };

    setOpenPositions(prev => ensureUniquePositions([newPosition, ...prev]));
  }, [adminProfile.defaultLotSize, instruments, activeInstrument]);

  // Close position
  const closePosition = useCallback((
    positionId: string, 
    reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL_CLOSE' | 'BREAK_EVEN' = 'MANUAL_CLOSE'
  ) => {
    setOpenPositions(prev => {
      const target = prev.find(p => p.id === positionId);
      if (!target) return prev;

      const closed: PaperPosition = {
        ...target,
        status: 'CLOSED',
        closeTime: Date.now(),
        closePrice: target.currentPrice,
        closeReason: reason,
      };

      setClosedPositions(c => ensureUniquePositions([closed, ...c]));
      setBalance(b => Number((b + target.pnlDollars).toFixed(2)));

      return prev.filter(p => p.id !== positionId);
    });
  }, []);

  // Move stop loss to break-even (entry price)
  const setBreakEven = useCallback((positionId: string) => {
    setOpenPositions(prev => prev.map(p => {
      if (p.id === positionId) {
        return {
          ...p,
          stopLoss: p.entryPrice,
        };
      }
      return p;
    }));
  }, []);

  // Reset paper balance
  const resetPaperAccount = useCallback((newBalance: number = 50000) => {
    setOpenPositions([]);
    setClosedPositions([]);
    setBalance(newBalance);
  }, []);

  const value = {
    instruments,
    activeInstrument,
    setActiveSymbol,
    candles,
    timeframe,
    setTimeframe,
    mtfMetrics,
    isLiveFeedActive,
    setIsLiveFeedActive,
    tickSpeedMs,
    setTickSpeedMs,
    lastTickTime,
    goldDataSource,
    goldApiNotice,
    lastGoldSyncTime,
    marketStatus,
    isMarketClosed: isMarketClosedEffective,
    marketClosureReason: marketClosureReason || currentSession.marketClosureReason,
    goldApiKey,
    setGoldApiKey,
    refreshGoldPrice,
    testGoldApiKey,
    calibrateGoldQuote,
    isOnline,
    networkStatus,
    isOfflineLocked,
    testConnectivity,
    simulateNetworkDrop,
    dismissOfflineLockForDev,
    tradingStyle,
    setTradingStyle,
    scalpSignals,
    activeScalpSignal,
    isGeneratingSignal,
    generateScalp,
    generateSignal,
    setActiveScalpSignal,
    indicatorBacktests,
    refreshIndicatorBacktests,
    balance,
    equity,
    openPositions,
    closedPositions,
    executeScalpOrder,
    closePosition,
    setBreakEven,
    resetPaperAccount,
    adminProfile,
    riskSettings: adminProfile,
    updateAdminRiskSettings,
    updateRiskSettings: updateAdminRiskSettings,
    isAndroidInstallModalOpen,
    setIsAndroidInstallModalOpen,
    canInstallPwa,
    promptInstallPwa,
    brokerTier,
    xmBrokerTier,
    goldSpreadPips,
    updateBrokerSpread,
    updateXmSpread,
    isXmModalOpen,
    setIsXmModalOpen,
    isDownloadModalOpen,
    setIsDownloadModalOpen,
    isGoldKeyModalOpen,
    setIsGoldKeyModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    strategyConfig,
    updateStrategyConfig,
    toggleStrategyEnabled,
    resetStrategyConfig,
    clearSignalHistory,
    batchScanMarketSignals,
    dxyMacroDetails,
    currentSession,
    sessionSimulationOverride,
    setSessionSimulationOverride,
    activeTab,
    setActiveTab,
    studioTargetStrategy,
    studioTargetIndicator,
    openStudioForStrategy,
    openStudioForIndicator,
    clearStudioTargets,
    projects,
    activeProject,
    setActiveProject,
    addProject,
    updateProject,
    deleteProject,
    isAngelModalOpen,
    setIsAngelModalOpen,
    goldMemories,
    addGoldMemory,
    addGoldMemoriesBatch,
    updateGoldMemory,
    deleteGoldMemory,
    toggleGoldMemoryActive,
    clearAllGoldMemories,
    consolidateAllIntoAngelX,
    syncMemoriesWithServer,
    downloadAngelPackage,
    isDownloadingAngel,
    // Price Alert System
    priceAlerts,
    alertToasts,
    isPriceAlertModalOpen,
    setIsPriceAlertModalOpen,
    addPriceAlert,
    removePriceAlert,
    togglePriceAlertActive,
    rearmPriceAlert,
    clearTriggeredAlerts,
    clearAllPriceAlerts,
    dismissAlertToast,
    clearAllAlertToasts,
    triggerTestAlert,
  };

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) throw new Error('useTrading must be used within TradingProvider');
  return context;
};
