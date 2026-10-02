/**
 * Deterministic finance tools.
 *
 * Language models are unreliable arithmetic engines, and money questions are
 * exactly where a plausible-looking wrong number does damage. Everything in
 * this file is computed in TypeScript; the model is given the finished
 * calculation and is instructed to present it rather than redo it.
 *
 * Every tool returns its inputs, its result, and the steps it took, so the
 * answer can be audited by the user instead of trusted blindly.
 */

export interface ToolStep {
  label: string;
  expression: string;
  value: string;
}

export interface ToolResult {
  tool: string;
  title: string;
  /** Primary answer, already formatted for display. */
  headline: string;
  steps: ToolStep[];
  /** Machine-readable outputs for the UI. */
  outputs: Record<string, number | string>;
  /** Caveats the model must not drop. */
  notes?: string[];
}

/* ------------------------------------------------------------------ */
/* Number parsing & formatting                                         */
/* ------------------------------------------------------------------ */

const CURRENCY_SYMBOLS = /[$£€¥₱₹]/g;

/**
 * Parse a human-written amount: "12,500", "$1.2k", "₱1.5m", "3.5%", "1:2.5".
 * Returns null when nothing numeric is present.
 */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;

  const cleaned = String(raw).replace(CURRENCY_SYMBOLS, '').replace(/,/g, '').trim().toLowerCase();
  const match = /^(-?\d+(?:\.\d+)?)\s*(k|m|b|bn|thousand|million|billion)?/.exec(cleaned);
  if (!match) return null;

  let value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2]) {
    case 'k':
    case 'thousand':
      value *= 1_000;
      break;
    case 'm':
    case 'million':
      value *= 1_000_000;
      break;
    case 'b':
    case 'bn':
    case 'billion':
      value *= 1_000_000_000;
      break;
    default:
      break;
  }
  return value;
}

/** Parse a rate that may be written as "8", "8%", or "0.08". */
export function parseRate(raw: string | number | null | undefined, assumePercentAbove = 1): number | null {
  const value = parseAmount(raw);
  if (value === null) return null;
  const isExplicitPercent = typeof raw === 'string' && raw.includes('%');
  if (isExplicitPercent || Math.abs(value) > assumePercentAbove) return value / 100;
  return value;
}

