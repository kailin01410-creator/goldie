import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  X, 
  Radio, 
  Zap, 
  SunMedium, 
  Compass, 
  LineChart, 
  Layers, 
  Sliders, 
  FlaskConical, 
  Briefcase, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  RefreshCw,
  SlidersHorizontal,
  CornerDownLeft
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  category: 'Signals' | 'Charts' | 'Strategies' | 'Portfolio' | 'Actions';
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  badge?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { 
    setActiveTab, 
    instruments, 
    setActiveSymbol, 
    batchScanMarketSignals, 
    tradingStyle, 
    setTradingStyle,
    scalpSignals,
    openPositions
  } = useTrading();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const allCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Primary views
      {
        id: 'view_unified_feed',
        title: 'Unified Signal Feed',
        category: 'Signals',
        description: 'Multi-asset algorithmic signal desk with live confluences',
        icon: Radio,
        shortcut: '1',
        badge: scalpSignals.length > 0 ? `${scalpSignals.length} Active` : undefined,
        action: () => {
          setActiveTab('unified_feed');
          onClose();
        },
      },
      {
        id: 'view_goldscalp',
        title: 'GoldScalp Terminal',
        category: 'Signals',
        description: 'High-frequency M1/M5 GoldScalp RSI & MACD execution engine',
        icon: Zap,
        shortcut: 'G',
        badge: 'Next.js',
        action: () => {
          setActiveTab('goldscalp');
          onClose();
        },
      },
      {
        id: 'view_scalp',
        title: 'Scalping Terminal',
        category: 'Signals',
        description: 'M1/M5 Order Flow, Footprint absorption, and SMC execution',
        icon: Zap,
        shortcut: '3',
        badge: '85.2% WR',
        action: () => {
          setActiveTab('scalp');
          onClose();
        },
      },
      {
        id: 'view_day_trading',
        title: 'Day Trading Desk',
        category: 'Signals',
        description: 'H1 Volume Profile, session AMD manipulation & swing targets',
        icon: SunMedium,
        shortcut: '4',
        badge: '88.4% WR',
        action: () => {
          setActiveTab('day_trading');
          onClose();
        },
      },
      {
        id: 'view_confluence',
        title: 'Institutional Confluence Engine',
        category: 'Signals',
        description: '4-Stage institutional confirmation checklist & macro DXY correlation',
        icon: Compass,
        shortcut: '5',
        badge: 'LIVE',
        action: () => {
          setActiveTab('confluence');
          onClose();
        },
      },
      {
        id: 'view_chart',
        title: 'Unified Live Studio (Charts, Indicators & Strategies)',
        category: 'Charts',
        description: 'Interactive candlestick chart with instant Liquidity Sweeps, SMC, EMA, VWAP overlays',
        icon: LineChart,
        shortcut: '6',
        badge: 'All-in-One',
        action: () => {
          setActiveTab('chart');
          onClose();
        },
      },
      {
        id: 'view_mtf',
        title: 'Multi-Timeframe Trend Matrix',
        category: 'Charts',
        description: 'M1 to D1 indicator alignment matrix with TradingView parity',
        icon: Layers,
        shortcut: '7',
        action: () => {
          setActiveTab('mtf');
          onClose();
        },
      },
      {
        id: 'view_strategy_dashboard',
        title: 'Strategy Dashboard & DXY Engine',
        category: 'Strategies',
        description: 'Manage 12 quantitative models, win rates & inverse macro correlation',
        icon: Sliders,
        shortcut: '2',
        badge: 'DXY r=-0.91',
        action: () => {
          setActiveTab('strategy_dashboard');
          onClose();
        },
      },
      {
        id: 'view_strategy_lab',
        title: 'Strategy Backtest Lab',
        category: 'Strategies',
        description: 'Empirical backtesting simulator, equity curves & risk analytics',
        icon: FlaskConical,
        shortcut: '9',
        action: () => {
          setActiveTab('strategy_lab');
          onClose();
        },
      },
      {
        id: 'view_orders',
        title: 'Portfolio & Positions',
        category: 'Portfolio',
        description: 'Active paper orders, floating PnL, lot sizing and order history',
        icon: Briefcase,
        shortcut: '8',
        badge: openPositions.length > 0 ? `${openPositions.length} Open` : undefined,
        action: () => {
          setActiveTab('orders');
          onClose();
        },
      },
      {
        id: 'view_settings',
        title: 'Terminal Settings & Risk Controls',
        category: 'Portfolio',
        description: 'Broker spreads, risk rules, loss caps and market feeds',
        icon: Sliders,
        shortcut: '0',
        action: () => {
          setActiveTab('settings');
          onClose();
        },
      },
      // Quick Actions
      {
        id: 'action_scan_all',
        title: 'Scan Gold Market for High-Confluence Setups',
        category: 'Actions',
        description: 'Scan live XAU/USD gold feeds, order flow and institutional confluences',
        icon: RefreshCw,
        shortcut: 'Scan',
        action: () => {
          batchScanMarketSignals();
          setActiveTab('unified_feed');
          onClose();
        },
      },
      {
        id: 'action_toggle_style',
        title: `Switch Mode: ${tradingStyle === 'SCALPING' ? 'Switch to Day Trading (1H)' : 'Switch to Scalping (5M)'}`,
        category: 'Actions',
        description: `Currently in ${tradingStyle} mode with calibrated ATR risk`,
        icon: SlidersHorizontal,
        action: () => {
          setTradingStyle(tradingStyle === 'SCALPING' ? 'DAY_TRADING' : 'SCALPING');
          onClose();
        },
      },
    ];

    // Quick symbol switches
    instruments.forEach(inst => {
      items.push({
        id: `switch_symbol_${inst.symbol}`,
        title: `Switch Symbol to ${inst.symbol}`,
        category: 'Actions',
        description: `${inst.name} • Price: $${inst.currentPrice.toLocaleString()} (${inst.change24h >= 0 ? '+' : ''}${inst.change24h}%)`,
        icon: TrendingUp,
        badge: inst.symbol.startsWith('XAU') ? 'Gold 3.0 pip' : undefined,
        action: () => {
          setActiveSymbol(inst.symbol);
          onClose();
        },
      });
    });

    return items;
  }, [
    scalpSignals.length,
    openPositions.length,
    tradingStyle,
    instruments,
    setActiveTab,
    onClose,
    batchScanMarketSignals,
    setTradingStyle,
    setActiveSymbol,
  ]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(cmd => 
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase() === q)
    );
  }, [allCommands, query]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        id="command-palette-modal"
        className="w-full max-w-2xl bg-[#0e131d] border border-amber-500/40 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#1E2638] bg-[#0A0D14]">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input 
            ref={inputRef}
            id="command-palette-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a tab name, strategy, market symbol, or shortcut (1-0)..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none font-sans"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-[#161F30] border border-slate-700/60 text-[10px] font-mono text-slate-400">
            <span>ESC</span>
            <span>to close</span>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#1E2638]/40"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs">
              No matching tabs or commands found for "{query}".
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  data-index={idx}
                  id={`command-item-${cmd.id}`}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-amber-500/15 border border-amber-500/50 text-white' 
                      : 'hover:bg-[#141b27] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected ? 'bg-amber-500/30 text-amber-300' : 'bg-[#151D2C] text-slate-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate text-white">
                          {cmd.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#161F30] text-slate-400 border border-[#1E2638]">
                          {cmd.category}
                        </span>
                        {cmd.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#121824] border border-slate-700 text-[11px] font-mono text-amber-400 font-bold">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-4 h-4 text-amber-400 hidden sm:block" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-[#090C12] border-t border-[#1E2638] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>1-0 for direct tab jump</span>
          </div>
          <span className="text-amber-400/80 font-semibold">Institutional Navigation</span>
        </div>
      </div>
    </div>
  );
};
