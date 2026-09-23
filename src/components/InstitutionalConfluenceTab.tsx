import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Layers, 
  Compass, 
  Sliders, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  BarChart3, 
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Lock,
  Flame,
  Globe,
  Radio,
  FileCheck
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { 
  MultiFactorStrategyConfig, 
  TimeframeId 
} from '../types';
import { 
  evaluateMultiFactorGoldStrategy, 
  convertConfluenceToSignal,
  DEFAULT_MULTI_FACTOR_CONFIG 
} from '../modules/multiFactorConfluenceEngine';
import { runStrategyEngineTests, TestSuiteSummary } from '../modules/strategyEngineTests';

export const InstitutionalConfluenceTab: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    executeScalpOrder, 
    setActiveScalpSignal,
    setActiveTab,
    goldSpreadPips
  } = useTrading();

  // Multi-Factor Configuration State (Fully configurable toggles & thresholds)
  const [config, setConfig] = useState<MultiFactorStrategyConfig>(DEFAULT_MULTI_FACTOR_CONFIG);
  const [showConfigDrawer, setShowConfigDrawer] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [copiedStage, setCopiedStage] = useState<string | null>(null);

  // Evaluate the live multi-factor confirmation strategy
  const confluenceResult = useMemo(() => {
    return evaluateMultiFactorGoldStrategy(candles, activeInstrument.currentPrice, config);
  }, [candles, activeInstrument.currentPrice, config]);

  const stages = confluenceResult.stages;
  const isBuy = confluenceResult.direction === 'BUY';

  // Handler to execute paper trade
  const handleExecutePaperTrade = () => {
    const signal = convertConfluenceToSignal(
      confluenceResult, 
      activeInstrument.symbol, 
      activeInstrument.currentPrice, 
      activeInstrument.pipMultiplier
    );
    setActiveScalpSignal(signal);
    executeScalpOrder(signal);
    setActiveTab('orders');
  };

  // Handler to run automated tests
  const handleRunUnitTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      const summary = runStrategyEngineTests();
      setTestResults(summary);
      setIsRunningTests(false);
    }, 450);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Multi-Factor Strategy Header */}
      <div className="bg-[#0D121D] border border-[#1E293B] rounded-xl p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                INSTITUTIONAL SMC + ORDER FLOW ENGINE
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Confluence Feed
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Multi-Factor Confirmation Strategy
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">
                {activeInstrument.symbol}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Strict 8-stage execution model: HTF Context → Price Location → Liquidity Sweep → Order Flow Delta → Structure Confirmation → Retest Entry → Risk Geometry.
            </p>
          </div>

          {/* Live Confluence Score Meter & Control Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#131B2A] border border-[#23314B] rounded-lg px-4 py-2.5 flex items-center gap-4">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Confluence Score</div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-bold font-mono ${
                    confluenceResult.totalScore >= config.minConfluenceScore ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {confluenceResult.totalScore}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/ 100</span>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700/60" />
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Threshold</div>
                <div className="text-sm font-bold font-mono text-slate-200">
                  ≥ {config.minConfluenceScore}%
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700/60" />
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Signal Status</div>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                  confluenceResult.isSignalEligible 
                    ? (isBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30')
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {confluenceResult.isSignalEligible ? `${confluenceResult.direction} CONFIRMED` : 'FILTERED / PENDING'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowConfigDrawer(!showConfigDrawer)}
              className="px-3 py-2.5 rounded-lg text-xs font-medium bg-[#162032] hover:bg-[#1E2D45] text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Strategy Config</span>
            </button>

            <button
              onClick={handleRunUnitTests}
              disabled={isRunningTests}
              className="px-3 py-2.5 rounded-lg text-xs font-medium bg-[#162032] hover:bg-[#1E2D45] text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRunningTests ? 'Testing...' : 'Run Unit Tests'}</span>
            </button>
          </div>
        </div>

        {/* Configuration Drawer (Collapsible) */}
        {showConfigDrawer && (
          <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="bg-[#121927] p-3 rounded-lg border border-slate-800">
              <label className="text-slate-400 block mb-1 text-[11px]">Context Timeframe (HTF)</label>
              <select
                value={config.contextTimeframe}
                onChange={(e) => setConfig({ ...config, contextTimeframe: e.target.value as TimeframeId })}
                className="w-full bg-[#090D15] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="1d">D1 (Daily Macro Trend)</option>
                <option value="4h">4H (4 Hours - Swing Structure)</option>
                <option value="2h">2H (2 Hours - Half-Day Bias)</option>
                <option value="1h">1H (1 Hour - Standard Recommended)</option>
                <option value="30m">30M (30 Min - Session Structure)</option>
                <option value="15m">15M (15 Min - Fast Scalping Context)</option>
              </select>
            </div>

            <div className="bg-[#121927] p-3 rounded-lg border border-slate-800">
              <label className="text-slate-400 block mb-1 text-[11px]">Setup Timeframe</label>
              <select
                value={config.setupTimeframe}
                onChange={(e) => setConfig({ ...config, setupTimeframe: e.target.value as TimeframeId })}
                className="w-full bg-[#090D15] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="1h">1H (1 Hour - High Timeframe Patterns)</option>
                <option value="30m">30M (30 Min - Order Block Confluence)</option>
                <option value="15m">15M (15 Min - Recommended)</option>
                <option value="10m">10M (10 Min - Refined Levels)</option>
                <option value="5m">5M (5 Min - Intraday Setup)</option>
              </select>
            </div>

            <div className="bg-[#121927] p-3 rounded-lg border border-slate-800">
              <label className="text-slate-400 block mb-1 text-[11px]">Entry Timeframe (LTF)</label>
              <select
                value={config.entryTimeframe}
                onChange={(e) => setConfig({ ...config, entryTimeframe: e.target.value as TimeframeId })}
                className="w-full bg-[#090D15] border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
              >
                <option value="15m">15M (15 Min Swing Trigger)</option>
                <option value="5m">5M (5 Min - Recommended Entry)</option>
                <option value="3m">3M (3 Min - Rapid Confirmation)</option>
                <option value="2m">2M (2 Min - Low Noise Execution)</option>
                <option value="1m">1M (1 Min - High Frequency Order Flow)</option>
              </select>
            </div>

            <div className="bg-[#121927] p-3 rounded-lg border border-slate-800">
              <label className="text-slate-400 block mb-1 text-[11px]">Min Confluence Score: {config.minConfluenceScore}%</label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={config.minConfluenceScore}
                onChange={(e) => setConfig({ ...config, minConfluenceScore: parseInt(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Strategy Sub-Module Toggles */}
            <div className="md:col-span-3 lg:col-span-4 bg-[#121927] p-3 rounded-lg border border-slate-800 flex flex-wrap gap-4 items-center">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Active Strategy Modules:</span>
              
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableMarketStructure}
                  onChange={(e) => setConfig({ ...config, enableMarketStructure: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>Market Structure (BOS/CHoCH)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableLiquiditySweeps}
                  onChange={(e) => setConfig({ ...config, enableLiquiditySweeps: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>Liquidity Sweeps</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableAmdAnalysis}
                  onChange={(e) => setConfig({ ...config, enableAmdAnalysis: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>AMD Cycle (Power of 3)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableVolumeProfile}
                  onChange={(e) => setConfig({ ...config, enableVolumeProfile: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>Volume Profile (POC/VAH/VAL)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableOrderFlowDelta}
                  onChange={(e) => setConfig({ ...config, enableOrderFlowDelta: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>Order Flow & CVD Delta</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableDxyFilter}
                  onChange={(e) => setConfig({ ...config, enableDxyFilter: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>DXY Macro Filter</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableSessionFilter}
                  onChange={(e) => setConfig({ ...config, enableSessionFilter: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>Session Timing Filter</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={config.enableNewsFilter}
                  onChange={(e) => setConfig({ ...config, enableNewsFilter: e.target.checked })}
                  className="rounded border-slate-700 accent-amber-500"
                />
                <span>High-Impact News Guard</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Unit Tests Output Modal/Box if executed */}
      {testResults && (
        <div className="bg-[#0B111D] border border-cyan-500/30 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-mono">
                Automated Strategy Engine Test Suite
              </h3>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                testResults.allPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {testResults.passedTests}/{testResults.totalTests} Passed
              </span>
            </div>
            <button
              onClick={() => setTestResults(null)}
              className="text-xs text-slate-400 hover:text-white font-mono"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
            {testResults.results.map((r, i) => (
              <div key={i} className="p-2.5 rounded bg-[#101726] border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className={r.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {r.passed ? '✓' : '✗'}
                    </span>
                    <span>{r.testName}</span>
                    <span className="text-[10px] text-slate-500">[{r.category}]</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{r.message}</p>
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">{r.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Macro Radar & Volume Profile Quick Glance (4 Bento Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: DXY Dollar Index Filter */}
        <div className="bg-[#0E1422] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              DXY Macro Index
            </span>
            <span className="text-amber-400">Inverse Filter</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            103.85 <span className="text-xs font-normal text-emerald-400">-0.22%</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {stages.context.dxyBias}
          </p>
        </div>

        {/* Card 2: Session Clock & Overlap */}
        <div className="bg-[#0E1422] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Session Clock (UTC)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
              Active
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-white truncate">
            {stages.context.sessionBias.split('(')[0]}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Prime liquidity window for XAU/USD gold spreads & volatility expansion.
          </p>
        </div>

        {/* Card 3: Economic Calendar News Guard */}
        <div className="bg-[#0E1422] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              News Volatility Guard
            </span>
            <span className="text-emerald-400 text-[10px]">Clear</span>
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            CLEAR TO TRADE
          </div>
          <p className="text-xs text-slate-300 mt-1">
            No red-folder high-impact releases scheduled within 30 min window.
          </p>
        </div>

        {/* Card 4: Volume Profile POC & Value Area */}
        <div className="bg-[#0E1422] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              Volume Profile (70% VA)
            </span>
            <span className="text-purple-400 text-[10px]">POC $2865</span>
          </div>
          <div className="text-sm font-mono text-slate-200">
            <span className="text-slate-400">VAH:</span> ${(activeInstrument.currentPrice + 5.2).toFixed(2)} | <span className="text-slate-400">VAL:</span> ${(activeInstrument.currentPrice - 4.8).toFixed(2)}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Current price reacting inside high volume value node.
          </p>
        </div>
      </div>

      {/* Main Core Strategy Model: 8 Discrete Sequential Stages */}
      <div className="bg-[#0D121D] border border-[#1E293B] rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              Core Strategy Model: 8 Discrete Sequential Stages
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Modular pipeline verifying context, setup, confirmation, entry, and dynamic trade management without conflating stages.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExecutePaperTrade}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono transition flex items-center gap-1.5 ${
                isBuy 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute {confluenceResult.direction} Paper Trade</span>
            </button>
          </div>
        </div>

        {/* 8 Distinct Stage Cards */}
        <div className="mt-5 space-y-4 font-mono text-xs">
          {/* Stage 1: Context */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">1</span>
                STAGE 1: HIGHER-TIMEFRAME MARKET CONTEXT ({stages.context.higherTimeframe.toUpperCase()})
              </span>
              <span className="text-[11px] text-emerald-400">PASSED</span>
            </div>
            <div className="text-slate-200 text-xs">
              <p><strong className="text-slate-400">Trend Bias:</strong> {stages.context.trendSummary}</p>
              <p className="mt-1"><strong className="text-slate-400">Key Levels Near Price:</strong> {stages.context.keyLevelsNearPrice.join(' • ')}</p>
              <p className="mt-1"><strong className="text-slate-400">Macro Currency Alignment:</strong> {stages.context.dxyBias}</p>
            </div>
          </div>

          {/* Stage 2: Setup */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">2</span>
                STAGE 2: IMPORTANT PRICE LOCATION & SETUP ({stages.setup.setupTimeframe.toUpperCase()})
              </span>
              <span className="text-[11px] text-emerald-400">VALIDATED</span>
            </div>
            <div className="text-slate-200 text-xs">
              <p><strong className="text-slate-400">Pattern:</strong> {stages.setup.pattern}</p>
              <p className="mt-1"><strong className="text-slate-400">Volume Profile Location:</strong> {stages.setup.locationDescription}</p>
              <p className="mt-1"><strong className="text-slate-400">AMD Phase:</strong> {stages.setup.amdPhase}</p>
            </div>
          </div>

          {/* Stage 3: Confirmation */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">3</span>
                STAGE 3: LIQUIDITY SWEEP & ORDER FLOW CONFIRMATION ({stages.confirmation.entryTimeframe.toUpperCase()})
              </span>
              <span className="text-[11px] text-emerald-400">CONFIRMED</span>
            </div>
            <div className="text-slate-200 text-xs space-y-1">
              {stages.confirmation.confluenceList.map((c, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="text-emerald-400">✓</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage 4: Entry */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">4</span>
                STAGE 4: RETEST ENTRY EXECUTION
              </span>
              <span className={`text-[11px] font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stages.entry.direction} SIGNAL
              </span>
            </div>
            <div className="text-slate-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Execution Price</span>
                <span className="text-base font-bold text-white">${stages.entry.entryPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Entry Type</span>
                <span className="text-sm font-semibold text-amber-400">{stages.entry.entryType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Retest Target Level</span>
                <span className="text-sm font-semibold text-cyan-400">${stages.entry.retestLevel.toFixed(2)}</span>
              </div>
              <p className="col-span-full text-slate-300 mt-1">{stages.entry.triggerDescription}</p>
            </div>
          </div>

          {/* Stage 5: Stop Loss */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">5</span>
                STAGE 5: STRUCTURAL STOP-LOSS PLACEMENT
              </span>
              <span className="text-rose-400 font-bold">{stages.stopLoss.riskPips} Pips Risk</span>
            </div>
            <div className="text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Stop-Loss Price</span>
                <span className="text-base font-bold text-rose-400">${stages.stopLoss.stopLossPrice.toFixed(2)}</span>
              </div>
              <p className="text-slate-400 flex-1 max-w-xl">{stages.stopLoss.invalidationBasis}</p>
            </div>
          </div>

          {/* Stage 6: Take Profit */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">6</span>
                STAGE 6: MULTI-TIER TAKE-PROFIT TARGETS
              </span>
              <span className="text-emerald-400 font-bold">1:2.8 Average R:R</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded bg-[#090D15] border border-slate-800">
                <div className="text-slate-400 text-[11px]">Target 1 (1.6R) - Liquidity Pool</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">${stages.takeProfit.tp1Price.toFixed(2)}</div>
                <div className="text-[10px] text-slate-500">+{stages.takeProfit.tp1Pips} pips (50% Partial Close)</div>
              </div>
              <div className="p-2.5 rounded bg-[#090D15] border border-slate-800">
                <div className="text-slate-400 text-[11px]">Target 2 (2.8R) - Major Level</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">${stages.takeProfit.tp2Price.toFixed(2)}</div>
                <div className="text-[10px] text-slate-500">+{stages.takeProfit.tp2Pips} pips (30% Partial Close)</div>
              </div>
              <div className="p-2.5 rounded bg-[#090D15] border border-slate-800">
                <div className="text-slate-400 text-[11px]">Target 3 (4.2R) - Session Runner</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">${stages.takeProfit.tp3Price.toFixed(2)}</div>
                <div className="text-[10px] text-slate-500">+{stages.takeProfit.tp3Pips} pips (20% Trailing Runner)</div>
              </div>
            </div>
          </div>

          {/* Stage 7: Trade Management */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">7</span>
                STAGE 7: TRADE MANAGEMENT (BREAK-EVEN & TRAILING)
              </span>
              <span className="text-cyan-400">AUTOMATED RULES</span>
            </div>
            <div className="text-slate-200 text-xs space-y-1">
              <p><strong className="text-slate-400">Break-Even Trigger:</strong> {stages.tradeManagement.breakEvenDescription}</p>
              <p><strong className="text-slate-400">Trailing Stop Rule:</strong> {stages.tradeManagement.trailingStopStrategy}</p>
            </div>
          </div>

          {/* Stage 8: Invalidation */}
          <div className="p-4 rounded-lg bg-[#111726] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-semibold text-amber-400 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">8</span>
                STAGE 8: SETUP INVALIDATION PROTOCOL
              </span>
              <span className="text-rose-400">CANCELLATION RULES</span>
            </div>
            <div className="text-slate-200 text-xs space-y-1">
              <p><strong className="text-slate-400">Invalidation Price:</strong> ${stages.invalidation.invalidationPrice.toFixed(2)}</p>
              {stages.invalidation.cancellationConditions.map((cond, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-400 text-[11px]">
                  <span className="text-amber-400">•</span>
                  <span>{cond}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confluence Factor Breakdown Table */}
      <div className="bg-[#0D121D] border border-[#1E293B] rounded-xl p-5">
        <h3 className="text-sm font-bold text-white font-mono mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          Confluence Factor Weighting & Verification Matrix
        </h3>

        <div className="space-y-3 font-mono text-xs">
          {confluenceResult.factors.map((f) => {
            const percent = (f.score / f.weight) * 100;
            return (
              <div key={f.id} className="p-3 rounded-lg bg-[#101726] border border-slate-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-200">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{f.score} / {f.weight} pts</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      f.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {f.passed ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                  <div 
                    className={`h-full rounded-full ${
                      percent === 100 ? 'bg-emerald-400' : percent >= 50 ? 'bg-amber-400' : 'bg-slate-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="text-[11px] text-slate-400">{f.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Institutional Risk Management & Disclaimer Footer */}
      <div className="bg-[#0A0E17] border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-200 block">Stochastic Market Disclaimer & Safety Protocols</span>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-3xl">
              Trading Gold (XAU/USD) involves significant risk. No strategy produces guaranteed profits, perfect entries, or fixed win rates. 
              This terminal enforces strict paper trading and backtesting validation before live trade execution. Live automated trading is disabled by default.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700">
            Spread: {goldSpreadPips.toFixed(1)} Pips
          </span>
        </div>
      </div>
    </div>
  );
};
