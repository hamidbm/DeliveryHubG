
import React, { useState, useEffect, useRef } from 'react';

const AssigneeSearch = ({ currentAssignee, onSelect }: { currentAssignee?: string, onSelect: (name: string) => void }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group h-10"
      >
        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentAssignee || 'Unassigned')}&background=random`} className="w-6 h-6 rounded-full shrink-0" />
        <span className="text-xs font-bold text-slate-700 truncate">{currentAssignee || 'Unassigned'}</span>
        <i className="fas fa-search text-[10px] text-slate-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"></i>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-10">
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-xl border-2 border-blue-500 shadow-lg shadow-blue-500/10">
        <i className="fas fa-search text-[10px] text-blue-500 ml-2"></i>
        <input 
          autoFocus
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type name or email..."
          className="w-full text-xs font-bold text-slate-700 outline-none p-1"
        />
        {loading && <i className="fas fa-circle-notch fa-spin text-[10px] text-slate-300 mr-2"></i>}
      </div>

      {(query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-fadeIn">
          {results.length > 0 ? (
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {results.map((user) => (
                <button
                  key={user._id || user.id}
                  onClick={() => {
                    onSelect(user.name);
                    setIsSearching(false);
                    setQuery('');
                  }}
                  className="w-full text-left p-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                >
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-8 h-8 rounded-full" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : !loading && query.length >= 2 && (
            <div className="p-6 text-center text-slate-400 italic text-[10px]">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssigneeSearch;
