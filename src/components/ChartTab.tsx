import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Layers, 
  Eye, 
  EyeOff, 
  TrendingUp, 
  TrendingDown, 
  Maximize2,
  DollarSign,
  Globe
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { TimeframeId } from '../types';
import { calculateEMA, calculateVWAP } from '../utils/technicalAnalysis';
import { computeChartSessionZones, getTimestampSession } from '../utils/sessionManager';
import { TradingSessionHeaderCard } from './TradingSessionHeaderCard';

export const ChartTab: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    timeframe, 
    setTimeframe, 
    activeScalpSignal,
    executeScalpOrder,
    goldSpreadPips,
    setIsXmModalOpen,
    currentSession,
  } = useTrading();

  // Indicator toggles
  const [showSessions, setShowSessions] = useState<boolean>(true);
  const [showEMA, setShowEMA] = useState<boolean>(true);
  const [showVWAP, setShowVWAP] = useState<boolean>(true);
  const [showOrderBlocks, setShowOrderBlocks] = useState<boolean>(true);
  const [showSignalLevels, setShowSignalLevels] = useState<boolean>(true);
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null);

  // Timeframes available
  const timeframes: TimeframeId[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  // Calculate EMA lines for closes
  const closes = useMemo(() => candles.map(c => c.close), [candles]);
  const ema9 = useMemo(() => calculateEMA(closes, 9), [closes]);
  const ema21 = useMemo(() => calculateEMA(closes, 21), [closes]);
  const vwapData = useMemo(() => calculateVWAP(candles), [candles]);

  // Chart dimensions & scaling
  const chartHeight = 360;
  const chartWidth = 720;
  const paddingY = 25;
  const paddingX = 15;

  const minPrice = useMemo(() => {
    if (candles.length === 0) return 0;
    return Math.min(...candles.map(c => c.low)) * 0.999;
  }, [candles]);

  const maxPrice = useMemo(() => {
    if (candles.length === 0) return 1;
    return Math.max(...candles.map(c => c.high)) * 1.001;
  }, [candles]);

  const priceRange = maxPrice - minPrice || 1;

  // Convert price to SVG Y coordinate
  const getY = (price: number) => {
    return chartHeight - paddingY - ((price - minPrice) / priceRange) * (chartHeight - paddingY * 2);
  };

  // Convert index to SVG X coordinate
  const getX = (index: number) => {
    const usableWidth = chartWidth - paddingX * 2;
    return paddingX + (index / (candles.length - 1 || 1)) * usableWidth;
  };

  // Build SVG path for EMA
  const ema9Path = useMemo(() => {
    if (ema9.length === 0) return '';
    return ema9.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }, [ema9, minPrice, maxPrice]);

  const ema21Path = useMemo(() => {
    if (ema21.length === 0) return '';
    return ema21.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(val).toFixed(1)}`).join(' ');
  }, [ema21, minPrice, maxPrice]);

  // Simulated Order Book levels
  const depthBids = useMemo(() => {
    const current = activeInstrument.bid;
    const step = activeInstrument.spreadPips / activeInstrument.pipMultiplier;
    return [
      { price: current, volume: 14.8 },
      { price: current - step, volume: 22.4 },
      { price: current - step * 2, volume: 38.1 },
      { price: current - step * 3, volume: 51.6 },
      { price: current - step * 4, volume: 84.2 },
    ];
  }, [activeInstrument]);

  const depthAsks = useMemo(() => {
    const current = activeInstrument.ask;
    const step = activeInstrument.spreadPips / activeInstrument.pipMultiplier;
    return [
      { price: current, volume: 12.5 },
      { price: current + step, volume: 19.3 },
      { price: current + step * 2, volume: 31.0 },
      { price: current + step * 3, volume: 44.8 },
      { price: current + step * 4, volume: 76.5 },
    ];
  }, [activeInstrument]);

  const activeCandle = hoveredCandle !== null && candles[hoveredCandle] 
    ? candles[hoveredCandle] 
    : candles[candles.length - 1];

  // Calculate contiguous session zones for background chart shading
  const sessionZones = useMemo(() => {
    return computeChartSessionZones(candles, getX, currentSession.primaryActiveSessionId);
  }, [candles, chartWidth, currentSession.primaryActiveSessionId]);

  // Session of the hovered or current active candle
  const activeCandleSession = useMemo(() => {
    if (!activeCandle) return null;
    return getTimestampSession(activeCandle.time);
  }, [activeCandle]);

  return (
    <div className="space-y-4">
      {/* Real-time Institutional Trading Session Context Ribbon */}
      <TradingSessionHeaderCard compact={false} />
      
      {/* Chart Controls Header */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-3 sm:p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Symbol & Timeframes */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-white font-mono font-bold text-base">{activeInstrument.symbol}</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
            </span>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex items-center bg-[#0B0E14] border border-[#1E2638] rounded-lg p-0.5">
            {timeframes.map(tf => (
              <button
                key={tf}
                id={`chart-tf-${tf}`}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                  timeframe === tf
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Technical Overlays Toggle Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowSessions(!showSessions)}
            title="Toggle Asia, London, NY session background zones on chart"
            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-all flex items-center gap-1.5 cursor-pointer ${
              showSessions 
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold shadow-sm shadow-indigo-500/10' 
                : 'bg-[#0B0E14] text-slate-400 border-[#1E2638]'
            }`}
          >
            <Globe className="w-3 h-3 text-indigo-400" />
            <span>Sessions (Asia/LDN/NY)</span>
          </button>
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
              showEMA ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-[#0B0E14] text-slate-400 border-[#1E2638]'
            }`}
          >
            EMA (9/21)
          </button>
          <button
            onClick={() => setShowVWAP(!showVWAP)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
              showVWAP ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-[#0B0E14] text-slate-400 border-[#1E2638]'
            }`}
          >
            VWAP 2σ
          </button>
          <button
            onClick={() => setShowOrderBlocks(!showOrderBlocks)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
              showOrderBlocks ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'bg-[#0B0E14] text-slate-400 border-[#1E2638]'
            }`}
          >
            SMC Blocks
          </button>
          <button
            onClick={() => setShowSignalLevels(!showSignalLevels)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
              showSignalLevels ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'bg-[#0B0E14] text-slate-400 border-[#1E2638]'
            }`}
          >
            Signal SL/TP
          </button>
        </div>

      </div>

      {/* Main Chart Area + Depth Ladder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Candlestick Canvas / SVG Area (3 cols) */}
        <div className="lg:col-span-3 bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-xl relative flex flex-col justify-between">
          
          {/* Active Candle Hover Bar */}
          {activeCandle && (
            <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-400 pb-3 border-b border-[#1E2638] mb-2 flex-wrap">
              <div className="flex items-center gap-3.5 flex-wrap">
                <span>Time: <strong className="text-slate-200">{new Date(activeCandle.time).toLocaleTimeString()}</strong></span>
                {activeCandleSession && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#161F30] border border-[#232F46]">
                    <span className="text-[10px] text-slate-400">Session:</span>
                    <strong className="text-[11px]" style={{ color: activeCandleSession.color }}>
                      {activeCandleSession.flag} {activeCandleSession.shortLabel}
                    </strong>
                  </span>
                )}
                <span>O: <strong className="text-white">{activeCandle.open}</strong></span>
                <span>H: <strong className="text-emerald-400">{activeCandle.high}</strong></span>
                <span>L: <strong className="text-rose-400">{activeCandle.low}</strong></span>
                <span>C: <strong className="text-white">{activeCandle.close}</strong></span>
                <span>Vol: <strong className="text-amber-400">{(activeCandle.volume ?? 0).toLocaleString()}</strong></span>
              </div>
              
              {activeInstrument.symbol === 'XAU/USD' && (
                <button
                  type="button"
                  onClick={() => setIsXmModalOpen(true)}
                  title="Calibrate XM Gold Spread to match demo terminal"
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-mono transition-colors cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>XM Spread: <strong>{activeInstrument.spreadPips.toFixed(1)}p</strong> (${(activeInstrument.spreadPips / activeInstrument.pipMultiplier).toFixed(2)})</span>
                </button>
              )}
            </div>
          )}

          {/* SVG Canvas Rendering */}
          <div className="relative w-full overflow-hidden">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-[320px] sm:h-[380px] select-none"
            >
              {/* Contiguous Trading Session Shading Zones */}
              {showSessions && sessionZones.map((zone, idx) => (
                <g key={`session-zone-${idx}`}>
                  {/* Colored background band */}
                  <rect 
                    x={zone.xStart} 
                    y={paddingY} 
                    width={zone.width} 
                    height={chartHeight - paddingY * 2} 
                    fill={zone.fillColor} 
                  />
                  {/* Boundary lines */}
                  <line 
                    x1={zone.xStart} 
                    y1={paddingY} 
                    x2={zone.xStart} 
                    y2={chartHeight - paddingY} 
                    stroke={zone.color} 
                    strokeWidth={zone.isCurrentActive ? "1.5" : "0.75"} 
                    strokeOpacity={zone.isCurrentActive ? "0.6" : "0.25"} 
                    strokeDasharray={zone.isCurrentActive ? "none" : "3 3"} 
                  />
                  {/* Top accent border bar */}
                  <line 
                    x1={zone.xStart} 
                    y1={paddingY} 
                    x2={zone.xEnd} 
                    y2={paddingY} 
                    stroke={zone.color} 
                    strokeWidth={zone.isCurrentActive ? "2.5" : "1"} 
                    strokeOpacity={zone.isCurrentActive ? "0.9" : "0.4"} 
                  />
                  {/* Top session label text */}
                  {zone.width > 35 && (
                    <text 
                      x={zone.xStart + 5} 
                      y={paddingY + 11} 
                      fill={zone.color} 
                      fontSize="9" 
                      fontFamily="monospace" 
                      fontWeight="bold" 
                      opacity={zone.isCurrentActive ? "1" : "0.7"}
                    >
                      {zone.shortLabel} {zone.isCurrentActive ? '●' : ''}
                    </text>
                  )}
                </g>
              ))}

              {/* Background grid lines */}
              {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => {
                const y = paddingY + ratio * (chartHeight - paddingY * 2);
                const priceLevel = maxPrice - ratio * priceRange;
                return (
                  <g key={i}>
                    <line 
                      x1={paddingX} 
                      y1={y} 
                      x2={chartWidth - paddingX} 
                      y2={y} 
                      stroke="#1E2638" 
                      strokeDasharray="3 3" 
                      strokeWidth="1" 
                    />
                    <text 
                      x={chartWidth - 5} 
                      y={y + 3} 
                      fill="#64748B" 
                      fontSize="9" 
                      fontFamily="monospace" 
                      textAnchor="end"
                    >
                      {priceLevel.toFixed(activeInstrument.decimals)}
                    </text>
                  </g>
                );
              })}

              {/* SMC Order Blocks Zones */}
              {showOrderBlocks && candles.map((c, idx) => {
                if (!c.orderBlock) return null;
                const x = getX(idx);
                const yTop = getY(c.high);
                const yBottom = getY(c.low);
                const isBull = c.orderBlock === 'BULLISH_OB';
                return (
                  <rect
                    key={`ob-${idx}`}
                    x={x - 6}
                    y={Math.min(yTop, yBottom)}
                    width={50}
                    height={Math.max(4, Math.abs(yBottom - yTop))}
                    fill={isBull ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
                    stroke={isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                );
              })}

              {/* VWAP line and bands */}
              {showVWAP && vwapData.vwap > 0 && (
                <>
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.vwap)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.vwap)}
                    stroke="#F59E0B"
                    strokeWidth="1.2"
                  />
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.upperBand)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.upperBand)}
                    stroke="#06B6D4"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={paddingX}
                    y1={getY(vwapData.lowerBand)}
                    x2={chartWidth - paddingX}
                    y2={getY(vwapData.lowerBand)}
                    stroke="#06B6D4"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                </>
              )}

              {/* EMA 9 and 21 curves */}
              {showEMA && ema9Path && (
                <path d={ema9Path} fill="none" stroke="#38BDF8" strokeWidth="1.5" />
              )}
              {showEMA && ema21Path && (
                <path d={ema21Path} fill="none" stroke="#F97316" strokeWidth="1.5" />
              )}

              {/* Candlesticks */}
              {candles.map((candle, idx) => {
                const x = getX(idx);
                const yOpen = getY(candle.open);
                const yClose = getY(candle.close);
                const yHigh = getY(candle.high);
                const yLow = getY(candle.low);
                const isBull = candle.close >= candle.open;
                const candleColor = isBull ? '#10B981' : '#EF4444';
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(2, Math.abs(yOpen - yClose));
                const candleWidth = Math.max(3, (chartWidth / candles.length) * 0.65);

                return (
                  <g 
                    key={candle.time} 
                    onMouseEnter={() => setHoveredCandle(idx)}
                    onMouseLeave={() => setHoveredCandle(null)}
                    className="cursor-crosshair"
                  >
                    {/* Wick */}
                    <line 
                      x1={x} 
                      y1={yHigh} 
                      x2={x} 
                      y2={yLow} 
                      stroke={candleColor} 
                      strokeWidth="1.2" 
                    />
                    {/* Body */}
                    <rect 
                      x={x - candleWidth / 2} 
                      y={bodyY} 
                      width={candleWidth} 
                      height={bodyHeight} 
                      fill={candleColor} 
                      rx="1" 
                    />
                  </g>
                );
              })}

              {/* Active Scalp Signal Levels (Entry, SL, TP) */}
              {showSignalLevels && activeScalpSignal && activeScalpSignal.symbol === activeInstrument.symbol && (
                <g>
                  {/* Entry Line */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.entryPrice)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.entryPrice)} 
                    stroke="#F59E0B" 
                    strokeWidth="1.5" 
                    strokeDasharray="5 3" 
                  />
                  <text 
                    x={paddingX + 5} 
                    y={getY(activeScalpSignal.entryPrice) - 4} 
                    fill="#F59E0B" 
                    fontSize="10" 
                    fontFamily="monospace" 
                    fontWeight="bold"
                  >
                    ENTRY: {activeScalpSignal.entryPrice}
                  </text>

                  {/* Stop Loss Line */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.stopLoss)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.stopLoss)} 
                    stroke="#EF4444" 
                    strokeWidth="1.5" 
                  />
                  <text 
                    x={paddingX + 5} 
                    y={getY(activeScalpSignal.stopLoss) - 4} 
                    fill="#EF4444" 
                    fontSize="10" 
                    fontFamily="monospace" 
                    fontWeight="bold"
                  >
                    SL: {activeScalpSignal.stopLoss} (-{activeScalpSignal.riskPips}p)
                  </text>

                  {/* TP 1 Line */}
                  <line 
                    x1={paddingX} 
                    y1={getY(activeScalpSignal.takeProfit1)} 
                    x2={chartWidth - paddingX} 
                    y2={getY(activeScalpSignal.takeProfit1)} 
                    stroke="#10B981" 
                    strokeWidth="1.5" 
                  />
                  <text 
                    x={paddingX + 5} 
                    y={getY(activeScalpSignal.takeProfit1) - 4} 
                    fill="#10B981" 
                    fontSize="10" 
                    fontFamily="monospace" 
                    fontWeight="bold"
                  >
                    TP1: {activeScalpSignal.takeProfit1} (+{activeScalpSignal.tp1Pips}p)
                  </text>
                </g>
              )}

              {/* Current Price Ticker Bar */}
              <line 
                x1={paddingX} 
                y1={getY(activeInstrument.currentPrice)} 
                x2={chartWidth - paddingX} 
                y2={getY(activeInstrument.currentPrice)} 
                stroke={activeInstrument.tickDirection === 'UP' ? '#10B981' : '#EF4444'} 
                strokeWidth="1.5" 
              />
            </svg>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400 pt-2 border-t border-[#1E2638] flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> EMA 9</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> EMA 21</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> VWAP Baseline</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Take Profit Target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Invalidation Stop Loss</span>
            {showSessions && (
              <>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Asia Session</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> London Session</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> New York Session</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> LDN/NY Overlap</span>
              </>
            )}
          </div>

        </div>

        {/* Right Column: Market Depth (DOM) & Quick Trade */}
        <div className="space-y-4">
          
          {/* Order Book / Market Depth */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-[#1E2638] mb-2">
              <span className="text-slate-300 font-bold uppercase">Market Depth</span>
              <span className="text-[10px] text-amber-400">Spread: {activeInstrument.spreadPips}p</span>
            </div>

            {/* Asks (Sellers) */}
            <div className="space-y-1 mb-2">
              {depthAsks.map((ask, i) => (
                <div key={i} className="flex justify-between items-center relative py-0.5 px-1">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded" 
                    style={{ width: `${(ask.volume / 80) * 100}%` }}
                  />
                  <span className="text-rose-400 font-bold z-10">{ask.price.toFixed(activeInstrument.decimals)}</span>
                  <span className="text-slate-400 z-10">{ask.volume} lots</span>
                </div>
              ))}
            </div>

            {/* Spread Divider */}
            <div className="py-1.5 px-2 rounded bg-[#0B0E14] border border-[#1E2638] text-center my-2 font-bold text-white flex justify-between">
              <span className="text-slate-400 text-[10px]">SPREAD</span>
              <span className="text-amber-300">{activeInstrument.spreadPips} PIPS</span>
            </div>

            {/* Bids (Buyers) */}
            <div className="space-y-1">
              {depthBids.map((bid, i) => (
                <div key={i} className="flex justify-between items-center relative py-0.5 px-1">
                  <div 
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded" 
                    style={{ width: `${(bid.volume / 80) * 100}%` }}
                  />
                  <span className="text-emerald-400 font-bold z-10">{bid.price.toFixed(activeInstrument.decimals)}</span>
                  <span className="text-slate-400 z-10">{bid.volume} lots</span>
                </div>
              ))}
            </div>

          </div>

          {/* Quick 1-Click Scalp from Chart */}
          {activeScalpSignal && (
            <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
              <div className="text-slate-300 font-bold uppercase mb-2">Quick Signal Execution</div>
              <p className="text-[11px] text-slate-400 mb-3">
                Pre-backtested scalp signal ready for <strong>{activeScalpSignal.symbol}</strong>.
              </p>
              <button
                onClick={() => executeScalpOrder(activeScalpSignal, 1.0)}
                className={`w-full py-2.5 rounded-lg font-bold uppercase text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer ${
                  activeScalpSignal.direction === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                }`}
              >
                <DollarSign className="w-4 h-4 font-bold" />
                <span>Execute 1.0 Lot ({activeScalpSignal.direction})</span>
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
