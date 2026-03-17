import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';
import type { FeedItem } from '../types';

type FeedScopeType = 'PROGRAM' | 'BUNDLE' | 'MILESTONE';

type ChangeFeedProps = {
  scopeType: FeedScopeType;
  scopeId?: string;
  title?: string;
  limit?: number;
  compact?: boolean;
  showFilters?: boolean;
  headerAction?: React.ReactNode;
};

const severityBadge = (severity: FeedItem['severity']) => {
  if (severity === 'critical') return 'bg-rose-50 text-rose-700';
  if (severity === 'warn') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

const ChangeFeed: React.FC<ChangeFeedProps> = ({
  scopeType,
  scopeId,
  title = 'Activity',
  limit = 20,
  compact = false,
  showFilters = true,
  headerAction
}) => {
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    governance: true,
    scope: true,
    dependency: true,
    integrations: false
  });

  const activeFilters = useMemo(() => {
    return Object.entries(filters)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .join(',');
  }, [filters]);

  const canFetch = scopeType === 'PROGRAM' || Boolean(scopeId);

  const fetchFeed = async (cursorOverride: string | null, append = false) => {
    if (!canFetch) return;
    if (!activeFilters) {
      setItems([]);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('scopeType', scopeType);
      if (scopeId) params.set('scopeId', scopeId);
      params.set('limit', String(limit));
      params.set('filters', activeFilters);
      if (cursorOverride) params.set('cursor', cursorOverride);
      const res = await fetch(`/api/feed?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load activity');
        setItems([]);
        setNextCursor(null);
        return;
      }
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
      setNextCursor(data?.nextCursor || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(null, false);
  }, [scopeType, scopeId, activeFilters, limit]);

  const handleLoadMore = () => {
    if (!nextCursor) return;
    fetchFeed(nextCursor, true);
  };

  const handleNavigate = (href: string) => {
    if (!href) return;
    router.push(href);
  };

  if (!canFetch) {
    return <div className="text-xs text-slate-400">Select a milestone to view activity.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</div>
          <div className="text-xs text-slate-500">Delivery-facing change feed</div>
        </div>
        {headerAction ? <div>{headerAction}</div> : null}
        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'governance', label: 'Governance' },
              { key: 'scope', label: 'Scope' },
              { key: 'dependency', label: 'Dependencies' },
              { key: 'integrations', label: 'Integrations' }
            ].map((filter) => (
              <label key={filter.key} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <input
                  type="checkbox"
                  checked={(filters as any)[filter.key]}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [filter.key]: e.target.checked }))}
                />
                {filter.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {loading && items.length === 0 && <div className="text-xs text-slate-400">Loading activity...</div>}
      {error && <div className="text-xs text-rose-600">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-xs text-slate-400">No recent activity.</div>
      )}

      <div className={`space-y-3 ${compact ? 'text-xs' : 'text-sm'}`}>
        {items.map((item) => (
          <div key={item.id} className="border border-slate-100 rounded-2xl p-3 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${severityBadge(item.severity)}`}>
                    {item.severity}
                  </span>
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {item.actor?.name || item.actor?.email || 'System'}
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800">{item.title}</div>
                <div className="text-[11px] text-slate-500">{item.summary}</div>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {new Date(item.occurredAt).toLocaleString()}
              </div>
            </div>
            {item.links?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.links.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => handleNavigate(link.href)}
                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {nextCursor && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="px-3 py-2 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
};

export default ChangeFeed;
