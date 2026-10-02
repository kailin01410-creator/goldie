import React, { 
  useRef, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo 
} from 'react';
import { 
  CandlestickChart, 
  LineChart as LineChartIcon, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Crosshair as CrosshairIcon, 
  ChevronsRight,
  ArrowRight,
  Maximize2, 
  Sliders, 
  Layers,
  Activity,
  ArrowUpDown,
  Move
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { Candle, TimeframeId } from '../../types';
import { DominionTimeframeSelector } from '../DominionTimeframeSelector';
import { getDominionTimeframe } from '../../data/timeframes';
import { 
  ViewportState, 
  PlotBox, 
  logicalToX, 
  xToLogical, 
  priceToY, 
  yToPrice, 
  zoomHorizontal, 
  zoomVertical, 
  panHorizontal, 
  panVertical, 
  atLiveEdge, 
  followLatest, 
  calculateVisiblePriceRange 
} from '../../chart/fluidChartCore';
import { 
  calculateSMA, 
  calculateEMA, 
  calculateVWAP, 
  calculateDailyPivots,
  detectSwingHighsAndLows
} from '../../utils/technicalAnalysis';

export const FluidLiveChart: React.FC = () => {
  const { 
    activeInstrument, 
    candles, 
    timeframe, 
    setTimeframe,
    goldDataSource,
    isMarketClosed,
    lastTickTime
  } = useTrading();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Interaction & UI Options
  const [chartType, setChartType] = useState<'CANDLESTICK' | 'LINE'>('CANDLESTICK');
  const [showSma20, setShowSma20] = useState<boolean>(true);
  const [showEma50, setShowEma50] = useState<boolean>(true);
  const [showEma200, setShowEma200] = useState<boolean>(false);
  const [showVwap, setShowVwap] = useState<boolean>(true);
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [crosshairEnabled, setCrosshairEnabled] = useState<boolean>(true);

  // Viewport State Machine (Data-space representation)
  const viewportRef = useRef<ViewportState>({
    firstLogical: 0,
    barSpacing: 9.5,
    minBarSpacing: 2.5,
    maxBarSpacing: 45,
    priceMin: activeInstrument.currentPrice * 0.995,
    priceMax: activeInstrument.currentPrice * 1.005,
    autoScale: true,
    priceLocked: false,
    followLive: true,
    rightMarginBars: 10,
    mode: 'navigate',
    crosshair: null,
  });

  // Reactive state for UI updates
  const [isFollowingLive, setIsFollowingLive] = useState<boolean>(true);
  const [isAutoscale, setIsAutoscale] = useState<boolean>(true);
  const [activeHudCandle, setActiveHudCandle] = useState<Candle | null>(null);
  const [barCountdown, setBarCountdown] = useState<string>('');
  const lastHudTimeRef = useRef<number | null>(null);
  const renderRequestedRef = useRef<boolean>(false);

  // Live countdown to current bar completion across all 16 timeframes
  useEffect(() => {
    const updateCountdown = () => {
      const spec = getDominionTimeframe(timeframe);
      const intervalMs = spec.intervalMs;
      const now = Date.now();
      const currentBarStart = Math.floor(now / intervalMs) * intervalMs;
      const nextBarStart = currentBarStart + intervalMs;
      const remainingMs = Math.max(0, nextBarStart - now);
      const totalSec = Math.floor(remainingMs / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      if (hrs > 0) {
        setBarCountdown(`${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
      } else {
        setBarCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [timeframe]);

  // Drag interaction tracking
  const dragRef = useRef<{
    isDragging: boolean;
    dragType: 'PAN' | 'PRICE_SCALE';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({
    isDragging: false,
    dragType: 'PAN',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  // Pinch gesture tracking
  const pinchRef = useRef<{
    active: boolean;
    initialDistance: number;
    initialSpacing: number;
    midpointX: number;
  }>({
    active: false,
    initialDistance: 0,
    initialSpacing: 9.5,
    midpointX: 0,
  });

  // Plot box dimensions
  const getPlotBox = useCallback((): PlotBox => {
    const el = containerRef.current;
    const width = el ? el.clientWidth : 800;
    const height = el ? el.clientHeight : 440;
    const priceAxisWidth = 76;
    const timeAxisHeight = 28;
    const volumePaneHeight = showVolume ? 65 : 0;

    return {
      left: 0,
      top: 24,
      width: Math.max(width - priceAxisWidth, 200),
      height: Math.max(height - timeAxisHeight - 24, 200),
      priceAxisWidth,
      timeAxisHeight,
      volumePaneHeight,
    };
  }, [showVolume]);

  // Daily floor pivots for support/resistance zones
  const pivots = useMemo(() => {
    const high = activeInstrument.high24h || activeInstrument.currentPrice * 1.005;
    const low = activeInstrument.low24h || activeInstrument.currentPrice * 0.995;
    const close = activeInstrument.currentPrice;
    return calculateDailyPivots(high, low, close);
  }, [activeInstrument.high24h, activeInstrument.low24h, activeInstrument.currentPrice]);

  const lastBarTime = candles.length > 0 ? candles[candles.length - 1].time : 0;
  const priceBracket = Math.round((activeInstrument.currentPrice || 0) * 2);

  // Detected Swing High / Low for Purple S/R zones
  const swings = useMemo(() => {
    return detectSwingHighsAndLows(candles, 4);
  }, [candles.length, lastBarTime, priceBracket]);

  // Technical series across all bars
  const closes = useMemo(() => candles.map(c => c.close), [candles.length, lastBarTime, priceBracket]);
  const sma20 = useMemo(() => (showSma20 ? calculateSMA(closes, 20) : []), [closes, showSma20]);
  const ema50 = useMemo(() => (showEma50 ? calculateEMA(closes, 50) : []), [closes, showEma50]);
  const ema200 = useMemo(() => (showEma200 ? calculateEMA(closes, 200) : []), [closes, showEma200]);
  const vwapData = useMemo(() => (showVwap ? calculateVWAP(candles) : null), [candles.length, lastBarTime, priceBracket, showVwap]);

  // Initialize or snap viewport on candle array change or timeframe switch
  useEffect(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    vp.autoScale = true;
    setIsAutoscale(true);
    if (candles.length > 0) {
      followLatest(candles.length, box, vp);
      setIsFollowingLive(true);
    }
  }, [candles.length, timeframe, activeInstrument.symbol, getPlotBox]);

  // Main Canvas Render Pass with requestAnimationFrame
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const box = getPlotBox();
    const vp = viewportRef.current;
    const dpr = window.devicePixelRatio || 1;

    const totalWidth = box.width + box.priceAxisWidth;
    const totalHeight = box.height + box.timeAxisHeight + box.top;

    // Handle high-DPI scaling
    if (canvas.width !== Math.floor(totalWidth * dpr) || canvas.height !== Math.floor(totalHeight * dpr)) {
      canvas.width = Math.floor(totalWidth * dpr);
      canvas.height = Math.floor(totalHeight * dpr);
    }
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // 1. If autoscale is enabled, recompute price boundaries from visible bars
    if (vp.autoScale && candles.length > 0) {
      const range = calculateVisiblePriceRange(candles, box, vp, { r2: pivots.r2, s2: pivots.s2 });
      vp.priceMin = range.priceMin;
      vp.priceMax = range.priceMax;
    }

    // 2. Background Fill
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // 3. Grid Lines (Horizontal Price Grid)
    const priceRange = Math.max(vp.priceMax - vp.priceMin, 0.001);
    const targetSteps = Math.max(4, Math.floor(box.height / 55));
    const roughStep = priceRange / targetSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalized = roughStep / magnitude;
    let step = magnitude;
    if (normalized > 5) step = 5 * magnitude;
    else if (normalized > 2) step = 2 * magnitude;
    else step = magnitude;

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#121A2A';
    ctx.fillStyle = '#64748B';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const firstGridPrice = Math.ceil(vp.priceMin / step) * step;
    for (let p = firstGridPrice; p <= vp.priceMax; p += step) {
      const y = priceToY(p, box, vp);
      if (y >= box.top && y <= box.top + box.height) {
        ctx.beginPath();
        ctx.moveTo(box.left, y);
        ctx.lineTo(box.left + box.width, y);
        ctx.stroke();

        // Right axis price tick label
        ctx.fillText(p.toFixed(2), box.left + box.width + 8, y);
      }
    }

    // 4. Time Grid Lines (Vertical)
    const visibleBars = box.width / vp.barSpacing;
    const barInterval = Math.max(5, Math.pow(2, Math.floor(Math.log2(visibleBars / 6))) * 5);
    const firstBar = Math.floor(vp.firstLogical);
    const lastBar = Math.ceil(vp.firstLogical + visibleBars);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = firstBar; i <= lastBar; i++) {
      if (i >= 0 && i < candles.length && i % barInterval === 0) {
        const x = logicalToX(i, box, vp);
        if (x >= box.left && x <= box.left + box.width) {
          ctx.beginPath();
          ctx.moveTo(x, box.top);
          ctx.lineTo(x, box.top + box.height);
          ctx.stroke();

          // Time label on bottom axis
          const d = new Date(candles[i].time);
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
          ctx.fillText(timeStr, x, box.top + box.height + 7);
        }
      }
    }

    // 5. Volume Pane (Subwindow at bottom)
    if (showVolume && box.volumePaneHeight > 0 && candles.length > 0) {
      const vTop = box.top + box.height - box.volumePaneHeight;
      const vHeight = box.volumePaneHeight;

      // Divider line
      ctx.strokeStyle = '#1A2338';
      ctx.beginPath();
      ctx.moveTo(box.left, vTop);
      ctx.lineTo(box.left + box.width, vTop);
      ctx.stroke();

      // Find max volume in visible range
      let maxVol = 100;
      for (let i = Math.max(0, firstBar); i <= Math.min(candles.length - 1, lastBar); i++) {
        if (candles[i]?.volume && candles[i].volume > maxVol) maxVol = candles[i].volume;
      }

      // Draw volume bars
      for (let i = Math.max(0, firstBar); i <= Math.min(candles.length - 1, lastBar); i++) {
        const c = candles[i];
        if (!c) continue;
        const x = logicalToX(i, box, vp);
        const barW = Math.max(1, vp.barSpacing * 0.7);
        const bHeight = Math.max(2, ((c.volume || 10) / maxVol) * (vHeight - 8));
        const bY = vTop + vHeight - bHeight;

        ctx.fillStyle = c.close >= c.open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)';
        ctx.fillRect(x - barW / 2, bY, barW, bHeight);
      }
    }

    // 6. Purple Key Support & Resistance Zones
    if (showZones) {
      const drawZone = (label: string, price: number, isRes: boolean) => {
        const y = priceToY(price, box, vp);
        if (y >= box.top && y <= box.top + box.height) {
          ctx.save();
          ctx.fillStyle = isRes ? 'rgba(168, 85, 247, 0.08)' : 'rgba(147, 51, 234, 0.08)';
          ctx.fillRect(box.left, y - 8, box.width, 16);

          ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(box.left, y);
          ctx.lineTo(box.left + box.width, y);
          ctx.stroke();

          // Zone badge
          ctx.fillStyle = '#C084FC';
          ctx.font = '9px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`KEY ${label}: ${price.toFixed(2)}`, box.left + 8, y - 2);
          ctx.restore();
        }
      };

      if (swings.recentHigh) drawZone('SWING HIGH', swings.recentHigh.price, true);
      if (swings.recentLow) drawZone('SWING LOW', swings.recentLow.price, false);
      if (pivots.r1) drawZone('PIVOT R1', pivots.r1, true);
      if (pivots.s1) drawZone('PIVOT S1', pivots.s1, false);
    }

    // 7. VWAP + Cloud
    if (showVwap && vwapData && vwapData.vwap > 0) {
      const vY = priceToY(vwapData.vwap, box, vp);
      const uY = priceToY(vwapData.upperBand, box, vp);
      const lY = priceToY(vwapData.lowerBand, box, vp);

      if (vY >= box.top && vY <= box.top + box.height) {
        ctx.save();
        // Cloud
        ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.fillRect(box.left, Math.max(box.top, uY), box.width, Math.max(2, lY - uY));

        // Bands
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(box.left, uY);
        ctx.lineTo(box.left + box.width, uY);
        ctx.moveTo(box.left, lY);
        ctx.lineTo(box.left + box.width, lY);
        ctx.stroke();

        // Main VWAP line
        ctx.strokeStyle = '#3B82F6';
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(box.left, vY);
        ctx.lineTo(box.left + box.width, vY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 8. Technical Indicator Lines (SMA 20, EMA 50, EMA 200)
    const drawSeries = (series: (number | null)[], color: string, width: number = 1.5) => {
      if (series.length === 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let started = false;

      for (let i = Math.max(0, firstBar); i <= Math.min(candles.length - 1, lastBar); i++) {
        const val = series[i];
        if (val !== null && val !== undefined) {
          const x = logicalToX(i, box, vp);
          const y = priceToY(val, box, vp);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    if (showSma20) drawSeries(sma20, '#F59E0B', 1.5);
    if (showEma50) drawSeries(ema50, '#06B6D4', 1.5);
    if (showEma200) drawSeries(ema200, '#A855F7', 1.5);

    // 9. Main Candlestick / Line Plot
    const barWidth = Math.max(1.5, vp.barSpacing * 0.72);
    const wickWidth = Math.max(1, vp.barSpacing > 10 ? 1.5 : 1);

    if (chartType === 'CANDLESTICK') {
      for (let i = Math.max(0, firstBar); i <= Math.min(candles.length - 1, lastBar); i++) {
        const c = candles[i];
        if (!c) continue;

        const x = logicalToX(i, box, vp);
        const openY = priceToY(c.open, box, vp);
        const closeY = priceToY(c.close, box, vp);
        const highY = priceToY(c.high, box, vp);
        const lowY = priceToY(c.low, box, vp);

        const isBullish = c.close >= c.open;
        const color = isBullish ? '#10B981' : '#EF4444';

        ctx.strokeStyle = color;
        ctx.lineWidth = wickWidth;

        // Wick
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Body
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
      }
    } else {
      // Line Chart Mode
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;

      for (let i = Math.max(0, firstBar); i <= Math.min(candles.length - 1, lastBar); i++) {
        const c = candles[i];
        if (!c) continue;
        const x = logicalToX(i, box, vp);
        const y = priceToY(c.close, box, vp);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 10. Current Live Price Line & Animated Price Badge
    const currentPrice = activeInstrument.currentPrice;
    const curY = priceToY(currentPrice, box, vp);

    if (curY >= box.top && curY <= box.top + box.height) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(box.left, curY);
      ctx.lineTo(box.left + box.width, curY);
      ctx.stroke();

      // Right-side Price Badge on price scale
      ctx.setLineDash([]);
      ctx.fillStyle = '#0284C7';
      const badgeH = 18;
      const badgeW = box.priceAxisWidth - 6;
      ctx.fillRect(box.left + box.width + 2, curY - badgeH / 2, badgeW, badgeH);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentPrice.toFixed(2), box.left + box.width + 2 + badgeW / 2, curY);
      ctx.restore();
    }

    // 11. Crosshair & Dynamic Axes Badges
    if (crosshairEnabled && vp.crosshair) {
      const { x, y, price, time } = vp.crosshair;

      if (x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Crosshair lines
        ctx.beginPath();
        ctx.moveTo(x, box.top);
        ctx.lineTo(x, box.top + box.height);
        ctx.moveTo(box.left, y);
        ctx.lineTo(box.left + box.width, y);
        ctx.stroke();

        ctx.setLineDash([]);

        // Y-axis Price badge
        ctx.fillStyle = '#1E293B';
        const priceLabelW = box.priceAxisWidth - 6;
        ctx.fillRect(box.left + box.width + 2, y - 9, priceLabelW, 18);
        ctx.strokeStyle = '#38BDF8';
        ctx.strokeRect(box.left + box.width + 2, y - 9, priceLabelW, 18);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(price.toFixed(2), box.left + box.width + 2 + priceLabelW / 2, y);

        // X-axis Time badge
        const d = new Date(time);
        const timeStr = `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
        const timeW = 92;
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(x - timeW / 2, box.top + box.height + 2, timeW, 20);
        ctx.strokeStyle = '#38BDF8';
        ctx.strokeRect(x - timeW / 2, box.top + box.height + 2, timeW, 20);

        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(timeStr, x, box.top + box.height + 12);

        ctx.restore();
      }
    }

    // 12. Gutter Dividers
    ctx.strokeStyle = '#1E2638';
    ctx.lineWidth = 1;
    // Right vertical gutter border
    ctx.beginPath();
    ctx.moveTo(box.left + box.width, box.top);
    ctx.lineTo(box.left + box.width, box.top + box.height + box.timeAxisHeight);
    ctx.stroke();

    // Bottom horizontal gutter border
    ctx.beginPath();
    ctx.moveTo(box.left, box.top + box.height);
    ctx.lineTo(box.left + box.width + box.priceAxisWidth, box.top + box.height);
    ctx.stroke();

  }, [
    getPlotBox,
    candles,
    activeInstrument.currentPrice,
    chartType,
    showSma20,
    showEma50,
    showEma200,
    showVwap,
    showZones,
    showVolume,
    crosshairEnabled,
    pivots,
    swings,
    sma20,
    ema50,
    ema200,
    vwapData
  ]);

  // Handle container resizing and initial paint layout sizing via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          const box = getPlotBox();
          const vp = viewportRef.current;
          if (vp.followLive && candles.length > 0) {
            followLatest(candles.length, box, vp);
          }
          renderFrame();
        }
      }
    });

    observer.observe(el);
    renderFrame();

    return () => observer.disconnect();
  }, [getPlotBox, candles.length, renderFrame]);

  // Request Animation Frame loop on state changes and live market ticks
  useEffect(() => {
    let animId = requestAnimationFrame(() => {
      renderFrame();
    });
    return () => cancelAnimationFrame(animId);
  }, [renderFrame, lastTickTime, candles]);

  // Handle Wheel: Cursor-anchored horizontal zoom or independent price axis zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const box = getPlotBox();
    const vp = viewportRef.current;

    if (pointerX >= box.left + box.width) {
      // Wheel on right price scale gutter -> zoom price scale vertically!
      zoomVertical(pointerY, e.deltaY, box, vp);
      setIsAutoscale(false);
    } else {
      // Wheel on chart body -> cursor-anchored horizontal zoom!
      zoomHorizontal(pointerX, e.deltaY, box, vp);
      setIsFollowingLive(atLiveEdge(candles.length, box, vp));
    }

    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  // Mouse Down: Start Pan or Price Drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const box = getPlotBox();

    dragRef.current = {
      isDragging: true,
      dragType: x >= box.left + box.width ? 'PRICE_SCALE' : 'PAN',
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
    };
  }, [getPlotBox]);

  // Mouse Move: Execute Pan / Price Drag & Update Crosshair
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const box = getPlotBox();
    const vp = viewportRef.current;

    if (dragRef.current.isDragging) {
      const deltaX = x - dragRef.current.lastX;
      const deltaY = y - dragRef.current.lastY;

      if (dragRef.current.dragType === 'PAN') {
        panHorizontal(deltaX, box, vp);
        const live = atLiveEdge(candles.length, box, vp);
        setIsFollowingLive(live);
      } else if (dragRef.current.dragType === 'PRICE_SCALE') {
        panVertical(deltaY, box, vp);
        setIsAutoscale(false);
      }

      dragRef.current.lastX = x;
      dragRef.current.lastY = y;
    }

    // Update crosshair data
    const logicalIdx = Math.round(xToLogical(x, box, vp));
    const priceAtCursor = yToPrice(y, box, vp);
    const candleAtCursor = candles[logicalIdx] || (candles.length > 0 ? candles[candles.length - 1] : undefined);
    const timeAtCursor = candleAtCursor?.time || (candles.length > 0 ? candles[candles.length - 1].time : Date.now());

    vp.crosshair = {
      x,
      y,
      logicalIndex: logicalIdx,
      price: priceAtCursor,
      time: timeAtCursor,
      candle: candleAtCursor,
    };

    // Only trigger React state update if the bar under cursor actually changed
    const cTime = candleAtCursor?.time ?? null;
    if (cTime !== lastHudTimeRef.current) {
      lastHudTimeRef.current = cTime;
      setActiveHudCandle(candleAtCursor || null);
    }

    // Schedule 60fps canvas draw without choking the JavaScript event loop
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderFrame();
        renderRequestedRef.current = false;
      });
    }
  }, [getPlotBox, candles, renderFrame]);

  // Mouse Up: Terminate Drag
  const handleMouseUp = useCallback(() => {
    dragRef.current.isDragging = false;
  }, []);

  // Mouse Leave: Clear Crosshair
  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false;
    viewportRef.current.crosshair = null;
    lastHudTimeRef.current = null;
    setActiveHudCandle(null);
    renderFrame();
  }, [renderFrame]);

  // Double Click: Reset Autoscale
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const box = getPlotBox();
    const vp = viewportRef.current;

    // Reset autoscale
    vp.autoScale = true;
    setIsAutoscale(true);
    if (x < box.left + box.width) {
      // If double clicked in chart, also return to live edge
      followLatest(candles.length, box, vp);
      setIsFollowingLive(true);
    }
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  // Touch handlers for mobile / tablet pinch & pan
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      dragRef.current = {
        isDragging: true,
        dragType: 'PAN',
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
      };
      pinchRef.current.active = false;
    } else if (e.touches.length === 2) {
      // Pinch gesture
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchRef.current = {
        active: true,
        initialDistance: dist,
        initialSpacing: viewportRef.current.barSpacing,
        midpointX: ((t1.clientX + t2.clientX) / 2) - rect.left,
      };
      dragRef.current.isDragging = false;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const box = getPlotBox();
    const vp = viewportRef.current;

    if (e.touches.length === 1 && dragRef.current.isDragging) {
      const x = e.touches[0].clientX - rect.left;
      const deltaX = x - dragRef.current.lastX;
      panHorizontal(deltaX, box, vp);
      setIsFollowingLive(atLiveEdge(candles.length, box, vp));
      dragRef.current.lastX = x;
      renderFrame();
    } else if (e.touches.length === 2 && pinchRef.current.active) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / (pinchRef.current.initialDistance || 1);
      const newSpacing = Math.max(
        vp.minBarSpacing,
        Math.min(vp.maxBarSpacing, pinchRef.current.initialSpacing * ratio)
      );
      vp.barSpacing = newSpacing;
      renderFrame();
    }
  }, [getPlotBox, candles.length, renderFrame]);

  const handleTouchEnd = useCallback(() => {
    dragRef.current.isDragging = false;
    pinchRef.current.active = false;
  }, []);

  // Jump to Live Edge
  const handleGoToLatest = useCallback(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    followLatest(candles.length, box, vp);
    vp.autoScale = true;
    setIsFollowingLive(true);
    setIsAutoscale(true);
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  // Zoom Buttons
  const handleZoomIn = useCallback(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    zoomHorizontal(box.left + box.width / 2, -120, box, vp);
    setIsFollowingLive(atLiveEdge(candles.length, box, vp));
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  const handleZoomOut = useCallback(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    zoomHorizontal(box.left + box.width / 2, 120, box, vp);
    setIsFollowingLive(atLiveEdge(candles.length, box, vp));
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  const handleResetScale = useCallback(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    vp.barSpacing = 9.5;
    vp.autoScale = true;
    followLatest(candles.length, box, vp);
    setIsFollowingLive(true);
    setIsAutoscale(true);
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  const activeDominionSpec = getDominionTimeframe(timeframe);
  const currentCandle = activeHudCandle || (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-3 sm:p-4 flex flex-col font-sans select-none">
      
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-[#1E2638]">
        
        {/* Timeframe & Chart Style Switches */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <DominionTimeframeSelector 
            activeTimeframe={timeframe} 
            onSelectTimeframe={setTimeframe} 
            themeColor="cyan" 
          />

          <div className="flex items-center bg-[#080C14] p-1 rounded-xl border border-[#1E2638] text-xs">
            <button
              type="button"
              title="Candlestick Chart"
              onClick={() => setChartType('CANDLESTICK')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'CANDLESTICK' ? 'bg-[#1E293B] text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CandlestickChart className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Line Chart"
              onClick={() => setChartType('LINE')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                chartType === 'LINE' ? 'bg-[#1E293B] text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Technical Overlays Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowSma20(!showSma20)}
            className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              showSma20
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500'
            }`}
          >
            SMA 20
          </button>

          <button
            type="button"
            onClick={() => setShowEma50(!showEma50)}
            className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              showEma50
                ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500'
            }`}
          >
            EMA 50
          </button>

          <button
            type="button"
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              showVwap
                ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500'
            }`}
          >
            VWAP
          </button>

          <button
            type="button"
            onClick={() => setShowZones(!showZones)}
            className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              showZones
                ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500'
            }`}
          >
            PURPLE S/R
          </button>

          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              showVolume
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500'
            }`}
          >
            VOL
          </button>
        </div>

        {/* Zoom & Invariant Scale Action Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#080C14] p-1 rounded-xl border border-[#1E2638]">
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (or Scroll Wheel on chart)"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (or Scroll Wheel on chart)"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleResetScale}
              title="Reset Viewport Scale (or Double-Click Price Scale)"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCrosshairEnabled(!crosshairEnabled)}
            title="Toggle Cursor Crosshair"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              crosshairEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
            }`}
          >
            <CrosshairIcon className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Interactive Canvas Stage Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-[450px] sm:h-[500px] overflow-hidden rounded-xl bg-[#080C14] border border-[#1A2234] cursor-crosshair touch-none"
      >
        {/* Main Fluid Canvas */}
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Top-Left OHLCV & Indicators Live HUD Data Window */}
        {currentCandle && (
          <div className="absolute top-2 left-2 pointer-events-none flex flex-wrap items-center gap-x-2.5 gap-y-1 bg-[#090E17]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#1E2638] text-[11px] font-mono shadow-lg">
            <span className="text-white font-bold">{activeInstrument.symbol}</span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase flex items-center gap-1">
              <span>{activeDominionSpec.mt5Code}</span>
              {barCountdown && <span className="text-cyan-400 font-normal font-mono opacity-90">[{barCountdown}]</span>}
            </span>
            <span className="text-slate-400">O: <strong className="text-slate-200">{currentCandle.open.toFixed(2)}</strong></span>
            <span className="text-slate-400">H: <strong className="text-emerald-400">{currentCandle.high.toFixed(2)}</strong></span>
            <span className="text-slate-400">L: <strong className="text-rose-400">{currentCandle.low.toFixed(2)}</strong></span>
            <span className="text-slate-400">C: <strong className={currentCandle.close >= currentCandle.open ? 'text-emerald-400' : 'text-rose-400'}>{currentCandle.close.toFixed(2)}</strong></span>
            {showVolume && <span className="text-slate-400">V: <strong className="text-slate-300">{currentCandle.volume.toLocaleString()}</strong></span>}
            
            {showSma20 && sma20.length > 0 && (
              <span className="text-amber-400 text-[10px]">SMA20: {(sma20[sma20.length - 1] || 0).toFixed(2)}</span>
            )}
            {showEma50 && ema50.length > 0 && (
              <span className="text-cyan-400 text-[10px]">EMA50: {(ema50[ema50.length - 1] || 0).toFixed(2)}</span>
            )}
          </div>
        )}

        {/* Live / History Status & Go to Latest Floating Button */}
        {!isFollowingLive && (
          <button
            type="button"
            onClick={handleGoToLatest}
            className="absolute bottom-10 right-24 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs shadow-lg shadow-cyan-500/25 transition-transform active:scale-95 cursor-pointer"
          >
            <ChevronsRight className="w-4 h-4 animate-pulse" />
            <span>Go to Latest</span>
          </button>
        )}

        {/* Autoscale Toggle Affordance Badge */}
        {!isAutoscale && (
          <button
            type="button"
            onClick={() => {
              viewportRef.current.autoScale = true;
              setIsAutoscale(true);
              renderFrame();
            }}
            className="absolute top-2 right-24 z-20 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-semibold cursor-pointer hover:bg-amber-500/25"
          >
            Manual Scale (Double-click to reset)
          </button>
        )}

        {/* Subtle MT5 Interaction Guide Tooltip on bottom-left */}
        <div className="absolute bottom-2 left-2 pointer-events-none text-[10px] font-mono text-slate-500 hidden sm:block">
          Scroll: Zoom • Drag Chart: Pan • Drag Price Scale: Vertical Scale
        </div>
      </div>

    </div>
  );
};
