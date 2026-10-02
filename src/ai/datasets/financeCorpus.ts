/**
 * ANGEL Finance Knowledge Corpus.
 *
 * Structured, retrievable finance knowledge covering personal money management,
 * credit and debt, investing, markets, risk, derivatives, macro, accounting and
 * the statistics of edge. Every entry carries a definition, the formula where
 * one exists, a worked example with real arithmetic, and the mistake people
 * actually make.
 *
 * This is the grounding layer: when the model answers a money question it is
 * answering from these entries rather than from vibes, and when no model is
 * reachable the offline core answers directly out of this file.
 *
 * Nothing here is personalised financial advice — it is reference knowledge.
 */

export type FinanceDomain =
  | 'PERSONAL_FINANCE'
  | 'BUDGETING'
  | 'DEBT_CREDIT'
  | 'INVESTING'
  | 'RISK_MANAGEMENT'
  | 'TRADING'
  | 'DERIVATIVES'
  | 'FX_METALS'
  | 'MACRO'
  | 'ACCOUNTING'
  | 'STATISTICS'
  | 'PSYCHOLOGY'
  | 'TAX_INSURANCE';

export interface FinanceEntry {
  id: string;
  term: string;
  domain: FinanceDomain;
  /** Plain-language definition, one or two sentences. */
  definition: string;
  /** Formula in readable notation, when the concept has one. */
  formula?: string;
  /** Concrete worked example with real numbers. */
  example?: string;
  /** The common, expensive misunderstanding. */
  pitfall?: string;
  aliases?: string[];
  tags: string[];
}

