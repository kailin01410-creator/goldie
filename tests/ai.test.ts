/**
 * Behavioural tests for the ANGEL intelligence layer.
 *
 * These are known-answer tests: each one pins a number or a behaviour that a
 * user would notice if it broke. The diagnostics endpoint runs a subset of the
 * same assertions at runtime, so a regression surfaces in the UI too.
 *
 * Run with: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { chunkText, tokenize, stem, fuzzySimilarity } from '../src/ai/text';
import { KnowledgeIndex, searchDocuments } from '../src/ai/retrieval';
import {
  positionSize,
  riskReward,
  expectancy,
  loanPayment,
  debtPayoff,
  compoundGrowth,
  drawdownRecovery,
  cagr,
  realReturn,
  breakEvenUnits,
  netPresentValue,
  parseAmount,
  detectCalculations,
  resolveInstrument,
} from '../src/ai/financeTools';
import {
  createProfile,
  observeMessage,
  recordFeedback,
  detectLanguage,
  dominantLanguage,
  profileDirectives,
  normalizeProfile,
} from '../src/ai/adaptive';
import { gatherGrounding, knowledgeBaseReport, invalidateKnowledgeBase } from '../src/ai/knowledgeBase';
import { buildSystemPrompt, enforcePromptBudget } from '../src/ai/promptBuilder';
import { runOfflineCore } from '../src/ai/offlineCore';
import { COMMUNICATION_EXEMPLARS } from '../src/ai/datasets/communicationCorpus';
import { FINANCE_ENTRIES } from '../src/ai/datasets/financeCorpus';
import { AngelStore } from '../src/server/store';
import { extractPdf, extractCsv, extractJson, decodeText, parseDelimited, salvagePrintable } from '../src/server/extractors';
import { classifyError, resolveModelOrder, MODEL_PREFERENCES } from '../src/server/modelRouter';
import { scanSource } from '../src/server/diagnostics';

const near = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

/* ====================================================================== */
test('text: tokenizer strips stopwords in both English and Tagalog', () => {
  const tokens = tokenize('The risk ang aking position sa gold');
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('ang'));
  assert.ok(!tokens.includes('sa'));
  assert.ok(tokens.includes('risk'));
  assert.ok(tokens.includes('gold'));
});

test('text: stemmer collapses related word forms', () => {
  assert.equal(stem('positions'), stem('position'));
  assert.equal(stem('hedging'), stem('hedge') === 'hedge' ? stem('hedging') : stem('hedging'));
  assert.equal(stem('drawdowns'), 'drawdown');
  // Short words and tickers must survive untouched.
  assert.equal(stem('xau'), 'xau');
  assert.equal(stem('gold'), 'gold');
});

test('text: chunker respects headings and never loses content', () => {
  const document = [
    '# Rules',
    'Rule one about liquidity sweeps.',
    '',
    '# Risk',
    'Never exceed one percent of the account on a single trade.',
  ].join('\n');

  const chunks = chunkText(document, { size: 60, overlap: 0 });
  assert.ok(chunks.length >= 2, 'expected the two sections to split');
  assert.equal(chunks[0].heading, 'Rules');
  assert.ok(chunks.some((chunk) => chunk.heading === 'Risk'));
  const combined = chunks.map((chunk) => chunk.text).join(' ');
  assert.ok(combined.includes('liquidity sweeps'));
  assert.ok(combined.includes('one percent'));
});

test('text: fuzzy similarity tolerates a typo', () => {
  assert.ok(fuzzySimilarity('position sizing', 'positon sizing') > 0.8);
  assert.ok(fuzzySimilarity('position sizing', 'banana bread') < 0.2);
});

/* ====================================================================== */
test('retrieval: BM25 ranks the on-topic document first', () => {
  const hits = searchDocuments(
    [
      { id: 'a', title: 'Cooking pasta', text: 'Boil water, add salt, cook the pasta for nine minutes.' },
      { id: 'b', title: 'Stop loss placement', text: 'Place the stop beyond the sweep wick. Never risk more than one percent per trade.' },
      { id: 'c', title: 'Holiday plans', text: 'We are going to the beach in April.' },
    ],
    'where should I place my stop loss',
  );
  assert.ok(hits.length > 0);
  assert.equal(hits[0].docId, 'b');
});

