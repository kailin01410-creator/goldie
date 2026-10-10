/**
 * Server-side market-data adapters for optional free-tier quote providers.
 * API credentials stay in the server environment and are never sent to clients.
 */

export type MarketAssetClass = 'forex' | 'stock';
export type MarketTimeframe =
  | '1m' | '2m' | '3m' | '5m' | '10m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '1w' | '1M';

export interface MarketQuote {
  symbol: string;
  assetClass: MarketAssetClass;
  price: number;
  bid: number | null;
  ask: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: string | null;
  source: 'Twelve Data' | 'Alpha Vantage';
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isBullish: boolean;
  isComplete: boolean;
}

export interface MarketDataStatus {
  providers: Array<'Twelve Data' | 'Alpha Vantage'>;
  quoteAvailable: boolean;
  historicalCandlesAvailable: boolean;
  quoteCacheSeconds: { twelveData: number; alphaVantage: number };
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

interface MarketDataEnvironment {
  TWELVE_DATA_API_KEY?: string;
  ALPHA_VANTAGE_API_KEY?: string;
}

export interface MarketDataServiceOptions {
  fetchImpl?: typeof fetch;
  getEnvironment?: () => MarketDataEnvironment;
  now?: () => number;
  quoteTtlMs?: { twelveData?: number; alphaVantage?: number };
  candleTtlMs?: number;
}

interface NormalizedSymbol {
  symbol: string;
  assetClass: MarketAssetClass;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface ProviderFailure {
  expiresAt: number;
}

interface CandleIntervalSpec {
  providerInterval: string;
  factor: number;
  intervalMs: number;
}

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';
const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';
const REQUEST_TIMEOUT_MS = 8_000;
const NEGATIVE_CACHE_MS = 30_000;
const DEFAULT_TWELVE_DATA_QUOTE_TTL_MS = 3 * 60_000;
const DEFAULT_ALPHA_VANTAGE_QUOTE_TTL_MS = 60 * 60_000;
const DEFAULT_CANDLE_TTL_MS = 5 * 60_000;
const MAX_CANDLE_LIMIT = 500;

// ISO 4217 currencies commonly used by FX quote APIs. Precious-metal codes are
// included for Twelve Data's XAU/USD and XAG/USD history symbols.
const CURRENCY_CODES = new Set([
  'AED', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CZK', 'DKK',
  'EGP', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY',
  'KRW', 'KWD', 'MAD', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PKR', 'PLN',
  'QAR', 'RON', 'RUB', 'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'UAH',
  'USD', 'VND', 'ZAR', 'XAU', 'XAG',
]);

const TIMEFRAME_SPECS: Record<MarketTimeframe, CandleIntervalSpec> = {
  '1m':  { providerInterval: '1min', factor: 1, intervalMs: 60_000 },
  '2m':  { providerInterval: '1min', factor: 2, intervalMs: 2 * 60_000 },
  '3m':  { providerInterval: '1min', factor: 3, intervalMs: 3 * 60_000 },
  '5m':  { providerInterval: '5min', factor: 1, intervalMs: 5 * 60_000 },
  '10m': { providerInterval: '5min', factor: 2, intervalMs: 10 * 60_000 },
  '15m': { providerInterval: '15min', factor: 1, intervalMs: 15 * 60_000 },
  '30m': { providerInterval: '30min', factor: 1, intervalMs: 30 * 60_000 },
  '1h':  { providerInterval: '1h', factor: 1, intervalMs: 60 * 60_000 },
  '2h':  { providerInterval: '2h', factor: 1, intervalMs: 2 * 60 * 60_000 },
  '4h':  { providerInterval: '4h', factor: 1, intervalMs: 4 * 60 * 60_000 },
  '6h':  { providerInterval: '2h', factor: 3, intervalMs: 6 * 60 * 60_000 },
  '8h':  { providerInterval: '4h', factor: 2, intervalMs: 8 * 60 * 60_000 },
  '12h': { providerInterval: '4h', factor: 3, intervalMs: 12 * 60 * 60_000 },
  '1d':  { providerInterval: '1day', factor: 1, intervalMs: 24 * 60 * 60_000 },
  '1w':  { providerInterval: '1week', factor: 1, intervalMs: 7 * 24 * 60 * 60_000 },
  '1M':  { providerInterval: '1month', factor: 1, intervalMs: 30 * 24 * 60 * 60_000 },
};

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalPositiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function parsePercent(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = finiteNumber(String(value).replace(/%/g, ''));
  return parsed;
}

function normalizeSymbol(rawSymbol: unknown, rawAssetClass?: unknown): NormalizedSymbol {
  if (typeof rawSymbol !== 'string') {
    throw new MarketDataError('A market symbol is required.', 400, 'INVALID_SYMBOL');
  }

  const input = rawSymbol.trim().toUpperCase().replace(/\s+/g, '');
  if (!input || input.length > 24) {
    throw new MarketDataError('The market symbol is invalid.', 400, 'INVALID_SYMBOL');
  }

  if (rawAssetClass !== undefined && rawAssetClass !== 'forex' && rawAssetClass !== 'stock') {
    throw new MarketDataError('assetClass must be either "forex" or "stock".', 400, 'INVALID_ASSET_CLASS');
  }

  const slashParts = input.includes('/') ? input.split('/') : null;
  const compactPair = !slashParts && /^[A-Z]{6}$/.test(input)
    ? [input.slice(0, 3), input.slice(3, 6)]
    : null;
  const pairParts = slashParts ?? compactPair;
  const looksLikePair = Boolean(
    pairParts && pairParts.length === 2 &&
    pairParts[0].length === 3 && pairParts[1].length === 3 &&
    CURRENCY_CODES.has(pairParts[0]) && CURRENCY_CODES.has(pairParts[1])
  );

  const assetClass = rawAssetClass === 'forex'
    ? 'forex'
    : rawAssetClass === 'stock'
      ? 'stock'
      : looksLikePair
        ? 'forex'
        : 'stock';

  if (assetClass === 'forex') {
    if (!looksLikePair || !pairParts) {
      throw new MarketDataError('FX symbols must be a supported six-letter pair such as EUR/USD.', 400, 'INVALID_SYMBOL');
    }
    if (pairParts[0] === pairParts[1]) {
      throw new MarketDataError('An FX pair must use two different currencies.', 400, 'INVALID_SYMBOL');
    }
    return { symbol: `${pairParts[0]}/${pairParts[1]}`, assetClass };
  }

  if (input.includes('/') || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(input)) {
    throw new MarketDataError('Stock symbols must be plain tickers, for example AAPL or BRK.B.', 400, 'INVALID_SYMBOL');
  }
  return { symbol: input, assetClass };
}

function parseProviderDateTime(value: unknown, timeZone: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasExplicitZone) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const [, year, month, day, hour, minute, second = '0'] = match;
  const wallClockAsUtc = Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)
  );
  const zone = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC';
  if (zone === 'UTC' || zone === 'Etc/UTC' || zone === 'GMT') return wallClockAsUtc;

  const offsetAt = (epoch: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(epoch));
    const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const hourValue = Number(fields.hour) % 24;
    const representedAsUtc = Date.UTC(
      Number(fields.year), Number(fields.month) - 1, Number(fields.day),
      hourValue, Number(fields.minute), Number(fields.second)
    );
    return representedAsUtc - epoch;
  };

  try {
    let epoch = wallClockAsUtc - offsetAt(wallClockAsUtc);
    // Re-evaluate once around daylight-saving transitions.
    epoch = wallClockAsUtc - offsetAt(epoch);
    return Number.isFinite(epoch) ? epoch : null;
  } catch {
    // An invalid provider timezone should not discard otherwise usable history.
    return wallClockAsUtc;
  }
}

