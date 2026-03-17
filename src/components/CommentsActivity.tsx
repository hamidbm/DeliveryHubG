import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';

type InboxThread = {
  _id: string;
  resource: { type: string; id: string; title?: string };
  status: 'open' | 'resolved';
  lastActivityAt: string;
  messageCount: number;
  participants: string[];
  createdBy?: { displayName?: string };
  lastMessage?: { body?: string; createdAt?: string; author?: { displayName?: string } };
};

const buildResourceLink = (thread: InboxThread) => {
  const resourceId = thread.resource?.id;
  if (!resourceId) return null;
  const threadId = String(thread._id);
  if (thread.resource.type === 'architecture_diagram') {
    return `/architecture/diagram/${encodeURIComponent(resourceId)}?threadId=${encodeURIComponent(threadId)}`;
  }
  if (thread.resource.type === 'wiki.page' || thread.resource.type === 'wiki.asset') {
    return `/wiki/${encodeURIComponent(resourceId)}?threadId=${encodeURIComponent(threadId)}`;
  }
  if (thread.resource.type === 'workitems.item') {
    return `/work-items/${encodeURIComponent(resourceId)}?threadId=${encodeURIComponent(threadId)}`;
  }
  return null;
};

const CommentsActivity: React.FC = () => {
  const router = useRouter();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'mentions' | 'open' | 'participating'>('open');
  const [resourceType, setResourceType] = useState('all');
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('open');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (scope === 'open' && status === 'all') {
      setStatus('open');
    }
    if (scope === 'mentions') {
      setMentionsOnly(true);
    }
  }, [scope]);

  useEffect(() => {
    const fetchThreads = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '300');
        params.set('scope', scope);
        if (resourceType !== 'all') params.set('resourceType', resourceType);
        if (status !== 'all') params.set('status', status);
        if (mentionsOnly && scope !== 'mentions') params.set('mentionsOnly', 'true');
        if (search.trim()) params.set('search', search.trim());
        if (timeRange !== 'all') {
          const now = Date.now();
          const cutoff =
            timeRange === '24h' ? now - 1000 * 60 * 60 * 24 :
            timeRange === '7d' ? now - 1000 * 60 * 60 * 24 * 7 :
            now - 1000 * 60 * 60 * 24 * 30;
          params.set('since', new Date(cutoff).toISOString());
        }
        const res = await fetch(`/api/comment-threads/inbox?${params.toString()}`);
        const data = await res.json();
        setThreads(Array.isArray(data.threads) ? data.threads : []);
      } catch {
        setThreads([]);
      } finally {
        setLoading(false);
      }
    };
    fetchThreads();
  }, [scope, resourceType, status, timeRange, mentionsOnly, search]);

  const resourceOptions = useMemo(() => {
    const types = Array.from(new Set(threads.map((t) => t.resource?.type).filter(Boolean) as string[]));
    return types.sort();
  }, [threads]);

  const handleNavigate = (thread: InboxThread) => {
    const link = buildResourceLink(thread);
    if (link) router.push(link);
  };

  const renderSnippet = (thread: InboxThread) => {
    const body = thread.lastMessage?.body || '';
    if (!body) return 'No messages yet.';
    const trimmed = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    return trimmed;
  };

  return (
    <div className="p-12 w-full animate-fadeIn">
      <div className="sticky top-14 z-20 bg-[#F8FAFC] pb-4 space-y-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'mentions', label: 'Mentions' },
            { id: 'open', label: 'Open' },
            { id: 'participating', label: 'Participating' }
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setScope(pill.id as any)}
              className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-full border transition-all ${
                scope === pill.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="text-sm font-semibold text-slate-800 mr-2">Comments</div>
          <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All resources</option>
            {resourceOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <button
            onClick={() => setMentionsOnly((prev) => !prev)}
            disabled={scope === 'mentions'}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
              (scope === 'mentions' || mentionsOnly) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
            } ${scope === 'mentions' ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            Mentions only
          </button>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-400">Loading threads...</div>}
        {!loading && threads.length === 0 && (
          <div className="text-sm text-slate-400">No comment threads found for this filter.</div>
        )}
        {threads.map((thread) => (
          <button
            key={thread._id}
            onClick={() => handleNavigate(thread)}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {thread.resource?.type || 'resource'} · {thread.status}
                </div>
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {thread.resource?.title || 'Untitled Resource'}
                </div>
                <div className="mt-2 text-xs text-slate-600 line-clamp-2">
                  {renderSnippet(thread)}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-slate-600">
                  {thread.lastMessage?.author?.displayName || thread.createdBy?.displayName || 'User'}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {new Date(thread.lastActivityAt).toLocaleString()}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CommentsActivity;
