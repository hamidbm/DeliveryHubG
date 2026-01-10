
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { APPLICATIONS, BUNDLES, WORK_ITEMS } from '../constants';

const Dashboard: React.FC = () => {
  const data = BUNDLES.map(bundle => ({
    name: bundle.name,
    apps: APPLICATIONS.filter(app => app.bundleId === bundle.id).length,
    avgProgress: Math.round(
      APPLICATIONS.filter(app => app.bundleId === bundle.id)
        .reduce((acc, curr) => acc + curr.migrationProgress, 0) / 
        Math.max(1, APPLICATIONS.filter(app => app.bundleId === bundle.id).length)
    )
  }));

  const healthData = [
    { name: 'Healthy', value: APPLICATIONS.filter(a => a.health === 'Healthy').length, color: '#10b981' },
    { name: 'Risk', value: APPLICATIONS.filter(a => a.health === 'Risk').length, color: '#f59e0b' },
    { name: 'Critical', value: APPLICATIONS.filter(a => a.health === 'Critical').length, color: '#ef4444' },
  ];

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Portfolio Executive View</h1>
        <p className="text-slate-500">Real-time KPIs and delivery metrics across all business bundles.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Apps" value={APPLICATIONS.length.toString()} icon="fa-cubes" color="blue" trend="+2 this month" />
        <Card title="Active Vendors" value="4" icon="fa-users" color="purple" trend="Stable" />
        <Card title="Avg Migration" value="57%" icon="fa-cloud-upload-alt" color="emerald" trend="+5% growth" />
        <Card title="Open Risks" value="3" icon="fa-exclamation-triangle" color="amber" trend="-1 from last week" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4">Application Count by Bundle</h3>
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
          <h3 className="font-semibold text-slate-700 mb-4">Portfolio Health</h3>
          <div className="h-64 flex items-center justify-center">
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
              <span className="text-2xl font-bold">{APPLICATIONS.length}</span>
              <span className="text-xs text-slate-400">Apps</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-slate-700">Recent Critical Work Items</h3>
          <button className="text-blue-600 text-sm font-medium hover:underline">View All</button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-3">Item</th>
              <th className="px-6 py-3">App</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {WORK_ITEMS.slice(0, 4).map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-700">{item.title}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{APPLICATIONS.find(a => a.id === item.applicationId)?.name}</td>
                <td className="px-6 py-4 text-xs font-semibold">
                  <span className={`px-2 py-1 rounded-full ${
                    item.status === 'Done' ? 'bg-green-100 text-green-700' : 
                    item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs">
                  <span className={`font-bold ${
                    item.priority === 'Critical' ? 'text-red-500' : 
                    item.priority === 'High' ? 'text-orange-500' : 'text-slate-400'
                  }`}>
                    {item.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
