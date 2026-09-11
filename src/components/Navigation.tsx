import React, { useMemo } from 'react';
import { 
  Zap, 
  Layers, 
  LineChart, 
  Briefcase, 
  FlaskConical, 
  ShieldCheck,
  SunMedium,
  Compass,
  Radio,
  Sliders,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { getCurrentSessionDetails } from '../utils/sessionManager';

export interface SubTabItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  hotkey: string;
  badge?: string | number;
  badgeType?: 'emerald' | 'amber' | 'cyan' | 'slate';
}

export interface WorkspaceCategory {
  id: 'signals' | 'charts' | 'strategies' | 'portfolio';
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  defaultTabId: string;
  badge?: string | number;
  badgeType?: 'emerald' | 'amber' | 'cyan' | 'slate';
  tabs: SubTabItem[];
}

interface NavigationProps {
  onOpenCommandPalette?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onOpenCommandPalette }) => {
  const { 
    activeTab, 
    setActiveTab, 
    openPositions, 
    scalpSignals, 
    batchScanMarketSignals, 
    isGeneratingSignal,
    tradingStyle,
    setTradingStyle
  } = useTrading();

  // Current Market Session context
  const sessionDetails = useMemo(() => {
    return getCurrentSessionDetails();
  }, []);

  // Define organized workspaces
  const workspaces: WorkspaceCategory[] = useMemo(() => [
    {
      id: 'signals',
      title: 'Signals Desk',
      shortTitle: 'Signals',
      icon: Radio,
      defaultTabId: 'unified_feed',
      badge: scalpSignals.length > 0 ? `${scalpSignals.length}` : undefined,
      badgeType: 'amber',
      tabs: [
        {
          id: 'unified_feed',
          label: 'Unified Signal Feed',
          shortLabel: 'Live Feed',
          description: 'Multi-asset algorithmic trigger stream with filters',
          icon: Radio,
          hotkey: '1',
          badge: scalpSignals.length > 0 ? `${scalpSignals.length}` : undefined,
          badgeType: 'amber',
        },
        {
          id: 'scalp',
          label: 'Scalping Terminal',
          shortLabel: 'Scalper',
          description: 'M1/M5 Order Flow, Footprints & SMC setup',
          icon: Zap,
          hotkey: '3',
          badge: '85.2% WR',
          badgeType: 'emerald',
        },
        {
          id: 'day_trading',
          label: 'Day Trading Desk',
          shortLabel: 'Day Trader',
          description: 'H1 Volume Profile & Session AMD manipulation',
          icon: SunMedium,
          hotkey: '4',
          badge: '88.4% WR',
          badgeType: 'emerald',
        },
        {
          id: 'confluence',
          label: 'Confluence Engine',
          shortLabel: 'Confluence',
          description: '4-Stage institutional confirmation checklist',
          icon: Compass,
          hotkey: '5',
          badge: 'LIVE',
          badgeType: 'cyan',
        },
      ],
    },
    {
      id: 'charts',
      title: 'Charts & Depth',
      shortTitle: 'Charts',
      icon: LineChart,
      defaultTabId: 'chart',
      badge: 'Live',
      badgeType: 'emerald',
      tabs: [
        {
          id: 'chart',
          label: 'Live Chart & Order Book Depth',
          shortLabel: 'Live Chart',
          description: 'Interactive candles, POC/VAH/VAL & Level II depth',
          icon: LineChart,
          hotkey: '6',
        },
        {
          id: 'mtf',
          label: 'Multi-Timeframe Trend Matrix',
          shortLabel: 'MTF Matrix',
          description: 'M1-D1 institutional trend alignment & MT5 parity',
          icon: Layers,
          hotkey: '7',
        },
      ],
    },
    {
      id: 'strategies',
      title: 'Strategies & Lab',
      shortTitle: 'Strategies',
      icon: Sliders,
      defaultTabId: 'strategy_dashboard',
      badge: 'DXY Macro',
      badgeType: 'cyan',
      tabs: [
        {
          id: 'strategy_dashboard',
          label: 'Strategy Dashboard',
          shortLabel: 'Dashboard',
          description: '12 modular quantitative models & DXY correlation',
          icon: Sliders,
          hotkey: '2',
          badge: 'DXY r=-0.91',
          badgeType: 'cyan',
        },
        {
          id: 'strategy_lab',
          label: 'Strategy Backtest Lab',
          shortLabel: 'Backtest Lab',
          description: 'Walk-forward empirical backtest & equity curves',
          icon: FlaskConical,
          hotkey: '9',
        },
      ],
    },
    {
      id: 'portfolio',
      title: 'Portfolio & Broker',
      shortTitle: 'Portfolio',
      icon: Briefcase,
      defaultTabId: 'orders',
      badge: openPositions.length > 0 ? `${openPositions.length}` : undefined,
      badgeType: 'emerald',
      tabs: [
        {
          id: 'orders',
          label: 'Positions & Orders',
          shortLabel: 'Positions',
          description: 'Active paper portfolio, floating PnL & trade logs',
          icon: Briefcase,
          hotkey: '8',
          badge: openPositions.length > 0 ? `${openPositions.length} Open` : undefined,
          badgeType: 'emerald',
        },
        {
          id: 'settings',
          label: 'Terminal Settings & Risk',
          shortLabel: 'Settings',
          description: 'XM Ultra-Low calibration, spreads & risk caps',
          icon: Sliders,
          hotkey: '0',
        },
      ],
    },
  ], [scalpSignals.length, openPositions.length]);

  // Determine active workspace from activeTab
  const activeWorkspace = useMemo<WorkspaceCategory>(() => {
    for (const ws of workspaces) {
      if (ws.tabs.some(t => t.id === activeTab)) {
        return ws;
      }
    }
    return workspaces[0];
  }, [workspaces, activeTab]);

  // Active sub-tab details
  const activeSubTab = useMemo<SubTabItem | undefined>(() => {
    return activeWorkspace.tabs.find(t => t.id === activeTab);
  }, [activeWorkspace, activeTab]);

  // Handle workspace click
  const handleSelectWorkspace = (workspace: WorkspaceCategory) => {
    // If the activeTab is already in this workspace, keep it; otherwise switch to workspace's default tab
    if (workspace.tabs.some(t => t.id === activeTab)) {
      return;
    }
    setActiveTab(workspace.defaultTabId);
  };

  return (
    <nav className="bg-[#0B0E14] border-b border-[#1E2638] sticky top-[57px] z-30 shadow-md">
      {/* Tier 1: Primary Workspaces Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-2 pb-1.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 border-b border-[#1E2638]/60">
        
        {/* Workspace Pills Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
          {workspaces.map(ws => {
            const Icon = ws.icon;
            const isWsActive = activeWorkspace.id === ws.id;

            return (
              <button
                key={ws.id}
                id={`workspace-tab-${ws.id}`}
                onClick={() => handleSelectWorkspace(ws)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer whitespace-nowrap shrink-0 relative ${
                  isWsActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/10'
                    : 'bg-[#101622] text-slate-400 hover:text-slate-200 hover:bg-[#151D2C] border border-[#1E2638]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isWsActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline font-sans">{ws.title}</span>
                <span className="inline sm:hidden font-sans">{ws.shortTitle}</span>

                {ws.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    ws.badgeType === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : ws.badgeType === 'cyan'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {ws.badge}
                  </span>
                )}

                {isWsActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse hidden sm:inline-block ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right side utility actions: Quick Jump & Market Scan */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {/* Active Session Badge */}
          <div 
            title={`Active Trading Session: ${sessionDetails.activeSessionsSummary}`}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#101622] border border-[#1E2638] text-[11px] font-mono text-slate-300"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span className="text-slate-400">Session:</span>
            <span className="text-amber-300 font-semibold">{sessionDetails.activeSessionsSummary}</span>
          </div>

          {/* Quick Jump / Command Palette Button */}
          {onOpenCommandPalette && (
            <button
              id="btn-open-command-palette"
              onClick={onOpenCommandPalette}
              title="Open Navigation Search & Quick Jump (Cmd+K)"
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#121824] hover:bg-[#1A2234] border border-[#1E2638] hover:border-slate-600 text-slate-300 text-xs font-mono transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Quick Jump</span>
              <kbd className="text-[10px] px-1.5 py-0.2 rounded bg-[#0A0D14] border border-slate-700 text-amber-400 font-bold">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Batch Market Scan Button */}
          <button
            id="btn-nav-batch-scan"
            onClick={batchScanMarketSignals}
            disabled={isGeneratingSignal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all border cursor-pointer ${
              isGeneratingSignal
                ? 'bg-amber-500/10 text-amber-400/60 border-amber-500/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 hover:text-white border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isGeneratingSignal ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
            <span className="hidden sm:inline">Scan Markets</span>
            <span className="inline sm:hidden">Scan</span>
          </button>
        </div>
      </div>

      {/* Tier 2: Contextual Sub-Nav Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        
        {/* Sub-tabs List */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5">
          {activeWorkspace.tabs.map(tab => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`tab-nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                title={`${tab.label} (Press ${tab.hotkey})`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all select-none cursor-pointer whitespace-nowrap shrink-0 relative ${
                  isTabActive
                    ? 'bg-[#182236] text-white border border-amber-500/70 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30'
                    : 'bg-[#0E131E] text-slate-400 hover:text-slate-200 hover:bg-[#131A28] border border-[#1E2638]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isTabActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="font-sans font-medium">{tab.label}</span>

                {/* Hotkey Indicator */}
                <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                  isTabActive 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                    : 'bg-[#131A28] text-slate-400 border-slate-800'
                }`}>
                  [{tab.hotkey}]
                </span>

                {/* Optional Status Badge */}
                {tab.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    tab.badgeType === 'emerald'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : tab.badgeType === 'cyan'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Breadcrumb / Context Description */}
        {activeSubTab && (
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 truncate">
            <span className="text-amber-400 font-semibold">{activeWorkspace.title}</span>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            <span className="text-slate-300">{activeSubTab.label}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 truncate">{activeSubTab.description}</span>
          </div>
        )}
      </div>
    </nav>
  );
};
