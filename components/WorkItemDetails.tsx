
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment } from '../types';
import AssigneeSearch from './AssigneeSearch';

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
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links' | 'activity' | 'attachments'>('details');
  const [newComment, setNewComment] = useState('');
  
  // Linking States
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<WorkItem[]>([]);
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');

  // Load detailed item data including links and activity
  useEffect(() => {
    const loadFullDetails = async () => {
      try {
        const res = await fetch(`/api/work-items/${initialItem._id || initialItem.id}`);
        const data = await res.json();
        setItem(data);
      } catch (err) { console.error(err); }
    };
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
      author: 'Current User', // Real implementation would use session user
      body: newComment,
      createdAt: new Date().toISOString()
    };
    const updatedComments = [...(item.comments || []), comment];
    await handleUpdateItem({ comments: updatedComments });
    setNewComment('');
  };

  const handleLinkSearch = async (q: string) => {
    setLinkSearch(q);
    if (q.length < 2) return;
    const res = await fetch(`/api/work-items?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setLinkResults(data.filter((i: WorkItem) => i._id !== item._id));
  };

  const createLink = async (target: WorkItem) => {
    const newLink: WorkItemLink = {
      type: linkType,
      targetId: (target._id || target.id) as string,
      targetKey: target.key,
      targetTitle: target.title
    };
    const updatedLinks = [...(item.links || []), newLink];
    await handleUpdateItem({ links: updatedLinks });
    setIsLinking(false);
    setLinkSearch('');
  };

  const simulateFileUpload = async () => {
    const newAttach: WorkItemAttachment = {
      name: `document_${Math.floor(Math.random()*1000)}.pdf`,
      size: Math.floor(Math.random()*500000),
      type: 'application/pdf',
      url: '#',
      uploadedBy: 'Current User',
      createdAt: new Date().toISOString()
    };
    const updatedAttachments = [...(item.attachments || []), newAttach];
    await handleUpdateItem({ attachments: updatedAttachments });
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

      {/* Navigation Tabs */}
      <div className="flex px-10 border-b border-slate-100 bg-slate-50/50 overflow-x-auto no-scrollbar">
        {['details', 'comments', 'links', 'attachments', 'activity'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
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
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                     {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
               </DetailField>
               <DetailField label="Priority">
                  <select 
                    value={item.priority} 
                    onChange={(e) => handleUpdateItem({ priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                  >
                     <option value="CRITICAL">Critical</option>
                     <option value="HIGH">High</option>
                     <option value="MEDIUM">Medium</option>
                     <option value="LOW">Low</option>
                  </select>
               </DetailField>
            </div>

            <div className="grid grid-cols-2 gap-6">
               <DetailField label="Assignee">
                  <AssigneeSearch 
                    currentAssignee={item.assignedTo} 
                    onSelect={(name) => handleUpdateItem({ assignedTo: name })} 
                  />
               </DetailField>
               <DetailField label="Story Points">
                  <input 
                    type="number"
                    value={item.storyPoints || 0}
                    onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                    placeholder="0"
                  />
               </DetailField>
            </div>

            <DetailField label="Description">
               <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 min-h-[150px] prose prose-slate text-sm">
                  {item.description || 'No system documentation available.'}
               </div>
            </DetailField>

            <div className="pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
                <ContextItem label="Business Cluster" value={bundles.find(b => b._id === item.bundleId)?.name || 'General'} />
                <ContextItem label="Delivery System" value={applications.find(a => a._id === item.applicationId || a.id === item.applicationId)?.name || 'Platform Shared'} />
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-8 animate-fadeIn">
             <div className="space-y-6">
                {(item.comments || []).length === 0 ? (
                  <div className="py-20 text-center text-slate-300">
                    <i className="fas fa-comments text-4xl mb-4 opacity-10"></i>
                    <p className="text-xs font-bold uppercase tracking-widest">No conversation logs established.</p>
                  </div>
                ) : (
                  item.comments?.map((c, i) => (
                    <div key={i} className="flex gap-4 group">
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&size=40`} className="w-8 h-8 rounded-xl shadow-sm shrink-0" />
                       <div className="flex-1 bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 group-hover:bg-white transition-colors group-hover:shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{c.author}</span>
                             <span className="text-[8px] text-slate-400 font-bold">{new Date(c.createdAt).toLocaleString()}</span>
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
                  placeholder="Record findings or execution notes..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/10 h-24 resize-none mb-3"
                />
                <button 
                  onClick={addComment}
                  disabled={saving || !newComment.trim()}
                  className="w-full py-3.5 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Post To Log
                </button>
             </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="space-y-8 animate-fadeIn">
             <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Traceability Links</h4>
                <button 
                  onClick={() => setIsLinking(true)}
                  className="px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-2 shadow-sm"
                >
                  <i className="fas fa-plus"></i>
                  Add Relationship
                </button>
             </div>

             {isLinking && (
               <div className="bg-slate-50 p-6 rounded-[2rem] border border-blue-100 shadow-inner space-y-4">
                  <div className="flex gap-4">
                     <select 
                       value={linkType} 
                       onChange={(e) => setLinkType(e.target.value as any)}
                       className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none"
                     >
                        <option value="RELATES_TO">Relates To</option>
                        <option value="BLOCKS">Blocks</option>
                        <option value="IS_BLOCKED_BY">Is Blocked By</option>
                        <option value="DUPLICATES">Duplicates</option>
                     </select>
                     <div className="flex-1 relative">
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="Search key or title..."
                          value={linkSearch}
                          onChange={(e) => handleLinkSearch(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                        />
                        {linkResults.length > 0 && linkSearch.length >= 2 && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl overflow-hidden z-20 max-h-48 overflow-y-auto">
                             {linkResults.map(res => (
                               <button 
                                 key={res._id}
                                 onClick={() => createLink(res)}
                                 className="w-full text-left p-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                               >
                                  <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-black text-blue-600 uppercase">{res.key}</span>
                                     <span className="text-xs font-bold text-slate-700 truncate">{res.title}</span>
                                  </div>
                               </button>
                             ))}
                          </div>
                        )}
                     </div>
                  </div>
                  <button onClick={() => { setIsLinking(false); setLinkSearch(''); }} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel linking</button>
               </div>
             )}

             <div className="space-y-3">
                {(item.links || []).length === 0 ? (
                  <div className="py-20 text-center text-slate-300">
                    <i className="fas fa-link text-4xl mb-4 opacity-10"></i>
                    <p className="text-xs font-bold uppercase tracking-widest">No cross-item dependencies.</p>
                  </div>
                ) : (
                  item.links?.map((l, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all shadow-sm">
                       <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${
                            l.type === 'BLOCKS' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'
                          }`}>{l.type.replace('_', ' ')}</span>
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-400">{l.targetKey}</span>
                             <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{l.targetTitle}</span>
                          </div>
                       </div>
                       <button className="text-slate-200 hover:text-red-500 transition-colors"><i className="fas fa-times"></i></button>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="space-y-8 animate-fadeIn">
             <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution Evidence</h4>
                <button 
                  onClick={simulateFileUpload}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-2 shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <i className="fas fa-upload"></i>
                  Upload Evidence
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                {(item.attachments || []).length === 0 ? (
                  <div className="col-span-2 py-20 text-center text-slate-300">
                    <i className="fas fa-paperclip text-4xl mb-4 opacity-10"></i>
                    <p className="text-xs font-bold uppercase tracking-widest">No artifacts attached.</p>
                  </div>
                ) : (
                  item.attachments?.map((a, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4 hover:bg-white hover:shadow-sm transition-all group">
                       <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-500 shadow-sm">
                          <i className="fas fa-file-pdf"></i>
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{a.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black">{Math.round(a.size/1024)} KB • {a.uploadedBy}</p>
                       </div>
                       <button className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                          <i className="fas fa-trash-alt text-[10px]"></i>
                       </button>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6 animate-fadeIn">
             {(item.activity || []).length === 0 ? (
               <div className="py-20 text-center text-slate-300">
                  <i className="fas fa-timeline text-4xl mb-4 opacity-10"></i>
                  <p className="text-xs font-bold uppercase tracking-widest">Activity stream empty.</p>
               </div>
             ) : (
               <div className="relative pl-6 space-y-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {item.activity?.map((act, i) => (
                    <div key={i} className="relative">
                       <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-white border-2 border-slate-200 shadow-sm z-10"></div>
                       <div className="space-y-1">
                          <p className="text-xs text-slate-600">
                             <span className="font-black text-slate-800 uppercase text-[9px] mr-2">{act.user}</span>
                             {act.action === 'CREATED' ? 'initialized this artifact' : (
                               <span>
                                  updated <span className="font-bold text-blue-600">{act.field}</span>
                                  {act.from !== undefined && <span className="mx-1">from <span className="italic text-slate-400">{String(act.from)}</span></span>}
                                  to <span className="font-bold text-slate-800">{String(act.to)}</span>
                               </span>
                             )}
                          </p>
                          <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{new Date(act.createdAt).toLocaleString()}</span>
                       </div>
                    </div>
                  ))}
               </div>
             )}
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
     <span className="text-[10px] font-bold text-slate-700 truncate ml-2 text-right">{value}</span>
  </div>
);

export default WorkItemDetails;
