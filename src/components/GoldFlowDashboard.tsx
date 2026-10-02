import React from 'react';
import { LiveChartPanel } from './panels/LiveChartPanel';
import { MarketOverviewPanel } from './panels/MarketOverviewPanel';
import { TechnicalAnalysisPanel } from './panels/TechnicalAnalysisPanel';
import { OrderFlowPanel } from './panels/OrderFlowPanel';
import { OptionsGexPanel } from './panels/OptionsGexPanel';

export const GoldFlowDashboard: React.FC = () => {
  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* PANEL 1: LIVE GOLD PRICE CHART */}
      <section aria-label="Live Gold Price Chart">
        <LiveChartPanel />
      </section>

      {/* PANEL 2: TECHNICAL ANALYSIS ENGINE */}
      <section aria-label="Technical Analysis">
        <TechnicalAnalysisPanel />
      </section>

      {/* PANEL 3: MARKET OVERVIEW */}
      <section aria-label="Market Overview">
        <MarketOverviewPanel />
      </section>

      {/* PANELS 4 & 5: ORDER-FLOW & OPTIONS/GEX PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* PANEL 4: ORDER-FLOW PANEL */}
        <section aria-label="Order-Flow Panel">
          <OrderFlowPanel />
        </section>

        {/* PANEL 5: OPTIONS/GEX PANEL */}
        <section aria-label="Options and GEX Panel">
          <OptionsGexPanel />
        </section>
      </div>
    </div>
  );
};
