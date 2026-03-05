import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from '../App';
import ChangeFeed from './ChangeFeed';

type ProgramIntel = {
  summary: {
    bundles: number;
    milestones: number;
    workItems: number;
    blockedDerived: number;
    highCriticalRisks: number;
    overdueOpen: number;
  };
  bundleRollups: Array<{
    bundleId: string;
    bundleName?: string;
    milestones: Array<{
      milestoneId: string;
      rollup: any;
      readiness: any;
      milestone?: any;
    }>;
    aggregated: {
      confidenceAvg: number;
      readinessAvg: number;
      blockedDerived: number;
      highCriticalRisks: number;
      overdueOpen: number;
      isLateCount: number;
    };
    band: 'high' | 'medium' | 'low';
  }>;
  listCounts: {
    topCrossBundleBlockers: number;
    topAtRiskBundles: number;
    topAtRiskMilestones: number;
  };
  lists?: {
    topCrossBundleBlockers: Array<any>;
    topAtRiskBundles: Array<any>;
    topAtRiskMilestones: Array<any>;
  };
};

type CapacityPlan = {
  bundleId: string;
  bundleName?: string;
  capacity: { unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK'; value: number };
  horizon: { startDate: string; endDate: string; buckets: 'SPRINT' | 'WEEK'; count: number };
  buckets: Array<{
    key: string;
    startDate: string;
    endDate: string;
    capacityPoints: number;
    demandPoints: number;
    overBy: number;
    drivers: Array<{ milestoneId: string; name: string; demandPoints: number; endDate?: string; p50?: string; p80?: string; p90?: string; hitProbability?: number }>;
  }>;
  summary: { totalCapacity: number; totalDemand: number; isOvercommitted: boolean; maxOverBy: number };
};

type CapacityResponse = {
  bundlePlans: CapacityPlan[];
  atRiskBundles: Array<{
    bundleId: string;
    bundleName?: string;
    totalCapacity: number;
    totalDemand: number;
    maxOverBy: number;
    topDrivers: Array<{ milestoneId: string; name: string; demandPoints: number }>;
  }>;
  recommendedActions: Array<{
    type: 'SCOPE_REDUCE' | 'SLIP_MILESTONE' | 'ADD_CAPACITY';
    bundleId: string;
    milestoneId?: string;
    milestoneName?: string;
    reason: string;
    overBy?: number;
  }>;
};

const ProgramCoordination: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bundleIdsParam = searchParams.get('bundleIds') || '';
  const milestoneIdsParam = searchParams.get('milestoneIds') || '';
  const panel = searchParams.get('panel') || 'overview';
  const [loading, setLoading] = useState(true);
  const [intel, setIntel] = useState<ProgramIntel | null>(null);
  const [listsCache, setListsCache] = useState<ProgramIntel['lists'] | null>(null);
  const [modal, setModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [capacityData, setCapacityData] = useState<CapacityResponse | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [horizonWeeks, setHorizonWeeks] = useState(8);
  const [driftList, setDriftList] = useState<any[]>([]);
  const [driftLoading, setDriftLoading] = useState(false);

  const fetchIntel = async (includeLists = false) => {
    const params = new URLSearchParams();
    params.set('includeLists', includeLists ? 'true' : 'false');
    params.set('limit', '10');
    if (bundleIdsParam) params.set('bundleIds', bundleIdsParam);
    if (milestoneIdsParam) params.set('milestoneIds', milestoneIdsParam);
    const res = await fetch(`/api/program/intel?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data as ProgramIntel;
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const data = await fetchIntel(false);
      if (isMounted) {
        setIntel(data);
        setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [bundleIdsParam, milestoneIdsParam]);

  useEffect(() => {
    setListsCache(null);
  }, [bundleIdsParam, milestoneIdsParam]);

  useEffect(() => {
    let isMounted = true;
    const loadDrift = async () => {
      if (!intel?.bundleRollups?.length) {
        if (isMounted) setDriftList([]);
        return;
      }
      setDriftLoading(true);
      const candidates: Array<{ milestoneId: string; name: string; bundleName?: string; status?: string }> = [];
      intel.bundleRollups.forEach((bundle) => {
        (bundle.milestones || []).forEach((entry) => {
          const milestone = entry.milestone || {};
          const milestoneId = String(entry.milestoneId || milestone._id || milestone.id || milestone.name || '');
          if (!milestoneId) return;
          const status = String(milestone.status || '');
          if (!['COMMITTED', 'IN_PROGRESS'].includes(status.toUpperCase())) return;
          candidates.push({
            milestoneId,
            name: milestone.name || milestone.title || entry.milestoneId,
            bundleName: bundle.bundleName,
            status
          });
        });
      });
      const unique = Array.from(new Map(candidates.map((c) => [c.milestoneId, c])).values()).slice(0, 50);
      const ids = unique.map((c) => c.milestoneId);
      if (!ids.length) {
        if (isMounted) setDriftList([]);
        setDriftLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/milestones/commit-drift/snapshots?milestoneIds=${encodeURIComponent(ids.join(','))}`);
        if (!res.ok) {
          if (isMounted) setDriftList([]);
          return;
        }
        const data = await res.json();
        const snapshotMap = new Map<string, any>();
        (data?.items || []).forEach((item: any) => snapshotMap.set(String(item.milestoneId), item));
        const results = unique
          .map((c) => {
            const snap = snapshotMap.get(String(c.milestoneId));
            if (!snap || snap.driftBand !== 'MAJOR') return null;
            return { ...c, drift: snap };
          })
          .filter(Boolean);
        if (isMounted) {
          setDriftList(results);
        }
      } catch {
        if (isMounted) setDriftList([]);
      } finally {
        if (isMounted) setDriftLoading(false);
      }
    };
    loadDrift();
    return () => { isMounted = false; };
  }, [intel]);

  const setPanel = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'overview') {
      params.delete('panel');
    } else {
      params.set('panel', next);
    }
    router.push(`/program?${params.toString()}`);
  };

  const fetchCapacity = async () => {
    const params = new URLSearchParams();
    if (bundleIdsParam) params.set('bundleIds', bundleIdsParam);
    params.set('horizonWeeks', String(horizonWeeks));
    const res = await fetch(`/api/capacity/plan?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load capacity');
    return (await res.json()) as CapacityResponse;
  };

  useEffect(() => {
    if (panel !== 'capacity') return;
    let isMounted = true;
    const load = async () => {
      setCapacityLoading(true);
      setCapacityError(null);
      try {
        const data = await fetchCapacity();
        if (isMounted) setCapacityData(data);
      } catch {
        if (isMounted) setCapacityError('Unable to load capacity plan.');
      } finally {
        if (isMounted) setCapacityLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [panel, bundleIdsParam, horizonWeeks]);

  const ensureLists = async () => {
    if (listsCache) return listsCache;
    const data = await fetchIntel(true);
    if (data?.lists) {
      setListsCache(data.lists);
      return data.lists;
    }
    return null;
  };

  const bandBadge = (band: string) => {
    if (band === 'high') return 'bg-emerald-50 text-emerald-700';
    if (band === 'medium') return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const summary = intel?.summary;
  const bundleRollups = intel?.bundleRollups || [];
  const capacityPlans = capacityData?.bundlePlans || [];
  const atRiskCapacityBundles = capacityData?.atRiskBundles || [];
  const capacityActions = capacityData?.recommendedActions || [];

  const openBundleModal = (bundle: ProgramIntel['bundleRollups'][number]) => {
    setModal({
      title: `${bundle.bundleName || bundle.bundleId} Milestones`,
      content: (
        <div className="space-y-3">
          {(bundle.milestones || []).map((m: any) => (
            <div key={m.milestoneId} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{m.rollup?.schedule?.startDate ? new Date(m.rollup.schedule.startDate).toLocaleDateString() : 'Milestone'} • {m.milestoneId}</div>
                <div className="text-[11px] text-slate-400">Confidence {m.rollup?.confidence?.score ?? '—'} • Readiness {m.readiness?.score ?? '—'}</div>
                {m.rollup?.forecast?.estimatedCompletionDate && (
                  <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    m.rollup.forecast.band === 'on-track' ? 'bg-emerald-50 text-emerald-700' :
                    m.rollup.forecast.band === 'at-risk' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>
                    ETA {new Date(m.rollup.forecast.estimatedCompletionDate).toLocaleDateString()} {m.rollup.forecast.varianceDays ? `${m.rollup.forecast.varianceDays > 0 ? '+' : ''}${m.rollup.forecast.varianceDays}d` : ''}
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push('/?tab=work-items&view=roadmap')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
              >
                Open Roadmap
              </button>
            </div>
          ))}
        </div>
      )
    });
  };

  const openTopBlockers = async () => {
    const lists = await ensureLists();
    const blockers = lists?.topCrossBundleBlockers || [];
    setModal({
      title: 'Top Cross-Bundle Blockers',
      content: (
        <div className="space-y-3">
          {blockers.map((b: any) => (
            <div key={b.blockerId} className="border border-slate-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{b.blockerKey || b.blockerTitle || b.blockerId}</div>
                  <div className="text-[11px] text-slate-400">Status {b.blockerStatus || '—'} • Blocked: {b.blockedCount}</div>
                </div>
                <button
                  onClick={() => router.push('/?tab=work-items&view=roadmap')}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                >
                  Open Work Items
                </button>
              </div>
              {(b.sampleBlocked || []).length > 0 && (
                <div className="mt-3 grid gap-2">
                  {(b.sampleBlocked || []).map((s: any) => (
                    <div key={s.id} className="text-[11px] text-slate-500 border border-slate-100 rounded-lg px-3 py-2">
                      {s.key || s.title || s.id}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )
    });
  };

  const openAtRiskBundles = async () => {
    const lists = await ensureLists();
    const bundles = lists?.topAtRiskBundles || [];
    setModal({
      title: 'Top At-Risk Bundles',
      content: (
        <div className="space-y-3">
          {bundles.map((b: any) => (
            <div key={b.bundleId} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{b.bundleName || b.bundleId}</div>
                <div className="text-[11px] text-slate-400">Blocked {b.blockedDerived} • Risks {b.highCriticalRisks} • Overdue {b.overdueOpen}</div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${bandBadge(b.band)}`}>{b.band}</span>
            </div>
          ))}
        </div>
      )
    });
  };

  const openAtRiskMilestones = async () => {
    const lists = await ensureLists();
    const milestones = lists?.topAtRiskMilestones || [];
    setModal({
      title: 'Top At-Risk Milestones',
      content: (
        <div className="space-y-3">
          {milestones.map((m: any) => (
            <div key={m.milestoneId} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{m.milestoneName || m.milestoneId}</div>
                <div className="text-[11px] text-slate-400">Blocked {m.blockedDerived} • Risks {m.highCriticalRisks} • Overdue {m.overdueOpen}</div>
              </div>
              <button
                onClick={() => router.push('/?tab=work-items&view=roadmap')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
              >
                Open Roadmap
              </button>
            </div>
          ))}
        </div>
      )
    });
  };

  const openCapacityCell = (bundleName: string, bucket: CapacityPlan['buckets'][number]) => {
    setModal({
      title: `${bundleName} • ${bucket.key}`,
      content: (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            Demand {bucket.demandPoints} / Capacity {bucket.capacityPoints} • Over by {bucket.overBy}
          </div>
          {(bucket.drivers || []).map((driver) => (
            <div key={driver.milestoneId} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{driver.name}</div>
                <div className="text-[11px] text-slate-400">{driver.demandPoints} pts in this bucket</div>
                <div
                  className={`mt-1 text-[10px] font-semibold ${driver.p80 && driver.endDate && new Date(driver.p80) > new Date(driver.endDate) ? 'text-red-600' : 'text-slate-500'}`}
                  title={`P50 ${formatDate(driver.p50)} • P80 ${formatDate(driver.p80)} • P90 ${formatDate(driver.p90)}`}
                >
                  P80 {formatDate(driver.p80)} • Target {formatDate(driver.endDate)} • Hit {(driver.hitProbability ?? 0) ? `${Math.round((driver.hitProbability || 0) * 100)}%` : '—'}
                </div>
              </div>
              <button
                onClick={() => router.push('/?tab=work-items&view=milestone-plan')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
              >
                Open Planning
              </button>
            </div>
          ))}
          {(bucket.drivers || []).length === 0 && (
            <div className="text-sm text-slate-400">No drivers for this bucket.</div>
          )}
        </div>
      )
    });
  };

  const summaryCards = useMemo(() => ([
    { label: 'Bundles', value: summary?.bundles ?? 0 },
    { label: 'Milestones', value: summary?.milestones ?? 0 },
    { label: 'Work Items', value: summary?.workItems ?? 0 },
    { label: 'Blocked', value: summary?.blockedDerived ?? 0 },
    { label: 'High/Critical Risks', value: summary?.highCriticalRisks ?? 0 },
    { label: 'Overdue', value: summary?.overdueOpen ?? 0 }
  ]), [summary]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Program Coordination</h2>
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-widest">Cross-bundle execution intelligence</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'capacity', label: 'Capacity' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPanel(tab.id)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                panel === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {panel === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
                <p className="text-2xl font-black text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <ChangeFeed scopeType="PROGRAM" title="Program activity" limit={20} />
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">At-Risk Bundles</h3>
              <button
                onClick={openAtRiskBundles}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                View ({intel?.listCounts?.topAtRiskBundles ?? 0})
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                    <th className="text-left py-2">Band</th>
                    <th className="text-left py-2">Bundle</th>
                    <th className="text-left py-2">Blocked</th>
                    <th className="text-left py-2">High/Critical</th>
                    <th className="text-left py-2">Overdue</th>
                    <th className="text-left py-2">Avg Confidence</th>
                    <th className="text-left py-2">Avg Readiness</th>
                    <th className="text-left py-2">Late Milestones</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleRollups.map((bundle) => (
                    <tr
                      key={bundle.bundleId}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => openBundleModal(bundle)}
                    >
                      <td className="py-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${bandBadge(bundle.band)}`}>{bundle.band}</span>
                      </td>
                      <td className="py-3 font-semibold text-slate-700">{bundle.bundleName || bundle.bundleId}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.blockedDerived}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.highCriticalRisks}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.overdueOpen}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.confidenceAvg}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.readinessAvg}</td>
                      <td className="py-3 text-slate-500">{bundle.aggregated.isLateCount}</td>
                    </tr>
                  ))}
                  {bundleRollups.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 text-sm">No bundles available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Drifting Commitments</h3>
              <button
                onClick={() => router.push('/?tab=work-items&view=milestone-plan')}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Open planning
              </button>
            </div>
            {driftLoading && <div className="text-sm text-slate-400">Scanning drift signals…</div>}
            {!driftLoading && driftList.length === 0 && (
              <div className="text-sm text-slate-400">No major drift detected.</div>
            )}
            {!driftLoading && driftList.length > 0 && (
              <div className="space-y-3">
                {driftList.map((entry) => (
                  <div key={entry.milestoneId} className="border border-slate-100 rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">{entry.name}</div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400">{entry.bundleName || 'Bundle'}</div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-700">
                        Major drift
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      Baseline {entry.drift?.baselineAt ? formatDate(entry.drift.baselineAt) : '—'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(entry.drift?.deltas || []).slice(0, 3).map((delta: any) => (
                        <span
                          key={delta.key}
                          className="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-500"
                          title={delta.detail}
                        >
                          {delta.key}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => router.push(`/?tab=work-items&view=milestone-plan&milestoneId=${encodeURIComponent(entry.milestoneId)}`)}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                      >
                        Review milestone
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Top Cross-Bundle Blockers</h3>
                <button
                  onClick={openTopBlockers}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  View ({intel?.listCounts?.topCrossBundleBlockers ?? 0})
                </button>
              </div>
              <p className="text-sm text-slate-500">Most disruptive blockers causing cross-bundle dependency drag.</p>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">At-Risk Milestones</h3>
                <button
                  onClick={openAtRiskMilestones}
                  className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  View ({intel?.listCounts?.topAtRiskMilestones ?? 0})
                </button>
              </div>
              <p className="text-sm text-slate-500">Milestones with the highest slip risk and active blockers.</p>
            </div>
          </div>
        </>
      )}

      {panel === 'capacity' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Capacity Overview</h3>
                <p className="text-xs text-slate-400 mt-1">Even allocation across weeks until milestone end date.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horizon</span>
                <select
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  value={horizonWeeks}
                  onChange={(e) => setHorizonWeeks(Number(e.target.value))}
                >
                  {[6, 8, 12].map((w) => (
                    <option key={w} value={w}>{w} weeks</option>
                  ))}
                </select>
              </div>
            </div>

            {capacityError && <div className="text-sm text-red-500">{capacityError}</div>}
            {capacityLoading && <div className="text-sm text-slate-400">Loading capacity plan...</div>}

            {!capacityLoading && !capacityError && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="text-left py-2 pr-4">Bundle</th>
                      {capacityPlans[0]?.buckets?.map((bucket) => (
                        <th key={bucket.key} className="text-left py-2 pr-4">{bucket.key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {capacityPlans.map((plan) => (
                      <tr key={plan.bundleId} className="border-t border-slate-100">
                        <td className="py-3 pr-4 font-semibold text-slate-700">{plan.bundleName || plan.bundleId}</td>
                        {plan.buckets.map((bucket) => (
                          <td key={bucket.key} className="py-3 pr-4">
                            <button
                              onClick={() => openCapacityCell(plan.bundleName || plan.bundleId, bucket)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                bucket.overBy > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'
                              }`}
                            >
                              {bucket.demandPoints}/{bucket.capacityPoints}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {capacityPlans.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">No capacity data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">At-Risk Bundles</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                    <th className="text-left py-2">Bundle</th>
                    <th className="text-left py-2">Demand</th>
                    <th className="text-left py-2">Capacity</th>
                    <th className="text-left py-2">Max Over</th>
                    <th className="text-left py-2">Top Drivers</th>
                  </tr>
                </thead>
                <tbody>
                  {atRiskCapacityBundles.map((b) => (
                    <tr key={b.bundleId} className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-slate-700">{b.bundleName || b.bundleId}</td>
                      <td className="py-3 text-slate-500">{b.totalDemand}</td>
                      <td className="py-3 text-slate-500">{b.totalCapacity}</td>
                      <td className="py-3 text-red-600 font-semibold">{b.maxOverBy}</td>
                      <td className="py-3 text-slate-500">
                        {(b.topDrivers || []).map((d) => d.name).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {atRiskCapacityBundles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-sm">No bundles over capacity.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Recommended Actions</h3>
            </div>
            <div className="space-y-3">
              {capacityActions.map((action, idx) => (
                <div key={`${action.type}-${idx}`} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{action.type.replace('_', ' ')}</div>
                    <div className="text-[11px] text-slate-400">{action.reason}</div>
                  </div>
                  {action.milestoneId && (
                    <button
                      onClick={() => router.push('/?tab=work-items&view=milestone-plan')}
                      className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                    >
                      Open Planning
                    </button>
                  )}
                </div>
              ))}
              {capacityActions.length === 0 && (
                <div className="text-sm text-slate-400">No capacity actions recommended.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">{modal.title}</h4>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
            </header>
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {modal.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramCoordination;