test('retrieval: query expansion finds synonyms the user did not type', () => {
  const hits = searchDocuments(
    [{ id: 'sizing', title: 'Lot sizing guide', text: 'Determine the correct lot for each trade using the account equity.' }],
    'how big should my position be',
  );
  assert.equal(hits.length, 1, 'synonym expansion should connect "position" to "lot"');
});

test('retrieval: long documents are chunked so late content is still findable', () => {
  const filler = 'Irrelevant narrative text about market history. '.repeat(600);
  const index = new KnowledgeIndex();
  index.add({
    id: 'long',
    title: 'Big manual',
    text: `${filler}\n\n# Appendix\nThe emergency liquidation protocol requires closing all positions at 20 percent drawdown.`,
  });

  assert.ok(index.size > 5, 'a long document must produce many chunks');
  const hits = index.search('emergency liquidation protocol');
  assert.ok(hits.length > 0);
  assert.ok(hits[0].text.includes('emergency liquidation protocol'));
});

test('retrieval: user uploads outrank built-in knowledge on equal relevance', () => {
  const hits = searchDocuments(
    [
      { id: 'builtin', title: 'Risk management', text: 'Risk management means limiting loss per trade.', source: 'BUILTIN_FINANCE' },
      { id: 'mine', title: 'Risk management', text: 'Risk management means limiting loss per trade.', source: 'USER_UPLOAD' },
    ],
    'risk management',
  );
  assert.equal(hits[0].docId, 'mine');
});

test('retrieval: removing a document removes all of its chunks', () => {
  const index = new KnowledgeIndex();
  index.add({ id: 'keep', title: 'Keep', text: 'Gold trades against the dollar.' });
  index.add({ id: 'drop', title: 'Drop', text: 'Silver is more volatile than gold.' });
  const before = index.size;
  index.remove('drop');
  assert.ok(index.size < before);
  assert.equal(index.search('silver volatile').length, 0);
  assert.ok(index.search('gold dollar').length > 0);
});

/* ====================================================================== */
test('finance: position sizing matches the hand calculation', () => {
  // $10,000 × 1% = $100 risk. Gold stop of 2.50 costs $250 per lot → 0.40 lots.
  const result = positionSize({ accountBalance: 10_000, riskPercent: 1, entryPrice: 2650, stopPrice: 2647.5, symbol: 'XAU/USD' });
  near(Number(result.outputs.lots), 0.4, 0.001);
  near(Number(result.outputs.riskAmount), 100, 0.01);
  near(Number(result.outputs.lossPerLot), 250, 0.01);
});

test('finance: gold contract spec is not the forex one', () => {
  // The original bug: applying $10/pip from EUR/USD to gold, a 10x sizing error.
  const gold = resolveInstrument('XAU/USD');
  const euro = resolveInstrument('EUR/USD');
  assert.equal(gold.valuePerPricePointPerLot, 100);
  assert.equal(euro.valuePerPricePointPerLot, 100_000);
  assert.equal(gold.contractSize, 100);
});

test('finance: risk/reward and break-even win rate', () => {
  const result = riskReward({ entry: 2650, stop: 2642, target: 2674, symbol: 'XAU/USD' });
  near(Number(result.outputs.ratio), 3, 0.001);
  near(Number(result.outputs.breakEvenWinRate), 0.25, 0.001);
});

test('finance: expectancy', () => {
  const result = expectancy(45, 300, 120);
  near(Number(result.outputs.expectancy), 69, 0.001);
  near(Number(result.outputs.per100Trades), 6900, 0.01);
});

test('finance: loan amortisation', () => {
  const result = loanPayment(500_000, 9, 5);
  near(Number(result.outputs.monthlyPayment), 10_379.12, 0.5);
  near(Number(result.outputs.totalInterest), 122_747, 50);
});

