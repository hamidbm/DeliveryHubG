
import React, { useState, useRef, useMemo } from 'react';
import { WikiPage } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';
import { marked } from 'marked';

interface WikiFormProps {
  initialTitle?: string;
  initialContent?: string;
  initialAuthor?: string;
  initialCreatedAt?: string;
  initialCategory?: string;
  initialBundleId?: string;
  initialApplicationId?: string;
  initialMilestoneId?: string;
  parentId?: string;
  spaceId: string;
  id?: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
}

const WIKI_CATEGORIES = ["Technical", "Governance", "Process", "Security", "Architecture", "Operational"];

const WikiForm: React.FC<WikiFormProps> = ({ 
  initialTitle = '', 
  initialContent = '', 
  initialAuthor,
  initialCreatedAt,
  initialCategory = '',
  initialBundleId = '',
  initialApplicationId = '',
  initialMilestoneId = '',
  parentId: initialParentId, 
  spaceId,
  id,
  allPages,
  currentUser,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [parentId, setParentId] = useState(initialParentId || '');
  const [category, setCategory] = useState(initialCategory);
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const renderedContent = useMemo(() => {
    try {
      return marked.parse(content || '_No content to preview_');
    } catch (e) {
      return 'Error rendering preview';
    }
  }, [content]);

  // Dependent filters
  const filteredApps = useMemo(() => {
    return bundleId ? APPLICATIONS.filter(a => a.bundleId === bundleId) : APPLICATIONS;
  }, [bundleId]);

  const filteredMilestones = useMemo(() => {
    return applicationId ? MILESTONES.filter(m => m.applicationId === applicationId) : [];
  }, [applicationId]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);

    const payload = {
      _id: id,
      title: title.trim(),
      content,
      parentId: parentId || undefined,
      spaceId,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      category: category || undefined,
      author: initialAuthor || currentUser?.name || 'System',
      lastModifiedBy: currentUser?.name || 'System',
      createdAt: initialCreatedAt
    };

    try {
      const res = await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSaveSuccess(data.result?.insertedId || id);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn bg-white relative">
      <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <i className="fas fa-pen-nib text-xs"></i>
          </div>
          <span className="text-sm font-bold text-slate-800 truncate max-w-[300px]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-xl">Discard</button>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-8 py-2 bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
            {isSaving ? 'Saving...' : 'Publish Update'}
          </button>
        </div>
      </header>

      {/* Metadata Context Bar */}
      <div className="px-10 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle</label>
          <select 
            value={bundleId}
            onChange={(e) => { setBundleId(e.target.value); setApplicationId(''); setMilestoneId(''); }}
            className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="">No Bundle</option>
            {BUNDLES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Application</label>
          <select 
            value={applicationId}
            onChange={(e) => { setApplicationId(e.target.value); setMilestoneId(''); }}
            className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="">No Application</option>
            {filteredApps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone</label>
          <select 
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            disabled={!applicationId}
            className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all disabled:opacity-30"
          >
            <option value="">No Milestone</option>
            {filteredMilestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col p-12 overflow-y-auto custom-scrollbar">
          <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl font-black text-slate-900 w-full border-none focus:ring-0 p-0 mb-12"
            placeholder="Title"
          />
          <textarea 
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 w-full border-none focus:ring-0 p-0 text-slate-600 leading-relaxed resize-none text-lg font-medium"
            placeholder="Edit content..."
          />
        </div>
        <div className="w-1/2 bg-slate-50/30 p-12 overflow-y-auto custom-scrollbar">
          <div className="prose prose-slate prose-xl max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
        </div>
      </div>
    </div>
  );
};

export default WikiForm;
