
import React, { useState } from 'react';
import { WORK_ITEMS } from '../constants';
import { Application } from '../types';

interface WorkItemsProps {
  applications?: Application[];
}

const WorkItems: React.FC<WorkItemsProps> = ({ applications = [] }) => {
  const [filter, setFilter] = useState<string>('All');

  const filteredItems = filter === 'All' 
    ? WORK_ITEMS 
    : WORK_ITEMS.filter(item => item.status === filter);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-slate-500 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
            Delivery Work Items
          </h1>
          <p className="text-slate-500 mt-1">Real-time feature tracking across all delivery pods.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
          {['All', 'To Do', 'In Progress', 'Review', 'Done'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                filter === status 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                item.type === 'Epic' ? 'bg-indigo-100 text-indigo-600' :
                item.type === 'Feature' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
              }`}>
                <i className={`fas ${
                  item.type === 'Epic' ? 'fa-layer-group' : 
                  item.type === 'Feature' ? 'fa-star' : 'fa-check'
                } text-xl`}></i>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-300 tracking-widest uppercase">{item.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${getPriorityStyle(item.priority)}`}>
                    {item.priority}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition tracking-tight">{item.title}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                   <i className="fas fa-cube text-slate-300 text-xs"></i>
                   <span>{(applications || []).find(a => a.id === item.applicationId || a._id === item.applicationId)?.name || 'General Node'}</span>
                   <span className="text-slate-200">•</span>
                   <span className="font-medium text-slate-400 italic">{item.type}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-8 border-t lg:border-t-0 pt-4 lg:pt-0">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase mb-2">Primary Lead</span>
                <div className="flex items-center gap-2">
                   <img 
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.assignedTo)}&background=random`} 
                    alt={item.assignedTo} 
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  />
                  <span className="text-sm font-semibold text-slate-700">{item.assignedTo}</span>
                </div>
              </div>

              <div className="w-32">
                <div className={`text-center py-2 rounded-xl border text-xs font-black uppercase tracking-widest ${
                  item.status === 'Done' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 
                  item.status === 'In Progress' ? 'border-blue-100 bg-blue-50 text-blue-600' : 
                  item.status === 'Review' ? 'border-amber-100 bg-amber-50 text-amber-600' : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}>
                  {item.status}
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="py-24 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <i className="fas fa-filter text-slate-200 text-6xl mb-4"></i>
            <p className="text-slate-400 font-medium">No items matching that status filter currently exist.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkItems;
