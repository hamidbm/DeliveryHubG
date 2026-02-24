import React from 'react';
import { WorkItemActivity } from '../types';

const WorkItemActivityPanel: React.FC<{ activity?: WorkItemActivity[] }> = ({ activity }) => {
  return (
    <div className="p-10 space-y-8 animate-fadeIn">
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute left-[4.5rem] top-20 bottom-10 w-[1px] bg-slate-100"></div>
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-12">Execution Audit Trail</h4>
        <div className="space-y-10 relative z-10">
          {(activity || []).slice().reverse().map((act, i) => (
            <div key={i} className="flex gap-10">
              <div className="w-12 text-right shrink-0">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${
                act.action === 'CREATED' ? 'bg-emerald-50 text-white' : 
                act.action === 'CHANGED_STATUS' ? 'bg-blue-500 text-white' : 
                act.action === 'IMPEDIMENT_RAISED' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                <i className={`fas ${
                  act.action === 'CREATED' ? 'fa-plus' : 
                  act.action === 'CHANGED_STATUS' ? 'fa-rotate' : 
                  act.action === 'IMPEDIMENT_RAISED' ? 'fa-flag' : 'fa-pen-to-square'
                } text-[8px]`}></i>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs font-bold text-slate-700">
                  <span className="text-blue-600">{act.user}</span> {act.action.replace(/_/g, ' ').toLowerCase()} {act.field && <span className="text-slate-400 font-medium">field</span>} <span className="text-slate-900">{act.field}</span>
                </p>
                {act.from !== undefined && act.to !== undefined && (
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase">
                    <span>{String(act.from)}</span>
                    <i className="fas fa-arrow-right text-[8px]"></i>
                    <span className="text-slate-600">{String(act.to)}</span>
                  </div>
                )}
                <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 tracking-widest">{new Date(act.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkItemActivityPanel;
