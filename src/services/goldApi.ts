/**
 * GoldAPI.io Service
 * Provides functions to fetch the live XAU/USD price and validate authentication.
 * Server proxy uses process.env.GOLDAPI_KEY for secure server-side authentication,
 * with support for manual client-side key overrides.
 */

export interface GoldPriceResult {
  success: boolean;
  metal: string;
  currency: string;
  rawPrice: number;
  price: number;
  bid: number;
  ask: number;
  open24h: number;
  high24h: number;
  low24h: number;
  change: number;
  changePercent: number;
  source: string;
  goldApiStatus?: 'ACTIVE' | 'QUOTA_EXCEEDED' | 'NO_KEY' | 'ERROR';
  goldApiNotice?: string | null;
  marketStatus?: 'OPEN' | 'CLOSED';
  isMarketClosed?: boolean;
  marketClosureReason?: string;
  timestamp: number;
  error?: string;
}

export interface GoldApiTestResult {
  success: boolean;
  configured: boolean;
  status: 'ACTIVE_AND_VALID' | 'INVALID_KEY' | 'QUOTA_EXCEEDED' | 'NO_KEY_PROVIDED' | 'NETWORK_ERROR' | 'API_ERROR';
  price?: number;
  bid?: number;
  ask?: number;
  change?: number;
  changePercent?: number;
  timestamp?: number;
  error?: string;
  message: string;
}

export const GOLD_API_KEY_STORAGE = 'scalpedge_gold_api_key';

/**
 * Retrieves the manually saved Gold API key from local storage
 */
export function getSavedGoldApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GOLD_API_KEY_STORAGE) || '';
}

/**
 * Saves or clears the manually input Gold API key
 */
export function saveGoldApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GOLD_API_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GOLD_API_KEY_STORAGE);
  }
}

/**
 * Fetches the live XAU/USD spot price.
 * 
 * If a manual API key is provided, it is sent in the secure `x-access-token` header.
 * If omitted, the server-side API route automatically uses the `GOLDAPI_KEY`
 * environment variable to securely authenticate with GoldAPI.io without exposing secrets.
 *
 * @param manualApiKey Optional manually input GoldAPI key to override the server environment key
 * @returns Promise<GoldPriceResult> Live spot quote data and market metrics
 */
export async function fetchLiveGoldPrice(
  manualApiKey?: string,
  metal: string = 'XAU',
  currency: string = 'USD'
): Promise<GoldPriceResult> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  // Determine key to use (explicitly passed or retrieved from user manual input)
  const keyToUse = (manualApiKey !== undefined ? manualApiKey : getSavedGoldApiKey()).trim();
  if (keyToUse) {
    headers['x-access-token'] = keyToUse;
  }

  const endpoint = `/api/gold-price?metal=${encodeURIComponent(metal)}&currency=${encodeURIComponent(currency)}&t=${Date.now()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data: GoldPriceResult = await res.json();
    return data;
  } catch (err: any) {
    console.error('Failed to fetch live Gold price:', err);
    return {
      success: false,
      metal: 'XAU',
      currency: 'USD',
      rawPrice: 0,
      price: 0,
      bid: 0,
      ask: 0,
      open24h: 0,
      high24h: 0,
      low24h: 0,
      change: 0,
      changePercent: 0,
      source: 'Offline / Fallback',
      goldApiStatus: 'ERROR',
      goldApiNotice: err?.message || 'Connection error',
      timestamp: Date.now(),
      error: err?.message || 'Failed to fetch live price',
    };
  }
}

/**
 * Diagnostic function to test a GoldAPI key directly.
 * Calls the backend test proxy which sends a test probe to https://www.goldapi.io/api/XAU/USD.
 *
 * @param keyToCheck The GoldAPI key to validate
 * @returns Promise<GoldApiTestResult> Verification payload and diagnostics
 */
export async function testGoldApiKeyDirectly(keyToCheck?: string): Promise<GoldApiTestResult> {
  const key = (keyToCheck !== undefined ? keyToCheck : getSavedGoldApiKey()).trim();

  try {
    const res = await fetch(`/api/gold-api-test?key=${encodeURIComponent(key)}&t=${Date.now()}`, {
      headers: key ? { 'x-access-token': key } : {},
      cache: 'no-store',
    });

    const data: GoldApiTestResult = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      configured: Boolean(key),
      status: 'NETWORK_ERROR',
      message: err?.message || 'Failed to connect to backend GoldAPI test service',
      error: err?.message,
    };
  }
}
