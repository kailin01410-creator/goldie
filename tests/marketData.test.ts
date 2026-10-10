import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketDataError,
  MarketDataService,
  type MarketDataServiceOptions,
} from '../src/server/marketData';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function serviceWith(
  fetcher: (url: URL) => unknown | Promise<unknown>,
  env: { TWELVE_DATA_API_KEY?: string; ALPHA_VANTAGE_API_KEY?: string } = {},
  extras: Partial<MarketDataServiceOptions> = {}
): MarketDataService {
  const fetchImpl: typeof fetch = async input => {
    const url = input instanceof URL ? input : new URL(String(input));
    return jsonResponse(await fetcher(url));
  };
  return new MarketDataService({
    fetchImpl,
    getEnvironment: () => env,
    ...extras,
  });
}

test('Twelve Data quotes normalize FX symbols and preserve actual quote metrics', async () => {
  const service = serviceWith(url => {
    assert.equal(url.hostname, 'api.twelvedata.com');
    assert.equal(url.pathname, '/quote');
    assert.equal(url.searchParams.get('symbol'), 'EUR/USD');
    assert.equal(url.searchParams.get('apikey'), 'test-twelve-key');
    return {
      symbol: 'EUR/USD',
      close: '1.08425',
      bid: '1.08420',
      ask: '1.08430',
      open: '1.08200',
      high: '1.08600',
      low: '1.08100',
      previous_close: '1.08000',
      change: '0.00425',
      percent_change: '0.39%',
      datetime: '2026-10-10 12:30:00',
    };
  }, { TWELVE_DATA_API_KEY: 'test-twelve-key' });

  const quote = await service.getQuote('eurusd');
  assert.equal(quote.symbol, 'EUR/USD');
  assert.equal(quote.assetClass, 'forex');
  assert.equal(quote.price, 1.08425);
  assert.equal(quote.bid, 1.0842);
  assert.equal(quote.ask, 1.0843);
  assert.equal(quote.changePercent, 0.39);
  assert.equal(quote.source, 'Twelve Data');
});

test('Alpha Vantage fallback returns only fields the FX endpoint actually provides', async () => {
  let requests = 0;
  const service = serviceWith(url => {
    requests += 1;
    if (url.hostname === 'api.twelvedata.com') {
      return { status: 'error', code: 429, message: 'rate limit' };
    }
    assert.equal(url.hostname, 'www.alphavantage.co');
    assert.equal(url.searchParams.get('function'), 'CURRENCY_EXCHANGE_RATE');
    assert.equal(url.searchParams.get('from_currency'), 'GBP');
    assert.equal(url.searchParams.get('to_currency'), 'JPY');
    return {
      'Realtime Currency Exchange Rate': {
        '5. Exchange Rate': '198.625',
        '6. Last Refreshed': '2026-10-10 12:30:00',
        '8. Bid Price': '198.620',
        '9. Ask Price': '198.630',
      },
    };
  }, {
    TWELVE_DATA_API_KEY: 'test-twelve-key',
    ALPHA_VANTAGE_API_KEY: 'test-alpha-key',
  });

  const quote = await service.getQuote('GBP/JPY');
  assert.equal(requests, 2);
  assert.equal(quote.source, 'Alpha Vantage');
  assert.equal(quote.price, 198.625);
  assert.equal(quote.bid, 198.62);
  assert.equal(quote.ask, 198.63);
  assert.equal(quote.high, null);
  assert.equal(quote.low, null);
  assert.equal(quote.change, null);
  assert.equal(quote.changePercent, null);
});

test('stock quote symbols use Alpha Vantage Global Quote and parse percent change', async () => {
  const service = serviceWith(url => {
    assert.equal(url.searchParams.get('function'), 'GLOBAL_QUOTE');
    assert.equal(url.searchParams.get('symbol'), 'BRK.B');
    return {
      'Global Quote': {
        '02. open': '450.00',
        '03. high': '456.00',
        '04. low': '447.50',
        '05. price': '455.25',
        '06. volume': '1234000',
        '07. latest trading day': '2026-10-09',
        '08. previous close': '452.00',
        '09. change': '3.25',
        '10. change percent': '0.718%',
      },
    };
  }, { ALPHA_VANTAGE_API_KEY: 'test-alpha-key' });

  const quote = await service.getQuote('brk.b');
  assert.equal(quote.symbol, 'BRK.B');
  assert.equal(quote.assetClass, 'stock');
  assert.equal(quote.price, 455.25);
  assert.equal(quote.change, 3.25);
  assert.equal(quote.changePercent, 0.718);
  assert.equal(quote.volume, 1_234_000);
});

