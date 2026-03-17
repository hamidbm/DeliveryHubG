import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  WorkItem,
  Application,
  Bundle,
  Milestone,
  PlanningEnvironmentEntry,
  WorkItemStatus,
  MilestoneForecast,
  MilestoneProbabilisticForecast
} from '../types';
import RoadmapTabs, { RoadmapViewKey } from './roadmap/RoadmapTabs';
import ExecutionBoardView from './roadmap/ExecutionBoardView';
import RoadmapTimelineView from './roadmap/RoadmapTimelineView';
import RoadmapSwimlaneView from './roadmap/RoadmapSwimlaneView';
import RoadmapDependencyView from './roadmap/RoadmapDependencyView';
import { transformRawRoadmapData } from './roadmap/roadmapViewModels';
import SimulationEditor from './SimulationEditor';
import OptimizationEditor from './OptimizationEditor';

interface WorkItemsRoadmapViewProps {
  applications: Application[];
  bundles: Bundle[];
  selBundleId: string;
  selAppId: string;
  selEpicId: string;
  searchQuery: string;
  quickFilter?: string;
  activeFilters?: { types: string[]; priorities: string[]; health: string[] };
  includeArchived?: boolean;
}

const getGithubActivity = (item?: WorkItem) => {
  if (!item) return null;
  const prs = item.github?.prs || [];
  if (!prs.length) return 'stale';
  const now = Date.now();
  const active = prs.some((pr) => pr.state === 'open' && now - new Date(pr.updatedAt).getTime() <= 3 * 24 * 60 * 60 * 1000);
  return active ? 'active' : 'stale';
};

type OptimizationAppliedSummary = {
  planId?: string;
  source?: 'CREATED_PLAN' | 'PREVIEW';
  scopeType?: string;
  scopeId?: string;
  acceptedVariantId?: string;
  acceptedVariantName?: string;
  acceptedVariantScore?: number;
  objectiveWeights?: {
    onTime?: number;
    riskReduction?: number;
    capacityBalance?: number;
    slippageMinimization?: number;
  };
  expectedImpact?: {
    onTimeProbabilityDelta?: number;
    expectedSlippageDaysDelta?: number;
    riskScoreDelta?: number;
    readinessScoreDelta?: number;
  };
  appliedAt?: string;
  appliedBy?: string;
  summary?: {
    totalChanges?: number;
    scheduleChanges?: number;
    capacityChanges?: number;
  };
};