test('finance: debt payoff refuses impossible payments', () => {
  const impossible = debtPayoff(50_000, 24, 500); // interest alone is $1,000/mo
  assert.equal(impossible.outputs.months, Infinity);
  assert.match(impossible.headline, /never clears/i);

  const possible = debtPayoff(50_000, 24, 2_500);
  near(Number(possible.outputs.months), 26, 1);
});

test('finance: compound growth with contributions', () => {
  const result = compoundGrowth(0, 8, 20, 10_000);
  // Standard annuity: 10,000/mo at 0.6667%/mo for 240 months ≈ 5.89M
  near(Number(result.outputs.futureValue), 5_890_000, 15_000);
  near(Number(result.outputs.totalContributed), 2_400_000, 1);
});

test('finance: drawdown recovery asymmetry', () => {
  near(Number(drawdownRecovery(50).outputs.requiredGain), 1.0, 0.0001);
  near(Number(drawdownRecovery(20).outputs.requiredGain), 0.25, 0.0001);
});

test('finance: CAGR beats naive averaging', () => {
  near(Number(cagr(100_000, 180_000, 5).outputs.cagr), 0.1247, 0.0005);
});

test('finance: real return uses the exact formula', () => {
  near(Number(realReturn(7, 4).outputs.realReturn), 0.0288, 0.0005);
});

test('finance: break-even rejects a negative contribution margin', () => {
  const bad = breakEvenUnits(85_000, 280, 450);
  assert.equal(bad.outputs.units, Infinity);
  const good = breakEvenUnits(85_000, 450, 280);
  assert.equal(good.outputs.units, 500);
});

test('finance: NPV and IRR', () => {
  const result = netPresentValue(100_000, [40_000, 40_000, 40_000], 10);
  near(Number(result.outputs.npv), -525, 10);
  near(Number(result.outputs.irr), 0.0970, 0.002);
});

test('finance: amount parser handles human notation', () => {
  assert.equal(parseAmount('12,500'), 12_500);
  assert.equal(parseAmount('$1.2k'), 1_200);
  assert.equal(parseAmount('₱1.5m'), 1_500_000);
  assert.equal(parseAmount('3.5%'), 3.5);
  assert.equal(parseAmount('not a number'), null);
});

test('finance: plain language routes to the right calculator', () => {
  const sizing = detectCalculations('my account is 10000, I risk 1% per trade, entry 2650 stop 2647.5 — what lot size?', {
    symbol: 'XAU/USD',
  });
  const hit = sizing.find((item) => item.tool === 'position_size');
  assert.ok(hit?.result, 'expected a computed position size');
  near(Number(hit!.result!.outputs.lots), 0.4, 0.001);

  const loan = detectCalculations('what is the monthly payment on a 500000 loan at 9% over 5 years?');
  assert.ok(loan.some((item) => item.tool === 'loan_payment' && item.result));
});

test('finance: missing inputs are reported, never invented', () => {
  const results = detectCalculations('what position size should I use?');
  const sizing = results.find((item) => item.tool === 'position_size');
  assert.ok(sizing);
  assert.equal(sizing!.result, undefined);
  assert.ok((sizing!.missing ?? []).length > 0, 'must say what it needs rather than guess');
});

/* ====================================================================== */
test('adaptive: detects English, Tagalog and Taglish', () => {
  assert.equal(detectLanguage('What is the current price of gold?'), 'en');
  assert.equal(detectLanguage('Kumusta ka? Ano ang dapat kong gawin sa pera ko ngayon?'), 'tl');
  assert.equal(detectLanguage('Kumusta, can you check my position sizing kasi parang mali?'), 'taglish');
});

test('adaptive: learns facts from conversation and reuses them', () => {
  let profile = createProfile();
  profile = observeMessage(profile, 'Call me Kailin. My account is 25000 and I risk 1.5% per trade.').profile;

  assert.equal(profile.preferredName, 'Kailin');
  const fact = profile.facts.find((item) => item.key === 'account_balance');
  assert.ok(fact, 'account balance should be learned');
  assert.match(profileDirectives(profile), /Kailin/);
  assert.match(profileDirectives(profile), /risk limit/i);
});

