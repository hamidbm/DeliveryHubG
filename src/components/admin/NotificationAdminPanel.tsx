import React from 'react';

type AiNotificationRow = {
  _id: string;
  userId: string;
  watcherId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  deliveryMode?: 'immediate' | 'digest';
  delivery?: {
    in_app?: { status?: string; deliveredAt?: string };
    email?: { status?: string; lastAttemptedAt?: string; lastErrorMessage?: string; attempts?: number; nextRetryAt?: string };
    slack?: { status?: string; lastAttemptedAt?: string; lastErrorMessage?: string; attempts?: number; nextRetryAt?: string };
    teams?: { status?: string; lastAttemptedAt?: string; lastErrorMessage?: string; attempts?: number; nextRetryAt?: string };
  };
};

const ranges = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: 'All', value: 'all' }
];

const channels = [
  { label: 'All Channels', value: '' },
  { label: 'In-App', value: 'in_app' },
  { label: 'Email', value: 'email' },
  { label: 'Slack', value: 'slack' },
  { label: 'Teams', value: 'teams' }
];

const statuses = [
  { label: 'All Statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Sent', value: 'sent' },
  { label: 'Failed', value: 'failed' },
  { label: 'Suppressed', value: 'suppressed' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' }
];

const badgeStyle = (status?: string) => {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'suppressed') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'pending') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

const lastAttemptOf = (row: AiNotificationRow) => {
  const values = [
    row.delivery?.email?.lastAttemptedAt,
    row.delivery?.slack?.lastAttemptedAt,
    row.delivery?.teams?.lastAttemptedAt,
    row.createdAt
  ].filter(Boolean) as string[];
  return values.sort().reverse()[0] || row.createdAt;
};

const NotificationAdminPanel: React.FC = () => {
  const [items, setItems] = React.useState<AiNotificationRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [user, setUser] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [channel, setChannel] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [range, setRange] = React.useState('7d');
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});

  const selectedIds = React.useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('source', 'ai');
      params.set('limit', '100');
      if (user.trim()) params.set('user', user.trim());
      if (search.trim()) params.set('search', search.trim());
      if (channel) params.set('channel', channel);
      if (status) params.set('status', status);
      if (range) params.set('range', range);

      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load notifications');
        setItems([]);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, search, channel, status, range]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const callAction = async (id: string, action: 'retry' | 'force') => {
    const suffix = action === 'retry' ? 'retry' : 'force-deliver';
    const res = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}/${suffix}`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to ${action}`);
    }
  };

  const retryOne = async (id: string) => {
    try {
      await callAction(id, 'retry');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Retry failed');
    }
  };

  const forceOne = async (id: string) => {
    try {
      await callAction(id, 'force');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Force delivery failed');
    }
  };

  const bulkRetry = async () => {
    if (!selectedIds.length) return;
    try {
      for (const id of selectedIds) {
        await callAction(id, 'retry');
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'Bulk retry failed');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-signal"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Operations</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Notification Operations</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Governance, delivery status, retries, and force-deliver controls for AI notifications.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="User ID"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 min-w-[200px]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title/message"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 min-w-[220px]"
          />
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
            {channels.map((opt) => <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
            {statuses.map((opt) => <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={range} onChange={(e) => setRange(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
            {ranges.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <button onClick={() => void load()} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
            Refresh
          </button>
          <button
            onClick={() => void bulkRetry()}
            disabled={!selectedIds.length}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            Bulk Retry ({selectedIds.length})
          </button>
        </div>

        {error && <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="text-left px-4 py-3"><input type="checkbox" onChange={(e) => {
                  const checked = e.target.checked;
                  const next: Record<string, boolean> = {};
                  items.forEach((item) => { next[String(item._id)] = checked; });
                  setSelected(next);
                }} /></th>
                <th className="text-left px-4 py-3">Notification</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Watcher</th>
                <th className="text-left px-4 py-3">Channels</th>
                <th className="text-left px-4 py-3">Last Attempt</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading notifications...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No notifications found.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={String(item._id)} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[String(item._id)])}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [String(item._id)]: e.target.checked }))}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-semibold">{item.title || 'Untitled'}</div>
                      <div className="text-xs text-slate-500 max-w-[260px] break-words">{item.message || 'No message'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.userId || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.watcherId || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        <span title={item.delivery?.email?.lastErrorMessage} className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${badgeStyle(item.delivery?.email?.status)}`}>Email:{item.delivery?.email?.status || 'n/a'}</span>
                        <span title={item.delivery?.slack?.lastErrorMessage} className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${badgeStyle(item.delivery?.slack?.status)}`}>Slack:{item.delivery?.slack?.status || 'n/a'}</span>
                        <span title={item.delivery?.teams?.lastErrorMessage} className={`text-[10px] font-bold uppercase border rounded-full px-2 py-0.5 ${badgeStyle(item.delivery?.teams?.status)}`}>Teams:{item.delivery?.teams?.status || 'n/a'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{lastAttemptOf(item) ? new Date(lastAttemptOf(item)).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => void retryOne(String(item._id))} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50">Retry</button>
                        <button onClick={() => void forceOne(String(item._id))} className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50">Force Send</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationAdminPanel;
