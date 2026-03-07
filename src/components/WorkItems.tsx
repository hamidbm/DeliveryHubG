
import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from '../App';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemsTreeView from './WorkItemsTreeView';
import WorkItemsBoardView from './WorkItemsBoardView';
import WorkItemsListView from './WorkItemsListView';
import WorkItemsAnalyticsView from './WorkItemsAnalyticsView';
import WorkItemsBacklogView from './WorkItemsBacklogView';
import WorkItemsRoadmapView from './WorkItemsRoadmapView';
import WorkItemsMilestonePlanningView from './WorkItemsMilestonePlanningView';
import WorkItemsSprintsView from './WorkItemsSprintsView';
import Milestones from './Milestones';
import GenerateDeliveryPlanWizard from './GenerateDeliveryPlanWizard';

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
  const activeView = searchParams.get('view') || 'roadmap';
  const [quickFilter, setQuickFilter] = useState<'all' | 'my' | 'updated' | 'blocked'>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  
  // Detailed Filtering State
  const [filters, setFilters] = useState({
    types: [] as string[],
    priorities: [] as string[],
    health: [] as string[]
  });

  const viewGroups = useMemo(() => ({
    planning: [
      { id: 'roadmap', label: 'Roadmap' },
      { id: 'milestones', label: 'Milestones' },
      { id: 'milestone-plan', label: 'Cycle Planning' }
    ],
    execution: [
      { id: 'board', label: 'Board' },
      { id: 'backlog', label: 'Backlog' },
      { id: 'list', label: 'List' }
    ],
    intelligence: [
      { id: 'tree', label: 'Hierarchy' },
      { id: 'sprints', label: 'Sprints' },
      { id: 'analytics', label: 'Analytics' }
    ]
  }), []);

  const viewToMode = useMemo(() => {
    const map: Record<string, 'planning' | 'execution' | 'intelligence'> = {};
    (Object.keys(viewGroups) as Array<keyof typeof viewGroups>).forEach((mode) => {
      viewGroups[mode].forEach((view) => {
        map[view.id] = mode;
      });
    });
    return map;
  }, [viewGroups]);

  const [activeMode, setActiveMode] = useState<'planning' | 'execution' | 'intelligence'>(viewToMode[activeView] || 'planning');

  useEffect(() => {
    setActiveMode(viewToMode[activeView] || 'planning');
  }, [activeView, viewToMode]);

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

  const toggleHighRisk = () => {
    setFilters((prev) => {
      const next = new Set(prev.priorities);
      const hasHigh = next.has('HIGH');
      const hasCritical = next.has('CRITICAL');
      if (hasHigh || hasCritical) {
        next.delete('HIGH');
        next.delete('CRITICAL');
      } else {
        next.add('HIGH');
        next.add('CRITICAL');
      }
      return { ...prev, priorities: Array.from(next) };
    });
  };

  const toggleHealth = (value: string) => {
    toggleFilter('health', value);
  };

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; cat: keyof typeof filters; value: string }> = [];
    filters.types.forEach((type) => chips.push({ id: `type:${type}`, label: type, cat: 'types', value: type }));
    filters.priorities.forEach((p) => chips.push({ id: `prio:${p}`, label: `Risk ${p}`, cat: 'priorities', value: p }));
    filters.health.forEach((h) => chips.push({ id: `health:${h}`, label: h === 'BLOCKED' ? 'Blocked' : h === 'FLAGGED' ? 'Flagged' : h, cat: 'health', value: h }));
    return chips;
  }, [filters]);

  const filtersCount = filters.types.length + filters.priorities.length + filters.health.length;

  const sanitizedProps = {
    ...props,
    selEpicId: props.selEpicId || 'all',
    quickFilter,
    activeFilters: filters,
    includeArchived
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur px-6 py-3 rounded-[2rem] border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Mode</span>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {([
                { id: 'planning', label: 'Planning' },
                { id: 'execution', label: 'Execution' },
                { id: 'intelligence', label: 'Intelligence' }
              ] as const).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    if (activeMode === mode.id) return;
                    setActiveMode(mode.id);
                    const target = viewGroups[mode.id][0];
                    if (target) setView(target.id);
                  }}
                  className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${
                    activeMode === mode.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all flex items-center gap-2 ${
                filtersCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className="fas fa-filter"></i>
              Filters {filtersCount > 0 ? `(${filtersCount})` : ''}
            </button>
            <button
              onClick={() => setIncludeArchived(v => !v)}
              className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all flex items-center gap-2 ${
                includeArchived ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className="fas fa-box-archive"></i>
              {includeArchived ? 'Archived: On' : 'Archived: Off'}
            </button>
            <div className="h-6 w-[1px] bg-slate-100 mx-1"></div>
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-2">Focus:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Issues' },
                { id: 'blocked', label: 'Blockers' },
                { id: 'updated', label: 'Recent' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setQuickFilter(f.id as any)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${
                    quickFilter === f.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {activeMode === 'planning' && (
              <button
                onClick={() => setIsPlanModalOpen(true)}
                className="px-4 py-1.5 text-[9px] font-black uppercase rounded-xl border transition-all flex items-center gap-2 bg-slate-900 text-white border-slate-900 hover:bg-blue-600"
              >
                <i className="fas fa-sitemap"></i>
                Generate Delivery Plan
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {viewGroups[activeMode].map((view) => (
            <button
              key={view.id}
              onClick={() => setView(view.id)}
              className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${
                activeView === view.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:text-slate-700'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="flex items-center flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              onClick={() => toggleFilter(chip.cat, chip.value)}
              className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              {chip.label} <i className="fas fa-times ml-1"></i>
            </button>
          ))}
          <button
            onClick={() => setFilters({ types: [], priorities: [], health: [] })}
            className="px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filter Drawer */}
      {isFilterDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[150]" onClick={() => setIsFilterDrawerOpen(false)}></div>
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[160] p-10 flex flex-col animate-slideIn">
             <header className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Filters</h3>
                <button onClick={() => setIsFilterDrawerOpen(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><i className="fas fa-times"></i></button>
             </header>

             <div className="space-y-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                <section>
                   <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Work Item Type</h4>
                   <div className="space-y-2">
                      {Object.values(WorkItemType).filter((type) => !['RISK', 'DEPENDENCY'].includes(type)).map(type => (
                        <FilterToggle key={type} label={type} active={filters.types.includes(type)} onClick={() => toggleFilter('types', type)} />
                      ))}
                   </div>
                </section>

                <section>
                   <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Delivery Signals</h4>
                   <div className="space-y-2">
                      <FilterToggle label="Blocked" active={filters.health.includes('BLOCKED')} onClick={() => toggleHealth('BLOCKED')} />
                      <FilterToggle label="Flagged" active={filters.health.includes('FLAGGED')} onClick={() => toggleHealth('FLAGGED')} />
                      <FilterToggle label="High Risk (Critical/High)" active={filters.priorities.some((p) => ['CRITICAL', 'HIGH'].includes(p))} onClick={toggleHighRisk} />
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                        <FilterToggle key={p} label={`Risk ${p}`} active={filters.priorities.includes(p)} onClick={() => toggleFilter('priorities', p)} />
                      ))}
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
          ) : activeView === 'sprints' ? (
            <WorkItemsSprintsView {...sanitizedProps} />
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

      {isPlanModalOpen && (
        <GenerateDeliveryPlanWizard
          bundles={props.bundles}
          applications={props.applications}
          onClose={() => setIsPlanModalOpen(false)}
        />
      )}
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
