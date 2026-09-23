import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Clock, 
  ShieldCheck, 
  Activity, 
  HelpCircle,
  BarChart2,
  Compass
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { calculateATR, assessMarketDirection } from '../../utils/technicalAnalysis';

export const MarketOverviewPanel: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    goldDataSource, 
    lastGoldSyncTime,
    isMarketClosed,
    marketClosureReason
  } = useTrading();

  // Price calculations
  const isUp = activeInstrument.change24h >= 0;
  const changeDollars = activeInstrument.currentPrice - (activeInstrument.open24h || activeInstrument.currentPrice);
  const spreadRange = activeInstrument.high24h - activeInstrument.low24h;

  // Volatility (ATR 14)
  const atrResult = useMemo(() => {
    return calculateATR(candles, 14);
  }, [candles]);

  // Market Direction Assessment
  const directionAssessment = useMemo(() => {
    return assessMarketDirection(candles);
  }, [candles]);

  const formattedSync = lastGoldSyncTime > 0
    ? new Date(lastGoldSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : 'Live Synchronized';

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E2638]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Compass className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>MARKET OVERVIEW</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal">({activeInstrument.symbol})</span>
            </h2>
            <p className="text-[11px] text-slate-400">Institutional bullion price metrics & volatility analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#121826] border border-[#1F293D] text-[11px] font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last Sync: {formattedSync}</span>
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Card 1: Current Gold Price */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>CURRENT SPOT</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div className="text-xl font-extrabold font-mono text-white tracking-tight">
            ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
            <span>Base: {activeInstrument.baseCurrency}</span>
            <span>•</span>
            <span>Quote: {activeInstrument.quoteCurrency}</span>
          </div>
        </div>

        {/* Card 2: Daily High & Low */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>DAILY RANGE (24H)</span>
            <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-center justify-between font-mono">
            <div>
              <span className="text-[10px] text-slate-500 block">HIGH</span>
              <span className="text-sm font-bold text-emerald-400">
                ${activeInstrument.high24h.toFixed(activeInstrument.decimals)}
              </span>
            </div>
            <div className="w-px h-6 bg-[#1F293D]" />
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">LOW</span>
              <span className="text-sm font-bold text-rose-400">
                ${activeInstrument.low24h.toFixed(activeInstrument.decimals)}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Range Spread: ${spreadRange.toFixed(2)}
          </div>
        </div>

        {/* Card 3: Daily Change */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>DAILY CHANGE</span>
            {isUp ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className={`text-xl font-extrabold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? '+' : ''}${Math.abs(changeDollars).toFixed(2)}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              isUp ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {isUp ? '+' : ''}{activeInstrument.change24h}%
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Open: ${(activeInstrument.open24h || activeInstrument.currentPrice).toFixed(2)}
          </div>
        </div>

        {/* Card 4: Volatility (ATR) */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-1">
            <span>VOLATILITY (ATR 14)</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            {atrResult.enoughData ? (
              <>
                <span className="text-xl font-extrabold text-white">
                  ${atrResult.atr.toFixed(2)}
                </span>
                <span className="text-xs text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded font-bold">
                  {(atrResult.atr * activeInstrument.pipMultiplier).toFixed(0)} pips
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500 font-bold">Insufficient Data</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">
            Normalized 14-period True Range
          </div>
        </div>

      </div>

      {/* Market Direction Section */}
      <div className="mt-3.5 p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          
          {/* Direction Label */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase">Market Direction:</span>
            
            {directionAssessment.direction === 'BULLISH' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-extrabold text-xs">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Bullish</span>
              </span>
            )}

            {directionAssessment.direction === 'BEARISH' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-extrabold text-xs">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                <span>Bearish</span>
              </span>
            )}

            {directionAssessment.direction === 'NEUTRAL' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-extrabold text-xs">
                <Minus className="w-4 h-4 text-amber-400" />
                <span>Neutral</span>
              </span>
            )}

            {directionAssessment.direction === 'INSUFFICIENT_DATA' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-mono font-extrabold text-xs">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Insufficient data</span>
              </span>
            )}

            <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
              Confidence: <strong className="text-white">{directionAssessment.confidenceScore}%</strong>
            </span>
          </div>

          {/* Data Source Badge */}
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Data Source: <strong className="text-amber-300">{goldDataSource}</strong></span>
          </div>

        </div>

        {/* Technical Explanation & Legal Disclaimer */}
        <div className="mt-2 text-[11px] text-slate-400 leading-relaxed border-t border-[#141C2B] pt-2">
          {directionAssessment.rationale}
          <div className="text-[10px] text-slate-500 mt-0.5 italic">
            * {directionAssessment.disclaimer}
          </div>
        </div>

      </div>

    </div>
  );
};
