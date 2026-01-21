
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from '../App';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemsTreeView from './WorkItemsTreeView';
import WorkItemsBoardView from './WorkItemsBoardView';
import WorkItemsListView from './WorkItemsListView';
import WorkItemsAnalyticsView from './WorkItemsAnalyticsView';
import WorkItemsBacklogView from './WorkItemsBacklogView';
import WorkItemsRoadmapView from './WorkItemsRoadmapView';
import WorkItemsMilestonePlanningView from './WorkItemsMilestonePlanningView';
import Milestones from './Milestones';

interface WorkItemsProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItems: React.FC<WorkItemsProps> = (props) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeView = searchParams.get('view') || 'tree';
  const [quickFilter, setQuickFilter] = useState<'all' | 'my' | 'updated' | 'blocked'>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  
  // Detailed Filtering State
  const [filters, setFilters] = useState({
    types: [] as string[],
    priorities: [] as string[],
    health: [] as string[]
  });

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`?${params.toString()}`);
  };

  const toggleFilter = (cat: keyof typeof filters, val: string) => {
    setFilters(prev => ({
      ...prev,
      [cat]: prev[cat].includes(val) ? prev[cat].filter(v => v !== val) : [...prev[cat], val]
    }));
  };

  const sanitizedProps = {
    ...props,
    selEpicId: props.selEpicId || 'all',
    quickFilter,
    activeFilters: filters
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* View Switcher & Quick Filters Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-8 py-4 rounded-[2rem] border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Work Delivery Hub</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Execution Plane</p>
          </div>
          <div className="h-8 w-[1px] bg-slate-100 hidden md:block"></div>
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            {[
              { id: 'roadmap', label: 'Roadmap', icon: 'fa-route' },
              { id: 'tree', label: 'Hierarchy', icon: 'fa-sitemap' },
              { id: 'backlog', label: 'Backlog', icon: 'fa-layer-group' },
              { id: 'milestone-plan', label: 'Cycle Planning', icon: 'fa-map-signs' },
              { id: 'milestones', label: 'Milestones', icon: 'fa-flag-checkered' },
              { id: 'board', label: 'Board', icon: 'fa-chalkboard' },
              { id: 'list', label: 'List View', icon: 'fa-list' },
              { id: 'analytics', label: 'Analytics', icon: 'fa-chart-line' }
            ].map(view => (
              <button 
                key={view.id}
                onClick={() => setView(view.id)}
                className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${activeView === view.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <i className={`fas ${view.icon}`}></i>
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={() => setIsFilterDrawerOpen(true)}
             className={`px-4 py-2 text-[9px] font-black uppercase rounded-xl border transition-all flex items-center gap-2 ${filters.types.length || filters.priorities.length ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
           >
              <i className="fas fa-filter"></i> 
              Filters { (filters.types.length + filters.priorities.length) > 0 ? `(${filters.types.length + filters.priorities.length})` : '' }
           </button>
           <div className="h-6 w-[1px] bg-slate-100 mx-2"></div>
           <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 self-end md:self-auto">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-2">Focus:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Issues' },
                { id: 'updated', label: 'Recent' },
                { id: 'blocked', label: 'Blockers' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setQuickFilter(f.id as any)}
                  className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${quickFilter === f.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {f.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Filter Drawer */}
      {isFilterDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[150]" onClick={() => setIsFilterDrawerOpen(false)}></div>
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[160] p-10 flex flex-col animate-slideIn">
             <header className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Precision Filters</h3>
                <button onClick={() => setIsFilterDrawerOpen(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><i className="fas fa-times"></i></button>
             </header>

             <div className="space-y-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                <section>
                   <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Artifact Type</h4>
                   <div className="space-y-2">
                      {Object.values(WorkItemType).map(type => (
                        <FilterToggle key={type} label={type} active={filters.types.includes(type)} onClick={() => toggleFilter('types', type)} />
                      ))}
                   </div>
                </section>

                <section>
                   <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Urgency Level</h4>
                   <div className="space-y-2">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                        <FilterToggle key={p} label={p} active={filters.priorities.includes(p)} onClick={() => toggleFilter('priorities', p)} />
                      ))}
                   </div>
                </section>

                <section>
                   <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Health Pulse</h4>
                   <div className="space-y-2">
                      <FilterToggle label="Flagged" active={filters.health.includes('FLAGGED')} onClick={() => toggleFilter('health', 'FLAGGED')} />
                      <FilterToggle label="Blocked" active={filters.health.includes('BLOCKED')} onClick={() => toggleFilter('health', 'BLOCKED')} />
                   </div>
                </section>
             </div>

             <div className="pt-8 border-t border-slate-100">
                <button 
                  onClick={() => setFilters({ types: [], priorities: [], health: [] })}
                  className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors"
                >
                  Clear All Filters
                </button>
             </div>
          </div>
        </>
      )}

      <Suspense fallback={
        <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Initializing Hub...</p>
        </div>
      }>
        <div className="animate-fadeIn">
          {activeView === 'roadmap' ? (
            <WorkItemsRoadmapView {...sanitizedProps} />
          ) : activeView === 'board' ? (
            <WorkItemsBoardView {...sanitizedProps} />
          ) : activeView === 'list' ? (
            <WorkItemsListView {...sanitizedProps} />
          ) : activeView === 'analytics' ? (
            <WorkItemsAnalyticsView {...sanitizedProps} />
          ) : activeView === 'backlog' ? (
            <WorkItemsBacklogView {...sanitizedProps} />
          ) : activeView === 'milestone-plan' ? (
            <WorkItemsMilestonePlanningView {...sanitizedProps} />
          ) : activeView === 'milestones' ? (
            <Milestones 
              applications={props.applications} 
              bundles={props.bundles} 
              activeBundleId={props.selBundleId}
              activeAppId={props.selAppId}
            />
          ) : (
            <WorkItemsTreeView {...sanitizedProps} />
          )}
        </div>
      </Suspense>
    </div>
  );
};

const FilterToggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-2 rounded-xl transition-all border ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white'}`}
  >
     <span className="text-[10px] font-black uppercase tracking-tight">{label.replace(/_/g, ' ')}</span>
     {active ? <i className="fas fa-check-circle text-[10px]"></i> : <div className="w-3 h-3 rounded-full border border-slate-300"></div>}
  </button>
);

export default WorkItems;
