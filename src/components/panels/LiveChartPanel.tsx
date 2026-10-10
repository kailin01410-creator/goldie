import React from 'react';
import { 
  Activity,
  ShieldCheck,
  Zap,
  Globe,
  Bell
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { FluidLiveChart } from '../chart/FluidLiveChart';

export const LiveChartPanel: React.FC = () => {
  const { 
    activeInstrument, 
    goldDataSource,
    isMarketClosed,
    goldApiKey,
    goldApiNotice,
    marketDataNotice,
    marketQuoteAvailable,
    marketQuoteMetricsAvailable,
    setIsPriceAlertModalOpen,
    lastTickTime,
    lastGoldSyncTime,
    goldSpreadPips
  } = useTrading();

  const isFxInstrument = activeInstrument.category === 'FOREX_MAJOR';
  const hasLiveQuote = !isFxInstrument || marketQuoteAvailable;
  const hasDailyMetrics = !isFxInstrument || marketQuoteMetricsAvailable;
  const quoteCurrency = activeInstrument.quoteCurrency || 'USD';
  const hasQuoteWarning = isFxInstrument && (!marketQuoteAvailable || Boolean(marketDataNotice));
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
              <span>Panel 1: {activeInstrument.category === 'METALS' ? 'Live Gold Price Chart' : 'Live Market Chart'}</span>
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
            <span className={`w-2 h-2 rounded-full ${hasLiveQuote ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="text-slate-300" title={goldDataSource}>
              {goldDataSource}
            </span>
          </div>

          {/* Quick Set Price Alert Button */}
          <button
            type="button"
            onClick={() => setIsPriceAlertModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 hover:border-amber-400 text-amber-300 font-mono text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Set Target Price Alert for XAU/USD"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Set Alert</span>
          </button>

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

      {/* Primary Quote Bar: Current Price, High, Low, Open, Close, % Change, Bid/Ask & Pips */}
      {(() => {
        const currentPrice = activeInstrument.currentPrice || 4193.35;
        const decimals = activeInstrument.decimals ?? 2;
        const openPrice = activeInstrument.open24h && activeInstrument.open24h > 0
          ? activeInstrument.open24h
          : currentPrice;
        
        const changeDollars = currentPrice - openPrice;
        const changePct = activeInstrument.change24h !== undefined && activeInstrument.change24h !== null && activeInstrument.change24h !== 0
          ? Number(activeInstrument.change24h)
          : Number(((changeDollars / openPrice) * 100).toFixed(2));
        const changePips = activeInstrument.change24hPips !== undefined && activeInstrument.change24hPips !== null && activeInstrument.change24hPips !== 0
          ? Number(activeInstrument.change24hPips)
          : Number((changeDollars * (activeInstrument.pipMultiplier || 10)).toFixed(1));

        const high24h = hasDailyMetrics ? Math.max(activeInstrument.high24h || currentPrice, currentPrice) : currentPrice;
        const low24h = hasDailyMetrics ? Math.min(activeInstrument.low24h || currentPrice, currentPrice) : currentPrice;
        const isBullish = changeDollars >= 0;

        const fallbackSpread = Math.max(0, activeInstrument.spreadPips / Math.max(1, activeInstrument.pipMultiplier));
        const bidPrice = activeInstrument.bid || Number((currentPrice - fallbackSpread / 2).toFixed(decimals));
        const askPrice = activeInstrument.ask || Number((currentPrice + fallbackSpread / 2).toFixed(decimals));
        const spreadDollars = Math.abs(askPrice - bidPrice);
        const spreadPips = Number((spreadDollars * (activeInstrument.pipMultiplier || 10)).toFixed(1));

        const rangeTotal = Math.max(high24h - low24h, 1.0);
        const rangeProgress = Math.min(100, Math.max(0, ((currentPrice - low24h) / rangeTotal) * 100));

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 py-2.5 px-3 mb-3 bg-[#090E17] border border-[#182133] rounded-xl text-xs font-mono shadow-inner">
            {/* 1. Spot Price */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] block font-semibold">CURRENT SPOT</span>
                <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">{activeInstrument.symbol}</span>
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-base sm:text-lg font-extrabold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hasLiveQuote ? `${quoteCurrency} ${currentPrice.toFixed(decimals)}` : '—'}
                </span>
                <span className={`text-xs font-bold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {hasDailyMetrics ? (isBullish ? '▲' : '▼') : '–'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">
                Tick: {hasLiveQuote ? activeInstrument.tickDirection : '—'} • {quoteCurrency} quote
              </span>
            </div>

            {/* 2. Net Change ($ / % / Pips) */}
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">DAILY CHANGE ({quoteCurrency} / %)</span>
              <div className={`font-bold flex items-baseline gap-1 mt-0.5 ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className="text-sm">{hasDailyMetrics ? `${isBullish ? '+' : ''}${quoteCurrency} ${Math.abs(changeDollars).toFixed(2)}` : '—'}</span>
                <span className="text-[11px] px-1 rounded bg-slate-800/80 border border-slate-700/50">
                  {hasDailyMetrics ? `${isBullish ? '+' : ''}${changePct.toFixed(2)}%` : '—'}
                </span>
              </div>
              <span className={`text-[10px] font-semibold block ${isBullish ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                {hasDailyMetrics ? `${isBullish ? '+' : ''}${changePips.toFixed(1)} Pips` : 'Daily change unavailable'}
              </span>
            </div>

            {/* 3. Bid / Ask & Spread */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] block font-semibold">BID / ASK & SPREAD</span>
                <span className="text-[9px] text-cyan-400 font-bold">{hasLiveQuote ? `${spreadPips.toFixed(1)} Pips` : '—'}</span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5 text-[11px]">
                <span className="text-emerald-400 font-bold">{hasLiveQuote ? `${quoteCurrency} ${bidPrice.toFixed(decimals)}` : '—'}</span>
                <span className="text-slate-500 font-normal">/</span>
                <span className="text-rose-400 font-bold">{hasLiveQuote ? `${quoteCurrency} ${askPrice.toFixed(decimals)}` : '—'}</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {hasLiveQuote ? `Broker spread model: ${quoteCurrency} ${spreadDollars.toFixed(decimals)}` : 'Spread unavailable'}
              </span>
            </div>

            {/* 4. 24H High & Range Progress */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] block font-semibold">24H HIGH / LOW</span>
                <span className="text-[9px] text-slate-400">Position: {hasDailyMetrics ? `${rangeProgress.toFixed(0)}%` : '—'}</span>
              </div>
              <div className="flex items-baseline justify-between mt-0.5 text-[11px] text-slate-200">
                <span className="font-bold text-emerald-400/90">H: {hasDailyMetrics ? `${quoteCurrency} ${high24h.toFixed(decimals)}` : '—'}</span>
                <span className="font-bold text-rose-400/90">L: {hasDailyMetrics ? `${quoteCurrency} ${low24h.toFixed(decimals)}` : '—'}</span>
              </div>
              {/* Mini Range Bar */}
              <div className="w-full bg-[#151D2C] h-1.5 rounded-full overflow-hidden mt-1 relative">
                <div 
                  className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${rangeProgress}%` }}
                />
              </div>
            </div>

            {/* 5. 24H Open & Intraday Range */}
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">24H OPEN & RANGE</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-slate-200 font-bold text-sm">
                  {hasDailyMetrics ? `${quoteCurrency} ${openPrice.toFixed(decimals)}` : '—'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                {hasDailyMetrics ? `Daily range: ${quoteCurrency} ${(high24h - low24h).toFixed(decimals)} (${((high24h - low24h) * (activeInstrument.pipMultiplier || 10)).toFixed(0)} pips)` : 'Daily range unavailable'}
              </span>
            </div>

            {/* 6. Live Feed & Data Status */}
            <div>
              <span className="text-slate-400 text-[10px] block font-semibold">DATA FEED STATUS</span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${hasQuoteWarning ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                <span className={`font-bold text-[11px] truncate block ${hasQuoteWarning ? 'text-amber-300' : 'text-emerald-400'}`} title={goldDataSource}>
                  {isFxInstrument && !marketQuoteAvailable ? 'QUOTE UNAVAILABLE' : hasQuoteWarning ? 'LIMITED METRICS' : 'PROVIDER QUOTE'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5" title={goldDataSource}>
                Source: {goldDataSource}
              </span>
            </div>
          </div>
        );
      })()}

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
