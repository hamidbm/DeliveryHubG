
import React, { useState, useRef, useMemo } from 'react';
import { WikiPage, Application, Milestone, Bundle } from '../types';
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

const WIKI_CATEGORIES = ["Architecture Decision Record (ADR)", "Low Level Design (LLD)", "Meeting Notes", "Runbook", "General"];

const WikiForm: React.FC<WikiFormProps> = ({ 
  initialTitle = '', 
  initialContent = '', 
  initialAuthor,
  initialCreatedAt,
  initialCategory = 'General',
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
  const [category, setCategory] = useState(initialCategory);
  const [bundleId, setBundleId] = useState(initialBundleId);
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId);
  const [status, setStatus] = useState<'Draft' | 'Published'>('Published');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'split'>('edit');
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const renderedContent = useMemo(() => {
    try {
      return marked.parse(content || '_No content to preview_');
    } catch (e) {
      return 'Error rendering preview';
    }
  }, [content]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);

    const payload: Partial<WikiPage> = {
      _id: id,
      title: title.trim(),
      content,
      spaceId,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      category,
      status,
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

  const insertTemplate = (tpl: string) => {
    let tplContent = '';
    if (tpl === 'ADR') tplContent = '\n\n# ADR: [Title]\n\n## Status\nProposed\n\n## Context\n...\n\n## Decision\n...\n\n## Consequences\n...';
    if (tpl === 'LLD') tplContent = '\n\n# LLD: [Title]\n\n## Introduction\n...\n\n## Architecture\n...\n\n## Data Model\n...';
    setContent(content + tplContent);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fadeIn">
      <header className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Editing Artifact</span>
            <input 
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent tracking-tight"
              placeholder="Page Title"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button onClick={() => setStatus('Draft')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Draft</button>
            <button onClick={() => setStatus('Published')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${status === 'Published' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Publish</button>
          </div>
          <button 
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2"
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
            Update Artifact
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col p-12 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-4 mb-6 border-b border-slate-50 pb-4">
            <button onClick={() => insertTemplate('ADR')} className="text-[10px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-widest">+ ADR</button>
            <button onClick={() => insertTemplate('LLD')} className="text-[10px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-widest">+ LLD</button>
            <div className="h-4 w-[1px] bg-slate-100 mx-2"></div>
            <button onClick={() => setViewMode(viewMode === 'split' ? 'edit' : 'split')} className="text-[10px] font-black text-slate-400 hover:text-blue-500 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-columns"></i> Split Preview
            </button>
          </div>

          <div className={`flex flex-1 gap-12 ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
            <textarea 
              ref={textAreaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`flex-1 border-none focus:ring-0 p-0 text-slate-700 leading-relaxed resize-none text-xl font-medium placeholder:text-slate-100 bg-transparent ${viewMode === 'split' ? 'border-r border-slate-50 pr-12' : ''}`}
            />
            {viewMode === 'split' && (
              <div className="flex-1 prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: renderedContent }} />
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <aside className="w-80 border-l border-slate-100 bg-slate-50/30 p-10 space-y-10 shrink-0">
          <div className="space-y-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Context Metadata</h4>
            <SidebarField label="Document Type" value={category} onChange={setCategory} options={WIKI_CATEGORIES} />
            <SidebarField label="Business Bundle" value={bundleId} onChange={setBundleId} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
            <SidebarField label="Target Application" value={applicationId} onChange={setApplicationId} options={APPLICATIONS.map(a => ({ id: a.id, name: a.name }))} />
            <SidebarField label="Delivery Milestone" value={milestoneId} onChange={setMilestoneId} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
          </div>
          
          <div className="pt-10 border-t border-slate-100">
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block mb-2">Audit Logs</span>
             <div className="space-y-3">
               <div className="flex gap-3">
                 <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black">SY</div>
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-slate-600">Created by {initialAuthor || 'System'}</span>
                   <span className="text-[8px] text-slate-400">{new Date(initialCreatedAt || Date.now()).toLocaleDateString()}</span>
                 </div>
               </div>
             </div>
          </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const SidebarField = ({ label, value, onChange, options }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-500 transition-all"
    >
      <option value="">Select {label}</option>
      {options.map((o: any) => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default WikiForm;
