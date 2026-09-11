import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  XCircle, 
  RotateCcw, 
  CheckCircle2,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

export const PaperPositionsTab: React.FC = () => {
  const { 
    balance, 
    equity, 
    openPositions, 
    closedPositions, 
    closePosition, 
    setBreakEven, 
    resetPaperAccount,
    adminProfile,
  } = useTrading();

  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);

  const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + pos.pnlDollars, 0);
  const totalUnrealizedPips = openPositions.reduce((sum, pos) => sum + pos.pnlPips, 0);
  
  // Closed trades stats
  const totalClosedPnL = closedPositions.reduce((sum, pos) => sum + pos.pnlDollars, 0);
  const winningTrades = closedPositions.filter(pos => pos.pnlDollars > 0).length;
  const closedWinRate = closedPositions.length > 0 
    ? ((winningTrades / closedPositions.length) * 100).toFixed(1)
    : '0.0';

  const marginUsed = openPositions.reduce((sum, pos) => sum + (pos.lotSize * 1000), 0) / (adminProfile.accountLeverage / 100);
  const freeMargin = Math.max(0, equity - marginUsed);

  return (
    <div className="space-y-4">
      
      {/* Top Account Overview Metrics Card */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-5 h-5 text-amber-400" />
              <h1 className="text-base sm:text-lg font-bold text-white font-mono">
                Institutional Paper Scalping Desk
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Simulated real-time order execution with live floating P&L, break-even protection, and position management.
            </p>
          </div>

          {/* Quick Account Reset */}
          <div className="flex items-center gap-2">
            {confirmResetOpen ? (
              <div className="flex items-center gap-2 bg-[#0B0E14] p-1.5 rounded-lg border border-amber-500/40">
                <span className="text-xs text-amber-300 font-mono">Reset to:</span>
                {[10000, 50000, 100000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => {
                      resetPaperAccount(amt);
                      setConfirmResetOpen(false);
                    }}
                    className="px-2 py-0.5 rounded text-xs font-mono bg-amber-500 text-black font-bold hover:bg-amber-400"
                  >
                    ${amt / 1000}k
                  </button>
                ))}
                <button
                  onClick={() => setConfirmResetOpen(false)}
                  className="text-xs text-slate-400 hover:text-white px-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                id="reset-account-btn"
                onClick={() => setConfirmResetOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#0B0E14] hover:bg-[#1A2234] border border-[#1E2638] text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Balance</span>
              </button>
            )}
          </div>
        </div>

        {/* Financial KPIs Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-4 font-mono">
          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Account Balance</span>
            <span className="text-base font-bold text-white">
              ${(balance ?? 50000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Floating Equity</span>
            <span className={`text-base font-bold ${(equity ?? 0) >= (balance ?? 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${(equity ?? 50000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Floating P&L</span>
            <span className={`text-base font-bold ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {totalUnrealizedPips >= 0 ? '+' : ''}{totalUnrealizedPips.toFixed(1)} pips
            </span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Realized P&L</span>
            <span className={`text-base font-bold ${totalClosedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalClosedPnL >= 0 ? '+' : ''}${totalClosedPnL.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block">{closedPositions.length} closed</span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Win Rate (Session)</span>
            <span className="text-base font-bold text-amber-300">
              {closedWinRate}%
            </span>
            <span className="text-[10px] text-slate-400 block">{winningTrades} W / {closedPositions.length - winningTrades} L</span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638]">
            <span className="text-[10px] text-slate-400 block uppercase">Free Margin</span>
            <span className="text-base font-bold text-cyan-400">
              ${freeMargin.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block">Lev: 1:{adminProfile.accountLeverage}</span>
          </div>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 bg-[#0E131D] border-b border-[#1E2638] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Open Scalp Positions ({openPositions.length})
            </h2>
          </div>
          
          {openPositions.length > 0 && (
            <button
              onClick={() => openPositions.forEach(p => closePosition(p.id, 'MANUAL_CLOSE'))}
              className="text-[11px] font-mono px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition-colors border border-rose-500/30 cursor-pointer"
            >
              Close All Positions
            </button>
          )}
        </div>

        {openPositions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
            <p>No active positions currently open.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Go to the <strong>Scalp Generator</strong> tab to generate and execute an instant pre-backtested scalp signal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E2638] text-slate-400 text-[11px] bg-[#0B0E14]/60">
                  <th className="py-3 px-4">Position ID</th>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Lots</th>
                  <th className="py-3 px-4">Entry</th>
                  <th className="py-3 px-4">Current</th>
                  <th className="py-3 px-4">SL / TP</th>
                  <th className="py-3 px-4">P&L ($)</th>
                  <th className="py-3 px-4">P&L (Pips)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2234]">
                {openPositions.map((pos, idx) => {
                  const isProfit = pos.pnlDollars >= 0;
                  return (
                    <tr key={`${pos.id}-${idx}`} className="hover:bg-[#161F30]/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400">{pos.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{pos.symbol}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.direction === 'BUY' ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                        }`}>
                          {pos.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-200">{pos.lotSize}</td>
                      <td className="py-3 px-4 text-slate-200">{pos.entryPrice}</td>
                      <td className="py-3 px-4 font-bold text-white">{pos.currentPrice}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-300">
                        <span className="text-rose-400 block">SL: {pos.stopLoss}</span>
                        <span className="text-emerald-400 block">TP: {pos.takeProfit}</span>
                      </td>
                      <td className={`py-3 px-4 font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${pos.pnlDollars.toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{pos.pnlPips}p
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          id={`be-btn-${pos.id}`}
                          onClick={() => setBreakEven(pos.id)}
                          title="Move Stop Loss to Entry (Risk-Free)"
                          className="px-2 py-1 rounded bg-[#0B0E14] text-amber-300 hover:bg-amber-500 hover:text-black border border-[#232D42] text-[10px] transition-colors cursor-pointer"
                        >
                          Lock B.E.
                        </button>
                        <button
                          id={`close-pos-${pos.id}`}
                          onClick={() => closePosition(pos.id, 'MANUAL_CLOSE')}
                          className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/40 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Positions History */}
      {closedPositions.length > 0 && (
        <div className="bg-[#121824] border border-[#1E2638] rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-[#0E131D] border-b border-[#1E2638]">
            <h3 className="text-xs font-mono font-bold text-white uppercase">
              Closed Scalp Orders Ledger ({closedPositions.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E2638] text-slate-400 text-[11px] bg-[#0B0E14]/40">
                  <th className="py-2.5 px-4">ID</th>
                  <th className="py-2.5 px-4">Symbol</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Lots</th>
                  <th className="py-2.5 px-4">Entry</th>
                  <th className="py-2.5 px-4">Exit</th>
                  <th className="py-2.5 px-4">P&L ($)</th>
                  <th className="py-2.5 px-4">Exit Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2234]">
                {closedPositions.map((pos, idx) => {
                  const isProfit = pos.pnlDollars >= 0;
                  return (
                    <tr key={`${pos.id}-${idx}`} className="hover:bg-[#161F30]/40 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400">{pos.id}</td>
                      <td className="py-2.5 px-4 font-bold text-white">{pos.symbol}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          pos.direction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {pos.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{pos.lotSize}</td>
                      <td className="py-2.5 px-4 text-slate-300">{pos.entryPrice}</td>
                      <td className="py-2.5 px-4 text-slate-300">{pos.closePrice || pos.currentPrice}</td>
                      <td className={`py-2.5 px-4 font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}${pos.pnlDollars.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          pos.closeReason === 'TAKE_PROFIT'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : pos.closeReason === 'STOP_LOSS'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {pos.closeReason || 'MANUAL'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