function aggregateCandles(
  candles: MarketCandle[],
  targetIntervalMs: number,
  factor: number,
  limit: number,
  now: number
): MarketCandle[] {
  if (factor === 1) {
    const result = candles.slice(-limit);
    return result.map((candle, index) => ({ ...candle, isComplete: index < result.length - 1 }));
  }

  const buckets = new Map<number, MarketCandle[]>();
  for (const candle of candles) {
    const bucketStart = Math.floor(candle.time / targetIntervalMs) * targetIntervalMs;
    const bucket = buckets.get(bucketStart);
    if (bucket) bucket.push(candle);
    else buckets.set(bucketStart, [candle]);
  }

  const aggregated = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, rows]) => {
      const ordered = rows.sort((a, b) => a.time - b.time);
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      return {
        time,
        open: first.open,
        high: Math.max(...ordered.map(row => row.high)),
        low: Math.min(...ordered.map(row => row.low)),
        close: last.close,
        volume: ordered.reduce((sum, row) => sum + row.volume, 0),
        isBullish: last.close >= first.open,
        isComplete: time + targetIntervalMs <= now,
      } satisfies MarketCandle;
    });

  const result = aggregated.slice(-limit);
  return result.map((candle, index) => ({
    ...candle,
    isComplete: index < result.length - 1 && candle.isComplete,
  }));
}

