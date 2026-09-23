import React, { useState } from 'react';
import { 
  Zap, 
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
  Flame,
  Award,
  Sliders,
  DollarSign,
  SunMedium,
  Layers,
  Activity
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { StrategyId } from '../types';
import { OrderFlowVolumeProfileCard } from './OrderFlowVolumeProfileCard';

export const ScalpGeneratorTab: React.FC = () => {
  const { 
    activeInstrument, 
    activeScalpSignal, 
    isGeneratingSignal, 
    generateScalp, 
    executeScalpOrder,
    adminProfile,
    scalpSignals,
    setActiveScalpSignal,
    setActiveTab,
  } = useTrading();

  const [selectedStrategy, setSelectedStrategy] = useState<StrategyId>('SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC');
  const [customLotSize, setCustomLotSize] = useState<number>(adminProfile.defaultLotSize);
  const [showBacktestDetails, setShowBacktestDetails] = useState<boolean>(true);
  const [executionSuccessNotice, setExecutionSuccessNotice] = useState<string | null>(null);

  const handleGenerate = () => {
    generateScalp(selectedStrategy);
    setExecutionSuccessNotice(null);
  };

  const handleExecute = () => {
    if (!activeScalpSignal) return;
    executeScalpOrder(activeScalpSignal, customLotSize);
    setExecutionSuccessNotice(`Order executed! ${customLotSize} Lots on ${activeScalpSignal.symbol} (${activeScalpSignal.direction})`);
    setTimeout(() => {
      setExecutionSuccessNotice(null);
    }, 4000);
  };

  const signal = activeScalpSignal;

  return (
    <div className="space-y-4">
      
      {/* Top Generator Control Panel */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Zap className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Institutional Scalping Signal Engine</span>
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    PRE-BACKTESTED
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Every generated scalp is empirically backtested against {activeInstrument.symbol} historical data, indicator rules, and SMC structures.
                </p>
              </div>
            </div>
          </div>

          {/* Strategy & Action Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Quick Switch to Day Trading */}
            <div className="flex flex-col justify-end">
              <button
                id="switch-to-day-trading-btn"
                onClick={() => setActiveTab('day_trading')}
                className="h-[38px] px-3 rounded-lg bg-[#0B0E14] hover:bg-[#161F30] text-sky-300 border border-sky-500/30 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Switch to Institutional Day Trading Method & Indicators"
              >
                <SunMedium className="w-3.5 h-3.5 text-sky-400" />
                <span>Day Trading Mode</span>
              </button>
            </div>

            {/* Strategy Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] uppercase font-mono text-slate-400 mb-1">Target Strategy</label>
              <select
                id="strategy-selector-dropdown"
                value={selectedStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value as StrategyId)}
                className="bg-[#0B0E14] border border-[#232D42] text-slate-200 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC">★ Order Flow, Volume Profile & Market Structure (SMC) [85.2% WR]</option>
                <option value="SMC_ORDER_BLOCK">SMC Order Block & Liquidity (78.6% WR)</option>
                <option value="LIQUIDITY_SWEEP_FVG">Liquidity Sweep & FVG Retest (81.3% WR)</option>
                <option value="VWAP_BAND_REVERSION">VWAP 2-Sigma Mean Reversion (74.2% WR)</option>
                <option value="EMA_MOMENTUM_PULLBACK">EMA 9/21 Dynamic Cross & 50 Macro (76.5% WR)</option>
                <option value="SUPER_CONFLUENCE_AI">Super Confluence AI (All Combined) [83.7% WR]</option>
              </select>
            </div>

            {/* Main Generate Button */}
            <div className="flex flex-col justify-end">
              <button
                id="generate-scalp-main-btn"
                onClick={handleGenerate}
                disabled={isGeneratingSignal}
                className="h-[38px] px-5 rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isGeneratingSignal ? 'animate-spin' : 'animate-pulse'}`} />
                <span>{isGeneratingSignal ? 'Backtesting & Scanning...' : 'Generate Scalp Setup'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Strategy Preset Filter Pills for Fast Navigation */}
        <div className="mt-3 pt-3 border-t border-[#1E2638] flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] uppercase font-mono text-slate-400 shrink-0">Quick Strategy:</span>
          <button
            onClick={() => {
              setSelectedStrategy('SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC');
              generateScalp('SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'SCALP_ORDER_FLOW_VOLUME_PROFILE_SMC'
                ? 'bg-amber-500 text-black border border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-[#0B0E14] text-amber-300 hover:bg-[#161F30] border border-amber-500/30'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400 fill-current" />
            <span>★ Order Flow & Volume Profile</span>
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('SMC_ORDER_BLOCK');
              generateScalp('SMC_ORDER_BLOCK');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'SMC_ORDER_BLOCK'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            SMC Order Block
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('LIQUIDITY_SWEEP_FVG');
              generateScalp('LIQUIDITY_SWEEP_FVG');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'LIQUIDITY_SWEEP_FVG'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            Liquidity Sweep & FVG
          </button>
          <button
            onClick={() => {
              setSelectedStrategy('SUPER_CONFLUENCE_AI');
              generateScalp('SUPER_CONFLUENCE_AI');
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedStrategy === 'SUPER_CONFLUENCE_AI'
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-[#0B0E14] text-slate-300 hover:text-white border border-[#232D42]'
            }`}
          >
            Super Confluence AI
          </button>
        </div>

        {/* Recent Signals Quick Switcher (if multiple) */}
        {scalpSignals.length > 1 && (
          <div className="mt-4 pt-3 border-t border-[#1E2638] flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] text-slate-400 font-mono shrink-0">Signal History:</span>
            {scalpSignals.map((sig, idx) => {
              const isCurrent = sig.id === signal?.id;
              const isBuy = sig.direction === 'BUY';
              return (
                <button
                  key={`${sig.id}-${idx}`}
                  onClick={() => setActiveScalpSignal(sig)}
                  className={`text-[11px] font-mono px-2 py-1 rounded border transition-all flex items-center gap-1.5 shrink-0 ${
                    isCurrent 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                      : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border-[#1E2638]'
                  }`}
                >
                  <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                    {sig.direction}
                  </span>
                  <span>{sig.symbol}</span>
                  <span className="text-[10px] text-slate-400">({sig.backtest.winRate}%)</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution feedback notice */}
      {executionSuccessNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{executionSuccessNotice}</span>
          </div>
          <button 
            onClick={() => setActiveTab('orders')} 
            className="underline text-emerald-200 font-semibold hover:text-white"
          >
            View Active Positions →
          </button>
        </div>
      )}

      {/* Active Scalp Signal Card */}
      {signal && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Main Signal Parameters (2 cols on large screen) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Primary Signal Box */}
            <div className={`bg-[#121824] border rounded-xl p-5 relative overflow-hidden shadow-xl ${
              signal.direction === 'BUY' ? 'border-emerald-500/30' : 'border-rose-500/30'
            }`}>
              
              {/* Background gradient flare */}
              <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none ${
                signal.direction === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />

              {/* Header: Direction, Pair, Strategy */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded-lg font-mono font-black text-sm uppercase flex items-center gap-1.5 shadow-md ${
                    signal.direction === 'BUY' 
                      ? 'bg-emerald-500 text-black shadow-emerald-500/20' 
                      : 'bg-rose-500 text-white shadow-rose-500/20'
                  }`}>
                    {signal.direction === 'BUY' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span>{signal.direction} / {signal.direction === 'BUY' ? 'LONG' : 'SHORT'}</span>
                  </div>

                  <div>
                    <h2 className="text-xl font-mono font-bold text-white tracking-tight">{signal.symbol}</h2>
                    <span className="text-xs text-slate-400">{signal.strategyName}</span>
                  </div>
                </div>

                {/* Risk-Reward & Timeframe Badge */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Risk:Reward</span>
                    <span className="text-sm font-mono font-bold text-amber-400">1 : {signal.riskReward}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-[#0B0E14] border border-[#232D42] text-xs font-mono text-slate-300">
                    M5 Scalp
                  </div>
                </div>
              </div>

              {/* Exact Execution Levels Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
                {/* Entry Price */}
                <div className="bg-[#0B0E14] border border-[#1E2638] p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Entry Price</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-white">
                    {signal.entryPrice}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">Market Touch</span>
                </div>

                {/* Stop Loss */}
                <div className="bg-[#0B0E14] border border-rose-500/20 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-rose-400 uppercase font-mono">Stop Loss</span>
                    <span className="text-[10px] text-rose-400 font-mono font-bold">-{signal.riskPips}p</span>
                  </div>
                  <span className="text-sm sm:text-base font-mono font-bold text-rose-400">
                    {signal.stopLoss}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">Invalidation</span>
                </div>

                {/* Take Profit 1 */}
                <div className="bg-[#0B0E14] border border-emerald-500/20 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 uppercase font-mono">TP1 (Scalp)</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">+{signal.tp1Pips}p</span>
                  </div>
                  <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                    {signal.takeProfit1}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">1:1.5 RR (50% close)</span>
                </div>

                {/* Take Profit 2 */}
                <div className="bg-[#0B0E14] border border-emerald-500/30 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-300 uppercase font-mono">TP2 (Target)</span>
                    <span className="text-[10px] text-emerald-300 font-mono font-bold">+{signal.tp2Pips}p</span>
                  </div>
                  <span className="text-sm sm:text-base font-mono font-bold text-emerald-300">
                    {signal.takeProfit2}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">1:2.5 RR (Runner)</span>
                </div>
              </div>

              {/* Dedicated Institutional Order Flow, Volume Profile & Market Structure Engine */}
              <OrderFlowVolumeProfileCard
                symbol={signal.symbol}
                direction={signal.direction}
                currentPrice={signal.entryPrice}
                tradingStyle="SCALPING"
                orderFlowContext={signal.orderFlowContext}
                onQuickExecute={handleExecute}
              />

              {/* Indicator Confluences Checklist */}
              <div className="mt-4 pt-4 border-t border-[#1E2638]">
                <h3 className="text-xs font-semibold text-slate-300 uppercase font-mono tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Technical Indicators & SMC Confluence Checklist</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {signal.confluences.map((conf, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-[#0B0E14]/70 p-2 rounded border border-[#1E2638]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{conf}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* One-Click Execute Action */}
              <div className="mt-5 pt-4 border-t border-[#1E2638] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Trade Lot Size:</span>
                    <div className="flex items-center gap-1">
                      {[0.1, 0.5, 1.0, 2.0, 5.0].map(lot => (
                        <button
                          key={lot}
                          onClick={() => setCustomLotSize(lot)}
                          className={`px-2 py-1 text-xs font-mono rounded border transition-all ${
                            customLotSize === lot 
                              ? 'bg-amber-500 text-black font-bold border-amber-400' 
                              : 'bg-[#0B0E14] text-slate-300 border-[#232D42] hover:bg-[#1A2234]'
                          }`}
                        >
                          {lot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Spread Cost: <span className="text-amber-400 font-bold">-${(activeInstrument.spreadPips * customLotSize * 10).toFixed(2)}</span> ({activeInstrument.spreadPips.toFixed(1)} pips / ${(activeInstrument.spreadPips / 10).toFixed(2)} oz)
                  </div>
                </div>

                <button
                  id="execute-scalp-order-btn"
                  onClick={handleExecute}
                  className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer ${
                    signal.direction === 'BUY'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                      : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                  }`}
                >
                  <DollarSign className="w-4 h-4 font-bold" />
                  <span>Execute {signal.direction} Scalp ({customLotSize} Lots)</span>
                </button>
              </div>

            </div>

            {/* Backtest Empirical Trade Log (Collapsible) */}
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl overflow-hidden shadow-lg">
              <button
                id="toggle-backtest-log-btn"
                onClick={() => setShowBacktestDetails(!showBacktestDetails)}
                className="w-full px-4 py-3 bg-[#0E131D] flex items-center justify-between text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span className="font-bold">Historical Backtest Trade Executions (Last 15 Sample Trades)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {signal.backtest.winRate}% Win Rate
                  </span>
                </div>
                {showBacktestDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showBacktestDetails && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1E2638] text-slate-400 text-[11px]">
                        <th className="pb-2">Setup ID</th>
                        <th className="pb-2">Time Ago</th>
                        <th className="pb-2">Direction</th>
                        <th className="pb-2">Entry</th>
                        <th className="pb-2">Exit</th>
                        <th className="pb-2">Outcome</th>
                        <th className="pb-2">Pips</th>
                        <th className="pb-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A2234]">
                      {signal.backtest.testedSampleTrades.map((trade, idx) => (
                        <tr key={`${trade.id}-${idx}`} className="hover:bg-[#161F30]/50 transition-colors">
                          <td className="py-2 text-slate-400">{trade.id}</td>
                          <td className="py-2 text-slate-400">{trade.timeAgo}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              trade.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {trade.direction}
                            </span>
                          </td>
                          <td className="py-2 text-slate-200">{trade.entryPrice}</td>
                          <td className="py-2 text-slate-200">{trade.exitPrice}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              trade.outcome === 'WIN' ? 'bg-emerald-500 text-black' : 'bg-rose-500/30 text-rose-300'
                            }`}>
                              {trade.outcome}
                            </span>
                          </td>
                          <td className={`py-2 font-bold ${trade.pips >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {trade.pips >= 0 ? `+${trade.pips}` : trade.pips}p
                          </td>
                          <td className="py-2 text-slate-400 text-[11px]">{trade.exitReason} Hit ({trade.durationMinutes}m)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Pre-Backtested Verification Badge Card */}
          <div className="space-y-4">
            
            {/* The Dedicated Pre-Backtest Verification Card */}
            <div className="bg-[#121824] border border-amber-500/30 rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase font-mono">
                  Backtest Verification
                </h3>
              </div>

              {/* Big Win Rate Display */}
              <div className="bg-[#0B0E14] border border-[#1E2638] rounded-xl p-4 text-center mb-4 relative overflow-hidden">
                <span className="text-[11px] uppercase font-mono text-slate-400 block mb-1">
                  Empirical Win Rate ({signal.backtest.totalSampleTrades} Trades)
                </span>
                <div className="text-4xl font-mono font-black text-emerald-400 tracking-tight flex items-center justify-center gap-1">
                  <span>{signal.backtest.winRate}%</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400/80 mt-1 inline-block">
                  {signal.backtest.tradesWon} Wins / {signal.backtest.tradesLost} Losses
                </span>
              </div>

              {/* Core Institutional Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs mb-4">
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Profit Factor</span>
                  <span className="text-base font-bold text-amber-300">{signal.backtest.profitFactor}</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Max Drawdown</span>
                  <span className="text-base font-bold text-rose-400">{signal.backtest.maxDrawdownPercent}%</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Avg Risk/Reward</span>
                  <span className="text-base font-bold text-white">1:{signal.backtest.avgRiskReward}</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Net Pips Yield</span>
                  <span className="text-base font-bold text-emerald-400">+{signal.backtest.netPipsWon}p</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Expected Value</span>
                  <span className="text-base font-bold text-amber-300">+{signal.backtest.expectedValuePipsPerTrade}p / trade</span>
                </div>
                <div className="bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                  <span className="text-[10px] text-slate-400 block uppercase">Sharpe Ratio</span>
                  <span className="text-base font-bold text-white">{signal.backtest.sharpeRatio}</span>
                </div>
              </div>

              {/* Edge Guarantee Badge */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1 font-mono">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>MATHEMATICAL EDGE VERIFIED</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  This signal satisfies the statistical criteria of your custom indicator set. Backtested sample confirms a positive mathematical expectancy.
                </p>
              </div>

            </div>

            {/* Live Indicator Readings for Setup */}
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 text-xs font-mono space-y-2">
              <h4 className="text-slate-400 uppercase text-[10px] font-bold">Live Micro Indicator Telemetry</h4>
              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">RSI (5M):</span>
                <span className="text-white font-bold">{signal.indicatorReadings.rsiM5}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">EMA Cross:</span>
                <span className="text-emerald-400">{signal.indicatorReadings.emaBias}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">VWAP Deviation:</span>
                <span className="text-amber-300">{signal.indicatorReadings.vwapDeviation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#1E2638]">
                <span className="text-slate-400">SMC Structure:</span>
                <span className="text-slate-200">{signal.indicatorReadings.smcStructure}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Liquidity:</span>
                <span className="text-emerald-400">{signal.indicatorReadings.liquiditySweep}</span>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
