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

const ProgramCoordination: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bundleIdsParam = searchParams.get('bundleIds') || '';
  const milestoneIdsParam = searchParams.get('milestoneIds') || '';
  const [loading, setLoading] = useState(true);
  const [intel, setIntel] = useState<ProgramIntel | null>(null);
  const [listsCache, setListsCache] = useState<ProgramIntel['lists'] | null>(null);
  const [modal, setModal] = useState<{ title: string; content: React.ReactNode } | null>(null);

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

  const summary = intel?.summary;
  const bundleRollups = intel?.bundleRollups || [];

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
      </div>

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
