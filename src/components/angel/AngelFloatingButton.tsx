import React from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { useTrading } from '../../context/TradingContext';

export const AngelFloatingButton: React.FC = () => {
  const { isAngelModalOpen, setIsAngelModalOpen, activeProject } = useTrading();

  if (isAngelModalOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsAngelModalOpen(true)}
        className="group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-[#0D1424]/90 hover:bg-[#121B30] border border-amber-500/40 hover:border-amber-400 text-white shadow-xl shadow-black/60 backdrop-blur-md transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
        title={`Open ANGEL AI Companion (Adapted to ${activeProject.name})`}
      >
        {/* Pulsing Aura */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-cyan-500/30 blur-sm opacity-70 group-hover:opacity-100 transition-opacity" />

        {/* Halo Avatar */}
        <div className="relative w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center text-black shadow-md shadow-amber-500/30">
          <Sparkles className="w-4 h-4 text-black animate-pulse" />
          <span className="absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0D1424]" />
        </div>

        {/* Label */}
        <div className="relative flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold font-sans tracking-wide text-white group-hover:text-amber-300 transition-colors">
              ANGEL
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              AI
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono max-w-[120px] truncate">
            {activeProject.name}
          </span>
        </div>
      </button>
    </div>
  );
};
