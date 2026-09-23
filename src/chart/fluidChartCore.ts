/**
 * Fluid Financial Chart State Machine & Data-Space Transform Core
 * Implements architectural invariants from:
 * MetaTrader 5, TradingView, Lightweight Charts, Highcharts Stock, and Apache ECharts.
 */

import { Candle } from '../types';

export type ChartInteractionMode = 'navigate' | 'crosshair' | 'measure' | 'edit';
export type ChartDisplayType = 'CANDLESTICK' | 'BAR' | 'LINE';

export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
  priceAxisWidth: number;
  timeAxisHeight: number;
  volumePaneHeight: number;
}

export interface ViewportState {
  firstLogical: number;        // fractional logical index at plotLeft
  barSpacing: number;          // CSS pixels per logical bar (e.g. 3 to 45)
  minBarSpacing: number;       // min zoom limit
  maxBarSpacing: number;       // max zoom limit
  priceMin: number;            // visible price domain minimum
  priceMax: number;            // visible price domain maximum
  autoScale: boolean;          // true: autoscale to visible range; false: user dragged/zoomed price scale
  priceLocked: boolean;
  followLive: boolean;         // true: auto-scroll keeps rightMarginBars; false: browsing history
  rightMarginBars: number;     // canonical chart shift right indent (e.g. 10 bars)
  mode: ChartInteractionMode;
  crosshair: {
    x: number;
    y: number;
    logicalIndex: number;
    price: number;
    time: number;
    candle?: Candle;
  } | null;
}

export interface TransformSnapshot {
  box: PlotBox;
  viewport: ViewportState;
  dpr: number;
}

/**
 * Data coordinate to screen pixel transforms
 */
export function logicalToX(i: number, box: PlotBox, viewport: ViewportState): number {
  return box.left + (i - viewport.firstLogical) * viewport.barSpacing;
}

export function xToLogical(x: number, box: PlotBox, viewport: ViewportState): number {
  return viewport.firstLogical + (x - box.left) / Math.max(viewport.barSpacing, 0.001);
}

export function priceToY(price: number, box: PlotBox, viewport: ViewportState): number {
  const range = Math.max(viewport.priceMax - viewport.priceMin, 0.0001);
  const ratio = (viewport.priceMax - price) / range;
  return box.top + ratio * box.height;
}

export function yToPrice(y: number, box: PlotBox, viewport: ViewportState): number {
  const range = Math.max(viewport.priceMax - viewport.priceMin, 0.0001);
  const ratio = (y - box.top) / Math.max(box.height, 1);
  return viewport.priceMax - ratio * range;
}

/**
 * Cursor-anchored horizontal zoom:
 * Invariant: the exact data coordinate (bar/time) under pointerX remains stationary on screen!
 */
export function zoomHorizontal(
  pointerX: number,
  wheelDelta: number,
  box: PlotBox,
  viewport: ViewportState
): void {
  const anchor = xToLogical(pointerX, box, viewport);
  const factor = Math.exp(-wheelDelta * 0.0015);
  const nextSpacing = Math.max(
    viewport.minBarSpacing,
    Math.min(viewport.maxBarSpacing, viewport.barSpacing * factor)
  );
  viewport.barSpacing = nextSpacing;
  viewport.firstLogical = anchor - (pointerX - box.left) / nextSpacing;
}

/**
 * Independent vertical zoom around pointer price
 */
export function zoomVertical(
  pointerY: number,
  wheelDelta: number,
  box: PlotBox,
  viewport: ViewportState
): void {
  const anchorPrice = yToPrice(pointerY, box, viewport);
  const factor = Math.exp(-wheelDelta * 0.0015);
  const oldRange = Math.max(viewport.priceMax - viewport.priceMin, 0.0001);
  const nextRange = Math.max(oldRange * factor, 0.01);
  const nextMin = anchorPrice - (anchorPrice - viewport.priceMin) * (nextRange / oldRange);
  viewport.priceMin = nextMin;
  viewport.priceMax = nextMin + nextRange;
  viewport.autoScale = false;
}

/**
 * Vertical pan (scale dragging on price scale)
 */
