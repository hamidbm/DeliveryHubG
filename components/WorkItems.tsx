
import React, { useState, useEffect, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';

interface WorkItemsProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  selEpicId: string;
  searchQuery: string;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
}

const WorkItems: React.FC<WorkItemsProps> = ({ 
  applications, bundles, selBundleId, selAppId, selMilestone, selEpicId, searchQuery, externalTrigger, onTriggerProcessed 
}) => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [treeMode, setTreeMode] = useState<'hierarchy' | 'milestone'>('hierarchy');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Trigger handling from Layout
  useEffect(() => {
    if (externalTrigger === 'create-item') {
      setIsCreating(true);
      onTriggerProcessed?.();
    }
  }, [externalTrigger, onTriggerProcessed]);

  // Fetch tree data
  const fetchTree = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      milestoneId: selMilestone,
      q: searchQuery,
      treeMode
    });
    // If a specific epic is filtered, we might want to focus the tree there
    if (selEpicId !== 'all') params.set('epicId', selEpicId);

    try {
      const res = await fetch(`/api/work-items/tree?${params.toString()}`);
      const data = await res.json();
      setTreeData(data);
    } catch (err) {
      console.error("Failed to fetch tree", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [selBundleId, selAppId, selMilestone, selEpicId, searchQuery, treeMode]);

  const handleNodeSelect = async (node: any) => {
    if (node.nodeType === 'WORK_ITEM') {
      try {
        const res = await fetch(`/api/work-items/${node.workItemId}`);
        const data = await res.json();
        setActiveItem(data);
      } catch (err) {
        console.error("Failed to fetch item", err);
      }
    }
  };

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    if (!activeItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/work-items/${activeItem._id || activeItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setActiveItem(prev => prev ? { ...prev, ...updates } : null);
        fetchTree();
      }
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (type: WorkItemType) => {
    switch (type) {
      case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
      case WorkItemType.FEATURE: return 'fa-star text-amber-500';
      case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
      case WorkItemType.TASK: return 'fa-check text-slate-400';
      case WorkItemType.BUG: return 'fa-bug text-red-500';
      default: return 'fa-circle text-slate-300';
    }
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeItem && (activeItem._id === node.workItemId || activeItem.id === node.workItemId);

    return (
      <div key={node.id} className="flex flex-col">
        <button
          onClick={() => {
            if (hasChildren) {
              setExpandedNodes(prev => {
                const next = new Set(prev);
                next.has(node.id) ? next.delete(node.id) : next.add(node.id);
                return next;
              });
            }
            handleNodeSelect(node);
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-left ${
            isActive ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'hover:bg-slate-50 text-slate-600'
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="w-4 flex justify-center">
            {hasChildren ? (
              <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-[10px] opacity-40`}></i>
            ) : (
              <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            )}
          </div>
          <i className={`fas ${getIcon(node.type)} text-[10px]`}></i>
          <span className={`text-[11px] font-medium truncate ${isActive ? 'font-bold' : ''}`}>
            {node.label}
          </span>
          {node.status && (
             <span className={`ml-auto text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
               node.status === WorkItemStatus.DONE ? 'bg-emerald-100 text-emerald-700' :
               node.status === WorkItemStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
               'bg-slate-100 text-slate-400'
             }`}>
               {node.status}
             </span>
          )}
        </button>
        {isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[800px] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {/* Sidebar Navigation */}
      <aside className="w-96 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
        <header className="p-8 border-b border-slate-100 bg-white/50 backdrop-blur shrink-0">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Work Hierarchy</h3>
             <div className="flex bg-slate-200 p-0.5 rounded-lg">
                <button 
                  onClick={() => setTreeMode('hierarchy')}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded ${treeMode === 'hierarchy' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                >
                  Delivery
                </button>
                <button 
                  onClick={() => setTreeMode('milestone')}
                  className={`px-2 py-1 text-[8px] font-black uppercase rounded ${treeMode === 'milestone' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                >
                  Milestone
                </button>
             </div>
          </div>
        </header>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
             <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.1 }}></div>
                ))}
             </div>
          ) : treeData.length === 0 ? (
             <div className="p-10 text-center">
                <i className="fas fa-search text-slate-200 text-3xl mb-3"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">No items match current criteria.</p>
             </div>
          ) : (
            treeData.map(node => renderTreeNode(node))
          )}
        </nav>
      </aside>

      {/* Detail Area */}
      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {activeItem ? (
          <div className="p-16 max-w-5xl mx-auto animate-fadeIn">
             <header className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                   <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black tracking-widest uppercase">{activeItem.key}</span>
                   <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase flex items-center gap-2 ${
                     activeItem.type === WorkItemType.EPIC ? 'bg-purple-50 text-purple-700' :
                     activeItem.type === WorkItemType.BUG ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                   }`}>
                      <i className={`fas ${getIcon(activeItem.type)}`}></i>
                      {activeItem.type}
                   </span>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-6">{activeItem.title}</h1>
                
                <div className="grid grid-cols-3 gap-6">
                   <DetailField label="Status">
                      <select 
                        value={activeItem.status} 
                        onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                      >
                         {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </DetailField>
                   <DetailField label="Priority">
                      <select 
                        value={activeItem.priority} 
                        onChange={(e) => handleUpdateItem({ priority: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                      >
                         <option value="CRITICAL">Critical</option>
                         <option value="HIGH">High</option>
                         <option value="MEDIUM">Medium</option>
                         <option value="LOW">Low</option>
                      </select>
                   </DetailField>
                   <DetailField label="Assignee">
                      <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(activeItem.assignedTo || 'Unassigned')}&background=random`} className="w-6 h-6 rounded-full" />
                         <span className="text-xs font-bold text-slate-700">{activeItem.assignedTo || 'Unassigned'}</span>
                      </div>
                   </DetailField>
                </div>
             </header>

             <section className="space-y-12">
                <div className="space-y-4">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <i className="fas fa-align-left"></i>
                      Description
                   </h3>
                   <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 min-h-[200px] prose prose-slate max-w-none">
                      {activeItem.description || 'No description provided.'}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-12">
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-sitemap"></i>
                        Hierarchy context
                      </h3>
                      <div className="space-y-3">
                         <ContextItem label="Bundle" value={bundles.find(b => b._id === activeItem.bundleId)?.name || 'General'} />
                         <ContextItem label="Application" value={applications.find(a => a._id === activeItem.applicationId || a.id === activeItem.applicationId)?.name || 'Platform Shared'} />
                         <ContextItem label="Milestones" value={activeItem.milestoneIds?.join(', ') || 'Backlog'} />
                      </div>
                   </div>
                   
                   <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fas fa-link"></i>
                        Linked Items
                      </h3>
                      {activeItem.links && activeItem.links.length > 0 ? (
                        <div className="space-y-2">
                           {activeItem.links.map((link, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-all cursor-pointer">
                                 <span className="text-[9px] font-black text-blue-500 uppercase">{link.type}</span>
                                 <span className="text-xs font-bold text-slate-600">{link.targetId}</span>
                              </div>
                           ))}
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400">No cross-links established.</p>
                      )}
                   </div>
                </div>
             </section>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <i className="fas fa-tasks text-slate-100 text-4xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Work Delivery Center</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select a feature, epic, or task from the navigator to view implementation details.</p>
          </div>
        )}

        {saving && (
           <div className="absolute top-6 right-6 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl animate-fadeIn flex items-center gap-2">
              <i className="fas fa-circle-notch fa-spin"></i>
              Syncing Registry...
           </div>
        )}
      </main>

      {/* Creation Modal */}
      {isCreating && (
        <CreateWorkItemModal 
          bundles={bundles}
          applications={applications}
          initialBundleId={selBundleId !== 'all' ? selBundleId : ''}
          initialAppId={selAppId !== 'all' ? selAppId : ''}
          onClose={() => setIsCreating(false)}
          onSuccess={(item) => {
            setIsCreating(false);
            fetchTree();
            handleNodeSelect({ nodeType: 'WORK_ITEM', workItemId: item.insertedId || item.id });
          }}
        />
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

interface CreateWorkItemModalProps {
  bundles: Bundle[];
  applications: Application[];
  initialBundleId: string;
  initialAppId: string;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({ bundles, applications, initialBundleId, initialAppId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<WorkItem>>({
    type: WorkItemType.STORY,
    title: '',
    description: '',
    bundleId: initialBundleId || bundles[0]?._id,
    applicationId: initialAppId || '',
    priority: 'MEDIUM',
    status: WorkItemStatus.TODO,
    assignedTo: ''
  });
  const [loading, setLoading] = useState(false);
  const [potentialParents, setPotentialParents] = useState<WorkItem[]>([]);

  useEffect(() => {
    // Fetch potential parents based on type
    // Epic -> None
    // Feature -> Epic
    // Story -> Feature or Epic
    // Task/Bug -> Story or Feature
    let parentType = '';
    if (formData.type === WorkItemType.FEATURE) parentType = WorkItemType.EPIC;
    else if (formData.type === WorkItemType.STORY) parentType = WorkItemType.FEATURE;
    else if (formData.type === WorkItemType.TASK || formData.type === WorkItemType.BUG) parentType = WorkItemType.STORY;

    if (parentType) {
      const params = new URLSearchParams();
      if (formData.bundleId) params.set('bundleId', formData.bundleId);
      if (formData.applicationId) params.set('applicationId', formData.applicationId);
      fetch(`/api/work-items?${params.toString()}`)
        .then(r => r.json())
        .then(items => {
          setPotentialParents(items.filter((i: WorkItem) => i.type === parentType));
        });
    } else {
      setPotentialParents([]);
    }
  }, [formData.type, formData.bundleId, formData.applicationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) onSuccess(data.result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex justify-between items-start">
           <div>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight italic">Initialize Work Item</h3>
             <p className="text-slate-500 font-medium mt-1">Provision a new artifact in the delivery stream.</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
             <i className="fas fa-times"></i>
           </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
           <div className="grid grid-cols-2 gap-8">
              <DetailField label="Type">
                 <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as WorkItemType})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                 >
                    {Object.values(WorkItemType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </DetailField>
              <DetailField label="Priority">
                 <select 
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                 >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                 </select>
              </DetailField>
           </div>

           <DetailField label="Title">
              <input 
                required
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Brief summary of the work..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              />
           </DetailField>

           <DetailField label="Description">
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                placeholder="Detailed acceptance criteria or implementation notes..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
              />
           </DetailField>

           <div className="grid grid-cols-2 gap-8">
              <DetailField label="Bundle">
                 <select 
                    value={formData.bundleId}
                    onChange={(e) => setFormData({...formData, bundleId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                 >
                    {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                 </select>
              </DetailField>
              <DetailField label="Application">
                 <select 
                    value={formData.applicationId}
                    onChange={(e) => setFormData({...formData, applicationId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                 >
                    <option value="">Cross-App / General</option>
                    {applications.filter(a => a.bundleId === formData.bundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                 </select>
              </DetailField>
           </div>

           {potentialParents.length > 0 && (
              <DetailField label="Parent Association">
                 <select 
                    value={formData.parentId}
                    onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                 >
                    <option value="">No Parent (Root Item)</option>
                    {potentialParents.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.key}: {p.title}</option>)}
                 </select>
              </DetailField>
           )}

           <footer className="pt-10 flex gap-4">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
              >
                Discard
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                Create Artifact
              </button>
           </footer>
        </form>
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
     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
     <span className="text-xs font-bold text-slate-700">{value}</span>
  </div>
);

export default WorkItems;