export class MarketDataService {
  private readonly fetchImpl: typeof fetch;
  private readonly getEnvironment: () => MarketDataEnvironment;
  private readonly now: () => number;
  private readonly quoteTtlMs: { twelveData: number; alphaVantage: number };
  private readonly candleTtlMs: number;
  private readonly quoteCache = new Map<string, CacheEntry<MarketQuote>>();
  private readonly quoteFailures = new Map<string, ProviderFailure>();
  private readonly providerCooldowns = new Map<string, number>();
  private readonly quoteInFlight = new Map<string, Promise<MarketQuote>>();
  private readonly candleCache = new Map<string, CacheEntry<MarketCandle[]>>();
  private readonly candleFailures = new Map<string, ProviderFailure>();
  private readonly candleInFlight = new Map<string, Promise<MarketCandle[]>>();

  constructor(options: MarketDataServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.getEnvironment = options.getEnvironment ?? (() => process.env);
    this.now = options.now ?? Date.now;
    this.quoteTtlMs = {
      twelveData: options.quoteTtlMs?.twelveData ?? DEFAULT_TWELVE_DATA_QUOTE_TTL_MS,
      alphaVantage: options.quoteTtlMs?.alphaVantage ?? DEFAULT_ALPHA_VANTAGE_QUOTE_TTL_MS,
    };
    this.candleTtlMs = options.candleTtlMs ?? DEFAULT_CANDLE_TTL_MS;
  }

  getStatus(): MarketDataStatus {
    const env = this.getEnvironment();
    const providers: MarketDataStatus['providers'] = [];
    if (env.TWELVE_DATA_API_KEY?.trim()) providers.push('Twelve Data');
    if (env.ALPHA_VANTAGE_API_KEY?.trim()) providers.push('Alpha Vantage');
    return {
      providers,
      quoteAvailable: providers.length > 0,
      historicalCandlesAvailable: Boolean(env.TWELVE_DATA_API_KEY?.trim()),
      quoteCacheSeconds: {
        twelveData: Math.ceil(this.quoteTtlMs.twelveData / 1000),
        alphaVantage: Math.ceil(this.quoteTtlMs.alphaVantage / 1000),
      },
    };
  }

  async getQuote(rawSymbol: unknown, rawAssetClass?: unknown): Promise<MarketQuote> {
    const normalized = normalizeSymbol(rawSymbol, rawAssetClass);
    const key = `${normalized.assetClass}:${normalized.symbol}`;
    const now = this.now();
    const failure = this.quoteFailures.get(key);
    if (failure && failure.expiresAt > now) {
      throw new MarketDataError(
        'Configured market-data providers are temporarily unavailable. Please retry shortly.',
        502,
        'UPSTREAM_UNAVAILABLE'
      );
    }
    if (failure) this.quoteFailures.delete(key);

    const pending = this.quoteInFlight.get(key);
    if (pending) return pending;

    const cached = this.getCachedQuote(normalized, now);
    if (cached) return cached;

    const request = this.fetchQuote(normalized, key);
    this.quoteInFlight.set(key, request);
    try {
      return await request;
    } finally {
      this.quoteInFlight.delete(key);
    }
  }

