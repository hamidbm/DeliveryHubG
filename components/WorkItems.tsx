
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`?${params.toString()}`);
  };

  // Enhance sanitizedProps with quick filter logic for child components
  const sanitizedProps = {
    ...props,
    selEpicId: props.selEpicId || 'all',
    quickFilter
  };

  return (
    <div className="flex flex-col gap-6">
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

        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 self-end md:self-auto">
           <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-2">Quick Filters:</span>
           {[
             { id: 'all', label: 'All' },
             { id: 'my', label: 'My Issues' },
             { id: 'updated', label: 'Recently Updated' },
             { id: 'blocked', label: 'Critical Blockers' }
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

      <Suspense fallback={
        <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Initializing Hub...</p>
        </div>
      }>
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
      </Suspense>
    </div>
  );
};

export default WorkItems;
