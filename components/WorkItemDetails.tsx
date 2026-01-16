
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
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [logHours, setLogHours] = useState<number>(0);
  const [closureError, setClosureError] = useState<string | null>(null);

  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReadyForExecution = useMemo(() => {
    return !!(item.assignedTo && item.storyPoints && item.description && item.description.length > 50);
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
      setClosureError(`DoR Violation: Artifact lacks metadata.`);
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

  const toggleChecklist = async (id: string) => {
    const list = (item.checklists || []).map(c => c.id === id ? { ...c, isCompleted: !c.isCompleted } : c);
    await handleUpdateItem({ checklists: list });
  };

  const handleSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}/snapshot`, { method: 'POST' });
      if (res.ok) {
        alert("Immutable Audit Snapshot captured.");
        await loadFullDetails();
      }
    } finally { setIsSnapshotting(false); }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100"><i className="fas fa-arrow-left"></i></button>
          <div className="min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight truncate leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleSnapshot}
             disabled={isSnapshotting || item.status !== WorkItemStatus.DONE}
             className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border ${
               item.status === WorkItemStatus.DONE ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-300 border-slate-100'
             }`}
           >
              <i className="fas fa-stamp"></i> Snapshot
           </button>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {['details', 'checklist', 'comments', 'links', 'attachments', 'activity'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phase</label>
                  <select value={item.status} onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black">
                    {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority</label>
                  <select value={item.priority} onChange={(e) => handleUpdateItem({ priority: e.target.value as any })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black">
                    {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                <textarea value={item.description} onChange={(e) => handleUpdateItem({ description: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-medium h-40" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <div className="space-y-6">
                {(item.comments || []).map((c, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}`} className="w-6 h-6 rounded-full" />
                      <span className="text-xs font-black text-slate-800">{c.author}</span>
                      <span className="text-[8px] font-bold text-slate-300 uppercase">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.body}</p>
                  </div>
                ))}
             </div>
             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} className="w-full bg-slate-50 rounded-xl p-4 text-sm outline-none" placeholder="Write a response..." />
                <button onClick={handleAddComment} className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl">Post Comment</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkItemDetails;
