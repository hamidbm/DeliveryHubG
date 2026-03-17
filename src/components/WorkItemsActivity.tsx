import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';
import { EventRecord } from '../types';

const WorkItemsActivity: React.FC = () => {
  const router = useRouter();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/events?limit=300&markSeen=true&resourceType=workitems.item');
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

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
      return true;
    });
  }, [events, timeRange, typeFilter]);

  const typeOptions = Array.from(new Set(events.map((e) => e.type))).sort();

  const handleNavigate = (event: EventRecord) => {
    if (event.resource?.id) {
      router.push(`/?tab=work-items&view=tree&pageId=${encodeURIComponent(event.resource.id)}`);
    }
  };

  const formatFieldChange = (event: EventRecord) => {
    const field = event.payload?.field;
    if (!field) return null;
    const from = event.payload?.from;
    const to = event.payload?.to;
    const display = (val: any) => {
      if (val === null || val === undefined || val === '') return '—';
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };
    return (
      <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {field}: <span className="text-slate-500">{display(from)}</span> → <span className="text-slate-700">{display(to)}</span>
      </div>
    );
  };

  return (
    <div className="p-12 w-full animate-fadeIn">
      <div className="sticky top-14 z-20 bg-[#F8FAFC] pb-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
          <div className="text-sm font-semibold text-slate-800 mr-2">Work Items Activity</div>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-400">Loading events...</div>}
        {!loading && filteredEvents.length === 0 && (
          <div className="text-sm text-slate-400">No work item activity in this range.</div>
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
                  {event.actor?.displayName || 'User'} → {event.resource?.title || 'Work Item'}
                </div>
                {formatFieldChange(event)}
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

export default WorkItemsActivity;
