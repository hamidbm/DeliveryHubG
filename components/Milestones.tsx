
import React from 'react';
import { MILESTONES, APPLICATIONS } from '../constants';
import { MilestoneStatus } from '../types';

const Milestones: React.FC = () => {
  const getStatusColor = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.COMPLETED: return 'bg-emerald-500';
      case MilestoneStatus.IN_PROGRESS: return 'bg-blue-500';
      case MilestoneStatus.DELAYED: return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusBg = (status: MilestoneStatus) => {
    switch (status) {
      case MilestoneStatus.COMPLETED: return 'bg-emerald-50 border-emerald-100 text-emerald-700';
      case MilestoneStatus.IN_PROGRESS: return 'bg-blue-50 border-blue-100 text-blue-700';
      case MilestoneStatus.DELAYED: return 'bg-red-50 border-red-100 text-red-700';
      default: return 'bg-slate-50 border-slate-100 text-slate-500';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Delivery Roadmap</h1>
          <p className="text-slate-500 font-medium">Tracking critical milestones and vendor commitment timelines.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                V{i}
              </div>
            ))}
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Vendors</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MILESTONES.map((ms) => {
          const app = APPLICATIONS.find(a => a.id === ms.applicationId);
          return (
            <div key={ms.id} className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl ${getStatusColor(ms.status)} text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                  <i className={`fas ${ms.status === MilestoneStatus.COMPLETED ? 'fa-check-double' : 'fa-calendar-check'} text-lg`}></i>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusBg(ms.status)}`}>
                  {ms.status}
                </span>
              </div>

              <div className="space-y-1 mb-6">
                <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                  {ms.name}
                </h3>
                <p className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <i className="fas fa-cube text-xs"></i>
                  {app?.name || 'Unknown System'}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Target Date</span>
                  <span className="text-sm font-bold text-slate-700">{ms.dueDate}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Lead Vendor</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-[10px] font-black text-blue-600">
                      {ms.vendorCompany[0]}
                    </div>
                    <span className="text-xs font-bold text-slate-600">{ms.vendorCompany}</span>
                  </div>
                </div>
              </div>

              <button className="w-full mt-8 py-4 rounded-2xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95">
                View Governance Audit
              </button>
            </div>
          );
        })}

        <button className="border-2 border-dashed border-slate-200 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all group">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center group-hover:rotate-90 transition-transform">
            <i className="fas fa-plus text-2xl"></i>
          </div>
          <span className="font-black text-[10px] uppercase tracking-[0.2em]">Add Delivery Target</span>
        </button>
      </div>
    </div>
  );
};

export default Milestones;
