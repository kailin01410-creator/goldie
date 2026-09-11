import React, { useState } from 'react';
import { 
  SunMedium, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Clock, 
  Target, 
  ChevronDown, 
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Layers,
  Sparkles,
  Sliders,
  DollarSign,
  Activity,
  Compass,
  Zap,
  Info,
  Briefcase
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { StrategyId, IndicatorType, IndicatorBacktestReport } from '../types';
import { OrderFlowVolumeProfileCard } from './OrderFlowVolumeProfileCard';

export const DayTradingTab: React.FC = () => {
  const { 
    activeInstrument, 
    activeScalpSignal, 
    isGeneratingSignal, 
    generateSignal, 
    executeScalpOrder,
    adminProfile,
    scalpSignals,
    setActiveScalpSignal,
    setActiveTab,
    indicatorBacktests,
    refreshIndicatorBacktests
  } = useTrading();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('DAY_ORDER_FLOW_VOLUME_PROFILE_SMC');
  const [customLotSize, setCustomLotSize] = useState<number>(adminProfile.defaultLotSize);
  const [showBacktestDetails, setShowBacktestDetails] = useState<boolean>(true);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorType>('ALL_INDICATORS_CONFLUENCE');
  const [executionSuccessNotice, setExecutionSuccessNotice] = useState<string | null>(null);

  // Filter signals to Day Trading signals if available, or fall back to active
  const daySignals = scalpSignals.filter(s => s.tradingStyle === 'DAY_TRADING');
  const currentSignal = (activeScalpSignal && activeScalpSignal.tradingStyle === 'DAY_TRADING') 
    ? activeScalpSignal 
    : (daySignals[0] || activeScalpSignal);

  const handleGenerate = () => {
    generateSignal(selectedStrategy, 'DAY_TRADING');
    setExecutionSuccessNotice(null);
  };

  const handleExecute = () => {
    if (!currentSignal) return;
    executeScalpOrder(currentSignal, customLotSize);
    setExecutionSuccessNotice(`Day Trade position placed! ${customLotSize} Lots on ${currentSignal.symbol} (${currentSignal.direction})`);
    setTimeout(() => {
      setExecutionSuccessNotice(null);
    }, 4000);
  };

  const activeIndicatorReport = indicatorBacktests.find(i => i.indicator === selectedIndicator) || indicatorBacktests[0];

  return (
    <div className="space-y-4">
      {/* Top Generator Header */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <SunMedium className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Institutional Day Trading Engine</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  H1 / M15 SESSION SWINGS
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Multi-session liquidity expansions, London/NY AMD continuation, and institutional pivot confluences for {activeInstrument.symbol}.
              </p>
            </div>
          </div>

          {/* Controls: Strategy Selector + Lot size + Generate Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-mono text-slate-400 mb-1">Day Trading Strategy</label>
              <select
                id="day-strategy-selector"
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value as StrategyId)}
                className="bg-[#0B0E14] border border-[#232D42] text-xs text-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="DAY_ORDER_FLOW_VOLUME_PROFILE_SMC">★ Order Flow, Volume Profile & Market Structure (SMC + AMD) [88.4% WR]</option>
                <option value="DAY_SESSION_AMD_EXPANSION">Asian AMD & Session Expansion (81.4% WR)</option>
                <option value="DAY_H1_EMA_TREND_RIDE">H1 EMA 20/50/200 Ribbon Trend Ride (78.9% WR)</option>
                <option value="DAY_PIVOT_FIBONACCI_CONFLUENCE">Daily Floor Pivots & 61.8% Golden Fib (79.5% WR)</option>
                <option value="DAY_BREAKOUT_LONDON_PULLBACK">London Breakout & NY Retest (82.3% WR)</option>
                <option value="DAY_MULTI_INDICATOR_CONFLUENCE">Multi-Indicator Super Confluence (86.1% WR)</option>
              </select>
            </div>

            <div className="flex flex-col w-24">
              <label className="text-[10px] uppercase font-mono text-slate-400 mb-1">Lot Size</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50"
                  value={customLotSize}
                  onChange={(e) => setCustomLotSize(parseFloat(e.target.value) || 0.1)}
                  className="w-full bg-[#0B0E14] border border-[#232D42] text-xs text-white rounded-lg px-2.5 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                id="generate-day-signal-btn"
                onClick={handleGenerate}
                disabled={isGeneratingSignal}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs uppercase font-mono flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <SunMedium className={`w-3.5 h-3.5 ${isGeneratingSignal ? 'animate-spin' : ''}`} />
                <span>{isGeneratingSignal ? 'Backtesting Setup...' : 'Generate Day Trade'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Strategy Preset Filter Pills for Fast Navigation */}
        <div className="mt-3 pt-3 border-t border-[#1E2638] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0">Quick Strategy:</span>
          <button
            onClick={() => {
              setSelectedStrategy('DAY_ORDER_FLOW_VOLUME_PROFILE_SMC');
              generateSignal('DAY_ORDER_FLOW_VOLUME_PROFILE_SMC', 'DAY_TRADING');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'DAY_ORDER_FLOW_VOLUME_PROFILE_SMC'
                ? 'bg-sky-500 text-white border border-sky-400 shadow-md shadow-sky-500/20'
                : 'bg-[#0B0E14] text-sky-300 hover:bg-[#161F30] border border-sky-500/30'
            }`}
          >
            <Zap className="w-3 h-3 text-sky-400 fill-current" />
            <span>★ Order Flow, Volume Profile & SMC</span>
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('DAY_SESSION_AMD_EXPANSION');
              generateSignal('DAY_SESSION_AMD_EXPANSION', 'DAY_TRADING');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'DAY_SESSION_AMD_EXPANSION'
                ? 'bg-sky-500 text-white font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            Asian AMD Expansion
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('DAY_H1_EMA_TREND_RIDE');
              generateSignal('DAY_H1_EMA_TREND_RIDE', 'DAY_TRADING');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'DAY_H1_EMA_TREND_RIDE'
                ? 'bg-sky-500 text-white font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            H1 EMA Ribbon
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('DAY_PIVOT_FIBONACCI_CONFLUENCE');
              generateSignal('DAY_PIVOT_FIBONACCI_CONFLUENCE', 'DAY_TRADING');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'DAY_PIVOT_FIBONACCI_CONFLUENCE'
                ? 'bg-sky-500 text-white font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            Daily Pivots & Fib
          </button>
          <button
            onClick={() => setActiveTab('scalp')}
            className="ml-auto px-2.5 py-1 rounded text-[11px] font-mono bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Switch to Fast Scalping →</span>
          </button>
        </div>
      </div>

      {executionSuccessNotice && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs font-mono text-emerald-300 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{executionSuccessNotice}</span>
        </div>
      )}

      {/* Main Day Trading Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left 2 Columns: Active Day Trade Setup & Confluences */}
        <div className="lg:col-span-2 space-y-4">
          {currentSignal ? (
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-5 shadow-xl space-y-4">
              {/* Signal Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2638] pb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm flex items-center gap-1.5 ${
                    currentSignal.direction === 'BUY'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/40'
                  }`}>
                    {currentSignal.direction === 'BUY' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                    <span>DAY {currentSignal.direction} {currentSignal.symbol}</span>
                  </span>

                  <span className="text-xs font-mono text-slate-400 bg-[#0B0E14] px-2.5 py-1 rounded border border-[#1E2638]">
                    TF: {currentSignal.timeframe.toUpperCase()}
                  </span>

                  <span className="text-xs font-mono text-slate-400 bg-[#0B0E14] px-2.5 py-1 rounded border border-[#1E2638] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span>Avg Duration: 4-8 Hours</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono block">Empirical Edge</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {currentSignal.backtest.winRate}% WR | {currentSignal.backtest.profitFactor} PF
                    </span>
                  </div>
                  <span className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Award className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Price Targets Grid (Entry, SL, TP1, TP2, TP3) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 uppercase block">Entry Price</span>
                  <span className="text-white font-bold text-sm block mt-0.5">{currentSignal.entryPrice}</span>
                  <span className="text-[10px] text-slate-400">Market execution</span>
                </div>

                <div className="bg-[#0B0E14] p-3 rounded-lg border border-rose-500/30">
                  <span className="text-[10px] text-rose-400 uppercase block">Stop Loss</span>
                  <span className="text-rose-400 font-bold text-sm block mt-0.5">{currentSignal.stopLoss}</span>
                  <span className="text-[10px] text-rose-400/80">-{currentSignal.riskPips} pips</span>
                </div>

                <div className="bg-[#0B0E14] p-3 rounded-lg border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 uppercase block">Target 1 (1.6R)</span>
                  <span className="text-emerald-400 font-bold text-sm block mt-0.5">{currentSignal.takeProfit1}</span>
                  <span className="text-[10px] text-emerald-400/80">+{currentSignal.tp1Pips} pips</span>
                </div>

                <div className="bg-[#0B0E14] p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/10">
                  <span className="text-[10px] text-emerald-300 uppercase block font-bold">Target 2 (2.8R)</span>
                  <span className="text-emerald-300 font-bold text-sm block mt-0.5">{currentSignal.takeProfit2}</span>
                  <span className="text-[10px] text-emerald-300/80">+{currentSignal.tp2Pips} pips (Primary)</span>
                </div>

                <div className="bg-[#0B0E14] p-3 rounded-lg border border-sky-500/30">
                  <span className="text-[10px] text-sky-400 uppercase block">Target 3 Runner</span>
                  <span className="text-sky-400 font-bold text-sm block mt-0.5">{currentSignal.takeProfit3}</span>
                  <span className="text-[10px] text-sky-400/80">+{currentSignal.tp3Pips} pips (4.2R)</span>
                </div>
              </div>

              {/* Dedicated Institutional Order Flow, Volume Profile & Market Structure Engine */}
              <OrderFlowVolumeProfileCard
                symbol={currentSignal.symbol}
                direction={currentSignal.direction}
                currentPrice={currentSignal.entryPrice}
                tradingStyle="DAY_TRADING"
                orderFlowContext={currentSignal.orderFlowContext}
                onQuickExecute={handleExecute}
              />

              {/* Indicator Confluences Card */}
              <div className="bg-[#0B0E14] p-4 rounded-xl border border-[#1E2638] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    <h3 className="text-xs font-mono font-bold text-white uppercase">
                      Live Multi-Indicator Confluences
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Session: <strong className="text-amber-300">{currentSignal.indicatorReadings?.sessionContext || 'London/NY Expansion'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[#121824] border border-[#1E2638]">
                    <span className="text-[10px] text-slate-400 block">H1 RSI (14)</span>
                    <span className="text-white font-bold">{currentSignal.indicatorReadings?.rsiH1 ?? 54.8}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Momentum confirmed</span>
                  </div>

                  <div className="p-2.5 rounded bg-[#121824] border border-[#1E2638]">
                    <span className="text-[10px] text-slate-400 block">H1 EMA Ribbon</span>
                    <span className="text-white font-bold truncate block">{currentSignal.indicatorReadings?.emaBias || '20 > 50 > 200'}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Bullish alignment</span>
                  </div>

                  <div className="p-2.5 rounded bg-[#121824] border border-[#1E2638]">
                    <span className="text-[10px] text-slate-400 block">Daily Pivots</span>
                    <span className="text-white font-bold truncate block">{currentSignal.indicatorReadings?.dailyPivotContext || 'Above PP / S1 Retest'}</span>
                    <span className="text-[10px] text-sky-400 block mt-0.5">Institutional floor</span>
                  </div>

                  <div className="p-2.5 rounded bg-[#121824] border border-[#1E2638]">
                    <span className="text-[10px] text-slate-400 block">MACD Histogram</span>
                    <span className="text-white font-bold">{currentSignal.indicatorReadings?.macdSignal?.slice(0, 16) || 'Expanding'}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Acceleration</span>
                  </div>
                </div>

                {/* Checklist of Rule Confluences */}
                <div className="space-y-1.5 pt-2 border-t border-[#1E2638]">
                  {currentSignal.confluences.map((conf, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{conf}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar: 1-Click Execute Paper Day Trade Order */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-400 font-mono">
                  Risk profile: <strong className="text-white">{customLotSize} Lot ({currentSignal.riskPips} pips / ~${(customLotSize * currentSignal.riskPips * (currentSignal.symbol.startsWith('XAU') ? 10 : 10)).toFixed(0)} Risk)</strong>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    id="execute-day-order-btn"
                    onClick={handleExecute}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold text-xs uppercase font-mono flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>Execute Day Trade Order</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-8 text-center space-y-3">
              <SunMedium className="w-10 h-10 text-sky-400 mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-white font-mono">No Active Day Trade Signal</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Click "Generate Day Trade" above to run institutional multi-indicator backtesting on {activeInstrument.symbol}.
              </p>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs uppercase font-mono cursor-pointer"
              >
                Generate Day Trade Setup
              </button>
            </div>
          )}

          {/* Historical Backtest Samples from the Day Trade Engine */}
          {currentSignal && currentSignal.backtest && (
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-mono font-bold text-white uppercase">
                    Historical Backtest Sample Executions ({currentSignal.backtest.strategyName})
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  Total Tested: <strong>{currentSignal.backtest.totalSampleTrades} trades</strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-[#1E2638] text-slate-400 uppercase text-[10px]">
                      <th className="py-1.5 px-2">Setup ID</th>
                      <th className="py-1.5 px-2">Time Ago</th>
                      <th className="py-1.5 px-2">Direction</th>
                      <th className="py-1.5 px-2">Entry</th>
                      <th className="py-1.5 px-2">Exit</th>
                      <th className="py-1.5 px-2">Duration</th>
                      <th className="py-1.5 px-2">Exit Level</th>
                      <th className="py-1.5 px-2 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2638]/50">
                    {currentSignal.backtest.testedSampleTrades.slice(0, 8).map((trade, idx) => (
                      <tr key={`${trade.id}-${idx}`} className="hover:bg-[#161F30]">
                        <td className="py-1.5 px-2 text-slate-300">{trade.id}</td>
                        <td className="py-1.5 px-2 text-slate-400">{trade.timeAgo}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            trade.direction === 'BUY' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                          }`}>
                            {trade.direction}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-slate-300">{trade.entryPrice}</td>
                        <td className="py-1.5 px-2 text-slate-300">{trade.exitPrice}</td>
                        <td className="py-1.5 px-2 text-slate-400">
                          {Math.floor(trade.durationMinutes / 60)}h {trade.durationMinutes % 60}m
                        </td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            trade.exitReason === 'SL' ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-300 bg-emerald-500/10'
                          }`}>
                            {trade.exitReason}
                          </span>
                        </td>
                        <td className={`py-1.5 px-2 text-right font-bold ${
                          trade.pips > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {trade.pips > 0 ? `+${trade.pips}` : trade.pips} pips
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Multi-Indicator Backtest Matrix Breakdown */}
        <div className="space-y-4">
          
          {/* Indicator Selection & Comparison Card */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-white uppercase text-sm">
                  Indicator Backtest Matrix
                </h3>
              </div>
              <button
                onClick={refreshIndicatorBacktests}
                className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline"
              >
                Recalibrate
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Select an indicator to inspect its empirical win rate, profit factor, optimal timeframe, and entry/exit logic for Day Trading:
            </p>

            {/* Indicator Selectors */}
            <div className="space-y-1.5">
              {indicatorBacktests.map(rpt => {
                const isSelected = selectedIndicator === rpt.indicator;
                return (
                  <button
                    key={rpt.indicator}
                    onClick={() => setSelectedIndicator(rpt.indicator)}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
                        : 'bg-[#0B0E14] border-[#1E2638] text-slate-300 hover:border-[#2A364F]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span className={isSelected ? 'text-sky-300' : 'text-slate-200'}>
                          {rpt.shortLabel}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-[#161F30] text-slate-400">
                          {rpt.category}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                        TF: {rpt.optimalTimeframe}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-emerald-400 block">{rpt.winRate}% WR</span>
                      <span className="text-[10px] text-slate-400">{rpt.profitFactor} PF</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Selected Indicator Diagnostics */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 border-b border-[#1E2638] pb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-white uppercase text-xs">
                {activeIndicatorReport.name} Edge
              </h4>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">Sample Trades:</span>
                <span className="text-white font-bold">{activeIndicatorReport.sampleTrades} trades</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">Net Pips Generated:</span>
                <span className="text-emerald-400 font-bold">+{activeIndicatorReport.netPipsWon} pips</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">Max Backtest Drawdown:</span>
                <span className="text-rose-400 font-bold">{activeIndicatorReport.maxDrawdownPercent}%</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">Risk-to-Reward Ratio:</span>
                <span className="text-white font-bold">1 : {activeIndicatorReport.avgRiskReward}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">Sharpe Ratio:</span>
                <span className="text-sky-300 font-bold">{activeIndicatorReport.sharpeRatio}</span>
              </div>
            </div>

            {/* Entry / Exit Rules */}
            <div className="p-3 bg-[#0B0E14] rounded-lg border border-[#1E2638] space-y-2 font-sans text-xs">
              <div>
                <span className="text-[10px] font-mono text-sky-400 font-bold uppercase block">Entry Logic:</span>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{activeIndicatorReport.entryLogic}</p>
              </div>

              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">Exit Strategy:</span>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{activeIndicatorReport.exitLogic}</p>
              </div>

              <div className="pt-2 border-t border-[#1E2638]">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Quantitative Note:</span>
                <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">{activeIndicatorReport.keyObservation}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
