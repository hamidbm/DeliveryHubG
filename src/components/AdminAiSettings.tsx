import React, { useState, useEffect } from 'react';

const PROVIDERS = [
  { id: 'GEMINI', name: 'Google Gemini', icon: 'fa-robot', description: 'Native multi-modal architecture engine.' },
  { id: 'OPENAI', name: 'OpenAI (GPT-4)', icon: 'fa-bolt', description: 'Advanced logic for HCL parsing and diagrams.' },
  { id: 'OPEN_ROUTER', name: 'Open Router', icon: 'fa-route', description: 'OpenRouter provider catalog (openrouter.ai). Key is read from OPENROUTER_API_KEY.' },
  { id: 'ANTHROPIC', name: 'Anthropic (Claude)', icon: 'fa-brain', description: 'Optimized for massive context architecture reviews.' },
  { id: 'HUGGINGFACE', name: 'Hugging Face', icon: 'fa-face-smile', description: 'Open-source inference for privacy-first tasks.' },
  { id: 'COHERE', name: 'Cohere', icon: 'fa-shapes', description: 'Specialized enterprise classification & RAG.' }
];

const PROVIDER_MODEL_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  GEMINI: [
    { key: 'geminiFlashModel', label: 'Flash Model', placeholder: 'gemini-3-flash-preview' },
    { key: 'geminiProModel', label: 'Pro Model', placeholder: 'gemini-3-pro-preview' }
  ],
  OPENAI: [
    { key: 'openaiModelDefault', label: 'Default Model', placeholder: 'gpt-5.2' },
    { key: 'openaiModelHigh', label: 'High Reasoning', placeholder: 'gpt-5.2-pro' },
    { key: 'openaiModelFast', label: 'Fast Model', placeholder: 'gpt-5.2-chat-latest' }
  ],
  OPEN_ROUTER: [{ key: 'openRouterModel', label: 'Default Model', placeholder: 'qwen/qwen3-coder' }],
  ANTHROPIC: [{ key: 'anthropicModel', label: 'Default Model', placeholder: 'claude-3-5-sonnet-20240620' }],
  HUGGINGFACE: [{ key: 'huggingfaceModel', label: 'Default Model', placeholder: 'mistralai/Mistral-7B-Instruct-v0.2' }],
  COHERE: [{ key: 'cohereModel', label: 'Default Model', placeholder: 'command-r' }]
};

const TASK_ROUTING_FIELDS = [
  { key: 'wikiSummary', label: 'Wiki Summary' },
  { key: 'wikiImprove', label: 'Wiki Improve' },
  { key: 'wikiExpand', label: 'Wiki Expand' },
  { key: 'wikiDiagram', label: 'Wiki Diagram' },
  { key: 'wikiQa', label: 'Wiki Q&A' },
  { key: 'assetSummary', label: 'Asset Summary' },
  { key: 'assetKeyDecisions', label: 'Asset Key Decisions' },
  { key: 'assetAssumptions', label: 'Asset Assumptions' },
  { key: 'assetQa', label: 'Asset Q&A' },
  { key: 'workPlan', label: 'Work Plan' },
  { key: 'appRationalize', label: 'App Rationalize' },
  { key: 'standupDigest', label: 'Standup Digest' },
  { key: 'suggestReassignment', label: 'Suggest Reassignment' },
  { key: 'operationsIntelligence', label: 'Operations Intelligence' },
  { key: 'portfolioSummary', label: 'Portfolio Summary' },
  { key: 'terraformAnalysis', label: 'Terraform Analysis' },
  { key: 'terraformDiagram', label: 'Terraform Diagram' }
];