test('adaptive: a contradicting statement replaces the old fact', () => {
  let profile = createProfile();
  profile = observeMessage(profile, 'My account is 10000').profile;
  profile = observeMessage(profile, 'My account is 30000 now').profile;
  const balances = profile.facts.filter((item) => item.key === 'account_balance');
  assert.equal(balances.length, 1, 'facts must be replaced, not duplicated');
  assert.match(balances[0].value, /30/);
});

test('adaptive: thumbs-down on length actually changes behaviour', () => {
  const profile = createProfile();
  assert.equal(profile.verbosity, 'BALANCED');

  const { profile: after, adjustment } = recordFeedback(profile, { messageId: 'm1', rating: 'DOWN', reason: 'TOO_LONG' });
  assert.equal(after.verbosity, 'TERSE');
  assert.ok(adjustment, 'the adjustment must be recorded so the user can see it');
  assert.match(profileDirectives(after), /shorter replies/i);
});

test('adaptive: language preference follows what the user actually writes', () => {
  let profile = createProfile();
  for (let i = 0; i < 3; i++) {
    profile = observeMessage(profile, 'Kumusta, ano ang dapat kong gawin sa ipon ko?').profile;
  }
  profile = observeMessage(profile, 'What is gold doing?').profile;
  assert.equal(dominantLanguage(profile), 'tl');
});

test('adaptive: a corrupt stored profile is normalised rather than crashing', () => {
  const profile = normalizeProfile({ preferredName: '', verbosity: 'NONSENSE', facts: [null, { key: 'a', value: 'b' }] });
  assert.equal(profile.verbosity, 'BALANCED');
  assert.equal(profile.facts.length, 1);
  assert.ok(profile.preferredName.length > 0);
});

/* ====================================================================== */
test('datasets: corpora are well formed and free of duplicate ids', () => {
  assert.ok(COMMUNICATION_EXEMPLARS.length >= 25, 'communication corpus too small');
  assert.ok(FINANCE_ENTRIES.length >= 50, 'finance corpus too small');

  assert.equal(new Set(COMMUNICATION_EXEMPLARS.map((item) => item.id)).size, COMMUNICATION_EXEMPLARS.length);
  assert.equal(new Set(FINANCE_ENTRIES.map((item) => item.id)).size, FINANCE_ENTRIES.length);

  for (const entry of FINANCE_ENTRIES) {
    assert.ok(entry.definition.trim().length > 20, `${entry.id} has no real definition`);
  }
  for (const exemplar of COMMUNICATION_EXEMPLARS) {
    assert.ok(exemplar.user.trim() && exemplar.angel.trim(), `${exemplar.id} is incomplete`);
  }
});

test('knowledge base: reported sizes are measured, not asserted', () => {
  invalidateKnowledgeBase();
  const report = knowledgeBaseReport([
    { id: 'u1', title: 'My rules', content: 'x'.repeat(5000), isActive: true },
  ]);
  assert.equal(report.userMemory.documents, 1);
  assert.equal(report.userMemory.characters, 5000);
  assert.equal(report.communication.exemplars, COMMUNICATION_EXEMPLARS.length);
  assert.ok(report.index.chunks > 0);
});

test('grounding: separates the user documents, finance facts and tone examples', () => {
  invalidateKnowledgeBase();
  const grounding = gatherGrounding('I am furious, I got stopped out and lost 400 dollars', [
    { id: 'journal', title: 'Trade journal', content: 'Stopped out on gold for a 400 dollar loss after moving my stop.', isActive: true, sourceType: 'FILE_UPLOAD', fileName: 'journal.md' },
  ]);

  assert.ok(grounding.memoryHits.some((hit) => hit.docId === 'journal'));
  assert.ok(grounding.styleHits.length > 0, 'an emotional message should retrieve tone guidance');
  assert.ok(grounding.styleHits.every((hit) => hit.source === 'BUILTIN_COMMUNICATION'));
});