  async getCandles(
    rawSymbol: unknown,
    rawTimeframe: unknown,
    rawLimit: unknown = 200
  ): Promise<{ symbol: string; timeframe: MarketTimeframe; source: 'Twelve Data'; candles: MarketCandle[] }> {
    const normalized = normalizeSymbol(rawSymbol);
    if (typeof rawTimeframe !== 'string' || !(rawTimeframe in TIMEFRAME_SPECS)) {
      throw new MarketDataError('A supported timeframe is required (for example 5m, 1h, or 1d).', 400, 'INVALID_TIMEFRAME');
    }
    const timeframe = rawTimeframe as MarketTimeframe;
    const limit = typeof rawLimit === 'string' ? Number(rawLimit) : rawLimit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 10 || limit > MAX_CANDLE_LIMIT) {
      throw new MarketDataError(`limit must be an integer between 10 and ${MAX_CANDLE_LIMIT}.`, 400, 'INVALID_LIMIT');
    }

    const apiKey = this.getEnvironment().TWELVE_DATA_API_KEY?.trim();
    if (!apiKey) {
      throw new MarketDataError(
        'Historical market candles require TWELVE_DATA_API_KEY in the server environment.',
        503,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    const cacheKey = `${normalized.symbol}:${timeframe}:${limit}`;
    const now = this.now();
    const cached = this.candleCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return { symbol: normalized.symbol, timeframe, source: 'Twelve Data', candles: cached.value };
    }
    if (cached) this.candleCache.delete(cacheKey);

    const failure = this.candleFailures.get(cacheKey);
    if (failure && failure.expiresAt > now) {
      throw new MarketDataError(
        'Twelve Data did not return usable candle history. Check the symbol, API quota, and provider plan.',
        502,
        'UPSTREAM_UNAVAILABLE'
      );
    }
    if (failure) this.candleFailures.delete(cacheKey);

    const pending = this.candleInFlight.get(cacheKey);
    if (pending) {
      const candles = await pending;
      return { symbol: normalized.symbol, timeframe, source: 'Twelve Data', candles };
    }

    const request = this.fetchCandles(normalized.symbol, timeframe, limit, apiKey, cacheKey);
    this.candleInFlight.set(cacheKey, request);
    try {
      const candles = await request;
      return { symbol: normalized.symbol, timeframe, source: 'Twelve Data', candles };
    } finally {
      this.candleInFlight.delete(cacheKey);
    }
  }

  private getCachedQuote(normalized: NormalizedSymbol, now: number): MarketQuote | null {
    const cacheKey = `${normalized.assetClass}:${normalized.symbol}`;
    const priorities = ['Twelve Data', 'Alpha Vantage'] as const;
    for (const provider of priorities) {
      const key = `${provider}:${cacheKey}`;
      const entry = this.quoteCache.get(key);
      if (entry && entry.expiresAt > now) return entry.value;
      if (entry) this.quoteCache.delete(key);
    }
    return null;
  }

