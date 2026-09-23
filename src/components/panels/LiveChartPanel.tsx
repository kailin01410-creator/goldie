import React from 'react';
import { 
  Activity,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { FluidLiveChart } from '../chart/FluidLiveChart';

export const LiveChartPanel: React.FC = () => {
  const { 
    activeInstrument, 
    goldDataSource,
    isMarketClosed,
    goldApiKey,
    goldApiNotice
  } = useTrading();

  const isUp = activeInstrument.change24h >= 0;

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-3.5 sm:p-5 flex flex-col font-sans">
      
      {/* Panel 1 Header: Title, Live Quote Strip, Market Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[#1E2638]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>Panel 1: Live Gold Price Chart</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                MT5 & TradingView Fluid Core
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Data-space viewport, cursor-anchored zoom, and deliberate live-edge state
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-2">
          {/* Feed Tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#090E17] border border-[#1E2638] text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300">
              {goldDataSource.includes('GoldAPI') ? 'GoldAPI.io Feed' : 'Live Institutional Spot'}
            </span>
          </div>

          {/* Market Status Tag */}
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
            isMarketClosed 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketClosed ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span>{isMarketClosed ? 'WEEKEND (CONTINUOUS SPOT)' : 'MARKET OPEN'}</span>
          </div>
        </div>
      </div>

      {/* Primary Quote Bar: Current Price, High, Low, Open, Close, % Change */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 py-2.5 px-3 mb-3 bg-[#090E17] border border-[#182133] rounded-xl text-xs font-mono">
        <div>
          <span className="text-slate-400 text-[10px] block">CURRENT SPOT</span>
          <span className={`text-base font-extrabold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">24H HIGH</span>
          <span className="text-slate-200 font-bold">
            ${activeInstrument.high24h.toFixed(activeInstrument.decimals)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">24H LOW</span>
          <span className="text-slate-200 font-bold">
            ${activeInstrument.low24h.toFixed(activeInstrument.decimals)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">24H OPEN</span>
          <span className="text-slate-300 font-medium">
            ${(activeInstrument.open24h || activeInstrument.currentPrice).toFixed(activeInstrument.decimals)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">NET CHANGE</span>
          <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isUp ? '+' : ''}{activeInstrument.change24h}%
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] block">FEED STATUS</span>
          <span className="text-amber-400/90 text-[11px] truncate block" title={goldApiNotice || goldDataSource}>
            {goldApiNotice ? 'Spot Vault Fallback' : 'Active Real-Time'}
          </span>
        </div>
      </div>

      {/* Main Fluid Canvas Chart Component */}
      <FluidLiveChart />

      {/* Chart Footer: Architectural Invariant Notes & Legend */}
      <div className="pt-3 mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-400 border-t border-[#161D2B]">
        {/* Indicators Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-amber-400 rounded-sm" />
            <span>SMA 20</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-cyan-400 rounded-sm" />
            <span>EMA 50</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-blue-500 rounded-sm" />
            <span>VWAP Band</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-purple-400 rounded-sm" />
            <span>Purple Key Zones</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-emerald-500/40 rounded-sm" />
            <span>Volume Histogram</span>
          </div>
        </div>

        {/* Real-Data Disclosure */}
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
          <span>Complies with MetaTrader 5 & TradingView data-space viewport invariants.</span>
        </div>
      </div>

    </div>
  );
};
