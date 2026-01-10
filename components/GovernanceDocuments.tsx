
import React, { useState } from 'react';

const DOCS = [
  { id: 'GD-001', title: 'Cloud-Native Architecture Standard', category: 'Architecture', version: 'v2.4', date: '2024-05-12', status: 'Verified' },
  { id: 'GD-002', title: 'Data Privacy & PII Protection Policy', category: 'Security', version: 'v1.1', date: '2024-08-30', status: 'Verified' },
  { id: 'GD-003', title: 'Vendor Engagement Framework', category: 'Compliance', version: 'v3.0', date: '2024-01-15', status: 'Draft' },
  { id: 'GD-004', title: 'API Security & Zero-Trust Guidelines', category: 'Security', version: 'v2.1', date: '2024-11-20', status: 'Verified' },
  { id: 'GD-005', title: 'CI/CD Pipeline Integrity Standard', category: 'Architecture', version: 'v1.5', date: '2024-03-04', status: 'Verified' },
];

const GovernanceDocuments: React.FC = () => {
  const [filter, setFilter] = useState('All');

  const filteredDocs = filter === 'All' ? DOCS : DOCS.filter(d => d.category === filter);

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Governance Vault</h1>
          <p className="text-slate-500 font-medium">Secure repository for enterprise delivery standards and compliance protocols.</p>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          {['All', 'Architecture', 'Security', 'Compliance'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                filter === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDocs.map(doc => (
          <div key={doc.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-1 shadow-sm hover:shadow-xl transition-all group flex overflow-hidden h-48">
            <div className="w-1/3 bg-slate-50 flex flex-col items-center justify-center border-r border-slate-100 group-hover:bg-blue-50 transition-colors">
              <i className={`fas ${doc.category === 'Security' ? 'fa-shield-halved' : doc.category === 'Architecture' ? 'fa-drafting-compass' : 'fa-clipboard-check'} text-4xl ${doc.category === 'Security' ? 'text-blue-500' : 'text-slate-300'} opacity-50`}></i>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-4">{doc.id}</span>
            </div>
            
            <div className="flex-1 p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{doc.category}</span>
                  {doc.status === 'Verified' ? (
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                      <i className="fas fa-certificate"></i>
                      Verified
                    </span>
                  ) : (
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest italic">Review Pending</span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors cursor-pointer">{doc.title}</h3>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Release</span>
                    <span className="text-[10px] font-bold text-slate-600">{doc.version}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Effective</span>
                    <span className="text-[10px] font-bold text-slate-600">{doc.date}</span>
                  </div>
                </div>
                
                <button className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95 shadow-lg">
                  <i className="fas fa-file-pdf"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-10 bg-blue-900 rounded-[3rem] text-white flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
         <div className="relative z-10 text-center lg:text-left">
           <h4 className="text-2xl font-black tracking-tight mb-2">Policy Change Request?</h4>
           <p className="text-blue-200 text-sm max-w-md font-medium">Drafting a new architecture standard or updating existing compliance protocols requires Architect approval.</p>
         </div>
         <button className="relative z-10 px-8 py-4 bg-white text-blue-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95">
           Initiate Governance Review
         </button>
      </div>
    </div>
  );
};

export default GovernanceDocuments;
