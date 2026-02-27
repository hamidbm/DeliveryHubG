
import React, { useState } from 'react';
import AdminThemes from './AdminThemes';
import AdminBundles from './AdminBundles';
import AdminApplications from './AdminApplications';
import AdminTaxonomy from './AdminTaxonomy';
import AdminAiSettings from './AdminAiSettings';
import AdminWikiTemplates from './AdminWikiTemplates';
import AdminBundleAssignments from './AdminBundleAssignments';
import AdminAdmins from './AdminAdmins';
import AdminWorkBlueprints from './AdminWorkBlueprints';
import AdminWorkGenerators from './AdminWorkGenerators';
import AdminDiagramTemplates from './AdminDiagramTemplates';
import AdminSamples from './AdminSamples';

type AdminModuleId = 'home' | 'wiki-themes' | 'wiki-templates' | 'diagram-templates' | 'vendors' | 'roles' | 'bundles' | 'applications' | 'taxonomy' | 'artifact-rules' | 'milestone-templates' | 'users' | 'sharepoint' | 'ai-settings' | 'bundle-assignments' | 'admins' | 'work-blueprints' | 'work-generators' | 'samples';

interface AdminModule {
  id: AdminModuleId;
  label: string;
  icon: string;
  description: string;
  color: string;
}

interface AdminSection {
  title: string;
  modules: AdminModule[];
}

