import React, { useState } from 'react';
import { 
  Download, 
  Check, 
  FileCode2, 
  FolderArchive, 
  X, 
  Sparkles, 
  ExternalLink, 
  Terminal, 
  Copy,
  Layers,
  FolderTree,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadZip = () => {
    setIsDownloading(true);
    // Create direct anchor trigger
    const link = document.createElement('a');
    link.href = '/api/download-zip';
    link.setAttribute('download', 'scalp-day-trading-terminal-codebase.zip');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setIsDownloading(false);
    }, 2500);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(label);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const projectFilesList = [
    { path: 'src/components/DayTradingTab.tsx', desc: 'Institutional Day Trading Session Engine' },
    { path: 'src/components/ScalpGeneratorTab.tsx', desc: 'Pre-backtested Scalp Signal Engine' },
    { path: 'src/components/StrategyLabTab.tsx', desc: 'Quantitative 7-Indicator Backtest Matrix' },
    { path: 'src/components/MtfMatrixTab.tsx', desc: 'Multi-Timeframe % Momentum Matrix' },
    { path: 'src/components/ChartTab.tsx', desc: 'Interactive Candlestick & Liquidity Visualizer' },
    { path: 'src/components/PaperPositionsTab.tsx', desc: 'Active Orders & Paper Trading Tracker' },
    { path: 'src/components/SettingsTab.tsx', desc: 'Terminal Settings & Risk Controls' },
    { path: 'src/components/XmBrokerModal.tsx', desc: 'XM Broker Gold Spread Calibration' },
    { path: 'src/utils/backtester.ts', desc: 'Empirical Backtester & Indicator Matrix Engine' },
    { path: 'src/context/TradingContext.tsx', desc: 'Global State, Signals & XM Spread Manager' },
    { path: 'server.ts', desc: 'Full-Stack Express & Live Gold Spot Price API' },
    { path: 'package.json', desc: 'NPM Project Manifest & Build Scripts' },
    { path: 'vite.config.ts', desc: 'Vite & Tailwind CSS Configuration' },
    { path: 'public/manifest.json', desc: 'PWA Web App Manifest (Android/iOS/Desktop)' },
    { path: 'public/sw.js', desc: 'Offline Service Worker' },
    { path: 'README.md', desc: 'Complete Setup & Local Running Instructions' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#101520] border border-[#1E2638] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-5 border-b border-[#1E2638] flex items-center justify-between bg-[#0B0E14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
              <FolderArchive className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Download Complete Project Codebase</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ALL FILES COMPILED
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Get all source files, configurations, scripts, and documentation in a clean .zip package.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2234] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* Main 1-Click Download Hero Action */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-amber-300 uppercase block">
                Direct 1-Click Download
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                scalp-day-trading-terminal-codebase.zip
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Includes complete TypeScript code, server, styles, PWA manifest, and documentation.
              </p>
            </div>

            <button
              id="confirm-download-zip-btn"
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase font-mono flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span>{isDownloading ? 'Packaging ZIP...' : 'Download ZIP Archive'}</span>
            </button>
          </div>

          {/* How to Download from Google AI Studio UI */}
          <div className="bg-[#0B0E14] border border-[#1E2638] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase">
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Alternative Download Method (AI Studio Export Menu)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              You can also export your codebase directly from Google AI Studio at any time:
            </p>
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside font-mono">
              <li>Click the <strong className="text-white">Settings / Options (three dots or gear)</strong> icon in the top-right header of Google AI Studio.</li>
              <li>Select <strong className="text-amber-400">"Export to ZIP"</strong> or <strong className="text-amber-400">"Export to GitHub"</strong>.</li>
              <li>Your browser will instantly download the complete repository package.</li>
            </ol>
          </div>

          {/* Quick Start Terminal Commands */}
          <div className="bg-[#0B0E14] border border-[#1E2638] rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300 font-bold uppercase">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>How to Run Locally on Your Machine</span>
              </div>
              <button
                onClick={() => copyToClipboard('npm install && npm run dev', 'commands')}
                className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                {copiedStep === 'commands' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedStep === 'commands' ? 'Copied!' : 'Copy Commands'}</span>
              </button>
            </div>

            <div className="bg-[#07090E] p-3 rounded-lg border border-[#1E2638] text-slate-300 space-y-1 overflow-x-auto text-[11px]">
              <div className="text-slate-500"># 1. Unzip the downloaded archive and open terminal inside folder</div>
              <div className="text-emerald-400">$ npm install</div>
              <div className="text-slate-500 mt-1"># 2. Start the development server (runs on http://localhost:3000)</div>
              <div className="text-emerald-400">$ npm run dev</div>
              <div className="text-slate-500 mt-1"># 3. For production deployment (Cloud Run, Docker, VPS):</div>
              <div className="text-emerald-400">$ npm run build && npm start</div>
            </div>
          </div>

          {/* Included Files Inventory */}
          <div className="bg-[#0B0E14] border border-[#1E2638] rounded-xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-300 font-bold uppercase">
              <FolderTree className="w-4 h-4 text-purple-400" />
              <span>Key Files Included in Download Archive</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {projectFilesList.map((file, idx) => (
                <div key={idx} className="p-2 rounded bg-[#121824] border border-[#1E2638] flex items-start gap-2">
                  <FileCode2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="truncate">
                    <div className="text-white font-bold truncate text-[11px]">{file.path}</div>
                    <div className="text-slate-400 text-[10px] font-sans truncate">{file.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1E2638] bg-[#0B0E14] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Compiled with TypeScript 5.8 & Vite 6</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#121824] hover:bg-[#1A2234] text-slate-300 text-xs font-mono font-semibold border border-[#1E2638] cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Downloading...' : 'Download (.ZIP)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
