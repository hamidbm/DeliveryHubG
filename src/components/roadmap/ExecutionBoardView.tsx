import React from 'react';
import WorkItemDetails from '../WorkItemDetails';
import WorkItemsStaleModal from '../WorkItemsStaleModal';
import OnboardingTip from '../OnboardingTip';
import { WorkItem, Application, Bundle, WorkItemStatus, MilestoneForecast } from '../../types';
import type { MilestoneIntelligence } from './roadmapViewModels';

const formatForecastDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

interface ExecutionBoardViewProps {
  loading: boolean;
  items: WorkItem[];
  milestones: any[];
  bundles: Bundle[];
  applications: Application[];
  selBundleId: string;
  selAppId: string;
  intelLoading: boolean;
  intelError: string | null;
  expandedMilestones: Record<string, boolean>;
  includeExternalCritical: Record<string, boolean>;
  burnupCache: Record<string, any>;
  sprintCache: Record<string, any[]>;
  criticalCache: Record<string, any>;
  burnupStatus: Record<string, { loading: boolean; error?: string }>;
  sprintStatus: Record<string, { loading: boolean; error?: string }>;
  criticalStatus: Record<string, { loading: boolean; error?: string }>;
  commitPolicy: any;
  commitDrift: Record<string, any>;
  commitDriftStatus: Record<string, { loading: boolean; error?: string }>;
  currentUser: any | null;
  groupedItems: Record<string, Partial<Record<WorkItemStatus, WorkItem[]>>>;
  intelByMilestone: Record<string, any>;
  milestoneIntelligenceById: Record<string, MilestoneIntelligence>;
  forecastByMilestone: Record<string, MilestoneForecast>;
  forecastStatus: { loading: boolean; error?: string };
  activeItem: WorkItem | null;
  staleModal: { milestoneId: string } | null;
  driftModal: { milestoneId: string; drift: any } | null;
  dependencyModal: { source: WorkItem; targetKey: string; target?: any; error?: string } | null;
  criticalModal: { milestoneId: string; cacheKey: string } | null;
  criticalModalMessage: string | null;
  linkToast: string | null;
  estimateDrafts: Record<string, number | ''>;
  setActiveItem: (item: WorkItem | null) => void;
  setStaleModal: (value: { milestoneId: string } | null) => void;
  setDriftModal: (value: { milestoneId: string; drift: any } | null) => void;
  setDependencyModal: (value: React.SetStateAction<{ source: WorkItem; targetKey: string; target?: any; error?: string } | null>) => void;
  setCriticalModal: (value: { milestoneId: string; cacheKey: string } | null) => void;
  setCriticalModalMessage: (value: string | null) => void;
  setLinkToast: (value: string | null) => void;
  setEstimateDrafts: (value: React.SetStateAction<Record<string, number | ''>>) => void;
  setIncludeExternalCritical: (value: React.SetStateAction<Record<string, boolean>>) => void;
  setCriticalCache: (value: React.SetStateAction<Record<string, any>>) => void;
  fetchData: () => void;
  loadIntel: () => void;
  toggleMilestone: (milestoneId: string) => void;
  fetchBurnup: (milestoneId: string) => void;
  fetchSprintRollups: (milestoneId: string) => void;
  fetchCriticalPath: (milestoneId: string, includeExternalOverride?: boolean) => void;
  refreshCommitDrift: (milestoneId: string) => void;
  invalidateCaches: () => void;
  getBurnupTrend: (milestoneId: string) => any;
  getActiveSprint: (milestoneId: string) => any;
  getGithubActivity: (item?: WorkItem) => string | null;
}

