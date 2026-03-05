import React from 'react';

const ranges = [
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
  { label: 'All time', value: 'all' }
];

interface AdminAuditNotificationsProps {
  initialType?: string;
  initialRange?: string;
}

const AdminAuditNotifications: React.FC<AdminAuditNotificationsProps> = ({ initialType, initialRange }) => {
  const [recipient, setRecipient] = React.useState('');
  const [type, setType] = React.useState(initialType || '');
  const [range, setRange] = React.useState(initialRange || '7d');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [cursorStack, setCursorStack] = React.useState<string[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const fetchNotifications = async (cursorOverride: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (recipient.trim()) params.set('recipient', recipient.trim());
      if (type.trim()) params.set('type', type.trim());
      if (range) params.set('range', range);
      if (unreadOnly) params.set('unreadOnly', 'true');
      if (cursorOverride) params.set('cursor', cursorOverride);
      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load notifications');
        setItems([]);
        setNextCursor(null);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setNextCursor(data?.nextCursor || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setCursor(null);
    setCursorStack([]);
    fetchNotifications(null);
  }, [recipient, type, range, unreadOnly]);

  React.useEffect(() => {
    if (initialType !== undefined) setType(initialType);
  }, [initialType]);

  React.useEffect(() => {
    if (initialRange !== undefined) setRange(initialRange);
  }, [initialRange]);

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorStack((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchNotifications(nextCursor);
  };

  const handlePrev = () => {
    if (!cursorStack.length) return;
    const nextStack = [...cursorStack];
    const prevCursor = nextStack.pop() || null;
    setCursorStack(nextStack);
    setCursor(prevCursor);
    fetchNotifications(prevCursor);
  };

  const openDetail = async (notification: any) => {
    const id = String(notification?._id || '');
    if (!id) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?id=${encodeURIComponent(id)}&includePayload=true`);
      const data = await res.json();
      if (res.ok) {
        setSelected(data?.item || notification);
      } else {
        setSelected(notification);
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
            <i className="fas fa-bell text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Audit</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Notifications Console</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Inspect what was sent, to whom, and why.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient name or email"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 min-w-[220px]"
          />
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Type (optional)"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 min-w-[180px]"
          />
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
          >
            {ranges.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <button
            onClick={() => fetchNotifications(cursor)}
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
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading notifications…</td></tr>
              ) : items.length ? (
                items.map((notification) => (
                  <tr
                    key={String(notification._id)}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => openDetail(notification)}
                  >
                    <td className="px-4 py-3 text-slate-500">{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{notification.recipient || '—'}</td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">{notification.type || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{notification.title || notification.message || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{notification.severity || 'info'}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {notification.read ? (
                        <span className="text-slate-400">Read</span>
                      ) : (
                        <span className="text-emerald-600">Unread</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No notifications found.</td></tr>
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
          <div>{items.length ? `${items.length} notifications` : '—'}</div>
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
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Notification Detail</div>
                <div className="text-xl font-black text-slate-900">{selected.type || 'Notification'}</div>
                <div className="text-sm text-slate-500">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</div>
              </div>
              {selected.link && (
                <a
                  href={selected.link}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Open Link
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

export default AdminAuditNotifications;
