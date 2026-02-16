
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Application, Bundle } from '../types';

interface DashboardProps {
  applications: Application[];
  bundles: Bundle[];
}

const Dashboard: React.FC<DashboardProps> = ({ applications = [], bundles = [] }) => {
  const data = (bundles || []).map(bundle => ({
    name: bundle.name,
    apps: (applications || []).filter(app => String(app.bundleId) === String(bundle._id)).length,
  }));

  const healthData = [
    { name: 'Healthy', value: (applications || []).filter(a => a.status.health === 'Healthy').length, color: '#10b981' },
    { name: 'Risk', value: (applications || []).filter(a => a.status.health === 'Risk').length, color: '#f59e0b' },
    { name: 'Critical', value: (applications || []).filter(a => a.status.health === 'Critical').length, color: '#ef4444' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Portfolio Executive View</h1>
        <p className="text-slate-500">Real-time KPIs and delivery metrics across all business clusters.</p>
      </header>

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
