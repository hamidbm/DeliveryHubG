import React, { useEffect, useMemo, useState } from 'react';
import { Bundle, Application, ApplicationPlanningMetadata, PlanningEnvironmentEntry } from '../types';
import ExplainabilityIcon from './explainability/ExplainabilityIcon';
import EnvironmentTimelineInputs from './planning/EnvironmentTimelineInputs';

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
    milestones: Array<{ index: number; name: string; startDate: string; endDate: string; themes: string[]; sprintCount: number; targetCapacity?: number | null; suggestedOwner?: { email?: string; reason?: string } }>;
    sprints: Array<{ name: string; startDate: string; endDate: string; milestoneIndex?: number }>;
    artifacts: Array<{ milestoneIndex: number; epicCount: number; featureCount: number; storyCount: number; taskCount: number }>;
    derived?: { milestoneDurationDays?: number | null; milestoneDurationWeeks?: number | null };
    capacitySummary?: {
      mode: 'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY' | 'BUNDLE_CAPACITY_FALLBACK' | 'NONE';
      sprintCapacity: number | null;
      milestoneCapacities: Array<{ milestoneIndex: number; sprintCount: number; targetCapacity: number | null }>;
    };
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
  const [planningContext, setPlanningContext] = useState<{
    bundleMetadata?: ApplicationPlanningMetadata | null;
    applicationMetadata?: ApplicationPlanningMetadata | null;
    resolvedMetadata?: ApplicationPlanningMetadata | null;
  } | null>(null);
  const [planningContextLoading, setPlanningContextLoading] = useState(false);
  const [planningContextError, setPlanningContextError] = useState('');
  const [lastLoadedScope, setLastLoadedScope] = useState('');
  const [syncReady, setSyncReady] = useState(false);

  const [scopeType, setScopeType] = useState<'BUNDLE' | 'APPLICATION' | 'PROGRAM'>('BUNDLE');
  const [scopeId, setScopeId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [environmentTimeline, setEnvironmentTimeline] = useState<Array<{ name: string; startDate?: string | null }>>([]);
  const [goLiveDate, setGoLiveDate] = useState('');
  const [stabilizationEndDate, setStabilizationEndDate] = useState('');
  const [milestoneCount, setMilestoneCount] = useState(4);
  const [sprintDurationWeeks, setSprintDurationWeeks] = useState(2);
  const [milestoneDurationStrategy, setMilestoneDurationStrategy] = useState<'AUTO_DISTRIBUTE' | 'FIXED_WEEKS'>('AUTO_DISTRIBUTE');
  const [milestoneDurationWeeks, setMilestoneDurationWeeks] = useState(3);
  const [deliveryPattern, setDeliveryPattern] = useState<'STANDARD_PHASED' | 'PRODUCT_INCREMENT' | 'MIGRATION' | 'COMPLIANCE'>('STANDARD_PHASED');
  const [backlogShape, setBacklogShape] = useState<'LIGHT' | 'STANDARD' | 'DETAILED'>('STANDARD');
  const [projectSize, setProjectSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE'>('MEDIUM');
  const [storiesPerFeatureTarget, setStoriesPerFeatureTarget] = useState<number | ''>('');
  const [featuresPerMilestoneTarget, setFeaturesPerMilestoneTarget] = useState<number | ''>('');
  const [tasksPerStoryTarget, setTasksPerStoryTarget] = useState<number | ''>('');
  const [storiesPerFeatureTouched, setStoriesPerFeatureTouched] = useState(false);
  const [featuresPerMilestoneTouched, setFeaturesPerMilestoneTouched] = useState(false);
  const [tasksPerStoryTouched, setTasksPerStoryTouched] = useState(false);
  const [capacityMode, setCapacityMode] = useState<'TEAM_VELOCITY' | 'DIRECT_SPRINT_CAPACITY'>('TEAM_VELOCITY');
  const [deliveryTeams, setDeliveryTeams] = useState<number | ''>(1);
  const [sprintVelocityPerTeam, setSprintVelocityPerTeam] = useState<number | ''>(30);
  const [directSprintCapacity, setDirectSprintCapacity] = useState<number | ''>('');
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

  const resolveEnvironment = (envs: PlanningEnvironmentEntry[] | undefined, name: string) => {
    const key = name.toUpperCase();
    return envs?.find((env) => String(env?.name || '').toUpperCase() === key) || null;
  };

  const applyPlanningMetadata = (meta?: ApplicationPlanningMetadata | null) => {
    if (!meta) return;
    const envs = meta.environments || [];
    const prod = resolveEnvironment(envs, 'PROD');
    const earliestStart = envs
      .map((row) => row.startDate)
      .filter(Boolean)
      .sort()[0] || '';

    setPlannedStartDate(earliestStart || '');
    setEnvironmentTimeline(envs.map((env) => ({
      name: String(env.name || '').toUpperCase(),
      startDate: env.startDate || ''
    })));
    setGoLiveDate(meta.goLive?.planned || prod?.startDate || '');
    setStabilizationEndDate(prod?.endDate || '');

    if (typeof meta.planningDefaults?.milestoneCount === 'number') {
      setMilestoneCount(meta.planningDefaults.milestoneCount || 1);
    }
    if (typeof meta.planningDefaults?.sprintDurationWeeks === 'number') {
      setSprintDurationWeeks(meta.planningDefaults.sprintDurationWeeks || 1);
    }
    if (typeof meta.planningDefaults?.milestoneDurationWeeks === 'number') {
      setMilestoneDurationStrategy('FIXED_WEEKS');
      setMilestoneDurationWeeks(meta.planningDefaults.milestoneDurationWeeks || 1);
    } else {
      setMilestoneDurationStrategy('AUTO_DISTRIBUTE');
    }

    if (meta.capacityDefaults?.capacityModel) {
      setCapacityMode(meta.capacityDefaults.capacityModel);
    }
    if (typeof meta.capacityDefaults?.deliveryTeams === 'number') {
      setDeliveryTeams(meta.capacityDefaults.deliveryTeams);
    }
    if (typeof meta.capacityDefaults?.sprintVelocityPerTeam === 'number') {
      setSprintVelocityPerTeam(meta.capacityDefaults.sprintVelocityPerTeam);
    }
    if (typeof meta.capacityDefaults?.directSprintCapacity === 'number') {
      setDirectSprintCapacity(meta.capacityDefaults.directSprintCapacity);
    }
    if (meta.capacityDefaults?.projectSize) {
      setProjectSize(meta.capacityDefaults.projectSize);
    }
  };

  const PROJECT_SIZE_DEFAULTS = useMemo(() => ({
    SMALL: { featuresPerMilestoneTarget: 2, storiesPerFeatureTarget: 3, tasksPerStoryTarget: 0 },
    MEDIUM: { featuresPerMilestoneTarget: 3, storiesPerFeatureTarget: 5, tasksPerStoryTarget: 1 },
    LARGE: { featuresPerMilestoneTarget: 4, storiesPerFeatureTarget: 8, tasksPerStoryTarget: 2 },
    ENTERPRISE: { featuresPerMilestoneTarget: 5, storiesPerFeatureTarget: 10, tasksPerStoryTarget: 2 }
  }), []);

  useEffect(() => {
    const defaults = PROJECT_SIZE_DEFAULTS[projectSize];
    if (!featuresPerMilestoneTouched) {
      setFeaturesPerMilestoneTarget(defaults.featuresPerMilestoneTarget);
    }
    if (!storiesPerFeatureTouched) {
      setStoriesPerFeatureTarget(defaults.storiesPerFeatureTarget);
    }
    if (!tasksPerStoryTouched) {
      setTasksPerStoryTarget(defaults.tasksPerStoryTarget);
    }
  }, [projectSize, PROJECT_SIZE_DEFAULTS, featuresPerMilestoneTouched, storiesPerFeatureTouched, tasksPerStoryTouched]);

  const derivedMilestoneDurationWeeks = useMemo(() => {
    if (milestoneDurationStrategy !== 'AUTO_DISTRIBUTE') return null;
    const firstEnvStart = environmentTimeline.find((env) => env.startDate)?.startDate || '';
    const effectiveStart = plannedStartDate || firstEnvStart;
    if (!effectiveStart || !goLiveDate || !milestoneCount) return null;
    const start = new Date(effectiveStart);
    const end = new Date(goLiveDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const weeks = milestoneCount > 0 ? days / milestoneCount / 7 : 0;
    return Math.round(weeks * 10) / 10;
  }, [milestoneDurationStrategy, plannedStartDate, environmentTimeline, goLiveDate, milestoneCount]);

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

  useEffect(() => {
    if (!scopeId || scopeType === 'PROGRAM') return;
    const scopeKey = `${scopeType}:${scopeId}`;
    if (scopeKey === lastLoadedScope) return;
    let active = true;
    setPlanningContextLoading(true);
    setPlanningContextError('');
    setSyncReady(false);

    const load = async () => {
      try {
        if (scopeType === 'APPLICATION') {
          const res = await fetch(`/api/applications/${encodeURIComponent(scopeId)}/planning-context`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to load planning context');
          if (!active) return;
          setPlanningContext({
            bundleMetadata: data?.bundleMetadata || null,
            applicationMetadata: data?.applicationMetadata || null,
            resolvedMetadata: data?.resolvedMetadata || null
          });
          applyPlanningMetadata(data?.resolvedMetadata || null);
        } else {
          const res = await fetch(`/api/applications/planning-metadata?scopeType=bundle&scopeId=${encodeURIComponent(scopeId)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Failed to load planning metadata');
          if (!active) return;
          setPlanningContext({
            bundleMetadata: data?.planningMetadata || null,
            applicationMetadata: null,
            resolvedMetadata: data?.planningMetadata || null
          });
          applyPlanningMetadata(data?.planningMetadata || null);
        }
        if (active) {
          setLastLoadedScope(scopeKey);
          setSyncReady(true);
        }
      } catch (err: any) {
        if (!active) return;
        setPlanningContextError(err?.message || 'Failed to load planning context');
      } finally {
        if (active) setPlanningContextLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [scopeType, scopeId, lastLoadedScope]);

  const buildUpdatedEnvironments = (existing: PlanningEnvironmentEntry[] | undefined) => {
    const rows = Array.isArray(existing) ? [...existing] : [];
    const upsertEnv = (name: string, updates: Partial<PlanningEnvironmentEntry>) => {
      const key = name.toUpperCase();
      const index = rows.findIndex((row) => String(row?.name || '').toUpperCase() === key);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...updates, name: key };
      } else if (updates.startDate || updates.endDate || updates.durationDays || updates.actualStart || updates.actualEnd) {
        rows.push({ name: key, ...updates });
      }
    };

    environmentTimeline.forEach((env) => {
      upsertEnv(env.name, { startDate: env.startDate || null });
    });

    if (goLiveDate) {
      upsertEnv('PROD', { startDate: goLiveDate || null });
    }
    if (stabilizationEndDate) {
      upsertEnv('PROD', { endDate: stabilizationEndDate || null });
    }

    return rows.map((row) => ({
      ...row,
      name: String(row?.name || '').toUpperCase()
    }));
  };

  const buildPlanningMetadataPayload = (changedOnly = false) => {
    const scope = scopeType === 'APPLICATION' ? 'application' : 'bundle';
    const baseMeta = scope === 'application' ? planningContext?.applicationMetadata : planningContext?.bundleMetadata;
    const bundleId = scope === 'application'
      ? (planningContext?.resolvedMetadata?.bundleId || baseMeta?.bundleId || null)
      : scopeId;
    const applicationId = scope === 'application'
      ? (planningContext?.resolvedMetadata?.applicationId || baseMeta?.applicationId || scopeId)
      : null;

    const updatedEnvs = buildUpdatedEnvironments(baseMeta?.environments);
    const baseEnvs = baseMeta?.environments || [];
    const envChanged = updatedEnvs.length !== baseEnvs.length ||
      updatedEnvs.some((env) => {
        const existing = baseEnvs.find((row) => String(row?.name || '').toUpperCase() === String(env.name || '').toUpperCase());
        return (existing?.startDate || '') !== (env.startDate || '');
      });

    const updatedPlanningDefaults = {
      milestoneCount: milestoneCount || null,
      sprintDurationWeeks: sprintDurationWeeks || null,
      milestoneDurationWeeks: milestoneDurationStrategy === 'FIXED_WEEKS' ? milestoneDurationWeeks || null : null
    };
    const planningChanged = (
      (baseMeta?.planningDefaults?.milestoneCount ?? null) !== (updatedPlanningDefaults.milestoneCount ?? null) ||
      (baseMeta?.planningDefaults?.sprintDurationWeeks ?? null) !== (updatedPlanningDefaults.sprintDurationWeeks ?? null) ||
      (baseMeta?.planningDefaults?.milestoneDurationWeeks ?? null) !== (updatedPlanningDefaults.milestoneDurationWeeks ?? null)
    );

    const updatedCapacityDefaults = {
      capacityModel: capacityMode || null,
      deliveryTeams: capacityMode === 'TEAM_VELOCITY' ? (deliveryTeams === '' ? null : Number(deliveryTeams)) : (baseMeta?.capacityDefaults?.deliveryTeams ?? null),
      sprintVelocityPerTeam: capacityMode === 'TEAM_VELOCITY' ? (sprintVelocityPerTeam === '' ? null : Number(sprintVelocityPerTeam)) : (baseMeta?.capacityDefaults?.sprintVelocityPerTeam ?? null),
      directSprintCapacity: capacityMode === 'DIRECT_SPRINT_CAPACITY' ? (directSprintCapacity === '' ? null : Number(directSprintCapacity)) : (baseMeta?.capacityDefaults?.directSprintCapacity ?? null),
      teamSize: baseMeta?.capacityDefaults?.teamSize ?? null,
      projectSize: projectSize || baseMeta?.capacityDefaults?.projectSize || null
    };
    const capacityChanged = (
      (baseMeta?.capacityDefaults?.capacityModel ?? null) !== (updatedCapacityDefaults.capacityModel ?? null) ||
      (baseMeta?.capacityDefaults?.deliveryTeams ?? null) !== (updatedCapacityDefaults.deliveryTeams ?? null) ||
      (baseMeta?.capacityDefaults?.sprintVelocityPerTeam ?? null) !== (updatedCapacityDefaults.sprintVelocityPerTeam ?? null) ||
      (baseMeta?.capacityDefaults?.directSprintCapacity ?? null) !== (updatedCapacityDefaults.directSprintCapacity ?? null) ||
      (baseMeta?.capacityDefaults?.projectSize ?? null) !== (updatedCapacityDefaults.projectSize ?? null)
    );

    const goLiveChanged = (baseMeta?.goLive?.planned || '') !== (goLiveDate || '');

    const payload: any = {
      scopeType: scope,
      scopeId,
      bundleId,
      applicationId
    };

    if (!changedOnly || envChanged) {
      payload.environments = updatedEnvs;
    }
    if (!changedOnly || goLiveChanged) {
      payload.goLive = {
        planned: goLiveDate || null,
        actual: baseMeta?.goLive?.actual ?? null
      };
    }
    if (!changedOnly || planningChanged) {
      payload.planningDefaults = updatedPlanningDefaults;
    }
    if (!changedOnly || capacityChanged) {
      payload.capacityDefaults = updatedCapacityDefaults;
    }
    if (!changedOnly) {
      payload.notes = baseMeta?.notes ?? null;
    }

    const hasChanges = envChanged || goLiveChanged || planningChanged || capacityChanged;
    return { payload, hasChanges };
  };

  const persistPlanningMetadata = async () => {
    if (!syncReady) return;
    if (!scopeId || scopeType === 'PROGRAM') return;
    if (planningContextLoading) return;
    const { payload, hasChanges } = buildPlanningMetadataPayload(true);
    if (!hasChanges) return;
    try {
      await fetch('/api/applications/planning-metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      // Best-effort sync only.
    }
  };

  const milestoneRows = Array.from({ length: milestoneCount }, (_, i) => i + 1);

  const capacityModeLabel = useMemo(() => ({
    TEAM_VELOCITY: 'Teams × velocity',
    DIRECT_SPRINT_CAPACITY: 'Direct sprint capacity',
    BUNDLE_CAPACITY_FALLBACK: 'Bundle capacity fallback',
    NONE: 'No capacity'
  }), []);

  const environmentFlowOptions = useMemo(() => {
    const names = environmentTimeline.map((env) => String(env?.name || '').toUpperCase()).filter(Boolean);
    if (names.length === 0) {
      return [{ value: 'CUSTOM', label: 'Custom' }];
    }
    const hasDev = names.includes('DEV');
    const hasUat = names.includes('UAT');
    const hasProd = names.includes('PROD');
    const hasSit = names.includes('SIT');
    if (hasDev && hasUat && hasProd && names.length === 3) {
      return [{ value: 'DEV_UAT_PROD', label: 'Dev → UAT → Prod' }, { value: 'CUSTOM', label: 'Custom' }];
    }
    if (hasDev && hasSit && hasUat && hasProd && names.length === 4) {
      return [{ value: 'DEV_SIT_UAT_PROD', label: 'Dev → SIT → UAT → Prod' }, { value: 'CUSTOM', label: 'Custom' }];
    }
    return [{ value: 'CUSTOM', label: names.join(' → ') }];
  }, [environmentTimeline]);

  useEffect(() => {
    const values = environmentFlowOptions.map((opt) => opt.value);
    if (!values.includes(environmentFlow)) {
      setEnvironmentFlow(values[0]);
    }
  }, [environmentFlowOptions, environmentFlow]);

  const resolvePlanDates = () => {
    const byName = new Map<string, string>();
    environmentTimeline.forEach((env) => {
      const key = String(env?.name || '').toUpperCase();
      if (key && env.startDate) byName.set(key, env.startDate);
    });
    const firstStart = environmentTimeline.find((env) => env.startDate)?.startDate || '';
    const lastStart = environmentTimeline.length > 0 ? (environmentTimeline[environmentTimeline.length - 1]?.startDate || '') : '';
    const devStart = byName.get('DEV') || firstStart;
    const uatStart = byName.get('UAT') || (environmentTimeline.length > 1 ? (environmentTimeline[environmentTimeline.length - 2]?.startDate || firstStart) : firstStart);
    const integrationStart = byName.get('INT') || byName.get('SIT') || '';
    const prodStart = byName.get('PROD') || lastStart || '';

    return {
      devStartDate: devStart || '',
      integrationStartDate: integrationStart || undefined,
      uatStartDate: uatStart || '',
      goLiveDate: goLiveDate || prodStart || ''
    };
  };

  const validatePlanDates = () => {
    const dates = resolvePlanDates();
    if (!dates.devStartDate || !dates.uatStartDate || !dates.goLiveDate) {
      return 'Please provide start dates for the delivery environments and a Go-Live date.';
    }
    return null;
  };

  const buildPayload = () => ({
    ...resolvePlanDates(),
    scopeType,
    scopeId,
    plannedStartDate: plannedStartDate || undefined,
    stabilizationEndDate: stabilizationEndDate || undefined,
    milestoneCount,
    sprintDurationWeeks,
    milestoneDurationStrategy,
    milestoneDurationWeeks: milestoneDurationStrategy === 'FIXED_WEEKS' ? milestoneDurationWeeks : undefined,
    deliveryPattern,
    backlogShape,
    projectSize,
    storiesPerFeatureTarget: storiesPerFeatureTarget ? Number(storiesPerFeatureTarget) : undefined,
    featuresPerMilestoneTarget: featuresPerMilestoneTarget ? Number(featuresPerMilestoneTarget) : undefined,
    tasksPerStoryTarget: tasksPerStoryTarget !== '' ? Number(tasksPerStoryTarget) : undefined,
    capacityMode,
    deliveryTeams: capacityMode === 'TEAM_VELOCITY' && deliveryTeams !== '' ? Number(deliveryTeams) : undefined,
    sprintVelocityPerTeam: capacityMode === 'TEAM_VELOCITY' && sprintVelocityPerTeam !== '' ? Number(sprintVelocityPerTeam) : undefined,
    directSprintCapacity: capacityMode === 'DIRECT_SPRINT_CAPACITY' && directSprintCapacity !== '' ? Number(directSprintCapacity) : undefined,
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
      const validationError = validatePlanDates();
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }
      await persistPlanningMetadata();
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
      await persistPlanningMetadata();
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
      <div className="bg-white rounded-[3rem] w-full max-w-[1200px] p-12 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
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
        {planningContextError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-2xl">
            {planningContextError}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scope</h4>
            <section className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Scope Type</label>
                <select value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="BUNDLE">Bundle</option>
                  <option value="APPLICATION">Application</option>
                  <option value="PROGRAM">Program</option>
                </select>
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Planned Start (optional)</label>
                <input type="date" value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none" />
              </div>
            </section>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Timeline</h4>
            <EnvironmentTimelineInputs
              environments={environmentTimeline}
              onChange={setEnvironmentTimeline}
              goLiveDate={goLiveDate}
              onGoLiveChange={setGoLiveDate}
            />

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestone Planning</h4>
            <section className="grid grid-cols-4 gap-4">
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
                {milestoneDurationStrategy === 'FIXED_WEEKS' ? (
                  <input
                    type="number"
                    min={1}
                    value={milestoneDurationWeeks}
                    onChange={(e) => setMilestoneDurationWeeks(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-600">
                    {derivedMilestoneDurationWeeks != null ? `${derivedMilestoneDurationWeeks} weeks (derived)` : 'Derived from dates'}
                  </div>
                )}
              </div>
            </section>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capacity & Delivery Model</h4>
            <section className="grid grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Capacity Mode</label>
                <select value={capacityMode} onChange={(e) => setCapacityMode(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="TEAM_VELOCITY">Teams × velocity</option>
                  <option value="DIRECT_SPRINT_CAPACITY">Direct sprint capacity</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  {capacityMode === 'TEAM_VELOCITY' ? 'Teams × Velocity' : 'Sprint Capacity'}
                </label>
                {capacityMode === 'TEAM_VELOCITY' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={1} value={deliveryTeams} onChange={(e) => setDeliveryTeams(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none" placeholder="Teams" />
                    <input type="number" min={1} value={sprintVelocityPerTeam} onChange={(e) => setSprintVelocityPerTeam(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none" placeholder="Velocity" />
                  </div>
                ) : (
                  <input type="number" min={1} value={directSprintCapacity} onChange={(e) => setDirectSprintCapacity(e.target.value ? Number(e.target.value) : '')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none" />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Pattern</label>
                <select value={deliveryPattern} onChange={(e) => setDeliveryPattern(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none">
                  <option value="STANDARD_PHASED">Standard phased</option>
                  <option value="PRODUCT_INCREMENT">Product increment</option>
                  <option value="MIGRATION">Migration / rollout</option>
                  <option value="COMPLIANCE">Compliance / governance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Backlog Shape</label>
                <select value={backlogShape} onChange={(e) => setBacklogShape(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none">
                  <option value="LIGHT">Light</option>
                  <option value="STANDARD">Standard</option>
                  <option value="DETAILED">Detailed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Size</label>
                <select value={projectSize} onChange={(e) => setProjectSize(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none">
                  <option value="SMALL">Small</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LARGE">Large</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </section>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Backlog Shape</h4>
            <section className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Stories per Feature</label>
                <input
                  type="number"
                  min={1}
                  value={storiesPerFeatureTarget}
                  onChange={(e) => {
                    setStoriesPerFeatureTouched(true);
                    setStoriesPerFeatureTarget(e.target.value ? Number(e.target.value) : '');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Features per Milestone</label>
                <input
                  type="number"
                  min={1}
                  value={featuresPerMilestoneTarget}
                  onChange={(e) => {
                    setFeaturesPerMilestoneTouched(true);
                    setFeaturesPerMilestoneTarget(e.target.value ? Number(e.target.value) : '');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tasks per Story</label>
                <input
                  type="number"
                  min={0}
                  value={tasksPerStoryTarget}
                  onChange={(e) => {
                    setTasksPerStoryTouched(true);
                    setTasksPerStoryTarget(e.target.value ? Number(e.target.value) : '');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </section>

            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Automation Options</h4>
            <section className="grid grid-cols-3 gap-4">
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
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
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

            <section className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Create Dependency Skeleton</label>
                <select value={createDependencySkeleton ? 'yes' : 'no'} onChange={(e) => setCreateDependencySkeleton(e.target.value === 'yes')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none">
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
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

            <section className="grid grid-cols-3 gap-4">
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

            <div className="grid grid-cols-3 gap-4">
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 inline-flex items-center gap-2">
                  Capacity Mode
                  <ExplainabilityIcon explainabilityKey="capacity_utilization" />
                </div>
                <div className="text-sm font-semibold text-slate-700 mt-2">
                  {capacityModeLabel[preview.capacitySummary?.mode || 'NONE']}
                </div>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 inline-flex items-center gap-2">
                  Sprint Capacity
                  <ExplainabilityIcon explainabilityKey="capacity_utilization" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {preview.capacitySummary?.sprintCapacity != null ? preview.capacitySummary.sprintCapacity : '—'}
                </div>
              </div>
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 inline-flex items-center gap-2">
                  Derived Milestone Duration
                  <ExplainabilityIcon explainabilityKey="forecast_window" />
                </div>
                <div className="text-sm font-semibold text-slate-700 mt-2">
                  {preview.derived?.milestoneDurationWeeks != null
                    ? `${preview.derived.milestoneDurationWeeks} weeks${preview.derived.milestoneDurationDays != null ? ` (${preview.derived.milestoneDurationDays} days)` : ''}`
                    : '—'}
                </div>
              </div>
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
                      <th className="text-left py-2">Target Capacity</th>
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
                        <td className="py-2 text-slate-500">{m.targetCapacity != null ? m.targetCapacity : '—'}</td>
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
