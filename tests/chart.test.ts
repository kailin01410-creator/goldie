import test from 'node:test';
import assert from 'node:assert/strict';

import {
  niceStep,
  decimalsForStep,
  tickSizeForDecimals,
  buildPriceTicks,
  buildTimeTicks,
  zoomStep,
  measureBetween,
  formatDuration,
  calculateVisiblePriceRange,
  logicalToX,
  xToLogical,
  priceToY,
  yToPrice,
  zoomHorizontal,
  panHorizontal,
  atLiveEdge,
  followLatest,
  ZOOM_LADDER,
  PlotBox,
  ViewportState,
} from '../src/chart/fluidChartCore';
import { Candle } from '../src/types';

function makeBox(overrides: Partial<PlotBox> = {}): PlotBox {
  return {
    left: 0,
    top: 24,
    width: 800,
    height: 400,
    priceAxisWidth: 76,
    timeAxisHeight: 28,
    volumePaneHeight: 65,
    ...overrides,
  };
}

function makeViewport(overrides: Partial<ViewportState> = {}): ViewportState {
  return {
    firstLogical: 0,
    barSpacing: 9.5,
    minBarSpacing: 2.5,
    maxBarSpacing: 45,
    priceMin: 2600,
    priceMax: 2700,
    autoScale: true,
    priceLocked: false,
    followLive: true,
    rightMarginBars: 10,
    mode: 'navigate',
    crosshair: null,
    ...overrides,
  };
}

function makeCandles(count: number, startTime = Date.UTC(2026, 0, 5, 0, 0, 0), stepMs = 60_000): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const open = 2650 + Math.sin(i / 7) * 5;
    const close = open + (i % 3 === 0 ? 1.2 : -0.8);
    out.push({
      time: startTime + i * stepMs,
      open,
      high: Math.max(open, close) + 0.6,
      low: Math.min(open, close) - 0.6,
      close,
      volume: 100 + (i % 11) * 13,
      isBullish: close >= open,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Grid step selection                                                 */
/* ------------------------------------------------------------------ */

test('niceStep snaps to 1 / 2 / 2.5 / 5 / 10 times a power of ten', () => {
  assert.equal(niceStep(0.9), 1);
  assert.equal(niceStep(1.4), 2);
  assert.equal(niceStep(2.3), 2.5);
  assert.equal(niceStep(4.1), 5);
  assert.equal(niceStep(7.7), 10);
  assert.equal(niceStep(23), 25);
  assert.equal(niceStep(0.0004), 0.0005);
});

test('niceStep never returns a step finer than one tick', () => {
  const tick = tickSizeForDecimals(2);
  assert.equal(niceStep(0.0001, tick), 0.01);
});

test('niceStep is defensive about nonsense input', () => {
  assert.equal(niceStep(0), 1);
  assert.equal(niceStep(-5), 1);
  assert.equal(niceStep(Number.NaN), 1);
});

test('decimalsForStep gives each grid line a distinct label', () => {
  assert.equal(decimalsForStep(25, 2), 0);
  assert.equal(decimalsForStep(0.5, 2), 1);
  assert.equal(decimalsForStep(0.05, 2), 2);
  assert.equal(decimalsForStep(0.00025, 5), 5);
  // Never asks for more precision than the instrument quotes.
  assert.equal(decimalsForStep(0.00001, 2), 2);
});

test('tickSizeForDecimals matches the quote precision', () => {
  assert.equal(tickSizeForDecimals(2), 0.01);
  assert.equal(tickSizeForDecimals(5), 0.00001);
  assert.equal(tickSizeForDecimals(0), 1);
});

/* ------------------------------------------------------------------ */
/* Price axis                                                          */
/* ------------------------------------------------------------------ */

test('buildPriceTicks produces unique, ascending, in-range labels', () => {
  const box = makeBox();
  const vp = makeViewport({ priceMin: 2641.37, priceMax: 2688.42 });
  const { ticks } = buildPriceTicks(box, vp, { decimals: 2 });

  assert.ok(ticks.length >= 4, 'expected a usable number of grid lines');
  const labels = ticks.map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length, 'duplicate axis labels');

  for (let i = 1; i < ticks.length; i++) {
    assert.ok(ticks[i].price > ticks[i - 1].price);
    assert.ok(ticks[i].y < ticks[i - 1].y, 'higher price must sit higher on screen');
  }
  for (const tick of ticks) {
    assert.ok(tick.price >= vp.priceMin && tick.price <= vp.priceMax);
    assert.ok(tick.y >= box.top - 1 && tick.y <= box.top + box.height + 1);
  }
});

test('buildPriceTicks keeps labels distinct when zoomed deep into gold', () => {
  // This is the case the old fixed toFixed(2) formatting printed as a column
  // of identical numbers.
  const box = makeBox();
  const vp = makeViewport({ priceMin: 2650.0, priceMax: 2650.2 });
  const { ticks } = buildPriceTicks(box, vp, { decimals: 3 });
  const labels = ticks.map((t) => t.label);
  assert.ok(labels.length >= 4);
  assert.equal(new Set(labels).size, labels.length);
});

test('buildPriceTicks respects 5-digit FX precision', () => {
  const box = makeBox();
  const vp = makeViewport({ priceMin: 1.08412, priceMax: 1.08688 });
  const { ticks, step } = buildPriceTicks(box, vp, { decimals: 5 });
  assert.ok(step <= 0.001, `step ${step} too coarse for a 28 pip window`);
  const labels = ticks.map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.every((l) => l.startsWith('1.08')));
});

