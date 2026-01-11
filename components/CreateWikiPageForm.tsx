
import React, { useState, useRef, useMemo } from 'react';
import { WikiPage, Application, Milestone, Bundle } from '../types';
import { BUNDLES, APPLICATIONS, MILESTONES } from '../constants';
import { marked } from 'marked';

interface CreateWikiPageFormProps {
  parentId?: string;
  spaceId: string;
  allPages: WikiPage[];
  currentUser?: { name: string };
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
}

const WIKI_CATEGORIES = ["Technical", "Governance", "Process", "Security", "Architecture", "Operational"];

const CreateWikiPageForm: React.FC<CreateWikiPageFormProps> = ({ 
  parentId: initialParentId, 
  spaceId,
  allPages,
  currentUser,
  onSaveSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState(initialParentId || '');
  const [category, setCategory] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
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

    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

    const payload: Partial<WikiPage> = {
      title: title.trim(),
      content,
      parentId: parentId || undefined,
      spaceId,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      author: currentUser?.name || 'System',
      lastModifiedBy: currentUser?.name || 'System'
    };

    try {
      const res = await fetch('/api/wiki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSaveSuccess(data.result?.insertedId || '');
      }
    } catch (err) {
      console.error("Knowledge creation failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fadeIn relative">
      <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-plus text-sm"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Creation Mode</span>
            <span className="text-sm font-bold text-slate-800">New Documentation Node</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-black text-slate-400 hover:text-slate-800 transition-all uppercase tracking-widest rounded-xl"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-8 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all uppercase tracking-widest flex items-center gap-3"
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
            {isSaving ? 'Publishing...' : 'Publish Entry'}
          </button>
        </div>
      </header>

      {/* Metadata Context Bar */}
      <div className="px-10 py-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Bundle Association</label>
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
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Application Hub</label>
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
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Milestone</label>
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

        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Content Category</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
          >
            <option value="">Uncategorized</option>
            {WIKI_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex w-full overflow-hidden">
        <div className="flex flex-col w-1/2 border-r border-slate-100 overflow-y-auto p-12 custom-scrollbar">
           <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl font-black text-slate-900 w-full border-none focus:ring-0 p-0 placeholder:text-slate-100 tracking-tighter bg-transparent mb-12"
            placeholder="Document Identity"
            autoFocus
          />
          <textarea 
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 border-none focus:ring-0 p-0 text-slate-600 leading-relaxed resize-none text-lg placeholder:text-slate-100 font-medium bg-transparent"
            placeholder="Draft your content using Markdown..."
          />
        </div>
        <div className="w-1/2 bg-slate-50/30 overflow-y-auto p-12 custom-scrollbar">
          <div className="prose prose-slate prose-xl max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default CreateWikiPageForm;
