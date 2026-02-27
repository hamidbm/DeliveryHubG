
import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone, ChecklistItem } from '../types';
import AssigneeSearch from './AssigneeSearch';
import CommentsDrawer from './CommentsDrawer';
import { useRouter } from '../App';
const WorkItemAiPanel = React.lazy(() => import('./WorkItemAiPanel'));
const WorkItemAttachmentsPanel = React.lazy(() => import('./WorkItemAttachmentsPanel'));
const WorkItemActivityPanel = React.lazy(() => import('./WorkItemActivityPanel'));

interface WorkItemDetailsProps {
  item: WorkItem;
  bundles: Bundle[];
  applications: Application[];
  onUpdate: () => void;
  onClose: () => void;
  initialActiveTab?: 'details' | 'checklist' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai';
  initialThreadId?: string | null;
}

const WorkItemDetails: React.FC<WorkItemDetailsProps> = ({ item: initialItem, bundles, applications, onUpdate, onClose, initialActiveTab, initialThreadId }) => {
  const router = useRouter();
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [children, setChildren] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai'>(initialActiveTab || 'details');
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [uploading, setUploading] = useState(false);
  const [closureError, setClosureError] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');
  const [linkKey, setLinkKey] = useState('');
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string } | null>(null);
  const [resolvedLinks, setResolvedLinks] = useState<Record<string, { title?: string; type?: string; status?: string; key?: string }>>({});
  const [parentCandidates, setParentCandidates] = useState<WorkItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<any | null>(null);
  const [reviewCycle, setReviewCycle] = useState<any | null>(null);
  const [isSyncingReview, setIsSyncingReview] = useState(false);
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);

  const [aiResult, setAiResult] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildResourceLink = (resource?: { type?: string; id?: string }, opts?: { reviewId?: string; cycleId?: string; dedupKey?: string }) => {
    let resourceId = resource?.id;
    let resourceType = resource?.type;
    if (resourceId && ['undefined', 'null'].includes(String(resourceId))) {
      resourceId = undefined;
    }
    if (opts?.reviewId && opts.reviewId.includes(':')) {
      const parts = opts.reviewId.split(':');
      const inferredType = parts[0];
      const inferredId = parts.slice(1).join(':');
      if (!resourceType && inferredType) resourceType = inferredType;
      if (resourceType === 'architecture_diagram' && inferredId) {
        resourceId = inferredId;
      } else if (!resourceId && inferredId) {
        resourceId = inferredId;
      }
    }
    if (!resourceId && opts?.dedupKey) {
      const parts = opts.dedupKey.split(':');
      if (parts.length >= 4 && parts[0].startsWith('reviews.cycle')) {
        resourceId = parts[2] || resourceId;
      }
    }
    if (!resourceId || ['undefined', 'null'].includes(resourceId)) return null;
    if (resourceType === 'wiki.page' || resourceType === 'wiki.asset') {
      return `/?tab=wiki&pageId=${encodeURIComponent(resourceId)}`;
    }
    if (resourceType === 'architecture_diagram') {
      const params = new URLSearchParams();
      params.set('focus', 'review');
      if (opts?.cycleId) params.set('cycle', opts.cycleId);
      return `/architecture/diagram/${encodeURIComponent(resourceId)}?${params.toString()}`;
    }
    return null;
  };

  const reviewContext = useMemo(() => {
    if (!item.reviewId && !item.reviewCycleId && !item.linkedResource) return null;
    const link = item.linkedResource ? buildResourceLink(item.linkedResource, { reviewId: item.reviewId, cycleId: item.reviewCycleId, dedupKey: item.dedupKey }) : null;
    const requestedBy = item.reviewRequestedBy?.displayName || item.reviewRequestedBy?.email || item.reviewRequestedBy?.userId;
    const cycleLabel = item.reviewCycleNumber ? `#${item.reviewCycleNumber}` : item.reviewCycleId;
    return {
      link,
      resourceLabel: item.linkedResource?.title || item.linkedResource?.id,
      resourceType: item.linkedResource?.type,
      cycleLabel,
      requestedBy,
      dueAt: item.dueAt,
      notes: item.reviewNotes
    };
  }, [item]);

  const syncFromReview = async () => {
    if (!item.reviewCycleId) return;
    setIsSyncingReview(true);
    try {
      await fetch('/api/work-items/sync-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reviewId: item.reviewId,
          cycleId: item.reviewCycleId,
          resourceType: item.linkedResource?.type,
          resourceId: item.linkedResource?.id
        })
      });
      await loadFullDetails();
      onUpdate();
    } finally {
      setIsSyncingReview(false);
    }
  };

  useEffect(() => {
    const loadReview = async () => {
      if (!item.linkedResource?.type || !item.linkedResource?.id) {
        setReviewData(null);
        setReviewCycle(null);
        return;
      }
      try {
        const params = new URLSearchParams({
          resourceType: item.linkedResource.type,
          resourceId: item.linkedResource.id
        });
        const res = await fetch(`/api/reviews/by-resource?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) {
          setReviewData(null);
          setReviewCycle(null);
          return;
        }
        const review = await res.json();
        setReviewData(review);
        const cycle = (review?.cycles || []).find((c: any) => c.cycleId === item.reviewCycleId);
        setReviewCycle(cycle || null);
      } catch {
        setReviewData(null);
        setReviewCycle(null);
      }
    };
    loadReview();
  }, [item.linkedResource?.type, item.linkedResource?.id, item.reviewCycleId]);

  useEffect(() => {
    if (autoSyncAttempted) return;
    if (!item.reviewId || !item.reviewCycleId) return;
    if (item.linkedResource?.id) return;
    setAutoSyncAttempted(true);
    fetch('/api/work-items/sync-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        reviewId: item.reviewId,
        cycleId: item.reviewCycleId
      })
    })
      .then(() => loadFullDetails())
      .catch(() => {});
  }, [autoSyncAttempted, item.reviewId, item.reviewCycleId, item.linkedResource?.id]);

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

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const loadParents = async () => {
      let parentType: WorkItemType | null = null;
      if (item.type === WorkItemType.FEATURE) parentType = WorkItemType.EPIC;
      else if (item.type === WorkItemType.STORY) parentType = WorkItemType.FEATURE;
      else if (item.type === WorkItemType.TASK || item.type === WorkItemType.BUG) parentType = WorkItemType.STORY;

      if (!parentType) {
        setParentCandidates([]);
        return;
      }

      const params = new URLSearchParams();
      if (item.bundleId) params.set('bundleId', item.bundleId);
      if (item.applicationId) params.set('applicationId', item.applicationId);
      params.set('types', parentType);

      try {
        const res = await fetch(`/api/work-items?${params.toString()}`);
        const data = await res.json();
        setParentCandidates(Array.isArray(data) ? data : []);
      } catch {
        setParentCandidates([]);
      }
    };
    loadParents();
  }, [item.type, item.bundleId, item.applicationId]);

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
      comments: [...(item.comments || []), { author: currentUser?.name || currentUser?.email || 'Unknown', body: newComment, createdAt: new Date().toISOString() }] 
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
    try {
      await uploadFiles(Array.from(files) as File[]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const res = await fetch(`/api/work-items/${item._id || item.id}/attachments`, {
      method: 'POST',
      body: form
    });
    if (res.ok) {
      await loadFullDetails();
      onUpdate();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Upload failed');
    }
  };

  const deleteAttachment = async (assetId?: string) => {
    if (!assetId) return;
    if (!confirm('Delete attachment?')) return;
    const res = await fetch(`/api/work-items/${item._id || item.id}/attachments/${assetId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadFullDetails();
      onUpdate();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Delete failed');
    }
  };

  const replaceAttachment = async (assetId: string, file: File) => {
    await uploadFiles([file]);
    await deleteAttachment(assetId);
  };

  const deleteWorkItem = async () => {
    if (!confirm('Archive this work item?')) return;
    const res = await fetch(`/api/work-items/${item._id || item.id}`, { method: 'DELETE' });
    if (res.ok) {
      onClose();
      onUpdate();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Archive failed');
    }
  };

  const handleAddLink = async (targetKey: string, type: WorkItemLink['type']) => {
    const key = String(targetKey || '').trim();
    if (!key) return;
    try {
      const res = await fetch(`/api/work-items/lookup?key=${encodeURIComponent(key)}`);
      if (!res.ok) {
        alert('Target not found. Check the key and try again.');
        return;
      }
      const target = await res.json();
      const targetId = (target._id || target.id) as string;
      if (String(targetId) === String(item._id || item.id)) {
        alert('You cannot link an item to itself.');
        return;
      }
      const exists = (item.links || []).some(l => l.type === type && String(l.targetId) === String(targetId));
      if (exists) {
        alert('This link already exists.');
        return;
      }
      const link: WorkItemLink = {
        type,
        targetId,
        targetKey: target.key,
        targetTitle: target.title
      };
      await handleUpdateItem({ links: [...(item.links || []), link] });
      setLinkKey('');
    } catch {
      alert('Link lookup failed. Please try again.');
    }
  };

  useEffect(() => {
    const resolve = async () => {
      const links = item.links || [];
      if (links.length === 0) return;
      const next: Record<string, { title?: string; type?: string; status?: string; key?: string }> = {};
      await Promise.all(
        links.map(async (link) => {
          const key = String(link.targetId);
          if (resolvedLinks[key]) return;
          try {
            const res = await fetch(`/api/work-items/lookup?key=${encodeURIComponent(link.targetId)}`);
            if (!res.ok) return;
            const data = await res.json();
            next[key] = { title: data.title, type: data.type, status: data.status, key: data.key };
          } catch {}
        })
      );
      if (Object.keys(next).length) setResolvedLinks(prev => ({ ...prev, ...next }));
    };
    resolve();
  }, [item.links]);

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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(item.key);
                    setToast('Key copied');
                  } catch {}
                }}
                className="text-slate-300 hover:text-blue-600 transition-colors"
                title="Copy key"
                aria-label="Copy key"
              >
                <i className="fas fa-copy text-[10px]"></i>
              </button>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight truncate leading-tight">{item.title}</h3>
            {item.linkedResource && (
              <div className="mt-1 text-[11px] font-semibold text-slate-500 truncate">
                {buildResourceLink(item.linkedResource, { reviewId: item.reviewId, cycleId: item.reviewCycleId, dedupKey: item.dedupKey }) ? (
                  <button
                    onClick={() => router.push(buildResourceLink(item.linkedResource, { reviewId: item.reviewId, cycleId: item.reviewCycleId, dedupKey: item.dedupKey }) as string)}
                    className="text-blue-600 hover:text-blue-800 underline decoration-dotted"
                    title="Open linked resource"
                  >
                    {item.linkedResource.title || item.linkedResource.id} ({item.linkedResource.type})
                  </button>
                ) : (
                  <span>{item.linkedResource.title || item.linkedResource.id} ({item.linkedResource.type})</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button
             disabled
             className="px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed"
             title="AI assistant coming soon"
           >
             <i className="fas fa-wand-magic-sparkles"></i> AI Assist
           </button>
           <button 
             onClick={handleSnapshot}
             disabled={isSnapshotting || item.status !== WorkItemStatus.DONE}
             className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${
               item.status === WorkItemStatus.DONE ? 'bg-slate-900 text-white hover:bg-blue-600 shadow-xl' : 'bg-slate-50 text-slate-300 border-slate-100'
             }`}
           >
              <i className={`fas ${isSnapshotting ? 'fa-spinner fa-spin' : 'fa-stamp'}`}></i> Snapshot
           </button>
           <button
             onClick={async () => {
               if (item.isArchived) {
                 const res = await fetch(`/api/work-items/${item._id || item.id}/restore`, { method: 'POST' });
                 if (res.ok) {
                   await loadFullDetails();
                   onUpdate();
                 } else {
                   const err = await res.json().catch(() => ({}));
                   alert(err.error || 'Restore failed');
                 }
               } else {
                 await deleteWorkItem();
               }
             }}
             className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${
               item.isArchived ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:text-red-600'
             }`}
           >
             <i className={`fas ${item.isArchived ? 'fa-rotate-left' : 'fa-archive'}`}></i>
             {item.isArchived ? 'Restore' : 'Archive'}
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
            className={`relative px-6 py-5 text-[10px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
            <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-blue-600 transition-all ${activeTab === tab.id ? 'w-8' : 'w-0'}`} />
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

              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Due Date</label>
                  <input
                    type="date"
                    value={item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 10) : ''}
                    onChange={(e) => handleUpdateItem({ dueAt: e.target.value || undefined })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              {item.type === WorkItemType.RISK && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Risk Details</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Probability</label>
                      <select
                        value={item.risk?.probability || 3}
                        onChange={(e) => handleUpdateItem({ risk: { ...(item.risk || {}), probability: Number(e.target.value) as any, impact: (item.risk?.impact || 3) as any } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      >
                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Impact</label>
                      <select
                        value={item.risk?.impact || 3}
                        onChange={(e) => handleUpdateItem({ risk: { ...(item.risk || {}), impact: Number(e.target.value) as any, probability: (item.risk?.probability || 3) as any } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      >
                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Severity</label>
                      <div className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase text-slate-600">
                        {item.risk?.severity || '—'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Area</label>
                      <select
                        value={item.risk?.area || ''}
                        onChange={(e) => handleUpdateItem({ risk: { ...(item.risk || {}), area: e.target.value as any, probability: (item.risk?.probability || 3) as any, impact: (item.risk?.impact || 3) as any } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      >
                        <option value="">Select</option>
                        {['schedule','cost','scope','security','compliance','operations','vendor','other'].map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mitigation</label>
                      <input
                        value={item.risk?.mitigation || ''}
                        onChange={(e) => handleUpdateItem({ risk: { ...(item.risk || {}), mitigation: e.target.value, probability: (item.risk?.probability || 3) as any, impact: (item.risk?.impact || 3) as any } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {item.type === WorkItemType.DEPENDENCY && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependency Details</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Blocking</label>
                      <select
                        value={item.dependency?.blocking ? 'yes' : 'no'}
                        onChange={(e) => handleUpdateItem({ dependency: { ...(item.dependency || {}), blocking: e.target.value === 'yes' } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Depends On (name)</label>
                      <input
                        value={item.dependency?.dependsOn?.name || ''}
                        onChange={(e) => handleUpdateItem({ dependency: { ...(item.dependency || {}), dependsOn: { ...(item.dependency?.dependsOn || { type: 'external' }), name: e.target.value }, blocking: typeof item.dependency?.blocking === 'boolean' ? item.dependency.blocking : true } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {reviewContext && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Review Context</div>
                    <div className="flex items-center gap-3">
                      {reviewContext.link && (
                        <button
                          onClick={() => router.push(reviewContext.link as string)}
                          className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800"
                        >
                          Open Review →
                        </button>
                      )}
                      {item.reviewCycleId && (
                        <button
                          onClick={syncFromReview}
                          disabled={isSyncingReview}
                          className={`text-[10px] font-black uppercase tracking-widest ${
                            isSyncingReview ? 'text-slate-300' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {isSyncingReview ? 'Syncing…' : 'Sync from review'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-slate-700">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Resource</div>
                      {reviewContext.link ? (
                        <button
                          onClick={() => router.push(reviewContext.link as string)}
                          className="text-blue-600 hover:text-blue-800 underline decoration-dotted"
                        >
                          {reviewContext.resourceLabel} ({reviewContext.resourceType})
                        </button>
                      ) : (
                        <div>{reviewContext.resourceLabel} ({reviewContext.resourceType})</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cycle</div>
                      <div>{reviewContext.cycleLabel || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Requested By</div>
                      <div>{reviewContext.requestedBy || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due</div>
                      <div>{reviewContext.dueAt ? new Date(reviewContext.dueAt).toLocaleDateString() : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cycle Status</div>
                      <div>{reviewCycle?.status ? String(reviewCycle.status).replace('_', ' ') : '—'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Submitter Note</div>
                    <div className="mt-1 text-sm font-medium text-slate-700 whitespace-pre-wrap">
                      {reviewContext.notes || 'No submitter note provided.'}
                    </div>
                  </div>
                  {reviewCycle?.reviewerNote?.body && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                      <div className="mt-1 text-sm font-medium text-slate-700 whitespace-pre-wrap">
                        {reviewCycle.reviewerNote.body}
                      </div>
                    </div>
                  )}
                  {reviewCycle?.vendorResponse?.body && (
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                      <div className="mt-1 text-sm font-medium text-slate-700 whitespace-pre-wrap">
                        {reviewCycle.vendorResponse.body}
                      </div>
                    </div>
                  )}
                  {Array.isArray(reviewCycle?.feedbackAttachments) && reviewCycle.feedbackAttachments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Feedback Attachments</div>
                      <div className="flex flex-col gap-2">
                        {reviewCycle.feedbackAttachments.map((att: any) => (
                          <button
                            key={att.assetId || att.filename}
                            onClick={() => router.push(`/?tab=wiki&pageId=${encodeURIComponent(String(att.assetId))}`)}
                            className="text-left px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            {att.filename || att.assetId}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {item.linkedResource && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Linked Resource</label>
                  {buildResourceLink(item.linkedResource, { reviewId: item.reviewId, cycleId: item.reviewCycleId, dedupKey: item.dedupKey }) ? (
                    <button
                      onClick={() => router.push(buildResourceLink(item.linkedResource, { reviewId: item.reviewId, cycleId: item.reviewCycleId, dedupKey: item.dedupKey }) as string)}
                      className="w-full text-left bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-blue-600 hover:text-blue-800"
                    >
                      {item.linkedResource.title || item.linkedResource.id} ({item.linkedResource.type})
                    </button>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700">
                      {item.linkedResource.title || item.linkedResource.id} ({item.linkedResource.type})
                    </div>
                  )}
                </div>
              )}

              {parentCandidates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Parent</label>
                  <select
                    value={item.parentId || ''}
                    onChange={(e) => handleUpdateItem({ parentId: e.target.value || null })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                    <option value="">No Parent</option>
                    {parentCandidates.map((p) => (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        {p.key}: {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Resource</label>
                <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Narrative Description</label>
                <textarea 
                  value={item.description || ''} 
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
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 pt-6">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Work Item Comments</div>
              </div>
              <CommentsDrawer
                embedded
                isOpen
                onClose={() => {}}
                resource={{
                  type: 'workitems.item',
                  id: String(item._id || item.id),
                  title: item.title
                }}
                currentUser={currentUser || undefined}
                initialFilter="all"
                reviewId={null}
                suppressNewThread={false}
                initialThreadId={initialThreadId}
              />
            </div>
             {item.linkedResource?.type === 'architecture_diagram' && item.reviewCycleId && (
               <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                 <div className="px-6 pt-6">
                   <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Review Comments</div>
                 </div>
                 <CommentsDrawer
                   embedded
                   isOpen
                   onClose={() => {}}
                   resource={{
                     type: 'architecture_diagram',
                     id: String(item.linkedResource.id),
                     title: item.linkedResource.title || item.title
                   }}
                   currentUser={currentUser || undefined}
                    initialFilter="current"
                    initialCycleId={item.reviewCycleId}
                    currentReviewCycleId={item.reviewCycleId}
                    reviewId={item.reviewId || null}
                    suppressNewThread
                  />
                </div>
              )}
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
                   <button onClick={() => {}} className="text-[10px] font-black text-blue-600 uppercase hover:underline">+ Link Artifact</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col gap-2">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                        <select
                          value={linkType}
                          onChange={(e) => setLinkType(e.target.value as WorkItemLink['type'])}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold"
                        >
                          <option value="RELATES_TO">Relates To</option>
                          <option value="BLOCKS">Blocks</option>
                          <option value="IS_BLOCKED_BY">Is Blocked By</option>
                          <option value="DUPLICATES">Duplicates</option>
                          <option value="IS_DUPLICATED_BY">Is Duplicated By</option>
                        </select>
                      </div>
                      <div className="flex-1 min-w-[220px] flex flex-col gap-2">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Target Key</label>
                        <input
                          value={linkKey}
                          onChange={(e) => setLinkKey(e.target.value)}
                          placeholder="CORE-123"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold"
                        />
                      </div>
                      <button
                        onClick={() => handleAddLink(linkKey, linkType)}
                        className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl"
                      >
                        Add Link
                      </button>
                   </div>
                   {(item.links || []).map((link, i) => {
                     const meta = resolvedLinks[String(link.targetId)] || {};
                     return (
                     <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                              <i className="fas fa-link text-xs"></i>
                           </div>
                           <div>
                              <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest block mb-0.5">{link.type.replace(/_/g, ' ')}</span>
                              <h5 className="text-sm font-bold text-slate-700">
                                {meta.key || link.targetKey || 'Linking...'}: {meta.title || link.targetTitle || 'Fetching status...'}
                              </h5>
                              {(meta.type || meta.status) && (
                                <div className="text-[9px] font-bold text-slate-400 uppercase">
                                  {meta.type ? meta.type.replace('_', ' ') : ''}{meta.type && meta.status ? ' • ' : ''}{meta.status || ''}
                                </div>
                              )}
                           </div>
                        </div>
                        <button onClick={() => handleUpdateItem({ links: item.links?.filter((_, idx) => idx !== i) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"><i className="fas fa-unlink text-xs"></i></button>
                     </div>
                   )})}
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
          <Suspense fallback={<div className="p-10"><div className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse"></div></div>}>
            <WorkItemAttachmentsPanel
              attachments={item.attachments || []}
              uploading={uploading}
              onTriggerUpload={() => fileInputRef.current?.click()}
              onFileChange={handleFileUpload}
              fileInputRef={fileInputRef}
              onDelete={deleteAttachment}
              onReplace={replaceAttachment}
            />
          </Suspense>
        )}

        {activeTab === 'activity' && (
          <Suspense fallback={<div className="p-10"><div className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse"></div></div>}>
            <WorkItemActivityPanel activity={item.activity} />
          </Suspense>
        )}

        {activeTab === 'ai' && (
          <Suspense fallback={
            <div className="p-10">
              <div className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse"></div>
            </div>
          }>
            <WorkItemAiPanel
              aiResult={aiResult}
              isAiProcessing={isAiProcessing}
              onRunTool={runAiTool}
              onCommit={(value) => handleUpdateItem({ aiWorkPlan: value })}
              onDiscard={() => setAiResult(null)}
            />
          </Suspense>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}} />
      {toast && (
        <div className="absolute bottom-6 right-6 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
};

export default WorkItemDetails;
