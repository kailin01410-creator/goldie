import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  ShieldCheck, 
  Sliders, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw,
  Coins
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    activeInstrument,
    setActiveSymbol,
    instruments,
    timeframe,
    setTimeframe,
    goldApiKey,
    setGoldApiKey,
    refreshGoldPrice,
    testGoldApiKey,
    goldDataSource,
    goldApiNotice,
    isMarketClosed,
    marketClosureReason,
  } = useTrading();

  const [manualKeyInput, setManualKeyInput] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: string;
    message: string;
    price?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testGoldApiKey(manualKeyInput || goldApiKey);
      setTestResult(res);
    } catch {
      setTestResult({
        success: false,
        status: 'NETWORK_ERROR',
        message: 'Could not connect to test endpoint. Check internet connection.',
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleSaveKey = async () => {
    if (manualKeyInput.trim()) {
      setGoldApiKey(manualKeyInput.trim());
      await refreshGoldPrice();
      setTestResult({
        success: true,
        status: 'SAVED',
        message: 'Personal GoldAPI key saved securely in client storage. Live prices updated.',
      });
      setManualKeyInput('');
    }
  };

  const handleClearKey = async () => {
    setGoldApiKey('');
    setManualKeyInput('');
    setTestResult({
      success: true,
      status: 'REVERTED',
      message: 'Manual key cleared. Reverted to server GOLDAPI_KEY environment variable & institutional spot feed.',
    });
    await refreshGoldPrice();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#0D121D] border border-[#1E2638] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1E2638] bg-[#0A0E17] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
              <Settings className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-sm font-bold text-white font-mono">
                GoldFlow Dashboard Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure trading symbol, chart resolution, and API authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#141A29] hover:bg-[#1C253B] border border-[#232D42] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans text-xs">
          
          {/* Section 1: Instrument Selector */}
          <div>
            <label className="text-slate-300 font-bold font-mono text-xs mb-2 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Active Instrument & Currency</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {instruments.map(inst => {
                const isSelected = inst.symbol === activeInstrument.symbol;
                return (
                  <button
                    key={inst.symbol}
                    type="button"
                    onClick={() => {
                      setActiveSymbol(inst.symbol);
                      refreshGoldPrice();
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-white shadow-sm shadow-cyan-500/10'
                        : 'bg-[#121824] border-[#1E2638] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-mono font-bold text-xs flex items-center justify-between">
                      <span>{inst.symbol}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {inst.name}
                    </div>
                    <div className="font-mono text-[11px] font-semibold text-slate-200 mt-1">
                      ${inst.currentPrice.toFixed(inst.decimals)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Default Chart Timeframe */}
          <div>
            <label className="text-slate-300 font-bold font-mono text-xs mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Default Chart Timeframe</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map(tf => {
                const isSelected = timeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`py-2 rounded-lg font-mono font-bold text-xs border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-[#121824] border-[#1E2638] text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    {tf.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: API Security & Authentication */}
          <div className="bg-[#101522] border border-[#1E2638] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white font-mono text-xs">API Authentication & Security</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                SECURE PROXY ACTIVE
              </span>
            </div>

            <p className="text-slate-300 text-[11px] leading-relaxed">
              Your bullion spot prices are streamed via a secure server proxy using the <code className="text-amber-300 font-mono">GOLDAPI_KEY</code> environment variable. The raw API key is never exposed to the client or browser network inspection.
            </p>

            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#0A0D15] border border-[#1A2234] text-[11px] font-mono">
              <span className="text-slate-400">Current Feed Source:</span>
              <span className="text-amber-300 font-semibold">{goldDataSource}</span>
            </div>

            {goldApiNotice && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
                <div className="font-semibold text-amber-300">Notice:</div>
                <div>{goldApiNotice}</div>
              </div>
            )}

            {/* Manual Key Override Toggle */}
            <div className="pt-2 border-t border-[#1A2234]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300 font-medium">Custom API Key Override:</span>
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] underline cursor-pointer"
                >
                  {showKeyInput ? 'Hide Input' : goldApiKey ? 'Update Custom Key' : '+ Enter Personal Key'}
                </button>
              </div>

              {showKeyInput && (
                <div className="space-y-2 mt-2">
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Paste your GoldAPI.io key (e.g. goldapi-xxx)"
                      value={manualKeyInput}
                      onChange={e => setManualKeyInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#070A0F] border border-[#222C42] focus:border-cyan-500 text-white font-mono text-xs outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveKey}
                      disabled={!manualKeyInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-black font-bold font-mono text-xs transition-colors cursor-pointer"
                    >
                      Save Key
                    </button>
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={testingKey}
                      className="px-3 py-1.5 rounded-lg bg-[#141A29] hover:bg-[#1C253B] border border-[#232D42] text-slate-200 font-mono text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {testingKey ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3 text-amber-400" />}
                      <span>Test Key</span>
                    </button>
                    {goldApiKey && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-mono text-xs transition-colors cursor-pointer"
                      >
                        Clear Custom Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              {testResult && (
                <div className={`mt-2.5 p-2.5 rounded-lg border text-[11px] font-mono ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <span>Status: {testResult.status}</span>
                  </div>
                  <div className="mt-0.5">{testResult.message}</div>
                  {testResult.price && (
                    <div className="mt-1 font-semibold text-white">
                      Live Quote Verified: ${testResult.price.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Market Status Info */}
          <div className="p-3 rounded-xl bg-[#0A0D15] border border-[#1A2234] text-[11px] flex items-center justify-between text-slate-400">
            <span>Interbank Market Status:</span>
            <span className={`font-mono font-bold ${isMarketClosed ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isMarketClosed ? `CLOSED (${marketClosureReason || 'Weekend'})` : 'OPEN (Active Trading)'}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1E2638] bg-[#0A0E17] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