export function formatMoney(value: number, currency = '$'): string {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const decimals = absolute >= 1000 ? 2 : absolute >= 1 ? 2 : 4;
  return `${sign}${currency}${absolute.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/* ------------------------------------------------------------------ */
/* Instrument contract specifications                                  */
/* ------------------------------------------------------------------ */

export interface InstrumentSpec {
  symbol: string;
  /** Units per standard lot. */
  contractSize: number;
  /** Smallest conventional price increment traders call a "pip". */
  pipSize: number;
  /** Profit/loss per 1.00 of price movement per standard lot, in quote currency. */
  valuePerPricePointPerLot: number;
  priceDecimals: number;
}

export const INSTRUMENT_SPECS: Record<string, InstrumentSpec> = {
  'XAU/USD': { symbol: 'XAU/USD', contractSize: 100, pipSize: 0.01, valuePerPricePointPerLot: 100, priceDecimals: 2 },
  'XAG/USD': { symbol: 'XAG/USD', contractSize: 5000, pipSize: 0.001, valuePerPricePointPerLot: 5000, priceDecimals: 3 },
  'EUR/USD': { symbol: 'EUR/USD', contractSize: 100000, pipSize: 0.0001, valuePerPricePointPerLot: 100000, priceDecimals: 5 },
  'GBP/USD': { symbol: 'GBP/USD', contractSize: 100000, pipSize: 0.0001, valuePerPricePointPerLot: 100000, priceDecimals: 5 },
  'AUD/USD': { symbol: 'AUD/USD', contractSize: 100000, pipSize: 0.0001, valuePerPricePointPerLot: 100000, priceDecimals: 5 },
  'USD/JPY': { symbol: 'USD/JPY', contractSize: 100000, pipSize: 0.01, valuePerPricePointPerLot: 1000, priceDecimals: 3 },
  'US30': { symbol: 'US30', contractSize: 1, pipSize: 1, valuePerPricePointPerLot: 1, priceDecimals: 1 },
  'BTC/USD': { symbol: 'BTC/USD', contractSize: 1, pipSize: 0.01, valuePerPricePointPerLot: 1, priceDecimals: 2 },
};

export function resolveInstrument(symbol?: string): InstrumentSpec {
  if (!symbol) return INSTRUMENT_SPECS['XAU/USD'];
  const normalized = symbol.toUpperCase().replace(/\s/g, '');
  if (INSTRUMENT_SPECS[normalized]) return INSTRUMENT_SPECS[normalized];
  const withSlash = normalized.length === 6 ? `${normalized.slice(0, 3)}/${normalized.slice(3)}` : normalized;
  if (INSTRUMENT_SPECS[withSlash]) return INSTRUMENT_SPECS[withSlash];
  if (/XAU|GOLD/.test(normalized)) return INSTRUMENT_SPECS['XAU/USD'];
  return INSTRUMENT_SPECS['XAU/USD'];
}

/* ------------------------------------------------------------------ */
/* Trading tools                                                       */
/* ------------------------------------------------------------------ */

export interface PositionSizeInput {
  accountBalance: number;
  /** Always a percentage: 1 means 1%, 0.5 means half a percent. */
  riskPercent: number;
  entryPrice?: number;
  stopPrice?: number;
  /** Alternative to entry/stop: absolute price distance. */
  stopDistance?: number;
  symbol?: string;
  currency?: string;
}

export function positionSize(input: PositionSizeInput): ToolResult {
  const spec = resolveInstrument(input.symbol);
  const currency = input.currency ?? '$';
  // riskPercent is unambiguously a percentage. The earlier "divide only when
  // greater than 1" heuristic turned the most common input of all — 1% — into
  // risking the entire account on one trade.
  const riskFraction = input.riskPercent / 100;
  const riskAmount = input.accountBalance * riskFraction;

  const distance =
    input.stopDistance ??
    (input.entryPrice !== undefined && input.stopPrice !== undefined
      ? Math.abs(input.entryPrice - input.stopPrice)
      : NaN);

  if (!Number.isFinite(distance) || distance <= 0) {
    return {
      tool: 'position_size',
      title: 'Position sizing',
      headline: 'Cannot size this trade — the stop distance is missing or zero.',
      steps: [],
      outputs: { riskAmount: round(riskAmount) },
      notes: ['Give me the entry and stop price (or the distance in price terms) and I will size it exactly.'],
    };
  }

  const costPerLot = distance * spec.valuePerPricePointPerLot;
  const lots = riskAmount / costPerLot;
  const units = lots * spec.contractSize;
  const pips = distance / spec.pipSize;

  return {
    tool: 'position_size',
    title: `Position sizing — ${spec.symbol}`,
    headline: `${round(lots, 2)} lots (${round(units, 2)} units), risking ${formatMoney(riskAmount, currency)}`,
    steps: [
      {
        label: 'Risk budget',
        expression: `${formatMoney(input.accountBalance, currency)} × ${formatPercent(riskFraction)}`,
        value: formatMoney(riskAmount, currency),
      },
      {
        label: 'Stop distance',
        expression:
          input.entryPrice !== undefined && input.stopPrice !== undefined
            ? `|${input.entryPrice} − ${input.stopPrice}|`
            : `${distance}`,
        value: `${round(distance, spec.priceDecimals)} (${round(pips, 1)} pips)`,
      },
      {
        label: 'Loss per standard lot at that stop',
        expression: `${round(distance, spec.priceDecimals)} × ${spec.valuePerPricePointPerLot}`,
        value: formatMoney(costPerLot, currency),
      },
      {
        label: 'Position size',
        expression: `${formatMoney(riskAmount, currency)} ÷ ${formatMoney(costPerLot, currency)}`,
        value: `${round(lots, 2)} lots`,
      },
    ],
    outputs: {
      lots: round(lots, 2),
      units: round(units, 2),
      riskAmount: round(riskAmount, 2),
      stopDistance: round(distance, spec.priceDecimals),
      stopPips: round(pips, 1),
      lossPerLot: round(costPerLot, 2),
      symbol: spec.symbol,
    },
    notes: [
      `Contract spec used: 1 lot = ${spec.contractSize} units, ${formatMoney(spec.valuePerPricePointPerLot, currency)} per 1.00 of price.`,
      'Size does not include spread, commission or slippage — real risk is slightly higher than the figure above.',
    ],
  };
}

export interface RiskRewardInput {
  entry: number;
  stop: number;
  target: number;
  symbol?: string;
  lots?: number;
  currency?: string;
}

export function riskReward(input: RiskRewardInput): ToolResult {
  const spec = resolveInstrument(input.symbol);
  const currency = input.currency ?? '$';
  const risk = Math.abs(input.entry - input.stop);
  const reward = Math.abs(input.target - input.entry);
  const ratio = risk === 0 ? 0 : reward / risk;
  const breakEvenWinRate = ratio === 0 ? 1 : 1 / (1 + ratio);
  const lots = input.lots ?? 1;
  const riskMoney = risk * spec.valuePerPricePointPerLot * lots;
  const rewardMoney = reward * spec.valuePerPricePointPerLot * lots;

  return {
    tool: 'risk_reward',
    title: `Risk / reward — ${spec.symbol}`,
    headline: `1:${round(ratio, 2)} — this needs a win rate above ${formatPercent(breakEvenWinRate, 1)} to break even`,
    steps: [
      { label: 'Risk', expression: `|${input.entry} − ${input.stop}|`, value: `${round(risk, spec.priceDecimals)}` },
      { label: 'Reward', expression: `|${input.target} − ${input.entry}|`, value: `${round(reward, spec.priceDecimals)}` },
      { label: 'Ratio', expression: `${round(reward, 2)} ÷ ${round(risk, 2)}`, value: `1:${round(ratio, 2)}` },
      {
        label: 'Break-even win rate',
        expression: `1 ÷ (1 + ${round(ratio, 2)})`,
        value: formatPercent(breakEvenWinRate, 1),
      },
      {
        label: `Money at ${lots} lot(s)`,
        expression: `risk ${round(risk, 2)} × ${spec.valuePerPricePointPerLot} × ${lots}`,
        value: `${formatMoney(riskMoney, currency)} at risk / ${formatMoney(rewardMoney, currency)} target`,
      },
    ],
    outputs: {
      ratio: round(ratio, 2),
      riskPoints: round(risk, spec.priceDecimals),
      rewardPoints: round(reward, spec.priceDecimals),
      breakEvenWinRate: round(breakEvenWinRate, 4),
      riskMoney: round(riskMoney, 2),
      rewardMoney: round(rewardMoney, 2),
    },
    notes:
      ratio < 1
        ? ['Below 1:1 the win rate has to exceed 50% just to stay flat, before costs.']
        : undefined,
  };
}

export function expectancy(winRate: number, averageWin: number, averageLoss: number, currency = '$'): ToolResult {
  const p = winRate > 1 ? winRate / 100 : winRate;
  const q = 1 - p;
  const loss = Math.abs(averageLoss);
  const value = p * averageWin - q * loss;
  const payoff = loss === 0 ? 0 : averageWin / loss;

  return {
    tool: 'expectancy',
    title: 'System expectancy',
    headline: `${value >= 0 ? '+' : ''}${formatMoney(value, currency)} per trade`,
    steps: [
      { label: 'Win contribution', expression: `${formatPercent(p)} × ${formatMoney(averageWin, currency)}`, value: formatMoney(p * averageWin, currency) },
      { label: 'Loss contribution', expression: `${formatPercent(q)} × ${formatMoney(loss, currency)}`, value: formatMoney(q * loss, currency) },
      { label: 'Expectancy', expression: 'wins − losses', value: formatMoney(value, currency) },
      { label: 'Payoff ratio', expression: `${formatMoney(averageWin, currency)} ÷ ${formatMoney(loss, currency)}`, value: `1:${round(payoff, 2)}` },
      { label: 'Per 100 trades', expression: `${formatMoney(value, currency)} × 100`, value: formatMoney(value * 100, currency) },
    ],
    outputs: {
      expectancy: round(value, 2),
      payoffRatio: round(payoff, 2),
      per100Trades: round(value * 100, 2),
      breakEvenWinRate: round(1 / (1 + payoff), 4),
    },
    notes:
      value < 0
        ? ['Negative expectancy: this system loses money over a large sample regardless of how any individual trade feels.']
        : ['Expectancy is before spread, commission and slippage. Subtract your real round-trip cost per trade.'],
  };
}

export function kellyFraction(winRate: number, payoffRatio: number): ToolResult {
  const p = winRate > 1 ? winRate / 100 : winRate;
  const q = 1 - p;
  const b = payoffRatio;
  const full = (b * p - q) / b;
  const quarter = full / 4;
  const half = full / 2;

  return {
    tool: 'kelly',
    title: 'Kelly criterion',
    headline:
      full <= 0
        ? 'Kelly is negative — this edge does not justify any size at all.'
        : `Full Kelly ${formatPercent(full)}; practical range ${formatPercent(quarter)}–${formatPercent(half)}`,
    steps: [
      { label: 'Inputs', expression: `p = ${formatPercent(p)}, b = ${round(b, 2)}`, value: '' },
      { label: 'Full Kelly', expression: `(${round(b, 2)} × ${round(p, 3)} − ${round(q, 3)}) ÷ ${round(b, 2)}`, value: formatPercent(full) },
      { label: 'Half Kelly', expression: 'full ÷ 2', value: formatPercent(half) },
      { label: 'Quarter Kelly', expression: 'full ÷ 4', value: formatPercent(quarter) },
    ],
    outputs: { fullKelly: round(full, 4), halfKelly: round(half, 4), quarterKelly: round(quarter, 4) },
    notes: [
      'Kelly assumes the win rate and payoff are known exactly. They are estimates, and overestimated edge makes full Kelly ruinous.',
      'Most discretionary traders should stay far below quarter Kelly — typically 1-2% per trade.',
    ],
  };
}

export function drawdownRecovery(drawdownPercent: number): ToolResult {
  const d = drawdownPercent > 1 ? drawdownPercent / 100 : drawdownPercent;
  const required = 1 / (1 - d) - 1;
  const table = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7].map((level) => ({
    label: `−${formatPercent(level, 0)}`,
    expression: `1 ÷ (1 − ${level})`,
    value: `+${formatPercent(1 / (1 - level) - 1, 1)}`,
  }));

  return {
    tool: 'drawdown_recovery',
    title: 'Drawdown recovery',
    headline: `A ${formatPercent(d, 1)} drawdown needs ${formatPercent(required, 1)} to get back to even`,
    steps: [
      { label: 'Required gain', expression: `1 ÷ (1 − ${round(d, 4)}) − 1`, value: formatPercent(required, 2) },
      ...table,
    ],
    outputs: { drawdown: round(d, 4), requiredGain: round(required, 4) },
    notes: ['Recovery is non-linear — this asymmetry is the entire argument for small risk per trade.'],
  };
}

export function goldPnl(entry: number, exit: number, lots: number, symbol = 'XAU/USD', currency = '$'): ToolResult {
  const spec = resolveInstrument(symbol);
  const move = exit - entry;
  const pnl = move * spec.valuePerPricePointPerLot * lots;
  return {
    tool: 'trade_pnl',
    title: `Trade P&L — ${spec.symbol}`,
    headline: `${pnl >= 0 ? '+' : ''}${formatMoney(pnl, currency)} on ${lots} lot(s)`,
    steps: [
      { label: 'Price move', expression: `${exit} − ${entry}`, value: `${round(move, spec.priceDecimals)}` },
      { label: 'Value per point per lot', expression: `${spec.contractSize} units`, value: formatMoney(spec.valuePerPricePointPerLot, currency) },
      { label: 'P&L', expression: `${round(move, 2)} × ${spec.valuePerPricePointPerLot} × ${lots}`, value: formatMoney(pnl, currency) },
    ],
    outputs: { pnl: round(pnl, 2), move: round(move, spec.priceDecimals), lots },
    notes: ['Gross of spread and commission.'],
  };
}

/* ------------------------------------------------------------------ */
/* Personal finance tools                                              */
/* ------------------------------------------------------------------ */

export function compoundGrowth(
  principal: number,
  annualRate: number,
  years: number,
  monthlyContribution = 0,
  currency = '$',
): ToolResult {
  const rate = annualRate > 1 ? annualRate / 100 : annualRate;
  const monthlyRate = rate / 12;
  const months = Math.round(years * 12);

  const principalGrowth = principal * Math.pow(1 + monthlyRate, months);
  const contributionGrowth =
    monthlyRate === 0
      ? monthlyContribution * months
      : monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  const future = principalGrowth + contributionGrowth;
  const contributed = principal + monthlyContribution * months;
  const earned = future - contributed;

  return {
    tool: 'compound_growth',
    title: 'Compound growth projection',
    headline: `${formatMoney(future, currency)} after ${years} year(s)`,
    steps: [
      { label: 'Starting amount grows to', expression: `${formatMoney(principal, currency)} × (1 + ${round(monthlyRate, 6)})^${months}`, value: formatMoney(principalGrowth, currency) },
      ...(monthlyContribution > 0
        ? [
            {
              label: 'Contributions grow to',
              expression: `${formatMoney(monthlyContribution, currency)}/mo × annuity factor`,
              value: formatMoney(contributionGrowth, currency),
            },
          ]
        : []),
      { label: 'Total contributed', expression: `${formatMoney(principal, currency)} + ${formatMoney(monthlyContribution, currency)} × ${months}`, value: formatMoney(contributed, currency) },
      { label: 'Growth earned', expression: 'future − contributed', value: formatMoney(earned, currency) },
    ],
    outputs: {
      futureValue: round(future, 2),
      totalContributed: round(contributed, 2),
      growth: round(earned, 2),
      months,
    },
    notes: [
      `At 3% inflation this is worth about ${formatMoney(future / Math.pow(1.03, years), currency)} in today's money.`,
      'Assumes a constant rate. Real markets deliver the average through large swings, not smoothly.',
    ],
  };
}

