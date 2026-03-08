import React, { useEffect, useMemo, useState } from 'react';
import type {
  PortfolioPlanSummary,
  PortfolioPlanDetail,
  PortfolioOverview,
  PortfolioDependencyEdge,
  PortfolioForecastSummary,
  PlanForecastSummary,
  PortfolioProbabilisticForecastSummary,
  PlanProbabilisticForecastSummary
} from '../../types';
import {
  buildPortfolioTimelineRows,
  buildPortfolioDependencyGraph,
  computePortfolioHealthMetrics
} from './portfolioViewModels';
import PortfolioTimelineView from './PortfolioTimelineView';
import PortfolioDependencyView from './PortfolioDependencyView';
import PortfolioHealthSummary from './PortfolioHealthSummary';
import ExplainabilityIcon from '../explainability/ExplainabilityIcon';

const PortfolioDashboard: React.FC = () => {
  const [plans, setPlans] = useState<PortfolioPlanSummary[]>([]);
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<{ plans: PortfolioPlanDetail[]; dependencies: PortfolioDependencyEdge[] } | null>(null);
  const [forecastSummary, setForecastSummary] = useState<PortfolioForecastSummary | null>(null);
  const [forecastPlans, setForecastPlans] = useState<PlanForecastSummary[]>([]);
  const [probSummary, setProbSummary] = useState<PortfolioProbabilisticForecastSummary | null>(null);
  const [probPlans, setProbPlans] = useState<PlanProbabilisticForecastSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'dependencies' | 'health'>('timeline');
  const [error, setError] = useState<string | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/portfolio/plans');
        const data = await res.json();
        if (res.ok && Array.isArray(data?.plans)) {
          setPlans(data.plans);
          setSelectedPlans(data.plans.slice(0, 3).map((p: PortfolioPlanSummary) => p.id));
        } else {
          setError(data?.error || 'Failed to load portfolio plans.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load portfolio plans.');
      }
    };
    const loadOverview = async () => {
      try {
        const res = await fetch('/api/portfolio/overview');
        const data = await res.json();
        if (res.ok) setOverview(data.overview);
      } catch {}
    };
    load();
    loadOverview();
  }, []);

  useEffect(() => {
    if (!selectedPlans.length) {
      setCompareData(null);
      setForecastSummary(null);
      setForecastPlans([]);
      setProbSummary(null);
      setProbPlans([]);
      return;
    }
    const loadCompare = async () => {
      setLoadingCompare(true);
      setError(null);
      try {
        const res = await fetch('/api/portfolio/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planIds: selectedPlans })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load portfolio comparison.');
        setCompareData({ plans: data.plans || [], dependencies: data.dependencies || [] });
      } catch (err: any) {
        setError(err?.message || 'Failed to load portfolio comparison.');
      } finally {
        setLoadingCompare(false);
      }
    };
    loadCompare();
  }, [selectedPlans]);

  useEffect(() => {
    if (!selectedPlans.length) return;
    const loadForecast = async () => {
      try {
        const res = await fetch('/api/forecast/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planIds: selectedPlans })
        });
        const data = await res.json();
        if (!res.ok) return;
        setForecastSummary(data.portfolioSummary || null);
        setForecastPlans(Array.isArray(data.planForecasts) ? data.planForecasts : []);
      } catch {}
    };
    loadForecast();
  }, [selectedPlans]);

  useEffect(() => {
    if (!selectedPlans.length) return;
    const loadProbForecast = async () => {
      try {
        const res = await fetch('/api/probabilistic-forecast/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planIds: selectedPlans })
        });
        const data = await res.json();
        if (!res.ok) return;
        setProbSummary(data.portfolioSummary || null);
        setProbPlans(Array.isArray(data.planForecasts) ? data.planForecasts : []);
      } catch {}
    };
    loadProbForecast();
  }, [selectedPlans]);

  const togglePlan = (id: string) => {
    setSelectedPlans((prev) => (
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    ));
  };

  const timelineRows = useMemo(() => (compareData ? buildPortfolioTimelineRows(compareData.plans) : []), [compareData]);
  const dependencyGraph = useMemo(() => (compareData ? buildPortfolioDependencyGraph(compareData.plans, compareData.dependencies) : { nodes: [], edges: [] }), [compareData]);
  const healthRows = useMemo(() => (compareData ? computePortfolioHealthMetrics(compareData.plans) : []), [compareData]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portfolio</h1>
          <p className="text-sm text-slate-500">Cross-plan delivery analytics and milestone pressure.</p>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Work Items · Portfolio</div>
      </header>

      <section className="grid md:grid-cols-9 gap-4">
        <SummaryCard label="Plans" value={overview?.totalPlans ?? plans.length} />
        <SummaryCard label="Milestones" value={overview?.totalMilestones ?? '—'} />
        <SummaryCard label="High Risk" value={overview?.highRiskMilestones ?? '—'} explainabilityKey="high_risk_milestones" />
        <SummaryCard label="Overloaded" value={overview?.overloadedMilestones ?? '—'} explainabilityKey="capacity_utilization" />
        <SummaryCard label="Avg Utilization" value={overview?.avgUtilization != null ? `${Math.round(overview.avgUtilization * 100)}%` : '—'} explainabilityKey="average_utilization" />
        <SummaryCard label="Expected Slip" value={forecastSummary ? `${forecastSummary.expectedPortfolioSlipDays}d` : '—'} explainabilityKey="expected_portfolio_slip" />
        <SummaryCard label="Low Confidence Plans" value={forecastPlans.filter((p) => p.averageConfidence === 'LOW').length} explainabilityKey="portfolio_health" />
        <SummaryCard label="Avg On-Time" value={probSummary ? `${Math.round(probSummary.averageOnTimeProbability * 100)}%` : '—'} explainabilityKey="on_time_probability" />
        <SummaryCard label="High Uncertainty" value={probSummary?.highUncertaintyMilestones ?? '—'} explainabilityKey="uncertainty_level" />
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-slate-400">Plan Selection</div>
            <div className="text-sm text-slate-500">Choose which plans to compare in portfolio views.</div>
          </div>
          <div className="text-[10px] text-slate-400">Selected: {selectedPlans.length}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => {
            const active = selectedPlans.includes(plan.id);
            return (
              <button
                key={plan.id}
                onClick={() => togglePlan(plan.id)}
                className={`px-3 py-2 rounded-full border text-xs font-semibold transition-all ${
                  active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {plan.name}
              </button>
            );
          })}
          {!plans.length && <div className="text-sm text-slate-500">No plans available.</div>}
        </div>
      </section>

      <section className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {([
              { id: 'timeline', label: 'Timeline' },
              { id: 'dependencies', label: 'Dependencies' },
              { id: 'health', label: 'Health' }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {loadingCompare && <div className="text-xs text-slate-500">Updating portfolio...</div>}
        </div>

        {error && <div className="text-sm text-rose-600">{error}</div>}

        {activeTab === 'timeline' && <PortfolioTimelineView rows={timelineRows} />}
        {activeTab === 'dependencies' && <PortfolioDependencyView graph={dependencyGraph} />}
        {activeTab === 'health' && <PortfolioHealthSummary rows={healthRows} />}
      </section>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string | number; explainabilityKey?: string }> = ({ label, value, explainabilityKey }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4">
    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black inline-flex items-center gap-2">
      {label}
      {explainabilityKey && <ExplainabilityIcon explainabilityKey={explainabilityKey} />}
    </div>
    <div className="text-2xl font-black text-slate-900 mt-2">{value}</div>
  </div>
);

export default PortfolioDashboard;
