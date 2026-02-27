import React from 'react';

interface SampleCollection {
  name: string;
  count: number | null;
}

const AdminSamples: React.FC = () => {
  const [collections, setCollections] = React.useState<SampleCollection[]>([]);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [importing, setImporting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, any> | null>(null);

  const fetchCollections = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/samples');
      const data = await res.json();
      const list = Array.isArray(data?.collections) ? data.collections : [];
      setCollections(list);
      const defaults: Record<string, boolean> = {};
      list.forEach((c: SampleCollection) => { defaults[c.name] = true; });
      setSelected(defaults);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCollections();
  }, []);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    collections.forEach((c) => { next[c.name] = value; });
    setSelected(next);
  };

  const handleImport = async (all: boolean) => {
    setImporting(true);
    setMessage(null);
    setResults(null);
    try {
      const body = all ? {} : { collections: Object.keys(selected).filter((k) => selected[k]) };
      const res = await fetch('/api/admin/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || 'Import failed');
        return;
      }
      setResults(data?.results || null);
      setMessage('Sample data import completed.');
    } catch (error: any) {
      setMessage(error?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-vial text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Samples</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Seed Sample Data</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Import curated seed collections into the database (idempotent).</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-8">
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white shadow-lg hover:bg-slate-800 disabled:opacity-50"
            onClick={() => handleImport(true)}
            disabled={importing || loading || !collections.length}
          >
            {importing ? 'Importing...' : 'Import All'}
          </button>
          <button
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => handleImport(false)}
            disabled={importing || loading || !collections.length}
          >
            Import Selected
          </button>
          <button
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            onClick={fetchCollections}
            disabled={importing}
          >
            Refresh
          </button>
        </div>

        <div className="bg-slate-50/60 border border-slate-100 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Collections</h4>
            <div className="flex items-center gap-2">
              <button
                className="text-[10px] font-black uppercase tracking-widest text-blue-600"
                onClick={() => toggleAll(true)}
                disabled={loading || !collections.length}
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                className="text-[10px] font-black uppercase tracking-widest text-slate-500"
                onClick={() => toggleAll(false)}
                disabled={loading || !collections.length}
              >
                Clear
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-slate-400 font-medium">Loading sample manifest…</div>
          ) : collections.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {collections.map((c) => (
                <label key={c.name} className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[c.name])}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [c.name]: e.target.checked }))}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      {c.count === null ? 'Unknown' : `${c.count} docs`}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 font-medium">No seed collections found. Run `npm run seed:export` first.</div>
          )}
        </div>

        {message && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600 font-medium">
            {message}
          </div>
        )}

        {results && (
          <div className="bg-slate-900 text-white rounded-2xl p-6 text-xs font-mono overflow-x-auto">
            <pre>{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSamples;