const ExecutionBoardView: React.FC<ExecutionBoardViewProps> = ({
  loading,
  items,
  milestones,
  bundles,
  applications,
  selBundleId,
  selAppId,
  intelLoading,
  intelError,
  expandedMilestones,
  includeExternalCritical,
  burnupCache,
  sprintCache,
  criticalCache,
  burnupStatus,
  sprintStatus,
  criticalStatus,
  commitPolicy,
  commitDrift,
  commitDriftStatus,
  currentUser,
  groupedItems,
  intelByMilestone,
  milestoneIntelligenceById,
  forecastByMilestone,
  forecastStatus,
  activeItem,
  staleModal,
  driftModal,
  dependencyModal,
  criticalModal,
  criticalModalMessage,
  linkToast,
  estimateDrafts,
  setActiveItem,
  setStaleModal,
  setDriftModal,
  setDependencyModal,
  setCriticalModal,
  setCriticalModalMessage,
  setLinkToast,
  setEstimateDrafts,
  setIncludeExternalCritical,
  setCriticalCache,
  fetchData,
  loadIntel,
  toggleMilestone,
  fetchBurnup,
  fetchSprintRollups,
  fetchCriticalPath,
  refreshCommitDrift,
  invalidateCaches,
  getBurnupTrend,
  getActiveSprint,
  getGithubActivity
}) => {
  const isAdminCmoRole = (role?: string) => {
    const roleName = String(role || '');
    if (!roleName) return false;
    const lower = roleName.toLowerCase();
    if (lower.includes('admin')) return true;
    if (lower.includes('cmo')) return true;
    return false;
  };
  const RoadmapItemCard: React.FC<{ item: WorkItem; isCritical?: boolean }> = ({ item, isCritical }) => {
    const isBlocked = item.status === WorkItemStatus.BLOCKED || item.isBlocked || (item.linkSummary?.openBlockersCount || 0) > 0;
    const dependencyTooltip = [
      ...(item.linkSummary?.blockedBy || []).slice(0, 2).map((b) => `Blocked by ${b.targetKey || b.targetId}`),
      ...(item.linkSummary?.blocks || []).slice(0, 2).map((b) => `Blocks ${b.targetKey || b.targetId}`)
    ].filter(Boolean).join(' • ');

    const getIcon = (type: string) => {
      switch (type) {
        case 'EPIC': return 'fa-layer-group text-purple-500';
        case 'FEATURE': return 'fa-star text-amber-500';
        case 'STORY': return 'fa-file-lines text-blue-500';
        case 'TASK': return 'fa-check text-slate-400';
        case 'BUG': return 'fa-bug text-red-500';
        case 'RISK': return 'fa-triangle-exclamation text-rose-500';
        case 'DEPENDENCY': return 'fa-link text-indigo-500';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-sm font-semibold">
        Loading roadmap…
      </div>
    );
  }

  return (
    <>
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
          const intelligence = milestoneIntelligenceById[milestoneId];
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
          const predictiveForecast = forecastByMilestone[milestoneId];
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

              {intelligence && (
                <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Utilization {intelligence.utilizationPercent != null ? `${Math.round(intelligence.utilizationPercent * 100)}%` : '—'}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${riskColor(intelligence.riskLevel)}`}>
                    Risk {intelligence.riskLevel}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Blocked {intelligence.blockedItemCount}
                  </span>
                  <span className={`px-2 py-1 rounded-full ${readinessColor(intelligence.readiness)}`}>
                    Readiness {intelligence.readiness}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Confidence {intelligence.confidence}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    Inbound {intelligence.dependencyInbound} / Outbound {intelligence.dependencyOutbound}
                  </span>
                  {predictiveForecast && (
                    <span className="px-2 py-1 rounded-full bg-slate-900 text-white">
                      Forecast {formatForecastDate(predictiveForecast.bestCaseDate)} – {formatForecastDate(predictiveForecast.worstCaseDate)}
                    </span>
                  )}
                  {predictiveForecast && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      Confidence {predictiveForecast.forecastConfidence} • Slip {predictiveForecast.slipRisk}
                    </span>
                  )}
                  {!predictiveForecast && forecastStatus.loading && (
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-400">Forecast loading…</span>
                  )}
                </div>
              )}

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
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">{col.label} ({groups[col.status]?.length || 0})</div>
                    <div className="space-y-3">
                      {groups[col.status]?.length ? (
                        groups[col.status]?.map((item) => (
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
    </>
  );
};

export default ExecutionBoardView;
  const riskColor = (risk?: string) => {
    if (risk === 'HIGH') return 'bg-rose-50 text-rose-700';
    if (risk === 'MEDIUM') return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  };

  const readinessColor = (readiness?: string) => {
    if (readiness === 'NOT_READY') return 'bg-slate-200 text-slate-600';
    if (readiness === 'PARTIAL') return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  };
