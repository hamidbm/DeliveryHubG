import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';
import { Application, Bundle, EventRecord } from '../types';

interface ArchitectureActivityProps {
  bundles: Bundle[];
}

const ArchitectureActivity: React.FC<ArchitectureActivityProps> = ({ bundles }) => {
  const router = useRouter();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [bundleFilter, setBundleFilter] = useState('all');
  const [appFilter, setAppFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/applications').then(r => r.json()).then(data => setApplications(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '500');
        params.set('typePrefix', 'architecture.diagram.');
        if (bundleFilter !== 'all') params.set('bundleId', bundleFilter);
        if (appFilter !== 'all') params.set('appId', appFilter);
        if (search.trim()) params.set('search', search.trim());
        if (timeRange !== 'all') {
          const now = Date.now();
          const cutoff =
            timeRange === '24h' ? now - 1000 * 60 * 60 * 24 :
            timeRange === '7d' ? now - 1000 * 60 * 60 * 24 * 7 :
            now - 1000 * 60 * 60 * 24 * 30;
          params.set('since', new Date(cutoff).toISOString());
        }
        const res = await fetch(`/api/events?${params.toString()}`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [bundleFilter, appFilter, timeRange, search]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (eventTypeFilter !== 'all' && e.type !== eventTypeFilter) return false;
      return true;
    });
  }, [events, eventTypeFilter]);

  const typeOptions = Array.from(new Set(events.map((e) => e.type))).sort();

  const handleNavigate = (event: EventRecord) => {
    if (event.resource?.id) {
      router.push(`/?tab=architecture&diagramId=${encodeURIComponent(event.resource.id)}`);
    }
  };

  const resolveBundleName = (id?: string) => bundles.find((b) => String(b._id) === String(id))?.name || '—';
  const resolveAppName = (id?: string) => applications.find((a) => String(a._id || a.id) === String(id))?.name || '—';

  return (
    <div className="p-12 w-full animate-fadeIn">
      <div className="sticky top-14 z-20 bg-[#F8FAFC] pb-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="text-sm font-semibold text-slate-800 mr-2">Architecture Activity</div>
          <select value={bundleFilter} onChange={(e) => { setBundleFilter(e.target.value); setAppFilter('all'); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All bundles</option>
            {bundles.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
          <select value={appFilter} onChange={(e) => setAppFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All applications</option>
            {applications.filter((a) => bundleFilter === 'all' || a.bundleId === bundleFilter).map((a) => (
              <option key={a._id || a.id} value={a._id || a.id}>{a.name}</option>
            ))}
          </select>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-400">Loading events...</div>}
        {!loading && filteredEvents.length === 0 && (
          <div className="text-sm text-slate-400">No architecture changes found for this filter.</div>
        )}
        {filteredEvents.map((event) => (
          <button
            key={String(event._id)}
            onClick={() => handleNavigate(event)}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">{event.type}</div>
                <div className="text-sm font-semibold text-slate-800 truncate">
                  {event.resource?.title || 'Diagram'}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {resolveBundleName(event.context?.bundleId)} · {resolveAppName(event.context?.appId)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-600">{event.actor?.displayName || 'User'}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {new Date(event.ts).toLocaleString()}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ArchitectureActivity;
