
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Application, Bundle } from '../types';
import { useRouter } from '../App';

interface DashboardProps {
  applications: Application[];
  bundles: Bundle[];
}

const Dashboard: React.FC<DashboardProps> = ({ applications = [], bundles = [] }) => {
  const router = useRouter();
  const [programIntel, setProgramIntel] = useState<any | null>(null);

  useEffect(() => {
    const loadIntel = async () => {
      try {
        const res = await fetch('/api/program/intel?includeLists=false&limit=10');
        if (!res.ok) return;
        const data = await res.json();
        setProgramIntel(data);
      } catch {
        setProgramIntel(null);
      }
    };
    loadIntel();
  }, []);

  const data = (bundles || []).map(bundle => ({
    name: bundle.name,
    apps: (applications || []).filter(app => String(app.bundleId) === String(bundle._id)).length,
  }));

  const healthData = [
    { name: 'Healthy', value: (applications || []).filter(a => a.status.health === 'Healthy').length, color: '#10b981' },
    { name: 'Risk', value: (applications || []).filter(a => a.status.health === 'Risk').length, color: '#f59e0b' },
    { name: 'Critical', value: (applications || []).filter(a => a.status.health === 'Critical').length, color: '#ef4444' },
  ];

  const summaryCards = useMemo(() => ([
    { label: 'Bundles', value: programIntel?.summary?.bundles ?? 0 },
    { label: 'Milestones', value: programIntel?.summary?.milestones ?? 0 },
    { label: 'Work Items', value: programIntel?.summary?.workItems ?? 0 },
    { label: 'Blocked', value: programIntel?.summary?.blockedDerived ?? 0 },
    { label: 'High/Critical', value: programIntel?.summary?.highCriticalRisks ?? 0 },
    { label: 'Overdue', value: programIntel?.summary?.overdueOpen ?? 0 }
  ]), [programIntel]);

  const atRiskBundles = (programIntel?.bundleRollups || []).slice(0, 5);

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Portfolio Executive View</h1>
        <p className="text-slate-500">Real-time KPIs and delivery metrics across all business clusters.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Program Health</div>
            <div className="text-sm font-semibold text-slate-700">Cross-bundle execution risk snapshot</div>
          </div>
          <button
            onClick={() => router.push('/program')}
            className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
          >
            View details
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="border border-slate-100 rounded-xl p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{card.label}</div>
              <div className="text-lg font-black text-slate-800">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="border border-slate-100 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">At-Risk Bundles</div>
            <div className="space-y-2">
              {atRiskBundles.map((b: any) => (
                <button
                  key={b.bundleId}
                  onClick={() => router.push(`/program?bundleIds=${encodeURIComponent(String(b.bundleId))}`)}
                  className="w-full flex items-center justify-between text-left border border-slate-100 rounded-lg px-3 py-2 hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{b.bundleName || b.bundleId}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">Blocked {b.aggregated?.blockedDerived || 0} • Risks {b.aggregated?.highCriticalRisks || 0}</div>
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                    b.band === 'high' ? 'bg-emerald-50 text-emerald-700' : b.band === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  }`}>{b.band}</span>
                </button>
              ))}
              {atRiskBundles.length === 0 && <div className="text-sm text-slate-400">No bundle intel yet.</div>}
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Top Cross-Bundle Blockers</div>
            <div className="space-y-2">
              {(programIntel?.listCounts?.topCrossBundleBlockers || 0) === 0 && (
                <div className="text-sm text-slate-400">No blockers detected.</div>
              )}
              {(programIntel?.listCounts?.topCrossBundleBlockers || 0) > 0 && (
                <div className="text-sm text-slate-500">Top blockers available in Program view.</div>
              )}
              <button
                onClick={() => router.push('/program')}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600"
              >
                View in Program
              </button>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">At-Risk Milestones</div>
            <div className="space-y-2">
              {(programIntel?.listCounts?.topAtRiskMilestones || 0) === 0 && (
                <div className="text-sm text-slate-400">No at-risk milestones detected.</div>
              )}
              {(programIntel?.listCounts?.topAtRiskMilestones || 0) > 0 && (
                <div className="text-sm text-slate-500">Top milestones available in Program view.</div>
              )}
              <button
                onClick={() => router.push('/program')}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600"
              >
                View in Program
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Apps" value={applications.length.toString()} icon="fa-cubes" color="blue" trend="+2 this month" />
        <Card title="Active Bundles" value={bundles.length.toString()} icon="fa-layer-group" color="purple" trend="Stable" />
        <Card title="Avg Migration" value="57%" icon="fa-cloud-upload-alt" color="emerald" trend="+5% growth" />
        <Card title="Open Risks" value={(applications || []).filter(a => a.status.health === 'Critical').length.toString()} icon="fa-exclamation-triangle" color="amber" trend="-1 from last week" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Application Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="apps" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Health Pulse</h3>
          <div className="h-64 flex items-center justify-center relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold">{applications.length}</span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Assets</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value, icon, color, trend }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
      <div className="mt-4 flex items-center text-xs text-slate-400 font-medium">
        <i className="fas fa-arrow-trend-up mr-1 text-emerald-500"></i>
        <span>{trend}</span>
      </div>
    </div>
  );
};

export default Dashboard;
