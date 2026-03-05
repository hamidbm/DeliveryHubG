import React from 'react';

const windowOptions = [
  { label: '1d', value: 1 },
  { label: '7d', value: 7 },
  { label: '30d', value: 30 }
];

const rangeForWindow = (days: number) => {
  if (days <= 1) return '24h';
  if (days <= 7) return '7d';
  return '30d';
};

type OpsMetrics = {
  windowDays: number;
  since: string;
  jobs: Array<{ name: string; type: string; lastRunAt: string | null; lastDurationMs: number | null; lastOk: boolean | null; failuresLast7d: number; avgDurationMs: number | null }>;
  apis: Array<{ name: string; count: number; p50: number | null; p95: number | null; errorRate: number }>;
  cache: Array<{ name: string; hits: number; misses: number; hitRate: number }>;
  notifications: { byDay: Array<{ day: string; counts: Record<string, number> }>; totalsByType: Record<string, number> };
};

interface AdminOpsDashboardProps {
  onOpenEvents?: (filters: { typePrefix?: string; search?: string; range?: string }) => void;
  onOpenNotifications?: (filters: { type?: string; range?: string }) => void;
}

const AdminOpsDashboard: React.FC<AdminOpsDashboardProps> = ({ onOpenEvents, onOpenNotifications }) => {
  const [windowDays, setWindowDays] = React.useState(7);
  const [metrics, setMetrics] = React.useState<OpsMetrics | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/metrics?windowDays=${windowDays}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load metrics');
        setMetrics(null);
        return;
      }
      setMetrics(data as OpsMetrics);
    } catch (err: any) {
      setError(err?.message || 'Failed to load metrics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMetrics();
  }, [windowDays]);

  const range = rangeForWindow(windowDays);

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-gauge-high text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Operations</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Ops Dashboard</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Health and performance signals across jobs, APIs, caches, and notifications.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
          >
            {windowOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
          {metrics?.since && (
            <div className="text-[10px] text-slate-400">Since {new Date(metrics.since).toLocaleDateString()}</div>
          )}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-sm text-slate-400">Loading metrics…</div>
        )}

        {!loading && metrics && (
          <>
            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Health</div>
                  <div className="text-sm text-slate-500">Latest runs and failure counts.</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Job</th>
                    <th className="text-left px-4 py-3">Last Run</th>
                    <th className="text-left px-4 py-3">Last Duration</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Failures</th>
                    <th className="text-left px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.jobs.map((job) => (
                    <tr key={job.type} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-700">{job.name}</td>
                      <td className="px-4 py-3 text-slate-500">{job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{job.lastDurationMs !== null ? `${job.lastDurationMs}ms` : '—'}</td>
                      <td className="px-4 py-3">
                        {job.lastOk === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${job.lastOk ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {job.lastOk ? 'OK' : 'FAIL'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{job.failuresLast7d}</td>
                      <td className="px-4 py-3 text-right">
                        {onOpenEvents && (
                          <button
                            onClick={() => onOpenEvents({ typePrefix: job.type.split('.')[0], search: job.type, range })}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
                          >
                            View events
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">API Performance</div>
                <div className="text-sm text-slate-500">Latency percentiles for key endpoints.</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Endpoint</th>
                    <th className="text-left px-4 py-3">Count</th>
                    <th className="text-left px-4 py-3">P50</th>
                    <th className="text-left px-4 py-3">P95</th>
                    <th className="text-left px-4 py-3">Error Rate</th>
                    <th className="text-left px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.apis.map((api) => (
                    <tr key={api.name} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-700">{api.name}</td>
                      <td className="px-4 py-3 text-slate-500">{api.count}</td>
                      <td className="px-4 py-3 text-slate-500">{api.p50 !== null ? `${api.p50}ms` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{api.p95 !== null ? `${api.p95}ms` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{(api.errorRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        {onOpenEvents && (
                          <button
                            onClick={() => onOpenEvents({ typePrefix: 'perf', search: api.name, range })}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
                          >
                            View events
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cache Effectiveness</div>
                <div className="text-sm text-slate-500">Hit rates for expensive computations.</div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-3">Cache</th>
                    <th className="text-left px-4 py-3">Hit Rate</th>
                    <th className="text-left px-4 py-3">Hits</th>
                    <th className="text-left px-4 py-3">Misses</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.cache.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.name}</td>
                      <td className="px-4 py-3 text-slate-500">{(row.hitRate * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-slate-500">{row.hits}</td>
                      <td className="px-4 py-3 text-slate-500">{row.misses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notifications Volume</div>
                <div className="text-sm text-slate-500">Counts per type per day.</div>
              </div>
              <div className="p-6 space-y-3">
                {(metrics.notifications.byDay || []).length === 0 && (
                  <div className="text-sm text-slate-400">No notifications in this window.</div>
                )}
                {(metrics.notifications.byDay || []).map((day) => (
                  <div key={day.day} className="border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-slate-700">{day.day}</div>
                      {onOpenNotifications && (
                        <button
                          onClick={() => onOpenNotifications({ range })}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
                        >
                          View notifications
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(day.counts).map(([type, count]) => (
                        <span key={type} className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                          {type}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminOpsDashboard;
