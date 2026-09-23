import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock, Check } from 'lucide-react';
import { TimeframeId } from '../types';
import { DOMINION_TIMEFRAMES, QUICK_ACCESS_TIMEFRAMES, getDominionTimeframe } from '../data/timeframes';

interface DominionTimeframeSelectorProps {
  activeTimeframe: TimeframeId;
  onSelectTimeframe: (tf: TimeframeId) => void;
  variant?: 'compact' | 'standard';
  themeColor?: 'cyan' | 'amber';
}

export const DominionTimeframeSelector: React.FC<DominionTimeframeSelectorProps> = ({
  activeTimeframe,
  onSelectTimeframe,
  themeColor = 'cyan',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSpec = getDominionTimeframe(activeTimeframe);
  const isQuickActive = QUICK_ACCESS_TIMEFRAMES.some(t => t.id === activeTimeframe);

  // Group by category for the popover menu
  const minuteTfs = DOMINION_TIMEFRAMES.filter(t => t.category === 'MINUTES');
  const hourTfs = DOMINION_TIMEFRAMES.filter(t => t.category === 'HOURS');
  const macroTfs = DOMINION_TIMEFRAMES.filter(t => t.category === 'DAYS_MONTHS');

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const activeBg = themeColor === 'cyan' 
    ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/25' 
    : 'bg-amber-500 text-black shadow-sm shadow-amber-500/25';

  const badgeBorder = themeColor === 'cyan'
    ? 'border-cyan-500/40 text-cyan-300'
    : 'border-amber-500/40 text-amber-300';

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <div className="flex items-center bg-[#080C14] p-1 rounded-xl border border-[#1E2638] text-xs font-mono">
        
        {/* Quick Access Timeframes */}
        {QUICK_ACCESS_TIMEFRAMES.map(tf => {
          const isSelected = activeTimeframe === tf.id;
          return (
            <button
              key={tf.id}
              type="button"
              id={`dominion-tf-${tf.id}`}
              onClick={() => onSelectTimeframe(tf.id)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                isSelected
                  ? activeBg
                  : 'text-slate-400 hover:text-white hover:bg-[#141B2D]'
              }`}
              title={`${tf.mt5Code} - ${tf.description}`}
            >
              {tf.mt5Code}
            </button>
          );
        })}

        {/* If an extended timeframe is selected that's not in quick access, show it explicitly */}
        {!isQuickActive && (
          <button
            type="button"
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${activeBg}`}
            title={`Active: ${activeSpec.mt5Code} - ${activeSpec.description}`}
          >
            {activeSpec.mt5Code}
          </button>
        )}

        {/* Dropdown Menu Trigger for All Dominion Markets Periods */}
        <button
          type="button"
          id="dominion-tf-menu-trigger"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ml-0.5 border ${
            isOpen || !isQuickActive
              ? `bg-[#131B2B] ${badgeBorder}`
              : 'border-transparent text-slate-400 hover:text-white hover:bg-[#141B2D]'
          }`}
          title="All Dominion Markets & MT5 Timeframes (16 Periods)"
        >
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] hidden sm:inline">Dominion TF</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dominion Markets Comprehensive Timeframes Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 sm:w-96 bg-[#0B101A] border border-[#232F48] rounded-xl shadow-2xl p-3 text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E2638]">
            <div className="flex items-center gap-1.5 font-mono">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white tracking-wide">Dominion Markets Timeframes</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              16 Periods (MT5 / cTrader)
            </span>
          </div>

          <div className="space-y-3 font-mono">
            {/* Minutes Section */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                <span>Minutes</span>
                <span className="text-slate-500 text-[9px]">Scalping & Order Flow</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                {minuteTfs.map(tf => {
                  const isSelected = activeTimeframe === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => {
                        onSelectTimeframe(tf.id);
                        setIsOpen(false);
                      }}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? themeColor === 'cyan'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-[#0E1524] border-[#1B2438] text-slate-300 hover:text-white hover:bg-[#172238] hover:border-slate-600'
                      }`}
                      title={tf.description}
                    >
                      <span className="font-bold text-xs">{tf.mt5Code}</span>
                      <span className="text-[9px] text-slate-400 font-sans">{tf.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours Section */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                <span>Hours</span>
                <span className="text-slate-500 text-[9px]">Session Structure & Swings</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {hourTfs.map(tf => {
                  const isSelected = activeTimeframe === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => {
                        onSelectTimeframe(tf.id);
                        setIsOpen(false);
                      }}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? themeColor === 'cyan'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-[#0E1524] border-[#1B2438] text-slate-300 hover:text-white hover:bg-[#172238] hover:border-slate-600'
                      }`}
                      title={tf.description}
                    >
                      <span className="font-bold text-xs">{tf.mt5Code}</span>
                      <span className="text-[9px] text-slate-400 font-sans">{tf.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Days, Weeks, Months Section */}
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                <span>Days & Macro</span>
                <span className="text-slate-500 text-[9px]">Dominion Higher Timeframe Trend</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {macroTfs.map(tf => {
                  const isSelected = activeTimeframe === tf.id;
                  return (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => {
                        onSelectTimeframe(tf.id);
                        setIsOpen(false);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? themeColor === 'cyan'
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                            : 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-[#0E1524] border-[#1B2438] text-slate-300 hover:text-white hover:bg-[#172238] hover:border-slate-600'
                      }`}
                      title={tf.description}
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-bold text-xs">{tf.mt5Code}</span>
                        <span className="text-[9px] text-slate-400 font-sans">{tf.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-3 pt-2 border-t border-[#1E2638] text-[10px] text-slate-400 font-sans flex items-center justify-between">
            <span>Standard Dominion Markets cTrader / MT5 periods</span>
            <span className="text-slate-300 font-mono font-semibold">{activeSpec.description}</span>
          </div>

        </div>
      )}
    </div>
  );
};