export function panVertical(
  deltaPixels: number,
  box: PlotBox,
  viewport: ViewportState
): void {
  const range = Math.max(viewport.priceMax - viewport.priceMin, 0.0001);
  const deltaPrice = (deltaPixels * range) / Math.max(box.height, 1);
  viewport.priceMin += deltaPrice;
  viewport.priceMax += deltaPrice;
  viewport.autoScale = false;
}

/**
 * Horizontal pan
 */
export function panHorizontal(
  deltaPixels: number,
  box: PlotBox,
  viewport: ViewportState
): void {
  viewport.firstLogical -= deltaPixels / Math.max(viewport.barSpacing, 0.001);
  if (Math.abs(deltaPixels) > 1.5) {
    viewport.followLive = false;
  }
}

/**
 * Check if viewport is positioned at the live edge
 */
export function atLiveEdge(
  totalBars: number,
  box: PlotBox,
  viewport: ViewportState,
  toleranceBars: number = 3
): boolean {
  if (totalBars <= 0) return true;
  const visibleBars = box.width / Math.max(viewport.barSpacing, 0.001);
  const lastIndex = totalBars - 1;
  const rightmostVisible = viewport.firstLogical + visibleBars;
  return (lastIndex - rightmostVisible + viewport.rightMarginBars) <= toleranceBars;
}

/**
 * Jump and snap viewport to the live edge with rightMarginBars preserved
 */
export function followLatest(
  totalBars: number,
  box: PlotBox,
  viewport: ViewportState
): void {
  if (totalBars <= 0) return;
  const visibleBars = box.width / Math.max(viewport.barSpacing, 0.001);
  const lastIndex = totalBars - 1;
  viewport.firstLogical = lastIndex + 1 - visibleBars + viewport.rightMarginBars;
  viewport.followLive = true;
}

/**
 * Calculate autoscale price boundaries for visible bars with vertical padding
 */
export function calculateVisiblePriceRange(
  bars: Candle[],
  box: PlotBox,
  viewport: ViewportState,
  pivots?: { r2?: number; s2?: number }
): { priceMin: number; priceMax: number } {
  if (bars.length === 0) {
    return { priceMin: 0, priceMax: 100 };
  }

  const startIdx = Math.max(0, Math.floor(viewport.firstLogical));
  const visibleCount = Math.ceil(box.width / Math.max(viewport.barSpacing, 0.001));
  const endIdx = Math.min(bars.length - 1, startIdx + visibleCount + 1);

  let min = Infinity;
  let max = -Infinity;

  for (let i = startIdx; i <= endIdx; i++) {
    const b = bars[i];
    if (b) {
      if (b.low < min) min = b.low;
      if (b.high > max) max = b.high;
    }
  }

  // Include pivots within bounds if active
  if (pivots?.r2 && pivots.r2 > max && pivots.r2 < max * 1.05) max = pivots.r2;
  if (pivots?.s2 && pivots.s2 < min && pivots.s2 > min * 0.95) min = pivots.s2;

  if (min === Infinity || max === -Infinity) {
    const last = bars[bars.length - 1].close;
    min = last * 0.998;
    max = last * 1.002;
  }

  const range = max - min;
  const padding = range > 0 ? range * 0.09 : 1.0;

  return {
    priceMin: Number((min - padding).toFixed(3)),
    priceMax: Number((max + padding).toFixed(3)),
  };
}

/**
 * Aggregate real-time tick into canonical candle sequence
 */
export function aggregateTickIntoCandles(
  bars: Candle[],
  tick: { time: number; price: number; volume?: number },
  resolutionMs: number
): Candle[] {
  const bucket = Math.floor(tick.time / resolutionMs) * resolutionMs;
  const copy = [...bars];
  const last = copy[copy.length - 1];

  if (!last || bucket > last.time) {
    // New candle formed
    const newCandle: Candle = {
      time: bucket,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: tick.volume || 100,
      isBullish: true,
      isComplete: false,
    };
    copy.push(newCandle);
    if (copy.length > 500) copy.shift();
  } else if (bucket === last.time) {
    // Update existing active candle in place
    copy[copy.length - 1] = {
      ...last,
      high: Math.max(last.high, tick.price),
      low: Math.min(last.low, tick.price),
      close: tick.price,
      volume: (last.volume || 0) + (tick.volume || 1),
      isBullish: tick.price >= last.open,
      isComplete: false,
    };
  }

  return copy;
}
