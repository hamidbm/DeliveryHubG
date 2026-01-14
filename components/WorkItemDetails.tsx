
import React, { useState, useEffect, useRef } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment } from '../types';
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
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'links' | 'attachments' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'history' | 'comments'>('all');
  
  // Linking & Tagging States
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<WorkItem[]>([]);
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');
  const [newLabel, setNewLabel] = useState('');

  // Load detailed item data including links, activity, and subtasks
  useEffect(() => {
    const loadFullDetails = async () => {
      try {
        const [itemRes, subRes] = await Promise.all([
          fetch(`/api/work-items/${initialItem._id || initialItem.id}`),
          fetch(`/api/work-items?parentId=${initialItem._id || initialItem.id}`)
        ]);
        const itemData = await itemRes.json();
        const subData = await subRes.json();
        setItem(itemData);
        setSubtasks(subData);
      } catch (err) { console.error(err); }
    };
    loadFullDetails();
  }, [initialItem, activeTab]); // Refresh on tab change to catch latest activity

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        // Fetch fresh data to get computed activity log from backend
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

  const addComment = async () => {
    if (!newComment.trim()) return;
    const comment: WorkItemComment = {
      author: 'Current User', // In a real app, this comes from session
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

  // Define simulateFileUpload to provide mock artifact upload functionality
  const simulateFileUpload = async () => {
    const fileName = window.prompt("Enter artifact name (e.g., ArchitectureDiagram.pdf):");
    if (!fileName) return;

    const newAttachment: WorkItemAttachment = {
      name: fileName,
      size: Math.floor(Math.random() * 2048 * 1024) + 512 * 1024, // Random size between 0.5MB and 2.5MB
      type: 'application/pdf',
      url: '#',
      uploadedBy: 'Current User',
      createdAt: new Date().toISOString()
    };

    const attachments = [...(item.attachments || []), newAttachment];
    await handleUpdateItem({ attachments });
  };

  const createSubtask = async () => {
    const title = window.prompt("Enter subtask summary:");
    if (!title) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: WorkItemType.SUBTASK,
          title,
          parentId: item._id || item.id,
          bundleId: item.bundleId,
          applicationId: item.applicationId,
          status: WorkItemStatus.TODO,
          priority: 'MEDIUM'
        })
      });
      if (res.ok) {
        const subRes = await fetch(`/api/work-items?parentId=${item._id || item.id}`);
        setSubtasks(await subRes.json());
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleLinkSearch = async (q: string) => {
    setLinkSearch(q);
    if (q.length < 2) return;
    const res = await fetch(`/api/work-items?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setLinkResults(data.filter((i: WorkItem) => (i._id || i.id) !== (item._id || item.id)));
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

  const isWatching = item.watchers?.includes('Current User');

  const filteredActivity = (item.activity || []).filter(act => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'history') return act.action !== 'COMMENT_ADDED'; // If we specifically had a comment action
    return true; 
  });

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl">
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
                   <span className="text-blue-500">Parent Linked</span>
                 </>
               )}
            </span>
            <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">{item.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
            onClick={toggleWatching}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
              isWatching ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-amber-400'
            }`}
            title={isWatching ? "Stop watching" : "Watch item"}
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

      {/* Navigation Tabs */}
      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
          { id: 'comments', icon: 'fa-comments', label: 'Comments' },
          { id: 'links', icon: 'fa-link', label: 'Links' },
          { id: 'attachments', icon: 'fa-paperclip', label: 'Artifacts' },
          { id: 'activity', icon: 'fa-history', label: 'Activity' }
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
            {tab.id === 'comments' && (item.comments?.length || 0) > 0 && (
               <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[8px] flex items-center justify-center font-bold">{item.comments?.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FAFAFA]">
        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
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
                <DetailField label="Estimation (Story Pts)">
                    <input 
                      type="number"
                      value={item.storyPoints || 0}
                      onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                      placeholder="0"
                    />
                </DetailField>
              </div>
            </div>

            {/* Time Tracking Section */}
            <div className="p-8 bg-slate-900 rounded-[2rem] text-white space-y-6 shadow-2xl">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <i className="fas fa-clock text-blue-400"></i>
                 Delivery Time Tracking (Hours)
               </h4>
               <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter ml-1">Estimated Effort</label>
                    <input 
                      type="number"
                      value={item.timeEstimate || 0}
                      onChange={(e) => handleUpdateItem({ timeEstimate: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter ml-1">Logged Actuals</label>
                    <input 
                      type="number"
                      value={item.timeLogged || 0}
                      onChange={(e) => handleUpdateItem({ timeLogged: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="0.0"
                    />
                  </div>
               </div>
               {item.timeEstimate ? (
                 <div className="pt-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                       <span className="text-slate-500">Utilization</span>
                       <span className={item.timeLogged! > item.timeEstimate! ? 'text-red-400' : 'text-emerald-400'}>
                         {Math.round((item.timeLogged! / item.timeEstimate!) * 100)}%
                       </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                       <div 
                        className={`h-full transition-all duration-1000 ${item.timeLogged! > item.timeEstimate! ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min((item.timeLogged! / item.timeEstimate!) * 100, 100)}%` }}
                       />
                    </div>
                 </div>
               ) : null}
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
              <DetailField label="Tags & Labels">
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-100 rounded-2xl min-h-[50px]">
                    {item.labels?.map(label => (
                      <span key={label} className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-600 flex items-center gap-2 group">
                        {label}
                        <button onClick={() => removeLabel(label)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <i className="fas fa-times scale-75"></i>
                        </button>
                      </span>
                    ))}
                    <div className="relative">
                      <input 
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                        className="bg-transparent border-none p-1 text-[10px] font-bold outline-none w-32 placeholder:text-slate-300"
                        placeholder="+ Add label..."
                      />
                    </div>
                </div>
              </DetailField>

              <DetailField label="Core Implementation Notes">
                <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 min-h-[150px] prose prose-slate text-sm">
                    {item.description || 'No execution blueprints provided.'}
                </div>
              </DetailField>
            </div>

            {/* Watchers UI */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Stakeholder Group ({item.watchers?.length || 0})</h4>
               <div className="flex flex-wrap gap-3">
                  {item.watchers?.map(watcher => (
                    <div key={watcher} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(watcher)}&background=random&size=24`} className="w-4 h-4 rounded-full" />
                       <span className="text-[10px] font-bold text-slate-700">{watcher}</span>
                    </div>
                  ))}
                  {(!item.watchers || item.watchers.length === 0) && (
                    <p className="text-[10px] font-medium text-slate-300 italic">No active stakeholders established.</p>
                  )}
               </div>
            </div>

            {/* Subtasks Section */}
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-diagram-project"></i>
                    Decomposition / Tasks
                  </h4>
                  <button onClick={createSubtask} className="text-[9px] font-black text-blue-600 uppercase hover:underline">
                    + Link Task
                  </button>
               </div>
               <div className="space-y-2">
                  {subtasks.length === 0 ? (
                    <p className="text-[10px] font-medium text-slate-300 italic px-2">No decomposed subtasks established.</p>
                  ) : subtasks.map(sub => (
                    <div key={sub._id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-sm transition-all group">
                       <div className="flex items-center gap-3">
                          <i className="fas fa-check-circle text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                          <span className={`text-[12px] font-bold ${sub.status === WorkItemStatus.DONE ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                             {sub.title}
                          </span>
                       </div>
                       <span className={`text-[8px] font-black px-2 py-0.5 rounded border ${
                         sub.status === WorkItemStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-400 border-slate-200'
                       } uppercase`}>{sub.status}</span>
                    </div>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <ContextItem label="Business Unit" value={bundles.find(b => b._id === item.bundleId)?.name || 'Platform'} />
                <ContextItem label="System Asset" value={applications.find(a => a._id === item.applicationId || a.id === item.applicationId)?.name || 'Shared Services'} />
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <header className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conversation Log</h4>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                  {item.comments?.length || 0} entries
                </span>
             </header>

             <div className="space-y-8">
                {(item.comments || []).length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                    <i className="fas fa-comments text-4xl mb-4 text-slate-100"></i>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Start the discussion...</p>
                  </div>
                ) : (
                  item.comments?.map((c, i) => (
                    <div key={i} className="flex gap-4 group animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>
                       <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&size=48`} className="w-10 h-10 rounded-2xl shadow-sm shrink-0" />
                       <div className="flex-1 bg-white p-6 rounded-3xl rounded-tl-none border border-slate-100 group-hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{c.author}</span>
                                {c.author === 'Current User' && <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Me</span>}
                             </div>
                             <span className="text-[9px] text-slate-400 font-bold">{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">{c.body}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>

             <div className="sticky bottom-0 bg-[#FAFAFA] pt-6 pb-2">
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-6 space-y-4">
                  <textarea 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Contribute to this artifact's history..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 h-32 resize-none transition-all"
                  />
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Supports Markdown rendering</span>
                    <button 
                      onClick={addComment}
                      disabled={saving || !newComment.trim()}
                      className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 hover:bg-blue-600"
                    >
                      Commit Comment
                    </button>
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'links' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Traceability Graph</h4>
                <button 
                  onClick={() => setIsLinking(true)}
                  className="px-6 py-2 bg-blue-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:bg-blue-700"
                >
                  <i className="fas fa-plus"></i>
                  Add Link
                </button>
             </div>

             {isLinking && (
               <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-xl space-y-6 animate-fadeIn">
                  <div className="flex flex-col gap-4">
                     <div className="flex gap-4">
                        <select 
                          value={linkType} 
                          onChange={(e) => setLinkType(e.target.value as any)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/10"
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
                              placeholder="Search artifact key or title..."
                              value={linkSearch}
                              onChange={(e) => handleLinkSearch(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                            />
                            {linkResults.length > 0 && linkSearch.length >= 2 && (
                              <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 shadow-2xl rounded-[1.5rem] overflow-hidden z-[110] max-h-60 overflow-y-auto">
                                {linkResults.map(res => (
                                  <button 
                                    key={res._id || res.id}
                                    onClick={() => createLink(res)}
                                    className="w-full text-left p-4 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                                  >
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{res.key}</span>
                                        <span className="text-sm font-bold text-slate-700 truncate">{res.title}</span>
                                      </div>
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                     </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setIsLinking(false); setLinkSearch(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancel linking</button>
                  </div>
               </div>
             )}

             <div className="space-y-4">
                {(item.links || []).length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                    <i className="fas fa-link text-4xl mb-4 text-slate-100"></i>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No cross-artifact dependencies.</p>
                  </div>
                ) : (
                  item.links?.map((l, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] hover:border-blue-200 transition-all shadow-sm group">
                       <div className="flex items-center gap-6">
                          <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            l.type === 'BLOCKS' ? 'bg-red-50 text-red-500 border border-red-100' : 
                            l.type === 'IS_BLOCKED_BY' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-slate-50 text-slate-500 border border-slate-100'
                          }`}>
                            {l.type.replace('_', ' ')}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[11px] font-black text-slate-400 tracking-tight">{l.targetKey}</span>
                             <span className="text-sm font-bold text-slate-700 truncate max-w-[300px] group-hover:text-blue-600 transition-colors cursor-pointer">{l.targetTitle}</span>
                          </div>
                       </div>
                       <button className="w-8 h-8 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                          <i className="fas fa-times"></i>
                       </button>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'attachments' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution Evidence</h4>
                <button 
                  onClick={simulateFileUpload}
                  className="px-6 py-2 bg-emerald-600 text-white text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all"
                >
                  <i className="fas fa-upload"></i>
                  Upload Evidence
                </button>
             </div>

             <div className="grid grid-cols-1 gap-4">
                {(item.attachments || []).length === 0 ? (
                  <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                    <i className="fas fa-paperclip text-4xl mb-4 text-slate-100"></i>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No binary artifacts attached.</p>
                  </div>
                ) : (
                  item.attachments?.map((a, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 flex items-center gap-5 hover:shadow-lg transition-all group">
                       <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shadow-inner">
                          <i className="fas fa-file-pdf text-xl"></i>
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{a.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400 uppercase font-black">{Math.round(a.size/1024)} KB</span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                            <span className="text-[10px] text-slate-400 uppercase font-black">Logged by {a.uploadedBy}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 transition-all"><i className="fas fa-download"></i></button>
                         <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><i className="fas fa-trash-alt"></i></button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-10 space-y-10 animate-fadeIn">
             <header className="flex justify-between items-center shrink-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activity Audit Stream</h4>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                   {['all', 'history', 'comments'].map(f => (
                     <button 
                      key={f}
                      onClick={() => setActivityFilter(f as any)}
                      className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${activityFilter === f ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                       {f}
                     </button>
                   ))}
                </div>
             </header>

             {(filteredActivity || []).length === 0 ? (
               <div className="py-20 text-center bg-white rounded-[3rem] border border-slate-100">
                  <i className="fas fa-timeline text-4xl mb-4 text-slate-100"></i>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Registry audit trail empty.</p>
               </div>
             ) : (
               <div className="relative pl-8 space-y-12 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {filteredActivity.map((act, i) => (
                    <div key={i} className="relative group/act animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>
                       <div className={`absolute -left-[23px] top-1.5 w-4 h-4 rounded-full bg-white border-2 shadow-sm z-10 transition-all group-hover/act:scale-125 ${
                         act.action === 'CHANGED_STATUS' ? 'border-blue-500' : 
                         act.action === 'CREATED' ? 'border-emerald-500' : 'border-slate-200'
                       }`}></div>
                       <div className="space-y-3">
                          <div className="flex items-center gap-3">
                             <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(act.user)}&background=random&size=24`} className="w-6 h-6 rounded-lg shadow-sm" />
                             <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{act.user}</span>
                             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{new Date(act.createdAt).toLocaleString()}</span>
                          </div>
                          
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 group-hover/act:border-slate-200 transition-all group-hover/act:shadow-sm">
                             {act.action === 'CREATED' ? (
                               <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                  <i className="fas fa-star text-emerald-500 text-xs"></i>
                                  Initialized this artifact in the registry
                               </p>
                             ) : act.action === 'CHANGED_STATUS' ? (
                               <div className="flex items-center gap-4">
                                  <span className="text-[10px] font-black text-slate-400 uppercase">Status updated:</span>
                                  <div className="flex items-center gap-3">
                                     <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-black uppercase border border-slate-100 line-through opacity-50">{act.from}</span>
                                     <i className="fas fa-arrow-right text-slate-200 text-xs"></i>
                                     <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase border border-blue-100 shadow-sm">{act.to}</span>
                                  </div>
                               </div>
                             ) : (
                               <div className="space-y-1">
                                  <p className="text-sm font-bold text-slate-700">
                                     Updated <span className="text-blue-600 uppercase text-[10px] tracking-widest">{act.field}</span>
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                     <span className="italic truncate max-w-[150px]">{String(act.from || 'Empty')}</span>
                                     <i className="fas fa-chevron-right text-[8px] text-slate-300"></i>
                                     <span className="font-bold text-slate-800 truncate max-w-[200px]">{String(act.to)}</span>
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

const ContextItem = ({ label, value }: any) => (
  <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
     <span className="text-[11px] font-bold text-slate-800 truncate ml-4 text-right">{value}</span>
  </div>
);

export default WorkItemDetails;
