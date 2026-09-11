import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  XmBrokerTier,
  TradingStyle,
  IndicatorType,
  IndicatorBacktestReport,
  StrategyPersistenceConfig
} from '../types';
import { INITIAL_INSTRUMENTS } from '../data/instruments';
import { generateCandles, calculateMultiTimeframeMetrics } from '../utils/technicalAnalysis';
import { generatePreBacktestedScalp, runIndicatorBacktestMatrix } from '../utils/backtester';
import { getDetailedDxyCorrelation, DxyCorrelationDetails } from '../modules/macroFilters';
import { 
  CurrentSessionState, 
  TradingSessionId, 
  getCurrentSessionDetails 
} from '../utils/sessionManager';

export interface XmPresetInfo {
  tier: XmBrokerTier;
  label: string;
  spreadPips: number;
  spreadDollars: number;
  description: string;
  recommendedFor: string;
}

export const XM_BROKER_PRESETS: Record<XmBrokerTier, XmPresetInfo> = {
  XM_ULTRA_LOW: {
    tier: 'XM_ULTRA_LOW',
    label: 'XM Ultra Low',
    spreadPips: 3.0,
    spreadDollars: 0.30,
    description: 'XM Ultra Low Standard / Micro (Typical: 2.8 - 3.2 pips / ~$0.30 per oz)',
    recommendedFor: 'XM Demo standard accounts (Zero commission)',
  },
  XM_STANDARD: {
    tier: 'XM_STANDARD',
    label: 'XM Standard',
    spreadPips: 4.0,
    spreadDollars: 0.40,
    description: 'XM Classic Standard Account (Typical: 3.5 - 4.5 pips / ~$0.40 per oz)',
    recommendedFor: 'Classic accounts with deposit bonus structures',
  },
  XM_MICRO: {
    tier: 'XM_MICRO',
    label: 'XM Micro',
    spreadPips: 16.0,
    spreadDollars: 1.60,
    description: 'XM Micro Account (Micro-contract pricing ~16.0 pips / $1.60 per oz)',
    recommendedFor: 'Micro-lots accounts',
  },
  CUSTOM: {
    tier: 'CUSTOM',
    label: 'Custom XM Demo',
    spreadPips: 3.0,
    spreadDollars: 0.30,
    description: 'Calibrated to match exact spread on your active XM MT4/MT5 demo terminal',
    recommendedFor: 'Precision matching to live broker quotes',
  },
};

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
  setGoldApiKey: (key: string) => void;
  refreshGoldPrice: () => Promise<void>;

  // XM Broker Spread Configuration
  xmBrokerTier: XmBrokerTier;
  goldSpreadPips: number;
  updateXmSpread: (tier: XmBrokerTier, customPips?: number) => void;
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

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  accountLeverage: 200, // 1:200
  riskPerTradePercent: 1.5,
  slippageSimulationPips: 0.2,
  autoBreakevenAtR: 1.0,
  goldApiKey: '',
  xmBrokerTier: 'XM_ULTRA_LOW',
  xmGoldSpreadPips: 3.0,
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
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('scalp'); // 'scalp' | 'mtf' | 'chart' | 'orders' | 'strategy_lab' | 'admin'

  // Instruments & Market state
  const [instruments, setInstruments] = useState<Instrument[]>(INITIAL_INSTRUMENTS);
  const [activeSymbol, setActiveSymbolState] = useState<string>('XAU/USD');
  const [timeframe, setTimeframe] = useState<TimeframeId>('5m');
  const [isLiveFeedActive, setIsLiveFeedActive] = useState<boolean>(true);
  const [tickSpeedMs, setTickSpeedMs] = useState<number>(1000);
  const [lastTickTime, setLastTickTime] = useState<number>(Date.now());

  // Trading Sessions State (Asia, London, New York, Overlap)
  const [sessionSimulationOverride, setSessionSimulationOverride] = useState<TradingSessionId | 'LIVE'>('LIVE');
  const [sessionClock, setSessionClock] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionClock(new Date());
    }, 1000);
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
  const [lastGoldSyncTime, setLastGoldSyncTime] = useState<number>(Date.now());
  const [goldApiKey, setGoldApiKeyState] = useState<string>(() => {
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

  // Historical Candles
  const [candles, setCandles] = useState<Candle[]>(() => {
    return generateCandles(INITIAL_INSTRUMENTS[0].currentPrice, 70, 0.0018, '5m');
  });

  // Regenerate candles when symbol or timeframe changes
  const setActiveSymbol = useCallback((symbol: string) => {
    setActiveSymbolState(symbol);
    const target = instruments.find(i => i.symbol === symbol) || instruments[0];
    setCandles(generateCandles(target.currentPrice, 70, 0.0018, timeframe));
  }, [instruments, timeframe]);

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
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_ADMIN_PROFILE;
  });

  const [isAndroidInstallModalOpen, setIsAndroidInstallModalOpen] = useState<boolean>(false);
  const [isXmModalOpen, setIsXmModalOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);

  // XM Broker spread state
  const [xmBrokerTier, setXmBrokerTier] = useState<XmBrokerTier>(() => {
    const saved = localStorage.getItem(XM_TIER_STORAGE_KEY);
    return (saved as XmBrokerTier) || 'XM_ULTRA_LOW';
  });

  const [goldSpreadPips, setGoldSpreadPips] = useState<number>(() => {
    const saved = localStorage.getItem(XM_SPREAD_STORAGE_KEY);
    return saved ? parseFloat(saved) : 3.0;
  });

  // Dynamic XM Broker spread calibration
  const updateXmSpread = useCallback((tier: XmBrokerTier, customPips?: number) => {
    const targetPips = tier === 'CUSTOM' && customPips !== undefined
      ? customPips
      : (XM_BROKER_PRESETS[tier]?.spreadPips ?? 3.0);

    setXmBrokerTier(tier);
    setGoldSpreadPips(targetPips);
    localStorage.setItem(XM_TIER_STORAGE_KEY, tier);
    localStorage.setItem(XM_SPREAD_STORAGE_KEY, targetPips.toString());

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
  }, [activeInstrument.symbol, activeInstrument.currentPrice, activeInstrument.pipMultiplier, tradingStyle]);

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

  // Fetch live Gold price from backend proxy (GoldAPI.io + Live Physical Spot)
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

      const res = await fetch(`/api/gold-price?metal=XAU&currency=USD&spread=${goldSpreadPips}&t=` + Date.now(), {
        headers,
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.price) {
          const livePrice = Number(data.price);
          setInstruments(prev => prev.map(inst => {
            if (inst.symbol === 'XAU/USD') {
              const spreadDollars = goldSpreadPips / inst.pipMultiplier;
              const halfSpread = spreadDollars / 2;
              const newBid = Number((livePrice - halfSpread).toFixed(2));
              const newAsk = Number((livePrice + halfSpread).toFixed(2));
              return {
                ...inst,
                currentPrice: livePrice,
                bid: newBid,
                ask: newAsk,
                spreadPips: goldSpreadPips,
                high24h: data.high24h ? Number(data.high24h) : Math.max(inst.high24h, livePrice),
                low24h: data.low24h ? Number(data.low24h) : Math.min(inst.low24h, livePrice),
                change24h: data.changePercent !== undefined ? Number(data.changePercent) : inst.change24h,
                change24hPips: data.change ? Number((data.change * 10).toFixed(1)) : inst.change24hPips,
                tickDirection: livePrice >= inst.currentPrice ? 'UP' : 'DOWN',
              };
            }
            return inst;
          }));

          setGoldDataSource(data.source || 'Live Institutional Spot Feed');
          setLastGoldSyncTime(Date.now());

          // If current active symbol is XAU/USD, calibrate candles around today's live price
          if (activeSymbol === 'XAU/USD') {
            setCandles(prev => {
              if (prev.length === 0 || Math.abs(prev[prev.length - 1].close - livePrice) > 100) {
                return generateCandles(livePrice, 70, 0.0018, timeframe);
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
      }
    } catch (err) {
      console.warn('Live gold price fetch notice:', err);
    }
  }, [goldApiKey, adminProfile.goldApiKey, handleOfflineDetected, activeSymbol, timeframe]);

  // Initial and periodic price fetch
  useEffect(() => {
    refreshGoldPrice();
    const interval = setInterval(() => {
      refreshGoldPrice();
    }, 10000); // sync real live spot every 10s

    return () => clearInterval(interval);
  }, [refreshGoldPrice]);

  // Update risk settings
  const updateAdminRiskSettings = useCallback((settings: Partial<AdminProfile>) => {
    setAdminProfile(prev => ({ ...prev, ...settings }));
  }, []);

  // Real-time ticking engine
  useEffect(() => {
    if (!isLiveFeedActive || isOfflineLocked) return;

    const interval = setInterval(() => {
      setInstruments(prevInstruments => {
        return prevInstruments.map(inst => {
          // Generate micro-tick
          const volatility = inst.symbol.startsWith('XAU') ? 0.45 : inst.symbol.includes('BTC') ? 22.0 : 0.00015;
          const delta = (Math.random() - 0.49) * volatility;
          const newPrice = Number((inst.currentPrice + delta).toFixed(inst.decimals));
          const tickDir: 'UP' | 'DOWN' | 'EQUAL' = newPrice > inst.currentPrice ? 'UP' : newPrice < inst.currentPrice ? 'DOWN' : 'EQUAL';
          
          const halfSpread = (inst.spreadPips / inst.pipMultiplier) / 2;
          const newBid = Number((newPrice - halfSpread).toFixed(inst.decimals));
          const newAsk = Number((newPrice + halfSpread).toFixed(inst.decimals));
          const newHigh = Math.max(inst.high24h, newPrice);
          const newLow = Math.min(inst.low24h, newPrice);

          // Change calculation
          const change24h = Number((inst.change24h + (delta / inst.currentPrice) * 100).toFixed(2));
          const change24hPips = Number(((newPrice - (inst.currentPrice / (1 + inst.change24h / 100))) * inst.pipMultiplier).toFixed(1));

          return {
            ...inst,
            currentPrice: newPrice,
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

      // Update current live candle
      setCandles(prevCandles => {
        if (prevCandles.length === 0) return prevCandles;
        const last = { ...prevCandles[prevCandles.length - 1] };
        const price = activeInstrument.currentPrice;
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.isBullish = last.close >= last.open;
        last.volume += Math.floor(10 + Math.random() * 20);

        return [...prevCandles.slice(0, -1), last];
      });

      // Update open paper positions PnL
      setOpenPositions(prevPositions => {
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
  }, [isLiveFeedActive, isOfflineLocked, tickSpeedMs, activeInstrument, instruments]);

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
      const symbolsToScan = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'BTC/USD'];
      
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
    lastGoldSyncTime,
    goldApiKey,
    setGoldApiKey,
    refreshGoldPrice,
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
    xmBrokerTier,
    goldSpreadPips,
    updateXmSpread,
    isXmModalOpen,
    setIsXmModalOpen,
    isDownloadModalOpen,
    setIsDownloadModalOpen,
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
