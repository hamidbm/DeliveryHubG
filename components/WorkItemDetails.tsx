
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone } from '../types';
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
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai'>('details');
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  
  // Artifact Previewer State
  const [viewingAttachment, setViewingAttachment] = useState<WorkItemAttachment | null>(null);

  // Effort Tracking
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [logHours, setLogHours] = useState<number>(0);
  const [logNote, setLogNote] = useState('');

  // Governance Safety Rail State
  const [closureError, setClosureError] = useState<string | null>(null);

  // AI States
  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessFeedback, setAiSuccessFeedback] = useState(false);

  // Link States
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
      setChildren(await childRes.json());
      setMilestones(await msRes.json());
      if (itemData.aiWorkPlan) setAiPlan(itemData.aiWorkPlan);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadFullDetails();
    setClosureError(null);
  }, [initialItem]);

  // Handle ESC for previewer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingAttachment(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (linkSearch.length < 2) {
      setLinkResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLinkLoading(true);
      try {
        const res = await fetch(`/api/work-items?q=${encodeURIComponent(linkSearch)}`);
        const data = await res.json();
        setLinkResults(data.filter((i: WorkItem) => (i._id || i.id) !== (item._id || item.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLinkLoading(false);
      }
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
        const freshRes = await fetch(`/api/work-items/${item._id || item.id}`);
        const freshData = await freshRes.json();
        setItem(freshData);
        onUpdate();
      }
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  const logWork = async () => {
    if (logHours <= 0) return;
    const newTotal = (item.timeLogged || 0) + logHours;
    await handleUpdateItem({ timeLogged: newTotal });
    setIsLoggingWork(false);
    setLogHours(0);
    setLogNote('');
  };

  const handleAiRefinement = async () => {
    setAiLoading(true);
    setAiSuccessFeedback(false);
    try {
      const res = await fetch('/api/ai/refine-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id || item.id })
      });
      const data = await res.json();
      setAiPlan(data.plan);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const persistAiPlan = async () => {
    if (!aiPlan) return;
    await handleUpdateItem({ aiWorkPlan: aiPlan });
    setAiSuccessFeedback(true);
    setTimeout(() => setAiSuccessFeedback(false), 3000);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    const comment: WorkItemComment = {
      author: 'Current User', 
      body: newComment,
      createdAt: new Date().toISOString()
    };
    const updatedComments = [...(item.comments || []), comment];
    await handleUpdateItem({ comments: updatedComments });
    setNewComment('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const newAttachment: WorkItemAttachment = {
        name: file.name, size: file.size, type: file.type, url: base64, uploadedBy: 'Current User', createdAt: new Date().toISOString()
      };
      const attachments = [...(item.attachments || []), newAttachment];
      await handleUpdateItem({ attachments });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const addLink = async (target: WorkItem) => {
    const newLink: WorkItemLink = {
      type: linkType,
      targetId: (target._id || target.id) as string,
      targetKey: target.key,
      targetTitle: target.title
    };
    const links = [...(item.links || []), newLink];
    await handleUpdateItem({ links });
    setIsLinking(false);
    setLinkSearch('');
    setLinkResults([]);
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.SUBTASK: return 'fa-diagram-project text-slate-400';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  const isWatching = item.watchers?.includes('Current User');
  const getSubArtifactType = () => {
    if (item.type === WorkItemType.EPIC) return WorkItemType.FEATURE;
    if (item.type === WorkItemType.FEATURE) return WorkItemType.STORY;
    return WorkItemType.SUBTASK;
  };

  const renderedAiPlan = aiPlan ? DOMPurify.sanitize(marked.parse(aiPlan) as string) : null;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {item.key}
              </span>
              {item.isFlagged && (
                <span className="animate-pulse text-red-600">
                   <i className="fas fa-flag text-[10px]"></i>
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight truncate">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
           <button 
            onClick={() => handleUpdateItem({ isFlagged: !item.isFlagged })}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${item.isFlagged ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-red-400'}`}
            title={item.isFlagged ? "Clear Impediment" : "Flag as Impediment"}
           >
              <i className="fas fa-flag"></i>
           </button>
           <button 
            onClick={() => handleUpdateItem({ watchers: isWatching ? item.watchers?.filter(w => w !== 'Current User') : [...(item.watchers || []), 'Current User'] })}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isWatching ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-amber-400'}`}
           >
              <i className={`fas fa-eye ${isWatching ? 'animate-pulse' : ''}`}></i>
           </button>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.type === WorkItemType.EPIC ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
              <i className={`fas ${getIcon(item.type).split(' ')[0]} mr-1`}></i>
              {item.type}
           </span>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
          { id: 'ai', icon: 'fa-wand-magic-sparkles', label: 'AI Co-pilot' },
          { id: 'comments', icon: 'fa-comments', label: 'Comments' },
          { id: 'links', icon: 'fa-link', label: 'Links' },
          { id: 'attachments', icon: 'fa-paperclip', label: 'Artifacts' },
          { id: 'activity', icon: 'fa-history', label: 'Audit Trail' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FAFAFA]">
        {closureError && (
          <div className="mx-10 mt-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 animate-fadeIn shadow-sm">
             <i className="fas fa-shield-halved text-xl"></i>
             <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest">Governance Rule Violation</p>
                <p className="text-xs font-medium">{closureError}</p>
             </div>
             <button onClick={() => setClosureError(null)} className="w-8 h-8 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors">
                <i className="fas fa-times"></i>
             </button>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contextual Operations</span>
                  </div>
                  <button onClick={() => setIsLoggingWork(true)} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                     <i className="fas fa-clock"></i> Log Work
                  </button>
               </div>
               <button onClick={() => setIsCreatingSub(true)} className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2">
                 <i className="fas fa-plus"></i>
                 Spawn {getSubArtifactType()}
               </button>
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
                <DetailField label="Estimate (Pts)">
                    <input type="number" value={item.storyPoints || 0} onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
                </DetailField>
                <DetailField label="Effort Logged (Hrs)">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 flex items-center justify-between">
                       <span>{item.timeLogged || 0} hrs</span>
                       <i className="fas fa-lock text-slate-300 scale-75"></i>
                    </div>
                </DetailField>
              </div>
            </div>

            {item.aiWorkPlan && (
               <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <i className="fas fa-wand-magic-sparkles text-blue-500"></i>
                     <div>
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">AI Blueprint Active</p>
                        <p className="text-xs font-medium text-blue-600">Last refined on {new Date(item.updatedAt || '').toLocaleDateString()}</p>
                     </div>
                  </div>
                  <button onClick={() => setActiveTab('ai')} className="text-[9px] font-black text-blue-700 uppercase tracking-[0.2em] hover:underline">View Roadmap</button>
               </div>
            )}
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-10 space-y-6 animate-fadeIn">
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Artifacts</h4>
               <button onClick={() => setIsLinking(true)} className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all">+ Add Link</button>
             </div>
             <div className="space-y-3">
                {(item.links || []).map((link, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                     <div className="flex items-center gap-4">
                        <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${link.type.includes('BLOCK') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{link.type.replace(/_/g, ' ')}</span>
                        <div>
                           <p className="text-xs font-bold text-slate-800">{link.targetTitle}</p>
                           <p className="text-[9px] font-black text-slate-400 uppercase">{link.targetKey}</p>
                        </div>
                     </div>
                     <button onClick={() => handleUpdateItem({ links: item.links?.filter((_, i) => i !== idx) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                  </div>
                ))}
                {(!item.links || item.links.length === 0) && (
                   <div className="py-20 text-center text-slate-300 italic text-xs border-2 border-dashed border-slate-100 rounded-[2rem]">No dependencies established.</div>
                )}
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
                {(!item.attachments || item.attachments.length === 0) && (
                   <div className="col-span-full py-20 text-center text-slate-300 italic text-xs border-2 border-dashed border-slate-100 rounded-[2rem]">No artifacts uploaded.</div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-6 animate-fadeIn bg-white/50">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 px-2">Delivery Audit Trail</h4>
             <div className="relative pl-10 space-y-8">
                <div className="absolute left-[15.5px] top-4 bottom-4 w-[2px] bg-slate-100"></div>
                {(item.activity || []).slice().reverse().map((act, idx) => (act && (
                  <div key={idx} className="relative group/act">
                     <div className={`absolute -left-[37px] w-8 h-8 rounded-xl bg-white border border-slate-200 z-10 flex items-center justify-center shadow-sm transition-all group-hover/act:border-blue-300 ${act.action.includes('AI') || act.action.includes('LINK') || act.action.includes('IMPEDIMENT') ? 'text-blue-500' : 'text-slate-400'}`}>
                        <i className={`fas ${act.action === 'CREATED' ? 'fa-plus' : act.action === 'CHANGED_STATUS' ? 'fa-arrow-right-long' : act.action.includes('AI') ? 'fa-wand-magic-sparkles' : act.action.includes('LINK') ? 'fa-link' : act.action.includes('IMPEDIMENT') ? 'fa-flag' : 'fa-pen-nib'} text-[10px]`}></i>
                     </div>
                     <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center gap-2">
                           <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(act.user || 'S')}&background=random&size=20`} className="w-5 h-5 rounded-lg" />
                           <span className="text-[11px] font-black text-slate-800">{act.user}</span>
                           <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ml-auto ${
                             act.action.includes('AUTO') ? 'bg-slate-100 text-slate-500 border border-slate-200' : 
                             act.action.includes('IMPEDIMENT') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                           }`}>{act.action.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="pl-7">
                           {act.field ? (
                              <div className="text-[11px] text-slate-500 font-medium">
                                Modified <span className="font-bold text-slate-600 uppercase tracking-tighter text-[9px]">{act.field}</span> 
                                {act.from !== undefined && act.to !== undefined && (
                                   <div className="mt-2 grid grid-cols-1 gap-1">
                                      <div className="bg-red-50/50 p-2 rounded-lg border border-red-100 text-red-700/60 line-through truncate">
                                        {String(act.from).substring(0, 150)}{String(act.from).length > 150 ? '...' : ''}
                                      </div>
                                      <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 text-blue-800 font-bold">
                                        {String(act.to).substring(0, 200)}{String(act.to).length > 200 ? '...' : ''}
                                      </div>
                                   </div>
                                )}
                                {act.from === undefined && act.to && (
                                   <div className="mt-1 bg-blue-50 p-2 rounded-lg border border-blue-100 text-blue-800 font-bold">{String(act.to)}</div>
                                )}
                              </div>
                           ) : (
                              <p className="text-[11px] text-slate-400 italic">Audit record generated with no payload.</p>
                           )}
                           <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">{new Date(act.createdAt).toLocaleString()}</p>
                        </div>
                     </div>
                  </div>
                )))}
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <div className="bg-gradient-to-br from-slate-900 to-blue-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10">
                   <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-[1.5rem] flex items-center justify-center border border-white/10 backdrop-blur-md">
                           <i className="fas fa-wand-magic-sparkles text-2xl text-blue-300"></i>
                        </div>
                        <div>
                           <h4 className="text-xl font-black tracking-tight">Requirement Refinement</h4>
                           <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">Powered by Gemini 3 Flash</p>
                        </div>
                      </div>
                      {aiPlan && (
                        <button 
                          onClick={persistAiPlan}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                            aiSuccessFeedback ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-400'
                          }`}
                        >
                          {aiSuccessFeedback ? <><i className="fas fa-check-circle"></i> Blueprint Committed</> : <><i className="fas fa-database"></i> Commit to Registry</>}
                        </button>
                      )}
                   </div>
                   <p className="text-blue-100/80 text-sm mb-8 leading-relaxed max-w-lg font-medium">Generate standard acceptance criteria, technical implementation steps, and risk assessments based on the artifact description.</p>
                   <button 
                    onClick={handleAiRefinement}
                    disabled={aiLoading}
                    className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-3 shadow-xl disabled:opacity-50"
                   >
                     {aiLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-bolt"></i>}
                     {aiLoading ? 'Reasoning...' : (aiPlan ? 'Regenerate Work Plan' : 'Generate Work Plan')}
                   </button>
                </div>
             </div>

             {aiPlan && (
               <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm animate-fadeIn">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                     <i className="fas fa-file-invoice"></i> AI-Generated Implementation Blueprint
                  </h4>
                  <div className="prose prose-slate max-w-none prose-sm" dangerouslySetInnerHTML={{ __html: renderedAiPlan! }} />
               </div>
             )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="space-y-6">
                {(item.comments || []).map((c, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                     <div className="flex items-center gap-3">
                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&size=32`} className="w-8 h-8 rounded-xl shadow-sm" />
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{c.author}</span>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest ml-auto">{new Date(c.createdAt).toLocaleString()}</span>
                     </div>
                     <p className="text-sm text-slate-600 leading-relaxed font-medium pl-1">{c.body}</p>
                  </div>
                ))}
             </div>
             <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-100 space-y-4">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Annotate this record..." className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm font-medium outline-none focus:border-blue-500 transition-all resize-none h-32" />
                <div className="flex justify-end"><button onClick={addComment} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg">Post Comment</button></div>
             </div>
          </div>
        )}
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
                    <input type="number" step="0.5" value={logHours} onChange={(e) => setLogHours(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:border-blue-500" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Activity Narrative</label>
                    <textarea value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What was achieved?" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-medium outline-none h-24 resize-none" />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsLoggingWork(false)} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase">Discard</button>
                    <button onClick={logWork} className="flex-[2] py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl hover:bg-blue-600 transition-all uppercase tracking-widest">Commit Log</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {isCreatingSub && (
        <CreateWorkItemModal 
          bundles={bundles} applications={applications} initialBundleId={item.bundleId} initialAppId={item.applicationId || ''} initialParentId={item._id || item.id} initialType={getSubArtifactType()} onClose={() => setIsCreatingSub(false)}
          onSuccess={() => { setIsCreatingSub(false); loadFullDetails(); onUpdate(); }}
        />
      )}

      {isLinking && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-fadeIn border border-slate-100">
              <div className="flex justify-between items-start mb-8">
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight italic">Establish Relationship</h3>
                 <button onClick={() => setIsLinking(false)} className="text-slate-300 hover:text-red-500 transition-colors"><i className="fas fa-times"></i></button>
              </div>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dependency Mode</label>
                    <select value={linkType} onChange={(e) => setLinkType(e.target.value as any)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all">
                       <option value="RELATES_TO">Relates To</option>
                       <option value="BLOCKS">Blocks</option>
                       <option value="IS_BLOCKED_BY">Is Blocked By</option>
                       <option value="DUPLICATES">Duplicates</option>
                    </select>
                 </div>
                 <div className="space-y-2 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Artifact Search</label>
                    <div className="relative group">
                       <input 
                         autoFocus
                         type="text" 
                         value={linkSearch} 
                         onChange={(e) => setLinkSearch(e.target.value)} 
                         placeholder="Search by key or title..." 
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold outline-none focus:border-blue-500 transition-all" 
                       />
                       <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
                       {linkLoading && <i className="fas fa-circle-notch fa-spin absolute right-5 top-1/2 -translate-y-1/2 text-slate-300"></i>}
                    </div>

                    {linkResults.length > 0 && (
                       <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-fadeIn">
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                             {linkResults.map(res => (
                                <button
                                   key={res._id || res.id}
                                   onClick={() => addLink(res)}
                                   className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-50 last:border-0 group/item"
                                >
                                   <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{res.key}</p>
                                      <p className="text-sm font-bold text-slate-800 truncate">{res.title}</p>
                                   </div>
                                   <i className="fas fa-plus text-slate-200 group-hover/item:text-blue-500 transition-colors"></i>
                                </button>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>
              </div>
              <div className="flex justify-end gap-3 mt-12 pt-6 border-t border-slate-50">
                 <button onClick={() => setIsLinking(false)} className="px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
              </div>
           </div>
        </div>
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
