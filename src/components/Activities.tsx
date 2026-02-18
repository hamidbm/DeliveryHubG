import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../App';
import { EventRecord } from '../types';

const Activities: React.FC = () => {
  const router = useRouter();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [mentionsOnly, setMentionsOnly] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/events?limit=500&markSeen=true${mentionsOnly ? '&mentionsOnly=true' : ''}`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [mentionsOnly]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeRange === '24h' ? now - 1000 * 60 * 60 * 24 :
      timeRange === '7d' ? now - 1000 * 60 * 60 * 24 * 7 :
      timeRange === '30d' ? now - 1000 * 60 * 60 * 24 * 30 :
      0;

    return events.filter((e) => {
      const ts = new Date(e.ts).getTime();
      if (cutoff && ts < cutoff) return false;
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (resourceFilter !== 'all' && e.resource?.type !== resourceFilter) return false;
      if (actorFilter !== 'all' && e.actor?.userId !== actorFilter) return false;
      return true;
    });
  }, [events, timeRange, typeFilter, resourceFilter, actorFilter]);

  const typeOptions = Array.from(new Set(events.map((e) => e.type))).sort();
  const resourceOptions = Array.from(new Set(events.map((e) => e.resource?.type).filter(Boolean) as string[])).sort();
  const actorOptions = Array.from(new Set(events.map((e) => e.actor?.userId).filter(Boolean) as string[])).sort();

  const handleNavigate = (event: EventRecord) => {
    if (event.resource?.type?.startsWith('wiki.') && event.resource?.id) {
      router.push(`/?tab=wiki&pageId=${encodeURIComponent(event.resource.id)}`);
    }
  };

  return (
    <div className="p-12 max-w-6xl mx-auto animate-fadeIn">
      <header className="mb-10">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Activities</h2>
        <p className="text-slate-500 font-medium mt-2">Chronological feed of system events.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8 flex flex-wrap gap-3 items-center">
        <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <button
          onClick={() => setMentionsOnly((prev) => !prev)}
          className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
            mentionsOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          Mentions me
        </button>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
          <option value="all">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
          <option value="all">All resources</option>
          {resourceOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
          <option value="all">All actors</option>
          {actorOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-400">Loading events...</div>}
        {!loading && filteredEvents.length === 0 && (
          <div className="text-sm text-slate-400">No events found for this filter.</div>
        )}
        {filteredEvents.map((event) => (
          <button
            key={String(event._id)}
            onClick={() => handleNavigate(event)}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 hover:bg-slate-50 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">{event.type}</div>
                <div className="text-sm font-semibold text-slate-800">
                  {event.actor?.displayName || 'User'} → {event.resource?.title || event.resource?.type}
                </div>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {new Date(event.ts).toLocaleString()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Activities;