test('buildPriceTicks terminates on a degenerate price range', () => {
  const box = makeBox();
  const vp = makeViewport({ priceMin: 2650, priceMax: 2650 });
  const { ticks } = buildPriceTicks(box, vp, { decimals: 2 });
  assert.ok(Array.isArray(ticks));
  assert.ok(ticks.length <= 200);
});

test('buildPriceTicks marks every fifth step as a major line', () => {
  const box = makeBox();
  const vp = makeViewport({ priceMin: 2600, priceMax: 2700 });
  const { ticks, step } = buildPriceTicks(box, vp, { decimals: 2 });
  for (const tick of ticks) {
    const expected = Math.abs(tick.price / step) % 5 < 0.0001;
    assert.equal(tick.major, expected);
  }
});

/* ------------------------------------------------------------------ */
/* Time axis                                                           */
/* ------------------------------------------------------------------ */

test('buildTimeTicks labels never collide', () => {
  const candles = makeCandles(600);
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 9.5, firstLogical: 0 });
  const ticks = buildTimeTicks(candles, box, vp, { minLabelSpacingPx: 74 });

  assert.ok(ticks.length > 0);
  for (let i = 1; i < ticks.length; i++) {
    const gap = ticks[i].x - ticks[i - 1].x;
    // Day boundaries are allowed to sit closer; everything else must respect
    // the minimum spacing.
    if (!ticks[i].isDayBoundary) assert.ok(gap >= 74, `labels ${gap}px apart`);
  }
});

test('buildTimeTicks flags day boundaries and dates them', () => {
  // Hourly bars across three days.
  const candles = makeCandles(72, Date.UTC(2026, 0, 5, 0, 0, 0), 3_600_000);
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 12, firstLogical: 0 });
  const ticks = buildTimeTicks(candles, box, vp);
  const boundaries = ticks.filter((t) => t.isDayBoundary);
  assert.ok(boundaries.length >= 1, 'expected at least one day boundary label');
  for (const boundary of boundaries) {
    assert.ok(!boundary.label.includes(':'), 'day boundary should show a date, not a time');
  }
});

