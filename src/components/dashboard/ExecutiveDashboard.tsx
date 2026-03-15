import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useRouter } from '../../App';
import { Application, Bundle } from '../../types';
import { DashboardFilters, ExecutiveDashboardResponse } from '../../types/dashboard';
import MetricCard from './MetricCard';

type Props = {
  bundles: Bundle[];
  applications: Application[];
};

const emptyData: ExecutiveDashboardResponse = {
  filters: { timeWindow: '30d' },
  summary: {
    bundles: { id: 'bundles', label: 'Bundles', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' },
    milestones: { id: 'milestones', label: 'Milestones', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' },
    workItems: { id: 'workItems', label: 'Work Items', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' },
    blocked: { id: 'blocked', label: 'Blocked', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' },
    highCriticalRisks: { id: 'highCriticalRisks', label: 'High/Critical Risks', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' },
    overdue: { id: 'overdue', label: 'Overdue', value: 0, delta: 0, deltaLabel: 'vs previous period', status: 'on_track' }
  },
  progressTrend: [],
  forecast: [],
  atRiskBundles: [],
  blockerHeatmap: { dimension: 'bundle', cells: [] },
  riskTrend: [],
  velocityTrend: [],
  milestoneBurndown: null,
  capacityUtilization: [],
  dependencyRiskMap: [],
  workItemAging: [],
  applicationDistribution: { dimension: 'bundle', items: [] },
  healthPulse: [],
  aiSummary: []
};

const riskBandStyle = (band: string) => {
  if (band === 'high') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (band === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

const utilizationColor = (status: string) => {
  if (status === 'OVERLOADED') return '#ef4444';
  if (status === 'WATCH') return '#f59e0b';
  if (status === 'HEALTHY') return '#10b981';
  return '#60a5fa';
};

const severityBadge = (value: string) => {
  if (value === 'CRITICAL') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (value === 'HIGH') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (value === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

const ExecutiveDashboard: React.FC<Props> = ({ bundles = [], applications = [] }) => {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [data, setData] = React.useState<ExecutiveDashboardResponse>(emptyData);
  const [filters, setFilters] = React.useState<DashboardFilters>({
    timeWindow: '30d',
    compareTo: 'prev_month',
    viewMode: 'executive'
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) query.set(key, String(value));
      });
      const res = await fetch(`/api/dashboard/executive?${query.toString()}`);
      const payload = await res.json();
      if (!res.ok || payload?.status !== 'success') throw new Error(payload?.error || 'Unable to load dashboard.');
      setData(payload.data || emptyData);
    } catch (err: any) {
      setError(err?.message || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const summaryCards = Object.values(data.summary);

  return (
    <div className="space-y-5 animate-fadeIn">
      <header className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Decision Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Track delivery health, forecast risk, and intervention priorities across bundles.</p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mt-4">
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.bundleId || ''} onChange={(e) => setFilters((v) => ({ ...v, bundleId: e.target.value || undefined }))}>
            <option value="">All Bundles</option>
            {bundles.map((bundle) => <option key={bundle._id} value={bundle._id}>{bundle.name}</option>)}
          </select>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.applicationId || ''} onChange={(e) => setFilters((v) => ({ ...v, applicationId: e.target.value || undefined }))}>
            <option value="">All Applications</option>
            {applications.map((app) => <option key={app._id} value={app._id}>{app.name}</option>)}
          </select>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.teamId || ''} onChange={(e) => setFilters((v) => ({ ...v, teamId: e.target.value || undefined }))}>
            <option value="">All Teams</option>
            <option value="SVP">SVP</option>
            <option value="Engineering">Engineering</option>
            <option value="CMO">CMO</option>
          </select>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.timeWindow || '30d'} onChange={(e) => setFilters((v) => ({ ...v, timeWindow: e.target.value as any }))}>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="quarter">Current Quarter</option>
          </select>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.compareTo || 'prev_month'} onChange={(e) => setFilters((v) => ({ ...v, compareTo: e.target.value as any }))}>
            <option value="prev_week">vs Previous Week</option>
            <option value="prev_month">vs Previous Month</option>
            <option value="prev_quarter">vs Previous Quarter</option>
          </select>
          <select className="rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-700" value={filters.viewMode || 'executive'} onChange={(e) => setFilters((v) => ({ ...v, viewMode: e.target.value as any }))}>
            <option value="executive">Executive</option>
            <option value="delivery">Delivery</option>
            <option value="risk">Risk</option>
          </select>
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading executive dashboard...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {summaryCards.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                onClick={() => router.push(metric.href || '/program')}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Delivery Progress Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.progressTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="planned" stroke="#64748b" strokeWidth={2} dot={false} name="Planned %" />
                    <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} name="Actual %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Delivery Forecast</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.forecast.map((row) => (
                  <button
                    key={row.bundleId}
                    onClick={() => router.push(`/program?bundleIds=${encodeURIComponent(row.bundleId)}`)}
                    className="w-full text-left rounded-lg border border-slate-200 p-3 bg-slate-50 hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.bundleName}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        row.riskLevel === 'AT_RISK' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          row.riskLevel === 'WATCH' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>{row.riskLevel.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Planned: {row.plannedGoLive ? new Date(row.plannedGoLive).toLocaleDateString() : 'N/A'} | Forecast: {row.forecastGoLive ? new Date(row.forecastGoLive).toLocaleDateString() : 'N/A'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Variance: {row.varianceDays} day(s) | Confidence: {row.confidence}</p>
                  </button>
                ))}
                {data.forecast.length === 0 && <div className="text-sm text-slate-400">Not enough data to forecast go-live.</div>}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">At-Risk Bundles</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.atRiskBundles.slice(0, 8).map((bundle) => (
                  <button key={bundle.bundleId} onClick={() => router.push(`/program?bundleIds=${encodeURIComponent(bundle.bundleId)}`)} className="w-full text-left rounded-lg border border-slate-200 p-3 bg-slate-50 hover:bg-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{bundle.bundleName}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskBandStyle(bundle.band)}`}>{bundle.band}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Risk Score {bundle.riskScore} | Blocked {bundle.blocked} | Overdue {bundle.overdue}</p>
                  </button>
                ))}
                {data.atRiskBundles.length === 0 && <div className="text-sm text-slate-400">No at-risk bundles detected.</div>}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Blocker Heatmap</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.blockerHeatmap.cells}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="blockers" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Risk Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.riskTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="openRisks" stroke="#0f172a" strokeWidth={2} dot={false} />
                    <Line dataKey="highCriticalRisks" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line dataKey="blockedProxy" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Velocity Trend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.velocityTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="committed" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="completed" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Capacity Utilization</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.capacityUtilization} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="team" width={90} />
                    <Tooltip />
                    <Bar dataKey="utilizationPercent" radius={[0, 6, 6, 0]}>
                      {data.capacityUtilization.map((row) => <Cell key={row.team} fill={utilizationColor(row.status)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Work Item Aging</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.workItemAging}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Application Distribution</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.applicationDistribution.items}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">Health Pulse</h3>
              <div className="h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.healthPulse} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={55}>
                      {data.healthPulse.map((slice) => (
                        <Cell
                          key={slice.key}
                          fill={slice.key === 'healthy' ? '#10b981' : slice.key === 'watch' ? '#f59e0b' : slice.key === 'at_risk' ? '#f97316' : '#ef4444'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">AI Summary</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.aiSummary.slice(0, 6).map((insight) => (
                <button
                  key={insight.id}
                  onClick={() => router.push(insight.href || '/?tab=ai-insights')}
                  className="text-left rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${severityBadge(insight.severity)}`}>{insight.severity}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Confidence {insight.confidence}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{insight.summary}</p>
                  <p className="text-xs text-blue-700 mt-2 font-semibold">Recommended action: {insight.recommendation}</p>
                </button>
              ))}
              {data.aiSummary.length === 0 && <div className="text-sm text-slate-400">AI summary will appear after AI analysis is generated.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