export function loanPayment(principal: number, annualRate: number, years: number, currency = '$'): ToolResult {
  const rate = annualRate > 1 ? annualRate / 100 : annualRate;
  const monthlyRate = rate / 12;
  const n = Math.round(years * 12);
  const payment =
    monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const totalPaid = payment * n;
  const totalInterest = totalPaid - principal;

  // First-payment split makes the amortisation reality concrete.
  const firstInterest = principal * monthlyRate;
  const firstPrincipal = payment - firstInterest;

  return {
    tool: 'loan_payment',
    title: 'Loan payment & total cost',
    headline: `${formatMoney(payment, currency)} per month for ${n} months`,
    steps: [
      { label: 'Monthly rate', expression: `${formatPercent(rate)} ÷ 12`, value: formatPercent(monthlyRate, 4) },
      { label: 'Payment', expression: `P × r ÷ (1 − (1+r)^−${n})`, value: formatMoney(payment, currency) },
      { label: 'Total repaid', expression: `${formatMoney(payment, currency)} × ${n}`, value: formatMoney(totalPaid, currency) },
      { label: 'Total interest', expression: 'total − principal', value: formatMoney(totalInterest, currency) },
      {
        label: 'First payment split',
        expression: 'interest / principal',
        value: `${formatMoney(firstInterest, currency)} interest, ${formatMoney(firstPrincipal, currency)} principal`,
      },
    ],
    outputs: {
      monthlyPayment: round(payment, 2),
      totalPaid: round(totalPaid, 2),
      totalInterest: round(totalInterest, 2),
      interestShare: round(totalInterest / principal, 4),
      months: n,
    },
    notes: [`Interest is ${formatPercent(totalInterest / principal, 1)} of the amount borrowed over the full term.`],
  };
}

