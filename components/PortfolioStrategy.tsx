
import React from 'react';
import { Application, TimeModelStatus } from '../types';

const PortfolioStrategy: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const timeCategories = [
    { id: TimeModelStatus.INVEST, label: 'Invest', color: 'bg-emerald-50 text-emerald-600', icon: 'fa-arrow-up-right-dots', desc: 'High Value, High Tech Fit' },
    { id: TimeModelStatus.TOLERATE, label: 'Tolerate', color: 'bg-blue-50 text-blue-600', icon: 'fa-clock', desc: 'High Tech Fit, Low Value' },
    { id: TimeModelStatus.MIGRATE, label: 'Migrate', color: 'bg-amber-50 text-amber-600', icon: 'fa-shuffle', desc: 'High Value, Low Tech Fit' },
    { id: TimeModelStatus.ELIMINATE, label: 'Eliminate', color: 'bg-red-50 text-red-600', icon: 'fa-trash-can', desc: 'Low Value, Low Tech Fit' }
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
       <header>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Portfolio Rationalization</h2>
          <p className="text-slate-400 font-medium text-lg">TIME Framework mapping for enterprise asset lifecycle.</p>
       </header>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {timeCategories.map(cat => {
            const apps = applications.filter(a => a.lifecycle?.timeStatus === cat.id);
            return (
              <div key={cat.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 flex flex-col hover:shadow-2xl transition-all">
                 <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center text-xl mb-6 shadow-sm`}>
                    <i className={`fas ${cat.icon}`}></i>
                 </div>
                 <h4 className="text-xl font-black text-slate-800">{cat.label}</h4>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{cat.desc}</p>
                 
                 <div className="flex-1 space-y-3">
                    {apps.map(app => (
                      <div key={app._id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-700 truncate">{app.name}</span>
                         <i className="fas fa-chevron-right text-[8px] text-slate-300"></i>
                      </div>
                    ))}
                    {apps.length === 0 && <div className="py-10 text-center opacity-20 italic text-xs">Zero artifacts assigned</div>}
                 </div>
              </div>
            );
          })}
       </div>
    </div>
  );
};

export default PortfolioStrategy;
