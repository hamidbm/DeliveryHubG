
import React, { useState, useEffect } from 'react';
import { WikiVersion, WikiPage } from '../types';
import WikiPageDisplay from './WikiPageDisplay';

interface WikiHistoryProps {
  page: WikiPage;
  onClose: () => void;
  onRevert: (versionId: string) => void;
}

const WikiHistory: React.FC<WikiHistoryProps> = ({ page, onClose, onRevert }) => {
  const [history, setHistory] = useState<WikiVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<WikiVersion | null>(null);
  const [comparisonVersion, setComparisonVersion] = useState<WikiVersion | null>(null);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/wiki/history?id=${page._id || page.id}`);
        const data = await res.json();
        setHistory(data);
        if (data.length > 0) {
          setSelectedVersion(data[0]);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [page]);

  const handleRevert = async (id: string) => {
    if (window.confirm("Are you sure you want to revert to this version? The current state will be saved to history.")) {
      setReverting(true);
      await onRevert(id);
      setReverting(false);
    }
  };

  const toggleComparison = (version: WikiVersion) => {
    if (comparisonVersion?._id === version._id) {
      setComparisonVersion(null);
    } else {
      setComparisonVersion(version);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-fadeIn overflow-hidden">
      <header className="px-10 py-6 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              Version History
              {comparisonVersion && (
                <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-[10px] rounded-full uppercase tracking-widest animate-pulse">
                  Comparison Mode Active
                </span>
              )}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{page.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {comparisonVersion && (
             <button 
              onClick={() => setComparisonVersion(null)}
              className="px-6 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl hover:bg-indigo-100 transition-all uppercase tracking-widest flex items-center gap-2"
            >
              <i className="fas fa-times"></i>
              Clear Comparison
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-widest"
          >
            Exit History
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Versions List */}
        <aside className="w-80 border-r border-slate-200 bg-white overflow-y-auto custom-scrollbar shrink-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse"></div>)}
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <i className="fas fa-clock-rotate-left text-slate-200 text-4xl mb-4"></i>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No previous versions found.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              <div className="px-4 py-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Snapshots</div>
              {history.map((version) => {
                const isSelected = selectedVersion?._id === version._id;
                const isComparing = comparisonVersion?._id === version._id;
                
                return (
                  <div key={version._id} className="relative group/item">
                    <button
                      onClick={() => setSelectedVersion(version)}
                      className={`w-full text-left p-4 pr-12 rounded-2xl transition-all border ${
                        isSelected 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : isComparing
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                        : 'border-transparent hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-blue-600 text-white' : isComparing ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <i className={`fas ${isComparing ? 'fa-columns' : 'fa-history'}`}></i>
                        </div>
                        <span className="text-xs font-black text-slate-800">{formatDate(version.versionedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <i className="fas fa-user-pen scale-75"></i>
                        <span className="truncate">{version.lastModifiedBy || version.author || 'System'}</span>
                      </div>
                    </button>
                    
                    {!isSelected && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComparison(version);
                        }}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-sm ${
                          isComparing 
                          ? 'bg-indigo-600 text-white opacity-100 scale-110' 
                          : 'bg-white border border-slate-200 text-slate-400 opacity-0 group-hover/item:opacity-100 hover:text-indigo-600 hover:border-indigo-200'
                        }`}
                        title={isComparing ? "Remove from comparison" : "Compare with current selection"}
                      >
                        <i className="fas fa-columns text-[10px]"></i>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Preview Area */}
        <main className={`flex-1 bg-white overflow-y-auto custom-scrollbar ${comparisonVersion ? 'p-0' : 'p-12'}`}>
          {comparisonVersion && selectedVersion ? (
            <div className="flex h-full divide-x divide-slate-100">
              {/* Left Column: Base Version */}
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-50/30">
                <div className="sticky top-0 z-10 mb-8 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Primary Selection</span>
                      <h4 className="text-sm font-bold text-slate-800">{formatDate(selectedVersion.versionedAt)}</h4>
                    </div>
                    <button
                      onClick={() => handleRevert(selectedVersion._id!)}
                      disabled={reverting}
                      className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-widest"
                    >
                      Restore
                    </button>
                  </div>
                </div>
                <WikiPageDisplay page={selectedVersion as any} />
              </div>

              {/* Right Column: Comparison Version */}
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="sticky top-0 z-10 mb-8 bg-indigo-50/80 backdrop-blur-md p-4 rounded-2xl border border-indigo-100 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Comparison Target</span>
                      <h4 className="text-sm font-bold text-slate-800">{formatDate(comparisonVersion.versionedAt)}</h4>
                    </div>
                    <button
                      onClick={() => handleRevert(comparisonVersion._id!)}
                      disabled={reverting}
                      className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all uppercase tracking-widest"
                    >
                      Restore
                    </button>
                  </div>
                </div>
                <WikiPageDisplay page={comparisonVersion as any} />
              </div>
            </div>
          ) : selectedVersion ? (
            <div className="max-w-4xl mx-auto">
              <div className="mb-10 p-6 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl shadow-inner">
                    <i className="fas fa-eye"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-amber-800 uppercase tracking-tight">Viewing Historical Snapshot</h3>
                    <p className="text-xs text-amber-600 font-medium italic">Document state from {formatDate(selectedVersion.versionedAt)}.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevert(selectedVersion._id!)}
                  disabled={reverting}
                  className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-xl shadow-black/10 hover:bg-slate-800 disabled:opacity-50 transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  {reverting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-rotate-left"></i>}
                  Restore Version
                </button>
              </div>
              <WikiPageDisplay page={selectedVersion as any} />
            </div>
          ) : !loading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
               <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                 <i className="fas fa-file-circle-question text-6xl"></i>
               </div>
               <p className="font-black uppercase tracking-widest text-xs">Select a version to preview or compare</p>
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default WikiHistory;
