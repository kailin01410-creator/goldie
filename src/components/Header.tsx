import React from 'react';
import { 
  Activity, 
  ShieldCheck, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Pause,
  Sliders,
  DollarSign,
  Wifi,
  WifiOff,
  RefreshCw,
  Coins,
  Smartphone,
  SunMedium,
  DownloadCloud,
  Download
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

export const Header: React.FC = () => {
  const { 
    instruments, 
    activeInstrument, 
    setActiveSymbol, 
    isLiveFeedActive, 
    setIsLiveFeedActive,
    setIsAndroidInstallModalOpen,
    setIsDownloadModalOpen,
    balance,
    equity,
    generateScalp,
    generateSignal,
    isGeneratingSignal,
    isOnline,
    networkStatus,
    goldDataSource,
    refreshGoldPrice,
    simulateNetworkDrop,
    goldSpreadPips,
    xmBrokerTier,
    setIsXmModalOpen,
    tradingStyle,
    setTradingStyle,
    promptInstallPwa,
    canInstallPwa
  } = useTrading();

  const isProfitable = equity >= balance;

  const toggleStyle = () => {
    const nextStyle = tradingStyle === 'SCALPING' ? 'DAY_TRADING' : 'SCALPING';
    setTradingStyle(nextStyle);
  };

  return (
    <header className="bg-[#0B0E14] border-b border-[#1E2638] sticky top-0 z-40 px-3 sm:px-5 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        {/* Left: Brand & Instrument Selector & Live Status */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Zap className="w-4 h-4 text-black font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm tracking-tight">SCALP<span className="text-amber-400">EDGE</span></span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  MTF PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <span>INSTITUTIONAL ALGO</span>
                <span>•</span>
                <span className="text-emerald-400">BACKTESTED</span>
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Instrument Quick Switcher */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
            {instruments.map(inst => {
              const isSelected = inst.symbol === activeInstrument.symbol;
              const isPositive = inst.change24h >= 0;
              return (
                <button
                  key={inst.symbol}
                  id={`instrument-btn-${inst.symbol.replace('/', '-')}`}
                  onClick={() => setActiveSymbol(inst.symbol)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/10' 
                      : 'bg-[#121824] text-slate-400 hover:text-slate-200 hover:bg-[#1A2234] border border-[#1E2638]'
                  }`}
                >
                  <span className="font-semibold">{inst.symbol}</span>
                  <span className={`text-[10px] ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? '+' : ''}{inst.change24h}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Network Status, Live Gold Source, Active Price, & Paper Balance */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          
          {/* Internet Connection Status Badge */}
          <div 
            title="Real-time internet connection guard status. Drops automatically lock trade execution to protect active positions."
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border ${
              isOnline && networkStatus === 'ONLINE'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden sm:inline">NET: ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>OFFLINE</span>
              </>
            )}
          </div>

          {/* Live Gold Feed Source & Quick Sync */}
          <button
            id="sync-gold-price-btn"
            onClick={() => refreshGoldPrice()}
            title={`Data Provider: ${goldDataSource}. Click to sync fresh live spot quote.`}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#121824] hover:bg-[#182030] text-amber-300 border border-amber-500/30 text-[10px] font-mono transition-colors cursor-pointer"
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span className="hidden md:inline">{goldDataSource}</span>
            <span className="md:hidden">GoldAPI</span>
            <RefreshCw className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
          </button>

          {/* Live Feed Toggle */}
          <button
            id="live-feed-toggle-btn"
            onClick={() => setIsLiveFeedActive(!isLiveFeedActive)}
            title="Toggle Live Market Data Stream"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
              isLiveFeedActive 
                ? 'bg-[#121824] text-slate-300 border-[#1E2638]' 
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isLiveFeedActive ? 'bg-cyan-400' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline">{isLiveFeedActive ? 'STREAM' : 'PAUSED'}</span>
            {isLiveFeedActive ? <Pause className="w-3 h-3 opacity-70" /> : <Play className="w-3 h-3 opacity-70" />}
          </button>

          {/* XM Broker Spread Calibration Button */}
          <button
            id="xm-broker-spread-header-btn"
            onClick={() => setIsXmModalOpen(true)}
            title={`XM Broker Spread: ${goldSpreadPips.toFixed(1)} pips ($${(goldSpreadPips / 10).toFixed(2)}/oz). Click to match your XM demo account.`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/50 transition-all cursor-pointer shadow-sm shadow-amber-500/10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-[11px] font-bold">XM: {goldSpreadPips.toFixed(1)}p</span>
            <span className="hidden lg:inline text-[10px] text-amber-400/80 font-mono">(${ (goldSpreadPips / 10).toFixed(2) })</span>
            <Sliders className="w-3 h-3 text-amber-400 opacity-80" />
          </button>

          {/* Trading Method Toggle (Scalping vs Day Trading) */}
          <button
            id="trading-style-header-btn"
            onClick={toggleStyle}
            title={`Current Method: ${tradingStyle === 'DAY_TRADING' ? 'Day Trading (H1/M15)' : 'Scalping (M1/M5)'}. Click to toggle.`}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-all cursor-pointer shadow-sm ${
              tradingStyle === 'DAY_TRADING'
                ? 'bg-sky-950/50 text-sky-300 border-sky-500/50 hover:bg-sky-900/50 shadow-sky-500/10'
                : 'bg-amber-950/50 text-amber-300 border-amber-500/50 hover:bg-amber-900/50 shadow-amber-500/10'
            }`}
          >
            {tradingStyle === 'DAY_TRADING' ? (
              <SunMedium className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="font-mono text-[11px] font-bold">
              {tradingStyle === 'DAY_TRADING' ? 'DAY TRADE' : 'SCALP'}
            </span>
          </button>

          {/* Active Price Card */}
          <div className="bg-[#121824] border border-[#1E2638] px-2.5 py-1 rounded flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono uppercase">{activeInstrument.symbol}</span>
            <div className="flex items-baseline gap-1">
              <span className={`font-mono font-bold text-sm tracking-tight ${
                activeInstrument.tickDirection === 'UP' ? 'text-emerald-400' : activeInstrument.tickDirection === 'DOWN' ? 'text-rose-400' : 'text-white'
              }`}>
                {activeInstrument.currentPrice.toFixed(activeInstrument.decimals)}
              </span>
              {activeInstrument.tickDirection === 'UP' ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-rose-400" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
              Sprd: {activeInstrument.spreadPips}p
            </span>
          </div>

          {/* Paper Trading Balance */}
          <div className="bg-[#121824] border border-[#1E2638] px-2.5 py-1 rounded hidden xl:flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <div className="text-left">
              <div className="text-[9px] text-slate-400 uppercase font-mono leading-none">Paper Equity</div>
              <div className={`text-xs font-mono font-bold leading-tight ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${(equity ?? 50000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Android / PWA Install Button */}
          <button
            id="android-install-header-btn"
            onClick={() => promptInstallPwa()}
            title="Install app on your phone, tablet, or desktop"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50 transition-all cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-mono text-[11px] font-bold">Install App</span>
            <span className="sm:hidden font-mono text-[11px]">Install</span>
          </button>

          {/* Download Project Codebase (.ZIP) Button */}
          <button
            id="download-codebase-header-btn"
            onClick={() => setIsDownloadModalOpen(true)}
            title="Download complete project codebase (.zip) with all source files"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/50 transition-all cursor-pointer shadow-sm shadow-amber-500/10"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline font-mono text-[11px] font-bold">Download Code</span>
            <span className="sm:hidden font-mono text-[11px]">ZIP</span>
          </button>

          {/* Quick Generate Action Button (Dual Scalp / Day Trading) */}
          <button
            id="quick-generate-scalp-header-btn"
            onClick={() => generateSignal(undefined, tradingStyle)}
            disabled={isGeneratingSignal}
            className={`font-bold px-3 py-1 rounded text-xs transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
              tradingStyle === 'DAY_TRADING'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/20'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-amber-500/20'
            }`}
          >
            {tradingStyle === 'DAY_TRADING' ? (
              <SunMedium className={`w-3.5 h-3.5 ${isGeneratingSignal ? 'animate-spin' : ''}`} />
            ) : (
              <Zap className={`w-3.5 h-3.5 ${isGeneratingSignal ? 'animate-spin' : ''}`} />
            )}
            <span className="hidden sm:inline">
              {isGeneratingSignal ? 'Backtesting...' : tradingStyle === 'DAY_TRADING' ? 'Scan Day Trade' : 'Scan Scalp'}
            </span>
          </button>

        </div>
      </div>
    </header>
  );
};
