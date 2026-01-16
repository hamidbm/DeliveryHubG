
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const [closureError, setClosureError] = useState<string | null>(null);

  const [aiResult, setAiResult] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReadyForExecution = useMemo(() => {
    return !!(item.assignedTo && item.storyPoints && item.description && item.description.length > 20);
  }, [item]);

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
    } catch (err) { console.error("Sync Error:", err); }
  };

  useEffect(() => {
    loadFullDetails();
    setClosureError(null);
  }, [initialItem]);

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    if (updates.status === WorkItemStatus.IN_PROGRESS && !isReadyForExecution) {
      setClosureError(`DoR Violation: Artifact lacks metadata (Assignee/Description).`);
      return;
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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    await handleUpdateItem({ 
      comments: [...(item.comments || []), { author: 'Current User', body: newComment, createdAt: new Date().toISOString() }] 
    });
    setNewComment('');
  };

  const handleAddChecklist = async () => {
    if (!newChecklistItem.trim()) return;
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      label: newChecklistItem,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };
    await handleUpdateItem({ checklists: [...(item.checklists || []), newItem] });
    setNewChecklistItem('');
  };

  const toggleChecklist = async (id: string) => {
    const list = (item.checklists || []).map(c => c.id === id ? { ...c, isCompleted: !c.isCompleted } : c);
    await handleUpdateItem({ checklists: list });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    // Simulate upload delay and storage
    // Fix: Explicitly type 'f' as 'any' to resolve "Property does not exist on type 'unknown'" errors during Array.from(files).map
    const newAttachments: WorkItemAttachment[] = Array.from(files).map((f: any) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      url: '#',
      uploadedBy: 'Current User',
      createdAt: new Date().toISOString()
    }));
    await handleUpdateItem({ attachments: [...(item.attachments || []), ...newAttachments] });
    setUploading(false);
  };

  const handleAddLink = async () => {
    const targetKey = window.prompt("Enter Target Artifact Key (e.g. CORE-123):");
    if (!targetKey) return;
    // Real logic would search by key first
    const link: WorkItemLink = {
      type: 'RELATES_TO',
      targetId: 'lookup-pending',
      targetKey: targetKey.toUpperCase()
    };
    await handleUpdateItem({ links: [...(item.links || []), link] });
  };

  const runAiTool = async (endpoint: string) => {
    setIsAiProcessing(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item._id || item.id })
      });
      const data = await res.json();
      setAiResult(data.plan || data.digest || data.suggestion);
    } finally { setIsAiProcessing(false); }
  };

  const handleSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}/snapshot`, { method: 'POST' });
      if (res.ok) {
        alert("Immutable Audit Snapshot captured in Wiki Registry.");
        await loadFullDetails();
      }
    } finally { setIsSnapshotting(false); }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100 transition-all"><i className="fas fa-arrow-left"></i></button>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight truncate leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleSnapshot}
             disabled={isSnapshotting || item.status !== WorkItemStatus.DONE}
             className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${
               item.status === WorkItemStatus.DONE ? 'bg-slate-900 text-white hover:bg-blue-600 shadow-xl' : 'bg-slate-50 text-slate-300 border-slate-100'
             }`}
           >
              <i className={`fas ${isSnapshotting ? 'fa-spinner fa-spin' : 'fa-stamp'}`}></i> Snapshot
           </button>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', label: 'Details', icon: 'fa-info-circle' },
          { id: 'checklist', label: 'Checklist', icon: 'fa-check-square' },
          { id: 'comments', label: 'Comments', icon: 'fa-comments' },
          { id: 'links', label: 'Traceability', icon: 'fa-link' },
          { id: 'attachments', label: 'Vault', icon: 'fa-paperclip' },
          { id: 'activity', label: 'Pulse', icon: 'fa-history' },
          { id: 'ai', label: 'Gemini', icon: 'fa-robot' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FAFAFA] custom-scrollbar">
        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Phase</label>
                  <select 
                    value={item.status} 
                    onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                    {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Urgency</label>
                  <select 
                    value={item.priority} 
                    onChange={(e) => handleUpdateItem({ priority: e.target.value as any })} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Resource</label>
                <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Narrative Description</label>
                <textarea 
                  value={item.description} 
                  onChange={(e) => handleUpdateItem({ description: e.target.value })} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium h-40 outline-none focus:ring-2 focus:ring-blue-500/10" 
                  placeholder="Elaborate on the requirements and technical constraints..."
                />
              </div>
            </div>
            
            {closureError && (
              <div className="p-6 bg-red-50 border border-red-100 rounded-[1.5rem] flex items-center gap-4 text-red-600 text-xs font-bold animate-shake">
                <i className="fas fa-exclamation-triangle"></i>
                {closureError}
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Checkpoints</h4>
                   <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                     {item.checklists?.filter(c => c.isCompleted).length || 0} / {item.checklists?.length || 0} Ready
                   </span>
                </div>
                <div className="space-y-4">
                   {(item.checklists || []).map(check => (
                     <button 
                       key={check.id} 
                       onClick={() => toggleChecklist(check.id)}
                       className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all text-left group"
                     >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${check.isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200'}`}>
                           <i className={`fas fa-check text-[10px] ${check.isCompleted ? 'scale-100' : 'scale-0'}`}></i>
                        </div>
                        <span className={`text-sm font-bold flex-1 ${check.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{check.label}</span>
                     </button>
                   ))}
                   <div className="flex items-center gap-4 p-2 pl-4">
                      <i className="fas fa-plus text-[10px] text-slate-300"></i>
                      <input 
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                        placeholder="Add new checkpoint..."
                        className="bg-transparent border-none outline-none text-sm font-medium text-slate-600 placeholder:text-slate-300 w-full"
                      />
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="space-y-6">
                {(item.comments || []).map((c, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random`} className="w-10 h-10 rounded-full shrink-0 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-800">{c.author}</span>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                ))}
             </div>
             <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl space-y-4">
                <textarea 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-6 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 resize-none h-32" 
                  placeholder="Submit technical response or artifact update..." 
                />
                <div className="flex justify-end">
                   <button onClick={handleAddComment} className="px-8 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">Post Comment</button>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dependency Graph</h4>
                   <button onClick={handleAddLink} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ Link Artifact</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   {(item.links || []).map((link, i) => (
                     <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                              <i className="fas fa-link text-xs"></i>
                           </div>
                           <div>
                              <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest block mb-0.5">{link.type.replace(/_/g, ' ')}</span>
                              <h5 className="text-sm font-bold text-slate-700">{link.targetKey || 'Linking...'}: {link.targetTitle || 'Fetching status...'}</h5>
                           </div>
                        </div>
                        <button onClick={() => handleUpdateItem({ links: item.links?.filter((_, idx) => idx !== i) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-unlink text-xs"></i></button>
                     </div>
                   ))}
                   {(!item.links || item.links.length === 0) && (
                     <div className="py-20 text-center flex flex-col items-center opacity-30">
                        <i className="fas fa-network-wired text-4xl mb-4"></i>
                        <p className="text-[10px] font-black uppercase tracking-widest">No links established</p>
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Artifact Vault</h4>
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-5 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-600 transition-all"
                   >
                     {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-arrow-up mr-2"></i>}
                     {uploading ? 'Processing...' : 'Upload Docs'}
                   </button>
                   <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   {(item.attachments || []).map((file, i) => (
                     <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative">
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-2xl text-blue-500 shadow-sm">
                           <i className={`fas ${file.type.includes('image') ? 'fa-file-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="text-sm font-bold text-slate-800 truncate mb-0.5">{file.name}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{(file.size / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button className="text-slate-300 hover:text-blue-600 transition-colors"><i className="fas fa-download text-xs"></i></button>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute left-[4.5rem] top-20 bottom-10 w-[1px] bg-slate-100"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-12">Execution Audit Trail</h4>
                <div className="space-y-10 relative z-10">
                   {(item.activity || []).slice().reverse().map((act, i) => (
                     <div key={i} className="flex gap-10">
                        <div className="w-12 text-right shrink-0">
                           <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${
                          act.action === 'CREATED' ? 'bg-emerald-50 text-white' : 
                          act.action === 'CHANGED_STATUS' ? 'bg-blue-500 text-white' : 
                          act.action === 'IMPEDIMENT_RAISED' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                           <i className={`fas ${
                             act.action === 'CREATED' ? 'fa-plus' : 
                             act.action === 'CHANGED_STATUS' ? 'fa-rotate' : 
                             act.action === 'IMPEDIMENT_RAISED' ? 'fa-flag' : 'fa-pen-to-square'
                           } text-[8px]`}></i>
                        </div>
                        <div className="flex-1 pt-1">
                           <p className="text-xs font-bold text-slate-700">
                             <span className="text-blue-600">{act.user}</span> {act.action.replace(/_/g, ' ').toLowerCase()} {act.field && <span className="text-slate-400 font-medium">field</span>} <span className="text-slate-900">{act.field}</span>
                           </p>
                           {act.from !== undefined && act.to !== undefined && (
                             <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase">
                                <span>{String(act.from)}</span>
                                <i className="fas fa-arrow-right text-[8px]"></i>
                                <span className="text-slate-600">{String(act.to)}</span>
                             </div>
                           )}
                           <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 tracking-widest">{new Date(act.createdAt).toLocaleDateString()}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Work Plan', icon: 'fa-map-location-dot', endpoint: '/api/ai/refine-task' },
                  { label: 'Standup Digest', icon: 'fa-microphone-lines', endpoint: '/api/ai/standup-digest' },
                  { label: 'Load Rebalance', icon: 'fa-scale-balanced', endpoint: '/api/ai/suggest-reassignment' }
                ].map(tool => (
                  <button 
                    key={tool.label}
                    onClick={() => runAiTool(tool.endpoint)}
                    disabled={isAiProcessing}
                    className="bg-white border border-slate-100 p-6 rounded-[2rem] hover:shadow-2xl hover:shadow-blue-500/5 transition-all text-center group flex flex-col items-center"
                  >
                     <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                        <i className={`fas ${tool.icon}`}></i>
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{tool.label}</span>
                  </button>
                ))}
             </div>

             <div className="bg-slate-900 rounded-[2.5rem] p-10 min-h-[400px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <header className="flex items-center gap-4 mb-8">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                   <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Gemini Intelligence Terminal</h4>
                </header>
                
                <div className="prose prose-invert max-w-none">
                   {isAiProcessing ? (
                     <div className="space-y-6">
                        <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse"></div>
                        <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse"></div>
                     </div>
                   ) : aiResult ? (
                     <div className="text-blue-50/80 font-medium leading-relaxed selection:bg-blue-500/30" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(aiResult) as string) }} />
                   ) : (
                     <div className="py-20 flex flex-col items-center text-center opacity-40">
                        <i className="fas fa-brain text-5xl text-blue-500/50 mb-6"></i>
                        <p className="text-blue-100 font-bold uppercase tracking-widest text-xs">Awaiting Execution Command...</p>
                     </div>
                   )}
                </div>
                
                {aiResult && !isAiProcessing && (
                  <div className="mt-10 pt-10 border-t border-white/5 flex justify-end gap-3">
                     <button onClick={() => setAiResult(null)} className="px-6 py-2 text-[10px] font-black text-slate-500 uppercase">Discard</button>
                     <button onClick={() => handleUpdateItem({ aiWorkPlan: aiResult })} className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-blue-500/20">Commit to Record</button>
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default WorkItemDetails;
