
import React, { useState, useEffect } from 'react';
import { Bundle, WorkItemStatus } from '../types';

const AdminBundles: React.FC = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Partial<Bundle> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBundles();
  }, []);

  const fetchBundles = async () => {
    const res = await fetch('/api/bundles');
    setBundles(await res.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBundle)
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        setEditingBundle(null);
        fetchBundles();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Save operation failed');
    } finally {
      setLoading(false);
    }
  };

  const updateWipLimit = (status: string, val: string) => {
    const limits = { ...(editingBundle?.wipLimits || {}) };
    const num = parseInt(val);
    if (isNaN(num) || num <= 0) delete limits[status];
    else limits[status] = num;
    setEditingBundle({ ...editingBundle, wipLimits: limits });
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Bundles</h2>
          <p className="text-slate-500 font-medium text-sm">Organize applications into delivery clusters.</p>
        </div>
        <button 
          onClick={() => { setEditingBundle({ key: '', name: '', isActive: true, wipLimits: {} }); setIsModalOpen(true); }}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl"
        >
          + Add Bundle
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Key</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">WIP Control</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {bundles.map(b => (
              <tr key={b._id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase tracking-widest">{b.key}</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{b.name}</span>
                    <span className="text-[10px] text-slate-400 truncate max-w-xs">{b.description}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                   {b.wipLimits && Object.keys(b.wipLimits).length > 0 ? (
                     <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-shield-halved text-amber-500 text-[10px]"></i>
                        <span className="text-[10px] font-bold text-slate-600">{Object.keys(b.wipLimits).length} Active Limits</span>
                     </div>
                   ) : <span className="text-[9px] text-slate-300 uppercase">None</span>}
                </td>
                <td className="px-8 py-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${b.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {b.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => { setEditingBundle(b); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-all"><i className="fas fa-edit"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl animate-fadeIn border border-slate-100 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h3 className="text-3xl font-black text-slate-900 mb-2">{editingBundle?._id ? 'Edit' : 'New'} Bundle</h3>
            {error && <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2 col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Key</label>
                  <input required maxLength={6} value={editingBundle?.key || ''} onChange={(e) => setEditingBundle({...editingBundle, key: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-black" placeholder="FIN" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Name</label>
                  <input required value={editingBundle?.name || ''} onChange={(e) => setEditingBundle({...editingBundle, name: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea value={editingBundle?.description || ''} onChange={(e) => setEditingBundle({...editingBundle, description: e.target.value})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-slate-700 focus:border-blue-500 font-medium h-20" />
              </div>

              <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Work-in-Progress Controls</h4>
                   <i className="fas fa-traffic-light text-slate-300"></i>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   {Object.values(WorkItemStatus).map(status => (
                     <div key={status} className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">{status.replace(/_/g, ' ')} Limit</label>
                        <input 
                          type="number"
                          placeholder="No limit"
                          value={editingBundle?.wipLimits?.[status] || ''}
                          onChange={(e) => updateWipLimit(status, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500"
                        />
                     </div>
                   ))}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl disabled:opacity-50 uppercase tracking-widest">
                  {loading ? 'Processing...' : 'Commit Bundle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBundles;