  private async fetchQuote(normalized: NormalizedSymbol, cacheKey: string): Promise<MarketQuote> {
    const env = this.getEnvironment();
    const providers: Array<{
      name: MarketQuote['source'];
      key?: string;
      ttlMs: number;
      fetch: (symbol: NormalizedSymbol, apiKey: string) => Promise<MarketQuote>;
    }> = [
      {
        name: 'Twelve Data',
        key: env.TWELVE_DATA_API_KEY?.trim(),
        ttlMs: this.quoteTtlMs.twelveData,
        fetch: (symbol, apiKey) => this.fetchTwelveDataQuote(symbol, apiKey),
      },
      {
        name: 'Alpha Vantage',
        key: env.ALPHA_VANTAGE_API_KEY?.trim(),
        ttlMs: this.quoteTtlMs.alphaVantage,
        fetch: (symbol, apiKey) => this.fetchAlphaVantageQuote(symbol, apiKey),
      },
    ];
    const configured = providers.filter(provider => provider.key);

    if (configured.length === 0) {
      throw new MarketDataError(
        'Live FX/stock quotes require TWELVE_DATA_API_KEY or ALPHA_VANTAGE_API_KEY in the server environment.',
        503,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    const now = this.now();
    for (const provider of configured) {
      const providerCacheKey = `${provider.name}:${cacheKey}`;
      const cached = this.quoteCache.get(providerCacheKey);
      if (cached && cached.expiresAt > now) return cached.value;
      if (cached) this.quoteCache.delete(providerCacheKey);

      const cooldownKey = `${provider.name}:${cacheKey}`;
      const cooldownUntil = this.providerCooldowns.get(cooldownKey) ?? 0;
      if (cooldownUntil > now) continue;

      try {
        const quote = await provider.fetch(normalized, provider.key!);
        this.quoteCache.set(providerCacheKey, {
          value: quote,
          expiresAt: this.now() + provider.ttlMs,
        });
        this.quoteFailures.delete(cacheKey);
        return quote;
      } catch {
        // Do not forward the provider's response body or request URL: both can
        // contain diagnostic text, while the URL necessarily includes a key.
        this.providerCooldowns.set(cooldownKey, this.now() + NEGATIVE_CACHE_MS);
      }
    }

    this.quoteFailures.set(cacheKey, { expiresAt: this.now() + NEGATIVE_CACHE_MS });
    throw new MarketDataError(
      'Configured market-data providers could not return a quote. Check the symbol, API key, and provider quota.',
      502,
      'UPSTREAM_UNAVAILABLE'
    );
  }

  private async fetchTwelveDataQuote(normalized: NormalizedSymbol, apiKey: string): Promise<MarketQuote> {
    const url = new URL(`${TWELVE_DATA_BASE}/quote`);
    url.searchParams.set('symbol', normalized.symbol);
    url.searchParams.set('apikey', apiKey);
    const data = await this.requestJson(url);
    if (data?.status === 'error' || data?.code) throw new Error('Twelve Data returned an error.');

    const price = optionalPositiveNumber(data?.close ?? data?.price);
    if (price === null) throw new Error('Twelve Data returned no usable price.');
    return {
      symbol: normalized.symbol,
      assetClass: normalized.assetClass,
      price,
      bid: optionalPositiveNumber(data?.bid),
      ask: optionalPositiveNumber(data?.ask),
      open: optionalPositiveNumber(data?.open),
      high: optionalPositiveNumber(data?.high),
      low: optionalPositiveNumber(data?.low),
      previousClose: optionalPositiveNumber(data?.previous_close ?? data?.previousClose),
      change: finiteNumber(data?.change),
      changePercent: parsePercent(data?.percent_change ?? data?.change_percent),
      volume: finiteNumber(data?.volume),
      timestamp: typeof data?.datetime === 'string'
        ? data.datetime
        : typeof data?.timestamp === 'string'
          ? data.timestamp
          : null,
      source: 'Twelve Data',
    };
  }

  private async fetchAlphaVantageQuote(normalized: NormalizedSymbol, apiKey: string): Promise<MarketQuote> {
    const url = new URL(ALPHA_VANTAGE_BASE);
    url.searchParams.set('apikey', apiKey);

    if (normalized.assetClass === 'forex') {
      const [fromCurrency, toCurrency] = normalized.symbol.split('/');
      url.searchParams.set('function', 'CURRENCY_EXCHANGE_RATE');
      url.searchParams.set('from_currency', fromCurrency);
      url.searchParams.set('to_currency', toCurrency);
      const data = await this.requestJson(url);
      const exchangeRate = data?.['Realtime Currency Exchange Rate'];
      const price = optionalPositiveNumber(exchangeRate?.['5. Exchange Rate']);
      if (!price) throw new Error('Alpha Vantage returned no usable FX rate.');
      return {
        symbol: normalized.symbol,
        assetClass: normalized.assetClass,
        price,
        bid: optionalPositiveNumber(exchangeRate?.['8. Bid Price']),
        ask: optionalPositiveNumber(exchangeRate?.['9. Ask Price']),
        open: null,
        high: null,
        low: null,
        previousClose: null,
        change: null,
        changePercent: null,
        volume: null,
        timestamp: typeof exchangeRate?.['6. Last Refreshed'] === 'string'
          ? exchangeRate['6. Last Refreshed']
          : null,
        source: 'Alpha Vantage',
      };
    }

    url.searchParams.set('function', 'GLOBAL_QUOTE');
    url.searchParams.set('symbol', normalized.symbol);
    const data = await this.requestJson(url);
    const quote = data?.['Global Quote'];
    const price = optionalPositiveNumber(quote?.['05. price']);
    if (!price) throw new Error('Alpha Vantage returned no usable stock quote.');
    return {
      symbol: normalized.symbol,
      assetClass: normalized.assetClass,
      price,
      bid: null,
      ask: null,
      open: optionalPositiveNumber(quote?.['02. open']),
      high: optionalPositiveNumber(quote?.['03. high']),
      low: optionalPositiveNumber(quote?.['04. low']),
      previousClose: optionalPositiveNumber(quote?.['08. previous close']),
      change: finiteNumber(quote?.['09. change']),
      changePercent: parsePercent(quote?.['10. change percent']),
      volume: finiteNumber(quote?.['06. volume']),
      timestamp: typeof quote?.['07. latest trading day'] === 'string'
        ? quote['07. latest trading day']
        : null,
      source: 'Alpha Vantage',
    };
  }

  private async fetchCandles(
    symbol: string,
    timeframe: MarketTimeframe,
    limit: number,
    apiKey: string,
    cacheKey: string
  ): Promise<MarketCandle[]> {
    const spec = TIMEFRAME_SPECS[timeframe];
    const outputsize = Math.min(5_000, limit * spec.factor + spec.factor);
    const url = new URL(`${TWELVE_DATA_BASE}/time_series`);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', spec.providerInterval);
    url.searchParams.set('outputsize', String(outputsize));
    url.searchParams.set('apikey', apiKey);

    try {
      const data = await this.requestJson(url);
      if (data?.status === 'error' || data?.code || !Array.isArray(data?.values)) {
        throw new Error('Twelve Data returned no candle history.');
      }

      const timeZone = data?.meta?.exchange_timezone;
      const sourceCandles: MarketCandle[] = data.values
        .map((row: Record<string, unknown>) => {
          const time = parseProviderDateTime(row?.datetime, timeZone);
          const open = optionalPositiveNumber(row?.open);
          const high = optionalPositiveNumber(row?.high);
          const low = optionalPositiveNumber(row?.low);
          const close = optionalPositiveNumber(row?.close);
          if (time === null || open === null || high === null || low === null || close === null) return null;
          if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) return null;
          return {
            time,
            open,
            high,
            low,
            close,
            volume: Math.max(0, finiteNumber(row?.volume) ?? 0),
            isBullish: close >= open,
            isComplete: true,
          } satisfies MarketCandle;
        })
        .filter((candle: MarketCandle | null): candle is MarketCandle => Boolean(candle))
        .sort((a: MarketCandle, b: MarketCandle) => a.time - b.time);

      if (sourceCandles.length === 0) throw new Error('Twelve Data returned empty candle history.');
      const result = aggregateCandles(sourceCandles, spec.intervalMs, spec.factor, limit, this.now());
      if (result.length === 0) throw new Error('Twelve Data returned no complete candles.');

      const minimumCacheTtl = Math.max(DEFAULT_CANDLE_TTL_MS, this.candleTtlMs);
      const cacheTtl = Math.max(minimumCacheTtl, Math.min(spec.intervalMs, 60 * 60_000));
      this.candleCache.set(cacheKey, { value: result, expiresAt: this.now() + cacheTtl });
      this.candleFailures.delete(cacheKey);
      return result;
    } catch {
      this.candleFailures.set(cacheKey, { expiresAt: this.now() + NEGATIVE_CACHE_MS });
      throw new MarketDataError(
        'Twelve Data did not return usable candle history. Check the symbol, API key, quota, and provider plan.',
        502,
        'UPSTREAM_UNAVAILABLE'
      );
    }
  }

  private async requestJson(url: URL): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const marketDataService = new MarketDataService();
