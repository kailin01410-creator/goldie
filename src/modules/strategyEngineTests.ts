import { generateCandles } from '../utils/technicalAnalysis';
import { 
  analyzeHigherTimeframeMarketContext, 
  detectSwingPoints, 
  calculateKeyPriceLevels 
} from './marketContext';
import { calculateVolumeProfile, calculateOrderFlowMetrics } from './volumeProfileAndOrderFlow';
import { detectLiquiditySweeps, analyzeAmdCycle } from './amdAndLiquidity';
import { getDxyMacroContext, getCurrentSessionContext, evaluateNewsEventFilter } from './macroFilters';
import { 
  evaluateMultiFactorGoldStrategy, 
  DEFAULT_MULTI_FACTOR_CONFIG 
} from './multiFactorConfluenceEngine';

export interface TestResult {
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export interface TestSuiteSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: TestResult[];
}

/**
 * Production validation test suite for all multi-factor institutional strategy modules
 */
export function runStrategyEngineTests(): TestSuiteSummary {
  const results: TestResult[] = [];
  const testGoldPrice = 2865.50;
  const mockCandles = generateCandles(testGoldPrice, 70, 0.002, '15m');

  // Test 1: Market Structure & Swing Points
  (() => {
    const t0 = performance.now();
    try {
      const { highs, lows } = detectSwingPoints(mockCandles, 2);
      const passed = highs.length > 0 && lows.length > 0;
      results.push({
        testName: 'Swing High/Low Pivot Detection',
        category: 'Market Structure',
        passed,
        message: passed 
          ? `Successfully identified ${highs.length} swing highs and ${lows.length} swing lows across candle series.`
          : 'Failed: No swing points identified.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Swing High/Low Pivot Detection',
        category: 'Market Structure',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 2: Key Price Levels (PDH, PDL, Asian H/L)
  (() => {
    const t0 = performance.now();
    try {
      const keyLevels = calculateKeyPriceLevels(testGoldPrice, mockCandles);
      const passed = keyLevels.pdh > testGoldPrice && keyLevels.pdl < testGoldPrice && keyLevels.asianSession.high > keyLevels.asianSession.low;
      results.push({
        testName: 'Institutional Key Price Levels (PDH/PDL/Asian H/L)',
        category: 'Market Structure',
        passed,
        message: passed
          ? `Key levels calibrated: PDH ($${keyLevels.pdh}) > Price ($${testGoldPrice}) > PDL ($${keyLevels.pdl}). Asian range: ${keyLevels.asianSession.rangePips} pips.`
          : 'Failed: Key price levels inverted or out of bounds.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Institutional Key Price Levels',
        category: 'Market Structure',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 3: Volume Profile & POC Calculation
  (() => {
    const t0 = performance.now();
    try {
      const vp = calculateVolumeProfile(mockCandles, 20);
      const passed = vp.poc > 0 && vp.vah >= vp.poc && vp.val <= vp.poc && vp.totalVolume > 0;
      results.push({
        testName: 'Volume Profile (POC, VAH, VAL Value Area 70%)',
        category: 'Volume Profile',
        passed,
        message: passed
          ? `Volume Profile verified: POC at $${vp.poc.toFixed(2)}, VAH at $${vp.vah.toFixed(2)}, VAL at $${vp.val.toFixed(2)}.`
          : 'Failed: Volume profile calculations did not satisfy VAH >= POC >= VAL.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Volume Profile (POC, VAH, VAL)',
        category: 'Volume Profile',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 4: Order Flow & Delta Metrics
  (() => {
    const t0 = performance.now();
    try {
      const ofm = calculateOrderFlowMetrics(mockCandles);
      const passed = typeof ofm.cumulativeDelta === 'number' && ofm.volumeExpansionRatio > 0 && !!ofm.deltaBias;
      results.push({
        testName: 'Order Flow Delta & Institutional Absorption Metrics',
        category: 'Order Flow',
        passed,
        message: passed
          ? `Order flow analyzed: CVD=${ofm.cumulativeDelta}, Bias=${ofm.deltaBias}, Vol Ratio=${ofm.volumeExpansionRatio}x.`
          : 'Failed: Invalid order flow metrics.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Order Flow Delta & Absorption Metrics',
        category: 'Order Flow',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 5: AMD Cycle & Liquidity Sweeps
  (() => {
    const t0 = performance.now();
    try {
      const keyLevels = calculateKeyPriceLevels(testGoldPrice, mockCandles);
      const { highs, lows } = detectSwingPoints(mockCandles, 2);
      const sweeps = detectLiquiditySweeps(mockCandles, keyLevels, highs, lows);
      const amd = analyzeAmdCycle(testGoldPrice, keyLevels, sweeps);
      const passed = ['ACCUMULATION', 'MANIPULATION', 'DISTRIBUTION', 'COMPLETED'].includes(amd.phase);
      results.push({
        testName: 'AMD (Accumulation–Manipulation–Distribution) Cycle Analysis',
        category: 'SMC & Liquidity',
        passed,
        message: passed
          ? `AMD verified: Current stage is ${amd.phase}. Description: ${amd.description}`
          : 'Failed: Unrecognized AMD phase.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'AMD Cycle Analysis',
        category: 'SMC & Liquidity',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 6: Macro DXY, Session, and News Filters
  (() => {
    const t0 = performance.now();
    try {
      const dxy = getDxyMacroContext(testGoldPrice);
      const session = getCurrentSessionContext();
      const news = evaluateNewsEventFilter();
      const passed = dxy.dxyPrice > 90 && !!session.activeSession && typeof news.isClearToTrade === 'boolean';
      results.push({
        testName: 'Macro Filters: DXY Correlation, Session Clock & News Proximity',
        category: 'Macro Filters',
        passed,
        message: passed
          ? `Macro confirmed: DXY @ ${dxy.dxyPrice} (${dxy.dxyTrend}), Session: ${session.sessionName}, News: ${news.status}.`
          : 'Failed: Invalid macro filter output.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Macro Filters Integration',
        category: 'Macro Filters',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 7: Multi-Factor Confluence Engine 8-Stage Sequential Execution
  (() => {
    const t0 = performance.now();
    try {
      const result = evaluateMultiFactorGoldStrategy(mockCandles, testGoldPrice, DEFAULT_MULTI_FACTOR_CONFIG);
      const stages = result.stages;
      const passed = 
        result.totalScore >= 0 && 
        result.totalScore <= 100 &&
        !!stages.context &&
        !!stages.setup &&
        !!stages.confirmation &&
        !!stages.entry &&
        stages.stopLoss.stopLossPrice > 0 &&
        stages.takeProfit.tp1Price > 0 &&
        stages.takeProfit.tp2RiskReward >= 1.5 &&
        !!stages.tradeManagement &&
        !!stages.invalidation;

      results.push({
        testName: 'Core Strategy Model: 8 Discrete Stages & Confluence Scoring',
        category: 'Strategy Engine',
        passed,
        message: passed
          ? `8 Stages executed sequentially. Confluence Score: ${result.totalScore}/100. Direction: ${result.direction}. TP2 R:R = 1:${stages.takeProfit.tp2RiskReward}.`
          : 'Failed: One or more stages missing or risk geometry violated.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Core Strategy Model 8-Stage Execution',
        category: 'Strategy Engine',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  // Test 8: Risk Management Safeguard & Safety Lockout
  (() => {
    const t0 = performance.now();
    try {
      // Default liveExecutionEnabled must be strictly false
      const isLiveBlockedByDefault = DEFAULT_MULTI_FACTOR_CONFIG.liveExecutionEnabled === false;
      const passed = isLiveBlockedByDefault;
      results.push({
        testName: 'Execution Safety Protocol (Paper Trading Guard)',
        category: 'Risk Management',
        passed,
        message: passed
          ? 'Live trading execution blocked by default. System strictly requires manual live setting toggle.'
          : 'Failed: Live execution default safety check breached.',
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    } catch (e: any) {
      results.push({
        testName: 'Execution Safety Protocol',
        category: 'Risk Management',
        passed: false,
        message: `Error: ${e?.message}`,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }
  })();

  const passedCount = results.filter(r => r.passed).length;
  return {
    totalTests: results.length,
    passedTests: passedCount,
    failedTests: results.length - passedCount,
    allPassed: passedCount === results.length,
    results,
  };
}