test('buildTimeTicks stays inside the plot box and handles an empty series', () => {
  const box = makeBox();
  const vp = makeViewport();
  assert.deepEqual(buildTimeTicks([], box, vp), []);

  const candles = makeCandles(200);
  const ticks = buildTimeTicks(candles, box, vp);
  for (const tick of ticks) {
    assert.ok(tick.x >= box.left && tick.x <= box.left + box.width);
    assert.ok(tick.logicalIndex >= 0 && tick.logicalIndex < candles.length);
  }
});

/* ------------------------------------------------------------------ */
/* Zoom                                                                */
/* ------------------------------------------------------------------ */

test('zoomStep walks the ladder up and down and clamps at both ends', () => {
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 9.5 });

  zoomStep(1, box, vp);
  assert.equal(vp.barSpacing, 14);
  zoomStep(-1, box, vp);
  assert.equal(vp.barSpacing, 9.5);

  for (let i = 0; i < 20; i++) zoomStep(1, box, vp);
  assert.equal(vp.barSpacing, Math.min(vp.maxBarSpacing, ZOOM_LADDER[ZOOM_LADDER.length - 1]));

  for (let i = 0; i < 40; i++) zoomStep(-1, box, vp);
  assert.equal(vp.barSpacing, Math.max(vp.minBarSpacing, ZOOM_LADDER[0]));
});

test('zoomStep keeps the bar under the anchor stationary', () => {
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 9.5, firstLogical: 120 });
  const anchorX = 300;
  const before = xToLogical(anchorX, box, vp);
  zoomStep(1, box, vp, anchorX);
  const after = xToLogical(anchorX, box, vp);
  assert.ok(Math.abs(after - before) < 1e-9, `anchor drifted ${after - before} bars`);
});

test('wheel zoom keeps the bar under the cursor stationary', () => {
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 9.5, firstLogical: 42 });
  const cursorX = 517;
  const before = xToLogical(cursorX, box, vp);
  zoomHorizontal(cursorX, -120, box, vp);
  const after = xToLogical(cursorX, box, vp);
  assert.ok(Math.abs(after - before) < 1e-9);
  assert.ok(vp.barSpacing > 9.5, 'negative wheel delta must zoom in');
});

test('zoom respects the configured spacing limits', () => {
  const box = makeBox();
  const vp = makeViewport({ barSpacing: 9.5 });
  for (let i = 0; i < 50; i++) zoomHorizontal(400, -240, box, vp);
  assert.ok(vp.barSpacing <= vp.maxBarSpacing);
  for (let i = 0; i < 100; i++) zoomHorizontal(400, 240, box, vp);
  assert.ok(vp.barSpacing >= vp.minBarSpacing);
});

/* ------------------------------------------------------------------ */
/* Pan, live edge and autoscale                                        */
/* ------------------------------------------------------------------ */

test('panning into history drops out of live-follow, End returns to it', () => {
  const box = makeBox();
  const vp = makeViewport();
  const candles = makeCandles(500);

  followLatest(candles.length, box, vp);
  assert.ok(atLiveEdge(candles.length, box, vp));
  assert.equal(vp.followLive, true);

  panHorizontal(600, box, vp);
  assert.equal(vp.followLive, false);
  assert.equal(atLiveEdge(candles.length, box, vp), false);

  followLatest(candles.length, box, vp);
  assert.equal(vp.followLive, true);
  assert.ok(atLiveEdge(candles.length, box, vp));
});

