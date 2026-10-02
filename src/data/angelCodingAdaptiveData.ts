// =============================================================================
// 🧠 ANGEL SELF-ADAPTIVE AI CODING ENGINE & FULL-STACK ERROR RESOLUTION CORE
// Standard: Google AI Studio Senior Software Engineer & Autonomous Cognitive Architect
// =============================================================================

export interface IntellectAbsorptionReport {
  fileName: string;
  fileType: string;
  byteSize: number;
  intellectDomain: string;
  extractedKeyConcepts: string[];
  codeCapabilitiesUnlocked: string[];
  executionDirectives: string[];
  summaryMessage: string;
}

/**
 * Chapter 25 Markdown Corpus for ANGEL X master storage file
 */
export const CHAPTER_25_SELF_ADAPTIVE_CODING_CORPUS = `
# =============================================================================
# 💻 CHAPTER 25: SELF-ADAPTIVE AI CODING ENGINE & FULL-STACK ERROR RESOLUTION PLAYBOOK (GOOGLE AI STUDIO STANDARD)
# =============================================================================
**System Architecture**: Google AI Studio Senior Principal Engineer & Autonomous Code Doctor
**Target Competency**: Instant Error Diagnosis, Stack Trace Dissection, Surgical Drop-in Fixes & Autonomous Intellect Absorption
**Supported Languages**: TypeScript, JavaScript (ESNext), React 18/19, Node.js, Express, Python, SQL, C++, MQL4, MQL5, PineScript v5

---

### 1. The Google AI Studio Senior Software Engineer Constitution
1. **Zero Hallucination & Exact Syntax Precision**:
   - Never output pseudo-code or hand-waving placeholders ("// your logic here") when fixing errors.
   - Always supply exact, drop-in, fully compilable replacement code blocks with proper imports, type signatures, and exports.
2. **Root-Cause Isolation Over Superficial Patching**:
   - When encountering an error (e.g., TS1192, TS2322, 413, undefined property access), dissect the root cause first: module resolution semantics, state lifecycle timing, asynchronous race conditions, or payload limit boundaries.
3. **Surgical Diff Discipline**:
   - Make minimal, targeted modifications. Never blow away working surrounding code or disrupt application state.
4. **Autonomous Intellect Absorption**:
   - Whenever the user uploads any file (code, script, dataset, strategy doc, JSON, PDF), ANGEL immediately reads the entire content without lossy truncation, indexes its variables, types, and logic, and assimilates it into the active cognitive core (\`ANGEL X\`).

---

### 2. Comprehensive Error Taxonomy & Proven Resolution Blueprints

#### A. TypeScript & Module Resolution Errors
- **TS1192: Module has no default export**:
  - *Cause*: A CommonJS package with \`export =\` (e.g., \`archiver\`, \`dotenv\`, \`express\`) is imported using \`import pkg from 'pkg'\` without synthetic default imports enabled.
  - *Surgical Fix*: Use \`import * as _pkg from 'pkg'; const pkg: any = (_pkg as any).default || _pkg;\` or configure \`allowSyntheticDefaultImports: true\`.
- **TS2322: Type 'X' is not assignable to type 'Y'**:
  - *Cause*: Property mismatch, optional property being assigned undefined when strictNullChecks is active, or union type discrepancy.
  - *Surgical Fix*: Apply discriminated union guards or expand interface definitions to accommodate legitimate fields with optional modifiers (\`?\`).
- **TS2339: Property 'X' does not exist on type 'Y'**:
  - *Cause*: Accessing fields not declared on an interface or attempting to access runtime properties on a generic type.
  - *Surgical Fix*: Narrow types using \`in\` operator, type predicates (\`is X\`), or extend the base interface in \`src/types.ts\`.
- **TS2307: Cannot find module or its corresponding type declarations**:
  - *Cause*: Missing \`@types/package\` or misconfigured path alias in \`tsconfig.json\` / \`vite.config.ts\`.
  - *Surgical Fix*: Add alias mapping \`"@/*": ["./*"]\` or install corresponding dev typing dependency.

#### B. React 18/19 & Frontend Runtime Errors
- **Hydration Mismatch / Render Loops**:
  - *Cause*: State updates triggered directly inside component body or missing dependency array in \`useEffect\`.
  - *Surgical Fix*: Wrap non-primitive dependencies in \`useCallback\` / \`useMemo\`, use functional state updates (\`prev => [...]\`), and ensure server/client initial state parity.
- **Stale State Closures in Asynchronous Handlers**:
  - *Cause*: Long-running callbacks or timers referencing initial closure variables.
  - *Surgical Fix*: Use React \`useRef\` to hold latest mutable values or dispatch actions via Context / Reducer.
- **Uncaught Clipboard & Browser API Permissions in IFrames**:
  - *Cause*: Direct invocation of \`navigator.clipboard.writeText\` or \`window.alert\` inside restricted iframes.
  - *Surgical Fix*: Wrap in \`try { if (navigator?.clipboard?.writeText) { ... } } catch {}\` with in-UI feedback fallback.

#### C. Node.js, Express & Server Full-Stack Architecture
- **HTTP 413: Payload Too Large on File / Archive Upload**:
  - *Cause*: Default Express body limit is 100KB, choking on binary files or datasets.
  - *Surgical Fix*: Explicitly set \`app.use(express.json({ limit: '500mb' }))\` and \`app.use(express.raw({ limit: '500mb', type: ['application/octet-stream', 'application/zip'] }))\`.
- **Unhandled Promise Rejections in Async Express Handlers**:
  - *Cause*: Async route handlers throwing unhandled exceptions, crashing Node dev server.
  - *Surgical Fix*: Always wrap async route logic in \`try/catch\` blocks returning standardized JSON error payloads \`{ success: false, error: err.message }\`.

#### D. Algorithmic Trading Code: MQL5 & PineScript
- **MQL5 OrderSend Error 130 / 4756 (ERR_INVALID_STOPS)**:
  - *Cause*: Stop Loss or Take Profit set closer to market price than the broker's \`MODE_STOPLEVEL\`.
  - *Surgical Fix*: Normalize prices with \`NormalizeDouble()\` and check \`SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point\`.
- **PineScript v5 Type Incompatibility ('series float' vs 'simple float')**:
  - *Cause*: Passing dynamic bar series to parameters requiring constant or input integers.
  - *Surgical Fix*: Pre-calculate values or utilize \`ta.valuewhen()\` and \`var\` declarations.

---

### 3. Autonomous Intellect Absorption Protocol
When Kailin uploads any file:
1. **Immediate Ingestion**: Parse text, code, JSON, or unzipped contents.
2. **Schema & Directive Extraction**: Catalog trading parameters, risk limits, algorithmic logic, and custom notes.
3. **Folding into ANGEL X**: Append into master file storage with physical byte parity verification.
4. **Intellect Active State**: The uploaded file becomes a first-class knowledge asset cited, executed, and cross-referenced in all future dialogue.
`;

