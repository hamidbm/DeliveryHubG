import React, { useEffect, useState } from 'react';

type GitHubPreviewItem = {
  repo: string;
  number: number;
  title: string;
  state: string;
  updatedAt: string;
  url: string;
  workItemKeys: string[];
};

const AdminGitHubIntegration: React.FC = () => {
  const [status, setStatus] = useState<{ ok: boolean; missing?: string[] } | null>(null);
  const [preview, setPreview] = useState<GitHubPreviewItem[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [repo, setRepo] = useState('');
  const [sinceDays, setSinceDays] = useState(14);
  const [limit, setLimit] = useState(50);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<any | null>(null);

  const loadStatus = async () => {
    const res = await fetch('/api/admin/integrations/github/preview?limit=1');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus({ ok: false, missing: data?.missing || [] });
      return;
    }
    setStatus({ ok: true });
  };

  const loadLastRun = async () => {
    const res = await fetch('/api/admin/events?type=integrations.github.sync.completed&limit=1');
    if (!res.ok) return;
    const data = await res.json();
    const item = Array.isArray(data?.items) ? data.items[0] : null;
    setLastRun(item || null);
  };

  useEffect(() => {
    loadStatus();
    loadLastRun();
  }, []);

  const handlePreview = async () => {
    setMessage(null);
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (sinceDays) params.set('sinceDays', String(sinceDays));
    if (limit) params.set('limit', String(limit));
    const res = await fetch(`/api/admin/integrations/github/preview?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || 'Failed to preview');
      return;
    }
    const data = await res.json();
    setPreview(Array.isArray(data?.items) ? data.items : []);
  };

  const handleSync = async () => {
    setMessage(null);
    setSummary(null);
    const res = await fetch('/api/admin/integrations/github/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: repo || undefined, sinceDays, limit, mode: 'UPSERT' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMessage(err.error || 'Failed to sync');
      return;
    }
    const data = await res.json();
    setSummary(data);
    loadLastRun();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-8 border-b border-slate-100 bg-white sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Admin • Integrations</span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">GitHub Sync</h3>
          </div>
        </div>
      </header>

      <div className="p-10 space-y-6">
        <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configuration</div>
              <div className="text-sm text-slate-600">One-way enrichment from GitHub pull requests.</div>
            </div>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
              status?.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {status?.ok ? 'Connected' : 'Missing Env'}
            </span>
          </div>
          {!status?.ok && (
            <div className="mt-3 text-[11px] text-rose-600">
              Missing: {(status?.missing || []).join(', ') || 'Unknown'}
            </div>
          )}
          {lastRun && (
            <div className="mt-4 text-[11px] text-slate-500">
              Last run: {new Date(lastRun.ts).toLocaleString()} • fetched {lastRun.payload?.fetched ?? 0}, linked {lastRun.payload?.linked ?? 0}, updated {lastRun.payload?.updated ?? 0}, skipped {lastRun.payload?.skipped ?? 0}
            </div>
          )}
        </div>

        <div className="border border-slate-100 rounded-2xl p-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Repo</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="owner/repo (optional)"
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Since Days</label>
              <input
                type="number"
                value={sinceDays}
                onChange={(e) => setSinceDays(Number(e.target.value || 0))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value || 0))}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                onClick={handlePreview}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Preview
              </button>
              <button
                onClick={handleSync}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700"
              >
                Run Sync
              </button>
            </div>
          </div>
          {message && <div className="mt-3 text-[11px] text-rose-600">{message}</div>}
          {summary && (
            <div className="mt-4 text-[11px] text-slate-600">
              Sync summary: fetched {summary.fetched}, linked {summary.linked}, updated {summary.updated}, skipped {summary.skipped}
            </div>
          )}
        </div>

        <div className="border border-slate-100 rounded-2xl p-6 bg-white">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Preview</div>
          {preview.length ? (
            <div className="space-y-3">
              {preview.map((item) => (
                <div key={`${item.repo}-${item.number}`} className="border border-slate-100 rounded-xl px-3 py-2 text-[11px] text-slate-600">
                  <div className="font-semibold text-slate-700">
                    {item.repo} • #{item.number} • {item.title}
                  </div>
                  <div className="text-slate-400">
                    {item.state} • {new Date(item.updatedAt).toLocaleString()} • keys: {item.workItemKeys.join(', ') || '—'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Run preview to see GitHub pull requests.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminGitHubIntegration;
