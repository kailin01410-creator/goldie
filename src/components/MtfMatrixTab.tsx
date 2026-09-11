import React from 'react';
import { 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  CheckCircle2, 
  Flame, 
  BarChart2, 
  Zap, 
  ArrowRight,
  Radio
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

export const MtfMatrixTab: React.FC = () => {
  const { 
    activeInstrument, 
    mtfMetrics, 
    instruments, 
    setActiveSymbol, 
    isLiveFeedActive,
    lastTickTime,
  } = useTrading();

  // Calculate overall confluence direction
  const bullCount = mtfMetrics.filter(m => m.trend.includes('BULL')).length;
  const bearCount = mtfMetrics.filter(m => m.trend.includes('BEAR')).length;
  const overallTrend = bullCount >= 4 ? 'STRONG BULLISH CONFLUENCE' : bearCount >= 4 ? 'STRONG BEARISH CONFLUENCE' : 'MIXED / CONSOLIDATION';

  return (
    <div className="space-y-4">
      
      {/* Top Banner: MTF Confluence Overview */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white font-mono">
                  {activeInstrument.symbol} Multi-Timeframe % Matrix
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  MT5 / TV PROTOCOL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live calculated percentage changes, indicator confluences, and structural biases across 6 timeframes.
              </p>
            </div>
          </div>

          {/* Aggregated MTF Confluence Score Card */}
          <div className="bg-[#0B0E14] border border-[#1E2638] px-4 py-2.5 rounded-lg flex items-center gap-3">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">MTF Directional Bias</span>
              <span className={`text-xs font-mono font-black ${
                bullCount >= 4 ? 'text-emerald-400' : bearCount >= 4 ? 'text-rose-400' : 'text-amber-300'
              }`}>
                {overallTrend}
              </span>
            </div>
            <div className="h-7 w-px bg-[#1E2638]" />
            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-400 block">Bull vs Bear</span>
              <span className="text-xs font-bold text-slate-200">
                <span className="text-emerald-400">{bullCount} Bull</span> / <span className="text-rose-400">{bearCount} Bear</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Timeframe Matrix Table */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 bg-[#0E131D] border-b border-[#1E2638] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Live Timeframe Matrix (1M • 5M • 15M • 1H • 4H • 1D)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Tick synced • {new Date(lastTickTime).toLocaleTimeString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E2638] text-slate-400 text-[11px] bg-[#0B0E14]/60">
                <th className="py-3 px-4">Timeframe</th>
                <th className="py-3 px-4">Live % Change</th>
                <th className="py-3 px-4">Change in Pips</th>
                <th className="py-3 px-4">Trend Status</th>
                <th className="py-3 px-4">RSI (14)</th>
                <th className="py-3 px-4">EMA Alignment</th>
                <th className="py-3 px-4">VWAP Position</th>
                <th className="py-3 px-4">Volume Delta</th>
                <th className="py-3 px-4">Confluence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2234]">
              {mtfMetrics.map(metric => {
                const isPositive = metric.changePercent >= 0;
                return (
                  <tr key={metric.timeframe} className="hover:bg-[#161F30]/60 transition-colors">
                    {/* Timeframe Label */}
                    <td className="py-3 px-4 font-bold text-white">
                      <span className="px-2 py-1 rounded bg-[#0B0E14] border border-[#232D42] text-amber-300">
                        {metric.label}
                      </span>
                    </td>

                    {/* Live % Change */}
                    <td className="py-3 px-4 font-bold">
                      <div className="flex items-center gap-1.5">
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={`px-1.5 py-0.5 rounded ${
                          isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}>
                          {isPositive ? '+' : ''}{metric.changePercent}%
                        </span>
                      </div>
                    </td>

                    {/* Change in Pips */}
                    <td className="py-3 px-4 font-semibold">
                      <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPositive ? '+' : ''}{metric.changePips} pips
                      </span>
                    </td>

                    {/* Trend Status */}
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        metric.trend === 'STRONG_BULL'
                          ? 'bg-emerald-500 text-black'
                          : metric.trend === 'BULL'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : metric.trend === 'STRONG_BEAR'
                          ? 'bg-rose-500 text-white'
                          : metric.trend === 'BEAR'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {metric.trend.replace('_', ' ')}
                      </span>
                    </td>

                    {/* RSI */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          metric.rsi > 70 ? 'text-rose-400' : metric.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'
                        }`}>
                          {metric.rsi}
                        </span>
                        <div className="w-12 h-1.5 bg-[#0B0E14] rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className={`h-full ${metric.rsi > 50 ? 'bg-emerald-400' : 'bg-rose-400'}`} 
                            style={{ width: `${metric.rsi}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* EMA Alignment */}
                    <td className="py-3 px-4">
                      <span className={`text-[11px] ${
                        metric.emaCross === 'BULLISH' ? 'text-emerald-400' : metric.emaCross === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                      }`}>
                        {metric.emaCross === 'BULLISH' ? '9 > 21 > 50 Bullish' : metric.emaCross === 'BEARISH' ? '9 < 21 < 50 Bearish' : 'Consolidating'}
                      </span>
                    </td>

                    {/* VWAP */}
                    <td className="py-3 px-4">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                        metric.vwapStatus === 'ABOVE' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {metric.vwapStatus === 'ABOVE' ? 'Above VWAP' : 'Below VWAP'}
                      </span>
                    </td>

                    {/* Volume Delta */}
                    <td className="py-3 px-4">
                      <span className={metric.volumeBias === 'ACCUMULATION' ? 'text-emerald-400' : 'text-rose-400'}>
                        {metric.volumeBias}
                      </span>
                    </td>

                    {/* Confluence Score */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-300">{metric.confluenceScore}%</span>
                        <div className="w-10 h-1.5 bg-[#0B0E14] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-400" 
                            style={{ width: `${metric.confluenceScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Asset Screener: All Instruments side-by-side MTF grid like TradingView */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl overflow-hidden shadow-lg">
        <div className="px-4 py-3 bg-[#0E131D] border-b border-[#1E2638] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-mono font-bold text-white uppercase">
              Full Watchlist Multi-Timeframe Screener (TradingView / MT4 Grid)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Click any row to load into Scalper</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E2638] text-slate-400 text-[11px] bg-[#0B0E14]/40">
                <th className="py-2.5 px-4">Asset</th>
                <th className="py-2.5 px-3">Live Price</th>
                <th className="py-2.5 px-3">Spread</th>
                <th className="py-2.5 px-3">1M %</th>
                <th className="py-2.5 px-3">5M %</th>
                <th className="py-2.5 px-3">15M %</th>
                <th className="py-2.5 px-3">1H %</th>
                <th className="py-2.5 px-3">4H %</th>
                <th className="py-2.5 px-3">Daily (24h)</th>
                <th className="py-2.5 px-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2234]">
              {instruments.map(inst => {
                const isCurrent = inst.symbol === activeInstrument.symbol;
                return (
                  <tr 
                    key={inst.symbol} 
                    onClick={() => setActiveSymbol(inst.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isCurrent ? 'bg-amber-500/10' : 'hover:bg-[#161F30]'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      <span>{inst.symbol}</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {inst.currentPrice.toFixed(inst.decimals)}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {inst.spreadPips}p
                    </td>
                    
                    {/* Simulated live MTF columns */}
                    <td className="py-3 px-3">
                      <span className={inst.change24h * 0.12 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {inst.change24h * 0.12 >= 0 ? '+' : ''}{(inst.change24h * 0.12).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={inst.change24h * 0.28 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {inst.change24h * 0.28 >= 0 ? '+' : ''}{(inst.change24h * 0.28).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={inst.change24h * 0.45 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {inst.change24h * 0.45 >= 0 ? '+' : ''}{(inst.change24h * 0.45).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={inst.change24h * 0.72 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {inst.change24h * 0.72 >= 0 ? '+' : ''}{(inst.change24h * 0.72).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={inst.change24h * 0.88 >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {inst.change24h * 0.88 >= 0 ? '+' : ''}{(inst.change24h * 0.88).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span className={`px-1.5 py-0.5 rounded ${inst.change24h >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {inst.change24h >= 0 ? '+' : ''}{inst.change24h}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSymbol(inst.symbol);
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-[#0B0E14] hover:bg-amber-500 hover:text-black text-slate-300 border border-[#232D42] transition-colors"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
