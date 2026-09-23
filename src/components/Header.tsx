import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  Settings,
  ChevronDown,
  Activity,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Sparkles
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

export const Header: React.FC = () => {
  const { 
    activeInstrument,
    setActiveSymbol,
    instruments,
    isOnline,
    goldDataSource,
    refreshGoldPrice,
    isMarketClosed,
    marketClosureReason,
    lastGoldSyncTime,
    setIsSettingsModalOpen,
    setIsAngelModalOpen,
    activeProject
  } = useTrading();

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState<boolean>(false);
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Track elapsed seconds since last live update
  useEffect(() => {
    const updateElapsed = () => {
      if (lastGoldSyncTime > 0) {
        const elapsed = Math.floor((Date.now() - lastGoldSyncTime) / 1000);
        setSecondsAgo(Math.max(0, elapsed));
      }
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [lastGoldSyncTime]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshGoldPrice();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const formattedUpdateTime = lastGoldSyncTime > 0 
    ? new Date(lastGoldSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : 'Connecting...';

  const isUp = activeInstrument.change24h >= 0;
  const changeDollars = (activeInstrument.currentPrice - (activeInstrument.open24h || activeInstrument.currentPrice));

  return (
    <header className="bg-[#070A0F] border-b border-[#1E2638] sticky top-0 z-40 px-3 sm:px-5 py-2.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Left Section: App Name + Instrument Selector + Live Price */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* App Name: GoldFlow Dashboard */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Activity className="w-4 h-4 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-extrabold text-sm tracking-tight font-sans">
                  Gold<span className="text-amber-400">Flow</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  DASHBOARD
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                PRECISION BULLION TERMINAL
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-[#1E2638] hidden sm:block" />

          {/* Instrument Selector showing XAU/USD */}
          <div className="relative">
            <button
              id="instrument-selector-dropdown-btn"
              type="button"
              onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0E131F] hover:bg-[#141B2D] border border-[#1E2638] hover:border-cyan-500/50 text-white font-mono text-xs font-bold transition-all cursor-pointer shadow-sm"
              aria-label="Select Instrument"
            >
              <span className="text-amber-400 font-bold">{activeInstrument.symbol}</span>
              <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">{activeInstrument.name}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isSymbolDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSymbolDropdownOpen && (
              <div 
                className="absolute top-full left-0 mt-1.5 w-60 bg-[#0D121D] border border-[#1E2638] rounded-xl shadow-2xl z-50 p-1.5 space-y-1 font-mono text-xs animate-fadeIn"
                onMouseLeave={() => setIsSymbolDropdownOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Configurable Instruments
                </div>
                {instruments.map(inst => (
                  <button
                    key={inst.symbol}
                    type="button"
                    onClick={() => {
                      setActiveSymbol(inst.symbol);
                      setIsSymbolDropdownOpen(false);
                      refreshGoldPrice();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      inst.symbol === activeInstrument.symbol
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-300 hover:bg-[#141B2D] hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{inst.symbol}</div>
                      <div className="text-[10px] text-slate-400">{inst.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${inst.currentPrice.toFixed(inst.decimals)}</div>
                      <div className={`text-[10px] ${inst.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {inst.change24h >= 0 ? '+' : ''}{inst.change24h}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-[#1E2638] hidden md:block" />

          {/* Live Price, Price Change, Percentage Change */}
          <div 
            id="header-live-price-pill"
            className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-[#0E131F] border border-[#1E2638] font-mono"
            title={`Live Spot Price: $${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}`}
          >
            {/* Live Price */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase font-sans font-medium">Spot:</span>
              <span className={`text-sm font-bold tracking-tight ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
              </span>
              {isUp ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
            </div>

            <div className="w-px h-3.5 bg-[#1E2638]" />

            {/* Price Change in Dollars */}
            <div className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isUp ? '+' : ''}${Math.abs(changeDollars).toFixed(2)}
            </div>

            {/* Percentage Change */}
            <div className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${
              isUp 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {isUp ? '+' : ''}{activeInstrument.change24h.toFixed(2)}%
            </div>
          </div>

        </div>

        {/* Right Section: Live Data Badge + Market Status + Last Updated + API Status + Refresh + Settings */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          
          {/* "Live data" Badge */}
          <div 
            id="live-data-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold tracking-wide shadow-sm shadow-cyan-500/10"
            title="Real-time live bullion streaming feed active"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span>LIVE DATA</span>
          </div>

          {/* Market Status */}
          <div 
            id="header-market-status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono ${
              isMarketClosed
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            }`}
            title={isMarketClosed ? `Market Status: CLOSED (${marketClosureReason || 'Interbank Weekend Close'})` : 'Market Status: OPEN (Active Trading)'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isMarketClosed ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
            <span className="font-bold">{isMarketClosed ? 'CLOSED' : 'OPEN'}</span>
          </div>

          {/* API Connection Status */}
          <div 
            id="header-api-status"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0E131F] border border-[#1E2638] text-[11px] font-mono text-slate-300"
            title={`API Provider: ${goldDataSource}. Connected through secure backend proxy.`}
          >
            {isOnline ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />
            )}
            <span className="text-slate-400 hidden lg:inline">API:</span>
            <span className="text-amber-300 font-semibold truncate max-w-[110px] sm:max-w-none">
              {goldDataSource.includes('GoldAPI') ? 'GoldAPI.io' : 'Live Spot'}
            </span>
          </div>

          {/* Last Updated Time */}
          <div 
            id="header-last-updated-time"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0E131F] border border-[#1E2638] text-[11px] font-mono text-slate-400"
            title={`Last Quote Sync: ${formattedUpdateTime} (${secondsAgo}s ago)`}
          >
            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="hidden sm:inline">Sync:</span>
            <span className="text-slate-200">{formattedUpdateTime}</span>
            <span className="text-[10px] text-slate-500">({secondsAgo}s)</span>
          </div>

          {/* Refresh Indicator */}
          <button
            id="header-refresh-btn"
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-[#0E131F] hover:bg-[#141B2D] border border-[#1E2638] hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh Live Gold Price Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* ANGEL AI Companion Button */}
          <button
            id="header-angel-btn"
            type="button"
            onClick={() => setIsAngelModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gradient-to-r from-amber-500/15 via-amber-500/25 to-yellow-500/15 hover:from-amber-500/25 hover:to-yellow-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-mono text-xs transition-all cursor-pointer shadow-sm shadow-amber-500/10"
            title={`Open ANGEL AI Companion (Adapted to ${activeProject.name})`}
            aria-label="Open ANGEL AI Companion"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-bold text-white">ANGEL</span>
            <span className="hidden md:inline text-[10px] text-amber-300 font-mono">
              ({activeProject.category})
            </span>
          </button>

          {/* Settings Button */}
          <button
            id="header-settings-btn"
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#0E131F] hover:bg-[#141B2D] border border-[#1E2638] hover:border-cyan-500/50 text-slate-300 hover:text-white font-mono text-xs transition-all cursor-pointer"
            title="Open GoldFlow Dashboard Settings"
            aria-label="Open Settings"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-bold">Settings</span>
          </button>

        </div>

      </div>
    </header>
  );
};
