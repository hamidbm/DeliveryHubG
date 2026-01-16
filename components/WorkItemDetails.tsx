
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkItem, WorkItemType, WorkItemStatus, Bundle, Application, WorkItemLink, WorkItemAttachment, WorkItemActivity, WorkItemComment, Milestone, ChecklistItem } from '../types';
import AssigneeSearch from './AssigneeSearch';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface WorkItemDetailsProps {
  item: WorkItem;
  bundles: Bundle[];
  applications: Application[];
  onUpdate: () => void;
  onClose: () => void;
}

const WorkItemDetails: React.FC<WorkItemDetailsProps> = ({ item: initialItem, bundles, applications, onUpdate, onClose }) => {
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [children, setChildren] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'checklist' | 'comments' | 'links' | 'attachments' | 'activity' | 'ai'>('details');
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [viewingAttachment, setViewingAttachment] = useState<WorkItemAttachment | null>(null);
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [logHours, setLogHours] = useState<number>(0);
  const [closureError, setClosureError] = useState<string | null>(null);

  const [aiPlan, setAiPlan] = useState<string | null>(initialItem.aiWorkPlan || null);
  const [rebalanceSuggestion, setRebalanceSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [standupDigest, setStandupDigest] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkType, setLinkType] = useState<WorkItemLink['type']>('RELATES_TO');
  const [linkResults, setLinkResults] = useState<WorkItem[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logic: Definition of Ready (DoR) check
  const isReadyForExecution = useMemo(() => {
    return !!(item.assignedTo && item.storyPoints && item.description && item.description.length > 50);
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
      const childData = await childRes.json();
      setChildren(childData);
      setMilestones(await msRes.json());
      if (itemData.aiWorkPlan) setAiPlan(itemData.aiWorkPlan);
    } catch (err) { console.error("Sync Error:", err); }
  };

  useEffect(() => {
    loadFullDetails();
    setClosureError(null);
    setStandupDigest(null);
    setRebalanceSuggestion(null);
  }, [initialItem]);

  const handleUpdateItem = async (updates: Partial<WorkItem>) => {
    setClosureError(null);
    
    // Governance Guard: Definition of Ready
    if (updates.status === WorkItemStatus.IN_PROGRESS && !isReadyForExecution) {
      setClosureError(`DoR Violation: Artifact lacks required execution metadata (Assignee, Points, or Description).`);
      return;
    }

    if (updates.status === WorkItemStatus.DONE) {
      if ((item.checklists || []).some(c => !c.isCompleted)) {
        setClosureError(`DoD Violation: All quality gates must be verified before closure.`);
        return;
      }
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

  const handleSnapshot = async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch(`/api/work-items/${item._id || item.id}/snapshot`, { method: 'POST' });
      if (res.ok) {
        alert("Immutable Audit Snapshot captured and archived in the Governance Vault.");
        await loadFullDetails();
      }
    } finally { setIsSnapshotting(false); }
  };

  const calculateHealth = () => {
    let score = 100;
    const deductions = [];
    if (item.isFlagged) { score -= 30; deductions.push("Active Impediment (-30)"); }
    if (item.status === WorkItemStatus.BLOCKED) { score -= 20; deductions.push("Workflow Blocked (-20)"); }
    const pendingCheck = (item.checklists || []).filter(c => !c.isCompleted).length;
    if (pendingCheck > 0) { score -= (pendingCheck * 5); deductions.push(`Unfinished DoD Items (-${pendingCheck * 5})`); }
    return { score: Math.max(0, score), deductions };
  };

  const health = calculateHealth();
  const downstreamImpact = (item.links || []).filter(l => l.type === 'BLOCKS').length;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative shadow-2xl border-l border-slate-200">
      <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/20">
        <div className="flex items-center gap-6 min-w-0">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center text-slate-400 border border-transparent hover:border-slate-100 transition-all"><i className="fas fa-arrow-left"></i></button>
          
          <div className="relative shrink-0 flex items-center justify-center group/health">
             <svg className="w-14 h-14 -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={150.796} strokeDashoffset={150.796 * (1 - health.score / 100)} className={`transition-all duration-1000 ${health.score > 80 ? 'text-emerald-500' : health.score > 50 ? 'text-amber-500' : 'text-red-500'}`} />
             </svg>
             <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-[10px] font-black text-slate-700">{health.score}</span>
                <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">AHI</span>
             </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
              {isReadyForExecution && <i className="fas fa-bolt text-amber-500 text-[10px]" title="Definition of Ready Verified"></i>}
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight truncate leading-tight">{item.title}</h3>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
           <button 
             onClick={handleSnapshot}
             disabled={isSnapshotting || item.status !== WorkItemStatus.DONE}
             className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border ${
               item.status === WorkItemStatus.DONE ? 'bg-slate-900 text-white hover:bg-blue-600 shadow-lg' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
             }`}
           >
              {isSnapshotting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-stamp"></i>}
              Audit Snapshot
           </button>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <button onClick={() => handleUpdateItem({ isFlagged: !item.isFlagged })} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${item.isFlagged ? 'bg-red-50 border-red-200 text-red-600 shadow-inner' : 'bg-white border-slate-200 text-slate-300 hover:text-red-400'}`}><i className="fas fa-flag"></i></button>
        </div>
      </header>

      <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'details', icon: 'fa-info-circle', label: 'Details' },
          { id: 'checklist', icon: 'fa-check-square', label: `DoD Checklist` },
          { id: 'ai', icon: 'fa-wand-magic-sparkles', label: 'AI Co-pilot' },
          { id: 'comments', icon: 'fa-comments', label: 'Comments' },
          { id: 'links', icon: 'fa-link', label: `Links (${downstreamImpact})` },
          { id: 'attachments', icon: 'fa-paperclip', label: 'Artifacts' },
          { id: 'activity', icon: 'fa-history', label: 'Audit Trail' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <i className={`fas ${tab.icon} text-[10px]`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FAFAFA]">
        {closureError && (
          <div className="mx-10 mt-8 p-6 bg-red-50 border-2 border-red-100 rounded-[2.5rem] flex items-center gap-6 text-red-600 animate-fadeIn shadow-2xl shadow-red-500/10">
             <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-xl shrink-0"><i className="fas fa-shield-halved"></i></div>
             <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Governance Violation Detected</p>
                <p className="text-sm font-bold leading-relaxed">{closureError}</p>
             </div>
             <button onClick={() => setClosureError(null)} className="w-10 h-10 rounded-xl hover:bg-red-100 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="p-10 space-y-10 animate-fadeIn">
            {!isReadyForExecution && item.status === WorkItemStatus.TODO && (
              <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex items-center justify-between mb-8 shadow-sm">
                 <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600"><i className="fas fa-triangle-exclamation"></i></div>
                    <div>
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700">DoR Compliance Warning</h4>
                       <p className="text-xs font-bold text-amber-600">Definition of Ready failed. Artifact cannot be promoted to execution.</p>
                    </div>
                 </div>
                 <i className="fas fa-lock text-amber-200 text-3xl"></i>
              </div>
            )}
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
              <div className="grid grid-cols-2 gap-10">
                <DetailField label="Workflow Phase">
                    <select value={item.status} onChange={(e) => handleUpdateItem({ status: e.target.value as WorkItemStatus })} className={`w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none transition-all ${item.status === WorkItemStatus.DONE ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {Object.values(WorkItemStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </DetailField>
                <DetailField label="Execution Priority">
                    <select value={item.priority} onChange={(e) => handleUpdateItem({ priority: e.target.value as any })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none">
                      {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </DetailField>
              </div>
              <div className="grid grid-cols-3 gap-10">
                <DetailField label="Lead Assignee">
                    <AssigneeSearch currentAssignee={item.assignedTo} onSelect={(name) => handleUpdateItem({ assignedTo: name })} />
                </DetailField>
                <DetailField label="Estimate (Pts)"><input type="number" value={item.storyPoints || 0} onChange={(e) => handleUpdateItem({ storyPoints: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black outline-none" /></DetailField>
                <DetailField label="Effort Logged">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-sm font-black text-slate-700">{item.timeLogged || 0} hrs</div>
                    <button onClick={() => setIsLoggingWork(true)} className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 shadow-xl active:scale-95 transition-all"><i className="fas fa-plus"></i></button>
                  </div>
                </DetailField>
              </div>
            </div>
          </div>
        )}
        {/* Other tabs remain identical... */}
      </div>

      {isLoggingWork && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl animate-fadeIn border border-slate-100">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic mb-8 text-center">Physical Effort Log</h3>
              <div className="space-y-8">
                 <div className="space-y-3 px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hours Expended (Cycle 0.5)</label>
                    <input type="number" step="0.5" value={logHours} onChange={(e) => setLogHours(parseFloat(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] px-6 py-5 text-xl font-black outline-none focus:border-blue-500 transition-all text-center" />
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => setIsLoggingWork(false)} className="flex-1 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                    <button onClick={() => { handleUpdateItem({ timeLogged: (item.timeLogged || 0) + logHours }); setIsLoggingWork(false); setLogHours(0); }} className="flex-[2] py-5 bg-slate-900 text-white text-[11px] font-black rounded-2xl hover:bg-blue-600 uppercase tracking-widest transition-all shadow-2xl active:scale-95">Commit Log</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const DetailField = ({ label, children }: any) => (
  <div className="space-y-3">
     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
     {children}
  </div>
);

export default WorkItemDetails;