const MODEL_KEYS = [
  { id: 'openaiModelDefault', label: 'OpenAI Default' },
  { id: 'openaiModelHigh', label: 'OpenAI High' },
  { id: 'openaiModelFast', label: 'OpenAI Fast' },
  { id: 'openRouterModel', label: 'Open Router Default' },
  { id: 'geminiFlashModel', label: 'Gemini Flash' },
  { id: 'geminiProModel', label: 'Gemini Pro' },
  { id: 'anthropicModel', label: 'Anthropic Default' },
  { id: 'huggingfaceModel', label: 'Hugging Face Default' },
  { id: 'cohereModel', label: 'Cohere Default' }
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
            (() => {
              const providerState = settings.ai.providers?.[p.id] || {};
              const selectedDefault = settings.ai.selectedDefaultProvider || settings.ai.defaultProvider;
              const activeDefault = settings.ai.activeEffectiveDefaultProvider || settings.ai.defaultProvider;
              const isSelectedDefault = selectedDefault === p.id;
              const isActiveDefault = activeDefault === p.id;
              const isToggled = settings.ai.providerToggles?.[p.id] ?? (p.id === 'OPENAI' || p.id === 'GEMINI');
              const hasCredential = Boolean(providerState.credentialPresent);
              const isHealthy = providerState.healthy !== false;
              const hasModel = (() => {
                if (p.id === 'OPENAI') return Boolean(settings.ai.openaiModelDefault || settings.ai.openaiModelHigh || settings.ai.openaiModelFast);
                if (p.id === 'OPEN_ROUTER') return Boolean(settings.ai.openRouterModel);
                if (p.id === 'GEMINI') return Boolean(settings.ai.geminiFlashModel || settings.ai.geminiProModel || settings.ai.flashModel || settings.ai.proModel);
                if (p.id === 'ANTHROPIC') return Boolean(settings.ai.anthropicModel);
                if (p.id === 'HUGGINGFACE') return Boolean(settings.ai.huggingfaceModel);
                if (p.id === 'COHERE') return Boolean(settings.ai.cohereModel);
                return true;
              })();
              const canSelectAsDefault = isToggled && hasCredential && isHealthy && hasModel;
              return (
            <div 
              key={p.id} 
              className={`p-8 rounded-[2.5rem] border-2 transition-all flex flex-col md:flex-row md:items-center gap-8 ${
                isActiveDefault 
                ? 'bg-blue-50/50 border-blue-500 shadow-xl shadow-blue-500/5' 
                : 'bg-white border-slate-100'
              }`}
            >
              <div className="flex items-center gap-6 shrink-0 md:w-64">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner transition-colors ${
                  isActiveDefault ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                }`}>
                  <i className={`fas ${p.icon}`}></i>
                </div>
                <div>
                  <h5 className="text-lg font-black text-slate-800">{p.name}</h5>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">External Endpoint</p>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {hasCredential ? (
                      <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest">Configured</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest">Missing Credentials</span>
                    )}
                    {!isHealthy && (
                      <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 text-[9px] font-black uppercase tracking-widest">Unhealthy</span>
                    )}
                    {!isToggled && (
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-widest">Disabled</span>
                    )}
                    {!hasModel && (
                      <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest">Missing Model</span>
                    )}
                    {isSelectedDefault && (
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-widest">Selected Default</span>
                    )}
                    {isActiveDefault && (
                      <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest">Active</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <div className="px-6 py-3 bg-slate-100/50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-500 italic">
                  Credential source: {providerState.credentialSource === 'platform_bridge' ? 'Platform Bridge' : `Environment variable (${providerState.credentialEnvVar || 'N/A'})`}.
                </div>
                {(PROVIDER_MODEL_FIELDS[p.id] || []).map((field) => (
                  <div key={field.key} className="relative group">
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={settings.ai[field.key] || ''}
                      onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, [field.key]: e.target.value } })}
                      className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700 focus:border-blue-500 outline-none transition-all shadow-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <i className="fas fa-microchip text-[10px] text-slate-300"></i>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mt-2 pl-2">
                      {field.label}
                    </p>
                  </div>
                ))}
                <p className="text-[10px] font-medium text-slate-400 pl-2">{p.description}</p>
              </div>

              <div className="shrink-0 flex items-center gap-4">
                <button 
                  onClick={() => handleSave({ ...settings, ai: { ...settings.ai, selectedDefaultProvider: p.id } })}
                  disabled={!canSelectAsDefault}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isSelectedDefault
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {!canSelectAsDefault ? 'Unavailable' : isSelectedDefault ? 'Selected Default' : 'Mark Default'}
                </button>
              </div>
            </div>
              );
            })()
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-toggle-on"></i></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Provider Toggles</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((p) => (
            <label key={p.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <i className={`fas ${p.icon} text-slate-400`}></i>
                <span className="text-sm font-semibold text-slate-700">{p.name}</span>
              </div>
              <input
                type="checkbox"
                checked={settings.ai.providerToggles?.[p.id] ?? (p.id === 'OPENAI' || p.id === 'GEMINI')}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      providerToggles: { ...(settings.ai.providerToggles || {}), [p.id]: e.target.checked }
                    }
                  })
                }
                className="h-4 w-4"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-route"></i></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Task Routing</h4>
        </div>
        <div className="space-y-4">
          {TASK_ROUTING_FIELDS.map((task) => (
            <div key={task.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border border-slate-100 rounded-2xl p-4">
              <div className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center">{task.label}</div>
              <select
                value={settings.ai.taskRouting?.[task.key]?.provider || '__DEFAULT__'}
                onChange={(e) => {
                  const nextTaskRoute = { ...(settings.ai.taskRouting?.[task.key] || {}) };
                  if (e.target.value === '__DEFAULT__') {
                    delete nextTaskRoute.provider;
                  } else {
                    nextTaskRoute.provider = e.target.value;
                  }
                  setSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      taskRouting: {
                        ...(settings.ai.taskRouting || {}),
                        [task.key]: nextTaskRoute
                      }
                    }
                  });
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="__DEFAULT__">Use Active Default</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={settings.ai.taskRouting?.[task.key]?.model || '__DEFAULT_MODEL__'}
                onChange={(e) => {
                  const nextTaskRoute = { ...(settings.ai.taskRouting?.[task.key] || {}) };
                  if (e.target.value === '__DEFAULT_MODEL__') {
                    delete nextTaskRoute.model;
                  } else {
                    nextTaskRoute.model = e.target.value;
                  }
                  setSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      taskRouting: {
                        ...(settings.ai.taskRouting || {}),
                        [task.key]: nextTaskRoute
                      }
                    }
                  });
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="__DEFAULT_MODEL__">Use Provider Default Model</option>
                {MODEL_KEYS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-hourglass"></i></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Retention (Days)</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'wikiQa', label: 'Wiki Q&A' },
            { key: 'assetQa', label: 'Asset Q&A' },
            { key: 'assetAi', label: 'Asset AI' },
            { key: 'auditLogs', label: 'Audit Logs' }
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 py-4">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">{item.label}</span>
              <input
                type="number"
                min={1}
                value={settings.ai.retentionDays?.[item.key] ?? 30}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ai: {
                      ...settings.ai,
                      retentionDays: { ...(settings.ai.retentionDays || {}), [item.key]: Number(e.target.value || 1) }
                    }
                  })
                }
                className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none text-right"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-gauge-high"></i></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rate Limits</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 py-4">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Requests per User / Hour</span>
            <input
              type="number"
              min={1}
              value={settings.ai.rateLimits?.perUserPerHour ?? 30}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai: {
                    ...settings.ai,
                    rateLimits: { ...(settings.ai.rateLimits || {}), perUserPerHour: Number(e.target.value || 1) }
                  }
                })
              }
              className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none text-right"
            />
          </label>
        </div>
      </section>

      <section className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
         <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
               <h4 className="text-2xl font-black tracking-tight mb-4 italic">Security Awareness</h4>
               <p className="text-slate-400 text-sm font-medium leading-relaxed">
                 API keys are environment-managed only and are not persisted in the database. Configure provider credentials using environment variables such as <strong>OPENAI_API_KEY</strong> and <strong>OPENROUTER_API_KEY</strong>.
               </p>
               <div className="flex gap-4 mt-8">
                  <button onClick={() => handleSave(settings)} className="px-8 py-3 bg-white text-slate-900 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95">Commit Registry Keys</button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="px-8 py-3 bg-white/10 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-white/20 transition-all">Billing Docs</a>
               </div>
            </div>
            <div className="hidden lg:block bg-black/40 border border-white/5 rounded-[2rem] p-8 font-mono text-[11px] text-blue-400 space-y-2">
               <p># Security Best Practice:</p>
               <p className="text-white">docker run -e OPENAI_API_KEY=$KEY -e OPENROUTER_API_KEY=$KEY nexus-portal</p>
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
