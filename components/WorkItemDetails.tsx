
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone, ChecklistItem } from '../types';
import AssigneeSearch from './AssigneeSearch';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface WorkItemDetailsProps {
  item: WorkItem;
  bundles: Bundle[];
  applications: Application[];
  onUpdate: () => void;
  onClose: () => void;
}

const WorkItemDetails: React.FC<WorkItemDetailsProps> = ({ item: initialItem, bundles, applications, onUpdate, onClose }) => {
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [children, setChildren] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai'>('details');
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [viewingAttachment, setViewingAttachment] = useState<WorkItemAttachment | null>(null);
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [logHours, setLogHours] = useState<number>(0);
  const [closureError, setClosureError] = useState<string | null>(null);

  const [activeCollaborators, setActiveCollaborators] = useState<string[]>(['Alex Architect', 'Sarah PM']);
  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [rebalanceSuggestion, setRebalanceSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [standupDigest, setStandupDigest] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');
  const [linkResults, setLinkResults] = useState<WorkItem[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFullDetails = async () => {
    try {
      const [itemRes, childRes, msRes] = await Promise.all([
        fetch(`/api/work-items/${initialItem._id || initialItem.id}`),
        fetch(`/api/work-items?parentId=${initialItem._id || initialItem.id}`),
        fetch(`/api/milestones`)
      ]);
      const itemData = await itemRes.json();
      setItem(itemData);
      const childData = await childRes.json();
      setChildren(childData);
      setMilestones(await msRes.json());
      if (itemData.aiWorkPlan) setAiPlan(itemData.aiWorkPlan);
    } catch (err) { console.error("Sync Error:", err); }
  };

  useEffect(() => {
    loadFullDetails();
    setClosureError(null);
    setStandupDigest(null);
    setRebalanceSuggestion(null);
  }, [initialItem]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewingAttachment(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (linkSearch.length < 2) { setLinkResults([]); return; }
    const timer = setTimeout(async () => {
      setLinkLoading(true);
      try {
        const res = await fetch(`/api/work-items?q=${encodeURIComponent(linkSearch)}`);
        const data = await res.json();
        setLinkResults(data.filter((i: WorkItem) => (i._id || i.id) !== (item._id || item.id)));
      } finally { setLinkLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [linkSearch, item._id, item.id]);

  const calculateHealth = () => {
    let score = 100;
    const deductions = [];
    if (item.isFlagged) { score -= 30; deductions.push("Active Impediment (-30)"); }
    if (item.status === WorkItemStatus.BLOCKED) { score -= 20; deductions.push("Workflow Blocked (-20)"); }
    const pendingCheck = (item.checklists || []).filter(c => !c.isCompleted).length;
    if (pendingCheck > 0) { score -= (pendingCheck * 5); deductions.push(`Unfinished DoD Items (-${pendingCheck * 5})`); }
    const blockers = (item.links || []).filter(l => l.type === 'IS_BLOCKED_BY').length;
    if (blockers > 0) { score -= (blockers * 15); deductions.push(`External Blockers (-${blockers * 15})`); }
    return { score: Math.max(0, score), deductions };
  };

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    setClosureError(null);
    if (updates.status === WorkItemStatus.DONE) {
      if ((item.checklists || []).some(c => !c.isCompleted)) {
        setClosureError(`Governance Violation: All Definition-of-Done checklist items must be verified before closure.`);
        return;
      }
      if (item.type === WorkItemType.FEATURE) {
        const hasSpec = (item.links || []).some(l => l.type === 'RELATES_TO' && (l.targetKey?.includes('SPEC') || l.targetTitle?.toLowerCase().includes('spec')));
        if (!hasSpec) {
          setClosureError(`Compliance Error: Feature artifacts must link to a verified Technical Specification blueprint.`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await loadFullDetails();
        onUpdate();
      }
    } finally { setSaving(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const attachments = [...(item.attachments || []), { 
        name: file.name, size: file.size, type: file.type, url: base64, uploadedBy: 'Current User', createdAt: new Date().toISOString() 
      }];
      await handleUpdateItem({ attachments });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleAiRefinement = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/refine-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id || item.id })
      });
      const data = await res.json();
      setAiPlan(data.plan);
    } finally { setAiLoading(false); }
  };

  const handleLoadRebalance = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-reassignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id || item.id })
      });
      const data = await res.json();
      setRebalanceSuggestion(data.suggestion);
    } finally { setAiLoading(false); }
  };

  const handleGenerateStandupDigest = async () => {
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/ai/standup-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id || item.id })
      });
      const data = await res.json();
      setStandupDigest(data.digest);
    } finally { setIsSummarizing(false); }
  };

  const addLink = async (target: WorkItem) => {
    const links = [...(item.links || []), { type: linkType, targetId: (target._id || target.id) as string, targetKey: target.key, targetTitle: target.title }];
    await handleUpdateItem({ links });
    setIsLinking(false);
    setLinkSearch('');
  };

  const getRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'Recently' : d.toLocaleDateString();
  };

  const health = calculateHealth();
  const downstreamImpact = (item.links || []).filter(l => l.type === 'BLOCKS').length;
  const isHighImpact = downstreamImpact >= 3;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100 transition-all"><i className="fas fa-arrow-left"></i></button>
          
          <div className="relative shrink-0 flex items-center justify-center group/health">
             <svg className="w-14 h-14 -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={150.796} strokeDashoffset={150.796 * (1 - health.score / 100)} className={`transition-all duration-1000 ${health.score > 80 ? 'text-emerald-500' : health.score > 50 ? 'text-amber-500' : 'text-red-500'}`} />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-[10px] font-black text-slate-700">{health.score}</span>
                <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">AHI</span>
             </div>
             <div className="absolute top-full left-0 mt-2 bg-slate-900 text-white p-3 rounded-xl opacity-0 group-hover/health:opacity-100 transition-opacity z-[100] whitespace-nowrap shadow-2xl border border-white/10 pointer-events-none">
                <p className="text-[9px] font-black uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Artifact Health Breakdown</p>
                {health.deductions.length > 0 ? (
                  health.deductions.map((d, idx) => <p key={idx} className="text-[8px] text-slate-300 flex items-center gap-2"><i className="fas fa-minus text-red-400 scale-75"></i> {d}</p>)
                ) : <p className="text-[8px] text-emerald-400">Registry integrity verified. No risks detected.</p>}
             </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
              {item.isFlagged && <span className="animate-pulse text-red-600"><i className="fas fa-flag text-[10px]"></i></span>}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight truncate leading-tight">{item.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
           <div className="flex items-center -space-x-2">
              {activeCollaborators.map((name, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm relative group/presence">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`} alt={name} />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-[ping_2s_ease-in-out_infinite]"></div>
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover/presence:opacity-100 whitespace-nowrap z-50 shadow-xl border border-white/10 font-black uppercase tracking-widest">{name} is reviewing</div>
                </div>
              ))}
           </div>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <div className="flex items-center gap-2">
              <button onClick={() => handleUpdateItem({ isFlagged: !item.isFlagged })} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${item.isFlagged ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-red-400'}`}><i className="fas fa-flag"></i></button>
              <button onClick={() => handleUpdateItem({ watchers: (item.watchers || []).includes('User') ? [] : ['User'] })} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${(item.watchers || []).length ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-inner' : 'bg-white border-slate-200 text-slate-300'}`}><i className="fas fa-eye"></i></button>
           </div>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
          { id: 'checklist', icon: 'fa-check-square', label: `DoD Checklist` },
          { id: 'ai', icon: 'fa-wand-magic-sparkles', label: 'AI Co-pilot' },
          { id: 'comments', icon: 'fa-comments', label: 'Comments' },
          { id: 'links', icon: 'fa-link', label: `Links ${downstreamImpact > 0 ? `(${downstreamImpact})` : ''}`, alert: isHighImpact },
          { id: 'attachments', icon: 'fa-paperclip', label: 'Artifacts' },
          { id: 'activity', icon: 'fa-history', label: 'Audit Trail' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 relative ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
            {tab.alert && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FAFAFA]">
        {closureError && (
          <div className="mx-10 mt-8 p-6 bg-red-50 border-2 border-red-100 rounded-[2.5rem] flex items-center gap-6 text-red-600 animate-fadeIn shadow-2xl shadow-red-500/10">
             <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-xl shrink-0"><i className="fas fa-shield-halved"></i></div>
             <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Governance Violation Detected</p>
                <p className="text-sm font-bold leading-relaxed">{closureError}</p>
             </div>
             <button onClick={() => setClosureError(null)} className="w-10 h-10 rounded-xl hover:bg-red-100 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="grid grid-cols-2 gap-10">
                <DetailField label="Workflow Phase">
                    <select value={item.status} onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })} className={`w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none transition-all ${item.status === WorkItemStatus.DONE ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </DetailField>
                <DetailField label="Execution Priority">
                    <select value={item.priority} onChange={(e) => handleUpdateItem({ priority: e.target.value as any })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </DetailField>
              </div>
              <div className="grid grid-cols-3 gap-10">
                <DetailField label="Lead Assignee">
                    <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
                </DetailField>
                <DetailField label="Estimate (Pts)"><input type="number" value={item.storyPoints || 0} onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none" /></DetailField>
                <DetailField label="Effort Logged">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black text-slate-700">{item.timeLogged || 0} hrs</div>
                    <button onClick={() => setIsLoggingWork(true)} className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-xl active:scale-95 transition-all"><i className="fas fa-plus"></i></button>
                  </div>
                </DetailField>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="p-10 space-y-8 animate-fadeIn">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Artifact Quality Gates (DoD)</h4>
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
               {(item.checklists || []).map(c => (
                 <div key={c.id} className="flex items-center gap-5 p-6 group hover:bg-slate-50/50 transition-colors">
                    <button onClick={() => {
                       const next = item.checklists?.map(x => x.id === c.id ? {...x, isCompleted: !x.isCompleted} : x);
                       handleUpdateItem({ checklists: next });
                    }} className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${c.isCompleted ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'border-slate-200 bg-white'}`}>
                       {c.isCompleted && <i className="fas fa-check text-xs"></i>}
                    </button>
                    <span className={`flex-1 text-sm font-black transition-all ${c.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{c.label}</span>
                 </div>
               ))}
               <div className="p-5 bg-slate-50/30 flex items-center gap-4">
                  <input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (async () => {
                     if (!newChecklistItem.trim()) return;
                     const newItem = { id: Math.random().toString(), label: newChecklistItem, isCompleted: false, createdAt: new Date().toISOString() };
                     await handleUpdateItem({ checklists: [...(item.checklists || []), newItem] });
                     setNewChecklistItem('');
                  })()} placeholder="Propose new quality gate..." className="flex-1 bg-transparent text-sm font-bold outline-none border-none px-4" />
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-10 space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i className="fas fa-wand-magic-sparkles"></i></div>
                     <h4 className="font-black text-slate-800 uppercase tracking-tight">Scope Refiner</h4>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">Analyze requirements into structured implementation steps and test cases.</p>
                  <button onClick={handleAiRefinement} disabled={aiLoading} className="w-full py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50">
                    {aiLoading ? <i className="fas fa-sparkles fa-spin"></i> : 'Execute Analysis'}
                  </button>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-inner"><i className="fas fa-robot"></i></div>
                     <h4 className="font-black text-slate-800 uppercase tracking-tight">Standup Synthesizer</h4>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">Synthesize active audit logs into concise status bullets for stakeholders.</p>
                  <button onClick={handleGenerateStandupDigest} disabled={isSummarizing} className="w-full py-4 bg-blue-600 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                    {isSummarizing ? <i className="fas fa-circle-notch fa-spin"></i> : 'Generate Standup Digest'}
                  </button>
               </div>

               <div className={`p-8 rounded-[2.5rem] border shadow-sm space-y-6 transition-all ${item.storyPoints && item.storyPoints > 8 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${item.storyPoints && item.storyPoints > 8 ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-400'}`}><i className="fas fa-scale-balanced"></i></div>
                     <h4 className="font-black text-slate-800 uppercase tracking-tight">Adaptive Balancing</h4>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">Identify under-utilized peers for artifact hand-off based on context overlap.</p>
                  <button onClick={handleLoadRebalance} disabled={aiLoading || !item.storyPoints} className={`w-full py-4 text-[10px] font-black rounded-2xl uppercase tracking-widest transition-all ${item.storyPoints && item.storyPoints > 8 ? 'bg-slate-900 text-white hover:bg-amber-600 shadow-xl' : 'bg-slate-100 text-slate-400'}`}>
                    {aiLoading ? <i className="fas fa-sync fa-spin"></i> : 'Run Balance Protocol'}
                  </button>
               </div>
            </div>

            {(standupDigest || aiPlan || rebalanceSuggestion) && (
              <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm prose prose-slate max-w-none animate-fadeIn" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(standupDigest || aiPlan || rebalanceSuggestion!) as string) }} />
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Collaboration Thread</h4>
            <div className="space-y-6">
               {(item.comments || []).map((c, i) => (
                 <div key={i} className="flex gap-6 group">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&size=48`} className="w-12 h-12 rounded-2xl shadow-sm border-2 border-white" />
                    <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                       <div className="flex justify-between items-center mb-4">
                          <span className="text-[12px] font-black text-slate-900 tracking-tight">{c.author}</span>
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em]">{getRelativeTime(c.createdAt)}</span>
                       </div>
                       <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.body}</p>
                    </div>
                 </div>
               ))}
               {(item.comments || []).length === 0 && (
                 <div className="py-20 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                    <i className="fas fa-comments text-5xl mb-4 opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">No active discussion protocols</p>
                 </div>
               )}
            </div>
            <div className="pt-8 border-t border-slate-100">
               <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 flex flex-col shadow-inner focus-within:border-blue-400 transition-all">
                 <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Share a status update or technical note..." className="w-full bg-transparent text-sm font-medium outline-none resize-none min-h-[100px] p-2" />
                 <div className="flex justify-end mt-4">
                    <button onClick={async () => {
                       if (!newComment.trim()) return;
                       const comment = { author: 'Current User', body: newComment, createdAt: new Date().toISOString() };
                       await handleUpdateItem({ comments: [...(item.comments || []), comment] });
                       setNewComment('');
                    }} className="px-10 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-blue-700 shadow-xl active:scale-95 transition-all">Post Logic</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <header className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
              {isHighImpact && <div className="absolute top-0 right-0 px-4 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest animate-pulse">Critical Delivery Node</div>}
              <div>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">Topological Relationships</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">This node impacts <span className="text-blue-500">{downstreamImpact}</span> critical dependencies.</p>
              </div>
              <button onClick={() => setIsLinking(true)} className="px-8 py-3.5 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl active:scale-95"><i className="fas fa-plus"></i> Add Link</button>
            </header>
            <div className="grid grid-cols-1 gap-6">
               {(item.links || []).map((link, idx) => (
                 <div key={idx} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between group hover:shadow-2xl transition-all relative overflow-hidden">
                    {link.type === 'BLOCKS' && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>}
                    <div className="flex items-center gap-8">
                       <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border ${
                         link.type === 'BLOCKS' ? 'bg-red-50 text-red-600 border-red-100' : 
                         link.type === 'IS_BLOCKED_BY' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                       }`}>{link.type.replace(/_/g, ' ')}</div>
                       <div>
                          <p className="text-md font-black text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">{link.targetTitle}</p>
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1 block">{link.targetKey}</span>
                       </div>
                    </div>
                    <button onClick={() => handleUpdateItem({ links: item.links?.filter((_, i) => i !== idx) })} className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center"><i className="fas fa-trash text-xs"></i></button>
                 </div>
               ))}
               {(!item.links || item.links.length === 0) && (
                  <div className="py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                     <i className="fas fa-link text-5xl mb-6 opacity-20"></i>
                     <p className="text-[10px] font-black uppercase tracking-widest">No topological links established</p>
                  </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">Delivery Artifacts</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Archived technical exports and registry specifications.</p>
              </div>
              <label className="px-8 py-3.5 bg-slate-900 text-white text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer shadow-xl flex items-center gap-3 active:scale-95">
                 {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-upload"></i>} 
                 {uploading ? 'Archiving...' : 'Upload Artifact'}
                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(item.attachments || []).map((file, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-6 hover:shadow-2xl transition-all group relative overflow-hidden">
                     <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 transition-colors shadow-inner">
                        <i className={`fas ${file.type.includes('image') ? 'fa-file-image text-blue-400' : 'fa-file-alt'} text-3xl`}></i>
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-800 truncate">{file.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{(file.size / 1024).toFixed(1)} KB • {file.uploadedBy}</p>
                     </div>
                     <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => setViewingAttachment(file)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center border border-slate-100 hover:border-blue-200 shadow-sm"><i className="fas fa-eye"></i></button>
                        <a href={file.url} download={file.name} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center border border-slate-100 hover:border-blue-200 shadow-sm"><i className="fas fa-download"></i></a>
                     </div>
                  </div>
                ))}
                {(!item.attachments || item.attachments.length === 0) && (
                  <div className="col-span-full py-32 text-center bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem]">
                     <i className="fas fa-paperclip text-5xl mb-6 text-slate-200"></i>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry empty. Archive artifacts for governance.</p>
                  </div>
                )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-6 animate-fadeIn bg-white/50">
             <header className="flex justify-between items-center mb-12 px-4">
                <div>
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Deployment Audit Trace</h4>
                   <p className="text-lg font-black text-slate-800 mt-1">Immutable record of node execution history.</p>
                </div>
                <div className="w-14 h-14 rounded-[1.5rem] bg-white border border-slate-100 text-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/5"><i className="fas fa-timeline text-xl"></i></div>
             </header>
             <div className="relative pl-12 space-y-12 pb-20">
                <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-slate-100 shadow-inner"></div>
                {(item.activity || []).slice().reverse().map((act, idx) => (
                  <div key={idx} className="relative group/act animate-fadeIn">
                     <div className={`absolute -left-[45px] w-12 h-12 rounded-2xl bg-white border border-slate-100 z-10 flex items-center justify-center shadow-xl transition-all group-hover/act:border-blue-400 group-hover/act:scale-110`}>
                        <i className={`fas fa-history text-[14px] text-slate-400`}></i>
                     </div>
                     <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group/card overflow-hidden">
                        <div className="flex items-center gap-4 mb-4">
                           <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(act.user)}&background=random&size=32`} className="w-8 h-8 rounded-xl shadow-sm border border-white" />
                           <span className="text-[12px] font-black text-slate-900 tracking-tight">{act.user}</span>
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest ml-auto">{getRelativeTime(act.createdAt)}</span>
                        </div>
                        <div className="pl-1">
                           <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{act.action.replace(/_/g, ' ')}</span>
                           {act.field && <span className="text-[10px] text-slate-400 font-bold ml-3 italic">on {act.field}</span>}
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {isLoggingWork && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic mb-8 text-center">Physical Effort Log</h3>
              <div className="space-y-8">
                 <div className="space-y-3 px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hours Expended (Cycle 0.5)</label>
                    <input type="number" step="0.5" value={logHours} onChange={(e) => setLogHours(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-5 text-xl font-black outline-none focus:border-blue-500 transition-all text-center" />
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setIsLoggingWork(false)} className="flex-1 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                    <button onClick={() => { handleUpdateItem({ timeLogged: (item.timeLogged || 0) + logHours }); setIsLoggingWork(false); setLogHours(0); }} className="flex-[2] py-5 bg-slate-900 text-white text-[11px] font-black rounded-2xl hover:bg-blue-600 uppercase tracking-widest transition-all shadow-2xl active:scale-95">Commit Log</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isLinking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-lg p-12 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-3xl font-black text-slate-900 mb-8 tracking-tighter italic">Connect Registry Node</h3>
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-6">
                   <DetailField label="Edge Type">
                     <select value={linkType} onChange={(e) => setLinkType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black outline-none">
                       <option value="RELATES_TO">Relates to</option><option value="BLOCKS">Blocks</option><option value="IS_BLOCKED_BY">Is Blocked By</option><option value="DUPLICATES">Duplicates</option>
                     </select>
                   </DetailField>
                   <DetailField label="Artifact Lookup">
                     <input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search KEY..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-black outline-none" />
                   </DetailField>
                 </div>
                 <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-3 px-1">
                    {linkLoading ? <div className="text-center py-6"><i className="fas fa-circle-notch fa-spin text-blue-500 text-xl"></i></div> : linkResults.map(res => (
                      <button key={res._id} onClick={() => addLink(res)} className="w-full text-left p-5 hover:bg-blue-50 rounded-2xl border border-slate-50 transition-all flex items-center justify-between group hover:shadow-lg">
                        <div className="min-w-0"><p className="text-sm font-black text-slate-800 truncate">{res.title}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{res.key}</p></div>
                        <div className="w-10 h-10 rounded-xl bg-white text-blue-600 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"><i className="fas fa-plus"></i></div>
                      </button>
                    ))}
                 </div>
                 <div className="flex gap-4">
                   <button onClick={() => setIsLinking(false)} className="flex-1 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {viewingAttachment && (
        <div className="fixed inset-0 z-[500] bg-slate-950/95 backdrop-blur-2xl flex flex-col animate-fadeIn">
          <header className="px-12 py-8 flex items-center justify-between border-b border-white/10 shrink-0 bg-black/20">
            <div className="flex items-center gap-8">
               <div className="w-16 h-16 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-2xl"><i className={`fas ${viewingAttachment.type.includes('image') ? 'fa-file-image' : 'fa-file-pdf'} text-2xl`}></i></div>
               <div><h3 className="text-white font-black text-2xl tracking-tighter">{viewingAttachment.name}</h3><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">{(viewingAttachment.size / 1024).toFixed(1)} KB • BY {viewingAttachment.uploadedBy}</p></div>
            </div>
            <button onClick={() => setViewingAttachment(null)} className="w-16 h-16 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center text-2xl shadow-xl active:scale-95"><i className="fas fa-times"></i></button>
          </header>
          <main className="flex-1 p-12 flex items-center justify-center overflow-hidden">
             <div className="w-full h-full max-w-7xl bg-white rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden relative border border-white/20">
                {viewingAttachment.type.includes('image') ? <img src={viewingAttachment.url} className="w-full h-full object-contain" /> : <iframe src={viewingAttachment.url} className="w-full h-full border-none" title="Artifact Viewer" />}
             </div>
          </main>
        </div>
      )}
    </div>
  );
};

const DetailField = ({ label, children }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
     {children}
  </div>
);

export default WorkItemDetails;
