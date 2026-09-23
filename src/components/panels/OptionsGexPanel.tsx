import React from 'react';
import { 
  ShieldAlert, 
  Layers, 
  HelpCircle, 
  ExternalLink,
  Info,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';

export const OptionsGexPanel: React.FC = () => {
  const { activeInstrument } = useTrading();

  // Spot physical bullion (XAU/USD, XAU/EUR) is traded OTC (Over-The-Counter) in London/Zurich interbank markets.
  // Options flow and Gamma Exposure (GEX) are specific to CME COMEX Gold Options (OG) or GLD ETF options,
  // which require a dedicated Options Clearing Corporation (OCC) / OPRA market data subscription.
  const isOptionsApiConnected = false;

  return (
    <div className="bg-[#0D121D] border border-[#1E2638] rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1E2638]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Flame className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>OPTIONS FLOW & GAMMA EXPOSURE (GEX) PANEL</span>
              <span className="text-[10px] text-purple-400 font-mono px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">
                OPTIONS API REQUIRED
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Dealer gamma hedging exposure, strike open interest, and volatility skew
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
          Spot Bullion: {activeInstrument.symbol}
        </div>
      </div>

      {/* Main Content Area */}
      {!isOptionsApiConnected ? (
        <div className="p-5 rounded-xl bg-[#090E17] border border-[#1A2234] flex flex-col items-center text-center space-y-4">
          
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-purple-400" />
          </div>

          <div className="max-w-lg space-y-1.5">
            <h3 className="text-sm font-bold text-white font-mono">
              Options Flow & GEX Data Unavailable (Separate Options Source Required)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Spot <strong className="text-white">{activeInstrument.symbol}</strong> trades on OTC cash bullion markets. Genuine Gamma Exposure (GEX) and options order flow require a dedicated connection to CME COMEX Gold Options (OG) or SPDR Gold Shares (GLD) OPRA equity options chains.
            </p>
          </div>

          {/* Strict Regulatory & Technical Integrity Notice */}
          <div className="w-full max-w-xl p-4 rounded-xl bg-[#0E1422] border border-[#202B40] text-left text-xs font-mono space-y-2.5">
            <div className="flex items-center gap-2 text-purple-300 font-bold text-[11px]">
              <Info className="w-4 h-4 shrink-0" />
              <span>Technical Data Architecture Requirements:</span>
            </div>

            <ul className="space-y-1.5 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong className="text-white">Distinct Data Origin:</strong> Gold Options (OG) are cleared through CME Group, distinct from spot bullion quotes.
              </li>
              <li>
                <strong className="text-white">Strict Isolation:</strong> Equity index GEX (e.g. QQQ or SPX gamma) cannot be mapped to bullion and is strictly excluded.
              </li>
              <li>
                <strong className="text-white">No Synthetic Gammas:</strong> Simulated dealer positioning is prohibited to avoid misleading dealer-hedging thresholds.
              </li>
            </ul>

            <div className="pt-2 border-t border-[#1C263B] text-[10px] text-slate-500">
              * To activate this module in production, configure an OPRA/CME options data provider in system settings.
            </div>
          </div>

          {/* Inactive Matrix Placeholder */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 opacity-40 select-none">
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">CALL GAMMA (GEX)</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">PUT GAMMA (GEX)</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">GAMMA FLIP LEVEL</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#070A0F] border border-[#141C2B]">
              <span className="text-[10px] text-slate-500 block font-mono">MAX PAIN STRIKE</span>
              <span className="text-xs font-bold text-slate-400 font-mono">--</span>
            </div>
          </div>

        </div>
      ) : (
        /* If a future CME options feed is attached, this section renders active */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Active options GEX view */}
        </div>
      )}

    </div>
  );
};
