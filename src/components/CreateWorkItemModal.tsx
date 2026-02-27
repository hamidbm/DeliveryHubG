
import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application } from '../types';

interface CreateWorkItemModalProps {
  bundles: Bundle[];
  applications: Application[];
  initialBundleId: string;
  initialAppId: string;
  initialParentId?: string;
  initialType?: WorkItemType;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

const CreateWorkItemModal: React.FC<CreateWorkItemModalProps> = ({ 
  bundles, applications, initialBundleId, initialAppId, initialParentId, initialType, onClose, onSuccess 
}) => {
  const [formData, setFormData] = useState<Partial<WorkItem>>({
    type: initialType || WorkItemType.STORY,
    title: '',
    description: '',
    bundleId: initialBundleId || bundles[0]?._id,
    applicationId: initialAppId || '',
    parentId: initialParentId || '',
    priority: 'MEDIUM',
    status: WorkItemStatus.TODO,
    assignedTo: '',
    dueAt: '',
    risk: { probability: 3, impact: 3 },
    dependency: { blocking: true }
  });
  const [loading, setLoading] = useState(false);
  const [potentialParents, setPotentialParents] = useState<WorkItem[]>([]);

  useEffect(() => {
    let parentType = '';
    if (formData.type === WorkItemType.FEATURE) parentType = WorkItemType.EPIC;
    else if (formData.type === WorkItemType.STORY) parentType = WorkItemType.FEATURE;
    else if (formData.type === WorkItemType.TASK || formData.type === WorkItemType.BUG || formData.type === WorkItemType.RISK || formData.type === WorkItemType.DEPENDENCY) parentType = WorkItemType.STORY;

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
      const payload: any = {
        ...formData,
        dueAt: formData.dueAt || undefined,
        context: { bundleId: formData.bundleId, appId: formData.applicationId || undefined }
      };
      if (formData.type !== WorkItemType.RISK) delete payload.risk;
      if (formData.type !== WorkItemType.DEPENDENCY) delete payload.dependency;
      const res = await fetch('/api/work-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) onSuccess(data.result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const riskScore = (formData.risk?.probability || 0) * (formData.risk?.impact || 0);
  const computedSeverity =
    riskScore <= 4 ? 'low' :
    riskScore <= 9 ? 'medium' :
    riskScore <= 16 ? 'high' : 'critical';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-2xl p-12 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="mb-10 flex justify-between items-start">
           <div>
             <h3 className="text-3xl font-black text-slate-900 tracking-tight italic">Provision Artifact</h3>
             <p className="text-slate-500 font-medium mt-1">Initialize a new record in the delivery stream.</p>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                    {Object.values(WorkItemType).map(t => <option key={t} value={t}>{t}</option>)}
                 </select>
              </DetailField>
              <DetailField label="Priority">
                 <select 
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
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
                placeholder="Brief summary..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500"
              />
           </DetailField>

           <DetailField label="Description">
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                placeholder="Details..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none resize-none"
              />
           </DetailField>

           <DetailField label="Due Date">
              <input
                type="date"
                value={formData.dueAt || ''}
                onChange={(e) => setFormData({ ...formData, dueAt: e.target.value || undefined })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
              />
           </DetailField>

           <div className="grid grid-cols-2 gap-8">
              <DetailField label="Bundle">
                 <select 
                    value={formData.bundleId}
                    onChange={(e) => setFormData({...formData, bundleId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                    {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                 </select>
              </DetailField>
              <DetailField label="Application">
                 <select 
                    value={formData.applicationId}
                    onChange={(e) => setFormData({...formData, applicationId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                    <option value="">Cross-App / General</option>
                    {applications.filter(a => a.bundleId === formData.bundleId).map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                 </select>
              </DetailField>
           </div>

           {(potentialParents.length > 0 || formData.parentId) && (
              <DetailField label="Parent Association">
                 <select 
                    value={formData.parentId}
                    onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                    <option value="">No Parent (Root Item)</option>
                    {potentialParents.map(p => <option key={p._id || p.id} value={p._id || p.id}>{p.key}: {p.title}</option>)}
                    {formData.parentId && !potentialParents.some(p => (p._id || p.id) === formData.parentId) && (
                      <option value={formData.parentId}>Current Context Parent</option>
                    )}
                 </select>
              </DetailField>
           )}

           {formData.type === WorkItemType.RISK && (
             <div className="grid grid-cols-2 gap-8">
               <DetailField label="Probability (1-5)">
                 <select
                   value={formData.risk?.probability || 3}
                   onChange={(e) => setFormData({ ...formData, risk: { ...formData.risk, probability: Number(e.target.value) as any } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                   {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                 </select>
               </DetailField>
               <DetailField label="Impact (1-5)">
                 <select
                   value={formData.risk?.impact || 3}
                   onChange={(e) => setFormData({ ...formData, risk: { ...formData.risk, impact: Number(e.target.value) as any } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                   {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                 </select>
               </DetailField>
               <DetailField label="Severity (computed)">
                 <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold uppercase text-slate-600">
                   {computedSeverity}
                 </div>
               </DetailField>
               <DetailField label="Area (optional)">
                 <select
                   value={formData.risk?.area || ''}
                   onChange={(e) => setFormData({ ...formData, risk: { ...formData.risk, area: e.target.value as any } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                   <option value="">Select</option>
                   {['schedule','cost','scope','security','compliance','operations','vendor','other'].map(a => (
                     <option key={a} value={a}>{a}</option>
                   ))}
                 </select>
               </DetailField>
               <DetailField label="Mitigation (optional)">
                 <input
                   type="text"
                   value={formData.risk?.mitigation || ''}
                   onChange={(e) => setFormData({ ...formData, risk: { ...formData.risk, mitigation: e.target.value } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 />
               </DetailField>
             </div>
           )}

           {formData.type === WorkItemType.DEPENDENCY && (
             <div className="grid grid-cols-2 gap-8">
               <DetailField label="Blocking">
                 <select
                   value={formData.dependency?.blocking ? 'yes' : 'no'}
                   onChange={(e) => setFormData({ ...formData, dependency: { ...formData.dependency, blocking: e.target.value === 'yes' } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 >
                   <option value="yes">Yes</option>
                   <option value="no">No</option>
                 </select>
               </DetailField>
               <DetailField label="Depends On (name)">
                 <input
                   type="text"
                   value={formData.dependency?.dependsOn?.name || ''}
                   onChange={(e) => setFormData({ ...formData, dependency: { ...formData.dependency, dependsOn: { ...formData.dependency?.dependsOn, name: e.target.value, type: formData.dependency?.dependsOn?.type || 'external' } } })}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                 />
               </DetailField>
             </div>
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
                className="flex-[2] py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
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

export default CreateWorkItemModal;
