
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone } from '../types';
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
  const [subtasks, setSubtasks] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links' | 'attachments' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [logTimeValue, setLogTimeValue] = useState<number>(0);
  const [newLabel, setNewLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Linking States
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<WorkItem[]>([]);
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');
  const [searchingLinks, setSearchingLinks] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
      } catch (err) { console.error(err); }
    };
    loadFullDetails();
  }, [initialItem, activeTab]);

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

  const handleLinkSearch = async (q: string) => {
    setLinkSearch(q);
    if (q.length < 2) {
      setLinkResults([]);
      return;
    }
    setSearchingLinks(true);
    try {
      const res = await fetch(`/api/work-items?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      // Filter out current item from results
      setLinkResults(data.filter((i: WorkItem) => (i._id || i.id) !== (item._id || item.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingLinks(false);
    }
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
    setLinkResults([]);
  };

  const removeLink = async (index: number) => {
    const links = (item.links || []).filter((_, i) => i !== index);
    await handleUpdateItem({ links });
  };

  const handleLogWork = async () => {
    if (logTimeValue <= 0) return;
    const newLogged = (item.timeLogged || 0) + logTimeValue;
    await handleUpdateItem({ timeLogged: newLogged });
    setLogTimeValue(0);
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

  const addLabel = async () => {
    if (!newLabel.trim()) return;
    const labels = item.labels || [];
    if (!labels.includes(newLabel.trim())) {
      await handleUpdateItem({ labels: [...labels, newLabel.trim()] });
    }
    setNewLabel('');
  };

  const removeLabel = async (label: string) => {
    const labels = (item.labels || []).filter(l => l !== label);
    await handleUpdateItem({ labels });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Artifact exceeds the 5MB registry limit.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const newAttachment: WorkItemAttachment = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: base64,
        uploadedBy: 'Current User',
        createdAt: new Date().toISOString()
      };

      const attachments = [...(item.attachments || []), newAttachment];
      await handleUpdateItem({ attachments });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const deleteAttachment = async (index: number) => {
    if (!confirm("Remove this artifact from the registry?")) return;
    const attachments = (item.attachments || []).filter((_, i) => i !== index);
    await handleUpdateItem({ attachments });
  };

  const toggleWatching = async () => {
    const userName = 'Current User'; 
    const watchers = item.watchers || [];
    const nextWatchers = watchers.includes(userName) 
      ? watchers.filter(w => w !== userName)
      : [...watchers, userName];
    await handleUpdateItem({ watchers: nextWatchers });
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      case WorkItemType.SUBTASK: return 'fa-diagram-project text-slate-400';
      default: return 'fa-file-lines text-blue-500';
    }
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('image')) return 'fa-file-image text-emerald-500';
    if (mime.includes('pdf')) return 'fa-file-pdf text-red-500';
    if (mime.includes('zip') || mime.includes('rar')) return 'fa-file-zipper text-amber-500';
    if (mime.includes('javascript') || mime.includes('json') || mime.includes('html')) return 'fa-file-code text-blue-500';
    return 'fa-file-lines text-slate-400';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isWatching = item.watchers?.includes('Current User');
  const activityStream = [...(item.activity || [])].reverse();

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
                   <span className="text-blue-500">Sub-artifact of Parent</span>
                 </>
               )}
            </span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
            onClick={toggleWatching}
            title={isWatching ? "Unwatch" : "Watch"}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
              isWatching ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-amber-400'
            }`}
           >
              <i className={`fas fa-eye ${isWatching ? 'animate-pulse' : ''}`}></i>
           </button>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
             item.type === WorkItemType.EPIC ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
           }`}>
              <i className={`fas ${getIcon(item.type).split(' ')[0]} mr-1`}></i>
              {item.type}
           </span>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
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
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <DetailField label="Current Status">
                    <select 
                      value={item.status} 
                      onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                    >
                      {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </DetailField>
                <DetailField label="Urgency">
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

              <div className="grid grid-cols-2 gap-6">
                <DetailField label="Assigned Personnel">
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                    />
                </DetailField>
              </div>

              <div className="space-y-2">
                <DetailField label="Delivery Milestone">
                  <select 
                    value={item.milestoneIds?.[0] || ''}
                    onChange={(e) => handleUpdateItem({ milestoneIds: e.target.value ? [e.target.value] : [] })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                  >
                    <option value="">Unassigned</option>
                    {milestones.map(ms => (
                      <option key={ms._id} value={ms._id}>{ms.name} ({ms.status})</option>
                    ))}
                  </select>
                </DetailField>
              </div>
            </div>

            {/* Time Tracking Section */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-clock"></i>
                Effort Tracking
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                 <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <span>Progressed: {item.timeLogged || 0}h</span>
                       <span>Estimate: {item.timeEstimate || 0}h</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                       <div 
                        className="h-full bg-blue-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(((item.timeLogged || 0) / (item.timeEstimate || 1)) * 100, 100)}%` }} 
                       />
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      placeholder="Hours" 
                      value={logTimeValue || ''} 
                      onChange={(e) => setLogTimeValue(parseFloat(e.target.value))}
                      className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none w-24"
                    />
                    <button 
                      onClick={handleLogWork}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-black/10"
                    >
                      Log Work
                    </button>
                    <button 
                      onClick={() => {
                        const est = window.prompt("New Estimate (hours):", String(item.timeEstimate || 0));
                        if (est) handleUpdateItem({ timeEstimate: parseFloat(est) });
                      }}
                      className="text-slate-400 hover:text-blue-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      Refine Est.
                    </button>
                 </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <DetailField label="Artifact Labels">
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl min-h-[50px]">
                    {item.labels?.map(label => (
                      <span key={label} className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 flex items-center gap-2 group">
                        {label}
                        <button onClick={() => removeLabel(label)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <i className="fas fa-times scale-75"></i>
                        </button>
                      </span>
                    ))}
                    <input 
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                      className="bg-transparent border-none p-1 text-[10px] font-bold outline-none w-32"
                      placeholder="+ Tag artifact..."
                    />
                </div>
              </DetailField>

              <DetailField label="Functional Description">
                <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 min-h-[150px] prose prose-slate text-sm">
                    {item.description || 'No implementation detail provided.'}
                </div>
              </DetailField>
            </div>
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
                <textarea 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Annotate this record..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-sm font-medium outline-none focus:border-blue-500 transition-all resize-none h-32"
                />
                <div className="flex justify-end">
                   <button 
                    onClick={addComment}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                   >
                     Post Comment
                   </button>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <header className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">System Dependencies</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Establish blocks and relationships</p>
                </div>
                <button 
                  onClick={() => setIsLinking(true)}
                  className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-black/10 flex items-center gap-2"
                >
                   <i className="fas fa-link"></i>
                   Link Artifact
                </button>
             </header>

             {isLinking && (
               <div className="bg-white p-8 rounded-[2rem] border border-blue-200 shadow-2xl shadow-blue-500/10 space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <DetailField label="Relationship Logic">
                        <select 
                          value={linkType}
                          onChange={(e) => setLinkType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        >
                           <option value="RELATES_TO">Relates to</option>
                           <option value="BLOCKS">Blocks</option>
                           <option value="IS_BLOCKED_BY">Is blocked by</option>
                           <option value="DUPLICATES">Duplicates</option>
                           <option value="IS_DUPLICATED_BY">Is duplicated by</option>
                        </select>
                     </DetailField>
                     <DetailField label="Search Registry">
                        <div className="relative">
                          <input 
                            type="text"
                            value={linkSearch}
                            onChange={(e) => handleLinkSearch(e.target.value)}
                            placeholder="Type Key or Title (e.g. CORE-1)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500"
                          />
                          {searchingLinks && <i className="fas fa-circle-notch fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>}
                        </div>
                     </DetailField>
                  </div>

                  {linkResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                       {linkResults.map(res => (
                         <button 
                          key={res._id || res.id}
                          onClick={() => createLink(res)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 rounded-xl transition-all group"
                         >
                            <div className="flex items-center gap-3">
                               <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">{res.key}</span>
                               <span className="text-sm font-bold text-slate-700 truncate max-w-md">{res.title}</span>
                            </div>
                            <i className="fas fa-plus text-slate-300 group-hover:text-blue-500"></i>
                         </button>
                       ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                     <button onClick={() => { setIsLinking(false); setLinkResults([]); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Dismiss</button>
                  </div>
               </div>
             )}

             <div className="space-y-4">
                {!item.links || item.links.length === 0 ? (
                  <div className="py-24 bg-white rounded-[3rem] border border-slate-100 shadow-inner flex flex-col items-center justify-center opacity-40">
                     <i className="fas fa-link-slash text-5xl mb-4"></i>
                     <p className="text-xs font-black uppercase tracking-widest">No established dependencies.</p>
                  </div>
                ) : (
                  item.links.map((link, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group flex items-center justify-between">
                       <div className="flex items-center gap-6">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                            link.type === 'BLOCKS' || link.type === 'IS_BLOCKED_BY' ? 'bg-red-50 text-red-600 border-red-100' :
                            link.type === 'RELATES_TO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {link.type.replace(/_/g, ' ')}
                          </span>
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{link.targetKey}</span>
                             <span className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors cursor-pointer">{link.targetTitle}</span>
                          </div>
                       </div>
                       <button 
                        onClick={() => removeLink(idx)}
                        className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-white hover:shadow-lg transition-all"
                       >
                          <i className="fas fa-trash-can"></i>
                       </button>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="p-10 space-y-8 animate-fadeIn">
             <header className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Delivery Artifacts</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked documentation and assets</p>
                </div>
                <div className="flex items-center gap-4">
                   <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileUpload}
                   />
                   <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-black/10 flex items-center gap-2 disabled:opacity-50"
                   >
                      {uploading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
                      {uploading ? 'Processing...' : 'Upload Artifact'}
                   </button>
                </div>
             </header>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!item.attachments || item.attachments.length === 0 ? (
                  <div className="col-span-full py-24 bg-white rounded-[3rem] border border-slate-100 shadow-inner flex flex-col items-center justify-center opacity-40">
                     <i className="fas fa-paperclip text-5xl mb-4"></i>
                     <p className="text-xs font-black uppercase tracking-widest">No artifacts established in registry.</p>
                  </div>
                ) : (
                  item.attachments.map((file, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group flex items-start gap-6 overflow-hidden relative">
                       <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
                          <i className={`fas ${getFileIcon(file.type)} text-xl`}></i>
                       </div>
                       <div className="flex-1 min-w-0 pr-12">
                          <h5 className="text-sm font-black text-slate-800 truncate leading-tight mb-1">{file.name}</h5>
                          <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                             <span>{formatFileSize(file.size)}</span>
                             <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                             <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[8px] font-black text-blue-500 uppercase tracking-tighter mt-2">Added by {file.uploadedBy}</p>
                       </div>
                       
                       <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={file.url} 
                            download={file.name}
                            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-white hover:shadow-lg transition-all"
                          >
                             <i className="fas fa-download"></i>
                          </a>
                          <button 
                            onClick={() => deleteAttachment(idx)}
                            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white hover:shadow-lg transition-all"
                          >
                             <i className="fas fa-trash-can"></i>
                          </button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-12 animate-fadeIn">
             <header className="flex justify-between items-center shrink-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Audit Log</h4>
             </header>

             {activityStream.length === 0 ? (
               <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                  <i className="fas fa-history text-4xl mb-4 text-slate-100"></i>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Registry registry clean.</p>
               </div>
             ) : (
               <div className="relative pl-10 space-y-12 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {activityStream.map((act, i) => (
                    <div key={i} className="relative group animate-fadeIn">
                       <div className={`absolute -left-[27px] top-1.5 w-5 h-5 rounded-full bg-white border-4 shadow-sm z-10 transition-all ${
                         act.action === 'CHANGED_STATUS' ? 'border-blue-500' : 
                         act.action === 'CREATED' ? 'border-emerald-500' : 'border-slate-200'
                       }`}></div>
                       <div className="space-y-3">
                          <div className="flex items-center gap-3">
                             <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(act.user)}&background=random&size=24`} className="w-6 h-6 rounded-lg shadow-sm" />
                             <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{act.user}</span>
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(act.createdAt).toLocaleString()}</span>
                          </div>
                          
                          <div className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                             {act.action === 'CREATED' ? (
                               <p className="text-sm font-bold text-slate-700">Initialized artifact in delivery cluster</p>
                             ) : (
                               <div className="flex flex-col gap-1">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{act.field?.replace(/([A-Z])/g, ' $1')}</p>
                                  <div className="flex items-center gap-3">
                                     <span className="text-xs text-slate-400 line-through bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{String(act.from || 'None')}</span>
                                     <i className="fas fa-arrow-right text-[10px] text-slate-200"></i>
                                     <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{String(act.to)}</span>
                                  </div>
                               </div>
                             )}
                          </div>
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

export default WorkItemDetails;
