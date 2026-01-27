import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'GEMINI', name: 'Google Gemini', icon: 'fa-robot', keyField: 'geminiKey', description: 'Native multi-modal architecture engine.' },
  { id: 'OPENAI', name: 'OpenAI (GPT-4)', icon: 'fa-bolt', keyField: 'openaiKey', description: 'Advanced logic for HCL parsing and diagrams.' },
  { id: 'ANTHROPIC', name: 'Anthropic (Claude)', icon: 'fa-brain', keyField: 'anthropicKey', description: 'Optimized for massive context architecture reviews.' },
  { id: 'HUGGINGFACE', name: 'Hugging Face', icon: 'fa-face-smile', keyField: 'huggingfaceKey', description: 'Open-source inference for privacy-first tasks.' },
  { id: 'COHERE', name: 'Cohere', icon: 'fa-shapes', keyField: 'cohereKey', description: 'Specialized enterprise classification & RAG.' }
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
          <p className="text-slate-500 font-medium text-lg">Manage multi-LLM providers and system-wide reasoning defaults.</p>
        </div>
        {hasPlatformKey !== null && (
          <div className={`px-6 py-3 rounded-2xl border flex items-center gap-3 transition-all ${
            hasPlatformKey ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
          }`}>
             <i className={`fas ${hasPlatformKey ? 'fa-circle-check' : 'fa-triangle-exclamation'}`}></i>
             <span className="text-[10px] font-black uppercase tracking-widest">
               {hasPlatformKey ? 'Gemini Bridge Active' : 'Bridge Required'}
             </span>
             <button onClick={handleRefreshKey} className="ml-4 px-3 py-1 bg-white rounded-lg border border-current text-[9px] font-black hover:bg-slate-50 transition-colors uppercase">
                {hasPlatformKey ? 'Switch' : 'Authorize'}
             </button>
          </div>
        )}
      </header>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-server"></i></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Provider Registry & Credentials</h4>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {PROVIDERS.map(p => (
            <div 
              key={p.id} 
              className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row md:items-center gap-8 ${
                settings.ai.defaultProvider === p.id 
                ? 'bg-blue-50/50 border-blue-500 shadow-xl shadow-blue-500/5' 
                : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex items-center gap-6 shrink-0 md:w-64">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-colors ${
                  settings.ai.defaultProvider === p.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                }`}>
                  <i className={`fas ${p.icon}`}></i>
                </div>
                <div>
                  <h5 className="text-lg font-black text-slate-800">{p.name}</h5>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">{p.id === 'GEMINI' ? 'Platform Bridge' : 'External Endpoint'}</p>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                {p.id === 'GEMINI' ? (
                  <div className="px-6 py-3 bg-slate-100/50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 italic">
                    Gemini Key is managed via the Platform Authorization bridge above.
                  </div>
                ) : (
                  <div className="relative group">
                    <input 
                      type="password"
                      placeholder={`${p.name} API Key (Optional if set in Env)`}
                      value={settings.ai[p.keyField] || ''}
                      onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, [p.keyField]: e.target.value } })}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fas fa-key text-[10px] text-slate-300"></i>
                    </div>
                  </div>
                )}
                <p className="text-[10px] font-medium text-slate-400 pl-2">{p.description}</p>
              </div>

              <div className="shrink-0 flex items-center gap-4">
                <button 
                  onClick={() => handleSave({ ...settings, ai: { ...settings.ai, defaultProvider: p.id } })}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    settings.ai.defaultProvider === p.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {settings.ai.defaultProvider === p.id ? 'Active Default' : 'Mark Default'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
               <h4 className="text-2xl font-black tracking-tight mb-4 italic">Security Awareness</h4>
               <p className="text-slate-400 text-sm font-medium leading-relaxed">
                 For enterprise security, it is recommended to set <strong>OPENAI_API_KEY</strong> as a system environment variable. Keys provided in this registry are stored in the database and should only be used in internal, non-public environments.
               </p>
               <div className="flex gap-4 mt-8">
                  <button onClick={() => handleSave(settings)} className="px-8 py-3 bg-white text-slate-900 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95">Commit Registry Keys</button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="px-8 py-3 bg-white/10 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-white/20 transition-all">Billing Docs</a>
               </div>
            </div>
            <div className="hidden lg:block bg-black/40 border border-white/5 rounded-[2rem] p-8 font-mono text-[11px] text-blue-400 space-y-2">
               <p># Security Best Practice:</p>
               <p className="text-white">docker run -e OPENAI_API_KEY=$KEY nexus-portal</p>
               <p className="text-slate-500 mt-4">// Active Default Provider:</p>
               <p className="text-emerald-400">"{settings.ai.defaultProvider}"</p>
            </div>
         </div>
      </section>

      {saving && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 px-10 py-4 bg-slate-900 text-white rounded-full shadow-2xl animate-slideUp flex items-center gap-4 border border-white/10 z-[300]">
           <i className="fas fa-circle-notch fa-spin"></i>
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Registry Preferences</span>
        </div>
      )}
    </div>
  );
};

export default AdminAiSettings;
