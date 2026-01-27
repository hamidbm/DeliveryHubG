import React, { useState, useEffect, useMemo } from 'react';
import { WikiPage, TaxonomyDocumentType, Application } from '../types';
import { useRouter } from '../App';

type GovTab = 'standards' | 'scorecard' | 'review' | 'intake' | 'adr';

const GovernanceDocuments: React.FC = () => {
  const router = useRouter();
  const [activeGovTab, setActiveGovTab] = useState<GovTab>('standards');
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    const loadGovData = async () => {
      setLoading(true);
      try {
        const [pRes, tRes, aRes] = await Promise.all([
          fetch('/api/wiki'),
          fetch('/api/taxonomy/document-types'),
          fetch('/api/applications')
        ]);
        setPages(await pRes.json());
        setDocTypes(await tRes.json());
        setApplications(await aRes.json());
      } finally {
        setLoading(false);
      }
    };
    loadGovData();
  }, []);

  const govTypes = useMemo(() => {
    return docTypes.filter(t => 
      ['ADR', 'SECURITY_POLICY', 'ARCHITECTURE_STANDARD', 'GOVERNANCE_BLUEPRINT', 'SECURITY_ASSESSMENT'].includes(t.key) ||
      t.name.toLowerCase().includes('governance') || 
      t.name.toLowerCase().includes('security')
    );
  }, [docTypes]);

  const filteredDocs = useMemo(() => {
    // If we are on specific tabs, we override the filter
    if (activeGovTab === 'adr') {
      return pages.filter(p => docTypes.find(t => t._id === p.documentTypeId)?.key === 'ADR');
    }
    
    if (activeFilter === 'ALL') {
      return pages.filter(p => govTypes.some(t => t._id === p.documentTypeId));
    }
    return pages.filter(p => p.documentTypeId === activeFilter);
  }, [pages, activeFilter, govTypes, activeGovTab, docTypes]);

  const navigateToWiki = (page: WikiPage) => {
    router.push(`/?tab=wiki&pageId=${page.slug || page._id || page.id}`);
  };

  const renderStandards = () => (
    <div className="space-y-10">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
              activeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            All Standards
          </button>
          {govTypes.map(type => (
            <button
              key={type._id}
              onClick={() => setActiveFilter(type._id!)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${
                activeFilter === type._id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {type.name}
            </button>
          ))}
        </div>
      </header>

      {filteredDocs.length === 0 ? (
        <div className="py-32 bg-white rounded-[3rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200 border border-slate-100 shadow-inner">
              <i className="fas fa-file-shield text-3xl"></i>
           </div>
           <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Registry Entry Pending</h3>
           <p className="text-slate-400 font-medium max-w-md mt-2">No documents of the selected type have been verified in the Wiki Registry yet.</p>
           <button onClick={() => router.push('/?tab=wiki')} className="mt-8 px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl">Create Compliance Artifact</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredDocs.map(doc => {
            const type = docTypes.find(t => t._id === doc.documentTypeId);
            return (
              <div 
                key={doc._id} 
                onClick={() => navigateToWiki(doc)}
                className="bg-white border border-slate-200 rounded-[3rem] p-1 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group flex overflow-hidden h-52 cursor-pointer"
              >
                <div className="w-1/3 bg-slate-50 flex flex-col items-center justify-center border-r border-slate-100 group-hover:bg-blue-50 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                  <i className={`fas ${type?.icon || 'fa-file-shield'} text-5xl ${doc.status === 'Published' ? 'text-blue-500' : 'text-slate-300'} opacity-30 group-hover:opacity-100 transition-opacity`}></i>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-6 group-hover:text-blue-400 transition-colors">{type?.name || 'Protocol'}</span>
                </div>
                
                <div className="flex-1 p-10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100 shadow-sm">{doc.status || 'DRAFT'}</span>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">v{doc.version || 1.0}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">{doc.title}</h3>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-5">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Effective Date</span>
                        <span className="text-[10px] font-bold text-slate-600">{new Date(doc.updatedAt || '').toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Custodian</span>
                        <span className="text-[10px] font-bold text-slate-600">{doc.author || 'System'}</span>
                      </div>
                    </div>
                    
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95 shadow-lg group-hover:rotate-6">
                      <i className="fas fa-arrow-right text-xs"></i>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderScorecard = () => {
    const mandatoryKeys = ['ADR', 'SECURITY_POLICY', 'SECURITY_ASSESSMENT'];
    const mandatoryTypes = docTypes.filter(t => mandatoryKeys.includes(t.key || ''));

    const appScores = applications.map(app => {
      const appDocs = pages.filter(p => (p.applicationId === app._id || p.applicationId === app.id));
      const presentTypes = mandatoryTypes.filter(t => appDocs.some(p => p.documentTypeId === t._id));
      const score = Math.round((presentTypes.length / mandatoryTypes.length) * 100);
      return { ...app, score, presentTypes };
    });

    const portfolioAvg = appScores.length > 0 ? Math.round(appScores.reduce((sum, a) => sum + a.score, 0) / appScores.length) : 0;

    return (
      <div className="space-y-10 animate-fadeIn">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio Compliance</span>
                <h4 className="text-5xl font-black text-slate-900 tracking-tighter mt-2">{portfolioAvg}%</h4>
              </div>
              <div className="mt-6 flex items-center gap-2">
                 <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${portfolioAvg}%` }}></div>
                 </div>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global</span>
              </div>
           </div>

           <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Mandatory Blueprint Nodes</span>
                <div className="mt-4 flex flex-wrap gap-2">
                  {mandatoryTypes.map(t => (
                    <span key={t._id} className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/5">{t.name}</span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-6 leading-relaxed">
                Score is calculated based on the existence of {mandatoryTypes.length} required artifact types per application.
              </p>
           </div>

           <div className="p-8 bg-blue-50 border border-blue-100 rounded-[2.5rem] shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                 <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Registry Coverage</span>
                    <h4 className="text-5xl font-black text-blue-900 tracking-tighter mt-2">
                      {appScores.filter(a => a.score === 100).length}/{applications.length}
                    </h4>
                 </div>
                 <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                    <i className="fas fa-check-double"></i>
                 </div>
              </div>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-6">Fully Compliant Nodes</p>
           </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm">
           <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                 <tr>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Application Node</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Artifacts Found</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Progress</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {appScores.map(app => (
                   <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${app.score === 100 ? 'bg-emerald-500' : app.score > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}>
                              <i className="fas fa-cube text-xs"></i>
                           </div>
                           <div>
                              <p className="text-sm font-black text-slate-800">{app.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{app.aid}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex flex-wrap gap-1.5">
                            {mandatoryTypes.map(t => {
                               const isPresent = app.presentTypes.some(pt => pt._id === t._id);
                               return (
                                 <span key={t._id} className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                                   isPresent ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-300 border-slate-100'
                                 }`}>
                                   {isPresent ? <i className="fas fa-check mr-1"></i> : <i className="fas fa-clock mr-1"></i>}
                                   {t.key}
                                 </span>
                               );
                            })}
                         </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                           app.score === 100 ? 'bg-emerald-50 text-emerald-600' : 
                           app.score > 0 ? 'bg-blue-50 text-blue-600' : 
                           'bg-red-50 text-red-600'
                         }`}>
                           {app.score === 100 ? 'Verified' : app.score > 0 ? 'Partial' : 'Missing'}
                         </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                         <div className="flex items-center justify-end gap-4">
                            <span className="text-[11px] font-black text-slate-700">{app.score}%</span>
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <div className={`h-full ${app.score === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${app.score}%` }}></div>
                            </div>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Governance Vault</h1>
          <p className="text-slate-400 font-medium text-lg mt-1">Official registry of enterprise standards, security policies, and ADRs.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto no-scrollbar">
          {[
            { id: 'standards', label: 'All Standards', icon: 'fa-book-open' },
            { id: 'scorecard', label: 'Security Scorecard', icon: 'fa-shield-halved' },
            { id: 'review', label: 'Security Review', icon: 'fa-user-shield' },
            { id: 'intake', label: 'Security Intake', icon: 'fa-file-signature' },
            { id: 'adr', label: 'ADR Registry', icon: 'fa-diagram-project' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveGovTab(tab.id as GovTab)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
                activeGovTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className={`fas ${tab.icon} text-[10px]`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-100 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : (
        <div className="animate-fadeIn">
          {activeGovTab === 'standards' && renderStandards()}
          {activeGovTab === 'scorecard' && renderScorecard()}
          {activeGovTab === 'adr' && renderStandards()} {/* Reusing standards view but filtered */}
          {activeGovTab === 'review' && (
             <div className="py-32 text-center text-slate-300">
                <i className="fas fa-user-shield text-5xl mb-6 opacity-20"></i>
                <p className="text-sm font-black uppercase tracking-widest">Security Review Module Pending Implementation</p>
             </div>
          )}
          {activeGovTab === 'intake' && (
             <div className="py-32 text-center text-slate-300">
                <i className="fas fa-file-signature text-5xl mb-6 opacity-20"></i>
                <p className="text-sm font-black uppercase tracking-widest">Security Intake Workflow Pending Implementation</p>
             </div>
          )}
        </div>
      )}

      {/* Governance Scorecard Promo (Static footer banner) */}
      {activeGovTab !== 'scorecard' && (
        <div className="p-12 bg-gradient-to-br from-blue-900 to-indigo-950 rounded-[3.5rem] text-white flex flex-col lg:flex-row items-center justify-between gap-10 relative overflow-hidden shadow-2xl border border-white/5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          
          <div className="relative z-10 text-center lg:text-left space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 border border-blue-400/30 rounded-full">
                <i className="fas fa-shield-check text-xs text-blue-300 animate-pulse"></i>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-100">Compliance Logic Engine</span>
            </div>
            <h4 className="text-3xl font-black tracking-tight leading-tight">Artifact Readiness Scorecard</h4>
            <p className="text-blue-100/70 text-base max-w-xl font-medium leading-relaxed">Nexus automatically audits your application portfolio against the Taxonomy Registry. Verify required ADRs and Security Assessments per milestone.</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center gap-4 shrink-0">
              <button 
                onClick={() => setActiveGovTab('scorecard')}
                className="px-10 py-4 bg-white text-blue-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95"
              >
                View Full Scorecard
              </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovernanceDocuments;
