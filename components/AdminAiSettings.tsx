
import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'GEMINI', name: 'Google Gemini', icon: 'fa-robot', active: true },
  { id: 'OPENAI', name: 'OpenAI (GPT-4)', icon: 'fa-bolt', active: false, badge: 'ENV REQUIRED' },
  { id: 'ANTHROPIC', name: 'Anthropic (Claude)', icon: 'fa-brain', active: false, badge: 'COMING SOON' },
  { id: 'COHERE', name: 'Cohere', icon: 'fa-shapes', active: false, badge: 'COMING SOON' }
];

const GEMINI_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Highest reasoning, best for code/infra.', type: 'Complex' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fastest response, ideal for summaries.', type: 'Efficient' },
  { id: 'gemini-2.5-pro-preview-09-2024', name: 'Gemini 2.5 Pro', desc: 'Previous stable release.', type: 'Legacy' }
];

const AdminAiSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPlatformKey, setHasPlatformKey] = useState<boolean | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      setSettings(await res.json());
      
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasPlatformKey(selected);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (updatedSettings: any) => {
    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings)
      });
      setSettings(updatedSettings);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasPlatformKey(true);
    }
  };

  if (loading) return <div className="p-10 text-center"><i className="fas fa-circle-notch fa-spin text-blue-600"></i></div>;

  return (
    <div className="p-12 max-w-6xl mx-auto space-y-12 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Intelligence Governance</h2>
          <p className="text-slate-500 font-medium text-lg">Configure LLM providers and reasoning models for the enterprise.</p>
        </div>
        {hasPlatformKey !== null && (
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 transition-all ${
            hasPlatformKey ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
          }`}>
             <i className={`fas ${hasPlatformKey ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
             <span className="text-[10px] font-black uppercase tracking-widest">
               {hasPlatformKey ? 'Platform Key Connected' : 'Authorization Required'}
             </span>
             <button onClick={handleRefreshKey} className="ml-4 px-3 py-1 bg-white rounded-lg border border-current text-[9px] font-black hover:bg-slate-50 transition-colors uppercase">
                {hasPlatformKey ? 'Switch Key' : 'Authorize Now'}
             </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="space-y-8">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-server"></i></div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Provider Registry</h4>
           </div>

           <div className="grid grid-cols-1 gap-4">
              {PROVIDERS.map(p => (
                <div 
                  key={p.id} 
                  className={`p-6 rounded-[2rem] border-2 transition-all flex items-center justify-between group ${
                    settings.ai.defaultProvider === p.id 
                    ? 'bg-blue-50 border-blue-500 shadow-xl shadow-blue-500/5' 
                    : 'bg-white border-slate-100'
                  } ${!p.active ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer hover:border-blue-200'}`}
                  onClick={() => p.active && handleSave({ ...settings, ai: { ...settings.ai, defaultProvider: p.id } })}
                >
                   <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${
                        settings.ai.defaultProvider === p.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                      }`}>
                         <i className={`fas ${p.icon}`}></i>
                      </div>
                      <div>
                         <h5 className="text-lg font-black text-slate-800">{p.name}</h5>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                           {p.id === 'GEMINI' ? 'Platform Bridge Active' : 'Environment Var Required'}
                         </p>
                      </div>
                   </div>
                   {p.badge ? (
                     <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-lg">{p.badge}</span>
                   ) : settings.ai.defaultProvider === p.id && (
                     <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                        <i className="fas fa-check text-xs"></i>
                     </div>
                   )}
                </div>
              ))}
           </div>
        </section>

        <section className="space-y-8">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20"><i className="fas fa-brain"></i></div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Default Engine (Gemini)</h4>
           </div>

           <div className="bg-white border border-slate-200 rounded-[3rem] p-8 space-y-6">
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Select which Gemini series model serves as the primary system-of-truth for HCL parsing and diagram generation.</p>
              
              <div className="space-y-3">
                 {GEMINI_MODELS.map(m => (
                   <button 
                    key={m.id}
                    onClick={() => handleSave({ ...settings, ai: { ...settings.ai, defaultModel: m.id } })}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                      settings.ai.defaultModel === m.id 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xl' 
                      : 'bg-slate-50 border-transparent hover:border-slate-200'
                    }`}
                   >
                      <div className="min-w-0">
                         <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-black">{m.name}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              settings.ai.defaultModel === m.id ? 'bg-white/10 text-white' : 'bg-white text-slate-400 border border-slate-100'
                            }`}>{m.type}</span>
                         </div>
                         <p className={`text-[10px] font-medium truncate ${settings.ai.defaultModel === m.id ? 'text-slate-400' : 'text-slate-500'}`}>{m.desc}</p>
                      </div>
                      {settings.ai.defaultModel === m.id && <i className="fas fa-check-circle text-blue-400"></i>}
                   </button>
                 ))}
              </div>
           </div>

           <div className="p-8 bg-blue-900 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-blue-900/30">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24"></div>
              <div className="relative z-10">
                 <h4 className="text-xl font-black tracking-tight mb-2 italic">Security Notice</h4>
                 <p className="text-blue-200 text-xs font-medium leading-relaxed">
                   Nexus does not store LLM keys. Authorization for Gemini is managed via the <strong>AI Studio Browser Extension</strong> or <strong>Environment Secrets</strong>. External keys (OpenAI/Anthropic) must be set as system environment variables.
                 </p>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="inline-flex items-center gap-2 mt-6 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                    Registry Billing Docs <i className="fas fa-arrow-right scale-75"></i>
                 </a>
              </div>
           </div>
        </section>
      </div>

      {saving && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 bg-slate-900 text-white rounded-full shadow-2xl animate-slideUp flex items-center gap-4 border border-white/10">
           <i className="fas fa-circle-notch fa-spin"></i>
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Registry Preferences</span>
        </div>
      )}
    </div>
  );
};

export default AdminAiSettings;
