import React, { useState, useEffect, useMemo } from 'react';
import { WikiPage, TaxonomyDocumentType } from '../types';
import { useRouter } from '../App';

const GovernanceDocuments: React.FC = () => {
  const router = useRouter();
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    const loadGovData = async () => {
      setLoading(true);
      try {
        const [pRes, tRes] = await Promise.all([
          fetch('/api/wiki'),
          fetch('/api/taxonomy/document-types')
        ]);
        const allPages = await pRes.json();
        const allTypes = await tRes.json();
        
        // Filter for documents classified under 'Architecture', 'Security', or 'Governance' categories
        // or specifically tagged as such.
        setPages(allPages);
        setDocTypes(allTypes);
      } finally {
        setLoading(false);
      }
    };
    loadGovData();
  }, []);

  const govTypes = useMemo(() => {
    return docTypes.filter(t => 
      ['ADR', 'SECURITY_POLICY', 'ARCHITECTURE_STANDARD', 'GOVERNANCE_BLUEPRINT'].includes(t.key) ||
      t.name.toLowerCase().includes('governance') || 
      t.name.toLowerCase().includes('security')
    );
  }, [docTypes]);

  const filteredDocs = useMemo(() => {
    if (activeFilter === 'ALL') {
      return pages.filter(p => govTypes.some(t => t._id === p.documentTypeId));
    }
    return pages.filter(p => p.documentTypeId === activeFilter);
  }, [pages, activeFilter, govTypes]);

  const navigateToWiki = (page: WikiPage) => {
    router.push(`/?tab=wiki&pageId=${page.slug || page._id || page.id}`);
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Governance Vault</h1>
          <p className="text-slate-400 font-medium text-lg mt-1">Official registry of enterprise standards, security policies, and ADRs.</p>
        </div>
        
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

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-slate-100 rounded-[3rem] animate-pulse"></div>)}
        </div>
      ) : filteredDocs.length === 0 ? (
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

      {/* Governance Scorecard Promo */}
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
            <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 flex items-center justify-center relative">
               <span className="text-2xl font-black italic">84%</span>
               <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="44" stroke="white" strokeWidth="4" fill="transparent" strokeDasharray="276" strokeDashoffset="44" strokeLinecap="round" />
               </svg>
            </div>
            <button className="px-10 py-4 bg-white text-blue-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95">
              Generate Scorecard
            </button>
         </div>
      </div>
    </div>
  );
};

export default GovernanceDocuments;