test('calculateVisiblePriceRange keeps 5-digit FX resolution', () => {
  const box = makeBox();
  const vp = makeViewport({ priceMin: 1.08, priceMax: 1.09, barSpacing: 9.5, firstLogical: 0 });
  const candles: Candle[] = [];
  for (let i = 0; i < 50; i++) {
    const open = 1.08512 + i * 0.00001;
    candles.push({
      time: Date.UTC(2026, 0, 5) + i * 60_000,
      open,
      high: open + 0.00004,
      low: open - 0.00004,
      close: open + 0.00002,
      volume: 10,
      isBullish: true,
    });
  }

  const coarse = calculateVisiblePriceRange(candles, box, vp, undefined, 3);
  const precise = calculateVisiblePriceRange(candles, box, vp, undefined, 5);

  // Rounding at 3 decimals used to collapse the whole window onto one tick.
  assert.ok(precise.priceMax - precise.priceMin > 0);
  assert.ok(
    precise.priceMax - precise.priceMin <= coarse.priceMax - coarse.priceMin + 1e-12,
    'instrument-precision rounding must not be looser than the old fixed rounding',
  );
  assert.notEqual(precise.priceMin.toFixed(5), precise.priceMax.toFixed(5));
});

test('calculateVisiblePriceRange never returns a zero-height band', () => {
  const box = makeBox();
  const vp = makeViewport();
  const flat: Candle[] = Array.from({ length: 30 }, (_, i) => ({
    time: Date.UTC(2026, 0, 5) + i * 60_000,
    open: 2650,
    high: 2650,
    low: 2650,
    close: 2650,
    volume: 1,
    isBullish: true,
  }));
  const range = calculateVisiblePriceRange(flat, box, vp, undefined, 2);
  assert.ok(range.priceMax > range.priceMin, 'flat data must still produce a visible band');
});

/* ------------------------------------------------------------------ */
/* Coordinate transforms                                               */
/* ------------------------------------------------------------------ */

test('price and logical transforms round-trip', () => {
  const box = makeBox();
  const vp = makeViewport({ firstLogical: 17.25, barSpacing: 11 });

  for (const i of [0, 3.5, 40, 128.75]) {
    assert.ok(Math.abs(xToLogical(logicalToX(i, box, vp), box, vp) - i) < 1e-9);
  }
  for (const p of [2600, 2637.5, 2699.99]) {
    assert.ok(Math.abs(yToPrice(priceToY(p, box, vp), box, vp) - p) < 1e-9);
  }
});

/* ------------------------------------------------------------------ */
/* Measure ruler                                                       */
/* ------------------------------------------------------------------ */

test('measureBetween reports delta, percent, pips, bars and direction', () => {
  const from = { price: 2650.0, logicalIndex: 100, time: Date.UTC(2026, 0, 5, 9, 0) };
  const to = { price: 2676.5, logicalIndex: 140, time: Date.UTC(2026, 0, 5, 11, 30) };
  const result = measureBetween(from, to, 10);

  assert.ok(Math.abs(result.priceDelta - 26.5) < 1e-9);
  assert.ok(Math.abs(result.percentDelta - (26.5 / 2650) * 100) < 1e-9);
  assert.ok(Math.abs(result.pips - 265) < 1e-9);
  assert.equal(result.bars, 40);
  assert.equal(result.milliseconds, 2.5 * 3_600_000);
  assert.equal(result.direction, 'UP');
});

test('measureBetween handles a downward and a flat measurement', () => {
  const base = { price: 2650, logicalIndex: 10, time: 0 };
  const down = measureBetween(base, { price: 2640, logicalIndex: 4, time: -60_000 }, 10);
  assert.equal(down.direction, 'DOWN');
  assert.equal(down.bars, -6);
  assert.ok(down.pips < 0);

  const flat = measureBetween(base, { ...base }, 10);
  assert.equal(flat.direction, 'FLAT');
  assert.equal(flat.priceDelta, 0);
  assert.equal(flat.percentDelta, 0);
});

test('formatDuration is compact and unit-correct', () => {
  assert.equal(formatDuration(45 * 60_000), '45m');
  assert.equal(formatDuration(2.5 * 3_600_000), '2h 30m');
  assert.equal(formatDuration(3 * 86_400_000 + 4 * 3_600_000), '3d 4h');
  assert.equal(formatDuration(-45 * 60_000), '45m');
  assert.equal(formatDuration(0), '0m');
});
