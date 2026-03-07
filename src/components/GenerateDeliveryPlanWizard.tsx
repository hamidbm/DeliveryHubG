import React, { useEffect, useMemo, useState } from 'react';
import { Bundle, Application } from '../types';

interface GenerateDeliveryPlanWizardProps {
  bundles: Bundle[];
  applications: Application[];
  onClose: () => void;
}

type PreviewResponse = {
  preview: {
    previewId: string;
    counts: { roadmapPhases: number; milestones: number; sprints: number; epics: number; features: number; stories: number; tasks: number };
    roadmap: Array<{ name: string; startDate: string; endDate: string; milestoneIndexes?: number[] }>;
    milestones: Array<{ index: number; name: string; startDate: string; endDate: string; themes: string[]; sprintCount: number; suggestedOwner?: { email?: string; reason?: string } }>;
    sprints: Array<{ name: string; startDate: string; endDate: string; milestoneIndex?: number }>;
    artifacts: Array<{ milestoneIndex: number; epicCount: number; featureCount: number; storyCount: number; taskCount: number }>;
    warnings: string[];
    assumptions: string[];
  };
};

const GenerateDeliveryPlanWizard: React.FC<GenerateDeliveryPlanWizardProps> = ({ bundles, applications, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResponse['preview'] | null>(null);
  const [createResult, setCreateResult] = useState<any | null>(null);

  const [scopeType, setScopeType] = useState<'BUNDLE' | 'APPLICATION' | 'PROGRAM'>('BUNDLE');
  const [scopeId, setScopeId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [devStartDate, setDevStartDate] = useState('');
  const [integrationStartDate, setIntegrationStartDate] = useState('');
  const [uatStartDate, setUatStartDate] = useState('');
  const [goLiveDate, setGoLiveDate] = useState('');
  const [stabilizationEndDate, setStabilizationEndDate] = useState('');
  const [milestoneCount, setMilestoneCount] = useState(4);
  const [sprintDurationWeeks, setSprintDurationWeeks] = useState(2);
  const [milestoneDurationStrategy, setMilestoneDurationStrategy] = useState<'AUTO_DISTRIBUTE' | 'FIXED_WEEKS'>('AUTO_DISTRIBUTE');
  const [milestoneDurationWeeks, setMilestoneDurationWeeks] = useState(3);
  const [deliveryPattern, setDeliveryPattern] = useState<'STANDARD_PHASED' | 'PRODUCT_INCREMENT' | 'MIGRATION' | 'COMPLIANCE'>('STANDARD_PHASED');
  const [backlogShape, setBacklogShape] = useState<'LIGHT' | 'STANDARD' | 'DETAILED'>('STANDARD');
  const [storiesPerFeatureTarget, setStoriesPerFeatureTarget] = useState<number | ''>('');
  const [featuresPerMilestoneTarget, setFeaturesPerMilestoneTarget] = useState<number | ''>('');
  const [createTasksUnderStories, setCreateTasksUnderStories] = useState(false);
  const [environmentFlow, setEnvironmentFlow] = useState<'DEV_UAT_PROD' | 'DEV_SIT_UAT_PROD' | 'CUSTOM'>('DEV_UAT_PROD');
  const [releaseType, setReleaseType] = useState<'BIG_BANG' | 'PHASED' | 'INCREMENTAL'>('PHASED');
  const [suggestMilestoneOwners, setSuggestMilestoneOwners] = useState(true);
  const [suggestWorkItemOwners, setSuggestWorkItemOwners] = useState(true);
  const [createDependencySkeleton, setCreateDependencySkeleton] = useState(false);
  const [preallocateStoriesToSprints, setPreallocateStoriesToSprints] = useState(false);
  const [autoLinkMilestonesToRoadmap, setAutoLinkMilestonesToRoadmap] = useState(true);
  const [generateDraftOnly, setGenerateDraftOnly] = useState(true);
  const [themes, setThemes] = useState<Record<number, string>>({});

  const scopeOptions = useMemo(() => {
    if (scopeType === 'BUNDLE') return bundles;
    if (scopeType === 'APPLICATION') return applications;
    return [];
  }, [scopeType, bundles, applications]);

  useEffect(() => {
    if (scopeType === 'PROGRAM') {
      setScopeId('program');
      return;
    }
    if (scopeOptions.length > 0) {
      const first = scopeOptions[0];
      const fallbackId =
        (first as any)._id ||
        (first as any).id ||
        ((first as any).aid ? (first as any).aid : '') ||
        (('key' in (first as any)) ? (first as any).key : '');
      setScopeId(String(fallbackId || ''));
    }
  }, [scopeOptions, scopeType]);

  const milestoneRows = Array.from({ length: milestoneCount }, (_, i) => i + 1);

  const buildPayload = () => ({
    scopeType,
    scopeId,
    plannedStartDate: plannedStartDate || undefined,
    devStartDate,
    integrationStartDate: integrationStartDate || undefined,
    uatStartDate,
    goLiveDate,
    stabilizationEndDate: stabilizationEndDate || undefined,
    milestoneCount,
    sprintDurationWeeks,
    milestoneDurationStrategy,
    milestoneDurationWeeks: milestoneDurationStrategy === 'FIXED_WEEKS' ? milestoneDurationWeeks : undefined,
    deliveryPattern,
    backlogShape,
    storiesPerFeatureTarget: storiesPerFeatureTarget ? Number(storiesPerFeatureTarget) : undefined,
    featuresPerMilestoneTarget: featuresPerMilestoneTarget ? Number(featuresPerMilestoneTarget) : undefined,
    createTasksUnderStories,
    environmentFlow,
    releaseType,
    suggestMilestoneOwners,
    suggestWorkItemOwners,
    createDependencySkeleton,
    preallocateStoriesToSprints,
    autoLinkMilestonesToRoadmap,
    generateDraftOnly,
    themesByMilestone: milestoneRows.map((index) => ({
      milestoneIndex: index,
      themes: (themes[index] || '').split(',').map((t) => t.trim()).filter(Boolean)
    }))
  });

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/work-items/plan/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to preview plan');
      setPreview(data.preview);
      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'Failed to preview plan');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!preview?.previewId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/work-items/plan/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previewId: preview.previewId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create plan');
      setCreateResult(data.result);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Failed to create plan');
    } finally {
      setLoading(false);
    }
  };

  const openMilestones = () => {
    window.location.assign('/?tab=work-items&view=milestones');
  };

  const openRoadmap = () => {
    window.location.assign('/?tab=work-items&view=roadmap');
  };

  const openWorkItems = () => {
    window.location.assign('/?tab=work-items&view=tree');
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-5xl p-12 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Generate Delivery Plan</h3>
            <p className="text-slate-500 font-medium mt-1">Preview and create a draft delivery structure.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-2xl">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2 col-span-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scope Type</label>
                <select value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="BUNDLE">Bundle</option>
                  <option value="APPLICATION">Application</option>
                  <option value="PROGRAM">Program</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scope</label>
                <select disabled={scopeType === 'PROGRAM'} value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  {scopeType === 'PROGRAM' && <option value="program">Program</option>}
                  {scopeOptions.map((o: any) => (
                    <option key={o._id || o.id || o.key || o.aid} value={o._id || o.id || o.key || o.aid}>
                      {o.name || o.key || o.aid}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Planned Start (optional)</label>
                <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dev Start</label>
                <input type="date" value={devStartDate} onChange={(e) => setDevStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Integration Start (optional)</label>
                <input type="date" value={integrationStartDate} onChange={(e) => setIntegrationStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">UAT Start</label>
                <input type="date" value={uatStartDate} onChange={(e) => setUatStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Go-Live</label>
                <input type="date" value={goLiveDate} onChange={(e) => setGoLiveDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stabilization End (optional)</label>
                <input type="date" value={stabilizationEndDate} onChange={(e) => setStabilizationEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
            </section>

            <section className="grid grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Count</label>
                <input type="number" min={1} value={milestoneCount} onChange={(e) => setMilestoneCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sprint Duration (weeks)</label>
                <input type="number" min={1} value={sprintDurationWeeks} onChange={(e) => setSprintDurationWeeks(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Strategy</label>
                <select value={milestoneDurationStrategy} onChange={(e) => setMilestoneDurationStrategy(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="AUTO_DISTRIBUTE">Auto-distribute</option>
                  <option value="FIXED_WEEKS">Fixed weeks</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone Duration (weeks)</label>
                <input
                  type="number"
                  min={1}
                  disabled={milestoneDurationStrategy !== 'FIXED_WEEKS'}
                  value={milestoneDurationWeeks}
                  onChange={(e) => setMilestoneDurationWeeks(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Pattern</label>
                <select value={deliveryPattern} onChange={(e) => setDeliveryPattern(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="STANDARD_PHASED">Standard phased</option>
                  <option value="PRODUCT_INCREMENT">Product increment</option>
                  <option value="MIGRATION">Migration / rollout</option>
                  <option value="COMPLIANCE">Compliance / governance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Backlog Shape</label>
                <select value={backlogShape} onChange={(e) => setBacklogShape(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="LIGHT">Light</option>
                  <option value="STANDARD">Standard</option>
                  <option value="DETAILED">Detailed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Create Tasks Under Stories</label>
                <select value={createTasksUnderStories ? 'yes' : 'no'} onChange={(e) => setCreateTasksUnderStories(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stories per Feature</label>
                <input type="number" min={1} value={storiesPerFeatureTarget} onChange={(e) => setStoriesPerFeatureTarget(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Features per Milestone</label>
                <input type="number" min={1} value={featuresPerMilestoneTarget} onChange={(e) => setFeaturesPerMilestoneTarget(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Type</label>
                <select value={releaseType} onChange={(e) => setReleaseType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="BIG_BANG">Big bang</option>
                  <option value="PHASED">Phased rollout</option>
                  <option value="INCREMENTAL">Incremental waves</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Environment Flow</label>
                <select value={environmentFlow} onChange={(e) => setEnvironmentFlow(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="DEV_UAT_PROD">Dev → UAT → Prod</option>
                  <option value="DEV_SIT_UAT_PROD">Dev → SIT → UAT → Prod</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Suggest Milestone Owners</label>
                <select value={suggestMilestoneOwners ? 'yes' : 'no'} onChange={(e) => setSuggestMilestoneOwners(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Suggest Work Item Owners</label>
                <select value={suggestWorkItemOwners ? 'yes' : 'no'} onChange={(e) => setSuggestWorkItemOwners(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Create Dependency Skeleton</label>
                <select value={createDependencySkeleton ? 'yes' : 'no'} onChange={(e) => setCreateDependencySkeleton(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pre-allocate Stories to Sprints</label>
                <select value={preallocateStoriesToSprints ? 'yes' : 'no'} onChange={(e) => setPreallocateStoriesToSprints(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Auto-link Milestones to Roadmap</label>
                <select value={autoLinkMilestonesToRoadmap ? 'yes' : 'no'} onChange={(e) => setAutoLinkMilestonesToRoadmap(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </section>

            <section className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Generate Draft Only</label>
                <select value={generateDraftOnly ? 'yes' : 'no'} onChange={(e) => setGenerateDraftOnly(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Milestone Themes</h4>
              <div className="grid grid-cols-2 gap-4">
                {milestoneRows.map((n) => (
                  <div key={n} className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Milestone {n} themes</label>
                    <input
                      value={themes[n] || ''}
                      onChange={(e) => setThemes(prev => ({ ...prev, [n]: e.target.value }))}
                      placeholder="Comma-separated"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                    />
                  </div>
                ))}
              </div>
            </section>

            <footer className="pt-6 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={loading} onClick={handlePreview} className="flex-[2] py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                Preview Plan
              </button>
            </footer>
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Milestones', value: preview.counts.milestones },
                { label: 'Sprints', value: preview.counts.sprints },
                { label: 'Roadmap Phases', value: preview.counts.roadmapPhases },
                { label: 'Epics', value: preview.counts.epics },
                { label: 'Features', value: preview.counts.features },
                { label: 'Stories', value: preview.counts.stories },
                { label: 'Tasks', value: preview.counts.tasks }
              ].map((card) => (
                <div key={card.label} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</div>
                  <div className="text-2xl font-black text-slate-900">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="border border-slate-100 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Milestone Schedule</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="text-left py-2">Milestone</th>
                      <th className="text-left py-2">Window</th>
                      <th className="text-left py-2">Themes</th>
                      <th className="text-left py-2">Sprints</th>
                      <th className="text-left py-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.milestones.map((m) => (
                      <tr key={m.index} className="border-t border-slate-100">
                        <td className="py-2 font-semibold text-slate-700">{m.name}</td>
                        <td className="py-2 text-slate-500">{m.startDate.split('T')[0]} → {m.endDate.split('T')[0]}</td>
                        <td className="py-2 text-slate-500">{m.themes.join(', ')}</td>
                        <td className="py-2 text-slate-500">{m.sprintCount}</td>
                        <td className="py-2 text-slate-500">{m.suggestedOwner?.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-slate-100 rounded-2xl p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Roadmap Phases</div>
                <div className="space-y-3 text-xs text-slate-600">
                  {preview.roadmap.map((phase) => (
                    <div key={`${phase.name}-${phase.startDate}`} className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-700">{phase.name}</span>
                      <span>{phase.startDate.split('T')[0]} → {phase.endDate.split('T')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-slate-100 rounded-2xl p-5">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Sprint Schedule</div>
                <div className="space-y-2 text-xs text-slate-600 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {preview.sprints.map((sprint) => (
                    <div key={sprint.name} className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-700">{sprint.name}</span>
                      <span>{sprint.startDate.split('T')[0]} → {sprint.endDate.split('T')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-slate-100 rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Artifact Counts by Milestone</div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                {preview.artifacts.map((artifact) => (
                  <div key={`artifact-${artifact.milestoneIndex}`} className="border border-slate-100 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Milestone {artifact.milestoneIndex}</div>
                    <div className="flex justify-between"><span>Epics</span><span className="font-semibold text-slate-700">{artifact.epicCount}</span></div>
                    <div className="flex justify-between"><span>Features</span><span className="font-semibold text-slate-700">{artifact.featureCount}</span></div>
                    <div className="flex justify-between"><span>Stories</span><span className="font-semibold text-slate-700">{artifact.storyCount}</span></div>
                    <div className="flex justify-between"><span>Tasks</span><span className="font-semibold text-slate-700">{artifact.taskCount}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 text-sm text-amber-700">
                <div className="text-[10px] font-black uppercase tracking-widest mb-2">Warnings</div>
                <ul className="list-disc pl-5 space-y-1">
                  {preview.warnings.map((w, idx) => <li key={`${w}-${idx}`}>{w}</li>)}
                </ul>
              </div>
            )}
            {preview.assumptions.length > 0 && (
              <div className="border border-slate-100 bg-slate-50 rounded-2xl p-4 text-sm text-slate-600">
                <div className="text-[10px] font-black uppercase tracking-widest mb-2">Assumptions</div>
                <ul className="list-disc pl-5 space-y-1">
                  {preview.assumptions.map((a, idx) => <li key={`${a}-${idx}`}>{a}</li>)}
                </ul>
              </div>
            )}

            <footer className="pt-4 flex gap-4">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">
                Back
              </button>
              <button type="button" disabled={loading} onClick={handleCreate} className="flex-[2] py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-2xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-check"></i>}
                Create Draft Plan
              </button>
            </footer>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 text-emerald-700">
              <div className="text-[10px] font-black uppercase tracking-widest">Draft Plan Created</div>
              <div className="text-lg font-semibold mt-1">Milestones, sprints, and work items are ready for review.</div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Milestones', value: preview.counts.milestones },
                { label: 'Sprints', value: preview.counts.sprints },
                { label: 'Work Items', value: preview.counts.epics + preview.counts.features + preview.counts.stories + preview.counts.tasks }
              ].map((card) => (
                <div key={card.label} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</div>
                  <div className="text-2xl font-black text-slate-900">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={openMilestones} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white hover:bg-blue-600">Open Milestones</button>
              <button onClick={openRoadmap} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Open Roadmap</button>
              <button onClick={openWorkItems} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Open Work Items</button>
            </div>

            <footer className="pt-4 flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors">
                Close
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateDeliveryPlanWizard;
