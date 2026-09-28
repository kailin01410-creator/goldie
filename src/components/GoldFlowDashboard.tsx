import React, { useState } from 'react';
import { 
  BarChart2, 
  Sliders, 
  Activity, 
  Layers, 
  Flame, 
  Maximize2, 
  LayoutGrid,
  Sparkles,
  Download
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { LiveChartPanel } from './panels/LiveChartPanel';
import { MarketOverviewPanel } from './panels/MarketOverviewPanel';
import { TechnicalAnalysisPanel } from './panels/TechnicalAnalysisPanel';
import { OrderFlowPanel } from './panels/OrderFlowPanel';
import { OptionsGexPanel } from './panels/OptionsGexPanel';

export const GoldFlowDashboard: React.FC = () => {
  const [activeLayoutView, setActiveLayoutView] = useState<'ALL' | 'CHART_PRIMARY' | 'ANALYTICS'>('ALL');
  const { setIsAngelModalOpen, activeProject, downloadAngelPackage, isDownloadingAngel } = useTrading();

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      
      {/* View Filter Toggles */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 bg-[#0D121D] p-1 rounded-xl border border-[#1E2638] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveLayoutView('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayoutView === 'ALL'
                ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-[#141B2D]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>All 5 Terminal Panels</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveLayoutView('CHART_PRIMARY')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayoutView === 'CHART_PRIMARY'
                ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-[#141B2D]'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Chart & Technicals</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveLayoutView('ANALYTICS')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeLayoutView === 'ANALYTICS'
                ? 'bg-cyan-500 text-black shadow-sm shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-[#141B2D]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Market, Flow & GEX</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Download My AI ANGEL & All Files Button */}
          <button
            id="dashboard-download-angel-btn"
            type="button"
            onClick={downloadAngelPackage}
            disabled={isDownloadingAngel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/25 via-amber-500/20 to-yellow-500/20 hover:from-amber-600/40 hover:to-yellow-500/35 border border-amber-500/50 hover:border-amber-400 text-amber-200 font-mono text-xs transition-all cursor-pointer shadow-sm shadow-amber-500/10 active:scale-95 disabled:opacity-50"
            title="Download consolidated master intelligence file ANGEL X (.ZIP)"
          >
            <Download className={`w-3.5 h-3.5 text-amber-400 ${isDownloadingAngel ? 'animate-bounce' : ''}`} />
            <span className="font-bold text-white hidden sm:inline">{isDownloadingAngel ? 'Packaging...' : 'Download ANGEL X'}</span>
            <span className="font-bold text-white sm:hidden">ANGEL X</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAngelModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-yellow-500/15 hover:from-amber-500/25 hover:to-yellow-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-mono text-xs transition-all cursor-pointer shadow-sm"
            title={`Consult ANGEL AI Companion (Adapted to ${activeProject.name})`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-bold text-white">ANGEL AI</span>
            <span className="text-amber-300 font-semibold hidden md:inline">• {activeProject.name}</span>
          </button>

          <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
            GoldFlow Pro Terminal v2.4 • Live Bullion Engine
          </div>
        </div>
      </div>

      {/* PANEL 1: LIVE GOLD PRICE CHART */}
      {(activeLayoutView === 'ALL' || activeLayoutView === 'CHART_PRIMARY') && (
        <section aria-label="Live Gold Price Chart">
          <LiveChartPanel />
        </section>
      )}

      {/* PANEL 2: MARKET OVERVIEW */}
      {(activeLayoutView === 'ALL' || activeLayoutView === 'ANALYTICS') && (
        <section aria-label="Market Overview">
          <MarketOverviewPanel />
        </section>
      )}

      {/* PANEL 3: TECHNICAL ANALYSIS ENGINE */}
      {(activeLayoutView === 'ALL' || activeLayoutView === 'CHART_PRIMARY') && (
        <section aria-label="Technical Analysis">
          <TechnicalAnalysisPanel />
        </section>
      )}

      {/* PANELS 4 & 5: ORDER-FLOW & OPTIONS/GEX PANELS */}
      {(activeLayoutView === 'ALL' || activeLayoutView === 'ANALYTICS') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* PANEL 4: ORDER-FLOW PANEL */}
          <section aria-label="Order-Flow Panel">
            <OrderFlowPanel />
          </section>

          {/* PANEL 5: OPTIONS/GEX PANEL */}
          <section aria-label="Options and GEX Panel">
            <OptionsGexPanel />
          </section>
        </div>
      )}

    </div>
  );
};
