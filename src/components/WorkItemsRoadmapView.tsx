import React, { useEffect, useMemo, useState, useRef } from 'react';
import { WorkItem, Application, Bundle, Milestone, WorkItemStatus } from '../types';
import WorkItemDetails from './WorkItemDetails';
import WorkItemsStaleModal from './WorkItemsStaleModal';
import { WorkItemType } from '../types';
import OnboardingTip from './OnboardingTip';

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

const WorkItemsRoadmapView: React.FC<WorkItemsRoadmapViewProps> = ({
  applications, bundles, selBundleId, selAppId, selEpicId, searchQuery, quickFilter, activeFilters, includeArchived
}) => {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<WorkItem | null>(null);
  const [roadmapIntel, setRoadmapIntel] = useState<any[]>([]);
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

  const RoadmapItemCard: React.FC<{ item: WorkItem; isCritical?: boolean }> = ({ item, isCritical }) => {
    const isBlocked = item.status === WorkItemStatus.BLOCKED || item.isBlocked || (item.linkSummary?.openBlockersCount || 0) > 0;
    const dependencyTooltip = [
      ...(item.linkSummary?.blockedBy || []).slice(0, 2).map((b) => `Blocked by ${b.targetKey || b.targetId}`),
      ...(item.linkSummary?.blocks || []).slice(0, 2).map((b) => `Blocks ${b.targetKey || b.targetId}`)
    ].filter(Boolean).join(' • ');

    const getIcon = (type: WorkItemType) => {
      switch (type) {
        case WorkItemType.EPIC: return 'fa-layer-group text-purple-500';
        case WorkItemType.FEATURE: return 'fa-star text-amber-500';
        case WorkItemType.STORY: return 'fa-file-lines text-blue-500';
        case WorkItemType.TASK: return 'fa-check text-slate-400';
        case WorkItemType.BUG: return 'fa-bug text-red-500';
        case WorkItemType.RISK: return 'fa-triangle-exclamation text-rose-500';
        case WorkItemType.DEPENDENCY: return 'fa-link text-indigo-500';
        default: return 'fa-circle text-slate-300';
      }
    };

    return (
      <div
        onClick={() => setActiveItem(item)}
        className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer ${isBlocked ? 'border-l-4 border-l-amber-500' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <i className={`fas ${getIcon(item.type)} text-[10px]`}></i>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.key}</span>
          </div>
          <div className="flex items-center gap-2">
            {isCritical && (
              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">Critical</span>
            )}
            {item.storyPoints !== undefined && (
              <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.storyPoints}</span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-700 leading-snug mb-2">{item.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-[8px] font-black uppercase tracking-widest">
          {item.jira?.key && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{item.jira.key}</span>}
          {(item.linkSummary?.blocks?.length || item.linkSummary?.blockedBy?.length) ? (
            <div className="relative group">
              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 inline-flex items-center gap-1">
                <i className="fas fa-link text-[7px]"></i> {item.linkSummary?.blocks?.length || 0}/{item.linkSummary?.blockedBy?.length || 0}
              </span>
              {dependencyTooltip && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-slate-900 text-white text-[9px] rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  {(item.linkSummary?.blockedBy || []).slice(0, 2).map((b) => (
                    <button
                      key={`bb-${b.targetId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const found = items.find((i) => String(i._id || i.id) === String(b.targetId));
                        if (found) setActiveItem(found);
                      }}
                      className="block text-left w-full hover:text-blue-200"
                    >
                      Blocked by {b.targetKey || b.targetId}
                    </button>
                  ))}
                  {(item.linkSummary?.blocks || []).slice(0, 2).map((b) => (
                    <button
                      key={`b-${b.targetId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const found = items.find((i) => String(i._id || i.id) === String(b.targetId));
                        if (found) setActiveItem(found);
                      }}
                      className="block text-left w-full hover:text-blue-200"
                    >
                      Blocks {b.targetKey || b.targetId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {item.sprintId && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Sprint</span>}
          {item.risk?.severity && ['high', 'critical'].includes(String(item.risk.severity).toLowerCase()) && (
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">Risk</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDependencyModal({ source: item, targetKey: '', target: undefined, error: undefined });
            }}
            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
            title="Add blocker"
          >
            + Blocker
          </button>
        </div>
      </div>
    );
  };

  const isAdminCmoRole = (role?: string) => {
    const roleName = String(role || '');
    if (!roleName) return false;
    const lower = roleName.toLowerCase();
    if (lower.includes('admin')) return true;
    if (lower.includes('cmo')) return true;
    return false;
  };

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

  useEffect(() => {
    loadIntel();
  }, [milestones]);

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

  const getBurnupTrend = (milestoneId: string) => {
    const burn = burnupCache[milestoneId];
    if (!burn?.trend) return null;
    return burn.trend;
  };

  const getActiveSprint = (milestoneId: string) => {
    const rollups = sprintCache[milestoneId] || [];
    return rollups.find((r: any) => String(r.status || '').toUpperCase() === 'ACTIVE') || rollups[0];
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 animate-fadeIn min-h-[600px] flex items-center justify-center">
        <div className="text-slate-400 text-sm font-semibold">Loading roadmap…</div>
      </div>
    );
  }

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

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl p-10 space-y-8 animate-fadeIn min-h-[800px] overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-100 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl">
            <i className="fas fa-route"></i>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Milestone Execution Board</h3>
            <p className="text-sm text-slate-500">Delivery control center with readiness, forecast, and sprint intelligence.</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </header>

      <div className="space-y-6">
        {intelLoading && (
          <div className="border border-slate-100 rounded-3xl p-6 bg-slate-50/30 animate-pulse">
            <div className="h-4 w-40 bg-slate-200 rounded mb-3"></div>
            <div className="h-3 w-full bg-slate-100 rounded"></div>
          </div>
        )}
        {intelError && (
          <div className="border border-rose-100 rounded-2xl p-4 bg-rose-50 text-rose-600 text-[11px] font-semibold">
            {intelError}
            <button onClick={loadIntel} className="ml-3 underline">Retry</button>
          </div>
        )}
        {milestones.map((milestone) => {
          const milestoneId = String(milestone._id || milestone.id || milestone.name);
          const intel = intelByMilestone[milestoneId] || {};
          const rollup = intel.rollup || {};
          const readiness = intel.readiness || {};
          const listCounts = intel.listCounts || {};
          const highRisks = (rollup?.risks?.openBySeverity?.high || 0) + (rollup?.risks?.openBySeverity?.critical || 0);
          const burnupTrend = getBurnupTrend(milestoneId);
          const sprint = getActiveSprint(milestoneId);
          const includeExternal = !!includeExternalCritical[milestoneId];
          const criticalKey = `${milestoneId}:${includeExternal ? '1' : '0'}`;
          const critical = criticalCache[criticalKey];
          const criticalIds = new Set((critical?.criticalPath?.nodes || []).map((n: any) => String(n.id)));
          const capacity = rollup?.capacity || {};
          const forecast = rollup?.forecast;
          const confidence = rollup?.confidence;
          const staleness = rollup?.staleness || {};
          const staleTotal = staleness.staleCount || 0;
          const criticalStale = staleness.criticalStaleCount || 0;
          const commitReviewEnabled = commitPolicy?.commitReview?.enabled;
          const mc = forecast?.monteCarlo;
          const endDate = milestone.endDate ? new Date(milestone.endDate) : null;
          const p80 = mc?.p80 ? new Date(mc.p80) : null;
          const isCommitted = String(milestone.status || '').toUpperCase() === 'COMMITTED';
          const driftEligible = ['COMMITTED', 'IN_PROGRESS'].includes(String(milestone.status || '').toUpperCase());
          const commitReviewFail = commitReviewEnabled && !isCommitted && (
            (mc?.hitProbability !== undefined && mc.hitProbability < (commitPolicy?.commitReview?.minHitProbability ?? 0)) ||
            (commitPolicy?.commitReview?.blockIfP80AfterEndDate && p80 && endDate && p80.getTime() > endDate.getTime())
          );
          const drift = commitDrift[milestoneId];
          const driftBand = drift?.driftBand;
          const driftEvaluatedAt = drift?.evaluatedAt ? new Date(drift.evaluatedAt).getTime() : null;
          const driftStale = !driftEvaluatedAt || Number.isNaN(driftEvaluatedAt) || (Date.now() - driftEvaluatedAt) > 24 * 60 * 60 * 1000;
          const driftUnknown = driftEligible && (!drift || drift?.hasBaseline === false || driftStale);
          const groups = groupedItems[milestoneId] || {
            TODO: [],
            IN_PROGRESS: [],
            BLOCKED: [],
            DONE: []
          };

          return (
            <section key={milestoneId} className="border border-slate-100 rounded-3xl p-6 bg-slate-50/30">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{milestone.name}</div>
                  <div className="text-sm text-slate-600">Status {milestone.status} • {new Date(milestone.startDate).toLocaleDateString()} → {new Date(milestone.endDate).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      params.set('milestones', milestoneId);
                      params.set('focusMilestone', milestoneId);
                      if (selBundleId && selBundleId !== 'all') params.set('bundleId', selBundleId);
                      if (selAppId && selAppId !== 'all') params.set('applicationId', selAppId);
                      const url = `${window.location.origin}${window.location.pathname}?${params.toString()}#milestone=${milestoneId}`;
                      navigator.clipboard.writeText(url).then(() => setLinkToast('Link copied'));
                      setTimeout(() => setLinkToast(null), 2000);
                    }}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
                  >
                    Copy link
                  </button>
                  <button
                    onClick={() => toggleMilestone(milestoneId)}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
                  >
                    {expandedMilestones[milestoneId] ? 'Hide Details' : 'Expand'}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className={`px-2 py-1 rounded-full ${
                  readiness.band === 'high' ? 'bg-emerald-50 text-emerald-700' :
                  readiness.band === 'medium' ? 'bg-amber-50 text-amber-700' :
                  readiness.band === 'low' ? 'bg-rose-50 text-rose-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  Readiness {readiness.band || '—'}
                </span>
                {rollup?.dataQuality && (
                  <div className="inline-flex items-center gap-1">
                    <span className={`px-2 py-1 rounded-full ${
                      rollup.dataQuality.score < 50 ? 'bg-rose-50 text-rose-700' :
                      rollup.dataQuality.score < 70 ? 'bg-amber-50 text-amber-700' :
                      'bg-emerald-50 text-emerald-700'
                    }`}>
                      Quality {rollup.dataQuality.score}
                    </span>
                    <OnboardingTip tipId="data_quality" />
                  </div>
                )}
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Confidence {confidence?.score ?? '—'} {confidence?.band ? `(${confidence.band})` : ''}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Capacity {capacity.committedPoints ?? 0}/{capacity.targetCapacity ?? '∞'}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Blocked {rollup?.totals?.blockedDerived ?? 0}
                </span>
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={() => setStaleModal({ milestoneId })}
                    className={`px-2 py-1 rounded-full ${
                      criticalStale > 0 ? 'bg-rose-50 text-rose-700' :
                      staleTotal > 0 ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-400'
                    }`}
                  >
                    Stale {staleTotal}
                    {criticalStale > 0 ? ` • Critical ${criticalStale}` : ''}
                  </button>
                  <OnboardingTip tipId="staleness" />
                </div>
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  Risks {highRisks}
                </span>
                {listCounts.crossMilestoneBlocksCount ? (
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                    Cross blocks {listCounts.crossMilestoneBlocksCount}
                  </span>
                ) : null}
                {forecast?.estimatedCompletionDate && (
                  <span className={`px-2 py-1 rounded-full ${
                    forecast.band === 'on-track' ? 'bg-emerald-50 text-emerald-700' :
                    forecast.band === 'at-risk' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>
                    ETA {new Date(forecast.estimatedCompletionDate).toLocaleDateString()} {forecast.varianceDays ? `${forecast.varianceDays > 0 ? '+' : ''}${forecast.varianceDays}d` : ''}
                  </span>
                )}
                {forecast?.monteCarlo?.p80 && (
                  <div className="inline-flex items-center gap-1">
                    <span
                      className="px-2 py-1 rounded-full bg-slate-900 text-white"
                      title={`P50 ${new Date(forecast.monteCarlo.p50).toLocaleDateString()} • P80 ${new Date(forecast.monteCarlo.p80).toLocaleDateString()} • P90 ${new Date(forecast.monteCarlo.p90).toLocaleDateString()} • Hit ${Math.round((forecast.monteCarlo.hitProbability || 0) * 100)}%`}
                    >
                      P80 {new Date(forecast.monteCarlo.p80).toLocaleDateString()} ({Math.round((forecast.monteCarlo.hitProbability || 0) * 100)}%)
                    </span>
                    <OnboardingTip tipId="p80_hit" />
                  </div>
                )}
                {commitReviewFail && (
                  <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">
                    Commit review
                  </span>
                )}
                {driftEligible && commitDriftStatus[milestoneId]?.loading && (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">
                    Drift…
                  </span>
                )}
                {driftEligible && driftUnknown && !commitDriftStatus[milestoneId]?.loading && (
                  <button
                    onClick={() => refreshCommitDrift(milestoneId)}
                    className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500"
                    title="Snapshot missing or stale. Click to refresh."
                  >
                    Drift unknown
                  </button>
                )}
                {driftEligible && !driftUnknown && driftBand && driftBand !== 'NONE' && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => setDriftModal({ milestoneId, drift })}
                      className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        driftBand === 'MAJOR' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      Drift {driftBand.toLowerCase()}
                    </button>
                    <OnboardingTip tipId="drift" />
                  </div>
                )}
                {expandedMilestones[milestoneId] ? (
                  burnupStatus[milestoneId]?.loading ? (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Burn-up loading…</span>
                  ) : burnupStatus[milestoneId]?.error ? (
                    <button onClick={() => fetchBurnup(milestoneId)} className="px-2 py-1 rounded-full bg-rose-50 text-rose-600">Retry burn-up</button>
                  ) : burnupTrend ? (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Burn-up {burnupTrend.acceleration} • {burnupTrend.last3Avg ?? '—'} pts
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Burn-up —</span>
                  )
                ) : (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Burn-up —</span>
                )}
                {expandedMilestones[milestoneId] ? (
                  sprintStatus[milestoneId]?.loading ? (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Sprint loading…</span>
                  ) : sprintStatus[milestoneId]?.error ? (
                    <button onClick={() => fetchSprintRollups(milestoneId)} className="px-2 py-1 rounded-full bg-rose-50 text-rose-600">Retry sprint</button>
                  ) : sprint ? (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Sprint {sprint.name} • {sprint.scope?.done ?? 0}/{sprint.scope?.items ?? 0}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Sprint —</span>
                  )
                ) : (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Sprint —</span>
                )}
                {expandedMilestones[milestoneId] ? (
                  criticalStatus[criticalKey]?.loading ? (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Critical path…</span>
                  ) : criticalStatus[criticalKey]?.error ? (
                    <button onClick={() => fetchCriticalPath(milestoneId)} className="px-2 py-1 rounded-full bg-rose-50 text-rose-600">Retry critical path</button>
                  ) : critical?.criticalPath?.nodes?.length ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setCriticalModal({ milestoneId, cacheKey: criticalKey })}
                        className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        Critical {critical.criticalPath.remainingPoints} pts • {critical.criticalPath.nodes.length} items
                        {includeExternal && critical?.external?.includedNodes ? ` • ext ${critical.external.includedNodes}` : ''}
                      </button>
                      <OnboardingTip tipId="critical_path" />
                    </div>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Critical —</span>
                  )
                ) : (
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Critical —</span>
                )}
                {expandedMilestones[milestoneId] ? (
                  <button
                    onClick={() => {
                      const nextInclude = !includeExternal;
                      setIncludeExternalCritical((prev) => ({ ...prev, [milestoneId]: !includeExternal }));
                      setCriticalCache((prev) => {
                        const next = { ...prev };
                        delete next[criticalKey];
                        return next;
                      });
                      fetchCriticalPath(milestoneId, nextInclude);
                    }}
                    className="px-2 py-1 rounded-full border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest"
                  >
                    {includeExternal ? 'External on' : 'External off'}
                  </button>
                ) : null}
                {critical?.cycleDetected ? (
                  <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-600">
                    Dependency cycle
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { status: WorkItemStatus.TODO, label: 'To Do' },
                  { status: WorkItemStatus.IN_PROGRESS, label: 'In Progress' },
                  { status: WorkItemStatus.BLOCKED, label: 'Blocked' },
                  { status: WorkItemStatus.DONE, label: 'Done' }
                ].map((col) => (
                  <div key={col.status} className="bg-white border border-slate-100 rounded-2xl p-4 min-h-[200px]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{col.label} ({groups[col.status].length})</div>
                    <div className="space-y-3">
                      {groups[col.status].length ? (
                        groups[col.status].map((item) => (
                          <RoadmapItemCard key={String(item._id || item.id)} item={item} isCritical={criticalIds.has(String(item._id || item.id))} />
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-300">
                          No scoped work items.
                          <button
                            onClick={() => window.location.assign('/work-items?view=milestone-plan')}
                            className="ml-2 underline text-blue-600"
                          >
                            Open planning
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {activeItem && (
        <div className="absolute inset-y-0 right-0 w-[650px] bg-white shadow-2xl border-l border-slate-200 z-50 animate-slideIn">
          <WorkItemDetails
            item={activeItem}
            bundles={bundles}
            applications={applications}
            onUpdate={() => {
              fetchData();
              invalidateCaches();
            }}
            onClose={() => setActiveItem(null)}
          />
        </div>
      )}

      {staleModal && (
        <WorkItemsStaleModal
          milestoneId={staleModal.milestoneId}
          kind="all"
          title="Stale Work Items"
          onClose={() => setStaleModal(null)}
        />
      )}

      {driftModal && (
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Commitment Drift</div>
                <div className="text-xs text-slate-500">Milestone {driftModal.milestoneId}</div>
              </div>
              <button onClick={() => setDriftModal(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className={`px-2 py-1 rounded-full ${
                driftModal.drift?.driftBand === 'MAJOR' ? 'bg-rose-50 text-rose-700' :
                driftModal.drift?.driftBand === 'MINOR' ? 'bg-amber-50 text-amber-700' :
                'bg-emerald-50 text-emerald-700'
              }`}>
                {driftModal.drift?.driftBand || 'NONE'}
              </span>
              <span className="text-slate-400">
                Baseline {driftModal.drift?.baselineAt ? new Date(driftModal.drift.baselineAt).toLocaleDateString() : '—'}
              </span>
            </div>
            {(() => {
              const scopeDelta = driftModal.drift?.deltas?.find((d: any) => d.key === 'scopeDelta');
              const estimateDelta = driftModal.drift?.deltas?.find((d: any) => d.key === 'estimateDelta');
              if (!scopeDelta && !estimateDelta) return null;
              return (
                <div className="text-[11px] text-slate-500">
                  {scopeDelta ? scopeDelta.detail : ''}
                  {scopeDelta && estimateDelta ? ' • ' : ''}
                  {estimateDelta ? estimateDelta.detail : ''}
                </div>
              );
            })()}
            <div className="space-y-2">
              {driftModal.drift?.deltas?.length ? (
                driftModal.drift.deltas.map((delta: any) => (
                  <div key={delta.key} className="flex items-start justify-between gap-3 text-[11px]">
                    <div>
                      <div className="font-semibold text-slate-600">{delta.detail}</div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400">{delta.key}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      delta.severity === 'critical' ? 'bg-rose-50 text-rose-700' :
                      delta.severity === 'warn' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {delta.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">No material drift detected.</div>
              )}
            </div>
            {driftModal.drift?.recommendedActions?.length ? (
              <div className="flex flex-wrap gap-2">
                {driftModal.drift.recommendedActions.map((action: any, idx: number) => (
                  <span
                    key={`${action.type}-${idx}`}
                    className="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500"
                    title={action.reason}
                  >
                    {action.type}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  window.location.assign(`/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(driftModal.milestoneId)}`);
                }}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
              >
                Open planning
              </button>
            </div>
          </div>
        </div>
      )}

      {dependencyModal && (
        <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Add Blocker</h4>
            <div className="text-xs text-slate-500">Create a BLOCKS link from {dependencyModal.source.key}.</div>
            <input
              value={dependencyModal.targetKey}
              onChange={(e) => setDependencyModal(prev => prev ? { ...prev, targetKey: e.target.value, error: undefined } : prev)}
              placeholder="Enter work item key (e.g. GPS-12)"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
            {dependencyModal.target && (
              <div className="text-[11px] text-slate-600">
                Found: {dependencyModal.target.key} • {dependencyModal.target.title}
              </div>
            )}
            {dependencyModal.error && (
              <div className="text-[11px] text-rose-600">{dependencyModal.error}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setDependencyModal(null)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-slate-200 text-slate-500">Cancel</button>
              <button
                onClick={async () => {
                  if (!dependencyModal) return;
                  const key = dependencyModal.targetKey.trim();
                  if (!key) {
                    setDependencyModal({ ...dependencyModal, error: 'Enter a key.' });
                    return;
                  }
                  try {
                    const lookup = await fetch(`/api/work-items/lookup?key=${encodeURIComponent(key)}`);
                    if (lookup.ok) {
                      const found = await lookup.json();
                      setDependencyModal({ ...dependencyModal, target: found });
                    }
                    const res = await fetch(`/api/work-items/${dependencyModal.source._id || dependencyModal.source.id}/links`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'BLOCKS', targetKey: key })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      setDependencyModal({ ...dependencyModal, error: err.error || 'Failed to add blocker.' });
                      return;
                    }
                    setDependencyModal(null);
                    fetchData();
                    invalidateCaches();
                  } catch (err: any) {
                    setDependencyModal({ ...dependencyModal, error: err?.message || 'Failed to add blocker.' });
                  }
                }}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {linkToast && (
        <div className="absolute bottom-6 right-6 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-xl">
          {linkToast}
        </div>
      )}

      {criticalModal && (
        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Path</div>
                <div className="text-xs text-slate-500">Milestone {criticalModal.milestoneId}</div>
              </div>
              <button onClick={() => setCriticalModal(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            {criticalModalMessage && (
              <div className="text-[10px] font-semibold text-emerald-600">{criticalModalMessage}</div>
            )}
            {(() => {
              const data = criticalCache[criticalModal.cacheKey];
              if (!data?.criticalPath?.nodes?.length) {
                return <div className="text-sm text-slate-400">No critical path data.</div>;
              }
              return (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      window.location.assign(`/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(criticalModal.milestoneId)}&showGraph=1`);
                    }}
                    className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600"
                  >
                    View graph
                  </button>
                  {data.criticalPath.nodes.map((node: any) => (
                    <div key={node.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{node.key || node.id}</div>
                        <div className="text-[9px] font-black text-slate-500">{node.remainingPoints} pts</div>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-2">
                        <span className="truncate">{node.title}</span>
                        {node.scope === 'EXTERNAL' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest">External</span>
                        )}
                        {(() => {
                          const found = items.find((i) => String(i._id || i.id) === String(node.id));
                          const activity = getGithubActivity(found);
                          if (!activity) return null;
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                              activity === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {activity === 'active' ? 'Active' : 'Stale'}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 items-center">
                        <button
                          onClick={() => {
                            const found = items.find((i) => String(i._id || i.id) === String(node.id));
                            if (found) setActiveItem(found);
                          }}
                          className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600"
                        >
                          Open item
                        </button>
                        <input
                          type="number"
                          value={estimateDrafts[node.id] ?? ''}
                          onChange={(e) => {
                            const value = e.target.value === '' ? '' : Number(e.target.value);
                            setEstimateDrafts((prev) => ({ ...prev, [node.id]: Number.isNaN(value) ? '' : value }));
                          }}
                          className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-xs"
                          min={0}
                        />
                        <button
                          onClick={async () => {
                            const numeric = typeof estimateDrafts[node.id] === 'number' ? estimateDrafts[node.id] as number : 0;
                            const res = await fetch(`/api/work-items/${node.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                storyPoints: numeric,
                                criticalPathAction: { type: 'SET_ESTIMATE', milestoneId: criticalModal.milestoneId }
                              })
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              setCriticalModalMessage(err.error || 'Failed to set estimate.');
                              return;
                            }
                            setCriticalModalMessage('Estimate updated.');
                            fetchCriticalPath(criticalModal.milestoneId);
                          }}
                          className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700"
                        >
                          Set estimate
                        </button>
                        {node.scope === 'EXTERNAL' && (
                          <button
                            onClick={async () => {
                              const canNotify = isAdminCmoRole(currentUser?.role);
                              if (!canNotify) {
                                setCriticalModalMessage('Admin/CMO only.');
                                return;
                              }
                              const res = await fetch(`/api/work-items/${node.id}/actions/notify-owner`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ milestoneId: criticalModal.milestoneId, reason: 'External blocker on critical path.' })
                              });
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                setCriticalModalMessage(err.error || 'Failed to notify owners.');
                                return;
                              }
                              setCriticalModalMessage('Escalation sent.');
                            }}
                            className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              isAdminCmoRole(currentUser?.role) ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            Notify owners
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkItemsRoadmapView;
