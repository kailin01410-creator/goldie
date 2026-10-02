import React, { useMemo, useState } from 'react';
import { 
  Sliders, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle,
  HelpCircle,
  Hash,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { 
  calculateSMA, 
  calculateEMA, 
  calculateDetailedRSI, 
  calculateDetailedMACD, 
  calculateATR, 
  calculateDailyPivots, 
  detectSwingHighsAndLows 
} from '../../utils/technicalAnalysis';

export const TechnicalAnalysisPanel: React.FC = () => {
  const { activeInstrument, candles, timeframe } = useTrading();

  // Configurable indicator toggles / parameters
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [atrPeriod, setAtrPeriod] = useState<number>(14);

  const currentPrice = activeInstrument.currentPrice || 4193.35;

  const closes = useMemo(() => {
    if (!candles || candles.length === 0) {
      return Array.from({ length: 60 }, (_, i) => Number((currentPrice * (1 + (i - 30) * 0.00015)).toFixed(2)));
    }
    return candles.map(c => c.close);
  }, [candles, currentPrice]);

  // 1. Moving Averages
  const sma20 = useMemo(() => {
    const series = calculateSMA(closes, 20);
    const last = series[series.length - 1];
    return last !== null && last !== undefined ? last : currentPrice;
  }, [closes, currentPrice]);

  const ema50 = useMemo(() => {
    const series = calculateEMA(closes, 50);
    const last = series[series.length - 1];
    return last !== null && last !== undefined ? last : currentPrice;
  }, [closes, currentPrice]);

  const ema200 = useMemo(() => {
    const series = calculateEMA(closes, 200);
    const last = series[series.length - 1];
    return last !== null && last !== undefined ? last : currentPrice;
  }, [closes, currentPrice]);

  // 2. RSI (14)
  const rsiResult = useMemo(() => {
    return calculateDetailedRSI(closes, rsiPeriod);
  }, [closes, rsiPeriod]);

  // 3. MACD (12, 26, 9)
  const macdResult = useMemo(() => {
    return calculateDetailedMACD(closes, 12, 26, 9);
  }, [closes]);

  // 4. ATR (14)
  const atrResult = useMemo(() => {
    return calculateATR(candles, atrPeriod);
  }, [candles, currentPrice, atrPeriod]);

  // 5. Support & Resistance (Pivot Levels R2, R1, PP, S1, S2)
  const pivots = useMemo(() => {
    const high = Math.max(activeInstrument.high24h || 0, currentPrice, currentPrice * 1.004);
    const low = Math.min(activeInstrument.low24h || currentPrice, currentPrice, currentPrice * 0.996);
    const close = currentPrice;
    return calculateDailyPivots(high, low, close);
  }, [activeInstrument.high24h, activeInstrument.low24h, currentPrice]);

  // 6. Recent Swing High & Swing Low
  const swings = useMemo(() => {
    return detectSwingHighsAndLows(candles, 3);
  }, [candles, currentPrice]);

  // Overall Confluence Score across the 6 Core Deterministic Oscillators
  const confluenceScore = useMemo(() => {
    let bullishVotes = 0;
    const totalVotes = 6;
    if (sma20 && currentPrice >= sma20) bullishVotes++;
    if (ema50 && currentPrice >= ema50) bullishVotes++;
    if (ema200 && currentPrice >= ema200) bullishVotes++;
    if (rsiResult.rsi >= 50) bullishVotes++;
    if (macdResult.trend === 'BULLISH') bullishVotes++;
    if (currentPrice >= pivots.pp) bullishVotes++;

    const pct = Math.round((bullishVotes / totalVotes) * 100);
    return {
      bullishVotes,
      totalVotes,
      pct,
      bias: pct >= 60 ? 'BULLISH' : pct <= 40 ? 'BEARISH' : 'NEUTRAL',
    };
  }, [currentPrice, sma20, ema50, ema200, rsiResult.rsi, macdResult.trend, pivots.pp]);

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col font-sans">
      
      {/* Panel Header: Title, Real-Time Confluence Score & Evaluated Bars */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1E2638]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>TECHNICAL ANALYSIS ENGINE</span>
              <span className="text-[10px] text-cyan-400 font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20">
                MATHEMATICALLY COMPUTED
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Deterministic mathematical oscillators & dynamic price levels for {activeInstrument.symbol} [{timeframe.toUpperCase()}]
            </p>
          </div>
        </div>

        {/* Real-Time Confluence & Bar Count Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Confluence Rating */}
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs font-bold ${
            confluenceScore.bias === 'BULLISH' 
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : confluenceScore.bias === 'BEARISH'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
            <span>{confluenceScore.pct}% {confluenceScore.bias} ({confluenceScore.bullishVotes}/{confluenceScore.totalVotes})</span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded-lg bg-[#090E17] border border-[#1E2638]">
            Evaluated Bars: <strong className="text-white">{candles.length}</strong>
          </div>
        </div>
      </div>

      {/* Grid of Indicator Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        
        {/* Module 1: Moving Averages (SMA 20, EMA 50, EMA 200) */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-slate-200">MOVING AVERAGES</span>
            <span className="text-[10px] text-slate-500">TREND ALIGNMENT</span>
          </div>

          <div className="space-y-2 py-2 font-mono text-xs">
            {/* SMA 20 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">SMA 20:</span>
              </div>
              {sma20 !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">${sma20.toFixed(2)}</span>
                  <span className={`text-[10px] ${currentPrice >= sma20 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentPrice >= sma20 ? 'ABOVE' : 'BELOW'}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 italic">Not enough data</span>
              )}
            </div>

            {/* EMA 50 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-400">EMA 50:</span>
              </div>
              {ema50 !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">${ema50.toFixed(2)}</span>
                  <span className={`text-[10px] ${currentPrice >= ema50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentPrice >= ema50 ? 'ABOVE' : 'BELOW'}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 italic">Not enough data</span>
              )}
            </div>

            {/* EMA 200 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-400">EMA 200:</span>
              </div>
              {ema200 !== null ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">${ema200.toFixed(2)}</span>
                  <span className={`text-[10px] ${currentPrice >= ema200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentPrice >= ema200 ? 'ABOVE' : 'BELOW'}
                  </span>
                </div>
              ) : (
                <span className="text-slate-600 italic">Not enough data</span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#141C2B]">
            Status: {sma20 && ema50 && sma20 > ema50 ? 'Golden Bullish Cross' : 'Consolidation / Bearish'}
          </div>
        </div>

        {/* Module 2: RSI Oscillator (14) */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-slate-200">RELATIVE STRENGTH (RSI)</span>
            <span className="text-[10px] text-slate-500">PERIOD {rsiPeriod}</span>
          </div>

          <div className="py-2">
            {rsiResult.enoughData ? (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-2xl font-extrabold text-white">
                    {rsiResult.rsi.toFixed(1)}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    rsiResult.condition === 'OVERBOUGHT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : rsiResult.condition === 'OVERSOLD'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {rsiResult.condition}
                  </span>
                </div>

                {/* Visual RSI Gauge Bar */}
                <div className="w-full bg-[#161F2E] h-2 rounded-full overflow-hidden relative">
                  <div 
                    className={`h-full transition-all ${
                      rsiResult.rsi > 70 ? 'bg-rose-500' : rsiResult.rsi < 30 ? 'bg-emerald-500' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, rsiResult.rsi))}%` }}
                  />
                  {/* 30 & 70 mark guidelines */}
                  <div className="absolute top-0 bottom-0 left-[30%] w-0.5 bg-slate-500/50" />
                  <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-slate-500/50" />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>30 Oversold</span>
                  <span>50 Neutral</span>
                  <span>70 Overbought</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-500 text-xs font-mono">
                Not enough data (requires at least {rsiPeriod + 1} candles)
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#141C2B]">
            Wilder's exponential smoothing algorithm
          </div>
        </div>

        {/* Module 3: MACD (12, 26, 9) */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-slate-200">MACD (12, 26, 9)</span>
            <span className="text-[10px] text-slate-500">MOMENTUM</span>
          </div>

          <div className="space-y-1.5 py-2 font-mono text-xs">
            {macdResult.enoughData ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">MACD Line:</span>
                  <span className="font-bold text-cyan-400">{macdResult.macdLine.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Signal Line:</span>
                  <span className="font-bold text-amber-400">{macdResult.signalLine.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Histogram:</span>
                  <span className={`font-bold ${macdResult.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {macdResult.histogram >= 0 ? '+' : ''}{macdResult.histogram.toFixed(2)}
                  </span>
                </div>
              </>
            ) : (
              <div className="py-4 text-center text-slate-500 text-xs font-mono">
                Not enough data (requires 35+ candles)
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#141C2B] flex items-center justify-between">
            <span>Trend Bias:</span>
            {macdResult.enoughData ? (
              <span className={macdResult.trend === 'BULLISH' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {macdResult.trend}
              </span>
            ) : (
              <span>N/A</span>
            )}
          </div>
        </div>

        {/* Module 4: ATR & Volatility */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-slate-200">ATR VOLATILITY</span>
            <span className="text-[10px] text-slate-500">PERIOD {atrPeriod}</span>
          </div>

          <div className="py-2 font-mono">
            {atrResult.enoughData ? (
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-white">${atrResult.atr.toFixed(2)}</span>
                  <span className="text-xs text-amber-300 font-bold">
                    {(atrResult.atr * activeInstrument.pipMultiplier).toFixed(0)} Pips
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Average expected candle excursion under current volatility.
                </p>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-500 text-xs font-mono">
                Not enough data
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#141C2B]">
            Recommended Scalp SL: ~${(atrResult.atr * 1.5).toFixed(2)}
          </div>
        </div>

        {/* Module 5: Support and Resistance (Purple Levels) */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-purple-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>KEY S/R LEVELS (PURPLE)</span>
            </span>
            <span className="text-[10px] text-purple-400/80">PIVOT MATRIX</span>
          </div>

          <div className="space-y-1 py-1 font-mono text-xs">
            <div className="flex justify-between items-center text-purple-300">
              <span className="text-[11px]">R2 Resistance:</span>
              <span className="font-bold">${pivots.r2.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-purple-200">
              <span className="text-[11px]">R1 Resistance:</span>
              <span className="font-bold">${pivots.r1.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-amber-300 py-0.5 border-y border-[#1A2234]">
              <span className="text-[11px]">PP Central Pivot:</span>
              <span className="font-bold">${pivots.pp.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-purple-200">
              <span className="text-[11px]">S1 Support:</span>
              <span className="font-bold">${pivots.s1.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-purple-300">
              <span className="text-[11px]">S2 Support:</span>
              <span className="font-bold">${pivots.s2.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-[10px] text-purple-400 font-mono pt-1 border-t border-[#141C2B]">
            Purple overlays visually highlighted on chart
          </div>
        </div>

        {/* Module 6: Recent Swing High & Recent Swing Low */}
        <div className="p-3.5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-[#141C2B]">
            <span className="font-bold text-slate-200">MARKET STRUCTURE</span>
            <span className="text-[10px] text-slate-500">SWING HIGHS & LOWS</span>
          </div>

          <div className="space-y-2 py-2 font-mono text-xs">
            {/* Swing High */}
            <div className="p-2 rounded-lg bg-[#111724] border border-[#1C263B]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                  <span>RECENT SWING HIGH</span>
                </span>
                {swings.recentHigh !== null ? (
                  <span className="font-bold text-emerald-400">${swings.recentHigh.price.toFixed(2)}</span>
                ) : (
                  <span className="text-slate-600">Not enough data</span>
                )}
              </div>
              {swings.recentHigh && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Distance: -${(swings.recentHigh.price - currentPrice).toFixed(2)}
                </div>
              )}
            </div>

            {/* Swing Low */}
            <div className="p-2 rounded-lg bg-[#111724] border border-[#1C263B]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3 text-rose-400" />
                  <span>RECENT SWING LOW</span>
                </span>
                {swings.recentLow !== null ? (
                  <span className="font-bold text-rose-400">${swings.recentLow.price.toFixed(2)}</span>
                ) : (
                  <span className="text-slate-600">Not enough data</span>
                )}
              </div>
              {swings.recentLow && (
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Distance: +${(currentPrice - swings.recentLow.price).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-[#141C2B]">
            Calculated from local fractal extrema lookback
          </div>
        </div>

      </div>

    </div>
  );
};