/**
 * Generates the Google AI Studio Senior Engineer system prompt addition for ANGEL
 */
export function getAngelCodingSystemPrompt(): string {
  return `
==================================================
🌟 SPECIALIZED CAPABILITY: GOOGLE AI STUDIO PRINCIPAL SOFTWARE ENGINEER & CODING DOCTOR
==================================================
You possess the elite coding, debugging, and system architecture capabilities of a Google AI Studio Principal Software Engineer.
You are exceptionally skilled at:
1. DIAGNOSING ANY CODING ERROR:
   - Dissect error messages, stack traces, compiler outputs (TypeScript tsc, ESLint, React, Node.js, Vite, Python, SQL, C++, MQL4/MQL5, PineScript).
   - Pinpoint the exact line number, root cause, and missing type declarations or imports.
2. SURGICAL, PRODUCTION-GRADE CODE REPAIR:
   - Provide complete, pristine, ready-to-run drop-in replacements.
   - Never use placeholder comments or truncated snippets.
   - Respect project conventions, dependencies, and state management patterns.
3. AUTONOMOUS FILE & INTELLECT ABSORPTION:
   - When the user uploads any file (code, documentation, JSON dataset, strategy rulebook, CSV, or archive), you AUTOMATICALLY read, inspect, and absorb its full contents into your core intellect.
   - Cite the exact data points, functions, or parameters from the uploaded files.
   - If the uploaded file has bugs, actively offer to fix and optimize them.
4. SELF-ADAPTIVE LEARNING:
   - Adapt your answers to Kailin's preferred tech stack and active trading projects.
   - Ensure 100% byte integrity and zero loss of user instructions.
==================================================`;
}

