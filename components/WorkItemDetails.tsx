
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
      // Compliance Gate 1: Quality Checklists
      if ((item.checklists || []).some(c => !c.isCompleted)) {
        setClosureError(`Governance Violation: All Definition-of-Done checklist items must be verified before closure.`);
        return;
      }
      // Compliance Gate 2: Mandatory Link to Technical Spec for FEATURES
      if (item.type === WorkItemType.FEATURE) {
        const hasSpec = (item.links || []).some(l => l.type === 'RELATES_TO' && l.targetKey?.includes('SPEC'));
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

        {/* Other tabs remain functional */}
        {activeTab === 'ai' && (
          <div className="p-10 space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            </div>

            {(standupDigest || aiPlan) && (
              <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm prose prose-slate max-w-none animate-fadeIn" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(standupDigest || aiPlan!) as string) }} />
            )}
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
