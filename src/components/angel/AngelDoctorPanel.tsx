/**
 * ANGEL Doctor — the self-diagnosis surface.
 *
 * Every row is a real probe that ran on the server, with the exact location of
 * the problem and a concrete instruction for fixing it. Checks ANGEL can repair
 * itself are repaired by the "Run self-repair" button, which re-runs the whole
 * suite afterwards and reports the score before and after, so the user can see
 * that something actually changed.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileCode2,
  Info,
  RefreshCw,
  Stethoscope,
  Wrench,
} from 'lucide-react';

type Severity = 'OK' | 'INFO' | 'WARN' | 'CRITICAL';

interface CheckResult {
  id: string;
  title: string;
  area: 'CONFIG' | 'MODEL' | 'STORAGE' | 'KNOWLEDGE' | 'COMPUTE' | 'CODE' | 'RUNTIME';
  severity: Severity;
  detail: string;
  location?: string;
  remediation?: string;
  repaired?: boolean;
  evidence?: string[];
  durationMs: number;
}

interface DiagnosticsReport {
  generatedAt: string;
  healthy: boolean;
  score: number;
  counts: Record<Severity, number>;
  checks: CheckResult[];
  router: {
    active: string | null;
    available: string[];
    /** Model id → the permanent error that took it out of rotation. */
    blacklisted: Record<string, string>;
    lastError: string | null;
    discoverySource: 'api' | 'preference-probe' | 'none';
    consecutiveFailures: number;
  };
  summary: string;
  repairsApplied: string[];
}

interface SelfHealResponse {
  scoreBefore: number;
  scoreAfter: number;
  repairsApplied: string[];
  remaining: CheckResult[];
  report: DiagnosticsReport;
}

const SEVERITY_STYLE: Record<Severity, { chip: string; row: string; icon: React.ReactNode; label: string }> = {
  OK: {
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    row: 'border-[#1B2740]',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    label: 'Passing',
  },
  INFO: {
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    row: 'border-[#1B2740]',
    icon: <Info className="w-4 h-4 text-sky-400" />,
    label: 'Note',
  },
  WARN: {
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    row: 'border-amber-500/25',
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    label: 'Degraded',
  },
  CRITICAL: {
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    row: 'border-rose-500/30',
    icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
    label: 'Broken',
  },
};

const AREA_ICON: Record<CheckResult['area'], React.ReactNode> = {
  CONFIG: <Wrench className="w-3 h-3" />,
  MODEL: <Cpu className="w-3 h-3" />,
  STORAGE: <Activity className="w-3 h-3" />,
  KNOWLEDGE: <Activity className="w-3 h-3" />,
  COMPUTE: <Activity className="w-3 h-3" />,
  CODE: <FileCode2 className="w-3 h-3" />,
  RUNTIME: <Activity className="w-3 h-3" />,
};

function scoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-rose-400';
}

