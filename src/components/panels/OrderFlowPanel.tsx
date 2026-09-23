import React from 'react';
import { 
  BarChart3, 
  AlertCircle, 
  Info, 
  ShieldAlert, 
  Database,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';

export const OrderFlowPanel: React.FC = () => {
  const { goldDataSource, activeInstrument } = useTrading();

  // GoldAPI.io and physical bullion spot feeds provide interbank Level 1 spot settlement rates (Bid, Ask, Price, High, Low, Chg),
  // but DO NOT provide full Level 2/3 CME COMEX Depth of Market (DOM) tick order book data (Aggressor Bid Vol vs Ask Vol, Delta).
  const isOrderFlowAvailable = false;

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E2638]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>ORDER-FLOW & VOLUME PROFILE PANEL</span>
              <span className="text-[10px] text-amber-400 font-mono px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                LEVEL 2/3 REQUIRED
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Aggressor trade delta, cumulative delta, and volume-at-price distribution
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Feed: <strong className="text-amber-300">{goldDataSource}</strong>
        </div>
      </div>

      {/* Main Content Area */}
      {!isOrderFlowAvailable ? (
        <div className="p-5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col items-center text-center space-y-4">
          
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-400" />
          </div>

          <div className="max-w-md space-y-1.5">
            <h3 className="text-sm font-bold text-white font-mono">
              Order-flow data unavailable from current provider
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The connected bullion feed (<span className="text-amber-300 font-mono">{goldDataSource}</span>) delivers official Level 1 physical spot settlement pricing for <strong className="text-white">{activeInstrument.symbol}</strong>, but does not transmit granular tick-level aggressor order flow (Level 2/3 depth).
            </p>
          </div>

          {/* Transparent Technical Activation Requirement Box */}
          <div className="w-full max-w-xl p-4 rounded-xl bg-[#0E1422] border border-[#202B40] text-left text-xs font-mono space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-[11px]">
              <Info className="w-4 h-4 shrink-0" />
              <span>Data Specifications Needed to Activate This Panel:</span>
            </div>
            
            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong className="text-white">Level 2 / Level 3 Market Depth (DOM):</strong> Direct CME / COMEX Gold Futures (GC) tick feed with individual matched trade prints.
              </li>
              <li>
                <strong className="text-white">Aggressor Classification:</strong> Bid Volume vs. Ask Volume separation to compute Delta per price level.
              </li>
              <li>
                <strong className="text-white">Volume at Price:</strong> Continuous execution histograms to determine Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).
              </li>
            </ul>

            <div className="pt-2 border-t border-[#1C263B] text-[10px] text-slate-500">
              * Per professional compliance standards, synthetic bid/ask volume and artificial delta are strictly withheld to preserve trading accuracy.
            </div>
          </div>

          {/* Inactive Feature Preview Grid (Grayed out with transparent placeholders) */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 opacity-40 select-none">
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">BUY VOLUME</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">SELL VOLUME</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">SESSION DELTA</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">POINT OF CONTROL</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
          </div>

        </div>
      ) : (
        /* If a future Level 2 CME provider is attached, this section renders active */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active volume profile view */}
        </div>
      )}

    </div>
  );
};
