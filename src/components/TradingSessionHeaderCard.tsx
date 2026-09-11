import React, { useState } from 'react';
import { 
  Globe, 
  Clock, 
  Sparkles, 
  TrendingUp, 
  Flame, 
  Sliders, 
  CheckCircle2, 
  ChevronRight, 
  ShieldCheck, 
  Zap,
  Info,
  Layers
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { TradingSessionId } from '../utils/sessionManager';

interface TradingSessionHeaderCardProps {
  compact?: boolean;
  onFilterBySession?: (sessionId: TradingSessionId | 'ALL') => void;
  selectedSessionFilter?: string;
  showSimControls?: boolean;
}

export const TradingSessionHeaderCard: React.FC<TradingSessionHeaderCardProps> = ({
  compact = false,
  onFilterBySession,
  selectedSessionFilter = 'ALL',
  showSimControls = true,
}) => {
  const { 
    currentSession, 
    sessionSimulationOverride, 
    setSessionSimulationOverride,
    activeInstrument 
  } = useTrading();

  const [showSimMenu, setShowSimMenu] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const {
    sessions,
    utcTimeString,
    primaryActiveSessionId,
    primaryActiveName,
    primaryActiveShort,
    primaryActiveFlag,
    primaryActiveVolatility,
    isHighLiquidityWindow,
    activeStrategyRecommendation,
    activeStrategyFilterHint,
    isOverlapActive
  } = currentSession;

  const sessionItems = [
    { key: 'asia', data: sessions.asia },
    { key: 'london', data: sessions.london },
    { key: 'newYork', data: sessions.newYork },
  ];

  return (
    <div className="bg-[#0e131d] border border-[#1E2638] rounded-xl p-3 sm:p-4 shadow-lg relative overflow-hidden">
      {/* Subtle background glow based on active session */}
      <div 
        className={`absolute -top-16 -right-16 w-60 h-60 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-700 ${
          isOverlapActive 
            ? 'bg-emerald-500' 
            : primaryActiveSessionId === 'NEW_YORK' 
            ? 'bg-amber-500' 
            : primaryActiveSessionId === 'LONDON' 
            ? 'bg-sky-500' 
            : primaryActiveSessionId === 'ASIAN' 
            ? 'bg-indigo-500' 
            : 'bg-slate-500'
        }`} 
      />

      {/* Header Row: Title, Active Session Status & Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#1E2638] relative z-10">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Globe className="w-4 h-4" />
            </span>
            <span className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase font-mono">
              Market Session Context
            </span>
          </div>

          {/* Active Highlight Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold border transition-all ${
            isOverlapActive
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
              : primaryActiveSessionId === 'NEW_YORK'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20'
              : primaryActiveSessionId === 'LONDON'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20'
              : primaryActiveSessionId === 'ASIAN'
              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-sm shadow-indigo-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
            </span>
            <span>{primaryActiveFlag} {primaryActiveName.toUpperCase()}</span>
            {isHighLiquidityWindow && (
              <span className="hidden md:inline px-1.5 py-0.2 rounded bg-black/40 text-[10px] text-amber-300 ml-1">
                PEAK VOLUME
              </span>
            )}
          </div>
        </div>

        {/* Right side: UTC Clock & Session Clock Tester */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#090D14] border border-[#1E2638] text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{utcTimeString}</span>
          </div>

          {showSimControls && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSimMenu(!showSimMenu)}
                title="Simulate different market sessions for testing"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                  sessionSimulationOverride !== 'LIVE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-[#090D14] text-slate-400 border-[#1E2638] hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>Clock: {sessionSimulationOverride === 'LIVE' ? 'Live UTC' : sessionSimulationOverride}</span>
              </button>

              {showSimMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-[#121824] border border-[#1E2638] rounded-lg shadow-2xl p-2 z-50 text-xs font-mono">
                  <div className="text-[10px] text-slate-400 font-bold uppercase pb-1 mb-1 border-b border-[#1E2638]">
                    Test Session Dynamics
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => { setSessionSimulationOverride('LIVE'); setShowSimMenu(false); }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center justify-between cursor-pointer ${
                        sessionSimulationOverride === 'LIVE' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:bg-[#1A2234]'
                      }`}
                    >
                      <span>⏱️ Live UTC Real-Time</span>
                      {sessionSimulationOverride === 'LIVE' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setSessionSimulationOverride('ASIAN'); setShowSimMenu(false); }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center justify-between cursor-pointer ${
                        sessionSimulationOverride === 'ASIAN' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-300 hover:bg-[#1A2234]'
                      }`}
                    >
                      <span>🌏 Asia Open (03:30 UTC)</span>
                      {sessionSimulationOverride === 'ASIAN' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setSessionSimulationOverride('LONDON'); setShowSimMenu(false); }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center justify-between cursor-pointer ${
                        sessionSimulationOverride === 'LONDON' ? 'bg-sky-500 text-white font-bold' : 'text-slate-300 hover:bg-[#1A2234]'
                      }`}
                    >
                      <span>🇬🇧 London Open (09:30 UTC)</span>
                      {sessionSimulationOverride === 'LONDON' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setSessionSimulationOverride('LONDON_NY_OVERLAP'); setShowSimMenu(false); }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center justify-between cursor-pointer ${
                        sessionSimulationOverride === 'LONDON_NY_OVERLAP' ? 'bg-emerald-500 text-black font-bold' : 'text-slate-300 hover:bg-[#1A2234]'
                      }`}
                    >
                      <span>⚡ LDN/NY Overlap (13:45 UTC)</span>
                      {sessionSimulationOverride === 'LONDON_NY_OVERLAP' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => { setSessionSimulationOverride('NEW_YORK'); setShowSimMenu(false); }}
                      className={`w-full text-left px-2 py-1 rounded flex items-center justify-between cursor-pointer ${
                        sessionSimulationOverride === 'NEW_YORK' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:bg-[#1A2234]'
                      }`}
                    >
                      <span>🇺🇸 NY Cash Open (16:30 UTC)</span>
                      {sessionSimulationOverride === 'NEW_YORK' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Three Primary Session Status Columns: Asia, London, New York */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3 relative z-10">
        {sessionItems.map(({ key, data }) => {
          const isActive = data.isActive;
          const isSelected = selectedSessionFilter === data.id;

          return (
            <div
              key={key}
              onClick={() => onFilterBySession && onFilterBySession(data.id)}
              className={`rounded-lg p-2.5 border transition-all duration-300 relative ${
                isActive 
                  ? `${data.color.bg} ${data.color.border} shadow-md ${data.color.glow} ring-1 ring-white/10` 
                  : 'bg-[#090D14] border-[#1E2638] opacity-75 hover:opacity-100 hover:border-slate-700'
              } ${onFilterBySession ? 'cursor-pointer' : ''}`}
            >
              {/* Top Row: Flag, Name, Status Badge */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{data.flag}</span>
                  <span className="font-bold text-white text-xs font-mono">
                    {data.shortName}
                  </span>
                </div>

                <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                  isActive 
                    ? `${data.color.badgeBg} ${data.color.text} border ${data.color.border}` 
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                }`}>
                  {isActive ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span>OPEN</span>
                    </>
                  ) : (
                    <span>CLOSED</span>
                  )}
                </div>
              </div>

              {/* Hours & Time Remaining */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <span>{data.utcHours}</span>
                <span className={isActive ? data.color.text : 'text-slate-500'}>
                  {data.timeRemainingFormatted}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#05080E] h-1.5 rounded-full overflow-hidden mb-2 border border-slate-800">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    isActive 
                      ? key === 'asia' ? 'bg-indigo-400' : key === 'london' ? 'bg-sky-400' : 'bg-amber-400' 
                      : 'bg-slate-700'
                  }`}
                  style={{ width: `${isActive ? data.progressPercent : 0}%` }}
                />
              </div>

              {/* Session Characteristics / Strategy Hint */}
              <div className="text-[10px] font-mono text-slate-400 leading-tight line-clamp-2">
                <span className="text-slate-500">Focus: </span>
                <span className={isActive ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                  {data.keyStrategies[0]}
                </span>
              </div>

              {/* Overlap indicator if NY & London are both active */}
              {isOverlapActive && (key === 'london' || key === 'newYork') && (
                <div className="mt-1.5 pt-1 border-t border-emerald-500/20 flex items-center justify-between text-[10px] font-mono text-emerald-400">
                  <span className="flex items-center gap-1 font-bold">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>OVERLAP WINDOW</span>
                  </span>
                  <span className="text-[9px] text-emerald-300/80">Peak Volatility</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Immediate Strategy Filter Context Strip */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-[#1E2638] flex flex-col md:flex-row md:items-center justify-between gap-2.5 relative z-10">
          <div className="flex items-start sm:items-center gap-2 text-xs">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div className="text-slate-300">
              <span className="text-amber-300 font-bold font-mono mr-1">
                Strategy Confluence Context:
              </span>
              <span className="text-slate-300 font-sans">
                {activeStrategyFilterHint}
              </span>
            </div>
          </div>

          {/* Instrument Specific Dynamic Tip */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#141B28] text-slate-300 border border-[#1E2638]">
              {activeInstrument.symbol}: <strong className="text-emerald-400">{primaryActiveVolatility}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
