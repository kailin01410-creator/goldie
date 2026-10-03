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
  Move,
  Ruler,
  Table2,
  Keyboard,
  Lock,
  Unlock
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
  calculateVisiblePriceRange,
  buildPriceTicks,
  buildTimeTicks,
  zoomStep,
  measureBetween,
  formatDuration,
  MeasureResult
} from '../../chart/fluidChartCore';
import { 
  calculateSMA, 
  calculateEMA, 
  calculateVWAP, 
  calculateDailyPivots,
  detectSwingHighsAndLows
} from '../../utils/technicalAnalysis';

/** One aligned label/value line in the data window. */
const DataRow: React.FC<{
  label: string;
  value: string;
  tone?: 'up' | 'down';
  color?: string;
}> = ({ label, value, tone, color }) => {
  const valueClass = color
    ? color
    : tone === 'up'
      ? 'text-emerald-400'
      : tone === 'down'
        ? 'text-rose-400'
        : 'text-slate-200';
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`${valueClass} tabular-nums`}>{value}</span>
    </div>
  );
};

const Shortcut: React.FC<{ keys: string; action: string }> = ({ keys, action }) => (
  <div className="flex items-baseline justify-between gap-2">
    <span className="text-slate-200">{keys}</span>
    <span className="text-slate-500 text-right">{action}</span>
  </div>
);

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
  const [showDataWindow, setShowDataWindow] = useState<boolean>(true);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [measureMode, setMeasureMode] = useState<boolean>(false);

  // MT5 quotes every instrument at its own precision. Reading "1.17" off a
  // EUR/USD chart is useless, so every number on this surface is formatted
  // from the instrument's own decimals rather than a hardcoded 2.
  const digits = Number.isFinite(activeInstrument.decimals) ? activeInstrument.decimals : 2;
  const pipMultiplier = activeInstrument.pipMultiplier || 1;

  const formatPrice = useCallback(
    (value: number | null | undefined): string =>
      value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits),
    [digits],
  );

  // Viewport State Machine (Data-space representation)
  const viewportRef = useRef<ViewportState>({
    firstLogical: 0,
    barSpacing: 9.5,
    // Matches the ends of ZOOM_LADDER so the +/- buttons can actually reach
    // the widest and narrowest bars instead of stalling against a clamp.
    minBarSpacing: 1.5,
    maxBarSpacing: 50,
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

  // Index of the bar under the cursor, so the data window can report the
  // indicator values at that bar instead of only the newest ones.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [cursorPrice, setCursorPrice] = useState<number | null>(null);

  // Measure ruler (MT5: hold the crosshair and drag)
  const measureAnchorRef = useRef<{ price: number; logicalIndex: number; time: number } | null>(null);
  const measureCursorRef = useRef<{ price: number; logicalIndex: number; time: number } | null>(null);
  const [measure, setMeasure] = useState<MeasureResult | null>(null);

  // Mirrors the viewport into React purely so the status bar can show it.
  const [zoomInfo, setZoomInfo] = useState<{ spacing: number; visibleBars: number }>({
    spacing: 9.5,
    visibleBars: 0,
  });

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
    dragType: 'PAN' | 'PRICE_SCALE' | 'TIME_SCALE' | 'MEASURE';
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

  // Switching timeframe or symbol is a fresh chart: reset scale and go live.
  useEffect(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    vp.autoScale = true;
    vp.followLive = true;
    setIsAutoscale(true);
    measureAnchorRef.current = null;
    measureCursorRef.current = null;
    setMeasure(null);
    if (candles.length > 0) {
      followLatest(candles.length, box, vp);
      setIsFollowingLive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, activeInstrument.symbol]);

  // New bars arriving must NOT yank the view back. MT5 keeps you where you
  // are when you have scrolled into history; only a chart that is already at
  // the live edge slides forward. The previous version reset autoscale and
  // jumped to the latest bar on every single tick, which made it impossible
  // to study an older candle.
  useEffect(() => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    if (candles.length > 0 && vp.followLive) {
      followLatest(candles.length, box, vp);
      setIsFollowingLive(true);
    }
  }, [candles.length, getPlotBox]);

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
      const range = calculateVisiblePriceRange(candles, box, vp, { r2: pivots.r2, s2: pivots.s2 }, digits);
      vp.priceMin = range.priceMin;
      vp.priceMax = range.priceMax;
    }

    // 2. Background Fill
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // 3. Grid Lines (Horizontal Price Grid)
    // Steps land on round numbers (1/2/2.5/5 x 10^n) and labels carry exactly
    // as many digits as the step needs, so no two rows ever read the same.
    const { ticks: priceTicks } = buildPriceTicks(box, vp, {
      decimals: digits,
      targetSpacingPx: 52,
    });

    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const tick of priceTicks) {
      ctx.strokeStyle = tick.major ? '#1B2538' : '#121A2A';
      ctx.beginPath();
      ctx.moveTo(box.left, tick.y);
      ctx.lineTo(box.left + box.width, tick.y);
      ctx.stroke();

      // Right axis price tick label
      ctx.fillStyle = tick.major ? '#94A3B8' : '#64748B';
      ctx.fillText(tick.label, box.left + box.width + 8, tick.y);
    }

    // 4. Time Grid Lines (Vertical) — calendar aware, like the MT5 time axis
    const visibleBars = box.width / vp.barSpacing;
    const firstBar = Math.floor(vp.firstLogical);
    const lastBar = Math.ceil(vp.firstLogical + visibleBars);
    const timeTicks = buildTimeTicks(candles, box, vp, { minLabelSpacingPx: 74 });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const tick of timeTicks) {
      ctx.strokeStyle = tick.isDayBoundary ? '#243049' : '#121A2A';
      ctx.beginPath();
      ctx.moveTo(tick.x, box.top);
      ctx.lineTo(tick.x, box.top + box.height);
      ctx.stroke();

      ctx.fillStyle = tick.isDayBoundary ? '#CBD5E1' : '#64748B';
      ctx.fillText(tick.label, tick.x, box.top + box.height + 7);
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
          ctx.fillText(`KEY ${label}: ${formatPrice(price)}`, box.left + 8, y - 2);
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
      ctx.fillText(formatPrice(currentPrice), box.left + box.width + 2 + badgeW / 2, curY);
      ctx.restore();
    }

    // 11. Crosshair & Dynamic Axes Badges
    if (crosshairEnabled && vp.crosshair) {
      const { y, price, time, logicalIndex } = vp.crosshair;
      // MT5 locks the vertical hair to the centre of the bar it is over, so
      // the time badge and the OHLC readout always describe the same bar.
      const snappedX =
        logicalIndex >= 0 && logicalIndex < candles.length
          ? logicalToX(logicalIndex, box, vp)
          : vp.crosshair.x;
      const x = snappedX;

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
        ctx.fillText(formatPrice(price), box.left + box.width + 2 + priceLabelW / 2, y);

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

    // 11b. Measure ruler — the numbers MT5 shows while you drag the crosshair
    const anchor = measureAnchorRef.current;
    const tip = measureCursorRef.current;
    if (anchor && tip) {
      const ax = logicalToX(anchor.logicalIndex, box, vp);
      const ay = priceToY(anchor.price, box, vp);
      const bx = logicalToX(tip.logicalIndex, box, vp);
      const by = priceToY(tip.price, box, vp);
      const result = measureBetween(anchor, tip, pipMultiplier);
      const rising = result.direction !== 'DOWN';
      const accent = rising ? '#10B981' : '#EF4444';

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.left, box.top, box.width, box.height);
      ctx.clip();

      // Shaded span between the two anchors
      ctx.fillStyle = rising ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)';
      ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));

      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));

      // Direct line from start to end
      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      // Readout card
      const lines = [
        `${result.priceDelta >= 0 ? '+' : ''}${result.priceDelta.toFixed(digits)}  (${result.percentDelta >= 0 ? '+' : ''}${result.percentDelta.toFixed(2)}%)`,
        `${result.pips >= 0 ? '+' : ''}${result.pips.toFixed(1)} pips`,
        `${Math.abs(result.bars)} bars  ${formatDuration(result.milliseconds)}`,
      ];
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      const cardW = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 16;
      const cardH = lines.length * 14 + 10;
      let cardX = bx + 12;
      let cardY = by - cardH / 2;
      if (cardX + cardW > box.left + box.width) cardX = bx - cardW - 12;
      cardY = Math.max(box.top + 2, Math.min(cardY, box.top + box.height - cardH - 2));

      ctx.fillStyle = 'rgba(9, 14, 23, 0.95)';
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((line, index) => {
        ctx.fillStyle = index === 0 ? accent : '#CBD5E1';
        ctx.fillText(line, cardX + 8, cardY + 6 + index * 14);
      });
      ctx.restore();
    }

    // 11c. Publish the zoom level to the status bar. setState bails out when
    // the values are unchanged, so this costs nothing on a redraw loop.
    const barsOnScreen = Math.round(box.width / vp.barSpacing);
    const spacingNow = Math.round(vp.barSpacing * 10) / 10;
    setZoomInfo((previous) =>
      previous.spacing === spacingNow && previous.visibleBars === barsOnScreen
        ? previous
        : { spacing: spacingNow, visibleBars: barsOnScreen },
    );

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
    vwapData,
    digits,
    pipMultiplier,
    formatPrice
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

  // Handle Wheel: Cursor-anchored horizontal zoom or independent price axis zoom.
  //
  // This is registered natively with { passive: false } rather than through
  // React's onWheel. React attaches wheel listeners passively at the root, so
  // preventDefault() there is ignored by the browser: zooming the chart also
  // scrolled the whole dashboard. A native listener is the only way to own
  // the gesture.
  const handleWheel = useCallback((e: WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();

    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const box = getPlotBox();
    const vp = viewportRef.current;

    // Trackpads report deltaMode 1 (lines) / 2 (pages); normalise to pixels
    // or a single notch would jump the chart across the screen.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * box.height : e.deltaY;

    if (pointerX >= box.left + box.width || e.ctrlKey || e.metaKey) {
      // Wheel on right price scale gutter (or Ctrl+wheel) -> zoom price scale
      zoomVertical(pointerY, delta, box, vp);
      setIsAutoscale(false);
    } else if (e.shiftKey) {
      // Shift+wheel -> scroll through history without changing zoom
      panHorizontal(-delta, box, vp);
      setIsFollowingLive(atLiveEdge(candles.length, box, vp));
    } else {
      // Wheel on chart body -> cursor-anchored horizontal zoom
      zoomHorizontal(pointerX, delta, box, vp);
      // Zooming away from the right edge means the user is studying history;
      // stop auto-scrolling so the next tick does not drag them back.
      vp.followLive = atLiveEdge(candles.length, box, vp);
      setIsFollowingLive(vp.followLive);
    }

    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Mouse Down: Start Pan or Price Drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    containerRef.current?.focus({ preventScroll: true });

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const box = getPlotBox();
    const vp = viewportRef.current;

    // Which gutter was grabbed decides the gesture, exactly as in MT5:
    // right scale = stretch price, bottom scale = stretch time, body = pan.
    let dragType: 'PAN' | 'PRICE_SCALE' | 'TIME_SCALE' | 'MEASURE' = 'PAN';
    if (x >= box.left + box.width) dragType = 'PRICE_SCALE';
    else if (y >= box.top + box.height) dragType = 'TIME_SCALE';
    else if (measureMode || e.shiftKey) dragType = 'MEASURE';

    if (dragType === 'MEASURE') {
      const logicalIndex = Math.max(0, Math.min(candles.length - 1, Math.round(xToLogical(x, box, vp))));
      const point = {
        price: yToPrice(y, box, vp),
        logicalIndex,
        time: candles[logicalIndex]?.time ?? Date.now(),
      };
      measureAnchorRef.current = point;
      measureCursorRef.current = point;
      setMeasure(measureBetween(point, point, pipMultiplier));
    }

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
    };
  }, [getPlotBox, measureMode, candles, pipMultiplier]);

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
        // Dragging up/down inside the chart body nudges the price scale too,
        // which is how MT5 behaves once autoscale is switched off.
        if (!vp.autoScale && Math.abs(deltaY) > 0) {
          panVertical(deltaY, box, vp);
        }
        const live = atLiveEdge(candles.length, box, vp);
        setIsFollowingLive(live);
      } else if (dragRef.current.dragType === 'PRICE_SCALE') {
        panVertical(deltaY, box, vp);
        setIsAutoscale(false);
      } else if (dragRef.current.dragType === 'TIME_SCALE') {
        // Dragging the time axis compresses or expands the bars.
        zoomHorizontal(box.left + box.width, -deltaX * 6, box, vp);
        setIsFollowingLive(atLiveEdge(candles.length, box, vp));
      } else if (dragRef.current.dragType === 'MEASURE' && measureAnchorRef.current) {
        const logicalIndex = Math.max(0, Math.min(candles.length - 1, Math.round(xToLogical(x, box, vp))));
        const point = {
          price: yToPrice(y, box, vp),
          logicalIndex,
          time: candles[logicalIndex]?.time ?? Date.now(),
        };
        measureCursorRef.current = point;
        setMeasure(measureBetween(measureAnchorRef.current, point, pipMultiplier));
      }

      dragRef.current.lastX = x;
      dragRef.current.lastY = y;
    }

    // Update crosshair data
    const logicalIdx = Math.round(xToLogical(x, box, vp));
    const priceAtCursor = yToPrice(y, box, vp);
    const clampedIdx = Math.max(0, Math.min(candles.length - 1, logicalIdx));
    const candleAtCursor = candles[logicalIdx] || (candles.length > 0 ? candles[clampedIdx] : undefined);
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
      setHoverIndex(candles[logicalIdx] ? logicalIdx : null);
    }

    // Schedule 60fps canvas draw without choking the JavaScript event loop.
    // The cursor price is pushed into React here, on the same throttle, so the
    // data window updates with the pointer but never more than once a frame.
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        // Only re-render React when the *displayed* cursor price changes,
        // not on every sub-tick pixel of mouse movement.
        const quantized = Number(priceAtCursor.toFixed(digits));
        setCursorPrice((previous) => (previous === quantized ? previous : quantized));
        renderFrame();
        renderRequestedRef.current = false;
      });
    }
  }, [getPlotBox, candles, renderFrame, pipMultiplier, digits]);

  // Mouse Up: Terminate Drag. A measurement taken with a real drag stays on
  // screen so the numbers can be read; a stray click clears it.
  const handleMouseUp = useCallback(() => {
    if (dragRef.current.dragType === 'MEASURE') {
      const anchor = measureAnchorRef.current;
      const tip = measureCursorRef.current;
      const negligible = !anchor || !tip || (anchor.logicalIndex === tip.logicalIndex && anchor.price === tip.price);
      if (negligible) {
        measureAnchorRef.current = null;
        measureCursorRef.current = null;
        setMeasure(null);
      }
    }
    dragRef.current.isDragging = false;
    renderFrame();
  }, [renderFrame]);

  const clearMeasurement = useCallback(() => {
    measureAnchorRef.current = null;
    measureCursorRef.current = null;
    setMeasure(null);
    renderFrame();
  }, [renderFrame]);

  // Mouse Leave: Clear Crosshair
  const handleMouseLeave = useCallback(() => {
    dragRef.current.isDragging = false;
    viewportRef.current.crosshair = null;
    lastHudTimeRef.current = null;
    setActiveHudCandle(null);
    setHoverIndex(null);
    setCursorPrice(null);
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
      const y = e.touches[0].clientY - rect.top;
      const deltaX = x - dragRef.current.lastX;
      const deltaY = y - dragRef.current.lastY;
      panHorizontal(deltaX, box, vp);
      if (!vp.autoScale) panVertical(deltaY, box, vp);
      setIsFollowingLive(atLiveEdge(candles.length, box, vp));
      dragRef.current.lastX = x;
      dragRef.current.lastY = y;
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
      // Keep the bar under the pinch midpoint pinned, otherwise the chart
      // slides sideways while you are only trying to zoom.
      const anchorX = pinchRef.current.midpointX;
      const anchorLogical = xToLogical(anchorX, box, vp);
      vp.barSpacing = newSpacing;
      vp.firstLogical = anchorLogical - (anchorX - box.left) / newSpacing;
      vp.followLive = atLiveEdge(candles.length, box, vp);
      setIsFollowingLive(vp.followLive);
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

  // Zoom Buttons — discrete steps, so each press is a predictable amount
  const applyZoomStep = useCallback((direction: 1 | -1) => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    // Zoom around the live edge when following, otherwise around the centre.
    const anchorX = vp.followLive ? box.left + box.width : box.left + box.width / 2;
    zoomStep(direction, box, vp, anchorX);
    if (vp.followLive) followLatest(candles.length, box, vp);
    setIsFollowingLive(atLiveEdge(candles.length, box, vp));
    renderFrame();
  }, [getPlotBox, candles.length, renderFrame]);

  const handleZoomIn = useCallback(() => applyZoomStep(1), [applyZoomStep]);
  const handleZoomOut = useCallback(() => applyZoomStep(-1), [applyZoomStep]);

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

  const toggleAutoscale = useCallback(() => {
    const vp = viewportRef.current;
    vp.autoScale = !vp.autoScale;
    setIsAutoscale(vp.autoScale);
    renderFrame();
  }, [renderFrame]);

  // MT5 keyboard map. The chart is focusable, so these only fire when it has
  // focus — typing in the ANGEL chat box never moves the chart.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const box = getPlotBox();
    const vp = viewportRef.current;
    const fast = e.ctrlKey || e.metaKey;
    const panBars = fast ? Math.max(1, Math.round(box.width / vp.barSpacing / 2)) : 1;
    let handled = true;

    switch (e.key) {
      case '+':
      case '=':
        applyZoomStep(1);
        break;
      case '-':
      case '_':
        applyZoomStep(-1);
        break;
      case 'ArrowLeft':
        panHorizontal(panBars * vp.barSpacing, box, vp);
        setIsFollowingLive(atLiveEdge(candles.length, box, vp));
        break;
      case 'ArrowRight':
        panHorizontal(-panBars * vp.barSpacing, box, vp);
        setIsFollowingLive(atLiveEdge(candles.length, box, vp));
        break;
      case 'ArrowUp':
        panVertical(-24, box, vp);
        setIsAutoscale(false);
        break;
      case 'ArrowDown':
        panVertical(24, box, vp);
        setIsAutoscale(false);
        break;
      case 'PageUp':
        panHorizontal(box.width * 0.9, box, vp);
        setIsFollowingLive(atLiveEdge(candles.length, box, vp));
        break;
      case 'PageDown':
        panHorizontal(-box.width * 0.9, box, vp);
        setIsFollowingLive(atLiveEdge(candles.length, box, vp));
        break;
      case 'Home':
        vp.firstLogical = 0;
        setIsFollowingLive(false);
        break;
      case 'End':
        followLatest(candles.length, box, vp);
        setIsFollowingLive(true);
        break;
      case '5':
        toggleAutoscale();
        break;
      case 'Escape':
        clearMeasurement();
        break;
      default:
        handled = false;
    }

    if (!handled) {
      const key = e.key.toLowerCase();
      if (key === 'c') { setCrosshairEnabled((value) => !value); handled = true; }
      else if (key === 'm') { setMeasureMode((value) => !value); handled = true; }
      else if (key === 'd') { setShowDataWindow((value) => !value); handled = true; }
      else if (key === 'l') { setChartType((value) => (value === 'LINE' ? 'CANDLESTICK' : 'LINE')); handled = true; }
      else if (key === 'v') { setShowVolume((value) => !value); handled = true; }
    }

    if (handled) {
      e.preventDefault();
      renderFrame();
    }
  }, [getPlotBox, candles.length, renderFrame, applyZoomStep, toggleAutoscale, clearMeasurement]);

  const activeDominionSpec = getDominionTimeframe(timeframe);
  const currentCandle = activeHudCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  const readoutIndex = hoverIndex ?? (candles.length > 0 ? candles.length - 1 : null);
  const isHovering = hoverIndex !== null;

  // Every indicator value is read at the hovered bar, not at the live edge,
  // so the data window answers "what was this at that moment".
  const readout = useMemo(() => {
    if (readoutIndex === null || !candles[readoutIndex]) return null;
    const candle = candles[readoutIndex];
    const previous = readoutIndex > 0 ? candles[readoutIndex - 1] : null;
    const change = candle.close - candle.open;
    const prevChange = previous ? candle.close - previous.close : null;
    return {
      candle,
      index: readoutIndex,
      change,
      changePercent: candle.open !== 0 ? (change / candle.open) * 100 : 0,
      changePips: change * pipMultiplier,
      range: candle.high - candle.low,
      rangePips: (candle.high - candle.low) * pipMultiplier,
      body: Math.abs(candle.close - candle.open),
      upperWick: candle.high - Math.max(candle.open, candle.close),
      lowerWick: Math.min(candle.open, candle.close) - candle.low,
      versusPrevious: prevChange,
      sma20: sma20[readoutIndex] ?? null,
      ema50: ema50[readoutIndex] ?? null,
      ema200: ema200[readoutIndex] ?? null,
    };
  }, [readoutIndex, candles, sma20, ema50, ema200, pipMultiplier]);

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
            title="Crosshair (C)"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              crosshairEnabled
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
            }`}
          >
            <CrosshairIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setMeasureMode(!measureMode)}
            title="Measure tool — drag between two points (M, or hold Shift and drag)"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              measureMode
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowDataWindow(!showDataWindow)}
            title="Data Window (D)"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              showDataWindow
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-400'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
            }`}
          >
            <Table2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleAutoscale}
            title={isAutoscale ? 'Auto scale is on — click to fix the price scale (5)' : 'Price scale is fixed — click for auto scale (5)'}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isAutoscale
                ? 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
            }`}
          >
            {isAutoscale ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowShortcuts(!showShortcuts)}
            title="Keyboard shortcuts"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              showShortcuts
                ? 'bg-slate-500/20 border-slate-500/50 text-slate-200'
                : 'bg-[#080C14] border-[#1E2638] text-slate-500 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Interactive Canvas Stage Container */}
      <div 
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`relative w-full h-[450px] sm:h-[500px] overflow-hidden rounded-xl bg-[#080C14] border border-[#1A2234] touch-none outline-none focus:border-cyan-600/60 ${
          measureMode ? 'cursor-cell' : 'cursor-crosshair'
        }`}
      >
        {/* Main Fluid Canvas */}
        <canvas
          ref={canvasRef}
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
            <span className="text-slate-400">O: <strong className="text-slate-200">{formatPrice(currentCandle.open)}</strong></span>
            <span className="text-slate-400">H: <strong className="text-emerald-400">{formatPrice(currentCandle.high)}</strong></span>
            <span className="text-slate-400">L: <strong className="text-rose-400">{formatPrice(currentCandle.low)}</strong></span>
            <span className="text-slate-400">C: <strong className={currentCandle.close >= currentCandle.open ? 'text-emerald-400' : 'text-rose-400'}>{formatPrice(currentCandle.close)}</strong></span>
            {readout && (
              <span className={readout.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {readout.change >= 0 ? '+' : ''}{formatPrice(readout.change)} ({readout.changePercent >= 0 ? '+' : ''}{readout.changePercent.toFixed(2)}%)
              </span>
            )}
            {showVolume && <span className="text-slate-400">V: <strong className="text-slate-300">{currentCandle.volume.toLocaleString()}</strong></span>}

            {showSma20 && readout?.sma20 !== null && readout?.sma20 !== undefined && (
              <span className="text-amber-400 text-[10px]">SMA20: {formatPrice(readout.sma20)}</span>
            )}
            {showEma50 && readout?.ema50 !== null && readout?.ema50 !== undefined && (
              <span className="text-cyan-400 text-[10px]">EMA50: {formatPrice(readout.ema50)}</span>
            )}
            {isHovering && <span className="text-slate-500 text-[10px]">bar #{(readoutIndex ?? 0) + 1}</span>}
          </div>
        )}

        {/* MT5 Data Window — every number for the bar under the cursor */}
        {showDataWindow && readout && (
          <div className="absolute top-2 right-[86px] z-10 w-[188px] hidden sm:block bg-[#090E17]/95 backdrop-blur-md rounded-lg border border-[#1E2638] shadow-xl text-[10px] font-mono overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0E1626] border-b border-[#1E2638]">
              <span className="text-slate-300 font-semibold tracking-wide">DATA WINDOW</span>
              <button
                type="button"
                onClick={() => setShowDataWindow(false)}
                className="text-slate-500 hover:text-white cursor-pointer leading-none"
                title="Hide (D)"
              >
                ×
              </button>
            </div>
            <div className="px-2.5 py-1.5 space-y-[3px]">
              <DataRow label="Date" value={new Date(readout.candle.time).toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' })} />
              <DataRow label="Time" value={new Date(readout.candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} />
              <div className="h-px bg-[#1A2234] my-1" />
              <DataRow label="Open" value={formatPrice(readout.candle.open)} />
              <DataRow label="High" value={formatPrice(readout.candle.high)} tone="up" />
              <DataRow label="Low" value={formatPrice(readout.candle.low)} tone="down" />
              <DataRow label="Close" value={formatPrice(readout.candle.close)} tone={readout.change >= 0 ? 'up' : 'down'} />
              <DataRow label="Volume" value={readout.candle.volume.toLocaleString()} />
              <div className="h-px bg-[#1A2234] my-1" />
              <DataRow
                label="Change"
                value={`${readout.change >= 0 ? '+' : ''}${formatPrice(readout.change)}`}
                tone={readout.change >= 0 ? 'up' : 'down'}
              />
              <DataRow
                label="Change %"
                value={`${readout.changePercent >= 0 ? '+' : ''}${readout.changePercent.toFixed(2)}%`}
                tone={readout.change >= 0 ? 'up' : 'down'}
              />
              <DataRow
                label="Change pips"
                value={`${readout.changePips >= 0 ? '+' : ''}${readout.changePips.toFixed(1)}`}
                tone={readout.change >= 0 ? 'up' : 'down'}
              />
              <DataRow label="Range" value={`${formatPrice(readout.range)} (${readout.rangePips.toFixed(1)}p)`} />
              <DataRow label="Body" value={formatPrice(readout.body)} />
              <DataRow label="Wick up" value={formatPrice(readout.upperWick)} />
              <DataRow label="Wick dn" value={formatPrice(readout.lowerWick)} />
              {(showSma20 || showEma50 || showEma200 || showVwap) && <div className="h-px bg-[#1A2234] my-1" />}
              {showSma20 && <DataRow label="SMA 20" value={formatPrice(readout.sma20)} color="text-amber-300" />}
              {showEma50 && <DataRow label="EMA 50" value={formatPrice(readout.ema50)} color="text-cyan-300" />}
              {showEma200 && <DataRow label="EMA 200" value={formatPrice(readout.ema200)} color="text-purple-300" />}
              {showVwap && vwapData && <DataRow label="VWAP" value={formatPrice(vwapData.vwap)} color="text-blue-300" />}
              <div className="h-px bg-[#1A2234] my-1" />
              <DataRow label="Cursor" value={formatPrice(cursorPrice)} color="text-slate-200" />
              <DataRow label="Bid" value={formatPrice(activeInstrument.bid)} />
              <DataRow label="Ask" value={formatPrice(activeInstrument.ask)} />
              <DataRow label="Spread" value={Number.isFinite(activeInstrument.spreadPips) ? `${activeInstrument.spreadPips.toFixed(1)} pips` : '—'} />
              <DataRow label="Bars" value={`${(readout.index + 1).toLocaleString()} / ${candles.length.toLocaleString()}`} />
            </div>
            {!isHovering && (
              <div className="px-2.5 pb-1.5 text-[9px] text-slate-500">Showing latest bar — hover the chart</div>
            )}
          </div>
        )}

        {/* Measure ruler summary */}
        {measure && (
          <div className="absolute bottom-10 left-2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#090E17]/95 border border-[#1E2638] text-[10px] font-mono shadow-lg">
            <Ruler className="w-3.5 h-3.5 text-emerald-400" />
            <span className={measure.priceDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {measure.priceDelta >= 0 ? '+' : ''}{formatPrice(measure.priceDelta)}
            </span>
            <span className="text-slate-400">{measure.percentDelta >= 0 ? '+' : ''}{measure.percentDelta.toFixed(2)}%</span>
            <span className="text-slate-400">{measure.pips >= 0 ? '+' : ''}{measure.pips.toFixed(1)} pips</span>
            <span className="text-slate-500">{Math.abs(measure.bars)} bars · {formatDuration(measure.milliseconds)}</span>
            <button type="button" onClick={clearMeasurement} className="text-slate-500 hover:text-white cursor-pointer">×</button>
          </div>
        )}

        {/* Keyboard shortcut reference */}
        {showShortcuts && (
          <div className="absolute inset-x-2 bottom-2 sm:inset-x-auto sm:left-2 sm:w-[420px] z-30 bg-[#090E17]/97 backdrop-blur-md rounded-lg border border-[#1E2638] shadow-2xl p-3 text-[10px] font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-200 font-semibold tracking-wide">CHART CONTROLS</span>
              <button type="button" onClick={() => setShowShortcuts(false)} className="text-slate-500 hover:text-white cursor-pointer">×</button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
              <Shortcut keys="Scroll" action="Zoom at cursor" />
              <Shortcut keys="+ / −" action="Zoom step in / out" />
              <Shortcut keys="Shift + scroll" action="Scroll history" />
              <Shortcut keys="← →" action="Pan one bar" />
              <Shortcut keys="Ctrl + scroll" action="Zoom price scale" />
              <Shortcut keys="Ctrl + ← →" action="Pan one screen" />
              <Shortcut keys="Drag chart" action="Pan" />
              <Shortcut keys="↑ ↓" action="Shift price scale" />
              <Shortcut keys="Drag price axis" action="Stretch price" />
              <Shortcut keys="Home / End" action="Oldest / latest bar" />
              <Shortcut keys="Drag time axis" action="Stretch time" />
              <Shortcut keys="5" action="Auto scale on / off" />
              <Shortcut keys="Shift + drag" action="Measure" />
              <Shortcut keys="M" action="Measure mode" />
              <Shortcut keys="Double-click" action="Reset to live" />
              <Shortcut keys="C / D / V / L" action="Crosshair / data / vol / line" />
              <Shortcut keys="Pinch" action="Zoom (touch)" />
              <Shortcut keys="Esc" action="Clear measurement" />
            </div>
            <p className="mt-2 text-[9px] text-slate-500">Click the chart first so it has keyboard focus.</p>
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

        {/* Status strip — the MT5 chart status bar */}
        {!showShortcuts && (
          <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[10px] font-mono">
            <span className="text-slate-500 tabular-nums">
              {zoomInfo.visibleBars} bars · {zoomInfo.spacing.toFixed(1)} px/bar
            </span>
            <button
              type="button"
              onClick={toggleAutoscale}
              className={`px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${
                isAutoscale
                  ? 'border-[#1E2638] text-slate-500 hover:text-slate-300'
                  : 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
              title="Toggle auto scale (5)"
            >
              {isAutoscale ? 'AUTO SCALE' : 'FIXED SCALE'}
            </button>
            {measureMode && (
              <span className="px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                MEASURE
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="hidden sm:inline text-slate-600 hover:text-slate-300 cursor-pointer"
            >
              shortcuts
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
