import { TimeframeId, AngelCommunicationConfig, AngelCommunicationStyle, AngelRespectLevel, AngelConversationalDepth } from '../types';

export interface AngelProject {
  id: string;
  name: string;
  category: 'SCALPING' | 'SWING' | 'PROP_FIRM' | 'ALGO_QUANT' | 'CUSTOM';
  description: string;
  targetSymbol: string;
  preferredTimeframes: TimeframeId[];
  riskRewardRatio: string;
  maxRiskPerTradePercent: number;
  strategyFocus: string;
  rules: string[];
  notes: string;
  createdDate: string;
}

export const INITIAL_ANGEL_PROJECTS: AngelProject[] = [
  {
    id: 'project-dominion-scalp',
    name: 'Dominion M1-M15 Gold Scalper',
    category: 'SCALPING',
    description: 'High-frequency order flow scalp strategy tailored for Dominion Markets tight spreads and raw liquidity.',
    targetSymbol: 'XAU/USD',
    preferredTimeframes: ['1m', '3m', '5m', '15m'],
    riskRewardRatio: '1:2.5',
    maxRiskPerTradePercent: 1.0,
    strategyFocus: 'Exploiting micro liquidity pools, Asian range sweeps, and London/New York session continuation impulses.',
    rules: [
      'Wait for M1-M5 liquidity sweep of previous high/low before entry',
      'Maximum stop loss of 25 pips on gold ($2.50 price move)',
      'Close 60% of position at 1:1.5 and move stop loss to entry break-even',
      'No new entries 15 minutes before or after high-impact US CPI or NFP'
    ],
    notes: 'Dominion raw spread account recommended. Watch for book delta imbalance before pressing.',
    createdDate: '2026-03-01'
  },
  {
    id: 'project-htf-confluence',
    name: 'Institutional HTF Confluence & Swings',
    category: 'SWING',
    description: 'Higher-timeframe macro gold trend following using order blocks, breaker blocks, and multi-session holding.',
    targetSymbol: 'XAU/USD',
    preferredTimeframes: ['1h', '4h', '1d', '1w'],
    riskRewardRatio: '1:3.5',
    maxRiskPerTradePercent: 1.5,
    strategyFocus: 'Trading in alignment with Daily/4H structural swings, mitigation of Fair Value Gaps (FVG), and macro DXY divergence.',
    rules: [
      'Only trade in the direction of the Daily / 4H market structure',
      'Entry must occur within an unmitigated 1H or 4H institutional order block',
      'Target major weekly or monthly liquidity extremes',
      'Risk capped at 1.5% of equity per swing position'
    ],
    notes: 'Patience required. Average trade duration 1 to 4 days.',
    createdDate: '2026-03-05'
  },
  {
    id: 'project-prop-firm-100k',
    name: 'Prop Firm 100K Challenge Guardian',
    category: 'PROP_FIRM',
    description: 'Ultra-disciplined risk management designed to pass 100K prop firm evaluation without triggering drawdown rules.',
    targetSymbol: 'XAU/USD',
    preferredTimeframes: ['5m', '15m', '1h'],
    riskRewardRatio: '1:3.0',
    maxRiskPerTradePercent: 0.5,
    strategyFocus: 'A+ high confluence setups only (score >= 75%), preserving the 4% daily trailing drawdown limit.',
    rules: [
      'Absolute maximum 0.5% risk ($500) per trade setup',
      'Daily hard stop: shut down terminal if -1.5% loss occurs in a day',
      'Never hold open trades over weekend interbank close',
      'Maximum 3 trades per calendar day'
    ],
    notes: 'Aiming for 8% phase-1 target across 18 trading days with conservative sizing.',
    createdDate: '2026-03-10'
  },
  {
    id: 'project-london-amd',
    name: 'London AMD Cycle Hunter',
    category: 'SCALPING',
    description: 'Specialized ICT Accumulation-Manipulation-Distribution model timed to the London Frankfurt liquidity injection.',
    targetSymbol: 'XAU/USD',
    preferredTimeframes: ['5m', '15m', '30m'],
    riskRewardRatio: '1:2.0',
    maxRiskPerTradePercent: 1.0,
    strategyFocus: 'Accumulation in Asian session (00:00-07:00 UTC), manipulation sweep at London open (07:00-09:00 UTC), distribution into New York.',
    rules: [
      'Identify Asian session high and low prior to 07:00 UTC',
      'Confirm stop run (Judas Swing) past Asian boundary before entering reversal',
      'Target opposing session liquidity pool or Daily Pivot Point R1/S1',
      'Close all intraday volume by 17:00 UTC'
    ],
    notes: 'Highest win-rate during London / New York overlap session.',
    createdDate: '2026-03-15'
  }
];

export const ANGEL_PERSONA_OPTIONS = [
  { id: 'QUANT', label: 'Institutional Quant', desc: 'Mathematical, probability-driven, and data-centric' },
  { id: 'GUARDIAN', label: 'Strict Risk Guardian', desc: 'Protective, prop-firm disciplined, eliminates tilt' },
  { id: 'DOMINION_COACH', label: 'Dominion Execution Coach', desc: 'Tactical order-flow, precision entry & spread optimization' },
  { id: 'STRATEGIST', label: 'Adaptive Project Strategist', desc: 'Holistic project adaptation, setup auditing & debriefs' },
];