export function debtPayoff(balance: number, annualRate: number, monthlyPayment: number, currency = '$'): ToolResult {
  const rate = annualRate > 1 ? annualRate / 100 : annualRate;
  const monthlyRate = rate / 12;
  const minimumViable = balance * monthlyRate;

  if (monthlyPayment <= minimumViable) {
    return {
      tool: 'debt_payoff',
      title: 'Debt payoff time',
      headline: `${formatMoney(monthlyPayment, currency)}/month never clears this debt.`,
      steps: [
        { label: 'Monthly interest accrued', expression: `${formatMoney(balance, currency)} × ${formatPercent(monthlyRate, 4)}`, value: formatMoney(minimumViable, currency) },
      ],
      outputs: { months: Infinity, monthlyInterest: round(minimumViable, 2) },
      notes: [
        `Interest alone is ${formatMoney(minimumViable, currency)} a month. The payment must exceed that before any principal moves.`,
      ],
    };
  }

  const months =
    monthlyRate === 0
      ? balance / monthlyPayment
      : -Math.log(1 - (balance * monthlyRate) / monthlyPayment) / Math.log(1 + monthlyRate);
  const wholeMonths = Math.ceil(months);
  const totalPaid = monthlyPayment * months;
  const interest = totalPaid - balance;

  return {
    tool: 'debt_payoff',
    title: 'Debt payoff time',
    headline: `${wholeMonths} months (${round(wholeMonths / 12, 1)} years), ${formatMoney(interest, currency)} in interest`,
    steps: [
      { label: 'Monthly rate', expression: `${formatPercent(rate)} ÷ 12`, value: formatPercent(monthlyRate, 4) },
      { label: 'Months to clear', expression: '−ln(1 − B·r/PMT) ÷ ln(1+r)', value: `${wholeMonths}` },
      { label: 'Total paid', expression: `${formatMoney(monthlyPayment, currency)} × ${wholeMonths}`, value: formatMoney(totalPaid, currency) },
      { label: 'Interest cost', expression: 'total − balance', value: formatMoney(interest, currency) },
    ],
    outputs: {
      months: wholeMonths,
      years: round(wholeMonths / 12, 2),
      totalPaid: round(totalPaid, 2),
      totalInterest: round(interest, 2),
    },
    notes: [
      `Adding ${formatMoney(monthlyPayment * 0.25, currency)} a month would cut this meaningfully — extra payments go entirely to principal.`,
    ],
  };
}

export function savingsGoal(target: number, months: number, currentSaved = 0, annualRate = 0, currency = '$'): ToolResult {
  const remaining = Math.max(target - currentSaved, 0);
  const rate = annualRate > 1 ? annualRate / 100 : annualRate;
  const monthlyRate = rate / 12;

  const required =
    monthlyRate === 0
      ? remaining / months
      : (remaining * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);

  return {
    tool: 'savings_goal',
    title: 'Savings goal',
    headline: `${formatMoney(required, currency)} per month for ${months} months`,
    steps: [
      { label: 'Amount still needed', expression: `${formatMoney(target, currency)} − ${formatMoney(currentSaved, currency)}`, value: formatMoney(remaining, currency) },
      { label: 'Monthly requirement', expression: monthlyRate === 0 ? `${formatMoney(remaining, currency)} ÷ ${months}` : 'annuity solved for payment', value: formatMoney(required, currency) },
      { label: 'Per week', expression: `${formatMoney(required, currency)} ÷ 4.33`, value: formatMoney(required / 4.33, currency) },
      { label: 'With 10% buffer', expression: `${formatMoney(required, currency)} × 1.1`, value: formatMoney(required * 1.1, currency) },
    ],
    outputs: { monthlyRequired: round(required, 2), weeklyRequired: round(required / 4.33, 2), remaining: round(remaining, 2) },
    notes: ['Plan for the buffered number. A plan with no slack fails on the first unexpected month.'],
  };
}

export function emergencyFund(monthlyExpenses: number, incomeStability: 'STABLE' | 'VARIABLE' | 'SELF_EMPLOYED' = 'STABLE', currency = '$'): ToolResult {
  const multipliers = { STABLE: [3, 6], VARIABLE: [6, 9], SELF_EMPLOYED: [9, 12] } as const;
  const [low, high] = multipliers[incomeStability];
  return {
    tool: 'emergency_fund',
    title: 'Emergency fund target',
    headline: `${formatMoney(monthlyExpenses * low, currency)} – ${formatMoney(monthlyExpenses * high, currency)}`,
    steps: [
      { label: 'Starter goal (1 month)', expression: `${formatMoney(monthlyExpenses, currency)} × 1`, value: formatMoney(monthlyExpenses, currency) },
      { label: `Lower target (${low} months)`, expression: `${formatMoney(monthlyExpenses, currency)} × ${low}`, value: formatMoney(monthlyExpenses * low, currency) },
      { label: `Upper target (${high} months)`, expression: `${formatMoney(monthlyExpenses, currency)} × ${high}`, value: formatMoney(monthlyExpenses * high, currency) },
    ],
    outputs: { starter: round(monthlyExpenses, 2), lower: round(monthlyExpenses * low, 2), upper: round(monthlyExpenses * high, 2) },
    notes: [
      'Size against essential expenses, not income or total spending.',
      'Keep it liquid and separate — no card attached, not invested.',
    ],
  };
}

export function budgetSplit(takeHome: number, currency = '$'): ToolResult {
  const needs = takeHome * 0.5;
  const wants = takeHome * 0.3;
  const future = takeHome * 0.2;
  return {
    tool: 'budget_split',
    title: '50 / 30 / 20 starting budget',
    headline: `${formatMoney(needs, currency)} needs · ${formatMoney(wants, currency)} wants · ${formatMoney(future, currency)} save & debt`,
    steps: [
      { label: 'Needs (50%)', expression: `${formatMoney(takeHome, currency)} × 0.50`, value: formatMoney(needs, currency) },
      { label: 'Wants (30%)', expression: `${formatMoney(takeHome, currency)} × 0.30`, value: formatMoney(wants, currency) },
      { label: 'Save / debt (20%)', expression: `${formatMoney(takeHome, currency)} × 0.20`, value: formatMoney(future, currency) },
      { label: 'Annual savings at 20%', expression: `${formatMoney(future, currency)} × 12`, value: formatMoney(future * 12, currency) },
    ],
    outputs: { needs: round(needs, 2), wants: round(wants, 2), savings: round(future, 2), annualSavings: round(future * 12, 2) },
    notes: [
      'This is a starting point, not a rule. If housing alone exceeds 50%, the fix is in housing, transport or income — not in small categories.',
    ],
  };
}

export function cagr(beginning: number, ending: number, years: number): ToolResult {
  const value = Math.pow(ending / beginning, 1 / years) - 1;
  return {
    tool: 'cagr',
    title: 'Compound annual growth rate',
    headline: `${formatPercent(value)} per year`,
    steps: [
      { label: 'Total growth', expression: `${ending} ÷ ${beginning}`, value: `${round(ending / beginning, 4)}×` },
      { label: 'CAGR', expression: `(${round(ending / beginning, 4)})^(1/${years}) − 1`, value: formatPercent(value) },
      { label: 'Doubling time at this rate', expression: '72 ÷ rate', value: `${round(72 / (value * 100), 1)} years` },
    ],
    outputs: { cagr: round(value, 4), totalMultiple: round(ending / beginning, 4) },
  };
}

