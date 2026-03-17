import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';
import { Bundle } from '../types';

type ReviewListItem = {
  reviewId: string;
  resource: { type: string; id: string; title?: string; bundleId?: string };
  currentCycle: { number: number; status: string; dueAt?: string; requestedAt?: string } | null;
  reviewersPreview: Array<{ displayName: string; userId: string }>;
  cycleCount: number;
  updatedAt?: string;
};

interface ReviewsDashboardProps {
  bundles: Bundle[];
}

const ReviewsDashboard: React.FC<ReviewsDashboardProps> = ({ bundles }) => {
  const router = useRouter();
  const [items, setItems] = useState<ReviewListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bundleFilter, setBundleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [requestedByMe, setRequestedByMe] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'updatedAt' | 'dueAt' | 'requestedAt'>('updatedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [hasStickyShadow] = useState(true);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (bundleFilter !== 'all') params.set('bundleId', bundleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (assignedToMe) params.set('assignedToMe', 'true');
    if (requestedByMe) params.set('requestedByMe', 'true');
    if (overdueOnly) params.set('overdue', 'true');
    if (search.trim()) params.set('q', search.trim());
    params.set('sort', sort);
    params.set('dir', dir);
    params.set('page', '1');
    params.set('pageSize', '100');
    return params.toString();
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?${buildQuery()}`);
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [bundleFilter, statusFilter, assignedToMe, requestedByMe, overdueOnly, search, sort, dir]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') as 'table' | 'cards' | null;
    if (view === 'table' || view === 'cards') {
      setViewMode(view);
      return;
    }
    const stored = window.localStorage.getItem('reviewsViewMode');
    if (stored === 'table' || stored === 'cards') {
      setViewMode(stored);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', viewMode);
    router.push(`/activities/reviews?${params.toString()}`);
    window.localStorage.setItem('reviewsViewMode', viewMode);
  }, [viewMode]);


  const bundleOptions = useMemo(() => bundles || [], [bundles]);

  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '—');
  const getAvatarUrl = (name?: string) => {
    if (!name) return 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
  };
  const getStatusPill = (status?: string) => {
    const base = 'px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
    switch (status) {
      case 'requested':
        return `${base} bg-slate-100 text-slate-600`;
      case 'in_review':
        return `${base} bg-blue-100 text-blue-700`;
      case 'feedback_sent':
        return `${base} bg-purple-100 text-purple-700`;
      case 'vendor_addressing':
        return `${base} bg-orange-100 text-orange-700`;
      case 'closed':
        return `${base} bg-emerald-100 text-emerald-700`;
      default:
        return `${base} bg-slate-100 text-slate-500`;
    }
  };
  const getHealthBadge = (status?: string, dueAt?: string) => {
    if (!dueAt) return null;
    const dueTime = new Date(dueAt).getTime();
    const now = Date.now();
    if (Number.isNaN(dueTime)) return null;
    if (dueTime < now) {
      return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
    }
    if (status === 'vendor_addressing') {
      return { label: 'Waiting on vendor', className: 'bg-slate-100 text-slate-600' };
    }
    if (dueTime - now <= 1000 * 60 * 60 * 48) {
      return { label: 'Due soon', className: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'On track', className: 'bg-emerald-100 text-emerald-700' };
  };

  return (
    <div className="p-12 w-full animate-fadeIn">
      <div className={`sticky top-14 z-30 bg-[#F8FAFC] ${hasStickyShadow ? 'shadow-md' : 'shadow-none'}`}>
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between gap-4 flex-nowrap">
            <div className="min-w-0">
              <div className="text-3xl font-black text-slate-900 tracking-tighter whitespace-nowrap">Reviews</div>
              <div className="text-slate-500 font-medium text-sm truncate">Review cycles across bundles and resources.</div>
            </div>
            <div className="flex items-center gap-2 flex-nowrap">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 bg-white">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                    viewMode === 'cards' ? 'bg-slate-900 text-white' : 'text-slate-500'
                  }`}
                >
                  Cards
                </button>
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white">
                <option value="updatedAt">Updated</option>
                <option value="dueAt">Due</option>
                <option value="requestedAt">Requested</option>
              </select>
              <select value={dir} onChange={(e) => setDir(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <select
              value={bundleFilter}
              onChange={(e) => setBundleFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold min-w-[160px] bg-white"
            >
              <option value="all">All bundles</option>
              {bundleOptions.map((b) => (
                <option key={String(b._id || b.id)} value={String(b._id || b.id)}>{b.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white">
              <option value="all">All statuses</option>
              <option value="requested">Requested</option>
              <option value="in_review">In Review</option>
              <option value="feedback_sent">Feedback Sent</option>
              <option value="vendor_addressing">Vendor Addressing</option>
              <option value="closed">Closed</option>
            </select>
            <button
              onClick={() => setAssignedToMe((prev) => !prev)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition ${
                assignedToMe ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              Assigned to me
            </button>
            <button
              onClick={() => setRequestedByMe((prev) => !prev)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition ${
                requestedByMe ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              Requested by me
            </button>
            <button
              onClick={() => setOverdueOnly((prev) => !prev)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition ${
                overdueOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              Overdue only
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by resource title"
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold min-w-[200px] flex-1 bg-white"
            />
          </div>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-8 gap-3 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border-b border-slate-200">
          <div className="col-span-2">Resource</div>
          <div>Bundle</div>
          <div>Status</div>
          <div>Cycle #</div>
          <div>Requested</div>
          <div>Due</div>
          <div>Reviewers</div>
        </div>
        {loading && <div className="p-5 text-sm text-slate-400">Loading reviews...</div>}
        {!loading && items.length === 0 && <div className="p-5 text-sm text-slate-400">No reviews found.</div>}
        {!loading && items.map((item) => {
          const dueDate = item.currentCycle?.dueAt;
          const health = getHealthBadge(item.currentCycle?.status, dueDate);
          return (
            <button
              key={item.reviewId}
              onClick={() => router.push(`/activities/reviews/${encodeURIComponent(item.reviewId)}`)}
              className="w-full text-left grid grid-cols-8 gap-3 px-5 py-4 text-sm border-b border-slate-100 hover:bg-slate-50 transition"
            >
              <div className="col-span-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">{item.resource?.type}</div>
                <div className="text-sm font-semibold text-slate-800">{item.resource?.title || item.resource?.id}</div>
              </div>
              <div className="text-sm text-slate-600">
                {bundleOptions.find((b) => String(b._id || b.id) === item.resource?.bundleId)?.name || '—'}
              </div>
              <div>
                <span className={getStatusPill(item.currentCycle?.status)}>
                  {item.currentCycle?.status?.replace(/_/g, ' ') || '—'}
                </span>
              </div>
              <div className="text-sm text-slate-600">#{item.currentCycle?.number ?? '—'}</div>
              <div className="text-sm text-slate-600">{formatDate(item.currentCycle?.requestedAt)}</div>
              <div className="text-sm text-slate-600">
                {formatDate(dueDate)}
                {health && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${health.className}`}>
                    {health.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.reviewersPreview.map((r) => (
                  <span key={r.userId} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                    {r.displayName}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
        </div>
      )}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading && <div className="text-sm text-slate-400">Loading reviews...</div>}
          {!loading && items.length === 0 && <div className="text-sm text-slate-400">No reviews found.</div>}
          {!loading && items.map((item) => {
            const dueDate = item.currentCycle?.dueAt;
            const health = getHealthBadge(item.currentCycle?.status, dueDate);
            const reviewerNames = item.reviewersPreview.map((r) => r.displayName);
            return (
              <button
                key={item.reviewId}
                onClick={() => router.push(`/activities/reviews/${encodeURIComponent(item.reviewId)}`)}
                className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400">{item.resource?.type}</div>
                    <div className="text-lg font-semibold text-slate-900">{item.resource?.title || item.resource?.id}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {bundleOptions.find((b) => String(b._id || b.id) === item.resource?.bundleId)?.name || '—'}
                    </div>
                  </div>
                  <div className={getStatusPill(item.currentCycle?.status)}>
                    {item.currentCycle?.status?.replace(/_/g, ' ') || '—'}
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-600">
                  Cycle #{item.currentCycle?.number ?? '—'}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Requested {formatDate(item.currentCycle?.requestedAt)} · Due {formatDate(dueDate)}
                </div>
                {health && (
                  <div className={`mt-2 inline-flex px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${health.className}`}>
                    {health.label}
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2">
                  {reviewerNames.map((name, idx) => (
                    <img key={`${name}-${idx}`} src={getAvatarUrl(name)} alt={name} className="w-6 h-6 rounded-full border border-slate-200" />
                  ))}
                  {reviewerNames.length === 0 && <span className="text-xs text-slate-400">No reviewers</span>}
                </div>
                <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Updated {formatDate(item.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewsDashboard;
