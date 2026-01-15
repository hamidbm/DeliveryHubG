
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone, ChecklistItem } from '../types';
import AssigneeSearch from './AssigneeSearch';
import CreateWorkItemModal from './CreateWorkItemModal';
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
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  
  const [viewingAttachment, setViewingAttachment] = useState<WorkItemAttachment | null>(null);
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [logHours, setLogHours] = useState<number>(0);
  const [logNote, setLogNote] = useState('');
  const [closureError, setClosureError] = useState<string | null>(null);
  const [automationPrompt, setAutomationPrompt] = useState<string | null>(null);

  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [aiLoading, setAiLoading] = useState(false);

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

      if (itemData.status !== WorkItemStatus.DONE && childData.length > 0) {
         const allDone = childData.every((c: WorkItem) => c.status === WorkItemStatus.DONE);
         if (allDone) setAutomationPrompt(`Efficiency Alert: All ${childData.length} children are complete. Transition ${itemData.key} to DONE?`);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadFullDetails();
    setClosureError(null);
    setAutomationPrompt(null);
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
  }, [linkSearch]);

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    setClosureError(null);
    if (updates.status === WorkItemStatus.DONE && children.length > 0) {
      const incompleteChildren = children.filter(c => c.status !== WorkItemStatus.DONE);
      if (incompleteChildren.length > 0) {
        setClosureError(`Closure Blocked: Resolve ${incompleteChildren.length} active child artifacts first.`);
        return;
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

  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'CREATED': return 'fa-sparkles text-amber-500';
      case 'CHANGED_STATUS': return 'fa-arrow-right-arrow-left text-blue-500';
      case 'IMPEDIMENT_RAISED': return 'fa-flag text-red-600';
      case 'IMPEDIMENT_CLEARED': return 'fa-flag-checkered text-emerald-500';
      case 'WORK_LOGGED': return 'fa-stopwatch text-indigo-500';
      case 'AI_REFINEMENT_COMMITTED': return 'fa-robot text-purple-500';
      case 'CHECKLIST_UPDATED': return 'fa-list-check text-slate-500';
      default: return 'fa-pen-nib text-slate-400';
    }
  };

  const logWork = async () => {
    if (logHours <= 0) return;
    await handleUpdateItem({ timeLogged: (item.timeLogged || 0) + logHours });
    setIsLoggingWork(false);
    setLogHours(0);
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: newChecklistItem.trim(),
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    await handleUpdateItem({ checklists: [...(item.checklists || []), newItem] });
    setNewChecklistItem('');
  };

  const toggleChecklistItem = async (id: string) => {
    const next = (item.checklists || []).map(c => c.id === id ? { ...c, isCompleted: !c.isCompleted } : c);
    await handleUpdateItem({ checklists: next });
  };

  const removeChecklistItem = async (id: string) => {
    const next = (item.checklists || []).filter(c => c.id !== id);
    await handleUpdateItem({ checklists: next });
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const attachments = [...(item.attachments || []), { name: file.name, size: file.size, type: file.type, url: base64, uploadedBy: 'Current User', createdAt: new Date().toISOString() }];
      await handleUpdateItem({ attachments });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const addLink = async (target: WorkItem) => {
    const links = [...(item.links || []), { type: linkType, targetId: (target._id || target.id) as string, targetKey: target.key, targetTitle: target.title }];
    await handleUpdateItem({ links });
    setIsLinking(false);
    setLinkSearch('');
    setLinkResults([]);
  };

  const isWatching = item.watchers?.includes('Current User');
  const renderedAiPlan = aiPlan ? DOMPurify.sanitize(marked.parse(aiPlan) as string) : null;
  const completedCheckItems = (item.checklists || []).filter(c => c.isCompleted).length;
  const checklistProgress = item.checklists?.length ? Math.round((completedCheckItems / item.checklists.length) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100"><i className="fas fa-arrow-left"></i></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
              {item.isFlagged && <span className="animate-pulse text-red-600"><i className="fas fa-flag text-[10px]"></i></span>}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight truncate">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
           <button onClick={() => handleUpdateItem({ isFlagged: !item.isFlagged })} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${item.isFlagged ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-red-400'}`} title="Impediment"><i className="fas fa-flag"></i></button>
           <button onClick={() => handleUpdateItem({ watchers: isWatching ? item.watchers?.filter(w => w !== 'Current User') : [...(item.watchers || []), 'Current User'] })} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isWatching ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-inner' : 'bg-white border-slate-200 text-slate-300'}`}><i className="fas fa-eye"></i></button>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.type === WorkItemType.EPIC ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{item.type}</span>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
          { id: 'checklist', icon: 'fa-check-square', label: `DoD Checklist (${completedCheckItems}/${item.checklists?.length || 0})` },
          { id: 'ai', icon: 'fa-wand-magic-sparkles', label: 'AI Co-pilot' },
          { id: 'comments', icon: 'fa-comments', label: 'Comments' },
          { id: 'links', icon: 'fa-link', label: 'Links' },
          { id: 'attachments', icon: 'fa-paperclip', label: 'Artifacts' },
          { id: 'activity', icon: 'fa-history', label: 'Audit Trail' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FAFAFA]">
        {closureError && (
          <div className="mx-10 mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 animate-fadeIn shadow-sm">
             <i className="fas fa-shield-halved text-xl"></i>
             <div className="flex-1"><p className="text-xs font-black uppercase tracking-widest">Governance Rule Violation</p><p className="text-xs font-medium">{closureError}</p></div>
             <button onClick={() => setClosureError(null)} className="w-8 h-8 rounded-full hover:bg-red-100 flex items-center justify-center"><i className="fas fa-times"></i></button>
          </div>
        )}

        {automationPrompt && (
          <div className="mx-10 mt-8 p-6 bg-blue-600 text-white rounded-[2rem] flex items-center justify-between shadow-xl animate-fadeIn ring-4 ring-blue-500/10">
             <div className="flex items-center gap-4">
                <i className="fas fa-robot text-2xl animate-bounce"></i>
                <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Logic Hub Assistant</p><p className="text-sm font-bold">{automationPrompt}</p></div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setAutomationPrompt(null)} className="px-4 py-2 text-[9px] font-black uppercase hover:bg-white/10 rounded-xl transition-all">Ignore</button>
                <button onClick={() => { handleUpdateItem({ status: WorkItemStatus.DONE }); setAutomationPrompt(null); }} className="px-6 py-2 bg-white text-blue-600 text-[9px] font-black uppercase rounded-xl shadow-lg active:scale-95 transition-all">Auto-Complete</button>
             </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-6">
                  <button onClick={() => setIsLoggingWork(true)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2"><i className="fas fa-clock"></i> Log Work</button>
               </div>
               <button onClick={() => setIsCreatingSub(true)} className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2"><i className="fas fa-plus"></i> Spawn {item.type === WorkItemType.EPIC ? 'FEATURE' : 'STORY'}</button>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <DetailField label="Current Status">
                    <select value={item.status} onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                      {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </DetailField>
                <DetailField label="Urgency">
                    <select value={item.priority} onChange={(e) => handleUpdateItem({ priority: e.target.value as any })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none">
                      <option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                    </select>
                </DetailField>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <DetailField label="Assigned Personnel">
                    <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
                </DetailField>
                <DetailField label="Estimate (Pts)"><input type="number" value={item.storyPoints || 0} onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" /></DetailField>
                <DetailField label="Effort Logged"><div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700">{item.timeLogged || 0} hrs</div></DetailField>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="p-10 space-y-8 animate-fadeIn">
            <header className="flex justify-between items-end mb-4">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Definition of Done (DoD)</h4>
                <p className="text-sm font-bold text-slate-800 mt-1">Verify all quality gates before closure.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-blue-600 uppercase">{checklistProgress}% Verified</span>
                <div className="w-32 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${checklistProgress}%` }} /></div>
              </div>
            </header>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
               {(item.checklists || []).map(c => (
                 <div key={c.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/50 transition-colors group">
                    <button onClick={() => toggleChecklistItem(c.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${c.isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                       {c.isCompleted && <i className="fas fa-check text-[10px]"></i>}
                    </button>
                    <span className={`flex-1 text-sm font-medium transition-all ${c.isCompleted ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'}`}>{c.label}</span>
                    <button onClick={() => removeChecklistItem(c.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-times text-xs"></i></button>
                 </div>
               ))}
               <div className="p-4 bg-slate-50/30 flex items-center gap-3">
                  <input autoFocus value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()} placeholder="Add quality gate..." className="flex-1 bg-transparent text-sm font-medium outline-none border-none p-2" />
                  <button onClick={handleAddChecklistItem} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-blue-600 shadow-sm hover:shadow-md transition-all flex items-center justify-center"><i className="fas fa-plus text-xs"></i></button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-6 animate-fadeIn bg-white/50">
             <header className="flex justify-between items-center mb-10 px-2">
                <div>
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Logic Trace</h4>
                   <p className="text-sm font-bold text-slate-800 mt-1">Full immutable audit history for this artifact.</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                   <i className="fas fa-timeline"></i>
                </div>
             </header>

             <div className="relative pl-10 space-y-12">
                <div className="absolute left-[15.5px] top-6 bottom-6 w-[2px] bg-slate-100"></div>
                {(item.activity || []).slice().reverse().map((act, idx) => (
                  <div key={idx} className="relative group/act">
                     <div className={`absolute -left-[39.5px] w-10 h-10 rounded-2xl bg-white border border-slate-100 z-10 flex items-center justify-center shadow-sm transition-all group-hover/act:border-blue-400 group-hover/act:shadow-lg group-hover/act:shadow-blue-500/10`}>
                        <i className={`fas ${getActivityIcon(act.action)} text-[12px]`}></i>
                     </div>
                     <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3 transition-all hover:border-slate-200 hover:shadow-md">
                        <div className="flex items-center gap-3">
                           <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(act.user)}&background=random&size=24`} className="w-6 h-6 rounded-lg shadow-sm" />
                           <span className="text-[11px] font-black text-slate-900 tracking-tight">{act.user}</span>
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest ml-auto">{getRelativeTime(act.createdAt)}</span>
                        </div>
                        <div className="pl-1">
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{act.action.replace(/_/g, ' ')}</span>
                              {act.field && <span className="text-[10px] text-slate-300 font-bold">on {act.field}</span>}
                           </div>
                           {(act.from !== undefined || act.to !== undefined) && (
                             <div className="mt-3 flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-50">
                                {act.from && <span className="text-[10px] text-slate-400 line-through truncate max-w-[120px]">{JSON.stringify(act.from)}</span>}
                                {act.from && <i className="fas fa-arrow-right text-[8px] text-slate-300"></i>}
                                <span className="text-[10px] font-bold text-blue-600 truncate">{JSON.stringify(act.to)}</span>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="p-10 space-y-6 animate-fadeIn">
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Artifacts</h4>
               <label className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all cursor-pointer">
                  {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-upload"></i>} Upload File
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
               </label>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(item.attachments || []).map((file, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all">
                     <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                        <i className={`fas ${file.type.includes('image') ? 'fa-file-image text-blue-400' : 'fa-file-alt text-slate-400'} text-xl`}></i>
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">{(file.size / 1024).toFixed(1)} KB • {file.uploadedBy}</p>
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => setViewingAttachment(file)}
                          className="w-8 h-8 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-600 transition-all flex items-center justify-center"
                          title="Preview Content"
                        >
                          <i className="fas fa-eye text-xs"></i>
                        </button>
                        <a href={file.url} download={file.name} className="w-8 h-8 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-600 transition-all flex items-center justify-center" title="Download Source">
                           <i className="fas fa-download text-xs"></i>
                        </a>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* ... Rest of the tabs (ai, comments, links) ... */}
      </div>

      {/* Artifact Previewer Overlay */}
      {viewingAttachment && (
        <div className="fixed inset-0 z-[500] bg-slate-950/95 backdrop-blur-2xl flex flex-col animate-fadeIn">
          <header className="px-10 py-6 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-6">
               <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400">
                  <i className={`fas ${viewingAttachment.type.includes('image') ? 'fa-file-image' : 'fa-file-pdf'} text-xl`}></i>
               </div>
               <div>
                  <h3 className="text-white font-black text-xl tracking-tight">{viewingAttachment.name}</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    {(viewingAttachment.size / 1024).toFixed(1)} KB • Uploaded by {viewingAttachment.uploadedBy}
                  </p>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <a 
                href={viewingAttachment.url} 
                download={viewingAttachment.name} 
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
               >
                 <i className="fas fa-download mr-2"></i> Download
               </a>
               <button 
                onClick={() => setViewingAttachment(null)}
                className="w-12 h-12 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center text-xl"
               >
                 <i className="fas fa-times"></i>
               </button>
            </div>
          </header>
          <main className="flex-1 p-10 flex items-center justify-center overflow-hidden">
             <div className="w-full h-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-white/20">
                {viewingAttachment.type.includes('image') ? (
                  <img src={viewingAttachment.url} alt={viewingAttachment.name} className="w-full h-full object-contain" />
                ) : viewingAttachment.type.includes('pdf') || viewingAttachment.type.includes('text') ? (
                  <iframe src={viewingAttachment.url} className="w-full h-full border-none" title="Artifact Viewer" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                    <i className="fas fa-file-circle-question text-slate-200 text-8xl mb-8"></i>
                    <h4 className="text-2xl font-black text-slate-800 uppercase italic">Preview Unavailable</h4>
                    <p className="text-slate-400 font-medium max-w-md mt-4">The browser cannot render this file type natively. Please download the artifact to review its contents locally.</p>
                  </div>
                )}
             </div>
          </main>
        </div>
      )}

      {isLoggingWork && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight italic mb-6">Effort Allocation</h3>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Time Spent (Hours)</label>
                    <input type="number" step="0.5" value={logHours} onChange={(e) => setLogHours(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none" />
                 </div>
                 <button onClick={logWork} className="w-full py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-blue-600 uppercase tracking-widest transition-all">Commit Log</button>
              </div>
           </div>
        </div>
      )}

      {isCreatingSub && (
        <CreateWorkItemModal 
          bundles={bundles} applications={applications} initialBundleId={item.bundleId} initialAppId={item.applicationId || ''} initialParentId={item._id || item.id} onClose={() => setIsCreatingSub(false)}
          onSuccess={() => { setIsCreatingSub(false); loadFullDetails(); onUpdate(); }}
        />
      )}
    </div>
  );
};

const DetailField = ({ label, children }: any) => (
  <div className="space-y-2">
     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
     {children}
  </div>
);

export default WorkItemDetails;