export function realReturn(nominalRate: number, inflationRate: number): ToolResult {
  const nominal = nominalRate > 1 ? nominalRate / 100 : nominalRate;
  const inflation = inflationRate > 1 ? inflationRate / 100 : inflationRate;
  const real = (1 + nominal) / (1 + inflation) - 1;
  return {
    tool: 'real_return',
    title: 'Real (inflation-adjusted) return',
    headline: `${formatPercent(real)} real`,
    steps: [
      { label: 'Exact', expression: `(1 + ${round(nominal, 4)}) ÷ (1 + ${round(inflation, 4)}) − 1`, value: formatPercent(real) },
      { label: 'Quick approximation', expression: `${formatPercent(nominal)} − ${formatPercent(inflation)}`, value: formatPercent(nominal - inflation) },
    ],
    outputs: { realReturn: round(real, 4), approximation: round(nominal - inflation, 4) },
    notes: real < 0 ? ['This is a real loss — purchasing power is shrinking despite a positive nominal return.'] : undefined,
  };
}

export function netPresentValue(initialInvestment: number, cashFlows: number[], discountRate: number, currency = '$'): ToolResult {
  const rate = discountRate > 1 ? discountRate / 100 : discountRate;
  const steps: ToolStep[] = [];
  let present = 0;
  cashFlows.forEach((flow, index) => {
    const t = index + 1;
    const discounted = flow / Math.pow(1 + rate, t);
    present += discounted;
    steps.push({ label: `Year ${t}`, expression: `${formatMoney(flow, currency)} ÷ (1+${round(rate, 4)})^${t}`, value: formatMoney(discounted, currency) });
  });
  const npv = present - initialInvestment;

  // Bisection for IRR — robust where Newton's method diverges on sign changes.
  const npvAt = (r: number) =>
    cashFlows.reduce((sum, flow, index) => sum + flow / Math.pow(1 + r, index + 1), 0) - initialInvestment;
  let low = -0.95;
  let high = 10;
  let irr = NaN;
  if (npvAt(low) * npvAt(high) < 0) {
    for (let i = 0; i < 200; i++) {
      const mid = (low + high) / 2;
      if (npvAt(low) * npvAt(mid) <= 0) high = mid;
      else low = mid;
    }
    irr = (low + high) / 2;
  }

  return {
    tool: 'npv_irr',
    title: 'NPV and IRR',
    headline: `NPV ${formatMoney(npv, currency)} at ${formatPercent(rate)}${Number.isFinite(irr) ? ` · IRR ${formatPercent(irr)}` : ''}`,
    steps: [
      ...steps,
      { label: 'Sum of discounted flows', expression: 'Σ', value: formatMoney(present, currency) },
      { label: 'NPV', expression: `${formatMoney(present, currency)} − ${formatMoney(initialInvestment, currency)}`, value: formatMoney(npv, currency) },
    ],
    outputs: { npv: round(npv, 2), irr: Number.isFinite(irr) ? round(irr, 4) : 'n/a', presentValue: round(present, 2) },
    notes: [
      npv >= 0
        ? 'Positive NPV: the project clears the hurdle rate you specified.'
        : 'Negative NPV: the project does not clear the hurdle rate you specified.',
    ],
  };
}

export function breakEvenUnits(fixedCosts: number, pricePerUnit: number, variableCostPerUnit: number, currency = '$'): ToolResult {
  const contribution = pricePerUnit - variableCostPerUnit;
  if (contribution <= 0) {
    return {
      tool: 'break_even',
      title: 'Break-even analysis',
      headline: 'No break-even exists — each unit sold loses money.',
      steps: [{ label: 'Contribution margin', expression: `${pricePerUnit} − ${variableCostPerUnit}`, value: formatMoney(contribution, currency) }],
      outputs: { contribution: round(contribution, 2), units: Infinity },
      notes: ['Volume cannot fix a negative contribution margin. Price or variable cost has to change first.'],
    };
  }
  const units = fixedCosts / contribution;
  return {
    tool: 'break_even',
    title: 'Break-even analysis',
    headline: `${Math.ceil(units)} units per period`,
    steps: [
      { label: 'Contribution per unit', expression: `${pricePerUnit} − ${variableCostPerUnit}`, value: formatMoney(contribution, currency) },
      { label: 'Break-even units', expression: `${formatMoney(fixedCosts, currency)} ÷ ${formatMoney(contribution, currency)}`, value: `${Math.ceil(units)}` },
      { label: 'Break-even revenue', expression: `${Math.ceil(units)} × ${formatMoney(pricePerUnit, currency)}`, value: formatMoney(Math.ceil(units) * pricePerUnit, currency) },
      { label: 'Margin of safety at 2× volume', expression: '50%', value: 'half of sales can disappear before a loss' },
    ],
    outputs: { units: Math.ceil(units), contribution: round(contribution, 2), revenue: round(Math.ceil(units) * pricePerUnit, 2) },
  };
}

export function ruleOf72(annualRate: number): ToolResult {
  const rate = annualRate > 1 ? annualRate : annualRate * 100;
  const approximate = 72 / rate;
  const exact = Math.log(2) / Math.log(1 + rate / 100);
  return {
    tool: 'rule_of_72',
    title: 'Doubling time',
    headline: `About ${round(approximate, 1)} years at ${rate}%`,
    steps: [
      { label: 'Rule of 72', expression: `72 ÷ ${rate}`, value: `${round(approximate, 2)} years` },
      { label: 'Exact', expression: `ln(2) ÷ ln(1 + ${rate}/100)`, value: `${round(exact, 2)} years` },
    ],
    outputs: { approximateYears: round(approximate, 2), exactYears: round(exact, 2) },
  };
}

/* ------------------------------------------------------------------ */
/* Intent detection — route a natural message to the right tool        */
/* ------------------------------------------------------------------ */

export interface DetectedCalculation {
  tool: string;
  confidence: number;
  /** Populated when the message carried enough numbers to actually compute. */
  result?: ToolResult;
  /** What is still needed, when the computation could not run. */
  missing?: string[];
  reason: string;
}

interface NumberToken {
  value: number;
  raw: string;
  isPercent: boolean;
  index: number;
}

function extractNumbers(message: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  const pattern = /([$£€¥₱₹]?\s?-?\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn?|thousand|million|billion)?\s?%?)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const raw = match[1].trim();
    const value = parseAmount(raw);
    if (value === null) continue;
    tokens.push({ value, raw, isPercent: raw.includes('%'), index: match.index });
  }
  return tokens;
}

