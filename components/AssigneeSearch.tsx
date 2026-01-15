
import React, { useState, useEffect, useRef } from 'react';

const AssigneeSearch = ({ currentAssignee, onSelect }: { currentAssignee?: string, onSelect: (name: string) => void }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Workforce Capacity Simulation - Maps to real DB aggregation in production
  const getWorkload = (name: string) => {
    const loads: Record<string, { pts: number, status: string }> = {
      'Alex Architect': { pts: 4, status: 'Healthy' },
      'Sarah PM': { pts: 14, status: 'Overloaded' },
      'Vendor Lead': { pts: 22, status: 'At Risk' },
      'John Doe': { pts: 7, status: 'Stable' },
      'Emma Watson': { pts: 2, status: 'Capacity' }
    };
    return loads[name] || { pts: 0, status: 'Unassigned' };
  };

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSearching(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isSearching) {
    return (
      <div 
        onClick={() => setIsSearching(true)}
        className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:shadow-xl hover:border-slate-200 transition-all group h-14"
      >
        <div className="relative">
          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentAssignee || 'Unassigned')}&background=random`} className="w-7 h-7 rounded-full shrink-0 shadow-sm" />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>
        </div>
        <span className="text-xs font-black text-slate-700 truncate">{currentAssignee || 'Assign Resource'}</span>
        <i className="fas fa-search text-[10px] text-slate-300 ml-auto group-hover:text-blue-500 transition-colors"></i>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-14">
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border-2 border-blue-500 shadow-xl shadow-blue-500/10">
        <i className="fas fa-user-plus text-[10px] text-blue-500 ml-3"></i>
        <input 
          autoFocus
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Lookup active personnel..."
          className="w-full text-xs font-black text-slate-700 outline-none p-2 placeholder:text-slate-300 bg-transparent"
        />
        {loading && <i className="fas fa-circle-notch fa-spin text-[10px] text-slate-300 mr-3"></i>}
      </div>

      {(query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 z-[150] overflow-hidden animate-fadeIn">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Resource Heat Map</span>
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Assigned Pts</span>
          </div>
          {results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
              {results.map((user) => {
                const load = getWorkload(user.name);
                const isCritical = load.pts > 12;
                return (
                  <button
                    key={user._id || user.id}
                    onClick={() => {
                      onSelect(user.name);
                      setIsSearching(false);
                      setQuery('');
                    }}
                    className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-4 transition-all rounded-2xl group border border-transparent hover:border-slate-100 mb-1"
                  >
                    <div className="relative shrink-0">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-10 h-10 rounded-full shadow-sm" />
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        isCritical ? 'bg-red-500 animate-pulse' : load.pts > 8 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-800 truncate leading-none mb-1">{user.name}</p>
                      <p className="text-[9px] font-bold text-slate-400 truncate uppercase tracking-widest">{user.role || 'Personnel'}</p>
                    </div>
                    <div className="text-right border-l border-slate-100 pl-4 min-w-[70px]">
                       <p className={`text-[11px] font-black uppercase tracking-tighter leading-none mb-1 ${
                         isCritical ? 'text-red-500' : 'text-slate-500'
                       }`}>{load.pts} PTS</p>
                       <p className={`text-[8px] font-bold uppercase tracking-widest ${isCritical ? 'text-red-400' : 'text-slate-300'}`}>{load.status}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !loading && query.length >= 2 && (
            <div className="p-12 text-center">
               <i className="fas fa-user-slash text-slate-100 text-4xl mb-4"></i>
               <p className="text-slate-300 italic text-[10px] uppercase tracking-widest font-black leading-relaxed">No matching resources found in active pool.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssigneeSearch;
