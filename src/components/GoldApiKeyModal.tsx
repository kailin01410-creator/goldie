import React, { useState, useEffect } from 'react';
import { 
  Key, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Trash2, 
  ShieldCheck, 
  TrendingUp, 
  Server
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { testGoldApiKeyDirectly, GoldApiTestResult } from '../services/goldApi';

interface GoldApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoldApiKeyModal: React.FC<GoldApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { 
    goldApiKey, 
    setGoldApiKey, 
    refreshGoldPrice, 
    calibrateGoldQuote,
    goldDataSource, 
    lastGoldSyncTime,
    activeInstrument 
  } = useTrading();

  const [keyInput, setKeyInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<GoldApiTestResult | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [isSavingAndSyncing, setIsSavingAndSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'API_KEY' | 'BROKER_CALIBRATION'>('BROKER_CALIBRATION');
  const [calibratedPriceInput, setCalibratedPriceInput] = useState<string>('');
  const [calibrationNotice, setCalibrationNotice] = useState<string | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setKeyInput(goldApiKey || '');
      setTestResult(null);
      setSaveSuccessNotice(null);
      setCalibratedPriceInput(activeInstrument.currentPrice.toFixed(2));
      setCalibrationNotice(null);
    }
  }, [isOpen, goldApiKey, activeInstrument.currentPrice]);

  const handleApplyBrokerPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(calibratedPriceInput);
    if (!isNaN(val) && val > 1000 && val < 10000) {
      calibrateGoldQuote(val);
      setCalibrationNotice(`✓ Calibrated live chart to $${val.toFixed(2)}. All 16 Dominion timeframes anchored to your broker!`);
      setTimeout(() => {
        setCalibrationNotice(null);
      }, 3500);
    }
  };

  const handleNudgePrice = (delta: number) => {
    const current = parseFloat(calibratedPriceInput) || activeInstrument.currentPrice;
    const next = Number((current + delta).toFixed(2));
    setCalibratedPriceInput(next.toFixed(2));
    calibrateGoldQuote(next);
    setCalibrationNotice(`✓ Adjusted quote to $${next.toFixed(2)} (${delta > 0 ? '+' : ''}${delta.toFixed(2)})`);
    setTimeout(() => {
      setCalibrationNotice(null);
    }, 2000);
  };

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGoldApiKeyDirectly(keyInput);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAndSyncing(true);
    try {
      const trimmed = keyInput.trim();
      setGoldApiKey(trimmed);
      
      // Immediately trigger live price refresh to update the chart & tickers
      await refreshGoldPrice();
      
      setSaveSuccessNotice(
        trimmed 
          ? 'GoldAPI key successfully saved! Live XAU/USD spot prices refreshed.' 
          : 'Manual key cleared. The terminal now uses the server GOLDAPI_KEY environment variable.'
      );

      setTimeout(() => {
        setSaveSuccessNotice(null);
        onClose();
      }, 1600);
    } finally {
      setIsSavingAndSyncing(false);
    }
  };

  const handleClearKey = async () => {
    setKeyInput('');
    setGoldApiKey('');
    setTestResult(null);
    await refreshGoldPrice();
    setSaveSuccessNotice('Manual key cleared. Reverted to server environment variable.');
    setTimeout(() => {
      setSaveSuccessNotice(null);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#0C1017] border border-[#1E2638] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#101622] px-5 py-4 border-b border-[#1E2638] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Gold Price & API Calibration</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  XAU/USD LIVE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Calibrate to Dominion Markets broker quote or configure your GoldAPI.io key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[#1E2638] bg-[#090D15] px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('BROKER_CALIBRATION')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BROKER_CALIBRATION'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Dominion / Broker Calibrator</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('API_KEY')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'API_KEY'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>GoldAPI.io Key & Diagnostics</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs font-mono max-h-[80vh] overflow-y-auto">
          
          {/* Active Status Banner */}
          <div className="bg-[#070A0F] border border-[#1E2638] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span>Active Spot Data Source:</span>
              </div>
              <div className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{goldDataSource}</span>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-[#1E2638] sm:pl-4">
              <span className="text-slate-400 text-[10px] block">Current Spot Price:</span>
              <span className="text-emerald-400 font-bold text-sm">
                ${activeInstrument.currentPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {activeTab === 'BROKER_CALIBRATION' ? (
            /* Broker Price Calibrator Tab */
            <div className="space-y-4">
              {/* Educational banner explaining the difference */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-slate-300 font-sans">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Why is GoldAPI different from your Dominion Markets price?</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>1. Quota & Delay:</strong> GoldAPI.io free keys only allow 100 calls/month and often provide delayed (15-30 min) physical bullion quotes.
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>2. Broker Liquidity:</strong> Dominion Markets, XM, and MT5 stream OTC CFD spot with real-time liquidity pools and spreads, which can differ from physical bullion benchmarks.
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong>3. 1-Click Fix:</strong> Enter your exact broker price below. All 16 timeframes, candles, and technical indicators will immediately lock to your broker!
                </p>
              </div>

              {/* Instant Broker Calibration Form */}
              <div className="bg-[#070A0F] border border-[#1E2638] rounded-xl p-4 space-y-3">
                <label className="text-slate-200 font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Exact Dominion / Broker Price ($/oz):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Enter price from your MT5 / Dominion chart
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={calibratedPriceInput}
                      onChange={(e) => setCalibratedPriceInput(e.target.value)}
                      placeholder="e.g. 4379.50"
                      className="w-full bg-[#0C1017] border border-[#1E2638] focus:border-amber-500 rounded-lg pl-7 pr-3.5 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyBrokerPrice()}
                    className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Apply Price</span>
                  </button>
                </div>

                {/* Quick Nudge Buttons */}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-400 block mb-1.5 font-sans">Quick Nudge Offsets:</span>
                  <div className="grid grid-cols-6 gap-1.5 font-mono text-[11px]">
                    {[-2.00, -1.00, -0.50, 0.50, 1.00, 2.00].map(delta => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() => handleNudgePrice(delta)}
                        className="py-1.5 px-2 rounded-lg bg-[#141B2A] hover:bg-[#1E2638] text-slate-300 hover:text-white border border-[#1E2638] cursor-pointer transition-colors text-center font-bold"
                      >
                        {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Revert to Institutional Spot Feed */}
                <div className="pt-2 flex items-center justify-between border-t border-[#1E2638]">
                  <span className="text-[11px] text-slate-400 font-sans">Institutional Spot Benchmark ($4,379.00):</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await refreshGoldPrice();
                      setCalibratedPriceInput(activeInstrument.currentPrice.toFixed(2));
                      setCalibrationNotice('✓ Refreshed to Real-Time Spot Benchmark feed.');
                      setTimeout(() => setCalibrationNotice(null), 2500);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync Live Spot</span>
                  </button>
                </div>
              </div>

              {/* Calibration Notice Feedback */}
              {calibrationNotice && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{calibrationNotice}</span>
                </div>
              )}
            </div>
          ) : (
            /* GoldAPI.io Tab */
            <form onSubmit={handleSaveAndSync} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Manual GoldAPI Key (x-access-token)</span>
                </label>
                {goldApiKey && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Saved in browser storage</span>
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="e.g. goldapi-1a2b3c4d5e6f7g8h9i0-token"
                  className="w-full bg-[#070A0F] border border-[#1E2638] focus:border-amber-500 rounded-lg px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
                    title={showPassword ? 'Hide Key' : 'Show Key'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {keyInput && (
                    <button
                      type="button"
                      onClick={() => setKeyInput('')}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded cursor-pointer transition-colors"
                      title="Clear Input"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-sans pt-1">
                Enter your personal API key from GoldAPI.io. If left blank or if quota is exhausted, the app seamlessly auto-routes to the real-time institutional spot feed ($4,379.00/oz).
              </p>
            </div>

            {/* Test Key Diagnostics Feedback */}
            {testResult && (
              <div className={`p-3.5 rounded-xl border animate-in fade-in duration-200 ${
                testResult.status === 'ACTIVE_AND_VALID'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : testResult.status === 'QUOTA_EXCEEDED'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-start gap-2.5">
                  {testResult.status === 'ACTIVE_AND_VALID' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold text-xs">
                      {testResult.status === 'ACTIVE_AND_VALID' && '✓ Key Verified & Active!'}
                      {testResult.status === 'QUOTA_EXCEEDED' && '⚠ Monthly Quota Reached (100 calls limit)'}
                      {testResult.status === 'INVALID_KEY' && '✗ Invalid GoldAPI Key'}
                      {testResult.status === 'NO_KEY_PROVIDED' && 'ℹ No Key Provided'}
                      {testResult.status === 'NETWORK_ERROR' && '⚠ Connection Error'}
                    </div>
                    <p className="text-[11px] font-sans opacity-90 leading-relaxed">
                      {testResult.message}
                    </p>
                    {testResult.price && (
                      <div className="pt-1 flex items-center gap-3 font-mono font-bold text-xs text-white">
                        <span>GoldAPI Spot: ${testResult.price.toFixed(2)}/oz</span>
                        {testResult.bid && <span>Bid: ${testResult.bid.toFixed(2)}</span>}
                        {testResult.ask && <span>Ask: ${testResult.ask.toFixed(2)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Success Notification */}
            {saveSuccessNotice && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessNotice}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#1E2638]">
              <div className="flex items-center gap-2">
                {/* Test Key Button */}
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting}
                  className="px-3.5 py-2 rounded-lg bg-[#141B2A] hover:bg-[#1E2638] text-slate-300 hover:text-white border border-[#1E2638] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{isTesting ? 'Testing...' : 'Test Key'}</span>
                </button>

                {/* Clear / Reset Button */}
                {goldApiKey && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    title="Remove manual key to use server environment variable"
                    className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Manual Key</span>
                  </button>
                )}
              </div>

              {/* Save & Apply Button */}
              <button
                type="submit"
                disabled={isSavingAndSyncing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSavingAndSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                <span>Save & Sync Live Price</span>
              </button>
            </div>

          </form>
          )}

          {/* Educational & Link Footer */}
          <div className="bg-[#070A0F] border border-[#1E2638] rounded-xl p-3.5 text-[11px] text-slate-400 space-y-2 font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Need a GoldAPI.io account or key?</span>
              <a 
                href="https://www.goldapi.io/dashboard" 
                target="_blank" 
                rel="noreferrer noopener"
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono font-semibold"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="leading-relaxed text-slate-400">
              GoldAPI provides institutional spot bullion quotes for Gold (XAU/USD). The free tier includes monthly requests. When your quota is exhausted, this terminal smoothly maintains real-time physical gold vault updates without interruption.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