const Admin: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AdminModuleId>('home');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isCmo, setIsCmo] = useState(false);

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/check');
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const data = await res.json();
        setIsAdmin(Boolean(data?.isAdmin));
        setIsCmo(Boolean(data?.isCmo));
      } catch {
        setIsAdmin(false);
      }
    };
    check();
  }, []);

  if (isAdmin === false && !isCmo) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl">
        <div className="text-center p-12 text-slate-500">
          <div className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Access Restricted</div>
          <div className="text-lg font-semibold">You do not have admin access.</div>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl">
        <div className="text-slate-400 text-sm font-semibold">Verifying admin access...</div>
      </div>
    );
  }

  const sections: AdminSection[] = isAdmin ? [
    {
      title: 'Configuration',
      modules: [
        { id: 'vendors', label: 'Vendors', icon: 'fa-building-shield', description: 'Manage vendor catalog, regions, and engagement status.', color: 'blue' },
        { id: 'roles', label: 'Roles & Permissions', icon: 'fa-user-lock', description: 'Map organizational roles to system permission profiles.', color: 'indigo' },
        { id: 'bundles', label: 'Bundles', icon: 'fa-layer-group', description: 'Configure business bundles and application hierarchies.', color: 'slate' },
        { id: 'applications', label: 'Applications', icon: 'fa-cubes', description: 'Onboard enterprise software assets and identity metadata.', color: 'blue' },
        { id: 'taxonomy', label: 'Taxonomy', icon: 'fa-tags', description: 'Define document categories, types, and format options.', color: 'emerald' },
        { id: 'samples', label: 'Samples', icon: 'fa-vial', description: 'Import curated sample data into the database.', color: 'amber' },
      ]
    },
    {
      title: 'Governance',
      modules: [
        { id: 'artifact-rules', label: 'Artifact Rules', icon: 'fa-clipboard-check', description: 'Define required artifacts per milestone for each app.', color: 'amber' },
        { id: 'milestone-templates', label: 'Milestone Plans', icon: 'fa-route', description: 'Standardize M1-M10 sequence and requirements.', color: 'orange' },
        { id: 'wiki-themes', label: 'Wiki Themes', icon: 'fa-palette', description: 'Enterprise CSS templates for documentation rendering.', color: 'purple' },
        { id: 'wiki-templates', label: 'Wiki Templates', icon: 'fa-file-lines', description: 'Reusable Markdown templates for wiki documents.', color: 'indigo' },
        { id: 'diagram-templates', label: 'Diagram Templates', icon: 'fa-vector-square', description: 'Reusable architecture diagram templates.', color: 'blue' },
        { id: 'work-blueprints', label: 'Work Blueprints', icon: 'fa-diagram-project', description: 'Manage delivery blueprint templates.', color: 'slate' },
        { id: 'work-generators', label: 'Work Generators', icon: 'fa-bolt', description: 'Manage event-driven work creation.', color: 'amber' },
      ]
    },
    {
      title: 'Users & Access',
      modules: [
        { id: 'users', label: 'Users', icon: 'fa-users-gear', description: 'Manage accounts, roles, and vendor associations.', color: 'cyan' },
        { id: 'admins', label: 'Admins', icon: 'fa-user-shield', description: 'Manage admin access registry.', color: 'slate' },
        { id: 'bundle-assignments', label: 'Bundle Assignments', icon: 'fa-diagram-project', description: 'Map bundles to CMO, SVP, and engineering owners.', color: 'indigo' },
      ]
    },
    {
      title: 'Integrations',
      modules: [
        { id: 'sharepoint', label: 'SharePoint', icon: 'fa-file-export', description: 'Global base URL patterns and mapping settings.', color: 'sky' },
        { id: 'ai-settings', label: 'AI Settings', icon: 'fa-robot', description: 'Configure Gemini API keys and reasoning parameters.', color: 'violet' },
      ]
    }
  ] : [
    {
      title: 'Architecture',
      modules: [
        { id: 'diagram-templates', label: 'Diagram Templates', icon: 'fa-vector-square', description: 'Reusable architecture diagram templates.', color: 'blue' }
      ]
    }
  ];

  const allModules = sections.flatMap(s => s.modules);

  const renderModuleContent = () => {
    if (activeModule === 'home') {
      return (
        <div className="p-12 animate-fadeIn max-w-7xl mx-auto">
          <header className="mb-16">
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Command Center</h2>
            <p className="text-slate-500 font-medium text-xl mt-3">Configure enterprise parameters and system governance.</p>
          </header>

          <div className="space-y-16">
            {sections.map((section) => (
              <section key={section.title}>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{section.title}</h3>
                  <div className="h-[1px] flex-1 bg-slate-100"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {section.modules.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveModule(m.id)}
                      className="group bg-white border border-slate-200 rounded-[2rem] p-8 text-left transition-all hover:shadow-2xl hover:shadow-slate-200 hover:-translate-y-1 flex flex-col justify-between"
                    >
                      <div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:rotate-6 mb-6 ${
                          m.color === 'blue' ? 'bg-blue-600' : 
                          m.color === 'indigo' ? 'bg-indigo-600' : 
                          m.color === 'emerald' ? 'bg-emerald-600' : 
                          m.color === 'amber' ? 'bg-amber-500' :
                          m.color === 'orange' ? 'bg-orange-500' :
                          m.color === 'purple' ? 'bg-purple-600' :
                          m.color === 'cyan' ? 'bg-cyan-500' :
                          m.color === 'sky' ? 'bg-sky-500' : 'bg-slate-900'
                        } text-white`}>
                          <i className={`fas ${m.icon} text-xl`}></i>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{m.label}</h4>
                        <p className="text-slate-500 text-xs font-medium leading-relaxed mb-6">
                          {m.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Open Module</span>
                        <i className="fas fa-arrow-right"></i>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      );
    }

    switch (activeModule) {
      case 'taxonomy':
        return <AdminTaxonomy />;
      case 'wiki-themes':
        return <AdminThemes />;
      case 'wiki-templates':
        return <AdminWikiTemplates />;
      case 'bundles':
        return <AdminBundles />;
      case 'applications':
        return <AdminApplications />;
      case 'ai-settings':
        return <AdminAiSettings />;
      case 'admins':
        return <AdminAdmins />;
      case 'bundle-assignments':
        return <AdminBundleAssignments />;
      case 'work-blueprints':
        return <AdminWorkBlueprints />;
      case 'work-generators':
        return <AdminWorkGenerators />;
      case 'diagram-templates':
        return <AdminDiagramTemplates />;
      case 'samples':
        return <AdminSamples />;
      default:
        return (
          <div className="flex flex-col h-full bg-white relative">
            <header className="px-12 py-8 border-b border-slate-100 bg-white sticky top-0 z-30 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveModule('home')}
                  className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all"
                  title="Back to Console"
                >
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">System Management</span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
                    {allModules.find(m => m.id === activeModule)?.label}
                  </h3>
                </div>
              </div>
            </header>
            <div className="flex flex-col items-center justify-center min-h-[600px] text-center p-20 text-slate-200">
               <i className="fas fa-screwdriver-wrench text-8xl mb-8 opacity-5"></i>
               <h3 className="text-xl font-black text-slate-300 uppercase tracking-[0.2em]">Module Initialization Pending</h3>
               <p className="text-sm font-bold text-slate-400 mt-2 max-w-md">The {allModules.find(m => m.id === activeModule)?.label} module is being connected to the core database.</p>
               <button onClick={() => setActiveModule('home')} className="mt-8 px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-xl">Back to Home</button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex bg-white min-h-[900px] border border-slate-200 rounded-[3rem] shadow-2xl overflow-hidden animate-fadeIn">
      {/* Sidebar Nav */}
      <aside className="w-80 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/20">
        <div className="p-10 border-b border-slate-100">
           <div className="flex items-center gap-3 mb-1">
             <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white">
               <i className="fas fa-terminal text-sm"></i>
             </div>
             <h2 className="text-xl font-black text-slate-900 tracking-tighter">Console</h2>
           </div>
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DeliveryHub System Admin</p>
        </div>
        
        <nav className="flex-1 p-6 space-y-2 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setActiveModule('home')}
            className={`w-full text-left p-4 rounded-2xl transition-all group ${
              activeModule === 'home' 
              ? 'bg-slate-900 text-white shadow-xl' 
              : 'text-slate-600 hover:bg-slate-100/50'
            }`}
          >
            <div className="flex items-center gap-4">
              <i className={`fas fa-home ${activeModule === 'home' ? 'text-blue-400' : 'text-slate-300'}`}></i>
              <span className="text-xs font-black uppercase tracking-tight">System Home</span>
            </div>
          </button>

          <div className="h-4"></div>
          
          {sections.map(section => (
            <div key={section.title} className="space-y-1 mb-6">
              <p className="px-4 text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">{section.title}</p>
              {section.modules.map(m => (
                <button
                  key={m.id}
                  onClick={() => setActiveModule(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 group ${
                    activeModule === m.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <i className={`fas ${m.icon} text-xs ${activeModule === m.id ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}`}></i>
                  <span className="text-[11px] font-bold tracking-tight">{m.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-12 -mt-12"></div>
           <div className="relative z-10">
             <div className="flex items-center gap-2 mb-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Security Gate Active</span>
             </div>
             <p className="text-[10px] font-medium text-slate-400">All administrative actions are audited by the Security Layer.</p>
           </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-white">
        {renderModuleContent()}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default Admin;
