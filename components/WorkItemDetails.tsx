
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
  const [subtasks, setSubtasks] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai'>('details');
  const [newComment, setNewComment] = useState('');
  const [logTimeValue, setLogTimeValue] = useState<number>(0);
  const [newLabel, setNewLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  
  // AI States
  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessFeedback, setAiSuccessFeedback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFullDetails = async () => {
    try {
      const [itemRes, subRes, msRes] = await Promise.all([
        fetch(`/api/work-items/${initialItem._id || initialItem.id}`),
        fetch(`/api/work-items?parentId=${initialItem._id || initialItem.id}`),
        fetch(`/api/milestones`)
      ]);
      const itemData = await itemRes.json();
      const subData = await subRes.json();
      setItem(itemData);
      setSubtasks(subData);
      setMilestones(await msRes.json());
      if (itemData.aiWorkPlan) setAiPlan(itemData.aiWorkPlan);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    loadFullDetails();
  }, [initialItem]);

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
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
      const newAttachment = {
        name: file.name, size: file.size, type: file.type, url: base64, uploadedBy: 'Current User', createdAt: new Date().toISOString()
      };
      const attachments = [...(item.attachments || []), newAttachment];
      await handleUpdateItem({ attachments });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
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
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
               {item.key}
               {item.parentId && (
                 <>
                   <i className="fas fa-chevron-right text-[8px]"></i>
                   <span className="text-blue-500">Child Artifact</span>
                 </>
               )}
            </span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contextual Operations</span>
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
              <div className="grid grid-cols-2 gap-6">
                <DetailField label="Assigned Personnel">
                    <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
                </DetailField>
                <DetailField label="Story Points">
                    <input type="number" value={item.storyPoints || 0} onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" />
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
                          {aiSuccessFeedback ? (
                             <><i className="fas fa-check-circle"></i> Blueprint Committed</>
                          ) : (
                             <><i className="fas fa-database"></i> Commit to Registry</>
                          )}
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
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(c.createdAt).toLocaleString()}</span>
                     </div>
                     <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.body}</p>
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

      {isCreatingSub && (
        <CreateWorkItemModal 
          bundles={bundles} applications={applications} initialBundleId={item.bundleId} initialAppId={item.applicationId || ''} initialParentId={item._id || item.id} initialType={getSubArtifactType()} onClose={() => setIsCreatingSub(false)}
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
