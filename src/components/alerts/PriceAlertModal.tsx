import React, { useState } from 'react';
import { 
  X, 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { PriceAlertDirection } from '../../types';
import { soundAlertService } from '../../utils/audioAlerts';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({ isOpen, onClose }) => {
  const { 
    activeInstrument, 
    priceAlerts, 
    addPriceAlert, 
    removePriceAlert, 
    togglePriceAlertActive, 
    rearmPriceAlert,
    clearTriggeredAlerts,
    clearAllPriceAlerts,
    triggerTestAlert
  } = useTrading();

  const currentPrice = activeInstrument.currentPrice;
  const decimals = activeInstrument.decimals || 2;

  // New Alert Form state
  const [targetPriceInput, setTargetPriceInput] = useState<string>(() => {
    return (currentPrice + 5).toFixed(decimals);
  });
  const [direction, setDirection] = useState<PriceAlertDirection>('ABOVE');
  const [noteInput, setNoteInput] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

  if (!isOpen) return null;

  // Calculate parsed target price and distance
  const parsedTarget = parseFloat(targetPriceInput);
  const isValidNumber = !isNaN(parsedTarget) && parsedTarget > 0;
  const distanceDollars = isValidNumber ? parsedTarget - currentPrice : 0;
  const distancePips = Math.round(Math.abs(distanceDollars) * activeInstrument.pipMultiplier);

  // Quick delta adjustments relative to current spot
  const handleApplyDelta = (delta: number) => {
    const newTarget = Number((currentPrice + delta).toFixed(decimals));
    setTargetPriceInput(newTarget.toFixed(decimals));
    setDirection(delta >= 0 ? 'ABOVE' : 'BELOW');
    setValidationError(null);
  };

  // Quick preset levels
  const handleApplyPreset = (price: number, label: string) => {
    setTargetPriceInput(price.toFixed(decimals));
    setDirection(price >= currentPrice ? 'ABOVE' : 'BELOW');
    if (!noteInput) {
      setNoteInput(label);
    }
    setValidationError(null);
  };

  const handlePriceInputChange = (val: string) => {
    setTargetPriceInput(val);
    setValidationError(null);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      // Auto-suggest direction based on price comparison
      if (num > currentPrice) {
        setDirection('ABOVE');
      } else if (num < currentPrice) {
        setDirection('BELOW');
      }
    }
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      setValidationError('Please enter a valid numeric target price greater than 0.');
      return;
    }

    addPriceAlert({
      symbol: activeInstrument.symbol,
      targetPrice: parsedTarget,
      direction,
      note: noteInput.trim() || undefined,
      soundEnabled,
      initialPrice: currentPrice,
    });

    // Reset note and slightly bump target for next
    setNoteInput('');
    setValidationError(null);
    // Switch to active tab so user sees their new alert
    setActiveTab('ACTIVE');
  };

  const activeAlerts = priceAlerts.filter(a => a.status === 'ACTIVE' || a.status === 'DISABLED');
  const triggeredAlerts = priceAlerts.filter(a => a.status === 'TRIGGERED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0C111C] border border-[#1E2638] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans"
        role="dialog"
        aria-labelledby="price-alert-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1E2638] bg-[#080C14] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="price-alert-modal-title" className="text-sm sm:text-base font-bold text-white font-mono">
                  Price Alert Station
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                  {activeInstrument.symbol}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Set precision price threshold alerts with instant visual toast notifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Spot Ref */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121927] border border-[#1F293D] font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-slate-400">Spot:</span>
              <span className="text-white font-bold">${currentPrice.toFixed(decimals)}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#151D2E] transition-colors cursor-pointer"
              aria-label="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          
          {/* Section 1: Create New Target Threshold Alert */}
          <div className="bg-[#090D16] border border-[#172133] rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  CREATE NEW PRICE ALERT
                </span>
              </div>
              
              {/* Test Toast Button */}
              <button
                type="button"
                onClick={() => triggerTestAlert()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
                title="Preview what the visual alert toast looks and sounds like"
              >
                <Play className="w-3 h-3 text-cyan-400" />
                <span>Test Visual Toast</span>
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3.5">
              
              {/* Target Price Input & Direction Select */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                
                {/* Target Price */}
                <div className="sm:col-span-7">
                  <label htmlFor="price-alert-target-input" className="block text-[11px] font-mono text-slate-300 mb-1">
                    Target Price Threshold ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                      $
                    </span>
                    <input
                      id="price-alert-target-input"
                      type="number"
                      step="0.01"
                      value={targetPriceInput}
                      onChange={e => handlePriceInputChange(e.target.value)}
                      placeholder="e.g. 3025.50"
                      className="w-full bg-[#0D1422] border border-[#232F48] focus:border-amber-400 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm font-bold focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Condition Direction */}
                <div className="sm:col-span-5">
                  <label htmlFor="price-alert-direction-select" className="block text-[11px] font-mono text-slate-300 mb-1">
                    Trigger Condition
                  </label>
                  <select
                    id="price-alert-direction-select"
                    value={direction}
                    onChange={e => setDirection(e.target.value as PriceAlertDirection)}
                    className="w-full bg-[#0D1422] border border-[#232F48] focus:border-amber-400 rounded-lg px-3 py-2 text-white font-mono text-xs font-semibold focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="ABOVE">Price Crosses ABOVE (≥)</option>
                    <option value="BELOW">Price Crosses BELOW (≤)</option>
                  </select>
                </div>
              </div>

              {/* Quick Offset Buttons */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Quick Spot Offsets:</span>
                  {isValidNumber && (
                    <span className={distanceDollars >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      Target is {distanceDollars >= 0 ? `+$${distanceDollars.toFixed(2)}` : `-$${Math.abs(distanceDollars).toFixed(2)}`} away ({distancePips} pips)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(-10)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-amber-300 text-[11px] transition-colors cursor-pointer"
                  >
                    -$10.00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(-5)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-amber-300 text-[11px] transition-colors cursor-pointer"
                  >
                    -$5.00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(-2)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-amber-300 text-[11px] transition-colors cursor-pointer"
                  >
                    -$2.00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(2)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-emerald-300 text-[11px] transition-colors cursor-pointer"
                  >
                    +$2.00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(5)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-emerald-300 text-[11px] transition-colors cursor-pointer"
                  >
                    +$5.00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDelta(10)}
                    className="px-2 py-1 rounded bg-[#101726] hover:bg-[#172238] border border-[#1E2C46] text-emerald-300 text-[11px] transition-colors cursor-pointer"
                  >
                    +$10.00
                  </button>
                  
                  {/* Presets: 24h High & 24h Low */}
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(activeInstrument.high24h, '24h High Resistance')}
                    className="px-2 py-1 rounded bg-[#141C2B] hover:bg-[#1C273C] border border-[#23314A] text-slate-300 text-[11px] transition-colors cursor-pointer"
                  >
                    24h High (${activeInstrument.high24h.toFixed(decimals)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(activeInstrument.low24h, '24h Low Support')}
                    className="px-2 py-1 rounded bg-[#141C2B] hover:bg-[#1C273C] border border-[#23314A] text-slate-300 text-[11px] transition-colors cursor-pointer"
                  >
                    24h Low (${activeInstrument.low24h.toFixed(decimals)})
                  </button>
                </div>
              </div>

              {/* Note / Memo Input & Sound Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                <div className="sm:col-span-8">
                  <label htmlFor="price-alert-note-input" className="block text-[11px] font-mono text-slate-300 mb-1">
                    Alert Note / Strategy Label (Optional)
                  </label>
                  <input
                    id="price-alert-note-input"
                    type="text"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="e.g. Resistance Breakout, Weekly High Sweep, Take Profit"
                    className="w-full bg-[#0D1422] border border-[#232F48] focus:border-amber-400 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none transition-colors"
                  />
                </div>

                <div className="sm:col-span-4 flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) soundAlertService.playChime('ABOVE');
                    }}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                      soundEnabled 
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20' 
                        : 'bg-[#101726] border-[#1E2638] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                    <span>{soundEnabled ? 'Chime Sound ON' : 'Muted'}</span>
                  </button>
                </div>
              </div>

              {/* Validation message if any */}
              {validationError && (
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-mono">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  <span>Set Price Alert for ${isValidNumber ? parsedTarget.toFixed(decimals) : '---'}</span>
                </button>
              </div>

            </form>
          </div>

          {/* Section 2: Active Alerts & Triggered History Tabs */}
          <div>
            <div className="flex items-center justify-between border-b border-[#1E2638] pb-2 mb-3">
              <div className="flex items-center gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'ACTIVE'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Active Alerts ({activeAlerts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('HISTORY')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'HISTORY'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Triggered History ({triggeredAlerts.length})</span>
                </button>
              </div>

              {activeTab === 'HISTORY' && triggeredAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearTriggeredAlerts}
                  className="text-[11px] font-mono text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear History
                </button>
              )}

              {activeTab === 'ACTIVE' && activeAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllPriceAlerts}
                  className="text-[11px] font-mono text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* TAB CONTENT: ACTIVE ALERTS */}
            {activeTab === 'ACTIVE' && (
              <div className="space-y-2">
                {activeAlerts.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-[#090D16] border border-[#161F30] rounded-xl text-slate-400 font-mono text-xs">
                    <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No Active Price Alerts</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Set a price threshold above or use the quick buttons to monitor target breakouts.
                    </p>
                  </div>
                ) : (
                  activeAlerts.map(alert => {
                    const isUp = alert.direction === 'ABOVE';
                    const diff = alert.targetPrice - currentPrice;
                    const diffPip = Math.round(Math.abs(diff) * activeInstrument.pipMultiplier);
                    const isPassed = isUp ? currentPrice >= alert.targetPrice : currentPrice <= alert.targetPrice;

                    return (
                      <div 
                        key={alert.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs transition-colors ${
                          alert.status === 'DISABLED'
                            ? 'bg-[#090C14] border-[#161D2B] opacity-60'
                            : 'bg-[#0A0F1B] border-[#1E2A40] hover:border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isUp ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">
                                ${alert.targetPrice.toFixed(decimals)}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isUp ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                {isUp ? 'CROSSES ABOVE (≥)' : 'CROSSES BELOW (≤)'}
                              </span>
                              {alert.status === 'DISABLED' && (
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                  PAUSED
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                              <span>Distance: <strong className={diff >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                                {diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`} ({diffPip} pips)
                              </strong></span>
                              <span>•</span>
                              <span>Initial Spot: ${alert.initialPrice.toFixed(decimals)}</span>
                              {alert.note && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-200">"{alert.note}"</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {/* Toggle Active/Disabled */}
                          <button
                            type="button"
                            onClick={() => togglePriceAlertActive(alert.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] border font-bold transition-colors cursor-pointer ${
                              alert.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                            }`}
                            title={alert.status === 'ACTIVE' ? 'Pause Alert' : 'Resume Alert'}
                          >
                            {alert.status === 'ACTIVE' ? 'Active' : 'Paused'}
                          </button>

                          {/* Sound indicator */}
                          <div 
                            className="p-1.5 rounded-md bg-[#121927] border border-[#1E2638] text-slate-400"
                            title={alert.soundEnabled ? 'Chime sound enabled' : 'Muted'}
                          >
                            {alert.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => removePriceAlert(alert.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                            title="Delete Alert"
                            aria-label="Delete Alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB CONTENT: TRIGGERED HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-2">
                {triggeredAlerts.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-[#090D16] border border-[#161F30] rounded-xl text-slate-400 font-mono text-xs">
                    <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No Triggered Alerts Yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      When live spot quotes cross your active target thresholds, triggered events will be archived here.
                    </p>
                  </div>
                ) : (
                  triggeredAlerts.map(alert => (
                    <div 
                      key={alert.id}
                      className="p-3 rounded-xl border border-amber-500/30 bg-[#0C1220] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
                    >
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">
                              ${alert.targetPrice.toFixed(decimals)}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              TRIGGERED
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Execution Spot: <strong className="text-white">${(alert.triggeredPrice || alert.targetPrice).toFixed(decimals)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                            <span>
                              Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleTimeString() : 'Recently'}
                            </span>
                            {alert.note && (
                              <>
                                <span>•</span>
                                <span className="text-amber-200">"{alert.note}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {/* Re-arm Button */}
                        <button
                          type="button"
                          onClick={() => rearmPriceAlert(alert.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold transition-colors cursor-pointer"
                          title="Re-arm this alert at the current price"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Re-arm Alert</span>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removePriceAlert(alert.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                          title="Delete Triggered Alert"
                          aria-label="Delete Triggered Alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1E2638] bg-[#080C14] flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Real-time XAU/USD Bullion Monitor</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#141B2D] hover:bg-[#1C273C] border border-[#232F48] text-white font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