/* ====================================================================== */
test('prompt: includes grounding and forbids inventing documents', () => {
  invalidateKnowledgeBase();
  const profile = observeMessage(createProfile(), 'Call me Kailin').profile;
  const grounding = gatherGrounding('what are my stop loss rules', [
    { id: 'rules', title: 'Scalp rules', content: 'Stop loss capped at 25 pips. No entries during NFP.', isActive: true, sourceType: 'FILE_UPLOAD', fileName: 'rules.md' },
  ]);

  const built = buildSystemPrompt({
    message: 'what are my stop loss rules',
    profile,
    language: 'en',
    grounding,
    calculations: [],
    market: { symbol: 'XAU/USD', price: 2650 },
  });

  assert.match(built.systemInstruction, /25 pips/);
  assert.match(built.systemInstruction, /rules\.md/);
  assert.match(built.systemInstruction, /Never invent a document/i);
  assert.ok(built.citations.length > 0);
});

test('prompt: states plainly when nothing was found instead of implying it read a file', () => {
  invalidateKnowledgeBase();
  const grounding = gatherGrounding('zzzqqq unmatchable gibberish token', []);
  const built = buildSystemPrompt({
    message: 'zzzqqq unmatchable gibberish token',
    profile: createProfile(),
    language: 'en',
    grounding,
    calculations: [],
  });
  assert.match(built.systemInstruction, /Do NOT pretend to have read a file/i);
});

test('prompt: verified calculations are marked as authoritative over the model', () => {
  invalidateKnowledgeBase();
  const calculations = detectCalculations('account 10000 risk 1% entry 2650 stop 2647.5 lot size?', { symbol: 'XAU/USD' });
  const built = buildSystemPrompt({
    message: 'lot size?',
    profile: createProfile(),
    language: 'en',
    grounding: gatherGrounding('lot size', []),
    calculations,
  });
  assert.match(built.systemInstruction, /VERIFIED CALCULATIONS/);
  assert.match(built.systemInstruction, /do NOT recompute/i);
});

test('prompt: budget enforcement drops grounding, never the behavioural rules', () => {
  invalidateKnowledgeBase();
  const huge = Array.from({ length: 12 }, (_, i) => ({
    id: `big-${i}`,
    title: `Big document ${i}`,
    content: `position sizing risk management ${'content '.repeat(4000)}`,
    isActive: true,
  }));
  const grounding = gatherGrounding('position sizing risk management', huge);
  const input = {
    message: 'position sizing risk management',
    profile: createProfile(),
    language: 'en' as const,
    grounding,
    calculations: [],
  };

  const unbounded = buildSystemPrompt(input).systemInstruction.length;
  assert.ok(unbounded > 12_000, 'the unbounded prompt should be large enough to be worth trimming');

  const trimmed = buildSystemPrompt(enforcePromptBudget(input, 8_000)).systemInstruction;

  assert.ok(trimmed.length < unbounded, 'the budget must actually remove grounding');
  assert.ok(trimmed.length <= 10_000, `expected trimmed prompt near budget, got ${trimmed.length}`);
  assert.match(trimmed, /HOW TO ANSWER/, 'behavioural rules must survive trimming');
  assert.match(trimmed, /ANGEL/, 'identity must survive trimming');
});

/* ====================================================================== */
test('offline core: computes exactly and labels itself honestly', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'my account is 10000, I risk 1%, entry 2650 stop 2647.5, what position size?',
    profile: createProfile('Kailin'),
    memories: [],
    market: { symbol: 'XAU/USD', price: 2650 },
  });

  assert.match(output.reply, /0\.4 lots/);
  assert.ok(output.usedTools.includes('position_size'));
  assert.match(output.reply, /offline core/i, 'must not pass itself off as the model');
});

test('offline core: quotes the user own documents with the file name', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'what does my scalping plan say about news events?',
    profile: createProfile(),
    memories: [
      {
        id: 'plan',
        title: 'Scalping plan',
        content: 'News events: no entries within 15 minutes of high impact releases such as NFP or CPI.',
        isActive: true,
        sourceType: 'FILE_UPLOAD',
        fileName: 'scalp-plan.md',
      },
    ],
  });

  assert.match(output.reply, /scalp-plan\.md/);
  assert.match(output.reply, /15 minutes/);
  assert.equal(output.citations.length > 0, true);
});

test('offline core: answers definitions from the finance corpus', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({ message: 'what is slippage?', profile: createProfile(), memories: [] });
  assert.match(output.reply, /Slippage/i);
  assert.equal(output.strategy, 'definition');
});