export const FINANCE_ENTRIES: FinanceEntry[] = [
  /* ===================== PERSONAL FINANCE / BUDGETING ==================== */
  {
    id: 'f-net-worth',
    term: 'Net worth',
    domain: 'PERSONAL_FINANCE',
    definition:
      'Everything you own minus everything you owe. The single number that tracks whether your financial position is actually improving.',
    formula: 'Net worth = Total assets − Total liabilities',
    example:
      'Cash ₱80,000 + investments ₱250,000 + car ₱400,000 = ₱730,000 assets. Car loan ₱180,000 + card ₱45,000 = ₱225,000 liabilities. Net worth = ₱505,000.',
    pitfall:
      'Tracking income instead of net worth. A rising salary with rising debt can mean a falling net worth; income measures flow, net worth measures position.',
    aliases: ['equity', 'wealth'],
    tags: ['personal finance', 'tracking', 'balance sheet'],
  },
  {
    id: 'f-cashflow',
    term: 'Cash flow (personal)',
    domain: 'BUDGETING',
    definition:
      'Money in minus money out over a period. Positive cash flow is the only engine that funds savings, investing and debt payoff.',
    formula: 'Monthly surplus = Take-home income − (Fixed costs + Variable costs + Debt payments)',
    example:
      'Take-home ₱45,000. Rent ₱12,000, utilities ₱3,500, transport ₱4,000, food ₱9,000, loan ₱6,000, everything else ₱7,000 = ₱41,500. Surplus = ₱3,500/month = ₱42,000/year.',
    pitfall:
      'Budgeting against gross salary rather than take-home. Tax and contributions are not spendable, and the gap is typically 15-30%.',
    tags: ['budgeting', 'surplus', 'planning'],
  },
  {
    id: 'f-50-30-20',
    term: '50/30/20 rule',
    domain: 'BUDGETING',
    definition:
      'A starting allocation of take-home pay: 50% needs, 30% wants, 20% savings and debt payoff. A default to adjust from, not a law.',
    formula: 'Needs = 0.50 × net income; Wants = 0.30 × net income; Save/Debt = 0.20 × net income',
    example:
      'On ₱45,000 take-home: ₱22,500 needs, ₱13,500 wants, ₱9,000 to savings and extra debt payments.',
    pitfall:
      'In high-rent cities needs alone often exceed 50%. When that happens the fix is in the big three (housing, transport, debt), not in cutting coffee — the small categories cannot absorb a structural gap.',
    aliases: ['budget rule', 'balanced budget'],
    tags: ['budgeting', 'allocation', 'rule of thumb'],
  },
  {
    id: 'f-emergency-fund',
    term: 'Emergency fund',
    domain: 'PERSONAL_FINANCE',
    definition:
      'Cash reserved for genuine shocks — job loss, medical, urgent repair. It is sized against expenses, not income, and must be liquid and boring.',
    formula: 'Target = Monthly essential expenses × 3 to 6 (12 if income is irregular or self-employed)',
    example:
      'Essential expenses ₱28,000/month → starter goal ₱28,000, full goal ₱84,000-₱168,000. A freelancer with lumpy income should aim at the 9-12 month end.',
    pitfall:
      'Investing the emergency fund for yield. The point is availability at a bad moment; an emergency and a market drawdown tend to arrive together.',
    tags: ['safety net', 'liquidity', 'personal finance'],
  },
  {
    id: 'f-sinking-fund',
    term: 'Sinking fund',
    domain: 'BUDGETING',
    definition:
      'Money set aside monthly for a known, irregular future expense — insurance premium, tuition, annual registration — so it never becomes a crisis.',
    formula: 'Monthly set-aside = Expected cost ÷ Months until due',
    example:
      'Annual insurance ₱18,000 due in 9 months → ₱2,000/month. When the bill arrives it is already paid for.',
    pitfall:
      'Treating predictable annual costs as emergencies. They are not emergencies; they are scheduling failures.',
    tags: ['budgeting', 'planning', 'irregular expenses'],
  },
  {
    id: 'f-pay-yourself-first',
    term: 'Pay yourself first',
    domain: 'BUDGETING',
    definition:
      'Transfer savings on payday, before spending, rather than saving whatever survives the month.',
    example:
      'Automate ₱8,000 out on the 15th and 30th. Behaviourally this works because spending expands to fill the visible balance.',
    pitfall:
      'Setting the automated amount at an ambitious level and reversing it every month. A reliable ₱3,000 beats an aspirational ₱10,000 that gets clawed back.',
    tags: ['automation', 'savings', 'behaviour'],
  },
  {
    id: 'f-savings-rate',
    term: 'Savings rate',
    domain: 'PERSONAL_FINANCE',
    definition:
      'Share of take-home pay that is saved or invested. It drives time-to-financial-independence far more strongly than investment returns do.',
    formula: 'Savings rate = Amount saved ÷ Take-home income',
    example:
      'Saving ₱9,000 of ₱45,000 = 20%. At a 20% rate and 5% real returns, a portfolio covering your expenses takes roughly 36-37 years; at 50% it takes about 17.',
    pitfall:
      'Chasing an extra 1% of return while saving 5% of income. Raising the savings rate is both larger in effect and fully within your control.',
    tags: ['FIRE', 'savings', 'independence'],
  },

  /* ============================= DEBT & CREDIT ========================== */
  {
    id: 'f-apr',
    term: 'APR vs APY',
    domain: 'DEBT_CREDIT',
    definition:
      'APR is the annualised simple rate. APY (or EAR) includes the effect of compounding within the year, so it is the number you actually pay or earn.',
    formula: 'APY = (1 + APR/n)^n − 1, where n = compounding periods per year',
    example:
      'A card at 24% APR compounded monthly: APY = (1 + 0.24/12)^12 − 1 = 26.82%. The advertised 24% understates the real cost by nearly 3 points.',
    pitfall:
      'Comparing a loan quoted in APR against a deposit quoted in APY. Convert both to the same basis before comparing.',
    aliases: ['effective annual rate', 'EAR', 'nominal rate'],
    tags: ['interest', 'loans', 'compounding'],
  },
  {
    id: 'f-amortization',
    term: 'Loan amortisation',
    domain: 'DEBT_CREDIT',
    definition:
      'The schedule by which a fixed-payment loan is repaid. Early payments are mostly interest; principal repayment accelerates over time.',
    formula: 'Payment = P × r / (1 − (1 + r)^(−n)), where r = periodic rate, n = number of periods',
    example:
      '₱500,000 at 9% annual over 5 years: r = 0.0075/month, n = 60. Payment = ₱10,379/month. Total paid ₱622,740, of which ₱122,740 is interest.',
    pitfall:
      'Assuming halfway through the term means half the principal is gone. On a 30-year mortgage at 7%, you cross 50% principal repaid around year 21.',
    aliases: ['monthly payment', 'installment'],
    tags: ['loans', 'mortgage', 'formula'],
  },
  {
    id: 'f-avalanche-snowball',
    term: 'Debt avalanche vs snowball',
    domain: 'DEBT_CREDIT',
    definition:
      'Avalanche pays the highest interest rate first and is mathematically optimal. Snowball pays the smallest balance first and is psychologically easier.',
    example:
      'Debts: ₱8,000 at 6%, ₱40,000 at 24%, ₱15,000 at 12%. Avalanche order: 24% → 12% → 6%. Snowball order: ₱8,000 → ₱15,000 → ₱40,000. Over a typical payoff the avalanche saves perhaps 5-15% of total interest.',
    pitfall:
      'Choosing avalanche on paper, losing motivation after four months, and paying nothing extra at all. The plan you finish beats the plan that is optimal.',
    tags: ['debt payoff', 'strategy', 'behaviour'],
  },
  {
    id: 'f-min-payment-trap',
    term: 'Minimum payment trap',
    domain: 'DEBT_CREDIT',
    definition:
      'Credit card minimums are set as a small percentage of the balance, which keeps the debt alive for decades while interest compounds.',
    example:
      '₱50,000 at 24% APR paying only the 3% minimum: payoff takes roughly 16 years and costs about ₱48,000 in interest. Paying a flat ₱2,500/month clears it in about 26 months for roughly ₱13,000 interest.',
    pitfall:
      'Believing the minimum is the "required" amount in any meaningful sense. It is the lender\'s optimal payment, not yours.',
    tags: ['credit card', 'interest', 'payoff'],
  },
  {
    id: 'f-dti',
    term: 'Debt-to-income ratio (DTI)',
    domain: 'DEBT_CREDIT',
    definition:
      'Total monthly debt payments divided by gross monthly income. Lenders use it to judge capacity; it is also a reasonable personal warning light.',
    formula: 'DTI = Monthly debt payments ÷ Gross monthly income',
    example:
      'Payments ₱18,000 on gross ₱60,000 → DTI = 30%. Below 36% is generally comfortable, above 43% blocks most conventional mortgage approvals.',
    pitfall:
      'Excluding the debts that do not show on a credit report. Family loans and informal debt still consume the same cash flow.',
    tags: ['credit', 'ratio', 'lending'],
  },
  {
    id: 'f-credit-utilisation',
    term: 'Credit utilisation',
    domain: 'DEBT_CREDIT',
    definition:
      'Share of available revolving credit currently used. A large input into credit scores, typically second only to payment history.',
    formula: 'Utilisation = Balance ÷ Credit limit',
    example:
      '₱30,000 balance on a ₱100,000 limit = 30%. Scoring models generally favour keeping this under 30%, and under 10% is better still.',
    pitfall:
      'Paying the full balance after the statement cuts. The reported figure is the statement balance, so the card can report 80% utilisation even when it is never carried.',
    tags: ['credit score', 'cards'],
  },
  {
    id: 'f-good-bad-debt',
    term: 'Productive vs consumptive debt',
    domain: 'DEBT_CREDIT',
    definition:
      'Productive debt buys something that generates income or appreciates (education, a business asset, arguably a home). Consumptive debt funds depreciating consumption.',
    example:
      'A ₱200,000 loan at 8% for equipment yielding ₱90,000/year of additional income is productive. The same ₱200,000 at 8% for a holiday is not, regardless of how worthwhile the holiday was.',
    pitfall:
      'The label does not override the rate. Productive debt at 30% is still usually a bad trade.',
    tags: ['debt', 'framework'],
  },

  /* =============================== INVESTING ============================ */
  {
    id: 'f-compound-interest',
    term: 'Compound interest',
    domain: 'INVESTING',
    definition:
      'Returns earned on previous returns. The dominant force in long-horizon outcomes, and the reason time in the market beats timing.',
    formula: 'FV = PV × (1 + r)^n;  with regular contributions: FV = PMT × [((1+r)^n − 1) / r]',
    example:
      '₱10,000/month at 8% annual (0.6667% monthly) for 20 years: FV ≈ ₱5.89 million from ₱2.4 million contributed. ₱3.49 million is compounding.',
    pitfall:
      'Using nominal returns for long projections and forgetting inflation. At 3% inflation, ₱5.89 million in 20 years buys roughly ₱3.26 million of today\'s goods.',
    aliases: ['compounding', 'future value'],
    tags: ['investing', 'formula', 'growth'],
  },
  {
    id: 'f-rule-72',
    term: 'Rule of 72',
    domain: 'INVESTING',
    definition: 'A mental shortcut for doubling time at a given compounded rate.',
    formula: 'Years to double ≈ 72 ÷ annual return %',
    example:
      'At 8%: 72/8 = 9 years to double. At 24% card interest, the debt doubles in 3 years if untouched.',
    pitfall: 'It drifts above roughly 20% per period. At very high rates use the exact logarithm.',
    tags: ['shortcut', 'compounding'],
  },
  {
    id: 'f-cagr',
    term: 'CAGR (compound annual growth rate)',
    domain: 'INVESTING',
    definition:
      'The constant annual rate that would take a starting value to an ending value over a period. The correct way to compare multi-year performance.',
    formula: 'CAGR = (Ending ÷ Beginning)^(1 ÷ years) − 1',
    example:
      '₱100,000 grows to ₱180,000 over 5 years: (1.8)^(1/5) − 1 = 12.47% per year.',
    pitfall:
      'Averaging annual returns arithmetically. +50% then −50% averages to 0% but leaves you down 25%; CAGR correctly reports −13.4%.',
    aliases: ['annualised return', 'geometric return'],
    tags: ['returns', 'formula', 'performance'],
  },
  {
    id: 'f-real-return',
    term: 'Real vs nominal return',
    domain: 'INVESTING',
    definition:
      'Nominal return is the headline number. Real return subtracts inflation and is what your purchasing power actually did.',
    formula: 'Real return = ((1 + nominal) ÷ (1 + inflation)) − 1',
    example:
      '7% nominal with 4% inflation: (1.07/1.04) − 1 = 2.88% real. The quick subtraction (3%) slightly overstates it.',
    pitfall:
      'Celebrating a 5% savings account during 6% inflation. That is a guaranteed loss of about 0.94% a year in real terms.',
    tags: ['inflation', 'returns'],
  },
  {
    id: 'f-diversification',
    term: 'Diversification',
    domain: 'INVESTING',
    definition:
      'Holding assets whose returns are not perfectly correlated, which reduces portfolio volatility without proportionally reducing expected return.',
    formula: 'Portfolio variance = Σ wᵢ wⱼ σᵢ σⱼ ρᵢⱼ',
    example:
      'Two assets each with 20% volatility and 0.2 correlation, equally weighted: portfolio volatility = √(0.5²·0.04 + 0.5²·0.04 + 2·0.5·0.5·0.2·0.04) ≈ 15.5%, not 20%.',
    pitfall:
      'Owning eight funds that all hold the same large-cap index. Count exposures, not line items — and note that correlations rise toward 1 in crashes, exactly when diversification is needed.',
    tags: ['portfolio', 'risk', 'correlation'],
  },
  {
    id: 'f-dca',
    term: 'Dollar-cost averaging (DCA)',
    domain: 'INVESTING',
    definition:
      'Investing a fixed amount at fixed intervals regardless of price, which buys more units when prices are low.',
    example:
      '₱5,000/month into a fund priced at 100, 80, 125, 90: buys 50 + 62.5 + 40 + 55.6 = 208.1 units for ₱20,000, average cost ₱96.1 versus a simple price average of ₱98.75.',
    pitfall:
      'Treating DCA as return-maximising. Historically, lump-sum investing beats DCA about two-thirds of the time; DCA is a regret-and-behaviour tool, which is still a legitimate reason to use it.',
    aliases: ['cost averaging', 'periodic investing'],
    tags: ['investing', 'strategy', 'behaviour'],
  },
  {
    id: 'f-expense-ratio',
    term: 'Expense ratio',
    domain: 'INVESTING',
    definition:
      'Annual percentage of assets deducted by a fund. Small-looking numbers compound into very large amounts.',
    formula: 'Annual fee drag = Portfolio value × expense ratio',
    example:
      '₱5,000,000 at 1.5% = ₱75,000/year versus 0.1% = ₱5,000/year. Over 25 years at 8% gross, that 1.4% gap consumes roughly 30% of the final balance.',
    pitfall:
      'Comparing fees to returns in a good year. Fees are certain and returns are not, so fee differences are the highest-confidence edge available to a retail investor.',
    tags: ['fees', 'funds', 'costs'],
  },
  {
    id: 'f-asset-allocation',
    term: 'Asset allocation',
    domain: 'INVESTING',
    definition:
      'The split of a portfolio between asset classes. Historically it explains the large majority of return variability over time — far more than security selection.',
    example:
      'A 60/40 equity/bond portfolio has historically produced roughly 7-8% nominal with a worst-year drawdown near −30%, versus 100% equity at roughly 9-10% with worst-year drawdowns beyond −50%.',
    pitfall:
      'Choosing allocation by desired return rather than by tolerable drawdown. The allocation only works if you can hold it through the bad year.',
    tags: ['portfolio', 'strategy', 'risk'],
  },
  {
    id: 'f-rebalancing',
    term: 'Rebalancing',
    domain: 'INVESTING',
    definition:
      'Periodically returning a portfolio to its target weights, which mechanically sells what has risen and buys what has fallen.',
    example:
      'Target 60/40 drifts to 70/30 after a strong equity year. Rebalancing sells 10 points of equity back into bonds.',
    pitfall:
      'Rebalancing too often in taxable accounts. Annual or 5-percentage-point-band rebalancing captures most of the benefit with far less tax and cost drag.',
    tags: ['portfolio', 'discipline'],
  },
  {
    id: 'f-npv-irr',
    term: 'NPV and IRR',
    domain: 'INVESTING',
    definition:
      'NPV discounts future cash flows to today at a required rate; positive NPV means the project beats that hurdle. IRR is the discount rate that sets NPV to zero.',
    formula: 'NPV = Σ CFₜ ÷ (1 + r)^t − initial investment',
    example:
      'Invest ₱100,000, receive ₱40,000/year for 3 years, hurdle 10%: NPV = 36,364 + 33,058 + 30,053 − 100,000 = −₱525. Marginally fails the 10% hurdle; IRR ≈ 9.7%.',
    pitfall:
      'Ranking mutually exclusive projects by IRR. IRR ignores scale — a 60% IRR on ₱10,000 creates less value than a 15% IRR on ₱1,000,000.',
    tags: ['valuation', 'capital budgeting', 'formula'],
  },
  {
    id: 'f-dividend-yield',
    term: 'Dividend yield',
    domain: 'INVESTING',
    definition: 'Annual dividend per share divided by current share price.',
    formula: 'Yield = Annual dividend per share ÷ Price per share',
    example: '₱4.50 annual dividend on a ₱75 share = 6% yield.',
    pitfall:
      'Yield chasing. A yield that jumps because the price collapsed often signals a dividend about to be cut — check the payout ratio and free cash flow before buying the yield.',
    tags: ['equities', 'income'],
  },

  /* ============================ RISK MANAGEMENT ========================= */
  {
    id: 'f-position-sizing',
    term: 'Position sizing',
    domain: 'RISK_MANAGEMENT',
    definition:
      'Choosing trade size so that a loss at your stop costs a predetermined fraction of the account. The single highest-leverage control a trader has.',
    formula: 'Units = (Account × risk %) ÷ (Stop distance × value per unit of price)',
    example:
      '$10,000 account, 1% risk = $100. XAU/USD stop 2.50 away. One standard lot (100 oz) loses $100 per $1 move, so a $2.50 stop costs $250/lot. Size = 100 ÷ 250 = 0.4 lots.',
    pitfall:
      'Choosing the size first and the stop second. That inverts the logic and makes risk a function of conviction, which is exactly when it is least reliable.',
    aliases: ['lot size', 'trade size', 'risk per trade'],
    tags: ['risk', 'formula', 'trading'],
  },
  {
    id: 'f-risk-of-ruin',
    term: 'Risk of ruin',
    domain: 'RISK_MANAGEMENT',
    definition:
      'Probability of losing enough capital to be unable to continue, given a win rate, payoff ratio and risk per trade.',
    formula: 'For fixed fractional risk f, approximate ruin risk ≈ ((1 − edge) ÷ (1 + edge))^(capital units), edge = 2p − 1 for even-money bets',
    example:
      'At 55% win rate, even money, risking 1% per trade: ruin risk is effectively negligible. At 5% per trade the same edge produces a meaningful chance of a −40% drawdown inside 250 trades.',
    pitfall:
      'Assuming a positive edge makes ruin impossible. Position size, not edge, determines survival; a good edge with bad sizing still ends at zero.',
    tags: ['risk', 'survival', 'probability'],
  },
  {
    id: 'f-drawdown',
    term: 'Drawdown and recovery maths',
    domain: 'RISK_MANAGEMENT',
    definition:
      'Peak-to-trough decline in equity. Recovery is asymmetric: losses require disproportionately larger gains to undo.',
    formula: 'Required gain = (1 ÷ (1 − drawdown)) − 1',
    example:
      '−10% needs +11.1%. −25% needs +33.3%. −50% needs +100%. −80% needs +400%.',
    pitfall:
      'Treating a 50% drawdown as "half way back". It is a quarter of the way back in effort terms, and it is the point at which most accounts are abandoned.',
    aliases: ['max drawdown', 'recovery'],
    tags: ['risk', 'asymmetry', 'formula'],
  },
  {
    id: 'f-expectancy',
    term: 'Expectancy',
    domain: 'STATISTICS',
    definition:
      'Average profit or loss per trade implied by a win rate and payoff ratio. The number that determines whether a system makes money at all.',
    formula: 'Expectancy = (Win rate × Average win) − (Loss rate × Average loss)',
    example:
      '45% win rate, average win $300, average loss $120: (0.45 × 300) − (0.55 × 120) = 135 − 66 = +$69 per trade. Over 200 trades that is +$13,800 before costs.',
    pitfall:
      'Optimising win rate in isolation. A 90% win rate with a 1:10 reverse payoff is a losing system; a 35% win rate at 1:4 is a strong one.',
    aliases: ['edge', 'average trade'],
    tags: ['statistics', 'edge', 'formula'],
  },
  {
    id: 'f-kelly',
    term: 'Kelly criterion',
    domain: 'STATISTICS',
    definition:
      'The bet fraction that maximises long-run logarithmic growth. Useful as a ceiling, not as a setting.',
    formula: 'f* = (bp − q) ÷ b, where b = payoff ratio, p = win probability, q = 1 − p',
    example:
      'p = 0.55, b = 2: f* = (2×0.55 − 0.45)/2 = 0.325 → 32.5% of capital. Practitioners use a quarter to a half of this, so 8-16%, and discretionary traders typically far less.',
    pitfall:
      'Betting full Kelly with estimated rather than known probabilities. Kelly is brutally sensitive to overestimated edge, and overestimating edge is the normal human condition.',
    tags: ['sizing', 'probability', 'formula'],
  },
  {
    id: 'f-rr-ratio',
    term: 'Risk–reward ratio (R multiple)',
    domain: 'RISK_MANAGEMENT',
    definition:
      'Potential profit expressed in units of the amount risked. "R" is the distance from entry to stop.',
    formula: 'R:R = (Target − Entry) ÷ (Entry − Stop);  break-even win rate = 1 ÷ (1 + R:R)',
    example:
      'Entry 2,650, stop 2,642, target 2,674: risk 8, reward 24, R:R = 1:3. Break-even win rate = 1/4 = 25%.',
    pitfall:
      'Quoting a 1:5 ratio that the market reaches 8% of the time. A ratio is only meaningful alongside the realised hit rate for that target.',
    aliases: ['reward to risk', 'R multiple'],
    tags: ['trading', 'formula', 'risk'],
  },
  {
    id: 'f-correlation-risk',
    term: 'Correlated position risk',
    domain: 'RISK_MANAGEMENT',
    definition:
      'Multiple positions driven by the same factor are one position wearing several names. Total risk is not the sum of the labels.',
    example:
      'Long XAU/USD, long XAG/USD and short USD/CHF at 1% each is closer to a 2.5-3% bet on a weaker dollar than three independent 1% trades.',
    pitfall:
      'Counting a risk limit per ticket instead of per factor. Portfolio heat should be measured against the underlying driver.',
    tags: ['correlation', 'portfolio heat', 'risk'],
  },
  {
    id: 'f-var',
    term: 'Value at Risk (VaR)',
    domain: 'RISK_MANAGEMENT',
    definition:
      'The loss threshold that will not be exceeded with a given probability over a given horizon.',
    formula: 'Parametric VaR = Portfolio value × z × σ × √t  (z ≈ 1.65 at 95%, 2.33 at 99%)',
    example:
      '$100,000 portfolio, 1.2% daily volatility, 95% 1-day VaR = 100,000 × 1.65 × 0.012 = $1,980.',
    pitfall:
      'Reading VaR as a worst case. It explicitly says nothing about the size of losses beyond the threshold — that is what expected shortfall is for, and tails are fatter than the normal assumption implies.',
    tags: ['risk', 'statistics', 'formula'],
  },

  /* ================================ TRADING ============================= */
  {
    id: 'f-pip-value-gold',
    term: 'Pip and tick value (XAU/USD)',
    domain: 'FX_METALS',
    definition:
      'Gold is quoted per troy ounce. A standard lot is 100 oz, so each $1.00 of price movement is $100 per lot. Most brokers call $0.01 one pip, giving $1 per pip per standard lot.',
    formula: 'P&L = (Exit − Entry) × 100 × lots',
    example:
      '0.40 lots from 2,650.00 to 2,656.50 = 6.50 × 100 × 0.40 = $260.',
    pitfall:
      'Applying the EUR/USD $10-per-pip convention to gold. The conventions differ by instrument and contract size, and this single error routinely produces 10x oversizing.',
    aliases: ['pip value', 'contract size', 'tick value'],
    tags: ['gold', 'xauusd', 'calculation'],
  },
  {
    id: 'f-spread-cost',
    term: 'Spread and commission cost',
    domain: 'TRADING',
    definition:
      'The bid-ask spread plus commission is paid on every round trip and is the most reliably negative number in trading.',
    formula: 'Round-trip cost = (Spread × value per point × lots) + commission',
    example:
      'Gold spread of $0.35 on 0.4 lots = 0.35 × 100 × 0.4 = $14 per round trip. At 20 trades a week that is $280/week, roughly $14,500 a year.',
    pitfall:
      'Scalping a $2 target through a $0.35 spread. Costs consume 17.5% of the gross target before the trade has a chance.',
    tags: ['costs', 'execution', 'scalping'],
  },
  {
    id: 'f-leverage-margin',
    term: 'Leverage and margin',
    domain: 'TRADING',
    definition:
      'Leverage is borrowed exposure. Margin is the collateral held against it. Leverage changes position size capacity; it does not change risk per trade unless you let it.',
    formula: 'Required margin = (Contract size × price × lots) ÷ leverage',
    example:
      '0.4 lots of gold at 2,650 with 1:100 leverage: (100 × 2,650 × 0.4)/100 = $1,060 margin for $106,000 of exposure.',
    pitfall:
      'Treating available margin as a position-size recommendation. Margin tells you what the broker permits; your stop distance and risk limit tell you what is sane.',
    tags: ['leverage', 'margin', 'brokers'],
  },
  {
    id: 'f-slippage',
    term: 'Slippage',
    domain: 'TRADING',
    definition:
      'Difference between the expected fill price and the actual fill. Widens with volatility, thin liquidity, and market orders.',
    example:
      'Stop at 2,642 triggered during an NFP release fills at 2,639.40 — 2.60 of extra loss, which is 32% more than the planned risk on an 8-point stop.',
    pitfall:
      'Backtesting at mid price with no slippage. For intraday systems this alone frequently turns a profitable backtest into a losing live account.',
    tags: ['execution', 'costs', 'backtesting'],
  },
  {
    id: 'f-swap',
    term: 'Swap / overnight financing',
    domain: 'TRADING',
    definition:
      'Interest credited or debited for holding a leveraged position past the daily rollover, derived from the interest rate differential plus a broker markup.',
    example:
      'A short gold position may earn a small positive swap while a long pays; triple swap is usually charged on Wednesday to cover the weekend.',
    pitfall:
      'Ignoring swap in a multi-week position. On a large leveraged position financing can quietly exceed the expected profit.',
    aliases: ['rollover', 'carry', 'financing'],
    tags: ['costs', 'carry'],
  },
  {
    id: 'f-atr',
    term: 'Average True Range (ATR)',
    domain: 'TRADING',
    definition:
      'Average of the true range over N bars, where true range accounts for gaps. A volatility measure, with no directional information.',
    formula: 'TR = max(High − Low, |High − PrevClose|, |Low − PrevClose|); ATR = N-period average of TR',
    example:
      'With an H1 ATR of 4.20 on gold, a 2-point stop sits inside one hour of normal noise and will be hit by randomness alone.',
    pitfall:
      'Using a fixed pip stop across regimes. The same 25-pip stop is generous in a quiet Asian session and meaningless during CPI.',
    tags: ['volatility', 'indicator', 'stops'],
  },
  {
    id: 'f-sharpe',
    term: 'Sharpe ratio',
    domain: 'STATISTICS',
    definition:
      'Excess return per unit of volatility. The standard, flawed, universally used measure of risk-adjusted return.',
    formula: 'Sharpe = (Rp − Rf) ÷ σp,  annualised by × √periods per year',
    example:
      'Strategy returns 18% with 12% volatility, risk-free 4%: (0.18 − 0.04)/0.12 = 1.17.',
    pitfall:
      'Sharpe penalises upside volatility identically to downside and rewards strategies that sell tail risk — options sellers show excellent Sharpe right up until they do not. Pair it with max drawdown and Sortino.',
    tags: ['performance', 'risk-adjusted', 'formula'],
  },
  {
    id: 'f-profit-factor',
    term: 'Profit factor',
    domain: 'STATISTICS',
    definition: 'Gross profit divided by gross loss. Above 1.0 is profitable before costs.',
    formula: 'Profit factor = Σ winning trades ÷ |Σ losing trades|',
    example: 'Wins total $8,400, losses total $5,600 → 1.50. Each dollar lost produced $1.50 gained.',
    pitfall:
      'A profit factor computed on fewer than ~100 trades, or one dominated by a single outlier trade, is noise. Recompute after removing the best trade and see what survives.',
    tags: ['performance', 'backtesting'],
  },
  {
    id: 'f-overfitting',
    term: 'Overfitting / curve fitting',
    domain: 'STATISTICS',
    definition:
      'Tuning a strategy until it describes historical noise rather than a repeatable effect. The default outcome of unconstrained optimisation.',
    example:
      'Testing 500 parameter combinations and keeping the best will, on pure noise, produce an apparently excellent system. With 500 trials you expect several "significant" results at p < 0.01 by chance.',
    pitfall:
      'Reporting in-sample results as if they were expectations. Hold out data, limit parameters, and prefer results that stay positive across neighbouring parameter values.',
    aliases: ['curve fitting', 'data mining bias'],
    tags: ['backtesting', 'statistics', 'rigour'],
  },

  /* ============================== DERIVATIVES =========================== */
  {
    id: 'f-call-put',
    term: 'Call and put options',
    domain: 'DERIVATIVES',
    definition:
      'A call is the right to buy at the strike; a put is the right to sell at the strike. The buyer pays a premium and risks only that premium; the seller receives it and takes on the obligation.',
    formula: 'Call payoff at expiry = max(S − K, 0) − premium;  Put payoff = max(K − S, 0) − premium',
    example:
      'Buy a 2,700 call for $18 with gold at 2,650. At expiry at 2,740: payoff = 40 − 18 = +$22 per unit. At 2,690: −$18.',
    pitfall:
      'Buying short-dated out-of-the-money options as a cheap directional bet. You need the direction, the magnitude and the timing all correct, and time decay charges you daily for being early.',
    tags: ['options', 'derivatives'],
  },
  {
    id: 'f-greeks',
    term: 'Option greeks',
    domain: 'DERIVATIVES',
    definition:
      'Sensitivities of option price: delta (to underlying), gamma (to delta), theta (to time), vega (to implied volatility), rho (to rates).',
    example:
      'A 0.45 delta call gains about $0.45 per $1 of underlying. Theta of −0.35 costs about $0.35 a day. Vega of 0.12 means +1 volatility point adds about $0.12.',
    pitfall:
      'Watching delta only. A long gamma position changes exposure as the market moves, so a position that was neutral this morning can be strongly directional by the afternoon.',
    tags: ['options', 'risk', 'derivatives'],
  },
  {
    id: 'f-implied-vol',
    term: 'Implied volatility',
    domain: 'DERIVATIVES',
    definition:
      'The volatility input that makes a pricing model return the traded option price — the market\'s expectation of future movement, not a measurement of the past.',
    example:
      'Gold options at 16% IV imply a roughly 16% annualised move, about 1% daily (16% ÷ √252).',
    pitfall:
      'Buying options into a known event. IV is already elevated; the post-event collapse ("vol crush") can lose money even when the direction is correct.',
    tags: ['options', 'volatility'],
  },
  {
    id: 'f-gex',
    term: 'Gamma exposure (GEX)',
    domain: 'DERIVATIVES',
    definition:
      'Aggregate dealer gamma positioning. When dealers are net long gamma they hedge against the move and dampen volatility; when net short they hedge with the move and amplify it.',
    example:
      'Large positive GEX near a strike tends to pin price toward it into expiry. Below the "flip" level into negative GEX, the same move size travels further.',
    pitfall:
      'Treating GEX as a signal by itself. It describes a volatility regime and a mechanical flow, not a direction.',
    tags: ['options', 'market structure', 'flow'],
  },
  {
    id: 'f-futures-contango',
    term: 'Contango and backwardation',
    domain: 'DERIVATIVES',
    definition:
      'Contango is a futures curve priced above spot (typical for gold, reflecting storage and financing). Backwardation is the inverse and usually signals physical scarcity.',
    formula: 'Fair futures price ≈ Spot × e^((r + storage − convenience yield) × t)',
    example:
      'Spot 2,650, 3-month rate 5%, storage 0.3%: fair future ≈ 2,650 × e^(0.053×0.25) ≈ 2,685.',
    pitfall:
      'Holding a long position in a rolling contango futures product and expecting it to track spot. Roll cost quietly erodes returns every expiry.',
    tags: ['futures', 'curve', 'carry'],
  },

  /* ============================== FX & METALS =========================== */
  {
    id: 'f-gold-drivers',
    term: 'What actually moves gold',
    domain: 'FX_METALS',
    definition:
      'In rough order of influence: real interest rates (inverse), the dollar (inverse), central bank buying, ETF flows, and crisis demand.',
    example:
      'Gold typically weakens as 10-year TIPS yields rise, because the opportunity cost of holding a non-yielding asset increases. The relationship held closely for two decades and loosened notably in 2022-2024 as official-sector buying became dominant.',
    pitfall:
      'Trading gold off headline CPI alone. The mechanism runs through real yields and rate expectations, so a hot CPI that raises nominal yields more than inflation expectations is bearish for gold, not bullish.',
    tags: ['gold', 'macro', 'drivers'],
  },
  {
    id: 'f-dxy',
    term: 'US Dollar Index (DXY)',
    domain: 'FX_METALS',
    definition:
      'A trade-weighted basket of the dollar against six currencies, dominated by the euro at roughly 58% weight.',
    example:
      'DXY rising 1% on euro weakness alone does not necessarily imply broad dollar strength against Asian currencies or metals.',
    pitfall:
      'Using DXY as "the dollar". For gold the broader trade-weighted dollar and real yields are usually the better reference.',
    tags: ['fx', 'index', 'macro'],
  },
  {
    id: 'f-carry-trade',
    term: 'Carry trade',
    domain: 'FX_METALS',
    definition:
      'Borrowing in a low-yielding currency to hold a high-yielding one, earning the rate differential while taking exchange-rate risk.',
    example:
      'A 4% differential earns roughly 0.33% a month in carry, which a single 5% adverse currency move erases in a day.',
    pitfall:
      'Carry trades have a characteristic return profile: small steady gains punctuated by violent unwinds. Sizing based on the quiet period is how the unwind becomes terminal.',
    tags: ['fx', 'strategy', 'rates'],
  },
  {
    id: 'f-session-liquidity',
    term: 'Session liquidity (FX/metals)',
    domain: 'FX_METALS',
    definition:
      'Volume and range concentrate in the London session and the London–New York overlap; the Asian session is typically the quiet range-building period.',
    example:
      'Gold commonly builds a tight Asian range, sweeps one side of it near the London open, then expands in the direction of the opposing liquidity.',
    pitfall:
      'Applying the same stop distance and target across sessions. The same 25-pip stop means very different things at 02:00 and 14:30 UTC.',
    tags: ['sessions', 'liquidity', 'intraday'],
  },

  /* ================================= MACRO ============================== */
  {
    id: 'f-cpi',
    term: 'CPI and inflation measures',
    domain: 'MACRO',
    definition:
      'CPI tracks the price of a consumer basket. Core CPI strips food and energy to show the persistent trend; markets usually react more to core and to the month-over-month figure than to the headline year-over-year.',
    example:
      'Headline falling while core stays sticky at 0.4% month-over-month implies about 4.9% annualised — a hawkish combination despite a friendly headline.',
    pitfall:
      'Reacting to the year-over-year number. Base effects from twelve months ago can move it without anything happening in the current month.',
    tags: ['inflation', 'data', 'macro'],
  },
  {
    id: 'f-yield-curve',
    term: 'Yield curve and inversion',
    domain: 'MACRO',
    definition:
      'The relationship between bond yields and maturities. Inversion — short yields above long — has preceded most modern US recessions, though with highly variable lead times.',
    example:
      'The 2s10s spread inverting in 2022 preceded no recession through 2024, illustrating that the signal has a long and unreliable lag.',
    pitfall:
      'Trading an inversion as a timing signal. Historical lead times have ranged from 6 to 24 months — useless for positioning, useful for context.',
    tags: ['bonds', 'recession', 'macro'],
  },
  {
    id: 'f-real-yields',
    term: 'Real yields',
    domain: 'MACRO',
    definition:
      'Nominal yield minus expected inflation, observable directly in inflation-protected securities (TIPS). The key macro variable for non-yielding assets.',
    formula: 'Real yield ≈ Nominal yield − Breakeven inflation rate',
    example:
      '10-year nominal at 4.3% with 2.3% breakeven implies a 2.0% real yield — a meaningful opportunity cost for holding gold.',
    pitfall:
      'Watching nominal yields alone. Rising nominal yields driven purely by rising inflation expectations leave real yields unchanged and are not automatically bearish for metals.',
    tags: ['rates', 'tips', 'gold'],
  },
  {
    id: 'f-nfp',
    term: 'Non-farm payrolls (NFP)',
    domain: 'MACRO',
    definition:
      'Monthly US employment change, released the first Friday of each month at 13:30 UTC. Historically the highest-volatility scheduled FX and metals event.',
    example:
      'Spreads routinely widen several times over in the seconds around the release and stops can slip well beyond their level.',
    pitfall:
      'Holding tight-stopped intraday positions through the release. The direction may be right and the stop still taken out by the spike.',
    tags: ['events', 'volatility', 'calendar'],
  },
  {
    id: 'f-central-bank-rates',
    term: 'Policy rates and the market reaction function',
    domain: 'MACRO',
    definition:
      'Markets price expected policy paths, not current levels. The move happens on the difference between the decision and what was already priced.',
    example:
      'A 25bp hike when 25bp was fully priced can weaken the currency if the accompanying statement softens the forward guidance.',
    pitfall:
      'Trading the decision instead of the surprise. Check the implied path in rate futures before assuming a hike is bullish.',
    tags: ['central banks', 'rates', 'expectations'],
  },

  /* =============================== ACCOUNTING =========================== */
  {
    id: 'f-three-statements',
    term: 'The three financial statements',
    domain: 'ACCOUNTING',
    definition:
      'Income statement shows profitability over a period, balance sheet shows position at a moment, cash flow statement shows actual cash movement. They articulate: net income flows to equity, and cash flow reconciles profit to cash.',
    example:
      'A company can report ₱50M net income and still run out of cash if receivables grew ₱70M — profit is an accrual concept, solvency is a cash concept.',
    pitfall:
      'Reading the income statement alone. Companies fail from the cash flow statement, not from the income statement.',
    tags: ['accounting', 'fundamentals'],
  },
  {
    id: 'f-free-cash-flow',
    term: 'Free cash flow',
    domain: 'ACCOUNTING',
    definition: 'Cash from operations minus capital expenditure — what is genuinely available to owners and creditors.',
    formula: 'FCF = Operating cash flow − Capital expenditures',
    example: 'Operating cash flow ₱120M, capex ₱45M → FCF ₱75M.',
    pitfall:
      'Using EBITDA as a cash proxy. EBITDA excludes capex, working capital and interest — for a capital-intensive business it can be roughly double real cash generation.',
    tags: ['valuation', 'cash', 'accounting'],
  },
  {
    id: 'f-working-capital',
    term: 'Working capital',
    domain: 'ACCOUNTING',
    definition: 'Current assets minus current liabilities — the short-term liquidity cushion of an operating business.',
    formula: 'Working capital = Current assets − Current liabilities',
    example: 'Current assets ₱8.4M, current liabilities ₱5.1M → ₱3.3M, a current ratio of 1.65.',
    pitfall:
      'Assuming more is always better. Bloated working capital frequently means slow-moving inventory or receivables that will not be collected.',
    tags: ['liquidity', 'operations', 'accounting'],
  },
  {
    id: 'f-unit-economics',
    term: 'Unit economics',
    domain: 'ACCOUNTING',
    definition:
      'Contribution per unit sold or per customer served, before fixed costs. Determines whether growth helps or accelerates failure.',
    formula: 'Contribution margin = Price − Variable cost per unit;  Break-even units = Fixed costs ÷ Contribution margin',
    example:
      'Price ₱450, variable cost ₱280 → contribution ₱170. Fixed costs ₱85,000/month → break-even 500 units per month.',
    pitfall:
      'Scaling a negative contribution margin. Every additional sale increases the loss; volume cannot fix it.',
    tags: ['business', 'break-even', 'formula'],
  },

  /* ============================ TAX & INSURANCE ========================= */
  {
    id: 'f-marginal-rate',
    term: 'Marginal vs effective tax rate',
    domain: 'TAX_INSURANCE',
    definition:
      'The marginal rate applies to the next unit of income; the effective rate is total tax divided by total income. Progressive brackets mean the effective rate is always lower.',
    example:
      'Crossing into a 30% bracket taxes only the income above the threshold at 30%. Someone "in the 30% bracket" may have an effective rate near 18%.',
    pitfall:
      'Refusing a raise or extra work to "stay in a lower bracket". Only the incremental income is taxed at the higher rate — you never lose money by earning more under a progressive system.',
    tags: ['tax', 'misconception'],
  },
  {
    id: 'f-insurance-purpose',
    term: 'What insurance is for',
    domain: 'TAX_INSURANCE',
    definition:
      'Transferring low-probability, high-severity losses you cannot absorb. It is not an investment and not for small predictable costs.',
    example:
      'Insure the house, the income and the catastrophic medical event. Self-insure the phone screen — the premium exceeds the expected loss by the insurer\'s margin.',
    pitfall:
      'Buying bundled investment-and-insurance products. Separating term coverage from investing is usually cheaper and clearer on both sides.',
    tags: ['insurance', 'risk transfer'],
  },

  /* ============================== PSYCHOLOGY ============================ */
  {
    id: 'f-loss-aversion',
    term: 'Loss aversion and the disposition effect',
    domain: 'PSYCHOLOGY',
    definition:
      'Losses register roughly twice as strongly as equivalent gains, which pushes people to cut winners early and hold losers long.',
    example:
      'The pattern shows up as an average win far smaller than the average loss despite a high win rate — the classic account that is right often and still bleeds.',
    pitfall:
      'Trying to fix it with willpower. The durable fix is structural: predefined exits set before entry, when no position is on.',
    tags: ['behaviour', 'bias', 'trading'],
  },
  {
    id: 'f-sunk-cost',
    term: 'Sunk cost fallacy',
    domain: 'PSYCHOLOGY',
    definition:
      'Continuing to commit resources because of what has already been spent, which is irrecoverable and therefore irrelevant to the next decision.',
    example:
      '"I have already lost ₱40,000 on this position, I cannot close it now." The ₱40,000 is gone either way; the only question is whether you would open this position today at this price.',
    pitfall:
      'The same logic traps people in courses, businesses and relationships. The test is always: would I start this today, knowing what I know?',
    tags: ['bias', 'decision making'],
  },
  {
    id: 'f-recency-bias',
    term: 'Recency bias',
    domain: 'PSYCHOLOGY',
    definition:
      'Overweighting recent outcomes when estimating probability — a five-trade streak feels like evidence about the system when it is well within noise.',
    example:
      'At a 55% win rate, a run of five consecutive wins occurs roughly 5% of the time by chance. Over 200 trades, several such runs are expected.',
    pitfall:
      'Increasing size after a streak and cutting it after a drawdown — mechanically buying high and selling low on your own edge.',
    tags: ['bias', 'probability', 'sizing'],
  },
  {
    id: 'f-lifestyle-creep',
    term: 'Lifestyle inflation',
    domain: 'PSYCHOLOGY',
    definition:
      'Spending rising in step with income, leaving the savings rate flat while the cost of maintaining your life ratchets up permanently.',
    example:
      'A 25% raise directed entirely to upgraded rent and car leaves savings unchanged and raises the income floor you now require.',
    pitfall:
      'Upgrading recurring costs rather than one-off ones. A better holiday is a one-time expense; a bigger apartment is a permanent increase in your required income.',
    tags: ['behaviour', 'savings', 'personal finance'],
  },
];

