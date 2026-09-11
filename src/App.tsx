import React, { useEffect } from 'react';
import { TradingProvider, useTrading } from './context/TradingContext';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { UnifiedSignalFeedTab } from './components/UnifiedSignalFeedTab';
import { StrategyDashboardTab } from './components/StrategyDashboardTab';
import { ScalpGeneratorTab } from './components/ScalpGeneratorTab';
import { DayTradingTab } from './components/DayTradingTab';
import { InstitutionalConfluenceTab } from './components/InstitutionalConfluenceTab';
import { MtfMatrixTab } from './components/MtfMatrixTab';
import { ChartTab } from './components/ChartTab';
import { PaperPositionsTab } from './components/PaperPositionsTab';
import { StrategyLabTab } from './components/StrategyLabTab';
import { SettingsTab } from './components/SettingsTab';
import { OfflineLockOverlay } from './components/OfflineLockOverlay';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { XmBrokerModal } from './components/XmBrokerModal';
import { DownloadModal } from './components/DownloadModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';

const MainLayout: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    isAndroidInstallModalOpen, 
    setIsAndroidInstallModalOpen,
    isDownloadModalOpen,
    setIsDownloadModalOpen
  } = useTrading();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);

  // Instant keyboard shortcuts for 0-lag switching + Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette on Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === '1') setActiveTab('unified_feed');
      else if (e.key === '2') setActiveTab('strategy_dashboard');
      else if (e.key === '3') setActiveTab('scalp');
      else if (e.key === '4') setActiveTab('day_trading');
      else if (e.key === '5') setActiveTab('confluence');
      else if (e.key === '6') setActiveTab('chart');
      else if (e.key === '7') setActiveTab('mtf');
      else if (e.key === '8') setActiveTab('orders');
      else if (e.key === '9') setActiveTab('strategy_lab');
      else if (e.key === '0') setActiveTab('settings');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Institutional Header */}
      <Header />

      {/* Dual-Tier Zero-Lag Workspace Navigation */}
      <Navigation onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

      {/* Main Tab Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {activeTab === 'unified_feed' && <UnifiedSignalFeedTab />}
        {activeTab === 'strategy_dashboard' && <StrategyDashboardTab />}
        {activeTab === 'scalp' && <ScalpGeneratorTab />}
        {activeTab === 'day_trading' && <DayTradingTab />}
        {activeTab === 'confluence' && <InstitutionalConfluenceTab />}
        {activeTab === 'mtf' && <MtfMatrixTab />}
        {activeTab === 'chart' && <ChartTab />}
        {activeTab === 'orders' && <PaperPositionsTab />}
        {activeTab === 'strategy_lab' && <StrategyLabTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {/* Footer Info Strip */}
      <footer className="bg-[#0B0E14] border-t border-[#1E2638] px-4 py-2.5 text-[11px] font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Unified Signal Feed & Strategy Dashboard Active • DXY Inverse Macro Engine (r=-0.91)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-slate-400">Quick Jump: [⌘K] | Direct Keys: [1-0]</span>
            <span className="text-slate-400">XM Broker Calibrated Feed</span>
          </div>
        </div>
      </footer>

      {/* Quick Navigation Command Palette */}
      <CommandPaletteModal 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Network Disconnection Lockout Overlay */}
      <OfflineLockOverlay />

      {/* Android Phone Installation & USB Debugging Modal */}
      <AndroidInstallModal 
        isOpen={isAndroidInstallModalOpen} 
        onClose={() => setIsAndroidInstallModalOpen(false)} 
      />

      {/* XM Broker Gold Spread Calibration Modal */}
      <XmBrokerModal />

      {/* Codebase & Project Files Download Modal */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
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