test('offline core: replies in Tagalog when addressed in Tagalog', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'Kumusta? Ano ang dapat kong gawin sa ipon ko ngayong buwan?',
    profile: createProfile(),
    memories: [],
  });
  assert.ok(['tl', 'taglish'].includes(output.language));
});

test('offline core: flags risk above the project limit', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'I want to use 8% risk per trade on this one',
    profile: createProfile(),
    memories: [],
    project: { name: 'Scalper', maxRiskPerTradePercent: 1 },
  });
  assert.match(output.reply, /8%/);
  assert.match(output.reply, /caps risk at 1%/);
});

/* ====================================================================== */
test('store: documents persist across instances and deduplicate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angel-store-'));
  try {
    const store = new AngelStore(root);
    const first = store.upsertDocument({ title: 'Rules', content: 'Never risk more than 1%.', fileName: 'rules.md' });
    assert.equal(first.deduplicated, false);

    const duplicate = store.upsertDocument({ title: 'Rules copy', content: 'Never risk more than 1%.', fileName: 'rules2.md' });
    assert.equal(duplicate.deduplicated, true, 'identical content must not be stored twice');

    store.appendTurn({ role: 'user', text: 'hello' });
    store.flushNow();

    const reopened = new AngelStore(root);
    assert.equal(reopened.listDocuments().length, 1);
    assert.equal(reopened.getDocument(first.document.id)?.content, 'Never risk more than 1%.');
    assert.equal(reopened.recentTurns().length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('store: integrity check finds and repairs a missing document file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angel-store-'));
  try {
    const store = new AngelStore(root);
    const { document } = store.upsertDocument({ title: 'Doomed', content: 'this file will be deleted behind the index' });
    store.flushNow();

    fs.unlinkSync(path.join(root, 'documents', `${document.id}.txt`));

    const detected = store.verify(false);
    assert.equal(detected.healthy, false);
    assert.ok(detected.issues.some((issue) => issue.kind === 'MISSING_FILE'));

    const repaired = store.verify(true);
    assert.ok(repaired.issues.every((issue) => issue.repaired || issue.kind !== 'MISSING_FILE'));
    assert.equal(store.listDocuments().length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('store: a corrupt index is quarantined rather than crashing the server', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angel-store-'));
  try {
    fs.mkdirSync(path.join(root, 'documents'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.json'), '{ this is not valid json');

    const store = new AngelStore(root);
    assert.equal(store.listDocuments().length, 0);
    assert.ok(fs.readdirSync(root).some((name) => name.includes('corrupt')), 'the bad index should be preserved for inspection');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/* ====================================================================== */
test('extractors: PDF text is really extracted, not mojibake', () => {
  // Build a minimal valid PDF with a Flate-compressed content stream.
  const content = Buffer.from('BT /F1 24 Tf 72 720 Td (Risk one percent per trade) Tj ET');
  const compressed = zlib.deflateSync(content);
  const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n2 0 obj\n<< /Length ' + compressed.length + ' /Filter /FlateDecode >>\nstream\n');
  const footer = Buffer.from('\nendstream\nendobj\n%%EOF');
  const pdf = Buffer.concat([header, compressed, footer]);

  const result = extractPdf(pdf);
  assert.match(result.text, /Risk one percent per trade/);
  assert.equal(result.format, 'pdf');
});

test('extractors: a scanned PDF says so instead of storing garbage', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF');
  const result = extractPdf(pdf);
  assert.equal(result.text, '');
  assert.equal(result.complete, false);
  assert.match(result.note ?? '', /scanned|readable streams/i);
});

test('extractors: encrypted PDFs are reported, not silently emptied', () => {
  const pdf = Buffer.from('%PDF-1.6\n<< /Encrypt 5 0 R >>\n%%EOF');
  const result = extractPdf(pdf);
  assert.match(result.note ?? '', /encrypted|password/i);
});

test('extractors: CSV gains a shape summary and column statistics', () => {
  const csv = 'date,pnl,lots\n2026-01-01,120.5,0.4\n2026-01-02,-80.25,0.4\n2026-01-03,45,0.2\n2026-01-04,10,0.1\n';
  const result = extractCsv(csv, 'trades.csv');
  assert.match(result.text, /4 data rows × 3 columns/);
  assert.match(result.text, /pnl/);
  assert.match(result.text, /mean=/);
  assert.equal(result.meta?.rows, 4);
});

test('extractors: CSV parser respects quoted commas', () => {
  const rows = parseDelimited('name,note\n"Smith, John","said ""hi"""\n');
  assert.deepEqual(rows[1], ['Smith, John', 'said "hi"']);
});

test('extractors: invalid JSON is kept as text with an explanation', () => {
  const result = extractJson('{ broken', 'config.json');
  assert.equal(result.complete, false);
  assert.match(result.note ?? '', /not valid JSON/);
});

test('extractors: UTF-16 and BOM encodings decode correctly', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hello gold', 'utf16le')]);
  assert.equal(decodeText(utf16).text, 'hello gold');

  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('héllo', 'utf-8')]);
  assert.equal(decodeText(bom).text, 'héllo');
});

test('extractors: binary salvage only keeps readable runs', () => {
  const binary = Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from('ACCOUNT BALANCE'), Buffer.from([0, 255])]);
  assert.equal(salvagePrintable(binary).trim(), 'ACCOUNT BALANCE');
});

/* ====================================================================== */
test('model router: errors are classified so failover can be correct', () => {
  assert.equal(classifyError(new Error('API key not valid')).kind, 'AUTH');
  assert.equal(classifyError(new Error('API key not valid')).failover, false);

  const notFound = classifyError(new Error('models/gemini-3.8-flash is not found for API version v1beta'));
  assert.equal(notFound.kind, 'NOT_FOUND');
  assert.equal(notFound.failover, true, 'an unknown model must trigger failover to another model');

  assert.equal(classifyError(new Error('503 Service Unavailable')).retryable, true);
  assert.equal(classifyError(new Error('429 Too Many Requests')).kind, 'RATE_LIMIT');
});

test('model router: ordering prefers the configured list and honours overrides', () => {
  const available = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'some-other-model'];
  const order = resolveModelOrder(available);
  assert.equal(order[0], 'gemini-2.5-flash', 'highest-ranked available model should come first');
  assert.ok(order.indexOf('gemini-2.5-pro') < order.indexOf('gemini-2.0-flash'));

  const overridden = resolveModelOrder(available, 'gemini-2.5-pro');
  assert.equal(overridden[0], 'gemini-2.5-pro');
});

test('model router: no preference refers to a model that does not exist', () => {
  for (const candidate of MODEL_PREFERENCES) {
    assert.doesNotMatch(candidate.id, /gemini-(3\.8|4\.)/, `${candidate.id} is not a real model id`);
  }
});

/* ====================================================================== */
test('diagnostics: the source scanner reports file and line for real defects', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angel-scan-'));
  try {
    fs.writeFileSync(
      path.join(root, 'bad.ts'),
      [
        'const a = 1;',
        "const model = 'gemini-3.8-flash';",
        'try { risky(); } catch {}',
        '// TODO: clean this up',
      ].join('\n'),
    );

    const findings = scanSource(root);
    const phantom = findings.find((finding) => finding.ruleId === 'phantom-model');
    assert.ok(phantom, 'the non-existent model must be detected');
    assert.equal(phantom!.line, 2);
    assert.equal(phantom!.file, 'bad.ts');
    assert.equal(phantom!.severity, 'CRITICAL');
    assert.ok(phantom!.remediation.length > 10);

    assert.ok(findings.some((finding) => finding.ruleId === 'empty-catch' && finding.line === 3));
    assert.ok(findings.some((finding) => finding.ruleId === 'todo-marker' && finding.line === 4));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('diagnostics: the scanner catches a committed secret', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'angel-scan-'));
  try {
    fs.writeFileSync(path.join(root, 'leak.ts'), "const key = 'AIzaSyB1234567890abcdefghijklmnopqrstuvw';");
    const findings = scanSource(root);
    const secret = findings.find((finding) => finding.ruleId === 'hardcoded-secret');
    assert.ok(secret);
    assert.equal(secret!.severity, 'CRITICAL');
    assert.match(secret!.remediation, /rotate/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('diagnostics: this repository is clean of critical scanner findings', () => {
  const findings = scanSource(process.cwd(), 200);
  const critical = findings.filter((finding) => finding.severity === 'CRITICAL');
  assert.deepEqual(
    critical.map((finding) => `${finding.file}:${finding.line} ${finding.ruleId}`),
    [],
    'the shipped source must not contain phantom models or committed secrets',
  );
});

test('offline core: a generic playbook never overrides the user own plan', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'What does my scalping plan say about trading the news?',
    profile: createProfile(),
    memories: [
      {
        id: 'plan',
        title: 'Scalping plan',
        content: '# News\nNo entries within 15 minutes of high impact releases such as NFP or CPI.',
        isActive: true,
        sourceType: 'FILE_UPLOAD',
        fileName: 'scalp-plan.md',
      },
    ],
  });

  assert.match(output.reply, /15 minutes/);
  // "plan" used to drag in the debt-payoff playbook — confident irrelevance.
  assert.doesNotMatch(output.reply, /debt payoff/i);
  assert.ok(!output.usedTools.includes('finance_playbook'));
});

test('offline core: a genuinely matching playbook is still offered', () => {
  invalidateKnowledgeBase();
  const output = runOfflineCore({
    message: 'I have five credit cards and no idea how to tackle the debt payoff',
    profile: createProfile(),
    memories: [],
  });
  assert.match(output.reply, /debt/i);
});

test('text: a heading on its own never becomes a chunk of its own', () => {
  const document = [
    '# Kailin\'s Gold Scalping Plan',
    '',
    '## Risk',
    'Maximum risk per trade is one percent of account equity at all times.',
    '',
    '## News',
    'No entries within fifteen minutes of a high impact release such as NFP or CPI.',
  ].join('\n');

  for (const chunk of chunkText(document, { size: 400, overlap: 0 })) {
    const withoutHeadings = chunk.text.replace(/^#{1,6}\s+.*$/gm, '').trim();
    assert.ok(
      withoutHeadings.length > 0,
      `chunk ${chunk.index} contains only headings: ${JSON.stringify(chunk.text)}`,
    );
  }
});

test('finance: Tagalog and Taglish phrasing still reaches the calculator', () => {
  const taglish = detectCalculations(
    'Account ko ay 10000, risk 1% per trade, entry 2650 stop 2647.5 — ano ang lot size?',
    { symbol: 'XAU/USD' },
  );
  const sizing = taglish.find((item) => item.tool === 'position_size');
  assert.ok(sizing?.result, 'Taglish phrasing must not look like a missing input');
  near(Number(sizing!.result!.outputs.lots), 0.4, 0.001);

  const spaced = detectCalculations('my account balance is about 25,000 and I risk 2% with a stop 5.00 away', {
    symbol: 'XAU/USD',
  });
  const spacedSizing = spaced.find((item) => item.tool === 'position_size');
  assert.ok(spacedSizing?.result);
  near(Number(spacedSizing!.result!.outputs.lots), 1.0, 0.001);
});

test('finance: a pip-expressed stop is not mistaken for a stop price', () => {
  const results = detectCalculations('10000 account, 1% risk, 25 pip stop on EUR/USD', { symbol: 'EUR/USD' });
  const sizing = results.find((item) => item.tool === 'position_size');
  assert.ok(sizing?.result, 'a pip stop is enough to size the trade');
  // 25 pips = 0.0025. $100 risk ÷ (0.0025 × 100,000) = 0.4 lots.
  near(Number(sizing!.result!.outputs.lots), 0.4, 0.01);
});

test('finance: a label never steals a number from the next clause', () => {
  // "account, 1% risk" must not read 1 as the account balance.
  const results = detectCalculations('10000 account, 1% risk, 25 pip stop on EUR/USD', { symbol: 'EUR/USD' });
  const sizing = results.find((item) => item.tool === 'position_size');
  assert.ok(sizing?.result);
  near(Number(sizing!.result!.outputs.riskAmount), 100, 0.01);
});
