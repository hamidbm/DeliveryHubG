
import React, { useState } from 'react';
import AdminThemes from './AdminThemes';

const Admin: React.FC = () => {
  const [activeModule, setActiveModule] = useState('home');

  const modules = [
    { id: 'wiki-themes', label: 'Wiki Themes', icon: 'fa-palette', description: 'Visual styling and document rendering definitions.', color: 'blue' },
    { id: 'users', label: 'Identity Mgmt', icon: 'fa-users-gear', description: 'User roles, access control, and corporate identity.', color: 'indigo' },
    { id: 'bundles', label: 'Portfolio Config', icon: 'fa-layer-group', description: 'Business bundles and application hierarchy mapping.', color: 'slate' },
    { id: 'audit', label: 'Audit Logs', icon: 'fa-list-check', description: 'Security audit trails and system change history.', color: 'emerald' }
  ];

  const renderModuleContent = () => {
    if (activeModule === 'home') {
      return (
        <div className="p-12 animate-fadeIn max-w-6xl mx-auto">
          <header className="mb-12">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">System Administration</h2>
            <p className="text-slate-500 font-medium text-lg mt-2">Manage the core parameters and governance of the NexusDelivery ecosystem.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className="group relative bg-white border border-slate-200 rounded-[2.5rem] p-10 text-left transition-all hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-2 overflow-hidden"
              >
                <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-5 group-hover:scale-150 transition-transform duration-700 ${
                  m.color === 'blue' ? 'bg-blue-600' : m.color === 'indigo' ? 'bg-indigo-600' : m.color === 'emerald' ? 'bg-emerald-600' : 'bg-slate-600'
                }`}></div>
                
                <div className="flex items-center gap-6 mb-6">
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6 ${
                    m.color === 'blue' ? 'bg-blue-600 text-white' : m.color === 'indigo' ? 'bg-indigo-600 text-white' : m.color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                  }`}>
                    <i className={`fas ${m.icon} text-2xl`}></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{m.label}</h3>
                    <div className="h-1 w-12 bg-slate-100 mt-1 group-hover:w-24 transition-all duration-500"></div>
                  </div>
                </div>
                
                <p className="text-slate-500 font-medium leading-relaxed mb-8">
                  {m.description}
                </p>
                
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Enter Module</span>
                  <i className="fas fa-arrow-right"></i>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-12 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                <i className="fas fa-shield-halved text-lg"></i>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Security Status</p>
                <p className="text-sm font-bold text-slate-700">AES-256 Encrypted Session Active. No active vulnerability threats detected.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Secure</span>
            </div>
          </div>
        </div>
      );
    }

    switch (activeModule) {
      case 'wiki-themes':
        return (
          <div className="relative">
            <button 
              onClick={() => setActiveModule('home')}
              className="absolute top-8 left-8 z-50 w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all"
              title="Back to Admin Home"
            >
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className="pt-16">
              <AdminThemes />
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[700px] text-slate-300">
            <button onClick={() => setActiveModule('home')} className="mb-10 text-xs font-black text-slate-400 hover:text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
              <i className="fas fa-arrow-left"></i> Back to Console
            </button>
            <i className="fas fa-screwdriver-wrench text-8xl mb-6 opacity-5"></i>
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
          <button
            onClick={() => setActiveModule('home')}
            className={`w-full text-left p-4 rounded-2xl transition-all group ${
              activeModule === 'home' 
              ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
              : 'text-slate-600 hover:bg-slate-100/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <i className={`fas fa-home ${activeModule === 'home' ? 'text-blue-400' : 'text-slate-300 group-hover:text-slate-500'}`}></i>
              <span className="text-sm font-black uppercase tracking-tight">Console Home</span>
            </div>
          </button>

          <div className="h-4"></div>
          <p className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Management Modules</p>

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
              <p className={`text-[9px] font-medium leading-tight ${activeModule === m.id ? 'text-slate-400' : 'text-slate-400'}`}>
                {m.description.substring(0, 40)}...
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
             <p className="text-[10px] font-medium text-slate-300">System integrity verified.</p>
           </div>
        </div>
      </aside>

      {/* Main Admin Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white">
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
