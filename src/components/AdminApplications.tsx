
import React, { useState, useEffect } from 'react';
import { Application, Bundle } from '../types';

const AdminApplications: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Partial<Application> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [aRes, bRes] = await Promise.all([fetch('/api/applications'), fetch('/api/bundles?active=true')]);
    setApps(await aRes.json());
    setBundles(await bRes.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Pattern validation for AID: ^[A-Z]{0,5}\d*[-_]\d+$
    if (editingApp?.aid && !/^[A-Z]{0,5}\d*[-_]\d+$/i.test(editingApp.aid)) {
      setError('AID must follow pattern: 0-5 letters + optional digits + "-" or "_" + digits (e.g. AIDE-0080632, APP110-013948, 110_42)');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingApp)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setEditingApp(null);
        fetchData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Save operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Application Onboarding</h2>
          <p className="text-slate-500 font-medium text-sm">System-of-record for enterprise software assets.</p>
        </div>
        <button 
          onClick={() => { setEditingApp({ aid: '', name: '', bundleId: bundles[0]?._id, isActive: true, status: { health: 'Healthy' } }); setIsModalOpen(true); }}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl"
        >
          + Provision Application
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">AID</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bundle</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Health</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {apps.map(a => (
              <tr key={a._id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-widest">{a.aid}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="font-bold text-slate-800">{a.name}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="text-xs font-bold text-slate-500">{bundles.find(b => b._id === a.bundleId)?.name || 'Unmapped'}</span>
                </td>
                <td className="px-8 py-6 text-center">
                   <div className={`w-3 h-3 rounded-full inline-block ${
                    a.status.health === 'Healthy' ? 'bg-emerald-500' :
                    a.status.health === 'Risk' ? 'bg-amber-500' : 'bg-red-500'
                  }`}></div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => { setEditingApp(a); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-all"><i className="fas fa-edit"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{editingApp?._id ? 'Refine' : 'Provision'} Application</h3>
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enterprise AID</label>
                  <input required value={editingApp?.aid || ''} onChange={(e) => setEditingApp({...editingApp, aid: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-black" placeholder="APP1234" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Application Name</label>
                  <input required value={editingApp?.name || ''} onChange={(e) => setEditingApp({...editingApp, name: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Bundle Mapping</label>
                <select required value={editingApp?.bundleId || ''} onChange={(e) => setEditingApp({...editingApp, bundleId: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-bold appearance-none">
                  {bundles.map(b => <option key={b._id} value={b._id}>{b.name} ({b.key})</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Onboarding Notes</label>
                <textarea value={editingApp?.description || ''} onChange={(e) => setEditingApp({...editingApp, description: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-medium h-24" />
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Discard</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl disabled:opacity-50">
                  {loading ? 'Initializing Asset...' : 'Confirm Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;
