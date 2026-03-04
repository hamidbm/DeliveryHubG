import React from 'react';

type BundleRow = { id: string; name: string };

type CapacityRow = {
  bundleId: string;
  unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK';
  value: number;
};

const DEFAULT_CAPACITY: CapacityRow = {
  bundleId: '',
  unit: 'POINTS_PER_WEEK',
  value: 0
};

const AdminBundleCapacity: React.FC = () => {
  const [bundles, setBundles] = React.useState<BundleRow[]>([]);
  const [capacityMap, setCapacityMap] = React.useState<Record<string, CapacityRow>>({});
  const [initialMap, setInitialMap] = React.useState<Record<string, CapacityRow>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/admin/bundle-capacity');
    if (!res.ok) {
      setMessage('Failed to load bundle capacity.');
      setLoading(false);
      return;
    }
    const data = await res.json();
    const bundleList = (data?.bundles || []) as BundleRow[];
    const capacities = (data?.capacities || []) as CapacityRow[];
    const map: Record<string, CapacityRow> = {};
    capacities.forEach((c) => {
      map[String(c.bundleId)] = {
        bundleId: String(c.bundleId),
        unit: c.unit === 'POINTS_PER_SPRINT' ? 'POINTS_PER_SPRINT' : 'POINTS_PER_WEEK',
        value: typeof c.value === 'number' ? c.value : 0
      };
    });
    const merged: Record<string, CapacityRow> = {};
    bundleList.forEach((b) => {
      merged[b.id] = map[b.id] || { ...DEFAULT_CAPACITY, bundleId: b.id };
    });
    setBundles(bundleList);
    setCapacityMap(merged);
    setInitialMap(JSON.parse(JSON.stringify(merged)));
    setLoading(false);
  };

  React.useEffect(() => {
    load();
  }, []);

  const updateRow = (bundleId: string, updates: Partial<CapacityRow>) => {
    setCapacityMap((prev) => ({
      ...prev,
      [bundleId]: { ...(prev[bundleId] || { ...DEFAULT_CAPACITY, bundleId }), ...updates }
    }));
  };

  const hasChanges = (bundleId: string) => {
    const current = capacityMap[bundleId];
    const initial = initialMap[bundleId];
    if (!current || !initial) return false;
    return current.unit !== initial.unit || Number(current.value) !== Number(initial.value);
  };

  const saveRow = async (bundleId: string) => {
    const row = capacityMap[bundleId];
    if (!row) return;
    setSaving(bundleId);
    setMessage(null);
    const res = await fetch('/api/admin/bundle-capacity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bundleId,
        unit: row.unit,
        value: Number(row.value) || 0
      })
    });
    if (!res.ok) {
      setMessage('Failed to save capacity.');
      setSaving(null);
      return;
    }
    setInitialMap((prev) => ({
      ...prev,
      [bundleId]: { ...row, value: Number(row.value) || 0 }
    }));
    setSaving(null);
    setMessage('Capacity updated.');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-10 py-8 border-b border-slate-100 bg-white sticky top-0 z-20 shadow-sm">
        <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Operations</div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">Bundle Capacity</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-3xl">
          Configure story point capacity per bundle. Used by Program Capacity planning to flag overcommit risk.
        </p>
      </header>

      <div className="p-10">
        {message && (
          <div className="mb-6 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Loading bundle capacity...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                  <th className="text-left py-3">Bundle</th>
                  <th className="text-left py-3">Unit</th>
                  <th className="text-left py-3">Capacity</th>
                  <th className="text-left py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((bundle) => {
                  const row = capacityMap[bundle.id] || { ...DEFAULT_CAPACITY, bundleId: bundle.id };
                  return (
                    <tr key={bundle.id} className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-slate-800">{bundle.name}</td>
                      <td className="py-3">
                        <select
                          className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                          value={row.unit}
                          onChange={(e) => updateRow(bundle.id, { unit: e.target.value as CapacityRow['unit'] })}
                        >
                          <option value="POINTS_PER_WEEK">Points / Week</option>
                          <option value="POINTS_PER_SPRINT">Points / Sprint</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <input
                          type="number"
                          min={0}
                          className="w-28 px-3 py-2 text-xs rounded-lg border border-slate-200"
                          value={row.value}
                          onChange={(e) => updateRow(bundle.id, { value: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => saveRow(bundle.id)}
                          disabled={!hasChanges(bundle.id) || saving === bundle.id}
                          className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${
                            hasChanges(bundle.id) ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {saving === bundle.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {bundles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-sm">No bundles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBundleCapacity;