const WorkItemsRoadmapView: React.FC<WorkItemsRoadmapViewProps> = ({
  applications, bundles, selBundleId, selAppId, selEpicId, searchQuery, quickFilter, activeFilters, includeArchived
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<RoadmapViewKey>('execution');
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [showOptimization, setShowOptimization] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<OptimizationAppliedSummary | null>(null);
  const [optimizationSummaryStatus, setOptimizationSummaryStatus] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [roadmapIntel, setRoadmapIntel] = useState<any[]>([]);
  const [forecastByMilestone, setForecastByMilestone] = useState<Record<string, MilestoneForecast>>({});
  const [forecastStatus, setForecastStatus] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [probForecastByMilestone, setProbForecastByMilestone] = useState<Record<string, MilestoneProbabilisticForecast>>({});
  const [probForecastStatus, setProbForecastStatus] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [planningEnvironments, setPlanningEnvironments] = useState<PlanningEnvironmentEntry[]>([]);
  const [planningGoLive, setPlanningGoLive] = useState<string | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [commitPolicy, setCommitPolicy] = useState<any | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [burnupCache, setBurnupCache] = useState<Record<string, any>>({});
  const [sprintCache, setSprintCache] = useState<Record<string, any[]>>({});
  const [criticalCache, setCriticalCache] = useState<Record<string, any>>({});
  const [includeExternalCritical, setIncludeExternalCritical] = useState<Record<string, boolean>>({});
  const [criticalModal, setCriticalModal] = useState<{ milestoneId: string; cacheKey: string } | null>(null);
  const [criticalModalMessage, setCriticalModalMessage] = useState<string | null>(null);
  const [staleModal, setStaleModal] = useState<{ milestoneId: string } | null>(null);
  const [estimateDrafts, setEstimateDrafts] = useState<Record<string, number | ''>>({});
  const [burnupStatus, setBurnupStatus] = useState<Record<string, { loading: boolean; error?: string }>>({});
  const [sprintStatus, setSprintStatus] = useState<Record<string, { loading: boolean; error?: string }>>({});
  const [criticalStatus, setCriticalStatus] = useState<Record<string, { loading: boolean; error?: string }>>({});
  const [commitDrift, setCommitDrift] = useState<Record<string, any>>({});
  const [commitDriftStatus, setCommitDriftStatus] = useState<Record<string, { loading: boolean; error?: string }>>({});
  const [driftModal, setDriftModal] = useState<{ milestoneId: string; drift: any } | null>(null);
  const [linkToast, setLinkToast] = useState<string | null>(null);
  const [dependencyModal, setDependencyModal] = useState<{ source: WorkItem; targetKey: string; target?: any; error?: string } | null>(null);
  const burnupInflight = useRef<Record<string, Promise<void>>>({});
  const sprintInflight = useRef<Record<string, Promise<void>>>({});
  const criticalInflight = useRef<Record<string, Promise<void>>>({});

  const fetchData = async () => {
    const params = new URLSearchParams({
      bundleId: selBundleId,
      applicationId: selAppId,
      q: searchQuery
    });
    if (selEpicId !== 'all') params.set('epicId', selEpicId);
    if (quickFilter) params.set('quickFilter', quickFilter);
    if (activeFilters?.types?.length) params.set('types', activeFilters.types.join(','));
    if (activeFilters?.priorities?.length) params.set('priorities', activeFilters.priorities.join(','));
    if (activeFilters?.health?.length) params.set('health', activeFilters.health.join(','));
    if (includeArchived) params.set('includeArchived', 'true');

    const [wRes, mRes] = await Promise.all([
      fetch(`/api/work-items?${params.toString()}`),
      fetch(`/api/milestones?${params.toString()}`)
    ]);
    setItems(await wRes.json());
    setMilestones(await mRes.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selBundleId, selAppId, selEpicId, searchQuery, quickFilter]);

  const loadIntel = async () => {
    if (!milestones.length) {
      setRoadmapIntel([]);
      return;
    }
    const ids = milestones.map(m => String(m._id || m.id || m.name)).filter(Boolean);
    setIntelLoading(true);
    setIntelError(null);
    console.time('roadmap:intel');
    try {
      const res = await fetch(`/api/work-items/roadmap-intel?milestoneIds=${encodeURIComponent(ids.join(','))}`);
      if (!res.ok) {
        setIntelError('Unable to load milestone intelligence.');
        return;
      }
      const data = await res.json();
      setRoadmapIntel(Array.isArray(data?.milestones) ? data.milestones : []);
    } catch {
      setIntelError('Unable to load milestone intelligence.');
      setRoadmapIntel([]);
    } finally {
      setIntelLoading(false);
      console.timeEnd('roadmap:intel');
    }
  };

  const loadForecast = async () => {
    const scopeType = selAppId && selAppId !== 'all'
      ? 'APPLICATION'
      : selBundleId && selBundleId !== 'all'
        ? 'BUNDLE'
        : '';
    const scopeId = scopeType === 'APPLICATION' ? selAppId : scopeType === 'BUNDLE' ? selBundleId : '';
    if (!scopeType || !scopeId) {
      setForecastByMilestone({});
      return;
    }
    setForecastStatus({ loading: true });
    try {
      const res = await fetch(`/api/forecast/plan/latest?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`);
      if (!res.ok) {
        setForecastStatus({ loading: false, error: 'Failed to load forecast.' });
        return;
      }
      const data = await res.json();
      const map: Record<string, MilestoneForecast> = {};
      (data?.milestoneForecasts || []).forEach((f: MilestoneForecast) => {
        map[String(f.milestoneId)] = f;
      });
      setForecastByMilestone(map);
      setForecastStatus({ loading: false });
    } catch {
      setForecastStatus({ loading: false, error: 'Failed to load forecast.' });
    }
  };

  const loadProbabilisticForecast = async () => {
    const scopeType = selAppId && selAppId !== 'all'
      ? 'APPLICATION'
      : selBundleId && selBundleId !== 'all'
        ? 'BUNDLE'
        : '';
    const scopeId = scopeType === 'APPLICATION' ? selAppId : scopeType === 'BUNDLE' ? selBundleId : '';
    if (!scopeType || !scopeId) {
      setProbForecastByMilestone({});
      return;
    }
    setProbForecastStatus({ loading: true });
    try {
      const res = await fetch(`/api/probabilistic-forecast/plan/latest?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`);
      if (!res.ok) {
        setProbForecastStatus({ loading: false, error: 'Failed to load probabilistic forecast.' });
        return;
      }
      const data = await res.json();
      const map: Record<string, MilestoneProbabilisticForecast> = {};
      (data?.milestoneForecasts || []).forEach((f: MilestoneProbabilisticForecast) => {
        map[String(f.milestoneId)] = f;
      });
      setProbForecastByMilestone(map);
      setProbForecastStatus({ loading: false });
    } catch {
      setProbForecastStatus({ loading: false, error: 'Failed to load probabilistic forecast.' });
    }
  };

  const loadPlanningEnvironments = async () => {
    const scopeType = selAppId && selAppId !== 'all'
      ? 'APPLICATION'
      : selBundleId && selBundleId !== 'all'
        ? 'BUNDLE'
        : '';
    const scopeId = scopeType === 'APPLICATION' ? selAppId : scopeType === 'BUNDLE' ? selBundleId : '';
    if (!scopeType || !scopeId) {
      setPlanningEnvironments([]);
      return;
    }
    try {
      if (scopeType === 'APPLICATION') {
        const res = await fetch(`/api/applications/${encodeURIComponent(scopeId)}/planning-context`);
        if (!res.ok) {
          setPlanningEnvironments([]);
          setPlanningGoLive(null);
          return;
        }
        const data = await res.json();
        setPlanningEnvironments(Array.isArray(data?.resolvedMetadata?.environments) ? data.resolvedMetadata.environments : []);
        setPlanningGoLive(data?.resolvedMetadata?.goLive?.planned || null);
      } else {
        const res = await fetch(`/api/applications/planning-metadata?scopeType=bundle&scopeId=${encodeURIComponent(scopeId)}`);
        if (!res.ok) {
          setPlanningEnvironments([]);
          setPlanningGoLive(null);
          return;
        }
        const data = await res.json();
        setPlanningEnvironments(Array.isArray(data?.planningMetadata?.environments) ? data.planningMetadata.environments : []);
        setPlanningGoLive(data?.planningMetadata?.goLive?.planned || null);
      }
    } catch {
      setPlanningEnvironments([]);
      setPlanningGoLive(null);
    }
  };

  const loadOptimizationSummary = async () => {
    const scopeType = selAppId && selAppId !== 'all'
      ? 'APPLICATION'
      : selBundleId && selBundleId !== 'all'
        ? 'BUNDLE'
        : '';
    const scopeId = scopeType === 'APPLICATION' ? selAppId : scopeType === 'BUNDLE' ? selBundleId : '';
    const params = new URLSearchParams();
    if (scopeType && scopeId) {
      params.set('scopeType', scopeType);
      params.set('scopeId', scopeId);
    }

    setOptimizationSummaryStatus({ loading: true });
    try {
      const res = await fetch(`/api/optimize/applied/latest${params.toString() ? `?${params.toString()}` : ''}`);
      if (!res.ok) {
        setOptimizationSummary(null);
        setOptimizationSummaryStatus({ loading: false, error: 'Failed to load optimization summary.' });
        return;
      }
      const data = await res.json();
      setOptimizationSummary((data?.item as OptimizationAppliedSummary) || null);
      setOptimizationSummaryStatus({ loading: false });
    } catch {
      setOptimizationSummary(null);
      setOptimizationSummaryStatus({ loading: false, error: 'Failed to load optimization summary.' });
    }
  };

  useEffect(() => {
    loadIntel();
  }, [milestones]);

  useEffect(() => {
    loadForecast();
  }, [selBundleId, selAppId]);

  useEffect(() => {
    loadProbabilisticForecast();
  }, [selBundleId, selAppId]);

  useEffect(() => {
    loadPlanningEnvironments();
  }, [selBundleId, selAppId]);

  useEffect(() => {
    loadOptimizationSummary();
  }, [selBundleId, selAppId]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    fetch('/api/admin/delivery-policy')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCommitPolicy(data?.policy || null))
      .catch(() => setCommitPolicy(null));
  }, []);

  const fetchCommitDriftSnapshots = async (milestoneList: Milestone[]) => {
    if (!milestoneList.length) return;
    const ids = milestoneList.map((m) => String(m._id || m.id || m.name)).filter(Boolean);
    if (!ids.length) return;
    const statusMap: Record<string, { loading: boolean; error?: string }> = {};
    ids.forEach((id) => {
      statusMap[id] = { loading: true };
    });
    setCommitDriftStatus(statusMap);
    try {
      const res = await fetch(`/api/milestones/commit-drift/snapshots?milestoneIds=${encodeURIComponent(ids.join(','))}`);
      if (!res.ok) {
        setCommitDriftStatus((prev) => Object.fromEntries(ids.map((id) => [id, { loading: false, error: 'Failed to load drift.' }])));
        return;
      }
      const data = await res.json();
      const map: Record<string, any> = {};
      (data?.items || []).forEach((item: any) => {
        map[String(item.milestoneId)] = item;
      });
      setCommitDrift(map);
      setCommitDriftStatus((prev) => Object.fromEntries(ids.map((id) => [id, { loading: false }])));
    } catch {
      setCommitDriftStatus((prev) => Object.fromEntries(ids.map((id) => [id, { loading: false, error: 'Failed to load drift.' }])));
    }
  };

  const refreshCommitDrift = async (milestoneId: string) => {
    if (commitDriftStatus[milestoneId]?.loading) return;
    setCommitDriftStatus((prev) => ({ ...prev, [milestoneId]: { loading: true } }));
    try {
      const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/commit-drift`);
      if (!res.ok) {
        setCommitDriftStatus((prev) => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load drift.' } }));
        return;
      }
      const data = await res.json();
      if (data?.enabled) {
        setCommitDrift((prev) => ({ ...prev, [milestoneId]: data.drift || null }));
      } else {
        setCommitDrift((prev) => ({ ...prev, [milestoneId]: null }));
      }
      setCommitDriftStatus((prev) => ({ ...prev, [milestoneId]: { loading: false } }));
    } catch {
      setCommitDriftStatus((prev) => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load drift.' } }));
    }
  };

  useEffect(() => {
    if (!milestones.length) return;
    setCommitDrift({});
    setCommitDriftStatus({});
    const candidates = milestones.filter((m) => ['COMMITTED', 'IN_PROGRESS'].includes(String(m.status || '').toUpperCase()));
    fetchCommitDriftSnapshots(candidates);
  }, [milestones]);

  useEffect(() => {
    if (!criticalModalMessage) return;
    const t = setTimeout(() => setCriticalModalMessage(null), 2500);
    return () => clearTimeout(t);
  }, [criticalModalMessage]);

  const fetchBurnup = async (milestoneId: string) => {
    if (burnupCache[milestoneId]) return;
    if (burnupInflight.current[milestoneId]) return burnupInflight.current[milestoneId];
    setBurnupStatus(prev => ({ ...prev, [milestoneId]: { loading: true } }));
    const params = new URLSearchParams();
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    const promise = (async () => {
      console.time(`burnup:${milestoneId}`);
      try {
        const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/burnup?${params.toString()}`);
        if (!res.ok) {
          setBurnupStatus(prev => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load burn-up.' } }));
          return;
        }
        const data = await res.json();
        setBurnupCache(prev => ({ ...prev, [milestoneId]: data }));
        setBurnupStatus(prev => ({ ...prev, [milestoneId]: { loading: false } }));
      } catch {
        setBurnupStatus(prev => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load burn-up.' } }));
      } finally {
        console.timeEnd(`burnup:${milestoneId}`);
        delete burnupInflight.current[milestoneId];
      }
    })();
    burnupInflight.current[milestoneId] = promise;
    return promise;
  };

  const fetchSprintRollups = async (milestoneId: string) => {
    if (sprintCache[milestoneId]) return;
    if (sprintInflight.current[milestoneId]) return sprintInflight.current[milestoneId];
    setSprintStatus(prev => ({ ...prev, [milestoneId]: { loading: true } }));
    const params = new URLSearchParams();
    params.set('milestoneId', milestoneId);
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    const promise = (async () => {
      console.time(`sprints:${milestoneId}`);
      try {
        const res = await fetch(`/api/sprints/rollups?${params.toString()}`);
        if (!res.ok) {
          setSprintStatus(prev => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load sprint rollups.' } }));
          return;
        }
        const data = await res.json();
        setSprintCache(prev => ({ ...prev, [milestoneId]: Array.isArray(data) ? data : [] }));
        setSprintStatus(prev => ({ ...prev, [milestoneId]: { loading: false } }));
      } catch {
        setSprintStatus(prev => ({ ...prev, [milestoneId]: { loading: false, error: 'Failed to load sprint rollups.' } }));
      } finally {
        console.timeEnd(`sprints:${milestoneId}`);
        delete sprintInflight.current[milestoneId];
      }
    })();
    sprintInflight.current[milestoneId] = promise;
    return promise;
  };

  const fetchCriticalPath = async (milestoneId: string, includeExternalOverride?: boolean) => {
    const hasSetting = Object.prototype.hasOwnProperty.call(includeExternalCritical, milestoneId);
    const includeExternal = includeExternalOverride !== undefined
      ? includeExternalOverride
      : (hasSetting ? includeExternalCritical[milestoneId] : undefined);
    const cacheKey = `${milestoneId}:${includeExternal ? '1' : '0'}`;
    if (criticalCache[cacheKey]) return;
    if (criticalInflight.current[cacheKey]) return criticalInflight.current[cacheKey];
    setCriticalStatus(prev => ({ ...prev, [cacheKey]: { loading: true } }));
    const promise = (async () => {
      try {
        const params = new URLSearchParams();
        if (includeExternal === true) {
          params.set('includeExternal', 'true');
          params.set('maxExternalDepth', '3');
        }
        const res = await fetch(`/api/milestones/${encodeURIComponent(milestoneId)}/critical-path${params.toString() ? `?${params.toString()}` : ''}`);
        if (!res.ok) {
          setCriticalStatus(prev => ({ ...prev, [cacheKey]: { loading: false, error: 'Failed to load critical path.' } }));
          return;
        }
        const data = await res.json();
        setCriticalCache(prev => ({ ...prev, [cacheKey]: data }));
        setCriticalStatus(prev => ({ ...prev, [cacheKey]: { loading: false } }));
        if (!hasSetting) {
          const externalCount = data?.nodesByScope?.external || data?.external?.includedNodes || 0;
          if (externalCount > 0) {
            const newKey = `${milestoneId}:1`;
            setIncludeExternalCritical((prev) => ({ ...prev, [milestoneId]: true }));
            setCriticalCache(prev => ({ ...prev, [newKey]: data }));
          }
        }
      } catch {
        setCriticalStatus(prev => ({ ...prev, [cacheKey]: { loading: false, error: 'Failed to load critical path.' } }));
      } finally {
        delete criticalInflight.current[cacheKey];
      }
    })();
    criticalInflight.current[cacheKey] = promise;
    return promise;
  };

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const next = { ...prev, [milestoneId]: !prev[milestoneId] };
      if (!prev[milestoneId]) {
        fetchBurnup(milestoneId);
        fetchSprintRollups(milestoneId);
        fetchCriticalPath(milestoneId);
      }
      return next;
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const expanded = params.get('milestones');
    if (expanded) {
      const expandedIds = expanded.split(',').filter(Boolean);
      const next: Record<string, boolean> = {};
      expandedIds.forEach((id) => { next[id] = true; });
      setExpandedMilestones(next);
    }
    const focus = params.get('focusMilestone') || (window.location.hash.startsWith('#milestone=') ? window.location.hash.replace('#milestone=', '') : '');
    if (focus) {
      setExpandedMilestones(prev => ({ ...prev, [focus]: true }));
      fetchBurnup(focus);
      fetchSprintRollups(focus);
      fetchCriticalPath(focus);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
    if (selAppId && selAppId !== 'all') params.set('applicationId', selAppId);
    const expanded = Object.keys(expandedMilestones).filter((id) => expandedMilestones[id]);
    if (expanded.length) params.set('milestones', expanded.join(','));
    else params.delete('milestones');
    const url = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`;
    window.history.replaceState({}, '', url);
  }, [expandedMilestones, selBundleId, selAppId]);

  type StatusBuckets = Partial<Record<WorkItemStatus, WorkItem[]>>;

  const makeStatusBuckets = (): StatusBuckets => ({
    [WorkItemStatus.TODO]: [],
    [WorkItemStatus.IN_PROGRESS]: [],
    [WorkItemStatus.REVIEW]: [],
    [WorkItemStatus.BLOCKED]: [],
    [WorkItemStatus.DONE]: []
  });

  const groupedItems = useMemo(() => {
    const groups: Record<string, StatusBuckets> = {};
    items.forEach((item) => {
      const ids = item.milestoneIds || [];
      const legacy = (item as any).milestoneId;
      const milestoneId = ids[0] ? String(ids[0]) : (legacy ? String(legacy) : null);
      if (!milestoneId) return;
      if (!groups[milestoneId]) {
        groups[milestoneId] = makeStatusBuckets();
      }
      const status = item.status || WorkItemStatus.TODO;
      const bucket = groups[milestoneId][status as WorkItemStatus] ? status as WorkItemStatus : WorkItemStatus.TODO;
      const target = groups[milestoneId][bucket] as WorkItem[] | undefined;
      if (target) target.push(item);
    });
    return groups;
  }, [items]);

  const intelByMilestone = useMemo(() => {
    const map: Record<string, any> = {};
    roadmapIntel.forEach((entry) => {
      const key = String(entry?.milestone?._id || entry?.milestone?.id || entry?.milestone?.name || entry?.milestoneId || '');
      if (key) map[key] = entry;
    });
    return map;
  }, [roadmapIntel]);

  const roadmapViewModel = useMemo(() => {
    const base = transformRawRoadmapData({
      milestones,
      items,
      roadmapIntel,
      sprintCache
    });
    const bundleLabelById = new Map<string, string>();
    bundles.forEach((bundle) => {
      const label = String(bundle.name || bundle.key || bundle.id || bundle._id || '');
      if (!label) return;
      const ids = [bundle._id, bundle.id, bundle.key].filter(Boolean).map((value) => String(value));
      ids.forEach((id) => bundleLabelById.set(id, label));
    });
    const appLabelById = new Map<string, string>();
    applications.forEach((app) => {
      const label = String(app.name || app.aid || app.id || app._id || '');
      if (!label) return;
      const ids = [app._id, app.id, app.aid].filter(Boolean).map((value) => String(value));
      ids.forEach((id) => appLabelById.set(id, label));
    });

    return {
      ...base,
      milestones: base.milestones.map((milestone) => ({
        ...milestone,
        bundleLabel: milestone.bundleId ? (bundleLabelById.get(String(milestone.bundleId)) || milestone.bundleId) : undefined,
        applicationLabel: milestone.applicationId ? (appLabelById.get(String(milestone.applicationId)) || milestone.applicationId) : undefined
      }))
    };
  }, [milestones, items, roadmapIntel, sprintCache, bundles, applications]);

  const getBurnupTrend = (milestoneId: string) => {
    const burn = burnupCache[milestoneId];
    if (!burn?.trend) return null;
    return burn.trend;
  };

  const getActiveSprint = (milestoneId: string) => {
    const rollups = sprintCache[milestoneId] || [];
    return rollups.find((r: any) => String(r.status || '').toUpperCase() === 'ACTIVE') || rollups[0];
  };

  const invalidateCaches = () => {
    setBurnupCache({});
    setSprintCache({});
    setCriticalCache({});
    setBurnupStatus({});
    setSprintStatus({});
    setCriticalStatus({});
    setIncludeExternalCritical({});
    setCommitDrift({});
    setCommitDriftStatus({});
    setRoadmapIntel([]);
    loadIntel();
  };

  const handleOptimizationApplied = () => {
    invalidateCaches();
    fetchData();
    loadForecast();
    loadProbabilisticForecast();
    loadOptimizationSummary();
  };

  const renderActiveView = () => {
    if (activeView === 'execution') {
      return (
        <ExecutionBoardView
          loading={loading}
          items={items}
          milestones={milestones}
          bundles={bundles}
          applications={applications}
          selBundleId={selBundleId}
          selAppId={selAppId}
          intelLoading={intelLoading}
          intelError={intelError}
          expandedMilestones={expandedMilestones}
          includeExternalCritical={includeExternalCritical}
          burnupCache={burnupCache}
          sprintCache={sprintCache}
          criticalCache={criticalCache}
          burnupStatus={burnupStatus}
          sprintStatus={sprintStatus}
          criticalStatus={criticalStatus}
          commitPolicy={commitPolicy}
          commitDrift={commitDrift}
          commitDriftStatus={commitDriftStatus}
          currentUser={currentUser}
          groupedItems={groupedItems}
          intelByMilestone={intelByMilestone}
          milestoneIntelligenceById={roadmapViewModel.intelligenceByMilestone}
          forecastByMilestone={forecastByMilestone}
          forecastStatus={forecastStatus}
          probabilisticForecastByMilestone={probForecastByMilestone}
          probabilisticForecastStatus={probForecastStatus}
          activeItem={activeItem}
          staleModal={staleModal}
          driftModal={driftModal}
          dependencyModal={dependencyModal}
          criticalModal={criticalModal}
          criticalModalMessage={criticalModalMessage}
          linkToast={linkToast}
          estimateDrafts={estimateDrafts}
          setActiveItem={setActiveItem}
          setStaleModal={setStaleModal}
          setDriftModal={setDriftModal}
          setDependencyModal={setDependencyModal}
          setCriticalModal={setCriticalModal}
          setCriticalModalMessage={setCriticalModalMessage}
          setLinkToast={setLinkToast}
          setEstimateDrafts={setEstimateDrafts}
          setIncludeExternalCritical={setIncludeExternalCritical}
          setCriticalCache={setCriticalCache}
          fetchData={fetchData}
          loadIntel={loadIntel}
          toggleMilestone={toggleMilestone}
          fetchBurnup={fetchBurnup}
          fetchSprintRollups={fetchSprintRollups}
          fetchCriticalPath={fetchCriticalPath}
          refreshCommitDrift={refreshCommitDrift}
          invalidateCaches={invalidateCaches}
          getBurnupTrend={getBurnupTrend}
          getActiveSprint={getActiveSprint}
          getGithubActivity={getGithubActivity}
        />
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm font-semibold">
          Loading roadmap…
        </div>
      );
    }

    if (activeView === 'timeline') {
      return (
        <RoadmapTimelineView
          milestones={roadmapViewModel.milestones}
          dependencies={roadmapViewModel.dependencies}
          intelligenceByMilestone={roadmapViewModel.intelligenceByMilestone}
          forecastByMilestone={forecastByMilestone}
          probabilisticForecastByMilestone={probForecastByMilestone}
          environments={planningEnvironments}
          goLiveDate={planningGoLive}
        />
      );
    }
    if (activeView === 'swimlane') {
      return (
        <RoadmapSwimlaneView
          milestones={roadmapViewModel.milestones}
          forecastByMilestone={forecastByMilestone}
          probabilisticForecastByMilestone={probForecastByMilestone}
        />
      );
    }
    return <RoadmapDependencyView milestones={roadmapViewModel.milestones} dependencies={roadmapViewModel.dependencies} />;
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 space-y-8 animate-fadeIn min-h-[800px] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 pb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Roadmap Views</div>
          <div className="text-sm text-slate-500">Switch between execution, timeline, swimlane, and dependency views.</div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Applied Optimization</div>
              {optimizationSummaryStatus.loading && <div className="text-[10px] font-semibold text-slate-400">Loading...</div>}
            </div>
            {!optimizationSummaryStatus.loading && optimizationSummaryStatus.error && (
              <div className="mt-2 text-xs text-rose-600">{optimizationSummaryStatus.error}</div>
            )}
            {!optimizationSummaryStatus.loading && !optimizationSummaryStatus.error && !optimizationSummary && (
              <div className="mt-2 text-xs text-slate-500">No optimization variant has been applied yet for this scope.</div>
            )}
            {!optimizationSummaryStatus.loading && !optimizationSummaryStatus.error && optimizationSummary && (
              <div className="mt-2 grid gap-2 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">Variant:</span>{' '}
                  {optimizationSummary.acceptedVariantName || optimizationSummary.acceptedVariantId || 'n/a'}
                  {typeof optimizationSummary.acceptedVariantScore === 'number' ? ` (score ${optimizationSummary.acceptedVariantScore.toFixed(3)})` : ''}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Applied:</span>{' '}
                  {optimizationSummary.appliedAt ? new Date(optimizationSummary.appliedAt).toLocaleString() : 'n/a'}
                  {optimizationSummary.appliedBy ? ` by ${optimizationSummary.appliedBy}` : ''}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Headline changes:</span>{' '}
                  {optimizationSummary.summary?.totalChanges || 0} total
                  {` (${optimizationSummary.summary?.scheduleChanges || 0} schedule, ${optimizationSummary.summary?.capacityChanges || 0} capacity)`}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Expected improvement:</span>{' '}
                  {typeof optimizationSummary.expectedImpact?.onTimeProbabilityDelta === 'number'
                    ? `${optimizationSummary.expectedImpact.onTimeProbabilityDelta >= 0 ? '+' : ''}${(optimizationSummary.expectedImpact.onTimeProbabilityDelta * 100).toFixed(1)}pp on-time`
                    : 'n/a'}
                  {typeof optimizationSummary.expectedImpact?.expectedSlippageDaysDelta === 'number'
                    ? `, ${optimizationSummary.expectedImpact.expectedSlippageDaysDelta >= 0 ? '+' : ''}${optimizationSummary.expectedImpact.expectedSlippageDaysDelta.toFixed(1)}d slippage`
                    : ''}
                  {typeof optimizationSummary.expectedImpact?.riskScoreDelta === 'number'
                    ? `, ${optimizationSummary.expectedImpact.riskScoreDelta >= 0 ? '+' : ''}${optimizationSummary.expectedImpact.riskScoreDelta.toFixed(2)} risk`
                    : ''}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Weights:</span>{' '}
                  OT {Math.round((optimizationSummary.objectiveWeights?.onTime || 0) * 100)}% •
                  Risk {Math.round((optimizationSummary.objectiveWeights?.riskReduction || 0) * 100)}% •
                  Capacity {Math.round((optimizationSummary.objectiveWeights?.capacityBalance || 0) * 100)}% •
                  Slip {Math.round((optimizationSummary.objectiveWeights?.slippageMinimization || 0) * 100)}%
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOptimization(true)}
            className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700"
          >
            Optimize
          </button>
          <button
            onClick={() => setShowSimulation(true)}
            className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-blue-600"
          >
            Simulate
          </button>
          <RoadmapTabs active={activeView} onChange={setActiveView} />
        </div>
      </div>
      {renderActiveView()}

      {showSimulation && (
        <SimulationEditor onClose={() => setShowSimulation(false)} />
      )}
      {showOptimization && (
        <OptimizationEditor
          onClose={() => setShowOptimization(false)}
          onApplied={handleOptimizationApplied}
        />
      )}
    </div>
  );
};

export default WorkItemsRoadmapView;
