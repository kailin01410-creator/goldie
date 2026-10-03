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
  pivots?: { r2?: number; s2?: number },
  decimals: number = 3
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
  // Pad relative to the price when the window is flat, otherwise a single
  // repeated close would collapse the scale to a zero-height band.
  const padding = range > 0 ? range * 0.09 : Math.max(max * 0.0005, tickSizeForDecimals(decimals) * 10);

  // Round at the instrument's own precision, never at a fixed 3 decimals —
  // that used to flatten EUR/USD (5 digits) onto a 0.001 grid.
  const rounding = Math.max(decimals + 1, 3);

  return {
    priceMin: Number((min - padding).toFixed(rounding)),
    priceMax: Number((max + padding).toFixed(rounding)),
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

/* ------------------------------------------------------------------ */
/* MT5-style scale construction                                        */
/*                                                                     */
/* MetaTrader draws grid lines on round numbers and labels them with   */
/* exactly as many digits as the step requires. The previous code      */
/* always formatted to two decimals, so zooming into a 0.005 grid      */
/* printed the same label several times in a row — the axis looked     */
/* broken and a number could not be read off it.                       */
/* ------------------------------------------------------------------ */

/** Smallest price increment the instrument actually quotes. */
export function tickSizeForDecimals(decimals: number): number {
  // Number('1e-5') is exact where Math.pow(10, -5) is 9.999999999999999e-6,
  // and that error leaks straight into the grid step and the labels.
  return Number(`1e-${Math.max(0, Math.round(decimals))}`);
}

/**
 * Snap a raw step up to the next "nice" value: 1, 2, 2.5, 5 or 10 times a
 * power of ten, never finer than one tick. 2.5 is included because MT5 uses
 * it and it is what makes a 25-pip grid possible.
 */
export function niceStep(rawStep: number, minTick = 0): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return Math.max(minTick, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  let snapped: number;
  if (normalized <= 1) snapped = 1;
  else if (normalized <= 2) snapped = 2;
  else if (normalized <= 2.5) snapped = 2.5;
  else if (normalized <= 5) snapped = 5;
  else snapped = 10;

  return Math.max(snapped * magnitude, minTick);
}

/**
 * How many decimals a label needs so that two adjacent grid values never
 * render as the same string. Capped by the instrument's own precision.
 */
export function decimalsForStep(step: number, maxDecimals: number): number {
  if (!Number.isFinite(step) || step <= 0) return maxDecimals;
  // Read the digits off the step itself. -log10(step) is not enough: 0.00025
  // needs five decimals but its logarithm only suggests four.
  const text = step.toFixed(Math.min(12, Math.max(0, maxDecimals) + 4));
  const trimmed = text.replace(/0+$/, '');
  const dot = trimmed.indexOf('.');
  const needed = dot === -1 ? 0 : trimmed.length - dot - 1;
  return Math.min(maxDecimals, Math.max(0, needed));
}

export interface PriceTick {
  price: number;
  y: number;
  label: string;
  /** Major lines are brighter — every 5th step, as MT5 does. */
  major: boolean;
}

/** Build the horizontal price grid for the current viewport. */
export function buildPriceTicks(
  box: PlotBox,
  viewport: ViewportState,
  options: { decimals: number; targetSpacingPx?: number } = { decimals: 2 },
): { ticks: PriceTick[]; step: number; labelDecimals: number } {
  const targetSpacing = options.targetSpacingPx ?? 52;
  const range = Math.max(viewport.priceMax - viewport.priceMin, 1e-9);
  const targetSteps = Math.max(2, Math.floor(box.height / targetSpacing));
  const minTick = tickSizeForDecimals(options.decimals);
  const step = niceStep(range / targetSteps, minTick);
  const labelDecimals = decimalsForStep(step, options.decimals);

  const ticks: PriceTick[] = [];
  const first = Math.ceil(viewport.priceMin / step) * step;
  // Guard against a pathological step that would spin forever.
  const maxTicks = 200;

  for (let n = 0; n < maxTicks; n++) {
    const price = first + n * step;
    if (price > viewport.priceMax) break;
    const y = priceToY(price, box, viewport);
    if (y < box.top - 1 || y > box.top + box.height + 1) continue;
    // Round to the nearest step to kill floating point drift (…4999999).
    const snapped = Math.round(price / step) * step;
    ticks.push({
      price: snapped,
      y,
      label: snapped.toFixed(labelDecimals),
      major: Math.abs(snapped / step) % 5 < 0.0001,
    });
  }

  return { ticks, step, labelDecimals };
}

export interface TimeTick {
  logicalIndex: number;
  x: number;
  label: string;
  /** True at a day boundary — MT5 prints the date and a brighter line. */
  isDayBoundary: boolean;
}

/**
 * Build the vertical time grid. Unlike the previous "every Nth array index"
 * approach this is aware of calendar boundaries, so the axis reads like MT5:
 * times within a day, and the date wherever the day changes.
 */
export function buildTimeTicks(
  candles: Candle[],
  box: PlotBox,
  viewport: ViewportState,
  options: { minLabelSpacingPx?: number } = {},
): TimeTick[] {
  if (candles.length === 0) return [];
  const minSpacing = options.minLabelSpacingPx ?? 74;

  const firstBar = Math.max(0, Math.floor(viewport.firstLogical) - 1);
  const lastBar = Math.min(candles.length - 1, Math.ceil(viewport.firstLogical + box.width / viewport.barSpacing) + 1);
  if (lastBar < firstBar) return [];

  const ticks: TimeTick[] = [];
  let lastLabelX = -Infinity;
  let previousDay: string | null = firstBar > 0 ? new Date(candles[firstBar - 1].time).toDateString() : null;

  for (let i = firstBar; i <= lastBar; i++) {
    const candle = candles[i];
    if (!candle) continue;
    const date = new Date(candle.time);
    const day = date.toDateString();
    const isDayBoundary = previousDay !== null && day !== previousDay;
    previousDay = day;

    const x = logicalToX(i, box, viewport);
    if (x < box.left || x > box.left + box.width) continue;

    // A day boundary always gets a label; regular ticks only when there is
    // room, so labels never overlap at any zoom level.
    if (!isDayBoundary && x - lastLabelX < minSpacing) continue;

    ticks.push({
      logicalIndex: i,
      x,
      label: isDayBoundary
        ? date.toLocaleDateString([], { day: '2-digit', month: 'short' })
        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      isDayBoundary,
    });
    lastLabelX = x;
  }

  return ticks;
}

/**
 * Discrete zoom ladder. MT5 zooms in fixed steps rather than continuously,
 * which is what makes its +/- buttons and keyboard feel predictable.
 */
export const ZOOM_LADDER = [1.5, 2.5, 4, 6, 9.5, 14, 20, 28, 38, 50] as const;

export function zoomStep(
  direction: 1 | -1,
  box: PlotBox,
  viewport: ViewportState,
  anchorX?: number,
): void {
  const anchor = anchorX ?? box.left + box.width / 2;
  const anchorLogical = xToLogical(anchor, box, viewport);

  const current = viewport.barSpacing;
  let next = current;
  if (direction > 0) {
    next = ZOOM_LADDER.find((value) => value > current * 1.001) ?? ZOOM_LADDER[ZOOM_LADDER.length - 1];
  } else {
    const below = ZOOM_LADDER.filter((value) => value < current * 0.999);
    next = below.length > 0 ? below[below.length - 1] : ZOOM_LADDER[0];
  }

  viewport.barSpacing = Math.max(viewport.minBarSpacing, Math.min(viewport.maxBarSpacing, next));
  viewport.firstLogical = anchorLogical - (anchor - box.left) / viewport.barSpacing;
}

export interface MeasureResult {
  priceDelta: number;
  percentDelta: number;
  pips: number;
  bars: number;
  milliseconds: number;
  direction: 'UP' | 'DOWN' | 'FLAT';
}

/** The numbers MT5 shows while you drag the crosshair between two points. */
export function measureBetween(
  from: { price: number; logicalIndex: number; time: number },
  to: { price: number; logicalIndex: number; time: number },
  pipMultiplier: number,
): MeasureResult {
  const priceDelta = to.price - from.price;
  return {
    priceDelta,
    percentDelta: from.price !== 0 ? (priceDelta / from.price) * 100 : 0,
    pips: priceDelta * (pipMultiplier || 1),
    bars: to.logicalIndex - from.logicalIndex,
    milliseconds: to.time - from.time,
    direction: priceDelta > 0 ? 'UP' : priceDelta < 0 ? 'DOWN' : 'FLAT',
  };
}

/** "2h 15m", "3d 4h", "45m" — compact elapsed-time rendering for the ruler. */
export function formatDuration(milliseconds: number): string {
  const abs = Math.abs(milliseconds);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}