/** Pull a labelled number such as "balance 5000" / "5000 balance" / "stop at 2642". */
/**
 * Words that may sit between a label and its number without changing the
 * meaning. The Tagalog connectors matter: "account ko ay 10000" is how this
 * app's users actually write, and without them the sizing tool reports a
 * missing account balance that the user plainly supplied.
 */
const LABEL_FILLERS = [
  'is', 'was', 'of', 'at', 'to', 'in', 'the', 'my', 'our', 'about', 'around',
  'roughly', 'approximately', 'currently', 'now', 'only', 'just', 'total',
  'ay', 'ko', 'mo', 'niya', 'namin', 'natin', 'nila', 'na', 'ng', 'nasa',
  'ngayon', 'lang', 'po', 'ba', 'yung', 'ang',
].join('|');

// Only whitespace, a colon or an equals sign may separate a label from its
// value. A comma or dash is a clause boundary: allowing it let "account, 1%
// risk" read the 1 as the account balance, producing a position size of zero.
const LABEL_SEPARATOR = `(?:\\s*[:=]\\s*|\\s+)`;
const LABEL_GAP = `${LABEL_SEPARATOR}(?:(?:${LABEL_FILLERS})${LABEL_SEPARATOR}){0,3}`;

function findLabelled(message: string, labels: string[]): number | null {
  for (const label of labels) {
    const after = new RegExp(
      `${label}(?:${LABEL_GAP}|\\s*)([$£€¥₱₹]?\\s?\\d[\\d,]*(?:\\.\\d+)?\\s?(?:k|m|bn?)?\\s?%?)`,
      'i',
    ).exec(message);
    if (after) {
      const value = parseAmount(after[1]);
      if (value !== null) return value;
    }
    const before = new RegExp(
      `([$£€¥₱₹]?\\s?\\d[\\d,]*(?:\\.\\d+)?\\s?(?:k|m|bn?)?\\s?%?)\\s*(?:per\\s+)?${label}`,
      'i',
    ).exec(message);
    if (before) {
      const value = parseAmount(before[1]);
      if (value !== null) return value;
    }
  }
  return null;
}

const CURRENCY_HINTS: { pattern: RegExp; symbol: string }[] = [
  { pattern: /₱|php|peso/i, symbol: '₱' },
  { pattern: /€|eur\b/i, symbol: '€' },
  { pattern: /£|gbp\b/i, symbol: '£' },
  { pattern: /¥|jpy\b/i, symbol: '¥' },
  { pattern: /₹|inr\b/i, symbol: '₹' },
];

export function detectCurrency(message: string): string {
  for (const hint of CURRENCY_HINTS) if (hint.pattern.test(message)) return hint.symbol;
  return '$';
}

/**
 * Inspect a message and run any finance calculation it implies.
 *
 * Returns every confident match (a message can ask for two things at once),
 * sorted by confidence. When the intent is clear but the numbers are missing,
 * the result reports what to ask for rather than inventing values.
 */
