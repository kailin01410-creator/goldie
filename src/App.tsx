import React from 'react';
import { TradingProvider, useTrading } from './context/TradingContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { GoldFlowDashboard } from './components/GoldFlowDashboard';
import { OfflineLockOverlay } from './components/OfflineLockOverlay';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { DownloadModal } from './components/DownloadModal';
import { GoldApiKeyModal } from './components/GoldApiKeyModal';
import { SettingsModal } from './components/SettingsModal';
import { AngelCompanionModal } from './components/angel/AngelCompanionModal';
import { AngelFloatingButton } from './components/angel/AngelFloatingButton';
import { PriceAlertModal } from './components/alerts/PriceAlertModal';
import { PriceAlertToastContainer } from './components/alerts/PriceAlertToastContainer';

const MainLayout: React.FC = () => {
  const { 
    isAndroidInstallModalOpen, 
    setIsAndroidInstallModalOpen,
    isDownloadModalOpen,
    setIsDownloadModalOpen,
    isGoldKeyModalOpen,
    setIsGoldKeyModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isAngelModalOpen,
    setIsAngelModalOpen,
    isPriceAlertModalOpen,
    setIsPriceAlertModalOpen
  } = useTrading();

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Premier GoldFlow Dashboard Top Bar */}
      <Header />

      {/* Navigation Sub-Bar */}
      <Navigation />

      {/* Main Viewport: The 5 Premier Terminal Panels */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        <GoldFlowDashboard />
      </main>

      {/* Footer Info Strip */}
      <footer className="bg-[#0B0E14] border-t border-[#1E2638] px-4 py-2.5 text-[11px] font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GoldFlow Dashboard • Real-Time Bullion Pricing Engine & Multi-Timeframe Analytics</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>Powered by GoldAPI.io & Institutional Spot Feeds</span>
          </div>
        </div>
      </footer>

      {/* Real-Time Price Alert Toast Notifications */}
      <PriceAlertToastContainer />

      {/* Price Alert Threshold Configuration Modal */}
      <PriceAlertModal
        isOpen={isPriceAlertModalOpen}
        onClose={() => setIsPriceAlertModalOpen(false)}
      />

      {/* Network Disconnection Lockout Overlay */}
      <OfflineLockOverlay />

      {/* Android Phone Installation Modal */}
      <AndroidInstallModal 
        isOpen={isAndroidInstallModalOpen} 
        onClose={() => setIsAndroidInstallModalOpen(false)} 
      />

      {/* Codebase & Project Files Download Modal */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />

      {/* GoldAPI Key Manual Input & Diagnostics Modal */}
      <GoldApiKeyModal
        isOpen={isGoldKeyModalOpen}
        onClose={() => setIsGoldKeyModalOpen(false)}
      />

      {/* GoldFlow Dashboard Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* ANGEL AI Companion Modal */}
      <AngelCompanionModal
        isOpen={isAngelModalOpen}
        onClose={() => setIsAngelModalOpen(false)}
      />

      {/* Floating ANGEL Orb Trigger */}
      <AngelFloatingButton />
    </div>
  );
};

export default function App() {
  return (
    <TradingProvider>
      <MainLayout />
    </TradingProvider>
  );
}
