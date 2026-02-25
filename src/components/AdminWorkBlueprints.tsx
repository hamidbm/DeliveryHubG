import React, { useEffect, useState } from 'react';

const AdminWorkBlueprints: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);

  const fetchItems = async () => {
    const res = await fetch('/api/admin/work-blueprints');
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchItems(); }, []);

  const update = async (key: string, patch: any) => {
    await fetch('/api/admin/work-blueprints', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ...patch })
    });
    fetchItems();
  };

  return (
    <div className="p-12">
      <header className="mb-10">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Work Blueprints</h3>
        <p className="text-slate-500 mt-2">Enable/disable and set default blueprint. JSON is read-only.</p>
      </header>
      <div className="space-y-6">
        {items.map((bp) => (
          <div key={bp.key} className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-black text-slate-800">{bp.name}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{bp.key} • v{bp.version}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => update(bp.key, { enabled: !bp.enabled })}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border ${
                    bp.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  {bp.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={() => update(bp.key, { isDefault: true })}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border ${
                    bp.isDefault ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {bp.isDefault ? 'Default' : 'Set Default'}
                </button>
              </div>
            </div>
            <pre className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] text-slate-600 overflow-x-auto">
{JSON.stringify(bp, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminWorkBlueprints;
