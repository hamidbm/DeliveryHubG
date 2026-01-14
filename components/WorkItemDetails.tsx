
import React, { useState } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';
import AssigneeSearch from './AssigneeSearch'; // Assuming AssigneeSearch is factored out as used in previous turn

interface WorkItemDetailsProps {
  item: WorkItem;
  bundles: Bundle[];
  applications: Application[];
  onUpdate: () => void;
  onClose: () => void;
}

const WorkItemDetails: React.FC<WorkItemDetailsProps> = ({ item: initialItem, bundles, applications, onUpdate, onClose }) => {
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links'>('details');
  const [newComment, setNewComment] = useState('');

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = { ...item, ...updates };
        setItem(updated);
        onUpdate();
      }
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    const comment = {
      author: 'Current User', // Replace with real user
      body: newComment,
      createdAt: new Date().toISOString()
    };
    const updatedComments = [...(item.comments || []), comment];
    await handleUpdateItem({ comments: updatedComments });
    setNewComment('');
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
           {saving && <i className="fas fa-circle-notch fa-spin text-blue-500 text-xs mr-2"></i>}
           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
             item.type === WorkItemType.EPIC ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
           }`}>
              <i className={`fas ${getIcon(item.type).split(' ')[0]} mr-1`}></i>
              {item.type}
           </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex px-10 border-b border-slate-100 bg-slate-50/50">
        {['details', 'comments', 'links'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
        {activeTab === 'details' && (
          <div className="space-y-10 animate-fadeIn">
            <div className="grid grid-cols-2 gap-6">
               <DetailField label="Status">
                  <select 
                    value={item.status} 
                    onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                  >
                     {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
               </DetailField>
               <DetailField label="Priority">
                  <select 
                    value={item.priority} 
                    onChange={(e) => handleUpdateItem({ priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                  >
                     <option value="CRITICAL">Critical</option>
                     <option value="HIGH">High</option>
                     <option value="MEDIUM">Medium</option>
                     <option value="LOW">Low</option>
                  </select>
               </DetailField>
            </div>

            <DetailField label="Assignee">
               <AssigneeSearch 
                 currentAssignee={item.assignedTo} 
                 onSelect={(name) => handleUpdateItem({ assignedTo: name })} 
               />
            </DetailField>

            <DetailField label="Description">
               <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 min-h-[150px] prose prose-slate text-sm">
                  {item.description || 'No system documentation available.'}
               </div>
            </DetailField>

            <div className="pt-6 border-t border-slate-50 space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-sitemap"></i>
                Environment Scope
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <ContextItem label="Cluster" value={bundles.find(b => b._id === item.bundleId)?.name || 'General'} />
                <ContextItem label="System" value={applications.find(a => a._id === item.applicationId || a.id === item.applicationId)?.name || 'Platform Shared'} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-8 animate-fadeIn">
             <div className="space-y-6">
                {(item.comments || []).length === 0 ? (
                  <div className="py-20 text-center text-slate-300">
                    <i className="fas fa-comments text-4xl mb-4 opacity-20"></i>
                    <p className="text-xs font-bold uppercase tracking-widest">No conversation logs yet.</p>
                  </div>
                ) : (
                  item.comments?.map((c, i) => (
                    <div key={i} className="flex gap-4">
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random`} className="w-8 h-8 rounded-xl shadow-sm shrink-0" />
                       <div className="flex-1 bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{c.author}</span>
                             <span className="text-[8px] text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{c.body}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>
             <div className="pt-6 border-t border-slate-100">
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Record execution notes or findings..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 h-24 resize-none mb-3"
                />
                <button 
                  onClick={addComment}
                  disabled={saving || !newComment.trim()}
                  className="w-full py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Post to Registry
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DetailField = ({ label, children }: any) => (
  <div className="space-y-2">
     <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
     {children}
  </div>
);

const ContextItem = ({ label, value }: any) => (
  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
     <span className="text-[10px] font-bold text-slate-700 truncate ml-2">{value}</span>
  </div>
);

export default WorkItemDetails;
