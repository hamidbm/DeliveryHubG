
import React, { useState } from 'react';
import AdminThemes from './AdminThemes';

const Admin: React.FC = () => {
  const [activeModule, setActiveModule] = useState('wiki-themes');

  const modules = [
    { id: 'wiki-themes', label: 'Wiki Themes', icon: 'fa-palette', description: 'Visual styling and document rendering' },
    { id: 'users', label: 'Identity Mgmt', icon: 'fa-users-gear', description: 'User roles and access control' },
    { id: 'bundles', label: 'Portfolio Config', icon: 'fa-layer-group', description: 'Business bundles and app hierarchy' },
    { id: 'audit', label: 'Audit Logs', icon: 'fa-list-check', description: 'Security and change history' }
  ];

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'wiki-themes':
        return <AdminThemes />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[600px] text-slate-300">
            <i className="fas fa-screwdriver-wrench text-6xl mb-6 opacity-20"></i>
            <h3 className="text-xl font-black uppercase tracking-widest">Module Provisioning Required</h3>
            <p className="text-sm font-medium mt-2">The {modules.find(m => m.id === activeModule)?.label} interface is being updated.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex bg-white min-h-[850px] border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fadeIn">
      {/* Sidebar Sub-nav */}
      <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/20">
        <div className="p-8 border-b border-slate-100">
           <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Admin Console</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">System Control Layer</p>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveModule(m.id)}
              className={`w-full text-left p-4 rounded-2xl transition-all group ${
                activeModule === m.id 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'text-slate-600 hover:bg-slate-100/50'
              }`}
            >
              <div className="flex items-center gap-4 mb-1">
                <i className={`fas ${m.icon} ${activeModule === m.id ? 'text-blue-400' : 'text-slate-300 group-hover:text-slate-500'}`}></i>
                <span className="text-sm font-black uppercase tracking-tight">{m.label}</span>
              </div>
              <p className={`text-[10px] font-medium leading-tight ${activeModule === m.id ? 'text-slate-400' : 'text-slate-400'}`}>
                {m.description}
              </p>
            </button>
          ))}
        </nav>

        <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
           <div className="relative z-10">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Security Pulse</span>
             </div>
             <p className="text-[10px] font-medium text-slate-300">System integrity verified. No pending vulnerability alerts.</p>
           </div>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {renderModuleContent()}
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Admin;