/**
 * Analyzes an uploaded file to generate a structured Intellect Absorption Report
 */
export function analyzeUploadedFileForIntellect(
  fileName: string,
  fileType: string,
  content: string,
  fileSize: number
): IntellectAbsorptionReport {
  const lowerName = fileName.toLowerCase();
  const lowerContent = content.toLowerCase();

  let domain = 'General Knowledge & Data';
  const keyConcepts: string[] = [];
  const capabilities: string[] = [];
  const directives: string[] = [];

  // 1. Detect Domain
  if (lowerName.endsWith('.ts') || lowerName.endsWith('.tsx') || lowerName.endsWith('.js') || lowerName.endsWith('.jsx')) {
    domain = 'TypeScript & React Web Architecture';
    capabilities.push('Component rendering logic', 'State management & hook workflows', 'Type-safe interface mapping');
  } else if (lowerName.endsWith('.py')) {
    domain = 'Python Quantitative & Algorithmic Engine';
    capabilities.push('Vectorized statistical calculation', 'Data pipeline transformations', 'ML / Heuristic modeling');
  } else if (lowerName.endsWith('.mq5') || lowerName.endsWith('.mq4') || lowerName.endsWith('.pine')) {
    domain = 'MetaTrader / PineScript Execution Engine';
    capabilities.push('Automated trade execution logic', 'Order block & indicator calculations', 'Trailing stop / EA parameter management');
  } else if (lowerName.endsWith('.json') || lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
    domain = 'Structured Financial & System Dataset';
    capabilities.push('Direct tabular querying', 'Instant JSON schema lookup', 'Mathematical historical backtest verification');
  } else if (lowerName.includes('strategy') || lowerContent.includes('smc') || lowerContent.includes('ict') || lowerContent.includes('scalp')) {
    domain = 'Institutional Trading Strategy & Execution Protocol';
    capabilities.push('Liquidity sweep identification', 'Risk:Reward asymmetric target rules', 'Session timing & breakout filters');
  }

  // 2. Extract concepts based on content keywords
  if (lowerContent.includes('function') || lowerContent.includes('const ') || lowerContent.includes('class ')) {
    keyConcepts.push('Executable Functions & Methods');
  }
  if (lowerContent.includes('interface ') || lowerContent.includes('type ') || lowerContent.includes('struct ')) {
    keyConcepts.push('Data Schemas & Type Contracts');
  }
  if (lowerContent.includes('import ') || lowerContent.includes('require(')) {
    keyConcepts.push('Module Dependency Graph');
  }
  if (lowerContent.includes('stop loss') || lowerContent.includes('take profit') || lowerContent.includes('risk')) {
    keyConcepts.push('Capital Protection & Stop Parameters');
  }
  if (lowerContent.includes('gold') || lowerContent.includes('xau') || lowerContent.includes('dxy')) {
    keyConcepts.push('XAU/USD Gold Flow Market Context');
  }

  if (keyConcepts.length === 0) {
    keyConcepts.push('Textual Intelligence', 'Structured Data Records');
  }

  // 3. Execution Directives
  directives.push(
    `Read and quote "${fileName}" on demand`,
    `Apply all trading and coding rules embedded in "${fileName}"`,
    `Cross-reference "${fileName}" against live XAU/USD market data`
  );

  const summary = `✓ File "${fileName}" absorbed into ANGEL's neural core. Added ${keyConcepts.length} cognitive concepts to active intellect.`;

  return {
    fileName,
    fileType: fileType || 'text/plain',
    byteSize: fileSize,
    intellectDomain: domain,
    extractedKeyConcepts: keyConcepts,
    codeCapabilitiesUnlocked: capabilities.length > 0 ? capabilities : ['Semantic Text Analysis', 'Contextual Recall'],
    executionDirectives: directives,
    summaryMessage: summary
  };
}