/* ------------------------------------------------------------------------ */
/* Playbooks — multi-step procedures, retrievable as whole units             */
/* ------------------------------------------------------------------------ */

export interface FinancePlaybook {
  id: string;
  title: string;
  domain: FinanceDomain;
  when: string;
  steps: string[];
  tags: string[];
}

export const FINANCE_PLAYBOOKS: FinancePlaybook[] = [
  {
    id: 'pb-get-stable',
    title: 'Financial stabilisation order of operations',
    domain: 'PERSONAL_FINANCE',
    when: 'Starting from scratch, or after a financial shock, and unsure what to do first.',
    steps: [
      '1. Establish the facts. List every account, balance, debt, interest rate and minimum payment on one page. Most people have never seen this page and it is the single most clarifying hour available.',
      '2. Build a one-month starter buffer in cash. Not three months yet — one, so that the next small shock does not restart the cycle on a credit card.',
      '3. Capture any employer retirement match in full. It is an immediate 50-100% return and nothing else competes with it.',
      '4. Clear debt above roughly 10% interest, highest rate first. This is a guaranteed, tax-free return equal to the rate.',
      '5. Extend the emergency fund to 3-6 months of essential expenses (9-12 if income is irregular).',
      '6. Invest the surplus in broad, low-cost index funds on an automated schedule.',
      '7. Only then consider concentrated bets, property, or active trading — and with capital you can genuinely afford to lose.',
    ],
    tags: ['order of operations', 'getting started', 'personal finance'],
  },
  {
    id: 'pb-trade-review',
    title: 'Weekly trade review that actually changes behaviour',
    domain: 'TRADING',
    when: 'End of each trading week, 30-45 minutes, before looking at next week.',
    steps: [
      '1. Count only: number of trades, wins, losses, gross P&L, costs paid. No narrative yet.',
      '2. Tag every trade as RULE-FOLLOWED or RULE-BROKEN, judged against the written plan, independent of outcome.',
      '3. Compute expectancy separately for each group. If rule-followed expectancy is negative, the strategy is the problem. If it is positive and rule-broken is negative, the process is the problem. These need completely different fixes.',
      '4. Find the single largest loss. Was it an oversized position, a moved stop, or an unplanned entry? Those are the only three options that matter.',
      '5. Write exactly one rule change for next week. One. More than one and nothing is attributable.',
      '6. Record the current account balance and max drawdown so the equity curve stays honest.',
    ],
    tags: ['review', 'journal', 'process'],
  },
  {
    id: 'pb-pre-trade',
    title: 'Pre-trade checklist',
    domain: 'RISK_MANAGEMENT',
    when: 'Before every entry, without exception.',
    steps: [
      '1. What invalidates this idea, and at what exact price? If there is no answer, there is no trade.',
      '2. What is the position size that makes that invalidation cost no more than the risk limit?',
      '3. Where is the target, and what is the resulting R:R? Below 1:1.5, is it still worth the cost?',
      '4. Is there scheduled high-impact news within the expected holding period?',
      '5. Do I already hold correlated exposure? Count factor risk, not ticket count.',
      '6. Is this on the plan, or is it because I am bored, behind, or angry?',
    ],
    tags: ['checklist', 'discipline', 'risk'],
  },
  {
    id: 'pb-debt-payoff',
    title: 'Building a debt payoff plan',
    domain: 'DEBT_CREDIT',
    when: 'Multiple debts and no clear plan.',
    steps: [
      '1. List every debt: balance, APR, minimum payment, due date.',
      '2. Compute total minimums. That is the non-negotiable monthly floor.',
      '3. Find the surplus available above the floor. If it is zero, this is an income or expense problem first — a payoff plan cannot be built on nothing.',
      '4. Choose the ordering: highest APR first (cheapest), or smallest balance first (most motivating). Pick the one you will actually sustain.',
      '5. Pay minimums on everything, direct the entire surplus to the target debt.',
      '6. When one clears, roll its full payment into the next. The payment amount never shrinks — this is what creates the acceleration.',
      '7. Before anything else, call each lender and ask for a lower rate. Success rates on this are far higher than people expect and the call takes ten minutes.',
    ],
    tags: ['debt', 'plan', 'payoff'],
  },
  {
    id: 'pb-evaluate-investment',
    title: 'Evaluating any investment opportunity',
    domain: 'INVESTING',
    when: 'Someone presents an opportunity, fund, or scheme.',
    steps: [
      '1. What is the actual source of the return? If it cannot be explained in one sentence of real economics, stop.',
      '2. What are the total fees across all layers — management, performance, entry, exit, spread?',
      '3. What is the worst historical drawdown of this asset class, and could you hold through it?',
      '4. How quickly can you exit, and at what cost? Illiquidity should be paid for, not accepted for free.',
      '5. Who is on the other side, and why are they selling this to you?',
      '6. Guaranteed high returns do not exist. A promised fixed return far above government bond yields is either mispriced risk or fraud.',
      '7. Size it so that a total loss changes your plans but not your life.',
    ],
    tags: ['due diligence', 'investing', 'checklist'],
  },
];

export const FINANCE_CORPUS_STATS = {
  get entries() {
    return FINANCE_ENTRIES.length;
  },
  get playbooks() {
    return FINANCE_PLAYBOOKS.length;
  },
  get formulas() {
    return FINANCE_ENTRIES.filter((entry) => Boolean(entry.formula)).length;
  },
  get domains(): FinanceDomain[] {
    return [...new Set(FINANCE_ENTRIES.map((entry) => entry.domain))].sort();
  },
  get characters() {
    return (
      FINANCE_ENTRIES.map(
        (entry) => entry.definition + (entry.formula ?? '') + (entry.example ?? '') + (entry.pitfall ?? ''),
      ).join('').length +
      FINANCE_PLAYBOOKS.map((playbook) => playbook.steps.join('')).join('').length
    );
  },
};
