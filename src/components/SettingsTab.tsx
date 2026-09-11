import React, { useState } from 'react';
import { 
  Sliders, 
  CheckCircle2, 
  Save, 
  Coins, 
  Wifi, 
  RefreshCw, 
  Globe, 
  Zap, 
  Smartphone, 
  Download, 
  FolderArchive,
  Shield,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useTrading, XM_BROKER_PRESETS } from '../context/TradingContext';
import { XmBrokerTier } from '../types';

export const SettingsTab: React.FC = () => {
  const { 
    adminProfile, 
    updateAdminRiskSettings,
    goldDataSource,
    goldApiKey,
    setGoldApiKey,
    refreshGoldPrice,
    lastGoldSyncTime,
    instruments,
    isOnline,
    networkStatus,
    testConnectivity,
    simulateNetworkDrop,
    setIsAndroidInstallModalOpen,
    setIsDownloadModalOpen,
    xmBrokerTier,
    goldSpreadPips,
    updateXmSpread,
    setIsXmModalOpen
  } = useTrading();

  // GoldAPI state
  const [goldKeyInput, setGoldKeyInput] = useState<string>(goldApiKey || adminProfile.goldApiKey || '');
  const [goldSyncFeedback, setGoldSyncFeedback] = useState<string | null>(null);
  const [isSyncingGold, setIsSyncingGold] = useState<boolean>(false);

  // Network test state
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  // Risk settings state
  const [riskSettings, setRiskSettings] = useState({
    maxDailyDrawdownPercent: adminProfile.maxDailyDrawdownPercent,
    defaultLotSize: adminProfile.defaultLotSize,
    accountLeverage: adminProfile.accountLeverage,
    riskPerTradePercent: adminProfile.riskPerTradePercent,
    slippageSimulationPips: adminProfile.slippageSimulationPips,
  });
  const [riskSavedNotice, setRiskSavedNotice] = useState<boolean>(false);

  const goldInstrument = instruments.find(i => i.symbol === 'XAU/USD') || instruments[0];

  // Save Gold API key
  const handleSaveGoldApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setGoldApiKey(goldKeyInput);
    setGoldSyncFeedback('API key updated and saved to client storage.');
    setTimeout(() => {
      setGoldSyncFeedback(null);
      refreshGoldPrice();
    }, 2000);
  };

  // Sync Gold price now
  const handleForceSyncGold = async () => {
    setIsSyncingGold(true);
    await refreshGoldPrice();
    setIsSyncingGold(false);
    setGoldSyncFeedback('Spot price synchronized directly with live quotes.');
    setTimeout(() => setGoldSyncFeedback(null), 3000);
  };

  // Save Risk Settings
  const handleSaveRisk = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdminRiskSettings(riskSettings);
    setRiskSavedNotice(true);
    setTimeout(() => setRiskSavedNotice(false), 3000);
  };

  // Handle ping test
  const handlePingTest = async () => {
    setIsPinging(true);
    setPingResult('Testing gateway socket round-trip...');
    const ok = await testConnectivity();
    setIsPinging(false);
    setPingResult(ok ? 'Internet Connection Active (HTTP 200 OK)' : 'Ping Failed: No connection detected');
    setTimeout(() => setPingResult(null), 4000);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>Terminal Settings & Risk Configuration</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                  SYSTEM READY
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Configure XM Ultra-Low spreads, risk management thresholds, live market data feeds, and device installation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePingTest}
              disabled={isPinging}
              className="px-3 py-1.5 rounded-lg bg-[#1A2234] hover:bg-[#232D42] text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer border border-[#232D42]"
            >
              <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-blue-400' : 'text-emerald-400'}`} />
              <span>{isPinging ? 'Pinging...' : 'Network Health'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Market Feeds & XM Broker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Live Gold Feed Card (GoldAPI.io) */}
        <div className="bg-[#121824] border border-amber-500/30 rounded-xl p-5 shadow-xl font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2638] mb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase">Live Gold Spot Feed</h2>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
              {goldDataSource}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638] mb-3 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-400">Current Spot Gold (XAU/USD):</span>
              <span className="text-lg font-bold text-amber-300">
                ${goldInstrument.currentPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Bid / Ask Spread:</span>
              <span className="text-slate-300">${goldInstrument.bid.toFixed(2)} / ${goldInstrument.ask.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">24h Day Range:</span>
              <span className="text-slate-300">${goldInstrument.low24h.toFixed(2)} — ${goldInstrument.high24h.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Last Live Ingress:</span>
              <span className="text-slate-400">{new Date(lastGoldSyncTime).toLocaleTimeString()}</span>
            </div>
          </div>

          <form onSubmit={handleSaveGoldApiKey} className="space-y-3">
            <div>
              <label className="text-slate-300 block mb-1">
                GoldAPI.io API Key (Optional)
              </label>
              <input
                type="password"
                id="settings-goldapi-key-input"
                value={goldKeyInput}
                onChange={(e) => setGoldKeyInput(e.target.value)}
                placeholder="Enter GOLDAPI_KEY (e.g. goldapi-12345...)"
                className="w-full bg-[#0B0E14] border border-[#232D42] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 text-xs"
              />
              <span className="text-[10px] text-slate-500 block mt-1">
                Leave blank to automatically use institutional spot physical ticker.
              </span>
            </div>

            {goldSyncFeedback && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{goldSyncFeedback}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase transition-all shadow-md active:scale-98 cursor-pointer"
              >
                Save Gold Feed Key
              </button>

              <button
                type="button"
                onClick={handleForceSyncGold}
                disabled={isSyncingGold}
                className="px-3 py-2 rounded-lg bg-[#1A2234] hover:bg-[#232D42] text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGold ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          </form>
        </div>

        {/* XM Broker Spread & Ultra-Low Calibration Card */}
        <div className="bg-[#121824] border border-sky-500/30 rounded-xl p-5 shadow-xl font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2638] mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-white uppercase">XM Broker Calibration</h2>
            </div>
            <button
              onClick={() => setIsXmModalOpen(true)}
              className="text-[10px] text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              Open Guide
            </button>
          </div>

          <div className="bg-[#0B0E14] p-3 rounded-lg border border-[#1E2638] mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Current Account Tier:</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-bold">
                {XM_BROKER_PRESETS[xmBrokerTier]?.label || xmBrokerTier}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Gold Spread:</span>
              <span className="text-base font-bold text-sky-300">
                {goldSpreadPips.toFixed(1)} Pips (${(goldSpreadPips * 0.1).toFixed(2)})
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {XM_BROKER_PRESETS[xmBrokerTier]?.description || 'Optimized for high-frequency scalping.'}
            </p>
          </div>

          {/* Tier Selection Buttons */}
          <div className="space-y-2 mb-3">
            <label className="text-slate-300 block">Select XM Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['XM_ULTRA_LOW', 'XM_STANDARD', 'XM_MICRO'] as XmBrokerTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => updateXmSpread(tier, XM_BROKER_PRESETS[tier].spreadPips)}
                  className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                    xmBrokerTier === tier
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400 font-bold shadow-sm'
                      : 'bg-[#0B0E14] text-slate-400 border-[#232D42] hover:bg-[#1A2234]'
                  }`}
                >
                  <div className="text-[11px]">
                    {tier === 'XM_ULTRA_LOW' ? 'Ultra-Low' : tier === 'XM_STANDARD' ? 'Standard' : 'Micro'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {XM_BROKER_PRESETS[tier].spreadPips} pips
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Spread Fine-Tuning */}
          <div className="pt-2 border-t border-[#1E2638] flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Fine-Tune Spread:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateXmSpread('CUSTOM', Math.max(1.0, +(goldSpreadPips - 0.5).toFixed(1)))}
                className="w-7 h-7 rounded bg-[#1A2234] hover:bg-[#232D42] text-white border border-[#232D42] font-bold text-xs cursor-pointer"
              >
                -
              </button>
              <span className="font-bold text-sky-300 w-12 text-center text-xs">
                {goldSpreadPips.toFixed(1)}
              </span>
              <button
                type="button"
                onClick={() => updateXmSpread('CUSTOM', Math.min(30.0, +(goldSpreadPips + 0.5).toFixed(1)))}
                className="w-7 h-7 rounded bg-[#1A2234] hover:bg-[#232D42] text-white border border-[#232D42] font-bold text-xs cursor-pointer"
              >
                +
              </button>
              <span className="text-slate-400 text-[10px]">pips</span>
            </div>
          </div>
        </div>

      </div>

      {/* Grid: Institutional Risk & Device/Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Risk & Leverage Parameters */}
        <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2638] mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold text-white font-mono uppercase">
                Risk Management & Safeguards
              </h2>
            </div>
            {riskSavedNotice && (
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveRisk} className="space-y-4 font-mono text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-slate-400">Default Scalp Order Size (Lots)</label>
                <span className="text-amber-300 font-bold">{riskSettings.defaultLotSize} Lots</span>
              </div>
              <div className="flex items-center gap-2">
                {[0.1, 0.5, 1.0, 2.0, 5.0].map(lot => (
                  <button
                    key={lot}
                    type="button"
                    onClick={() => setRiskSettings(s => ({ ...s, defaultLotSize: lot }))}
                    className={`flex-1 py-1.5 rounded border text-xs cursor-pointer transition-all ${
                      riskSettings.defaultLotSize === lot
                        ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-sm'
                        : 'bg-[#0B0E14] text-slate-300 border-[#232D42] hover:bg-[#1A2234]'
                    }`}
                  >
                    {lot}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-slate-400">Account Leverage Ratio</label>
                <span className="text-white font-bold">1 : {riskSettings.accountLeverage}</span>
              </div>
              <div className="flex items-center gap-2">
                {[50, 100, 200, 500].map(lev => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => setRiskSettings(s => ({ ...s, accountLeverage: lev }))}
                    className={`flex-1 py-1.5 rounded border text-xs cursor-pointer transition-all ${
                      riskSettings.accountLeverage === lev
                        ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-sm'
                        : 'bg-[#0B0E14] text-slate-300 border-[#232D42] hover:bg-[#1A2234]'
                    }`}
                  >
                    1:{lev}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-slate-400">Max Daily Drawdown Cutoff</label>
                <span className="text-rose-400 font-bold">{riskSettings.maxDailyDrawdownPercent}%</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                value={riskSettings.maxDailyDrawdownPercent}
                onChange={(e) => setRiskSettings(s => ({ ...s, maxDailyDrawdownPercent: parseFloat(e.target.value) }))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-slate-400">Risk Allocation Per Trade</label>
                <span className="text-emerald-400 font-bold">{riskSettings.riskPerTradePercent}% of Equity</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={riskSettings.riskPerTradePercent}
                onChange={(e) => setRiskSettings(s => ({ ...s, riskPerTradePercent: parseFloat(e.target.value) }))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-slate-400">Simulated Broker Slippage</label>
                <span className="text-slate-200 font-bold">{riskSettings.slippageSimulationPips} pips</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.1"
                value={riskSettings.slippageSimulationPips}
                onChange={(e) => setRiskSettings(s => ({ ...s, slippageSimulationPips: parseFloat(e.target.value) }))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              id="settings-save-risk-btn"
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Risk Rules</span>
            </button>
          </form>
        </div>

        {/* Connectivity Diagnostics & Export Utilities */}
        <div className="space-y-4">
          
          {/* Network Guard Card */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-5 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2638] mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white uppercase">Connection Guard</h2>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isOnline 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {networkStatus}
              </span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed mb-3">
              Monitors socket round-trip latency to live pricing servers. If a disconnection is detected, executions are frozen to prevent fills on unverified quotes.
            </p>

            {pingResult && (
              <div className="p-2.5 rounded bg-[#0B0E14] border border-[#232D42] text-white text-[11px] mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span>{pingResult}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePingTest}
                disabled={isPinging}
                className="flex-1 py-2 rounded-lg bg-[#1A2234] hover:bg-[#232D42] text-slate-200 border border-[#232D42] text-xs font-bold cursor-pointer transition-colors"
              >
                {isPinging ? 'Pinging...' : 'Test Gateway Ping'}
              </button>

              <button
                type="button"
                onClick={simulateNetworkDrop}
                className="px-3 py-2 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Test Offline Guard</span>
              </button>
            </div>
          </div>

          {/* Quick Downloads & Apps */}
          <div className="bg-[#121824] border border-[#1E2638] rounded-xl p-5 shadow-xl font-mono text-xs">
            <h2 className="text-sm font-bold text-white uppercase mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-400" />
              <span>Mobile App & Source Code</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsAndroidInstallModalOpen(true)}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#232D42] hover:border-emerald-500/50 text-left cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                  <Smartphone className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Install PWA / Android</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Add to home screen on phone or desktop with offline caching.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(true)}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#232D42] hover:border-amber-500/50 text-left cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
                  <FolderArchive className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Download Codebase</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Export complete self-contained project archive as a .ZIP.
                </p>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
