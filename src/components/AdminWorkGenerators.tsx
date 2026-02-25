import React, { useEffect, useState } from 'react';

const AdminWorkGenerators: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);

  const fetchItems = async () => {
    const res = await fetch('/api/admin/work-generators');
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => { fetchItems(); }, []);

  const update = async (eventType: string, patch: any) => {
    await fetch('/api/admin/work-generators', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, ...patch })
    });
    fetchItems();
  };

  return (
    <div className="p-12">
      <header className="mb-10">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Work Generators</h3>
        <p className="text-slate-500 mt-2">Enable/disable event-driven generators.</p>
      </header>
      <div className="space-y-6">
        {items.map((gen) => (
          <div key={gen.eventType} className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-800">{gen.eventType}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{gen.blueprintKey}</div>
              </div>
              <button
                onClick={() => update(gen.eventType, { enabled: !gen.enabled })}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border ${
                  gen.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {gen.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <pre className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] text-slate-600 overflow-x-auto">
{JSON.stringify(gen, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminWorkGenerators;