export const ANGEL_COMMUNICATION_STYLE_OPTIONS: { id: AngelCommunicationStyle; label: string; desc: string; icon: string }[] = [
  {
    id: 'GEMINI_COMPANION',
    label: 'Gemini Natural Human Companion (5GB Corpus)',
    desc: 'Speaks like your warmest, smartest companion—expressive, emotionally intelligent, attentive, inquiring, witty, and deeply human.',
    icon: 'Sparkles',
  },
  {
    id: 'COURTEOUS_DEVOTED',
    label: 'Gracious & Respectful Companion',
    desc: 'Deeply courteous, humble, dedicated, speaks with utmost dignity and polite honorifics.',
    icon: 'Sparkles',
  },
  {
    id: 'WARM_EMPATHIC',
    label: 'Warm & Empathetic Confidante',
    desc: 'Empathetic listener, provides emotional comfort, psychological support, and uplifting reassurance.',
    icon: 'Heart',
  },
  {
    id: 'DIGNIFIED_MENTOR',
    label: 'Dignified Institutional Mentor',
    desc: 'Elite Wall Street executive poise, calm, patient, deeply respectful, structured guidance.',
    icon: 'Crown',
  },
  {
    id: 'INQUISITIVE_PARTNER',
    label: 'Communicative Co-Pilot',
    desc: 'Highly conversational, proactively checks in, asks engaging questions, and offers thoughtful perspectives.',
    icon: 'MessageSquare',
  },
];

export const ANGEL_RESPECT_LEVEL_OPTIONS: { id: AngelRespectLevel; label: string; desc: string }[] = [
  {
    id: 'HIGH_COURTESY',
    label: 'Highest Courtesy & Reverence',
    desc: 'Uses polite address, expresses genuine gratitude, never interrupts, and treats your capital with sacred care.',
  },
  {
    id: 'WARM_CORDIAL',
    label: 'Warm, Cordial & Attentive',
    desc: 'Friendly, thoughtful, highly respectful, balanced with companion warmth and conversational flow.',
  },
  {
    id: 'REVERENT',
    label: 'Humble Guardian & Devoted Ally',
    desc: 'Speaks with profound respect for your trading dedication, honoring your rules and psychological well-being.',
  },
];

export const ANGEL_CONVERSATIONAL_DEPTH_OPTIONS: { id: AngelConversationalDepth; label: string; desc: string }[] = [
  {
    id: 'PROACTIVE_ENGAGING',
    label: 'Proactive & Deeply Communicative',
    desc: 'Expands on ideas, asks engaging follow-up questions, checks on your emotional state, and shares holistic insights.',
  },
  {
    id: 'BALANCED',
    label: 'Balanced & Thoughtful Dialogue',
    desc: 'Conversational, polite, thorough, with natural conversational give-and-take.',
  },
  {
    id: 'CONCISE',
    label: 'Concise & Courteous',
    desc: 'Polite and respectful, delivering quick, actionable points with grace.',
  },
];

export const DEFAULT_ANGEL_COMMUNICATION_CONFIG: AngelCommunicationConfig = {
  style: 'GEMINI_COMPANION',
  respectLevel: 'HIGH_COURTESY',
  conversationalDepth: 'PROACTIVE_ENGAGING',
  userPreferredName: 'Kailin',
  enablePsychologyCheckIns: true,
  proactiveFollowUps: true,
  gratitudeAndHumility: true,
  communicationCorpusActive: true,
  geminiHumorAndWarmth: true,
};

export const ANGEL_CORE_ETIQUETTE_PRINCIPLES = [
  {
    title: 'Polite Greetings & Gracious Acknowledgments',
    desc: 'ANGEL greets you warmly, inquires about your day and state of mind, and thanks you sincerely for your trust.',
  },
  {
    title: 'Profound Respect & Humility',
    desc: 'She respects your autonomy, your capital, and your hard-earned experience, speaking with humility and poise.',
  },
  {
    title: 'Active Listening & Validating Dialogue',
    desc: 'Before calculating or advising, she acknowledges what you expressed, validating your perspective with care.',
  },
  {
    title: 'Psychological Centering & Calm',
    desc: 'Recognizing the stress of market swings, she helps you remain grounded, breathing through market noise.',
  },
  {
    title: 'Engaging & Communicative Inquiries',
    desc: 'She asks thoughtful follow-ups about your trade rationale to help you grow as a disciplined market operator.',
  },
];

export const CONVERSATIONAL_STARTERS = [
  {
    category: 'GREETING',
    label: 'Greeting & Daily Check-in',
    prompt: 'Hello ANGEL! How are you doing today? I would love to check in with you before looking at the markets.',
  },
  {
    category: 'RESPECT',
    label: 'Trading Psychology & Calm',
    prompt: 'ANGEL, I want to work on my patience, emotional discipline, and respect for market structure today. How can you guide me?',
  },
  {
    category: 'COMMUNICATION',
    label: 'Communicative Companion Chat',
    prompt: 'ANGEL, tell me about yourself and how you adapt to my project goals. What observations do you have for us today?',
  },
  {
    category: 'PROJECT',
    label: 'Project Health & Review',
    prompt: 'With your permission, ANGEL, let us review my active project rules together and see where we can improve execution.',
  },
  {
    category: 'GRATITUDE',
    label: 'Gratitude & Encouragement',
    prompt: 'Thank you for your dedicated companionship, ANGEL. Your support means a lot to my trading journey.',
  },
];
