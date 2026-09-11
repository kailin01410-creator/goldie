import React, { useState } from 'react';
import { useTrading, XM_BROKER_PRESETS } from '../context/TradingContext';
import { XmBrokerTier } from '../types';
import { 
  Sliders, 
  Check, 
  X, 
  ShieldCheck, 
  Activity, 
  TrendingUp, 
  Info, 
  DollarSign,
  Zap,
  RotateCcw
} from 'lucide-react';

export const XmBrokerModal: React.FC = () => {
  const { 
    isXmModalOpen, 
    setIsXmModalOpen, 
    xmBrokerTier, 
    goldSpreadPips, 
    updateXmSpread,
    instruments,
    refreshGoldPrice
  } = useTrading();

  const [selectedTier, setSelectedTier] = useState<XmBrokerTier>(xmBrokerTier);
  const [customPips, setCustomPips] = useState<number>(goldSpreadPips);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  if (!isXmModalOpen) return null;

  const goldInst = instruments.find(i => i.symbol === 'XAU/USD') || instruments[0];
  const currentPrice = goldInst.currentPrice;

  const effectivePips = selectedTier === 'CUSTOM' ? customPips : XM_BROKER_PRESETS[selectedTier].spreadPips;
  const effectiveSpreadDollars = effectivePips / 10;
  const simBid = (currentPrice - effectiveSpreadDollars / 2).toFixed(2);
  const simAsk = (currentPrice + effectiveSpreadDollars / 2).toFixed(2);

  const handleApply = async () => {
    updateXmSpread(selectedTier, selectedTier === 'CUSTOM' ? customPips : undefined);
    setSavedSuccess(true);
    await refreshGoldPrice();
    setTimeout(() => {
      setSavedSuccess(false);
      setIsXmModalOpen(false);
    }, 600);
  };

  const handlePresetSelect = (tier: XmBrokerTier) => {
    setSelectedTier(tier);
    if (tier !== 'CUSTOM') {
      setCustomPips(XM_BROKER_PRESETS[tier].spreadPips);
    }
  };

  return (
    <div 
      id="xm-broker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setIsXmModalOpen(false)}
    >
      <div 
        id="xm-broker-modal-content"
        className="w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">XM Broker Gold Spread Calibration</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  XM XAUUSD
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Match exact real-time spread and demo testing conditions
              </p>
            </div>
          </div>
          <button
            id="close-xm-modal-btn"
            onClick={() => setIsXmModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Real-time Demo Spread Preview Card */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Live XM Simulation Preview
              </span>
              <span className="text-amber-400 font-mono font-semibold">
                {effectivePips.toFixed(1)} Pips ({Math.round(effectivePips * 10)} MT4 Points)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center my-3">
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                <span className="block text-[11px] font-semibold text-emerald-400">BID (Sell)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-100">${simBid}</span>
              </div>
              <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 flex flex-col items-center justify-center">
                <span className="block text-[10px] uppercase tracking-wider text-amber-400 font-bold">XM Spread</span>
                <span className="text-sm sm:text-base font-mono font-bold text-amber-300">
                  ${effectiveSpreadDollars.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">per ounce</span>
              </div>
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                <span className="block text-[11px] font-semibold text-rose-400">ASK (Buy)</span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-100">${simAsk}</span>
              </div>
            </div>

            {/* Instant Floating Cost Matrix */}
            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-900/60 p-1.5 rounded">
                <span className="text-slate-400 block text-[10px]">0.01 Lot (1 oz)</span>
                <span className="font-mono text-slate-200 font-medium">-${(effectiveSpreadDollars * 1).toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/60 p-1.5 rounded">
                <span className="text-slate-400 block text-[10px]">0.10 Lot (10 oz)</span>
                <span className="font-mono text-slate-200 font-medium">-${(effectiveSpreadDollars * 10).toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/60 p-1.5 rounded border border-amber-500/20 bg-amber-950/20">
                <span className="text-amber-400 block text-[10px]">1.00 Lot (100 oz)</span>
                <span className="font-mono text-amber-300 font-bold">-${(effectiveSpreadDollars * 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Preset Selection Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Select Your XM Broker Account Preset
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(XM_BROKER_PRESETS) as XmBrokerTier[]).map((tierKey) => {
                const preset = XM_BROKER_PRESETS[tierKey];
                const isSelected = selectedTier === tierKey;
                return (
                  <button
                    key={tierKey}
                    id={`xm-preset-${tierKey.toLowerCase()}`}
                    type="button"
                    onClick={() => handlePresetSelect(tierKey)}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 text-slate-100 ring-1 ring-amber-500/50'
                        : 'bg-slate-800/60 border-slate-700/70 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                        {preset.label}
                        {tierKey === 'XM_ULTRA_LOW' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                            DEFAULT
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs font-bold text-amber-400">
                        {preset.spreadPips.toFixed(1)} pips
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fine Tuning / Custom Spread Slider */}
          <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Fine-Tune Exact XM Demo Spread (Pips / Points)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="25.0"
                  step="0.1"
                  value={customPips}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setCustomPips(val);
                      setSelectedTier('CUSTOM');
                    }
                  }}
                  className="w-20 px-2 py-1 bg-slate-900 border border-amber-500/40 rounded font-mono text-sm text-right text-amber-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-xs text-slate-400 font-mono">pips</span>
              </div>
            </div>

            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.1"
              value={customPips}
              onChange={(e) => {
                setCustomPips(parseFloat(e.target.value));
                setSelectedTier('CUSTOM');
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />

            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Tight (1.5 pips / $0.15)</span>
              <span className="text-amber-400 font-semibold">XM Ultra Low (3.0 pips / $0.30)</span>
              <span>XM Standard (4.0 pips / $0.40)</span>
              <span>Wide (10.0 pips)</span>
            </div>
          </div>

          {/* XM Demo Broker Spec Notes */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-slate-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-300 mb-0.5">XM Broker XAUUSD Specifications:</p>
              <p className="text-[11px] leading-relaxed">
                XM trades 100 oz contract per standard lot. In MT4/MT5, 1 pip = $0.10 (10 points / 10 cents). 
                The spread of <strong>3.0 pips ($0.30)</strong> matches XM Ultra Low demo accounts with zero commission.
                Every paper scalp order opened in this terminal will immediately calculate floating PnL based on this exact XM spread.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            id="reset-xm-default-btn"
            type="button"
            onClick={() => {
              setSelectedTier('XM_ULTRA_LOW');
              setCustomPips(3.0);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to XM Ultra Low (3.0p)
          </button>

          <div className="flex items-center gap-2">
            <button
              id="cancel-xm-modal-btn"
              type="button"
              onClick={() => setIsXmModalOpen(false)}
              className="px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="apply-xm-spread-btn"
              type="button"
              onClick={handleApply}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all shadow-md ${
                savedSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
              }`}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Calibrated to XM!
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply XM Spread ({effectivePips.toFixed(1)} Pips)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
