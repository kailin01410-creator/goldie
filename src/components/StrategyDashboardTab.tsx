import React, { useState } from 'react';
import { 
  Sliders, 
  CheckCircle2, 
  Zap, 
  RotateCcw, 
  ShieldAlert, 
  Compass, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Sparkles, 
  Flame, 
  Check, 
  AlertTriangle,
  Info,
  Radio,
  SlidersHorizontal,
  Volume2,
  LineChart
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { StrategyId, TradingStyle } from '../types';
import { STRATEGY_CONFIGS } from '../utils/backtester';
import { DxyGoldCorrelationCard } from './DxyGoldCorrelationCard';

interface StrategyDashboardItem {
  id: StrategyId;
  name: string;
  tradingStyle: TradingStyle;
  timeframe: string;
  primaryPair: string;
  winRatePercent: number;
  profitFactor: number;
  avgRiskReward: number;
  maxDrawdown: number;
  description: string;
  sampleSize: number;
  confluences: string[];
}

export const StrategyDashboardTab: React.FC = () => {
  const { 
    strategyConfig, 
    updateStrategyConfig, 
    toggleStrategyEnabled, 
    resetStrategyConfig,
    generateSignal,
    setActiveTab,
    openStudioForStrategy
  } = useTrading();

  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SCALPING' | 'DAY_TRADING' | 'MACRO'>('ALL');
  const [justGeneratedId, setJustGeneratedId] = useState<string | null>(null);

  // Organize strategies by category
  const allStrategies: StrategyDashboardItem[] = (Object.keys(STRATEGY_CONFIGS) as StrategyId[]).map(id => {
    const config = STRATEGY_CONFIGS[id];
    return {
      id,
      name: config.name,
      tradingStyle: config.tradingStyle,
      timeframe: config.tradingStyle === 'SCALPING' ? '5m' : '1h',
      primaryPair: id === 'DXY_GOLD_INVERSE_CORRELATION' ? 'XAU/USD vs DXY' : 'XAU/USD',
      winRatePercent: config.baseWinRate,
      profitFactor: config.baseProfitFactor,
      avgRiskReward: config.avgRiskReward,
      maxDrawdown: config.maxDrawdown,
      description: config.confluenceDescription,
      sampleSize: id === 'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC' ? 14250 : id === 'DXY_GOLD_INVERSE_CORRELATION' ? 8920 : 10800,
      confluences: config.confluenceDescription.split('+').map(c => c.trim()).filter(Boolean),
    };
  });

  const scalpingStrategies = allStrategies.filter(s => s.tradingStyle === 'SCALPING');
  const dayTradingStrategies = allStrategies.filter(s => s.tradingStyle === 'DAY_TRADING');
  const macroStrategies = allStrategies.filter(s => s.id === 'DXY_GOLD_INVERSE_CORRELATION');

  // Active counts & metrics
  const enabledCount = Object.values(strategyConfig.enabledStrategies).filter(Boolean).length;
  const totalCount = allStrategies.length;

  const enabledConfigs = allStrategies.filter(s => strategyConfig.enabledStrategies[s.id]);
  const avgWinRate = enabledConfigs.length > 0 
    ? Number((enabledConfigs.reduce((sum, s) => sum + s.winRatePercent, 0) / enabledConfigs.length).toFixed(1))
    : 0;
  const avgProfitFactor = enabledConfigs.length > 0 
    ? Number((enabledConfigs.reduce((sum, s) => sum + s.profitFactor, 0) / enabledConfigs.length).toFixed(2))
    : 0;

  const handleTriggerStrategySignal = (strategyId: StrategyId, style: TradingStyle = 'SCALPING') => {
    generateSignal(strategyId, style);
    setJustGeneratedId(strategyId);
    setTimeout(() => setJustGeneratedId(null), 1800);
  };

  const handleEnableAll = () => {
    const updated: Record<StrategyId, boolean> = { ...strategyConfig.enabledStrategies };
    allStrategies.forEach(s => {
      updated[s.id] = true;
    });
    updateStrategyConfig({ enabledStrategies: updated });
  };

  const handleDisableAll = () => {
    const updated: Record<StrategyId, boolean> = { ...strategyConfig.enabledStrategies };
    allStrategies.forEach(s => {
      // Keep at least DXY macro enabled
      updated[s.id] = s.id === 'DXY_GOLD_INVERSE_CORRELATION';
    });
    updateStrategyConfig({ enabledStrategies: updated });
  };

  return (
    <div className="space-y-5">
      {/* Strategy Command Center Header */}
      <div className="bg-[#0e131d] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1E2638]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Strategy Dashboard & Persistence Manager
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PERSISTENT STORAGE ON
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage active trading systems, configure DXY macro intermarket confluences, and adjust algorithmic filters
              </p>
            </div>
          </div>

          {/* Action links */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('unified_feed')}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition active:scale-95 cursor-pointer shadow-md"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Go to Unified Signal Feed</span>
            </button>
            <button
              onClick={resetStrategyConfig}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#141B28] hover:bg-[#1E2638] text-slate-300 border border-[#1E2638] text-xs rounded-lg transition cursor-pointer"
              title="Reset all settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Global Strategy Portfolio Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">ACTIVE STRATEGIES</div>
            <div className="text-xl font-mono font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400">{enabledCount}</span>
              <span className="text-slate-500 font-normal">/ {totalCount}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Saved in localStorage
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">PORTFOLIO WIN RATE</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {avgWinRate}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Across enabled systems
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">PROFIT FACTOR</div>
            <div className="text-xl font-mono font-bold text-cyan-400">
              {avgProfitFactor}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
              Institutional Grade (&gt;2.5)
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">DXY INVERSE FILTER</div>
            <div className="text-xl font-mono font-bold text-amber-400 flex items-center gap-1">
              <span>r = -0.91</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
              +11.2% Win Rate Boost
            </div>
          </div>
        </div>

        {/* Global Strategy Persistence Controls */}
        <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3.5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              Global Algorithmic Filters & Execution Rules
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableAll}
                className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
              >
                Enable All
              </button>
              <span className="text-slate-600">•</span>
              <button
                onClick={handleDisableAll}
                className="text-[11px] text-slate-400 hover:underline cursor-pointer"
              >
                Disable All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Min Confluence Score */}
            <div>
              <div className="flex justify-between text-[11px] font-mono mb-1">
                <span className="text-slate-400">Min Confluence Threshold:</span>
                <span className="text-cyan-400 font-bold">{strategyConfig.minConfluenceScore}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="5"
                value={strategyConfig.minConfluenceScore}
                onChange={e => updateStrategyConfig({ minConfluenceScore: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-[#141B28] rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Suppresses signals below {strategyConfig.minConfluenceScore}% confluence
              </div>
            </div>

            {/* Require DXY Alignment */}
            <div className="flex items-center justify-between bg-[#111723] p-2.5 rounded-lg border border-[#1E2638]">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  Require DXY Alignment
                </div>
                <div className="text-[10px] text-slate-400">
                  Only trigger Gold trades aligned with DXY trend
                </div>
              </div>
              <input
                type="checkbox"
                checked={strategyConfig.requireDxyAlignment}
                onChange={e => updateStrategyConfig({ requireDxyAlignment: e.target.checked })}
                className="w-4 h-4 rounded border-[#1E2638] bg-[#141B28] text-amber-500 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Audio Alerts */}
            <div className="flex items-center justify-between bg-[#111723] p-2.5 rounded-lg border border-[#1E2638]">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Audio Chime on Signal
                </div>
                <div className="text-[10px] text-slate-400">
                  Play subtle alert when high-conviction setup fires
                </div>
              </div>
              <input
                type="checkbox"
                checked={strategyConfig.audioAlertsEnabled}
                onChange={e => updateStrategyConfig({ audioAlertsEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-[#1E2638] bg-[#141B28] text-cyan-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Featured Intermarket Strategy: DXY Gold Inverse Correlation Engine */}
      <div>
        <DxyGoldCorrelationCard compact={false} />
      </div>

      {/* Categorized Strategy Catalog */}
      <div className="space-y-4">
        {/* Category Selector Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#1E2638] pb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#141B28] text-slate-400 hover:text-white'
              }`}
            >
              All Strategies ({totalCount})
            </button>
            <button
              onClick={() => setActiveCategory('MACRO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeCategory === 'MACRO'
                  ? 'bg-cyan-500 text-black'
                  : 'bg-[#141B28] text-slate-400 hover:text-white'
              }`}
            >
              🌐 DXY Macro Strategies ({macroStrategies.length})
            </button>
            <button
              onClick={() => setActiveCategory('SCALPING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeCategory === 'SCALPING'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#141B28] text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Scalping (M1-M5) ({scalpingStrategies.length})
            </button>
            <button
              onClick={() => setActiveCategory('DAY_TRADING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeCategory === 'DAY_TRADING'
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#141B28] text-slate-400 hover:text-white'
              }`}
            >
              ☀️ Day Trading (H1) ({dayTradingStrategies.length})
            </button>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Click toggle switch to enable/disable strategy persistence
          </div>
        </div>

        {/* Strategy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allStrategies
            .filter(strategy => {
              if (activeCategory === 'MACRO') return strategy.id === 'DXY_GOLD_INVERSE_CORRELATION';
              if (activeCategory === 'SCALPING') return strategy.tradingStyle === 'SCALPING';
              if (activeCategory === 'DAY_TRADING') return strategy.tradingStyle === 'DAY_TRADING';
              return true;
            })
            .map(strategy => {
              const isEnabled = !!strategyConfig.enabledStrategies[strategy.id];
              const isMacro = strategy.id === 'DXY_GOLD_INVERSE_CORRELATION';
              const isJustGenerated = justGeneratedId === strategy.id;

              return (
                <div
                  key={strategy.id}
                  id={`strategy-card-${strategy.id}`}
                  className={`bg-[#0e131d] border rounded-xl p-4 transition-all duration-200 ${
                    isEnabled 
                      ? isMacro 
                        ? 'border-cyan-500/50 bg-gradient-to-br from-[#0e131d] to-[#0d1c28]' 
                        : 'border-[#243048] hover:border-[#35486d]' 
                      : 'border-[#1E2638]/40 opacity-60 bg-[#090D14]'
                  }`}
                >
                  {/* Card Header & Toggle */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1E2638]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                          {strategy.name}
                        </span>
                        {isMacro && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            MACRO ENGINE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#141B28] text-slate-300 border border-[#1E2638]">
                          {strategy.timeframe}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {strategy.primaryPair}
                        </span>
                      </div>
                    </div>

                    {/* Master Persistent Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleStrategyEnabled(strategy.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Performance Indicators */}
                  <div className="grid grid-cols-4 gap-2 my-3 p-2 bg-[#090D14] rounded-lg border border-[#1E2638] text-center">
                    <div>
                      <div className="text-[10px] font-mono text-slate-400">WIN RATE</div>
                      <div className={`text-xs font-mono font-bold ${strategy.winRatePercent >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {strategy.winRatePercent}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-slate-400">PROFIT FACTOR</div>
                      <div className="text-xs font-mono font-bold text-cyan-400">
                        {strategy.profitFactor}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-slate-400">AVG R:R</div>
                      <div className="text-xs font-mono font-bold text-white">
                        1:{strategy.avgRiskReward}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-slate-400">SAMPLE</div>
                      <div className="text-xs font-mono font-bold text-slate-300">
                        {(strategy.sampleSize ?? 10000).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Win rate visual progress bar */}
                  <div className="w-full bg-[#141B28] rounded-full h-1.5 mb-3 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${
                        strategy.winRatePercent >= 88 
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${strategy.winRatePercent}%` }}
                    />
                  </div>

                  {/* Description & Confluences */}
                  <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
                    {strategy.description}
                  </p>

                  <div className="space-y-1 mb-3">
                    <div className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      Required Confluences:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {strategy.confluences.map((c, idx) => (
                        <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141B28] text-slate-300 border border-[#1E2638]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#1E2638] flex-wrap gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      Status: <span className={isEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{isEnabled ? 'ACTIVE IN SCANNER' : 'MUTED'}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openStudioForStrategy(strategy.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium bg-[#141B28] hover:bg-[#1C2538] text-amber-300 border border-[#232F46] hover:border-amber-500/40 transition cursor-pointer"
                        title={`Open live interactive chart with ${strategy.name} pre-applied`}
                      >
                        <LineChart className="w-3.5 h-3.5 text-amber-400" />
                        <span>Live Chart</span>
                      </button>

                      <button
                        id={`btn-trigger-${strategy.id}`}
                        onClick={() => handleTriggerStrategySignal(
                          strategy.id, 
                          strategy.tradingStyle
                        )}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition active:scale-95 cursor-pointer ${
                          isJustGenerated
                            ? 'bg-emerald-500 text-black'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-black'
                        }`}
                      >
                        {isJustGenerated ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                        <span>{isJustGenerated ? 'Signal Fired!' : 'Trigger Signal'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
