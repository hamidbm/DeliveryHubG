import React from 'react';

const typePrefixes = [
  { label: 'All', value: '' },
  { label: 'Milestones', value: 'milestones' },
  { label: 'Perf', value: 'perf' },
  { label: 'Security', value: 'security' },
  { label: 'Dependency', value: 'dependency' },
  { label: 'Reviews', value: 'reviews' },
  { label: 'Work Items', value: 'workitems' },
  { label: 'Architecture', value: 'architecture' },
  { label: 'Wiki', value: 'wiki' },
  { label: 'Comments', value: 'comments' }
];

const ranges = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
  { label: 'All time', value: 'all' }
];

const formatActor = (actor: any) => {
  if (!actor) return '—';
  return actor.displayName || actor.name || actor.email || actor.userId || '—';
};

const formatResource = (resource: any) => {
  if (!resource) return '—';
  const title = resource.title || resource.id || '—';
  return `${resource.type || 'resource'} • ${title}`;
};

const formatContext = (context: any) => {
  if (!context) return '—';
  const parts = [] as string[];
  if (context.bundleId) parts.push(`bundle:${context.bundleId}`);
  if (context.appId) parts.push(`app:${context.appId}`);
  if (context.milestoneId) parts.push(`ms:${context.milestoneId}`);
  if (context.documentTypeId || context.docType) parts.push(`doc:${context.documentTypeId || context.docType}`);
  return parts.length ? parts.join(' | ') : '—';
};

const resolveDeepLink = (event: any) => {
  const resource = event?.resource || {};
  const type = String(resource.type || '');
  const id = String(resource.id || '');
  if (!id) return null;
  if (type === 'diagram' || type.includes('diagram')) return `/architecture/diagram/${encodeURIComponent(id)}`;
  if (type.startsWith('workitems')) return `/work-items/${encodeURIComponent(id)}`;
  if (type.startsWith('milestones')) return `/?tab=work-items&view=milestone-plan&milestoneId=${encodeURIComponent(id)}`;
  return null;
};

interface AdminAuditEventsProps {
  initialTypePrefix?: string;
  initialRange?: string;
  initialSearch?: string;
}

const AdminAuditEvents: React.FC<AdminAuditEventsProps> = ({ initialTypePrefix, initialRange, initialSearch }) => {
  const [typePrefix, setTypePrefix] = React.useState(initialTypePrefix || '');
  const [range, setRange] = React.useState(initialRange || '7d');
  const [search, setSearch] = React.useState(initialSearch || '');
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [cursorStack, setCursorStack] = React.useState<string[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const fetchEvents = async (cursorOverride: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (typePrefix) params.set('typePrefix', typePrefix);
      if (range) params.set('range', range);
      if (search.trim()) params.set('search', search.trim());
      if (cursorOverride) params.set('cursor', cursorOverride);
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load events');
        setItems([]);
        setNextCursor(null);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setCursor(null);
    setCursorStack([]);
    fetchEvents(null);
  }, [typePrefix, range, search]);

  React.useEffect(() => {
    if (initialTypePrefix !== undefined) setTypePrefix(initialTypePrefix);
  }, [initialTypePrefix]);

  React.useEffect(() => {
    if (initialRange !== undefined) setRange(initialRange);
  }, [initialRange]);

  React.useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
  }, [initialSearch]);

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchEvents(nextCursor);
  };

  const handlePrev = () => {
    if (!cursorStack.length) return;
    const nextStack = [...cursorStack];
    const prevCursor = nextStack.pop() || null;
    setCursorStack(nextStack);
    setCursor(prevCursor);
    fetchEvents(prevCursor);
  };

  const openDetail = async (event: any) => {
    const id = String(event?._id || '');
    if (!id) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/events?id=${encodeURIComponent(id)}&includePayload=true`);
      const data = await res.json();
      if (res.ok) {
        setSelected(data?.item || event);
      } else {
        setSelected(event);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-satellite-dish text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Audit</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Events Console</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Trace governance, performance, and security signals across modules.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={typePrefix}
            onChange={(e) => setTypePrefix(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
          >
            {typePrefixes.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
          >
            {ranges.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, type, resource id"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 min-w-[260px]"
          />
          <button
            onClick={() => fetchEvents(cursor)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Resource</th>
                <th className="text-left px-4 py-3">Context</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading events…</td></tr>
              ) : items.length ? (
                items.map((event) => (
                  <tr
                    key={String(event._id)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDetail(event)}
                  >
                    <td className="px-4 py-3 text-slate-500">{event.ts ? new Date(event.ts).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">{event.type}</td>
                    <td className="px-4 py-3 text-slate-600">{formatActor(event.actor)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatResource(event.resource)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatContext(event.context)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No events found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <button
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            onClick={handlePrev}
            disabled={!cursorStack.length}
          >
            Previous
          </button>
          <div>{items.length ? `${items.length} events` : '—'}</div>
          <button
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            onClick={handleNext}
            disabled={!nextCursor}
          >
            Next
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-6 p-8 relative">
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full border border-slate-200 text-slate-400 hover:text-slate-700"
              onClick={() => setSelected(null)}
            >
              <i className="fas fa-times"></i>
            </button>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Event Detail</div>
                <div className="text-xl font-black text-slate-900">{selected.type}</div>
                <div className="text-sm text-slate-500">{selected.ts ? new Date(selected.ts).toLocaleString() : '—'}</div>
              </div>
              {resolveDeepLink(selected) && (
                <a
                  href={resolveDeepLink(selected) as string}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Open Resource
                </a>
              )}
            </div>
            {detailLoading ? (
              <div className="text-sm text-slate-400">Loading payload…</div>
            ) : (
              <pre className="bg-slate-900 text-emerald-100 rounded-2xl p-4 text-xs overflow-auto max-h-[60vh]">{JSON.stringify(selected, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditEvents;
