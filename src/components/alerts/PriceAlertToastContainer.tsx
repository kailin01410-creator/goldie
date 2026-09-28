import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  X, 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  Volume2,
  CheckCircle2
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { PriceAlertNotification } from '../../types';

interface ToastItemProps {
  toast: PriceAlertNotification;
  onDismiss: (id: string) => void;
  onOpenModal: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onOpenModal }) => {
  const [progress, setProgress] = useState<number>(100);
  const DURATION_MS = 9000;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.id, onDismiss]);

  const isUp = toast.direction === 'ABOVE';
  const diffDollars = toast.crossedPrice - toast.targetPrice;
  const diffPips = Math.round(Math.abs(diffDollars) * 10);

  return (
    <div 
      className={`pointer-events-auto relative overflow-hidden rounded-xl border bg-[#0C111C]/95 backdrop-blur-md p-4 shadow-2xl transition-all duration-300 transform translate-y-0 w-full max-w-sm sm:max-w-md ${
        isUp 
          ? 'border-emerald-500/50 shadow-emerald-500/10' 
          : 'border-amber-500/50 shadow-amber-500/10'
      }`}
      role="alert"
      aria-live="assertive"
    >
      {/* Background radial gradient accent */}
      <div 
        className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none ${
          isUp ? 'bg-emerald-400' : 'bg-amber-400'
        }`} 
      />

      <div className="flex items-start gap-3 relative z-10">
        {/* Animated glowing bell icon */}
        <div className={`p-2.5 rounded-xl border shrink-0 flex items-center justify-center ${
          isUp 
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
            : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
        }`}>
          <div className="relative">
            <span className={`animate-ping absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${
              isUp ? 'bg-emerald-400' : 'bg-amber-400'
            }`} />
            <Bell className="w-5 h-5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {toast.symbol}
              </span>
              <span className="text-xs font-bold text-white tracking-wide">
                PRICE ALERT TRIGGERED
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#151D2E] transition-colors cursor-pointer"
              aria-label="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Condition description */}
          <div className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-100">
            {isUp ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Crossed Above Target:
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                Crossed Below Target:
              </span>
            )}
            <span className="font-mono font-bold text-white">
              ${toast.targetPrice.toFixed(2)}
            </span>
          </div>

          {/* Execution details */}
          <div className="mt-1 flex items-center gap-2 text-xs font-mono text-slate-300 flex-wrap">
            <span>Spot: <strong className="text-white">${toast.crossedPrice.toFixed(2)}</strong></span>
            <span className="text-slate-500">•</span>
            <span className={isUp ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {diffDollars >= 0 ? '+' : '-'}${Math.abs(diffDollars).toFixed(2)} ({diffPips} pips)
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-[10px]">
              {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Note if custom note was attached */}
          {toast.note && (
            <div className="mt-2 text-xs text-slate-300 bg-[#141C2B] border border-[#1E2A42] px-2.5 py-1 rounded-md truncate">
              <span className="text-slate-400 font-sans">Memo: </span>
              <span className="text-amber-200 font-medium">{toast.note}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onDismiss(toast.id);
                onOpenModal();
              }}
              className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Manage Alerts</span>
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-xs font-mono px-2 py-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
        <div 
          className={`h-full transition-all duration-75 ${
            isUp ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const PriceAlertToastContainer: React.FC = () => {
  const { alertToasts, dismissAlertToast, clearAllAlertToasts, setIsPriceAlertModalOpen } = useTrading();

  if (alertToasts.length === 0) return null;

  return (
    <aside
      aria-label="Price Alert Notifications"
      className="fixed top-20 right-3 sm:right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full"
    >
      {alertToasts.length > 1 && (
        <div className="pointer-events-auto flex items-center justify-between px-3 py-1 bg-[#0A0E18]/90 border border-[#1E2638] rounded-lg text-[11px] font-mono text-slate-300 backdrop-blur-sm self-end">
          <span>{alertToasts.length} Active Notifications</span>
          <button
            type="button"
            onClick={clearAllAlertToasts}
            className="text-cyan-400 hover:underline cursor-pointer ml-3 font-semibold"
          >
            Clear All
          </button>
        </div>
      )}

      {alertToasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissAlertToast}
          onOpenModal={() => setIsPriceAlertModalOpen(true)}
        />
      ))}
    </aside>
  );
};
