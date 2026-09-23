import { TimeframeId } from '../types';

export interface DominionTimeframeOption {
  id: TimeframeId;
  label: string;
  mt5Code: string;
  category: 'MINUTES' | 'HOURS' | 'DAYS_MONTHS';
  intervalMs: number;
  barVolatility: number;
  baseVolume: number;
  cycleSpeed: number;
  description: string;
  isQuickAccess?: boolean;
}

export const DOMINION_TIMEFRAMES: DominionTimeframeOption[] = [
  // Minutes
  {
    id: '1m',
    label: '1m',
    mt5Code: 'M1',
    category: 'MINUTES',
    intervalMs: 1 * 60 * 1000,
    barVolatility: 0.00028,
    baseVolume: 850,
    cycleSpeed: 14,
    description: '1 Minute Scalp (High frequency tick order flow)',
    isQuickAccess: true,
  },
  {
    id: '2m',
    label: '2m',
    mt5Code: 'M2',
    category: 'MINUTES',
    intervalMs: 2 * 60 * 1000,
    barVolatility: 0.00042,
    baseVolume: 1500,
    cycleSpeed: 16,
    description: '2 Minute Scalp (Noise-reduced execution)',
  },
  {
    id: '3m',
    label: '3m',
    mt5Code: 'M3',
    category: 'MINUTES',
    intervalMs: 3 * 60 * 1000,
    barVolatility: 0.00055,
    baseVolume: 2200,
    cycleSpeed: 17,
    description: '3 Minute Scalp (Structure confirmation)',
  },
  {
    id: '5m',
    label: '5m',
    mt5Code: 'M5',
    category: 'MINUTES',
    intervalMs: 5 * 60 * 1000,
    barVolatility: 0.00072,
    baseVolume: 3200,
    cycleSpeed: 18,
    description: '5 Minute Standard Scalp (Benchmark trigger timeframe)',
    isQuickAccess: true,
  },
  {
    id: '10m',
    label: '10m',
    mt5Code: 'M10',
    category: 'MINUTES',
    intervalMs: 10 * 60 * 1000,
    barVolatility: 0.00110,
    baseVolume: 5800,
    cycleSpeed: 20,
    description: '10 Minute Intraday (Order block development)',
  },
  {
    id: '15m',
    label: '15m',
    mt5Code: 'M15',
    category: 'MINUTES',
    intervalMs: 15 * 60 * 1000,
    barVolatility: 0.00145,
    baseVolume: 8500,
    cycleSpeed: 22,
    description: '15 Minute Intraday (Dominion session swing & liquidity pools)',
    isQuickAccess: true,
  },
  {
    id: '30m',
    label: '30m',
    mt5Code: 'M30',
    category: 'MINUTES',
    intervalMs: 30 * 60 * 1000,
    barVolatility: 0.00220,
    baseVolume: 16000,
    cycleSpeed: 25,
    description: '30 Minute Half-Session (Key support / resistance confluence)',
    isQuickAccess: true,
  },

  // Hours
  {
    id: '1h',
    label: '1h',
    mt5Code: 'H1',
    category: 'HOURS',
    intervalMs: 60 * 60 * 1000,
    barVolatility: 0.00340,
    baseVolume: 26000,
    cycleSpeed: 28,
    description: '1 Hour (London / New York session structure benchmark)',
    isQuickAccess: true,
  },
  {
    id: '2h',
    label: '2h',
    mt5Code: 'H2',
    category: 'HOURS',
    intervalMs: 120 * 60 * 1000,
    barVolatility: 0.00510,
    baseVolume: 48000,
    cycleSpeed: 31,
    description: '2 Hours (Half-day institutional bias)',
  },
  {
    id: '4h',
    label: '4h',
    mt5Code: 'H4',
    category: 'HOURS',
    intervalMs: 240 * 60 * 1000,
    barVolatility: 0.00720,
    baseVolume: 78000,
    cycleSpeed: 34,
    description: '4 Hours (Higher timeframe market structure & breaker blocks)',
    isQuickAccess: true,
  },
  {
    id: '6h',
    label: '6h',
    mt5Code: 'H6',
    category: 'HOURS',
    intervalMs: 360 * 60 * 1000,
    barVolatility: 0.00920,
    baseVolume: 110000,
    cycleSpeed: 37,
    description: '6 Hours (Quarter-day macro cycle)',
  },
  {
    id: '8h',
    label: '8h',
    mt5Code: 'H8',
    category: 'HOURS',
    intervalMs: 480 * 60 * 1000,
    barVolatility: 0.01150,
    baseVolume: 145000,
    cycleSpeed: 39,
    description: '8 Hours (Full trading session shift)',
  },
  {
    id: '12h',
    label: '12h',
    mt5Code: 'H12',
    category: 'HOURS',
    intervalMs: 720 * 60 * 1000,
    barVolatility: 0.01350,
    baseVolume: 180000,
    cycleSpeed: 41,
    description: '12 Hours (Half-daily institutional candle)',
  },

  // Days & Macro
  {
    id: '1d',
    label: '1d',
    mt5Code: 'D1',
    category: 'DAYS_MONTHS',
    intervalMs: 1440 * 60 * 1000,
    barVolatility: 0.01550,
    baseVolume: 220000,
    cycleSpeed: 42,
    description: 'Daily (Macro high/low, daily directional bias)',
    isQuickAccess: true,
  },
  {
    id: '1w',
    label: '1w',
    mt5Code: 'W1',
    category: 'DAYS_MONTHS',
    intervalMs: 10080 * 60 * 1000,
    barVolatility: 0.03200,
    baseVolume: 850000,
    cycleSpeed: 48,
    description: 'Weekly (Major institutional cycle & order blocks)',
  },
  {
    id: '1M',
    label: '1M',
    mt5Code: 'MN',
    category: 'DAYS_MONTHS',
    intervalMs: 43200 * 60 * 1000,
    barVolatility: 0.06500,
    baseVolume: 3200000,
    cycleSpeed: 54,
    description: 'Monthly (Macro super-cycle and gold multi-year trend)',
  },
];

export const QUICK_ACCESS_TIMEFRAMES = DOMINION_TIMEFRAMES.filter(t => t.isQuickAccess);
export const ALL_DOMINION_TIMEFRAMES = DOMINION_TIMEFRAMES;

export function getDominionTimeframe(id: TimeframeId): DominionTimeframeOption {
  return DOMINION_TIMEFRAMES.find(t => t.id === id) || DOMINION_TIMEFRAMES[3]; // default 5m
}
