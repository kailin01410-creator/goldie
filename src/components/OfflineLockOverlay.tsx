import React, { useState } from 'react';
import { 
  WifiOff, 
  RefreshCw, 
  ShieldAlert, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  Radio,
  ZapOff
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

export const OfflineLockOverlay: React.FC = () => {
  const { 
    isOfflineLocked, 
    networkStatus, 
    testConnectivity, 
    dismissOfflineLockForDev,
    simulateNetworkDrop 
  } = useTrading();

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!isOfflineLocked) return null;

  const handleManualRetry = async () => {
    setIsVerifying(true);
    setStatusMessage('Pinging network infrastructure & GoldAPI gateway...');
    const connected = await testConnectivity();
    setIsVerifying(false);
    if (!connected) {
      setStatusMessage('Network ping failed. No active internet route detected.');
    }
  };

  return (
    <div 
      id="offline-lockout-screen"
      className="fixed inset-0 z-[9999] bg-[#05070B]/98 backdrop-blur-md flex items-center justify-center p-4 font-mono select-none"
    >
      <div className="max-w-lg w-full bg-[#0D121D] border-2 border-rose-500/60 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-rose-950/50 relative overflow-hidden">
        
        {/* Ambient background alert glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Alert Badge */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0 animate-pulse">
            <WifiOff className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500 text-black font-extrabold tracking-wider uppercase">
                CRITICAL GUARD ACTIVE
              </span>
              <span className="text-xs text-rose-400 font-bold uppercase flex items-center gap-1">
                <Radio className="w-3 h-3 animate-ping" /> Disconnected
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight mt-0.5">
              No Internet Connection Detected
            </h1>
          </div>
        </div>

        {/* System Message */}
        <div className="space-y-3 mb-5 text-xs text-slate-300 leading-relaxed">
          <p className="bg-[#080B10] p-3 rounded-lg border border-rose-500/30 text-rose-200">
            <strong>Terminal Access Halted:</strong> The Live Scalp Terminal requires an uninterrupted internet connection to stream live spot prices (Gold <strong className="text-amber-300">XAU/USD</strong> & Forex) and calculate real-time multi-timeframe percentage matrices.
          </p>

          <div className="bg-[#080B10] p-3 rounded-lg border border-[#1E2638] space-y-2">
            <div className="flex items-start gap-2 text-slate-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Execution Safeguard Active:</strong>
                <span className="text-[11px] text-slate-400">
                  Trading operations are temporarily halted to safeguard your account against unauthorized executions on unverified or stale quotes.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-slate-300">
              <ZapOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block">Trade Execution Lockout:</strong>
                <span className="text-[11px] text-slate-400">
                  Order routing and strategy signal generation are frozen until real-time data connectivity is verified.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Network Diagnostics */}
        <div className="bg-[#080B10] p-3.5 rounded-lg border border-[#1E2638] mb-5 text-[11px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Browser Online Flag:</span>
            <span className={typeof navigator !== 'undefined' && navigator.onLine ? 'text-amber-400' : 'text-rose-400 font-bold'}>
              {typeof navigator !== 'undefined' && navigator.onLine ? 'REPORTING UNRELIABLE' : 'FALSE (OFFLINE)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Gateway Status:</span>
            <span className="text-rose-400 font-bold uppercase">{networkStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Live Gold Feed:</span>
            <span className="text-slate-300">Suspended</span>
          </div>
          {statusMessage && (
            <div className="pt-2 text-amber-300 font-semibold border-t border-[#1E2638]">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-2.5">
          <button
            id="retry-connection-btn"
            onClick={handleManualRetry}
            disabled={isVerifying}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs uppercase transition-all shadow-lg shadow-rose-900/30 active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Verifying Internet Link...' : 'Retry Internet Connection'}</span>
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-[#1E2638] text-[10px] text-slate-400">
            <button
              onClick={() => simulateNetworkDrop(false)}
              className="text-emerald-400 hover:underline cursor-pointer"
            >
              Simulate Connection Restored
            </button>
            <button
              onClick={dismissOfflineLockForDev}
              className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer"
            >
              Developer Preview Mode
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