test('quotes are cached per provider to reduce free-tier API use', async () => {
  let requests = 0;
  let now = 1_800_000_000_000;
  const service = serviceWith(() => {
    requests += 1;
    return { close: '1.08', percent_change: '0.1%' };
  }, { TWELVE_DATA_API_KEY: 'test-key' }, {
    now: () => now,
    quoteTtlMs: { twelveData: 60_000 },
  });

  const first = await service.getQuote('EUR/USD');
  const second = await service.getQuote('EURUSD');
  assert.equal(first.price, second.price);
  assert.equal(requests, 1);

  now += 60_001;
  await service.getQuote('EUR/USD');
  assert.equal(requests, 2);
});

test('unconfigured providers fail explicitly instead of returning simulated prices', async () => {
  let requests = 0;
  const service = serviceWith(() => {
    requests += 1;
    return {};
  });

  await assert.rejects(
    service.getQuote('EUR/USD'),
    (error: unknown) => error instanceof MarketDataError &&
      error.code === 'PROVIDER_NOT_CONFIGURED' && error.statusCode === 503
  );
  assert.equal(requests, 0);
  assert.deepEqual(service.getStatus().providers, []);
  assert.equal(service.getStatus().historicalCandlesAvailable, false);
});

test('candle endpoint sorts provider bars and consolidates unsupported app intervals', async () => {
  const rows = [
    ['2026-10-10 10:05:00', '1.5', '1.8', '1.4', '1.7', '6'],
    ['2026-10-10 10:04:00', '1.4', '1.6', '1.3', '1.5', '5'],
    ['2026-10-10 10:03:00', '1.3', '1.5', '1.2', '1.4', '4'],
    ['2026-10-10 10:02:00', '1.2', '1.4', '1.1', '1.3', '3'],
    ['2026-10-10 10:01:00', '1.1', '1.3', '1.0', '1.2', '2'],
    ['2026-10-10 10:00:00', '1.0', '1.2', '0.9', '1.1', '1'],
  ].map(([datetime, open, high, low, close, volume]) => ({ datetime, open, high, low, close, volume }));

  const service = serviceWith(url => {
    assert.equal(url.hostname, 'api.twelvedata.com');
    assert.equal(url.pathname, '/time_series');
    assert.equal(url.searchParams.get('symbol'), 'EUR/USD');
    assert.equal(url.searchParams.get('interval'), '1min');
    assert.equal(Number(url.searchParams.get('outputsize')), 33);
    return {
      meta: { exchange_timezone: 'UTC' },
      values: rows,
    };
  }, { TWELVE_DATA_API_KEY: 'test-key' }, { now: () => Date.UTC(2026, 9, 10, 10, 10) });

  const history = await service.getCandles('EURUSD', '3m', 10);
  assert.equal(history.source, 'Twelve Data');
  assert.equal(history.timeframe, '3m');
  assert.equal(history.candles.length, 2);
  assert.equal(history.candles[0].time, Date.UTC(2026, 9, 10, 10, 0));
  assert.equal(history.candles[0].open, 1);
  assert.equal(history.candles[0].high, 1.4);
  assert.equal(history.candles[0].low, 0.9);
  assert.equal(history.candles[0].close, 1.3);
  assert.equal(history.candles[0].volume, 6);
  assert.equal(history.candles[0].isBullish, true);
  assert.equal(history.candles[0].isComplete, true);
  assert.equal(history.candles[1].close, 1.7);
  assert.equal(history.candles[1].isComplete, false);
});

test('market-data routes reject malformed symbols, asset classes, timeframes, and limits', async () => {
  const service = serviceWith(() => ({}), {
    TWELVE_DATA_API_KEY: 'test-key',
  });

  await assert.rejects(service.getQuote('EUR/USD', 'crypto'), (error: unknown) =>
    error instanceof MarketDataError && error.code === 'INVALID_ASSET_CLASS'
  );
  await assert.rejects(service.getQuote('EUR/USDX'), (error: unknown) =>
    error instanceof MarketDataError && error.code === 'INVALID_SYMBOL'
  );
  await assert.rejects(service.getCandles('AAPL', '2D', 200), (error: unknown) =>
    error instanceof MarketDataError && error.code === 'INVALID_TIMEFRAME'
  );
  await assert.rejects(service.getCandles('AAPL', '1d', 5), (error: unknown) =>
    error instanceof MarketDataError && error.code === 'INVALID_LIMIT'
  );
});
