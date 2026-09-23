import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Filter, 
  RotateCcw, 
  Copy, 
  Check, 
  ExternalLink, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal, 
  ShieldCheck, 
  Radio, 
  Activity, 
  Volume2, 
  VolumeX, 
  Trash2,
  Compass,
  TrendingUp,
  Clock,
  Sparkles,
  Globe
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { ScalpSignal, TradingStyle } from '../types';
import { DxyGoldCorrelationCard } from './DxyGoldCorrelationCard';
import { TradingSessionHeaderCard } from './TradingSessionHeaderCard';
import { getSignalSessionContext, TradingSessionId } from '../utils/sessionManager';

export const UnifiedSignalFeedTab: React.FC = () => {
  const { 
    scalpSignals, 
    activeScalpSignal, 
    setActiveScalpSignal, 
    executeScalpOrder, 
    isGeneratingSignal, 
    generateSignal,
    batchScanMarketSignals,
    clearSignalHistory,
    strategyConfig,
    updateStrategyConfig,
    setActiveSymbol,
    setActiveTab,
    dxyMacroDetails,
    currentSession
  } = useTrading();

  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [filterStyle, setFilterStyle] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [filterMinWinRate, setFilterMinWinRate] = useState<number>(75);
  const [filterOnlyDxyAligned, setFilterOnlyDxyAligned] = useState<boolean>(false);
  const [filterSession, setFilterSession] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lotSizes, setLotSizes] = useState<Record<string, number>>({});
  const [showDxyHeader, setShowDxyHeader] = useState<boolean>(true);

  // Filter signals
  const filteredSignals = useMemo(() => {
    return scalpSignals.filter(signal => {
      if (filterSymbol !== 'ALL' && signal.symbol !== filterSymbol) return false;
      if (filterStyle !== 'ALL') {
        if (filterStyle === 'DXY_MACRO' && signal.strategyId !== 'DXY_GOLD_INVERSE_CORRELATION') return false;
        if (filterStyle === 'SCALPING' && signal.tradingStyle !== 'SCALPING') return false;
        if (filterStyle === 'DAY_TRADING' && signal.tradingStyle !== 'DAY_TRADING') return false;
      }
      if (filterDirection !== 'ALL' && signal.direction !== filterDirection) return false;
      if (signal.backtest.winRate < filterMinWinRate) return false;
      if (filterOnlyDxyAligned && signal.dxyCorrelation?.alignment === 'CONFLICT_WARNING') return false;
      
      // Dynamic Trading Session Filter
      if (filterSession !== 'ALL') {
        const sCtx = getSignalSessionContext(signal, currentSession.primaryActiveSessionId);
        if (filterSession === 'ACTIVE_ONLY' && !sCtx.isCurrentSessionMatch) return false;
        if (filterSession === 'ASIAN' && sCtx.sessionId !== 'ASIAN') return false;
        if (filterSession === 'LONDON' && sCtx.sessionId !== 'LONDON') return false;
        if (filterSession === 'NEW_YORK' && sCtx.sessionId !== 'NEW_YORK') return false;
        if (filterSession === 'LONDON_NY_OVERLAP' && sCtx.sessionId !== 'LONDON_NY_OVERLAP') return false;
      }

      return true;
    });
  }, [scalpSignals, filterSymbol, filterStyle, filterDirection, filterMinWinRate, filterOnlyDxyAligned, filterSession, currentSession.primaryActiveSessionId]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (scalpSignals.length === 0) {
      return { count: 0, avgWinRate: 0, avgRR: 0, dxyAlignedCount: 0, activeSessionCount: 0 };
    }
    const totalWR = scalpSignals.reduce((sum, s) => sum + s.backtest.winRate, 0);
    const totalRR = scalpSignals.reduce((sum, s) => sum + s.riskReward, 0);
    const dxyAligned = scalpSignals.filter(s => s.dxyCorrelation && s.dxyCorrelation.alignment.includes('ALIGNED')).length;
    const activeSessionMatches = scalpSignals.filter(s => {
      const sCtx = getSignalSessionContext(s, currentSession.primaryActiveSessionId);
      return sCtx.isCurrentSessionMatch;
    }).length;

    return {
      count: scalpSignals.length,
      avgWinRate: Number((totalWR / scalpSignals.length).toFixed(1)),
      avgRR: Number((totalRR / scalpSignals.length).toFixed(1)),
      dxyAlignedCount: dxyAligned,
      activeSessionCount: activeSessionMatches,
    };
  }, [scalpSignals, currentSession.primaryActiveSessionId]);

  const handleCopySignal = (signal: ScalpSignal) => {
    const text = `🎯 [${signal.tradingStyle}] ${signal.symbol} ${signal.direction}
Strategy: ${signal.strategyName}
Win Rate: ${signal.backtest.winRate}% | R:R: 1:${signal.riskReward}
Timeframe: ${signal.timeframe}
Entry: ${signal.entryPrice}
Stop Loss: ${signal.stopLoss} (${signal.riskPips} pips)
TP1: ${signal.takeProfit1} (+${signal.tp1Pips} pips)
TP2: ${signal.takeProfit2} (+${signal.tp2Pips} pips)
TP3: ${signal.takeProfit3} (+${signal.tp3Pips} pips)
${signal.dxyCorrelation ? `DXY Correlation: r = ${signal.dxyCorrelation.correlationCoefficient} (${signal.dxyCorrelation.alignment})` : ''}
Key Confluences:
${signal.confluences.slice(0, 3).map(c => `• ${c}`).join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopiedId(signal.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getLotSize = (signalId: string) => {
    return lotSizes[signalId] !== undefined ? lotSizes[signalId] : strategyConfig.preferredLotSize;
  };

  const setLotSize = (signalId: string, size: number) => {
    setLotSizes(prev => ({ ...prev, [signalId]: size }));
  };

  const handleExecuteOrder = (signal: ScalpSignal) => {
    const customLot = getLotSize(signal.id);
    executeScalpOrder(signal, customLot);
  };

  const handleViewOnChart = (signal: ScalpSignal) => {
    setActiveSymbol(signal.symbol);
    setActiveScalpSignal(signal);
    setActiveTab('chart');
  };

  return (
    <div className="space-y-4">
      {/* Real-time Institutional Market Session Banner */}
      <TradingSessionHeaderCard 
        compact={false} 
        onFilterBySession={(sid) => setFilterSession(sid)} 
        selectedSessionFilter={filterSession} 
      />

      {/* Top Banner: DXY Correlation Overview */}
      {showDxyHeader && (
        <div className="relative">
          <DxyGoldCorrelationCard compact={false} />
          <button
            onClick={() => setShowDxyHeader(false)}
            className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 text-xs px-2 py-0.5 rounded bg-black/40 border border-slate-800 cursor-pointer"
          >
            Hide Card
          </button>
        </div>
      )}

      {/* Unified Signal Feed Header & Metrics */}
      <div className="bg-[#0e131d] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1E2638]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Unified Signal Feed (Institutional Multi-Strategy)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  LIVE STREAM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Aggregated signals across Scalping, Day Trading, and DXY Inverse Macro Correlation strategies
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="btn-scan-all-markets"
              onClick={batchScanMarketSignals}
              disabled={isGeneratingSignal}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs rounded-lg transition shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingSignal ? 'animate-spin' : ''}`} />
              <span>{isGeneratingSignal ? 'Scanning Watchlists...' : 'Batch Scan All Markets'}</span>
            </button>

            <button
              onClick={() => updateStrategyConfig({ audioAlertsEnabled: !strategyConfig.audioAlertsEnabled })}
              className={`p-2 rounded-lg border transition text-xs flex items-center gap-1.5 cursor-pointer ${
                strategyConfig.audioAlertsEnabled 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' 
                  : 'bg-[#141B28] border-[#1E2638] text-slate-400'
              }`}
              title="Toggle Audio Notifications"
            >
              {strategyConfig.audioAlertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={clearSignalHistory}
              className="p-2 rounded-lg border border-[#1E2638] bg-[#141B28] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-400 transition text-xs cursor-pointer"
              title="Clear Signal History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Summary Metrics Strip - 5 Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 my-4">
          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">TOTAL SIGNALS</div>
            <div className="text-xl font-mono font-bold text-white flex items-center gap-2">
              <span>{stats.count}</span>
              <span className="text-[10px] text-slate-500 font-normal">Active & Saved</span>
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">ACTIVE SESSION MATCH</div>
            <div className="text-xl font-mono font-bold text-amber-400 flex items-center gap-1.5">
              <span>{stats.activeSessionCount} / {stats.count}</span>
              <span className="text-[10px] font-mono text-amber-300/80">({currentSession.primaryActiveShort})</span>
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">AVG WIN RATE</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {stats.avgWinRate}%
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3">
            <div className="text-[11px] font-mono text-slate-400 mb-1">AVG RISK : REWARD</div>
            <div className="text-xl font-mono font-bold text-cyan-400">
              1 : {stats.avgRR}
            </div>
          </div>

          <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-mono text-slate-400 mb-1">DXY ALIGNED RATIO</div>
            <div className="text-xl font-mono font-bold text-amber-400 flex items-center gap-1.5">
              <span>{stats.dxyAlignedCount} / {stats.count}</span>
              <span className="text-[10px] font-mono text-emerald-400">(+11% WR)</span>
            </div>
          </div>
        </div>

        {/* Interactive Filter Control Bar */}
        <div className="bg-[#090D14] border border-[#1E2638] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-slate-400 mr-1 font-mono">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span>FILTERS:</span>
            </div>

            {/* Quick Filter: Active Session Only */}
            <button
              type="button"
              onClick={() => setFilterSession(prev => prev === 'ACTIVE_ONLY' ? 'ALL' : 'ACTIVE_ONLY')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                filterSession === 'ACTIVE_ONLY'
                  ? 'bg-amber-500 text-black font-bold shadow-sm shadow-amber-500/20'
                  : 'bg-[#141B28] text-amber-300 border border-amber-500/30 hover:bg-amber-500/10'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Active Session Only ({currentSession.primaryActiveShort})</span>
              {filterSession === 'ACTIVE_ONLY' && <Check className="w-3.5 h-3.5" />}
            </button>

            {/* Session Dropdown Filter */}
            <select
              value={filterSession}
              onChange={e => setFilterSession(e.target.value)}
              className="bg-[#141B28] border border-[#1E2638] text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="ALL">All Sessions</option>
              <option value="ACTIVE_ONLY">⚡ Active Session ({currentSession.primaryActiveShort})</option>
              <option value="ASIAN">🌏 Asia Session (00:00-08:00 UTC)</option>
              <option value="LONDON">🇬🇧 London Session (07:00-15:30 UTC)</option>
              <option value="NEW_YORK">🇺🇸 New York Session (12:30-21:00 UTC)</option>
              <option value="LONDON_NY_OVERLAP">⚡ London/NY Overlap (12:30-15:30 UTC)</option>
            </select>

            {/* Symbol Filter */}
            <select
              value={filterSymbol}
              onChange={e => setFilterSymbol(e.target.value)}
              className="bg-[#141B28] border border-[#1E2638] text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value="XAU/USD">Gold (XAU/USD)</option>
            </select>

            {/* Strategy Style Filter */}
            <select
              value={filterStyle}
              onChange={e => setFilterStyle(e.target.value)}
              className="bg-[#141B28] border border-[#1E2638] text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Strategies</option>
              <option value="DXY_MACRO">🌐 DXY Macro Inverse Correlation</option>
              <option value="SCALPING">⚡ Scalping (M5)</option>
              <option value="DAY_TRADING">☀️ Day Trading (H1)</option>
            </select>

            {/* Direction Filter */}
            <select
              value={filterDirection}
              onChange={e => setFilterDirection(e.target.value)}
              className="bg-[#141B28] border border-[#1E2638] text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Directions</option>
              <option value="BUY">🟢 BUY (Long)</option>
              <option value="SELL">🔴 SELL (Short)</option>
            </select>

            {/* Min Win Rate filter */}
            <select
              value={filterMinWinRate}
              onChange={e => setFilterMinWinRate(Number(e.target.value))}
              className="bg-[#141B28] border border-[#1E2638] text-slate-200 text-xs rounded-md px-2 py-1 focus:outline-none focus:border-amber-500"
            >
              <option value={75}>Min Win Rate: 75%+</option>
              <option value={80}>Min Win Rate: 80%+</option>
              <option value={85}>Min Win Rate: 85%+</option>
            </select>

            {/* DXY Alignment Only Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 ml-1">
              <input
                type="checkbox"
                checked={filterOnlyDxyAligned}
                onChange={e => setFilterOnlyDxyAligned(e.target.checked)}
                className="rounded border-[#1E2638] bg-[#141B28] text-amber-500 focus:ring-0"
              />
              <span className="text-[11px] font-mono">DXY Aligned Only</span>
            </label>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Showing <span className="text-white font-bold">{filteredSignals.length}</span> of {scalpSignals.length} signals
          </div>
        </div>
      </div>

      {/* Signal Feed Stream */}
      {filteredSignals.length === 0 ? (
        <div className="bg-[#0e131d] border border-[#1E2638] rounded-xl p-8 text-center">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Signals Match Filter Criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Try lowering the minimum win rate filter, selecting "All Symbols", or trigger a fresh institutional market scan.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setFilterSymbol('ALL');
                setFilterStyle('ALL');
                setFilterDirection('ALL');
                setFilterMinWinRate(75);
                setFilterOnlyDxyAligned(false);
              }}
              className="px-3.5 py-1.5 bg-[#141B28] border border-[#1E2638] hover:border-slate-600 text-slate-300 rounded-lg text-xs"
            >
              Reset Filters
            </button>
            <button
              onClick={batchScanMarketSignals}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs"
            >
              Batch Scan Markets Now
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSignals.map((signal, idx) => {
            const isBuy = signal.direction === 'BUY';
            const isDxyStrategy = signal.strategyId === 'DXY_GOLD_INVERSE_CORRELATION';
            const currentLot = getLotSize(signal.id);
            const isCopied = copiedId === signal.id;
            const sessionCtx = getSignalSessionContext(signal, currentSession.primaryActiveSessionId);

            return (
              <div 
                key={`${signal.id}-${idx}`}
                id={`signal-card-${signal.id}`}
                className={`border rounded-xl p-4 transition shadow-md ${
                  sessionCtx.isCurrentSessionMatch
                    ? 'border-amber-500/60 bg-gradient-to-br from-[#121927] via-[#0e131d] to-[#0e131d] shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20'
                    : isDxyStrategy 
                    ? 'border-cyan-500/40 bg-gradient-to-br from-[#0e131d] to-[#0d1825]' 
                    : 'bg-[#0e131d] border-[#1E2638] hover:border-[#2C3854]'
                }`}
              >
                {/* Signal Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E2638]/70">
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Direction Badge */}
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-bold text-xs ${
                      isBuy 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {isBuy ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>{signal.direction}</span>
                    </div>

                    {/* Symbol */}
                    <span className="font-bold text-white text-sm font-mono tracking-wide">
                      {signal.symbol}
                    </span>

                    {/* Trading Style & Timeframe */}
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#141B28] text-slate-300 border border-[#1E2638]">
                      {signal.tradingStyle === 'SCALPING' ? '⚡ SCALPING (M5)' : '☀️ DAY TRADING (H1)'}
                    </span>

                    {/* Session Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border ${sessionCtx.badgeClass}`}>
                      <span>{sessionCtx.flag}</span>
                      <span>{sessionCtx.shortName}</span>
                    </span>

                    {/* Active Session Highlight Badge */}
                    {sessionCtx.isCurrentSessionMatch && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-sm shadow-amber-500/20 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>ACTIVE SESSION MATCH</span>
                      </span>
                    )}

                    {/* DXY Badge if applicable */}
                    {signal.dxyCorrelation && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                        <Compass className="w-3 h-3" />
                        <span>DXY r = {signal.dxyCorrelation.correlationCoefficient}</span>
                        <span className="text-emerald-400">+{signal.dxyCorrelation.winRateBoostPercent}% WR</span>
                      </span>
                    )}
                  </div>

                  {/* Right side badges & timestamp */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {signal.backtest.winRate}% WIN RATE
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        PF: {signal.backtest.profitFactor} • 1:{signal.riskReward} R:R
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(signal.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Strategy Title & Confluences */}
                <div className="my-3">
                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
                    <span className="text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {signal.strategyName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Sample Size: {(signal.backtest?.totalSampleTrades ?? (signal.backtest as any)?.totalTrades ?? 1000).toLocaleString()} trades
                    </span>
                  </div>

                  {/* Confluences list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                    {/* Session specific confluence */}
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-[#090D14] px-2.5 py-1 rounded border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate">{sessionCtx.flag} {sessionCtx.strategyConfluence}</span>
                    </div>

                    {signal.confluences.slice(0, 3).map((confluence, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-[#090D14] px-2.5 py-1 rounded border border-[#1E2638]">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        <span className="truncate">{confluence}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Levels Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-3 p-2.5 bg-[#090D14] rounded-lg border border-[#1E2638]">
                  <div>
                    <div className="text-[10px] font-mono text-slate-400">ENTRY PRICE</div>
                    <div className="text-xs font-mono font-bold text-white">
                      {signal.entryPrice}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-red-400">STOP LOSS</div>
                    <div className="text-xs font-mono font-bold text-red-400">
                      {signal.stopLoss} <span className="text-[10px] font-normal">(-{signal.riskPips}p)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-emerald-400">TP1 (CONSERVATIVE)</div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {signal.takeProfit1} <span className="text-[10px] font-normal">(+{signal.tp1Pips}p)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-emerald-300">TP2 (TARGET)</div>
                    <div className="text-xs font-mono font-bold text-emerald-300">
                      {signal.takeProfit2} <span className="text-[10px] font-normal">(+{signal.tp2Pips}p)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-mono text-amber-300">TP3 (RUNNER)</div>
                    <div className="text-xs font-mono font-bold text-amber-300">
                      {signal.takeProfit3} <span className="text-[10px] font-normal">(+{signal.tp3Pips}p)</span>
                    </div>
                  </div>
                </div>

                {/* Execution Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1E2638]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">Lot:</span>
                    <input
                      type="number"
                      min="0.01"
                      max="50"
                      step="0.1"
                      value={currentLot}
                      onChange={e => setLotSize(signal.id, parseFloat(e.target.value) || 0.1)}
                      className="w-16 bg-[#141B28] border border-[#1E2638] text-white font-mono text-xs rounded px-2 py-1 text-center"
                    />
                    <button
                      id={`btn-execute-${signal.id}`}
                      onClick={() => handleExecuteOrder(signal)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition active:scale-95 cursor-pointer ${
                        isBuy
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                          : 'bg-red-500 hover:bg-red-400 text-white'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Execute Paper {signal.direction}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySignal(signal)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#141B28] hover:bg-[#1C2638] text-slate-300 border border-[#1E2638] text-xs transition"
                      title="Copy MT4/MT5 signal parameters to clipboard"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => handleViewOnChart(signal)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#141B28] hover:bg-[#1C2638] text-cyan-300 border border-cyan-500/30 text-xs transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Chart</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