export function detectCalculations(message: string, context: { symbol?: string; price?: number } = {}): DetectedCalculation[] {
  const text = message.toLowerCase();
  const numbers = extractNumbers(message);
  const currency = detectCurrency(message);
  const found: DetectedCalculation[] = [];

  /* ---- position sizing ---- */
  // Sizing intent, in the shapes people actually type it — including risk
  // stated before the word ("1% risk"), and Tagalog phrasings.
  const SIZING_INTENT =
    /(position siz|lot siz|lotsize|how (many|much|big) (lots?|units?|should)|what (lot |position )?size|size (this |the )?(trade|position)|risk \d|\d\s*%\s*risk|ilang lot|gaano kalaki|anong (lot|size))/i;
  if (SIZING_INTENT.test(text)) {
    const balance = findLabelled(message, ['balance', 'account', 'equity', 'capital', 'deposit']);
    const riskPercent = (() => {
      const explicit = findLabelled(message, ['risk', 'risking']);
      if (explicit !== null) return explicit;
      const percentToken = numbers.find((token) => token.isPercent);
      return percentToken ? percentToken.value : null;
    })();
    const entry = findLabelled(message, ['entry', 'enter', 'buy at', 'sell at', 'entry price']) ?? context.price ?? null;

    // "stop 5.00 away" / "a 25 pip stop" describe a DISTANCE, not a price.
    // Reading them as a stop price produced a nonsensical size (or none at
    // all), which is the worst possible failure for a risk tool.
    const priceDistanceMatch =
      /\b(?:stop|sl)\b[^.!?]{0,24}?(\d+(?:\.\d+)?)\s*(?:price\s*)?(?:points?\s*)?(?:away|wide|apart|from\s+(?:my\s+)?entry)/i.exec(message) ??
      /\b(\d+(?:\.\d+)?)\s*(?:points?\s*)?(?:away|wide)\b[^.!?]{0,16}?\b(?:stop|sl)\b/i.exec(message);
    const pipDistanceMatch = /\b(\d+(?:\.\d+)?)\s*(?:pips?|points?)\b[^.!?]{0,16}?\b(?:stop|sl)\b|\b(?:stop|sl)\b[^.!?]{0,16}?\b(\d+(?:\.\d+)?)\s*(?:pips?|points?)\b/i.exec(message);

    const explicitPriceDistance = priceDistanceMatch ? parseAmount(priceDistanceMatch[1]) : null;
    const explicitPipDistance = !explicitPriceDistance && pipDistanceMatch
      ? parseAmount(pipDistanceMatch[1] ?? pipDistanceMatch[2] ?? '')
      : null;

    const stop = explicitPriceDistance !== null || explicitPipDistance !== null
      ? null
      : findLabelled(message, ['stop', 'sl', 'stop loss', 'stoploss', 'invalidation']);
    const stopDistance = explicitPipDistance ?? findLabelled(message, ['stop distance', 'pips', 'points']);

    const missing: string[] = [];
    if (balance === null) missing.push('account balance');
    if (riskPercent === null) missing.push('risk % per trade');
    if (stop === null && stopDistance === null && explicitPriceDistance === null) {
      missing.push('stop price or stop distance');
    }

    if (missing.length === 0 && balance !== null && riskPercent !== null) {
      found.push({
        tool: 'position_size',
        confidence: 0.95,
        reason: 'Message asks for a trade size.',
        result: positionSize({
          accountBalance: balance,
          riskPercent,
          entryPrice: entry ?? undefined,
          stopPrice: stop ?? undefined,
          stopDistance:
            explicitPriceDistance !== null
              ? explicitPriceDistance
              : stop === null && stopDistance !== null
                ? stopDistance * resolveInstrument(context.symbol).pipSize
                : undefined,
          symbol: context.symbol,
          currency,
        }),
      });
    } else {
      found.push({ tool: 'position_size', confidence: 0.7, reason: 'Sizing intent detected but inputs incomplete.', missing });
    }
  }

  /* ---- risk / reward ---- */
  if (/(risk.?reward|r:r|rr ratio|reward.?to.?risk|break.?even win)/i.test(text)) {
    const entry = findLabelled(message, ['entry', 'enter', 'entry price']);
    const stop = findLabelled(message, ['stop', 'sl', 'stop loss']);
    const target = findLabelled(message, ['target', 'tp', 'take profit', 'tp1']);
    if (entry !== null && stop !== null && target !== null) {
      found.push({
        tool: 'risk_reward',
        confidence: 0.93,
        reason: 'Entry, stop and target all present.',
        result: riskReward({ entry, stop, target, symbol: context.symbol, currency }),
      });
    } else {
      found.push({
        tool: 'risk_reward',
        confidence: 0.6,
        reason: 'R:R intent detected.',
        missing: [entry === null ? 'entry' : '', stop === null ? 'stop' : '', target === null ? 'target' : ''].filter(Boolean),
      });
    }
  }

  /* ---- expectancy ---- */
  if (/(expectancy|edge per trade|average trade|is my system profitable)/i.test(text)) {
    const winRate = findLabelled(message, ['win rate', 'winrate', 'win%', 'wins']);
    const averageWin = findLabelled(message, ['average win', 'avg win', 'winner']);
    const averageLoss = findLabelled(message, ['average loss', 'avg loss', 'loser']);
    if (winRate !== null && averageWin !== null && averageLoss !== null) {
      found.push({
        tool: 'expectancy',
        confidence: 0.92,
        reason: 'Win rate and average win/loss present.',
        result: expectancy(winRate, averageWin, averageLoss, currency),
      });
    } else {
      found.push({
        tool: 'expectancy',
        confidence: 0.6,
        reason: 'Expectancy intent detected.',
        missing: ['win rate', 'average win', 'average loss'].filter((_, i) => [winRate, averageWin, averageLoss][i] === null),
      });
    }
  }

  /* ---- drawdown recovery ---- */
  if (/(drawdown|recover|down \d+%|lost \d+%|back to (even|break ?even))/i.test(text)) {
    const dd =
      findLabelled(message, ['drawdown', 'down', 'lost']) ?? (numbers.find((token) => token.isPercent)?.value ?? null);
    if (dd !== null && dd > 0 && dd < 100) {
      found.push({
        tool: 'drawdown_recovery',
        confidence: 0.85,
        reason: 'Drawdown percentage present.',
        result: drawdownRecovery(dd),
      });
    }
  }

  /* ---- compound growth ---- */
  if (/(compound|invest|grow|future value|portfolio in \d+ year|retire)/i.test(text) && /year/i.test(text)) {
    const principal = findLabelled(message, ['invest', 'principal', 'start with', 'starting', 'lump sum', 'initial']);
    const rate = findLabelled(message, ['return', 'rate', 'interest', 'apy', 'growth']) ?? (numbers.find((token) => token.isPercent)?.value ?? null);
    const years = findLabelled(message, ['years', 'year']);
    const monthly = findLabelled(message, ['monthly', 'per month', 'every month', 'a month', 'contribution']);
    if ((principal !== null || monthly !== null) && rate !== null && years !== null) {
      found.push({
        tool: 'compound_growth',
        confidence: 0.88,
        reason: 'Growth projection inputs present.',
        result: compoundGrowth(principal ?? 0, rate, years, monthly ?? 0, currency),
      });
    } else {
      found.push({
        tool: 'compound_growth',
        confidence: 0.55,
        reason: 'Growth projection intent detected.',
        missing: ['starting amount or monthly contribution', 'annual return %', 'number of years'].filter(
          (_, i) => [principal ?? monthly, rate, years][i] === null,
        ),
      });
    }
  }

  /* ---- loan payment ---- */
  if (/(loan|mortgage|borrow|monthly payment|amorti[sz]|financ(e|ing) a)/i.test(text)) {
    const principal = findLabelled(message, ['loan', 'borrow', 'principal', 'amount', 'mortgage']);
    const rate = findLabelled(message, ['rate', 'interest', 'apr']) ?? (numbers.find((token) => token.isPercent)?.value ?? null);
    const years = findLabelled(message, ['years', 'year', 'term']);
    if (principal !== null && rate !== null && years !== null) {
      found.push({
        tool: 'loan_payment',
        confidence: 0.9,
        reason: 'Loan inputs present.',
        result: loanPayment(principal, rate, years, currency),
      });
    }
  }

  /* ---- debt payoff ---- */
  if (/(pay ?off|credit card|utang|debt free|how long.*(debt|card|balance))/i.test(text)) {
    const balance = findLabelled(message, ['balance', 'debt', 'card', 'owe', 'utang']);
    const rate = findLabelled(message, ['rate', 'interest', 'apr']) ?? (numbers.find((token) => token.isPercent)?.value ?? null);
    const payment = findLabelled(message, ['paying', 'payment', 'per month', 'monthly', 'a month']);
    if (balance !== null && rate !== null && payment !== null) {
      found.push({
        tool: 'debt_payoff',
        confidence: 0.9,
        reason: 'Debt payoff inputs present.',
        result: debtPayoff(balance, rate, payment, currency),
      });
    }
  }

  /* ---- savings goal ---- */
  if (/(save|saving|ipon|goal of|down ?payment|deposit for)/i.test(text) && /(month|year|week)/i.test(text)) {
    const target = findLabelled(message, ['save', 'goal', 'target', 'need', 'ipon']);
    const months =
      findLabelled(message, ['months', 'month']) ??
      (findLabelled(message, ['years', 'year']) !== null ? (findLabelled(message, ['years', 'year']) as number) * 12 : null);
    const current = findLabelled(message, ['already saved', 'have saved', 'currently have', 'saved']);
    if (target !== null && months !== null && months > 0) {
      found.push({
        tool: 'savings_goal',
        confidence: 0.85,
        reason: 'Savings target and horizon present.',
        result: savingsGoal(target, months, current ?? 0, 0, currency),
      });
    }
  }

  /* ---- emergency fund ---- */
  if (/(emergency fund|rainy day|safety net|buffer fund)/i.test(text)) {
    const expenses = findLabelled(message, ['expenses', 'spend', 'costs', 'gastos', 'monthly']);
    if (expenses !== null) {
      const stability = /freelanc|self.?employ|commission|irregular|variable/i.test(text)
        ? 'SELF_EMPLOYED'
        : 'STABLE';
      found.push({
        tool: 'emergency_fund',
        confidence: 0.88,
        reason: 'Monthly expenses present.',
        result: emergencyFund(expenses, stability, currency),
      });
    } else {
      found.push({ tool: 'emergency_fund', confidence: 0.6, reason: 'Emergency fund intent detected.', missing: ['monthly essential expenses'] });
    }
  }

  /* ---- budget split ---- */
  if (/(budget|50.?30.?20|allocate my (salary|income|pay)|where should my (salary|money) go)/i.test(text)) {
    const income = findLabelled(message, ['take home', 'salary', 'income', 'sahod', 'earn', 'make']);
    if (income !== null) {
      found.push({
        tool: 'budget_split',
        confidence: 0.8,
        reason: 'Income present.',
        result: budgetSplit(income, currency),
      });
    }
  }

  /* ---- CAGR ---- */
  if (/(cagr|annuali[sz]ed|average annual return|grew from)/i.test(text)) {
    const from = findLabelled(message, ['from', 'started', 'beginning', 'initial']);
    const to = findLabelled(message, ['to', 'now', 'ending', 'final']);
    const years = findLabelled(message, ['years', 'year']);
    if (from !== null && to !== null && years !== null && from > 0) {
      found.push({ tool: 'cagr', confidence: 0.85, reason: 'Start, end and horizon present.', result: cagr(from, to, years) });
    }
  }

  /* ---- real return ---- */
  if (/(real return|inflation.adjusted|after inflation|purchasing power)/i.test(text)) {
    const nominal = findLabelled(message, ['return', 'rate', 'yield', 'earning', 'nominal']);
    const inflation = findLabelled(message, ['inflation', 'cpi']);
    if (nominal !== null && inflation !== null) {
      found.push({ tool: 'real_return', confidence: 0.88, reason: 'Nominal and inflation rates present.', result: realReturn(nominal, inflation) });
    }
  }

  /* ---- break even ---- */
  if (/(break.?even|fixed costs|contribution margin|how many units)/i.test(text)) {
    const fixed = findLabelled(message, ['fixed costs', 'fixed cost', 'overhead', 'rent']);
    const price = findLabelled(message, ['price', 'sell for', 'selling', 'charge']);
    const variable = findLabelled(message, ['variable cost', 'cost per unit', 'cost to make', 'cogs']);
    if (fixed !== null && price !== null && variable !== null) {
      found.push({
        tool: 'break_even',
        confidence: 0.88,
        reason: 'Break-even inputs present.',
        result: breakEvenUnits(fixed, price, variable, currency),
      });
    }
  }

  /* ---- doubling time ---- */
  if (/(rule of 72|double my money|doubling time|how long to double)/i.test(text)) {
    const rate = findLabelled(message, ['rate', 'return', 'interest']) ?? (numbers.find((token) => token.isPercent)?.value ?? null);
    if (rate !== null) {
      found.push({ tool: 'rule_of_72', confidence: 0.85, reason: 'Rate present.', result: ruleOf72(rate) });
    }
  }

  /* ---- Kelly ---- */
  if (/(kelly|optimal (bet|size|fraction))/i.test(text)) {
    const winRate = findLabelled(message, ['win rate', 'winrate', 'probability', 'win%']);
    const payoff = findLabelled(message, ['payoff', 'ratio', 'reward']);
    if (winRate !== null && payoff !== null) {
      found.push({ tool: 'kelly', confidence: 0.85, reason: 'Win rate and payoff present.', result: kellyFraction(winRate, payoff) });
    }
  }

  /* ---- trade P&L ---- */
  if (/(p&l|pnl|profit (on|from)|how much (did|would) i (make|lose))/i.test(text)) {
    const entry = findLabelled(message, ['entry', 'bought at', 'entered', 'from']);
    const exit = findLabelled(message, ['exit', 'sold at', 'closed at', 'to']);
    const lots = findLabelled(message, ['lots', 'lot', 'size']);
    if (entry !== null && exit !== null && lots !== null) {
      found.push({
        tool: 'trade_pnl',
        confidence: 0.85,
        reason: 'Entry, exit and size present.',
        result: goldPnl(entry, exit, lots, context.symbol, currency),
      });
    }
  }

  return found.sort((a, b) => b.confidence - a.confidence);
}

