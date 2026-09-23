import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Grid,
  Maximize2,
  Minimize2,
  ChevronsRight,
  Move,
  BarChart2,
  LineChart as LineChartIcon,
  Key
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { TimeframeId, Candle } from '../types';
import { DominionTimeframeSelector } from './DominionTimeframeSelector';

type ChartType = 'CANDLE' | 'BAR' | 'LINE';

interface CrosshairMeasure {
  startX: number;
  startY: number;
  startPrice: number;
  startCandleIndex: number;
  currentX: number;
  currentY: number;
  currentPrice: number;
  currentCandleIndex: number;
}

export const ChartTab: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    timeframe, 
    setTimeframe, 
    isMarketClosed,
    marketClosureReason,
    goldApiKey,
    setIsGoldKeyModalOpen,
  } = useTrading();

  // MT5 Chart Controls State
  const [chartType, setChartType] = useState<ChartType>('CANDLE');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [crosshairActive, setCrosshairActive] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [chartShift, setChartShift] = useState<boolean>(true); // MT5 right indent
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Zoom & Pan State
  // visibleBarsCount determines the zoom level (e.g., 20 = zoomed in tight, 150 = zoomed out)
  const [visibleBarsCount, setVisibleBarsCount] = useState<number>(65);
  // scrollOffset: how many bars scrolled back from the latest candle (0 = at the very right / latest)
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // Crosshair & Hover Coordinate State
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredCandleIndex, setHoveredCandleIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragStartOffset, setDragStartOffset] = useState<number>(0);

  // Crosshair Drag Measuring Tool (MT5 distance ruler)
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measureData, setMeasureData] = useState<CrosshairMeasure | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // SVG ViewBox Dimensions
  const chartWidth = 1000;
  const chartHeight = 520;
  const priceAxisWidth = 80;
  const timeAxisHeight = 28;
  const paddingY = 24;

  // Usable chart plotting area
  const plotWidth = chartWidth - priceAxisWidth;
  const plotHeight = chartHeight - timeAxisHeight;

  // Chart shift margin (MT5 right indent: ~15% blank future space when enabled)
  const rightShiftBars = chartShift ? Math.round(visibleBarsCount * 0.12) : 1;

  // Slice visible candles according to scrollOffset and visibleBarsCount
  const totalCandles = candles.length;
  
  // Calculate window of candles to render
  const endIdx = Math.max(1, totalCandles - scrollOffset);
  const startIdx = Math.max(0, endIdx - visibleBarsCount);
  const visibleCandles = useMemo(() => {
    return candles.slice(startIdx, endIdx);
  }, [candles, startIdx, endIdx]);

  // Price Min & Max scaling for the currently visible window
  const { minPrice, maxPrice, priceRange, highestCandle, lowestCandle } = useMemo(() => {
    if (visibleCandles.length === 0) {
      const p = activeInstrument.currentPrice;
      return { 
        minPrice: p - 2, 
        maxPrice: p + 2, 
        priceRange: 4,
        highestCandle: null,
        lowestCandle: null
      };
    }

    let min = Infinity;
    let max = -Infinity;
    let highC: Candle | null = null;
    let lowC: Candle | null = null;

    visibleCandles.forEach(c => {
      if (c.high > max) {
        max = c.high;
        highC = c;
      }
      if (c.low < min) {
        min = c.low;
        lowC = c;
      }
    });

    // Also factor in current price if viewing the latest bar
    if (scrollOffset === 0) {
      max = Math.max(max, activeInstrument.currentPrice);
      min = Math.min(min, activeInstrument.currentPrice);
    }

    const range = Math.max(0.4, max - min);
    // Add 8% vertical breathing padding top and bottom like MT5
    const paddedMin = min - range * 0.08;
    const paddedMax = max + range * 0.08;

    return {
      minPrice: paddedMin,
      maxPrice: paddedMax,
      priceRange: Math.max(0.5, paddedMax - paddedMin),
      highestCandle: highC,
      lowestCandle: lowC,
    };
  }, [visibleCandles, activeInstrument.currentPrice, scrollOffset]);

  // Coordinate Conversion Functions
  const getY = useCallback((price: number) => {
    const usableH = plotHeight - paddingY * 2;
    return paddingY + ((maxPrice - price) / priceRange) * usableH;
  }, [plotHeight, paddingY, maxPrice, priceRange]);

  const getPriceFromY = useCallback((y: number) => {
    const usableH = plotHeight - paddingY * 2;
    const clampedY = Math.max(paddingY, Math.min(plotHeight - paddingY, y));
    const ratio = (clampedY - paddingY) / usableH;
    return maxPrice - ratio * priceRange;
  }, [plotHeight, paddingY, maxPrice, priceRange]);

  // Total slots on the X axis including the right shift margin
  const totalSlots = visibleBarsCount + rightShiftBars;
  const slotWidth = plotWidth / (totalSlots || 1);

  const getX = useCallback((visibleIndex: number) => {
    return visibleIndex * slotWidth + slotWidth * 0.5;
  }, [slotWidth]);

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    setVisibleBarsCount(prev => Math.max(16, Math.round(prev * 0.75)));
  };

  const handleZoomOut = () => {
    setVisibleBarsCount(prev => Math.min(Math.min(180, totalCandles || 180), Math.round(prev * 1.35)));
  };

  const handleResetZoom = () => {
    setVisibleBarsCount(65);
    setScrollOffset(0);
    setAutoScroll(true);
  };

  // Wheel Zoom (Zoom in/out with mouse wheel on chart)
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setVisibleBarsCount(prev => Math.max(16, Math.round(prev * 0.85)));
    } else if (e.deltaY > 0) {
      // Zoom out
      setVisibleBarsCount(prev => Math.min(Math.min(180, totalCandles || 180), Math.round(prev * 1.18)));
    }
  };

  // Mouse Drag / Pan & Crosshair Handling
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // If Shift key is pressed or user is clicking to measure:
    if (e.shiftKey) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
      const y = ((e.clientY - rect.top) / rect.height) * chartHeight;
      const price = getPriceFromY(y);
      const slot = Math.floor(x / slotWidth);
      const idx = Math.max(0, Math.min(visibleCandles.length - 1, slot));
      
      setIsMeasuring(true);
      setMeasureData({
        startX: x,
        startY: y,
        startPrice: price,
        startCandleIndex: idx,
        currentX: x,
        currentY: y,
        currentPrice: price,
        currentCandleIndex: idx,
      });
      return;
    }

    // Normal drag to pan
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartOffset(scrollOffset);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = ((e.clientX - rect.left) / rect.width) * chartWidth;
    const y = ((e.clientY - rect.top) / rect.height) * chartHeight;

    // Check if cursor is within the plotting area
    if (x >= 0 && x <= plotWidth && y >= 0 && y <= plotHeight) {
      setHoverPos({ x, y });
      const slot = Math.floor(x / slotWidth);
      if (slot >= 0 && slot < visibleCandles.length) {
        setHoveredCandleIndex(slot);
      } else {
        setHoveredCandleIndex(null);
      }
    } else {
      setHoverPos(null);
      setHoveredCandleIndex(null);
    }

    // Handle measuring drag
    if (isMeasuring && measureData) {
      const currentPrice = getPriceFromY(y);
      const slot = Math.floor(x / slotWidth);
      const idx = Math.max(0, Math.min(visibleCandles.length - 1, slot));
      setMeasureData({
        ...measureData,
        currentX: x,
        currentY: y,
        currentPrice,
        currentCandleIndex: idx,
      });
      return;
    }

    // Handle panning drag
    if (isDragging) {
      const deltaPx = e.clientX - dragStartX;
      // Convert pixel delta to bar count
      const barsDelta = Math.round(deltaPx / (rect.width / totalSlots));
      const maxOffset = Math.max(0, totalCandles - visibleBarsCount);
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartOffset + barsDelta));
      
      setScrollOffset(newOffset);
      if (newOffset > 0) {
        setAutoScroll(false);
      } else {
        setAutoScroll(true);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsMeasuring(false);
    setMeasureData(null);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverPos(null);
    setHoveredCandleIndex(null);
    setIsMeasuring(false);
    setMeasureData(null);
  };

  // Jump to latest candle
  const handleJumpToLive = () => {
    setScrollOffset(0);
    setAutoScroll(true);
  };

  // Auto-scroll on live ticks if enabled
  useEffect(() => {
    if (autoScroll && scrollOffset !== 0) {
      setScrollOffset(0);
    }
  }, [candles.length, autoScroll, scrollOffset]);

  // Active Candle to display in the MT5 top info bar
  const activeCandle = hoveredCandleIndex !== null && visibleCandles[hoveredCandleIndex]
    ? visibleCandles[hoveredCandleIndex]
    : visibleCandles[visibleCandles.length - 1] || candles[candles.length - 1];

  // Price at cursor position
  const cursorPrice = hoverPos ? getPriceFromY(hoverPos.y) : null;

  // Grid price levels (6 evenly distributed horizontal levels like MT5)
  const gridPriceLevels = useMemo(() => {
    const levels: { price: number; y: number }[] = [];
    const count = 6;
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const y = paddingY + ratio * (plotHeight - paddingY * 2);
      const price = maxPrice - ratio * priceRange;
      levels.push({ price, y });
    }
    return levels;
  }, [paddingY, plotHeight, maxPrice, priceRange]);

  // Grid time levels (vertical date lines like MT5)
  const gridTimeLevels = useMemo(() => {
    const levels: { timeStr: string; x: number }[] = [];
    const step = Math.max(4, Math.floor(visibleCandles.length / 6));
    for (let i = 0; i < visibleCandles.length; i += step) {
      const c = visibleCandles[i];
      if (!c) continue;
      const x = getX(i);
      const d = new Date(c.time);
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      levels.push({ timeStr, x });
    }
    return levels;
  }, [visibleCandles, getX]);

  // Candle width based on current zoom level
  const candleBodyWidth = Math.max(2, slotWidth * 0.72);

  // Simulated Order Book depth levels (clean, zero spread text)
  const depthBids = useMemo(() => {
    const current = activeInstrument.currentPrice;
    const step = 0.25;
    return [
      { price: current - step * 1, volume: 18.2 },
      { price: current - step * 2, volume: 27.5 },
      { price: current - step * 3, volume: 41.0 },
      { price: current - step * 4, volume: 62.4 },
      { price: current - step * 5, volume: 94.0 },
    ];
  }, [activeInstrument.currentPrice]);

  const depthAsks = useMemo(() => {
    const current = activeInstrument.currentPrice;
    const step = 0.25;
    return [
      { price: current + step * 5, volume: 84.1 },
      { price: current + step * 4, volume: 51.6 },
      { price: current + step * 3, volume: 36.2 },
      { price: current + step * 2, volume: 22.8 },
      { price: current + step * 1, volume: 15.3 },
    ];
  }, [activeInstrument.currentPrice]);

  // Calculate high/low range of active candle in pips & $
  const activeCandleRange = activeCandle ? (activeCandle.high - activeCandle.low) : 0;
  const activeCandlePips = (activeCandleRange * 10).toFixed(1);
  const activeCandleChange = activeCandle ? (((activeCandle.close - activeCandle.open) / activeCandle.open) * 100).toFixed(2) : '0.00';
  const isCandleBull = activeCandle ? activeCandle.close >= activeCandle.open : true;

  return (
    <div className="space-y-3">
      {/* GoldAPI Live Authentication Banner */}
      {!goldApiKey && (
        <div className="bg-gradient-to-r from-amber-500/10 via-[#101622] to-amber-500/5 border border-amber-500/30 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Key className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-white">GoldAPI.io Live Authentication: </span>
              <span className="text-slate-300 font-sans">
                Input your personal GoldAPI key to stream live XAU/USD bullion spot quotes, or rely on the server <code className="text-amber-300 font-mono">GOLDAPI_KEY</code> environment variable.
              </span>
            </div>
          </div>
          <button
            type="button"
            id="gold-api-input-banner-btn"
            onClick={() => setIsGoldKeyModalOpen(true)}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs flex items-center gap-1.5 shadow-sm shadow-amber-500/20 cursor-pointer transition-all shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Manually Input GoldAPI Key</span>
          </button>
        </div>
      )}

      {/* MT5 Institutional Terminal Header & Toolbar */}
      <div className="bg-[#0C1017] border border-[#1E2638] rounded-xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Section: Symbol, Live Spot & 24h Change */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className="text-white font-mono font-black text-lg tracking-tight">
              {activeInstrument.symbol}
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              SPOT GOLD
            </span>
          </div>

          {/* Live Spot Price with pulsating tick color */}
          <div className="flex items-center gap-2 bg-[#121824] px-2.5 py-1 rounded border border-[#1E2638]">
            <span className={`text-base font-mono font-bold tracking-tight ${
              activeInstrument.tickDirection === 'UP' ? 'text-emerald-400' : activeInstrument.tickDirection === 'DOWN' ? 'text-rose-400' : 'text-white'
            }`}>
              ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
            </span>
            <span className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${
              activeInstrument.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {activeInstrument.tickDirection === 'UP' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {activeInstrument.change24h >= 0 ? '+' : ''}{activeInstrument.change24h.toFixed(2)}%
            </span>
          </div>

          {isMarketClosed && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>Closed ({marketClosureReason || 'Weekend'}) • MT5 Live Engine Active</span>
            </span>
          )}
        </div>

        {/* Middle Section: MT5 & Dominion Markets Timeframe Toolbar */}
        <DominionTimeframeSelector 
          activeTimeframe={timeframe} 
          onSelectTimeframe={setTimeframe} 
          themeColor="amber" 
        />

        {/* Right Section: MT5 Action Toolbar (Zoom, Chart Types, Crosshair, Grid) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Chart Type Selector */}
          <div className="flex items-center bg-[#070A0F] border border-[#1E2638] rounded-lg p-0.5">
            <button
              onClick={() => setChartType('CANDLE')}
              title="Candlestick Chart (MT5 Candlesticks)"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                chartType === 'CANDLE' ? 'bg-[#1E2638] text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('BAR')}
              title="Bar Chart (MT5 OHLC Bars)"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                chartType === 'BAR' ? 'bg-[#1E2638] text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('LINE')}
              title="Line Chart (MT5 Close Line)"
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                chartType === 'LINE' ? 'bg-[#1E2638] text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-[#1E2638] mx-0.5 hidden sm:block" />

          {/* MT5 ZOOM CONTROLS */}
          <div className="flex items-center bg-[#070A0F] border border-[#1E2638] rounded-lg p-0.5">
            <button
              id="mt5-zoom-in-btn"
              onClick={handleZoomIn}
              title="Zoom In (+) - Increase candle size and detail"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded cursor-pointer transition-colors"
            >
              <ZoomIn className="w-4 h-4 text-emerald-400" />
            </button>

            <span className="text-[10px] font-mono px-1.5 text-slate-400 select-none min-w-[32px] text-center" title="Visible candles on screen">
              {visibleBarsCount}b
            </span>

            <button
              id="mt5-zoom-out-btn"
              onClick={handleZoomOut}
              title="Zoom Out (-) - View wider historical price action"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded cursor-pointer transition-colors"
            >
              <ZoomOut className="w-4 h-4 text-amber-400" />
            </button>

            <button
              id="mt5-zoom-reset-btn"
              onClick={handleResetZoom}
              title="Reset Zoom & Fit View"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* MT5 Crosshair Toggle */}
          <button
            id="mt5-crosshair-toggle-btn"
            onClick={() => setCrosshairActive(!crosshairActive)}
            title={crosshairActive ? "Crosshair Tool ON (Hold Shift to measure pips/bars)" : "Crosshair Tool OFF"}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
              crosshairActive 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20' 
                : 'bg-[#070A0F] text-slate-400 border-[#1E2638] hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Crosshair</span>
          </button>

          {/* MT5 Grid Toggle (Ctrl+G) */}
          <button
            id="mt5-grid-toggle-btn"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle MT5 Grid (Ctrl+G)"
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              showGrid 
                ? 'bg-[#1E2638] text-slate-200 border-slate-700' 
                : 'bg-[#070A0F] text-slate-500 border-[#1E2638] hover:text-slate-300'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* MT5 Chart Shift (Right Margin Indent) */}
          <button
            id="mt5-shift-toggle-btn"
            onClick={() => setChartShift(!chartShift)}
            title="MT5 Chart Shift: Indent latest candle from right border"
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              chartShift 
                ? 'bg-[#1E2638] text-amber-400 border-amber-500/40' 
                : 'bg-[#070A0F] text-slate-500 border-[#1E2638] hover:text-slate-300'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
          </button>

          {/* GoldAPI Key Modal Trigger */}
          <button
            id="mt5-gold-key-btn"
            type="button"
            onClick={() => setIsGoldKeyModalOpen(true)}
            title="Configure / Manually Input GoldAPI Key"
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-mono border transition-all cursor-pointer ${
              goldApiKey
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-[#070A0F] text-slate-300 border-[#1E2638] hover:border-amber-500/40 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-bold">API Key</span>
            <span className={`w-1.5 h-1.5 rounded-full ${goldApiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          </button>

          {/* Full-width expand toggle */}
          <button
            id="mt5-fullscreen-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Restore side panels" : "Maximize MT5 Chart Canvas"}
            className="p-1.5 rounded bg-[#070A0F] border border-[#1E2638] text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Main MT5 Candlestick & Price Chart Area */}
        <div className={`${isExpanded ? 'lg:col-span-4' : 'lg:col-span-3'} bg-[#0B0F17] border border-[#1E2638] rounded-xl p-3 sm:p-4 shadow-2xl relative flex flex-col justify-between overflow-hidden select-none`}>
          
          {/* MT5 Live Data Window / OHLC Info Bar */}
          <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-400 pb-2.5 border-b border-[#1E2638] mb-1 flex-wrap">
            {activeCandle ? (
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[11px] sm:text-xs">
                <span className="text-slate-400">
                  Time: <strong className="text-slate-200">{new Date(activeCandle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</strong>
                </span>
                <span>O: <strong className="text-white">${activeCandle.open.toFixed(2)}</strong></span>
                <span>H: <strong className="text-emerald-400">${activeCandle.high.toFixed(2)}</strong></span>
                <span>L: <strong className="text-rose-400">${activeCandle.low.toFixed(2)}</strong></span>
                <span>C: <strong className="text-white">${activeCandle.close.toFixed(2)}</strong></span>
                <span>Range: <strong className="text-amber-400">${activeCandleRange.toFixed(2)} ({activeCandlePips}p)</strong></span>
                <span>Chg: <strong className={isCandleBull ? 'text-emerald-400' : 'text-rose-400'}>{isCandleBull ? '+' : ''}{activeCandleChange}%</strong></span>
                <span className="hidden xl:inline text-slate-500">Vol: <strong className="text-slate-300">{(activeCandle.volume ?? 0).toLocaleString()}</strong></span>
              </div>
            ) : (
              <span className="text-slate-500">Loading Gold Price Feed...</span>
            )}

            {/* Price Inspector Tag & Live Tick indicator */}
            <div className="flex items-center gap-2.5">
              {cursorPrice !== null && (
                <div className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                  Cursor: ${cursorPrice.toFixed(2)}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="hidden sm:inline">MT5 LIVE</span>
              </div>
            </div>
          </div>

          {/* Interactive Chart Canvas (SVG) */}
          <div ref={containerRef} className="relative w-full overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className={`w-full h-[380px] sm:h-[480px] select-none ${
                isDragging ? 'cursor-grabbing' : crosshairActive ? 'cursor-crosshair' : 'cursor-grab'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onWheel={handleWheel}
            >
              {/* Chart Background */}
              <rect x="0" y="0" width={chartWidth} height={chartHeight} fill="#080C14" />
              <rect x="0" y="0" width={plotWidth} height={plotHeight} fill="#0A0E17" />

              {/* MT5 Background Grid Lines */}
              {showGrid && (
                <g className="grid-lines">
                  {/* Horizontal Grid (Price levels) */}
                  {gridPriceLevels.map((lvl, idx) => (
                    <line
                      key={`h-grid-${idx}`}
                      x1="0"
                      y1={lvl.y}
                      x2={plotWidth}
                      y2={lvl.y}
                      stroke="#141B2A"
                      strokeDasharray="2 3"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Vertical Grid (Time intervals) */}
                  {gridTimeLevels.map((lvl, idx) => (
                    <line
                      key={`v-grid-${idx}`}
                      x1={lvl.x}
                      y1="0"
                      x2={lvl.x}
                      y2={plotHeight}
                      stroke="#141B2A"
                      strokeDasharray="2 3"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              )}

              {/* Price Scale Background on Right Axis */}
              <rect x={plotWidth} y="0" width={priceAxisWidth} height={plotHeight} fill="#0A0E17" stroke="#1E2638" strokeWidth="1" />
              
              {/* Time Scale Background at Bottom Axis */}
              <rect x="0" y={plotHeight} width={chartWidth} height={timeAxisHeight} fill="#080C14" stroke="#1E2638" strokeWidth="1" />

              {/* Price Scale Ticks & Labels on Right Axis */}
              {gridPriceLevels.map((lvl, idx) => (
                <g key={`price-label-${idx}`}>
                  <line x1={plotWidth} y1={lvl.y} x2={plotWidth + 4} y2={lvl.y} stroke="#334155" strokeWidth="1" />
                  <text
                    x={plotWidth + 10}
                    y={lvl.y + 3.5}
                    fill="#64748B"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="start"
                  >
                    ${lvl.price.toFixed(2)}
                  </text>
                </g>
              ))}

              {/* Time Scale Ticks & Labels at Bottom Axis */}
              {gridTimeLevels.map((lvl, idx) => (
                <g key={`time-label-${idx}`}>
                  <line x1={lvl.x} y1={plotHeight} x2={lvl.x} y2={plotHeight + 4} stroke="#334155" strokeWidth="1" />
                  <text
                    x={lvl.x}
                    y={plotHeight + 17}
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {lvl.timeStr}
                  </text>
                </g>
              ))}

              {/* Highest and Lowest Price Indicators in visible window (Classic MT5 High/Low) */}
              {highestCandle && (
                <g transform={`translate(${getX(visibleCandles.indexOf(highestCandle))}, ${getY(highestCandle.high) - 7})`}>
                  <text
                    x="0"
                    y="0"
                    fill="#10B981"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ▲ H: ${highestCandle.high.toFixed(2)}
                  </text>
                </g>
              )}
              {lowestCandle && (
                <g transform={`translate(${getX(visibleCandles.indexOf(lowestCandle))}, ${getY(lowestCandle.low) + 14})`}>
                  <text
                    x="0"
                    y="0"
                    fill="#EF4444"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ▼ L: ${lowestCandle.low.toFixed(2)}
                  </text>
                </g>
              )}

              {/* CANDLESTICKS RENDERING */}
              {chartType === 'CANDLE' && (
                <g className="candlesticks">
                  {visibleCandles.map((c, i) => {
                    const x = getX(i);
                    const yOpen = getY(c.open);
                    const yClose = getY(c.close);
                    const yHigh = getY(c.high);
                    const yLow = getY(c.low);
                    const isBull = c.close >= c.open;
                    const color = isBull ? '#10B981' : '#EF4444';
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));

                    return (
                      <g key={c.time}>
                        {/* Upper and Lower Wick */}
                        <line
                          x1={x}
                          y1={yHigh}
                          x2={x}
                          y2={yLow}
                          stroke={color}
                          strokeWidth={slotWidth > 8 ? 1.5 : 1}
                        />
                        {/* Candle Body */}
                        <rect
                          x={x - candleBodyWidth / 2}
                          y={bodyTop}
                          width={candleBodyWidth}
                          height={bodyH}
                          fill={color}
                          rx="0.5"
                          stroke={isBull ? '#059669' : '#DC2626'}
                          strokeWidth="0.5"
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* BAR CHART RENDERING (Classic MT5 OHLC Bars) */}
              {chartType === 'BAR' && (
                <g className="ohlc-bars">
                  {visibleCandles.map((c, i) => {
                    const x = getX(i);
                    const yOpen = getY(c.open);
                    const yClose = getY(c.close);
                    const yHigh = getY(c.high);
                    const yLow = getY(c.low);
                    const isBull = c.close >= c.open;
                    const color = isBull ? '#10B981' : '#EF4444';
                    const tickW = Math.max(2, candleBodyWidth * 0.5);

                    return (
                      <g key={c.time}>
                        {/* Main High-Low spine */}
                        <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.5" />
                        {/* Left tick for Open */}
                        <line x1={x - tickW} y1={yOpen} x2={x} y2={yOpen} stroke={color} strokeWidth="1.5" />
                        {/* Right tick for Close */}
                        <line x1={x} y1={yClose} x2={x + tickW} y2={yClose} stroke={color} strokeWidth="1.5" />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* LINE CHART RENDERING (MT5 Close Price Line) */}
              {chartType === 'LINE' && (
                <g className="line-chart">
                  {visibleCandles.length > 1 && (
                    <>
                      {/* Area Fill */}
                      <polygon
                        points={`
                          ${getX(0)},${plotHeight - paddingY} 
                          ${visibleCandles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(' ')} 
                          ${getX(visibleCandles.length - 1)},${plotHeight - paddingY}
                        `}
                        fill="url(#lineGradient)"
                        opacity="0.25"
                      />
                      {/* Close line */}
                      <polyline
                        points={visibleCandles.map((c, i) => `${getX(i)},${getY(c.close)}`).join(' ')}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                </g>
              )}

              {/* CURRENT SPOT PRICE HORIZONTAL LINE & BADGE */}
              {(() => {
                const liveY = getY(activeInstrument.currentPrice);
                if (liveY >= 0 && liveY <= plotHeight) {
                  const isUp = activeInstrument.tickDirection === 'UP';
                  const strokeColor = isUp ? '#10B981' : '#EF4444';
                  const bgColor = isUp ? '#065F46' : '#991B1B';
                  return (
                    <g className="live-price-indicator">
                      {/* Dashed Line across plot */}
                      <line
                        x1="0"
                        y1={liveY}
                        x2={plotWidth}
                        y2={liveY}
                        stroke={strokeColor}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                      />
                      {/* Price Badge on Right Axis */}
                      <g transform={`translate(${plotWidth}, ${liveY - 9})`}>
                        <polygon
                          points={`0,9 6,2 75,2 75,16 6,16`}
                          fill={bgColor}
                          stroke={strokeColor}
                          strokeWidth="1"
                        />
                        <text
                          x="40"
                          y="11.5"
                          fill="#FFFFFF"
                          fontSize="9.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ${activeInstrument.currentPrice.toFixed(2)}
                        </text>
                      </g>
                    </g>
                  );
                }
                return null;
              })()}

              {/* MT5 INTERACTIVE CROSSHAIR & PRICE CHECKING HUD */}
              {crosshairActive && hoverPos && (
                <g className="crosshair-hud">
                  {/* Horizontal Crosshair Line */}
                  <line
                    x1="0"
                    y1={hoverPos.y}
                    x2={plotWidth}
                    y2={hoverPos.y}
                    stroke="#F59E0B"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.85"
                  />

                  {/* Vertical Crosshair Line */}
                  <line
                    x1={hoverPos.x}
                    y1="0"
                    x2={hoverPos.x}
                    y2={plotHeight}
                    stroke="#F59E0B"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.85"
                  />

                  {/* Cursor Price Tag on Right Axis */}
                  {cursorPrice !== null && (
                    <g transform={`translate(${plotWidth}, ${hoverPos.y - 9})`}>
                      <rect
                        x="0"
                        y="0"
                        width="76"
                        height="18"
                        rx="2"
                        fill="#D97706"
                        stroke="#FBBF24"
                        strokeWidth="1"
                      />
                      <text
                        x="38"
                        y="12.5"
                        fill="#000000"
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        ${cursorPrice.toFixed(2)}
                      </text>
                    </g>
                  )}

                  {/* Cursor Time Tag on Bottom Axis */}
                  {hoveredCandleIndex !== null && visibleCandles[hoveredCandleIndex] && (
                    <g transform={`translate(${hoverPos.x - 38}, ${plotHeight})`}>
                      <rect
                        x="0"
                        y="0"
                        width="76"
                        height="20"
                        rx="2"
                        fill="#1E293B"
                        stroke="#F59E0B"
                        strokeWidth="1"
                      />
                      <text
                        x="38"
                        y="13"
                        fill="#F8FAFC"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {new Date(visibleCandles[hoveredCandleIndex].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* MT5 CROSSHAIR MEASURING RULER (Shift + Click & Drag) */}
              {isMeasuring && measureData && (
                <g className="measure-tool">
                  {/* Line between measurement start and current position */}
                  <line
                    x1={measureData.startX}
                    y1={measureData.startY}
                    x2={measureData.currentX}
                    y2={measureData.currentY}
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  {/* Start Point Dot */}
                  <circle cx={measureData.startX} cy={measureData.startY} r="3" fill="#38BDF8" />
                  {/* Current Point Dot */}
                  <circle cx={measureData.currentX} cy={measureData.currentY} r="3" fill="#38BDF8" />

                  {/* Measurement Tooltip Box */}
                  {(() => {
                    const barsDiff = Math.abs(measureData.currentCandleIndex - measureData.startCandleIndex);
                    const priceDiff = measureData.currentPrice - measureData.startPrice;
                    const pipsDiff = (priceDiff * 10).toFixed(1);
                    const pctDiff = ((priceDiff / measureData.startPrice) * 100).toFixed(2);
                    const boxX = Math.min(plotWidth - 140, Math.max(10, measureData.currentX + 12));
                    const boxY = Math.min(plotHeight - 45, Math.max(10, measureData.currentY - 45));

                    return (
                      <g transform={`translate(${boxX}, ${boxY})`}>
                        <rect
                          width="135"
                          height="40"
                          rx="4"
                          fill="#0F172A"
                          stroke="#38BDF8"
                          strokeWidth="1.5"
                          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
                        />
                        <text x="8" y="15" fill="#38BDF8" fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                          {barsDiff} bars • {pipsDiff} pips
                        </text>
                        <text x="8" y="30" fill="#F8FAFC" fontSize="9.5" fontFamily="monospace">
                          Δ: {priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} ({pctDiff}%)
                        </text>
                      </g>
                    );
                  })()}
                </g>
              )}
            </svg>

            {/* Jump to Live Button (Appears when user has scrolled back in history) */}
            {scrollOffset > 0 && (
              <button
                onClick={handleJumpToLive}
                className="absolute bottom-10 right-24 bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded shadow-xl flex items-center gap-1 text-xs font-mono font-bold cursor-pointer transition-all animate-bounce"
                title="Return to latest live candle"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
                <span>Jump to Live</span>
              </button>
            )}
          </div>

          {/* Bottom Bar: MT5 Status, Navigation Hints & Zoom Shortcuts */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-[#1E2638] flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-slate-500">Period: <strong className="text-amber-400">{timeframe.toUpperCase()}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Visible: <strong className="text-slate-200">{visibleCandles.length} / {totalCandles}</strong> bars</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 hidden sm:inline">Drag: <strong className="text-slate-300">Pan History</strong></span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-500 hidden sm:inline">Scroll: <strong className="text-slate-300">Zoom In/Out</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-500">Window High: <strong className="text-emerald-400">${maxPrice.toFixed(2)}</strong></span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Window Low: <strong className="text-rose-400">${minPrice.toFixed(2)}</strong></span>
            </div>
          </div>

        </div>

        {/* Right Side: Market Depth (Order Book) & Live Tick Tape (Collapsible when Expanded) */}
        {!isExpanded && (
          <div className="space-y-4">
            
            {/* Order Book / Market Depth (Zero spread wording) */}
            <div className="bg-[#0B0F17] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#1E2638] mb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-200 font-bold uppercase tracking-wider">Market Depth</span>
                </div>
                <span className="text-[10px] text-slate-400">Order Book</span>
              </div>

              {/* Asks (Sellers) */}
              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-[10px] text-slate-500 pb-1">
                  <span>Ask Price</span>
                  <span>Size (oz)</span>
                </div>
                {depthAsks.map((ask, i) => (
                  <div key={i} className="flex justify-between items-center relative py-1 px-1.5 rounded hover:bg-rose-500/5 transition-colors">
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded" 
                      style={{ width: `${(ask.volume / 90) * 100}%` }}
                    />
                    <span className="text-rose-400 font-bold z-10">${ask.price.toFixed(2)}</span>
                    <span className="text-slate-300 z-10">{ask.volume}</span>
                  </div>
                ))}
              </div>

              {/* Current Spot Price Middle Divider (NO SPREAD TEXT) */}
              <div className="py-2 px-2.5 rounded bg-[#070A0F] border border-[#1E2638] my-2 text-white flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${activeInstrument.tickDirection === 'UP' ? 'bg-emerald-400' : 'bg-rose-400'} animate-ping`} />
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Spot</span>
                </div>
                <div className="flex items-center gap-1 font-bold text-sm">
                  <span className={activeInstrument.tickDirection === 'UP' ? 'text-emerald-400' : 'text-rose-400'}>
                    ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
                  </span>
                  {activeInstrument.tickDirection === 'UP' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  )}
                </div>
              </div>

              {/* Bids (Buyers) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 pb-1">
                  <span>Bid Price</span>
                  <span>Size (oz)</span>
                </div>
                {depthBids.map((bid, i) => (
                  <div key={i} className="flex justify-between items-center relative py-1 px-1.5 rounded hover:bg-emerald-500/5 transition-colors">
                    <div 
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded" 
                      style={{ width: `${(bid.volume / 90) * 100}%` }}
                    />
                    <span className="text-emerald-400 font-bold z-10">${bid.price.toFixed(2)}</span>
                    <span className="text-slate-300 z-10">{bid.volume}</span>
                  </div>
                ))}
              </div>

            </div>

            {/* Real-Time Tick Tape Card */}
            <div className="bg-[#0B0F17] border border-[#1E2638] rounded-xl p-4 shadow-lg text-xs font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-[#1E2638] mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-200 font-bold uppercase">Tick Tape</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">Real-Time</span>
              </div>

              <div className="space-y-1.5">
                {candles.slice(-6).reverse().map((c, i) => {
                  const isBull = c.close >= c.open;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-800/40 last:border-0">
                      <span className="text-slate-500">{new Date(c.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className={`font-bold ${isBull ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${c.close.toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {c.volume} oz
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
