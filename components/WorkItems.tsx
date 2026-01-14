
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import WorkItemsTreeView from './WorkItemsTreeView';
import WorkItemsBoardView from './WorkItemsBoardView';
import WorkItemsListView from './WorkItemsListView';

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

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between bg-white px-8 py-4 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Work Delivery Hub</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Execution Plane</p>
          </div>
          <div className="h-8 w-[1px] bg-slate-100"></div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('tree')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${activeView === 'tree' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <i className="fas fa-sitemap"></i>
              Hierarchy
            </button>
            <button 
              onClick={() => setView('board')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${activeView === 'board' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <i className="fas fa-chalkboard"></i>
              Board
            </button>
            <button 
              onClick={() => setView('list')}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${activeView === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <i className="fas fa-list"></i>
              Navigator
            </button>
          </div>
        </div>
      </div>

      <Suspense fallback={
        <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-100">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Initializing Hub...</p>
        </div>
      }>
        {activeView === 'board' ? (
          <WorkItemsBoardView {...props} />
        ) : activeView === 'list' ? (
          <WorkItemsListView {...props} />
        ) : (
          <WorkItemsTreeView {...props} />
        )}
      </Suspense>
    </div>
  );
};

export default WorkItems;