/** Render computed results as a compact block for injection into the prompt. */
export function renderToolResultsForPrompt(results: DetectedCalculation[]): string {
  const computed = results.filter((item) => item.result);
  if (computed.length === 0) return '';

  const blocks = computed.map((item) => {
    const result = item.result!;
    const steps = result.steps
      .filter((step) => step.value)
      .map((step) => `  - ${step.label}: ${step.expression} = ${step.value}`)
      .join('\n');
    const notes = result.notes?.length ? `\n  Caveats: ${result.notes.join(' ')}` : '';
    return `TOOL ${result.tool} — ${result.title}\n  RESULT: ${result.headline}\n${steps}${notes}`;
  });

  return `
=== VERIFIED CALCULATIONS (computed exactly in code, NOT by you) ===
These numbers are already correct. Present them to the user, explain what they
mean, and do NOT recompute or alter them. If a figure here contradicts your own
estimate, this block is right and you are wrong.

${blocks.join('\n\n')}
=== END VERIFIED CALCULATIONS ===`;
}

/** Everything the UI can list as an available capability. */
export const FINANCE_TOOL_CATALOG = [
  { tool: 'position_size', label: 'Position sizing', needs: ['account balance', 'risk %', 'entry & stop'] },
  { tool: 'risk_reward', label: 'Risk / reward & break-even win rate', needs: ['entry', 'stop', 'target'] },
  { tool: 'trade_pnl', label: 'Trade P&L', needs: ['entry', 'exit', 'lots'] },
  { tool: 'expectancy', label: 'System expectancy', needs: ['win rate', 'average win', 'average loss'] },
  { tool: 'kelly', label: 'Kelly fraction', needs: ['win rate', 'payoff ratio'] },
  { tool: 'drawdown_recovery', label: 'Drawdown recovery', needs: ['drawdown %'] },
  { tool: 'compound_growth', label: 'Compound growth projection', needs: ['principal or monthly', 'rate', 'years'] },
  { tool: 'loan_payment', label: 'Loan payment & total interest', needs: ['principal', 'rate', 'term'] },
  { tool: 'debt_payoff', label: 'Debt payoff time', needs: ['balance', 'APR', 'monthly payment'] },
  { tool: 'savings_goal', label: 'Savings goal plan', needs: ['target', 'months'] },
  { tool: 'emergency_fund', label: 'Emergency fund target', needs: ['monthly expenses'] },
  { tool: 'budget_split', label: '50/30/20 budget', needs: ['take-home pay'] },
  { tool: 'cagr', label: 'CAGR', needs: ['start value', 'end value', 'years'] },
  { tool: 'real_return', label: 'Inflation-adjusted return', needs: ['nominal rate', 'inflation rate'] },
  { tool: 'npv_irr', label: 'NPV & IRR', needs: ['investment', 'cash flows', 'discount rate'] },
  { tool: 'break_even', label: 'Business break-even', needs: ['fixed costs', 'price', 'variable cost'] },
  { tool: 'rule_of_72', label: 'Doubling time', needs: ['rate'] },
] as const;
