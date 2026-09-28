import React from 'react';
import { LineChart, Clock, Compass, Activity, Sliders, Sparkles, Download } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { getCurrentSessionDetails } from '../utils/sessionManager';

export const Navigation: React.FC = () => {
  const { 
    activeInstrument,
    currentSession,
    isMarketClosed,
    marketClosureReason,
    timeframe,
    goldDataSource,
    activeProject,
    setIsAngelModalOpen,
    downloadAngelPackage,
    isDownloadingAngel
  } = useTrading();

  // Current Market Session context
  const sessionDetails = currentSession || getCurrentSessionDetails();

  return (
    <nav className="bg-[#090D15] border-b border-[#1A2234] sticky top-[57px] z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        
        {/* Left: Active Pair Badge & Resolution Indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs bg-[#101726] text-white border border-[#232F48] shadow-sm font-semibold font-mono">
            <LineChart className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 font-bold">{activeInstrument.symbol}</span>
            <span className="text-slate-400 font-sans font-normal text-[11px] hidden sm:inline">
              ({activeInstrument.name})
            </span>
            <span className="w-px h-3 bg-slate-700" />
            <span className="text-cyan-400 text-[10px] font-bold uppercase">{timeframe} Resolution</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Purple Key S/R Active</span>
          </div>

          {/* ANGEL Active Project Pill Button */}
          <button
            type="button"
            onClick={() => setIsAngelModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-mono bg-gradient-to-r from-amber-500/10 to-yellow-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 transition-all cursor-pointer shadow-sm"
            title={`ANGEL is adapted to ${activeProject.name}. Click to audit current setup.`}
          >
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="font-bold text-white">ANGEL:</span>
            <span className="text-amber-300 font-semibold">{activeProject.name}</span>
            <span className="text-[9px] px-1 rounded bg-[#0A0E18] text-slate-400 border border-[#1E2638] hidden sm:inline">
              R:R {activeProject.riskRewardRatio}
            </span>
          </button>

          {/* Quick Download AI ANGEL */}
          <button
            type="button"
            onClick={downloadAngelPackage}
            disabled={isDownloadingAngel}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-mono bg-[#111927] hover:bg-[#182336] text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-400 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            title="Download consolidated master intelligence file ANGEL X (.ZIP)"
          >
            <Download className={`w-3 h-3 text-amber-400 ${isDownloadingAngel ? 'animate-bounce' : ''}`} />
            <span className="font-semibold">{isDownloadingAngel ? 'Exporting...' : 'Download ANGEL X (.ZIP)'}</span>
          </button>
        </div>

        {/* Right side: Market Session & Status */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <div 
            title={isMarketClosed || sessionDetails.isMarketClosed 
              ? `Market Closed: ${marketClosureReason || sessionDetails.marketClosureReason || 'Weekend Close'}. Reopening in ${sessionDetails.timeUntilMarketOpenFormatted || 'Sunday 22:00 UTC'}` 
              : `Active Trading Session: ${sessionDetails.activeSessionsSummary}`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono ${
              isMarketClosed || sessionDetails.isMarketClosed
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                : 'bg-[#101622] border-[#1E2638] text-slate-300'
            }`}
          >
            <Clock className={`w-3 h-3 ${isMarketClosed || sessionDetails.isMarketClosed ? 'text-rose-400' : 'text-amber-400'}`} />
            <span className="text-slate-400">Trading Session:</span>
            {isMarketClosed || sessionDetails.isMarketClosed ? (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-rose-400 font-bold">INTERBANK CLOSE</span>
                {sessionDetails.timeUntilMarketOpenFormatted && (
                  <span className="text-slate-400 text-[10px]">({sessionDetails.timeUntilMarketOpenFormatted})</span>
                )}
              </div>
            ) : (
              <span className="text-amber-300 font-semibold">{sessionDetails.activeSessionsSummary}</span>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
};