export const AngelDoctorPanel: React.FC = () => {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healSummary, setHealSummary] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/angel/diagnostics');
      if (!response.ok) throw new Error(`Diagnostics endpoint returned HTTP ${response.status}`);
      const data: DiagnosticsReport = await response.json();
      setReport(data);
      // Open the failing checks by default — those are the ones worth reading.
      setExpanded(new Set(data.checks.filter((c) => c.severity === 'CRITICAL' || c.severity === 'WARN').map((c) => c.id)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reach the diagnostics endpoint.');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const runSelfHeal = useCallback(async () => {
    setIsHealing(true);
    setError(null);
    setHealSummary(null);
    try {
      const response = await fetch('/api/angel/self-heal', { method: 'POST' });
      if (!response.ok) throw new Error(`Self-repair returned HTTP ${response.status}`);
      const data: SelfHealResponse = await response.json();
      setReport(data.report);
      setExpanded(new Set(data.remaining.map((c) => c.id)));
      setHealSummary(
        data.repairsApplied.length > 0
          ? `Health ${data.scoreBefore} → ${data.scoreAfter}. Repaired: ${data.repairsApplied.join('; ')}.`
          : `Health ${data.scoreAfter}/100. Nothing could be repaired automatically${
              data.remaining.length > 0 ? ` — ${data.remaining.length} item(s) need you.` : ' because nothing is broken.'
            }`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Self-repair failed.');
    } finally {
      setIsHealing(false);
    }
  }, []);

  useEffect(() => {
    void runDiagnostics();
  }, [runDiagnostics]);

  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const busy = isRunning || isHealing;

  return (
    <div className="flex-1 overflow-y-auto bg-[#080B12] p-4 space-y-4 no-scrollbar">
      {/* Header card */}
      <div className="rounded-2xl border border-[#1D2942] bg-[#0C1322] p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ANGEL Doctor</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl leading-relaxed">
                Every check below actually ran just now. Failing checks name the file and line, and say exactly what to do.
                Anything ANGEL can safely fix on its own is fixed by Run self-repair.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#131C2E] hover:bg-[#1A253D] text-slate-200 border border-[#23314E] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Checking…' : 'Re-run checks'}
            </button>
            <button
              type="button"
              onClick={runSelfHeal}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Wrench className={`w-3.5 h-3.5 ${isHealing ? 'animate-pulse' : ''}`} />
              {isHealing ? 'Repairing…' : 'Run self-repair'}
            </button>
          </div>
        </div>

        {report && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-[#0A0F1B] border border-[#1B2740] p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Health</div>
              <div className={`text-2xl font-bold font-mono ${scoreColor(report.score)}`}>{report.score}<span className="text-sm text-slate-500">/100</span></div>
            </div>
            <div className="rounded-xl bg-[#0A0F1B] border border-[#1B2740] p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Broken</div>
              <div className="text-2xl font-bold font-mono text-rose-400">{report.counts.CRITICAL}</div>
            </div>
            <div className="rounded-xl bg-[#0A0F1B] border border-[#1B2740] p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Degraded</div>
              <div className="text-2xl font-bold font-mono text-amber-400">{report.counts.WARN}</div>
            </div>
            <div className="rounded-xl bg-[#0A0F1B] border border-[#1B2740] p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">Model in use</div>
              <div className="text-xs font-mono text-slate-200 mt-1 break-all">
                {report.router.active ?? <span className="text-amber-400">none — offline core</span>}
              </div>
            </div>
          </div>
        )}

        {report && (
          <p className="mt-3 text-[11px] font-mono text-slate-400">{report.summary}</p>
        )}

        {healSummary && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-mono text-emerald-300">
            {healSummary}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-mono text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Model routing */}
      {report && (Object.keys(report.router.blacklisted).length > 0 || report.router.lastError) && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <h4 className="text-xs font-bold text-amber-200 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" /> Model routing
          </h4>
          {report.router.lastError && (
            <p className="mt-2 text-[11px] font-mono text-amber-300/90 break-words">Last error: {report.router.lastError}</p>
          )}
          {Object.keys(report.router.blacklisted).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(report.router.blacklisted).map(([model, reason]) => (
                <li key={model} className="text-[11px] font-mono text-slate-400">
                  <span className="text-slate-300">{model}</span> — skipped: {reason}
                </li>
              ))}
            </ul>
          )}
          {report.router.available.length > 0 && (
            <p className="mt-2 text-[11px] font-mono text-slate-500">
              Reachable: {report.router.available.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Checks */}
      <div className="space-y-2">
        {!report && isRunning && (
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2 p-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running diagnostics…
          </div>
        )}

        {report?.checks.map((check) => {
          const style = SEVERITY_STYLE[check.severity];
          const isOpen = expanded.has(check.id);
          const hasDetail = Boolean(check.location || check.remediation || (check.evidence && check.evidence.length > 0));

          return (
            <div key={check.id} className={`rounded-xl border bg-[#0C1322] ${style.row}`}>
              <button
                type="button"
                onClick={() => hasDetail && toggle(check.id)}
                className={`w-full flex items-start gap-3 p-3 text-left ${hasDetail ? 'cursor-pointer hover:bg-[#101829]' : 'cursor-default'} transition-colors rounded-xl`}
              >
                <span className="mt-0.5 shrink-0">{style.icon}</span>

                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-100">{check.title}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${style.chip}`}>{style.label}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#131C2E] text-slate-400 border border-[#23314E] flex items-center gap-1">
                      {AREA_ICON[check.area]} {check.area}
                    </span>
                    {check.repaired && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        repaired automatically
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-slate-600">{check.durationMs}ms</span>
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1 leading-relaxed">{check.detail}</span>
                </span>

                {hasDetail && (
                  <span className="shrink-0 mt-0.5 text-slate-500">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                )}
              </button>

              {isOpen && hasDetail && (
                <div className="px-3 pb-3 pt-0 ml-7 space-y-2">
                  {check.location && (
                    <div className="text-[11px] font-mono">
                      <span className="text-slate-500">Location: </span>
                      <span className="text-cyan-300 break-all">{check.location}</span>
                    </div>
                  )}

                  {check.remediation && (
                    <div className="rounded-lg border border-[#23314E] bg-[#0A0F1B] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono mb-1">How to fix</div>
                      <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{check.remediation}</div>
                    </div>
                  )}

                  {check.evidence && check.evidence.length > 0 && (
                    <div className="rounded-lg border border-[#1B2740] bg-[#070A11] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono mb-1">Evidence</div>
                      <ul className="space-y-1">
                        {check.evidence.map((line, index) => (
                          <li key={index} className="text-[10px] font-mono text-slate-400 break-all leading-relaxed">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {report && (
        <p className="text-[10px] font-mono text-slate-600 text-center pb-2">
          Last run {new Date(report.generatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};
