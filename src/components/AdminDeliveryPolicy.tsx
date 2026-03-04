import React from 'react';
import { Bundle } from '../types';

type DeliveryPolicy = {
  _id: 'global';
  version: number;
  updatedAt: string;
  updatedBy: string;
  readiness: {
    milestone: {
      warnScoreBelow: number;
      blockScoreBelow: number;
      blockOnBlockedItems: boolean;
      blockOnHighCriticalRisks: boolean;
    };
    sprint: {
      warnScoreBelow: number;
      blockScoreBelow: number;
      blockOnBlockedItems: boolean;
      blockOnHighCriticalRisks: boolean;
    };
  };
  dataQuality: {
    weights: {
      missingStoryPoints: number;
      missingAssignee: number;
      missingDueAt: number;
      missingRiskSeverity: number;
    };
    caps: {
      missingStoryPoints: number;
      missingAssignee: number;
      missingDueAt: number;
      missingRiskSeverity: number;
    };
  };
  forecasting: {
    atRiskPct: number;
    offTrackPct: number;
    minSampleSize: number;
  };
  criticalPath: {
    nearCriticalSlackPct: number;
    defaultIncludeExternal: boolean;
    defaultExternalDepth: number;
  };
  staleness: {
    thresholdsDays: {
      workItemStale: number;
      criticalStale: number;
      blockedStale: number;
      unassignedStale: number;
      githubStale: number;
      inProgressNoPrStale: number;
    };
    nudges: {
      enabled: boolean;
      allowedRoles: Array<'ADMIN' | 'CMO' | 'BUNDLE_OWNER' | 'WATCHER'>;
      cooldownHoursPerItem: number;
      maxNudgesPerUserPerDay: number;
    };
    digest: {
      includeStaleSummary: boolean;
      minCriticalStaleToInclude: number;
    };
  };
};

type DeliveryPolicyOverride = {
  bundleId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  overrides: Partial<DeliveryPolicy>;
};

const DEFAULT_POLICY: DeliveryPolicy = {
  _id: 'global',
  version: 1,
  updatedAt: '',
  updatedBy: 'system',
  readiness: {
    milestone: {
      warnScoreBelow: 70,
      blockScoreBelow: 50,
      blockOnBlockedItems: true,
      blockOnHighCriticalRisks: true
    },
    sprint: {
      warnScoreBelow: 70,
      blockScoreBelow: 50,
      blockOnBlockedItems: true,
      blockOnHighCriticalRisks: true
    }
  },
  dataQuality: {
    weights: {
      missingStoryPoints: 5,
      missingAssignee: 2,
      missingDueAt: 2,
      missingRiskSeverity: 10
    },
    caps: {
      missingStoryPoints: 30,
      missingAssignee: 20,
      missingDueAt: 20,
      missingRiskSeverity: 30
    }
  },
  forecasting: {
    atRiskPct: 0.15,
    offTrackPct: 0.3,
    minSampleSize: 3
  },
  criticalPath: {
    nearCriticalSlackPct: 0.1,
    defaultIncludeExternal: false,
    defaultExternalDepth: 3
  },
  staleness: {
    thresholdsDays: {
      workItemStale: 7,
      criticalStale: 3,
      blockedStale: 5,
      unassignedStale: 2,
      githubStale: 5,
      inProgressNoPrStale: 5
    },
    nudges: {
      enabled: true,
      allowedRoles: ['ADMIN', 'CMO', 'BUNDLE_OWNER', 'WATCHER'],
      cooldownHoursPerItem: 24,
      maxNudgesPerUserPerDay: 20
    },
    digest: {
      includeStaleSummary: true,
      minCriticalStaleToInclude: 1
    }
  }
};

const AdminDeliveryPolicy: React.FC = () => {
  const [policy, setPolicy] = React.useState<DeliveryPolicy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [bundles, setBundles] = React.useState<Bundle[]>([]);
  const [overrideIndex, setOverrideIndex] = React.useState<Record<string, DeliveryPolicyOverride>>({});
  const [selectedBundleId, setSelectedBundleId] = React.useState<string>('');
  const [bundlePolicy, setBundlePolicy] = React.useState<{
    override: DeliveryPolicyOverride | null;
    effective: DeliveryPolicy | null;
    refs?: any;
    hasOverrides?: boolean;
  } | null>(null);
  const [bundleMessage, setBundleMessage] = React.useState<string | null>(null);
  const [bundleLoading, setBundleLoading] = React.useState(false);
  const [bundleSaving, setBundleSaving] = React.useState(false);
  const [overrideText, setOverrideText] = React.useState('{\n\n}');

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/delivery-policy');
      const data = await res.json();
      if (res.ok) {
        setPolicy(data?.policy || data);
      } else {
        setMessage(data?.error || 'Failed to load policy');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  };

  const loadBundles = async () => {
    try {
      const [bundleRes, overrideRes] = await Promise.all([
        fetch('/api/bundles'),
        fetch('/api/admin/delivery-policy-overrides')
      ]);
      const bundleData = await bundleRes.json();
      const overrideData = await overrideRes.json();
      if (bundleRes.ok && Array.isArray(bundleData)) {
        setBundles(bundleData);
      }
      if (overrideRes.ok && Array.isArray(overrideData?.overrides)) {
        const index: Record<string, DeliveryPolicyOverride> = {};
        overrideData.overrides.forEach((entry: DeliveryPolicyOverride) => {
          if (entry?.bundleId) index[String(entry.bundleId)] = entry;
        });
        setOverrideIndex(index);
      }
    } catch {
      setBundles([]);
      setOverrideIndex({});
    }
  };

  React.useEffect(() => { load(); loadBundles(); }, []);

  const loadBundlePolicy = async (bundleId: string) => {
    setBundleLoading(true);
    setBundleMessage(null);
    try {
      const res = await fetch(`/api/admin/bundles/${bundleId}/delivery-policy`);
      const data = await res.json();
      if (res.ok) {
        setBundlePolicy({
          override: data.override || null,
          effective: data.effective || null,
          refs: data.refs,
          hasOverrides: data.hasOverrides
        });
        const raw = data?.override?.overrides || {};
        setOverrideText(JSON.stringify(raw, null, 2));
      } else {
        setBundleMessage(data?.error || 'Failed to load bundle policy');
      }
    } catch (err: any) {
      setBundleMessage(err?.message || 'Failed to load bundle policy');
    } finally {
      setBundleLoading(false);
    }
  };

  const update = (patch: Partial<DeliveryPolicy>) => {
    if (!policy) return;
    setPolicy({
      ...policy,
      ...patch,
      readiness: {
        milestone: { ...policy.readiness.milestone, ...(patch.readiness?.milestone || {}) },
        sprint: { ...policy.readiness.sprint, ...(patch.readiness?.sprint || {}) }
      },
      dataQuality: {
        weights: { ...policy.dataQuality.weights, ...(patch.dataQuality?.weights || {}) },
        caps: { ...policy.dataQuality.caps, ...(patch.dataQuality?.caps || {}) }
      },
      forecasting: { ...policy.forecasting, ...(patch.forecasting || {}) },
      criticalPath: { ...policy.criticalPath, ...(patch.criticalPath || {}) },
      staleness: {
        thresholdsDays: { ...policy.staleness.thresholdsDays, ...(patch.staleness?.thresholdsDays || {}) },
        nudges: { ...policy.staleness.nudges, ...(patch.staleness?.nudges || {}) },
        digest: { ...policy.staleness.digest, ...(patch.staleness?.digest || {}) }
      }
    });
  };

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/delivery-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
      const data = await res.json();
      if (res.ok) {
        setPolicy(data?.policy || policy);
        setMessage('Delivery policy saved.');
      } else {
        setMessage(data?.error || 'Failed to save policy');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    if (!policy) return;
    setPolicy({
      ...policy,
      readiness: DEFAULT_POLICY.readiness,
      dataQuality: DEFAULT_POLICY.dataQuality,
      forecasting: DEFAULT_POLICY.forecasting,
      criticalPath: DEFAULT_POLICY.criticalPath,
      staleness: DEFAULT_POLICY.staleness
    });
    setMessage('Defaults restored. Save to apply.');
  };

  const saveBundleOverride = async () => {
    if (!selectedBundleId) return;
    setBundleSaving(true);
    setBundleMessage(null);
    try {
      const overrides = overrideText.trim() ? JSON.parse(overrideText) : {};
      const res = await fetch(`/api/admin/bundles/${selectedBundleId}/delivery-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides })
      });
      const data = await res.json();
      if (res.ok) {
        setBundlePolicy({
          override: data.override || null,
          effective: data.effective || null,
          refs: data.refs,
          hasOverrides: data.hasOverrides
        });
        const raw = data?.override?.overrides || {};
        setOverrideText(JSON.stringify(raw, null, 2));
        setBundleMessage('Bundle policy override saved.');
        await loadBundles();
      } else {
        setBundleMessage(data?.error || 'Failed to save override');
      }
    } catch (err: any) {
      setBundleMessage(err?.message || 'Failed to save override');
    } finally {
      setBundleSaving(false);
    }
  };

  const resetBundleOverride = async () => {
    if (!selectedBundleId) return;
    setBundleSaving(true);
    setBundleMessage(null);
    try {
      const res = await fetch(`/api/admin/bundles/${selectedBundleId}/delivery-policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
      });
      const data = await res.json();
      if (res.ok) {
        setBundlePolicy({
          override: data.override || null,
          effective: data.effective || null,
          refs: data.refs,
          hasOverrides: data.hasOverrides
        });
        setOverrideText('{\n\n}');
        setBundleMessage('Bundle override reset to global.');
        await loadBundles();
      } else {
        setBundleMessage(data?.error || 'Failed to reset override');
      }
    } catch (err: any) {
      setBundleMessage(err?.message || 'Failed to reset override');
    } finally {
      setBundleSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-slate-400 text-sm">Loading delivery policy…</div>;
  }

  if (!policy) {
    return <div className="p-12 text-slate-400 text-sm">No policy found.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-sliders text-xl"></i>
          </div>
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Settings</div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Delivery Policy</h3>
            <p className="text-sm text-slate-500 font-medium mt-2">Configure global thresholds for readiness, data quality, forecasting, and critical path.</p>
          </div>
        </div>
      </header>

      <div className="p-12 space-y-10">
        {message && (
          <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-2xl px-4 py-3">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Milestone Readiness</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Warn score below
                <input
                  type="number"
                  value={policy.readiness.milestone.warnScoreBelow}
                  onChange={(e) => update({ readiness: { ...policy.readiness, milestone: { ...policy.readiness.milestone, warnScoreBelow: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Block score below
                <input
                  type="number"
                  value={policy.readiness.milestone.blockScoreBelow}
                  onChange={(e) => update({ readiness: { ...policy.readiness, milestone: { ...policy.readiness.milestone, blockScoreBelow: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={policy.readiness.milestone.blockOnBlockedItems}
                onChange={(e) => update({ readiness: { ...policy.readiness, milestone: { ...policy.readiness.milestone, blockOnBlockedItems: e.target.checked } } })}
              />
              Block on blocked items
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={policy.readiness.milestone.blockOnHighCriticalRisks}
                onChange={(e) => update({ readiness: { ...policy.readiness, milestone: { ...policy.readiness.milestone, blockOnHighCriticalRisks: e.target.checked } } })}
              />
              Block on high/critical risks
            </label>
          </section>

          <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Sprint Readiness</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-xs font-semibold text-slate-500">
                Warn score below
                <input
                  type="number"
                  value={policy.readiness.sprint.warnScoreBelow}
                  onChange={(e) => update({ readiness: { ...policy.readiness, sprint: { ...policy.readiness.sprint, warnScoreBelow: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Block score below
                <input
                  type="number"
                  value={policy.readiness.sprint.blockScoreBelow}
                  onChange={(e) => update({ readiness: { ...policy.readiness, sprint: { ...policy.readiness.sprint, blockScoreBelow: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={policy.readiness.sprint.blockOnBlockedItems}
                onChange={(e) => update({ readiness: { ...policy.readiness, sprint: { ...policy.readiness.sprint, blockOnBlockedItems: e.target.checked } } })}
              />
              Block on blocked items
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={policy.readiness.sprint.blockOnHighCriticalRisks}
                onChange={(e) => update({ readiness: { ...policy.readiness, sprint: { ...policy.readiness.sprint, blockOnHighCriticalRisks: e.target.checked } } })}
              />
              Block on high/critical risks
            </label>
          </section>
        </div>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Data Quality Weights</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(policy.dataQuality.weights).map(([key, value]) => (
              <label key={key} className="text-xs font-semibold text-slate-500">
                {key}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => update({ dataQuality: { ...policy.dataQuality, weights: { ...policy.dataQuality.weights, [key]: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
            ))}
          </div>
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600 mt-6">Data Quality Caps</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(policy.dataQuality.caps).map(([key, value]) => (
              <label key={key} className="text-xs font-semibold text-slate-500">
                {key}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => update({ dataQuality: { ...policy.dataQuality, caps: { ...policy.dataQuality.caps, [key]: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Forecasting</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-500">
              At-risk ratio
              <input
                type="number"
                step="0.01"
                value={policy.forecasting.atRiskPct}
                onChange={(e) => update({ forecasting: { ...policy.forecasting, atRiskPct: Number(e.target.value) } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Off-track ratio
              <input
                type="number"
                step="0.01"
                value={policy.forecasting.offTrackPct}
                onChange={(e) => update({ forecasting: { ...policy.forecasting, offTrackPct: Number(e.target.value) } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Min sample size
              <input
                type="number"
                value={policy.forecasting.minSampleSize}
                onChange={(e) => update({ forecasting: { ...policy.forecasting, minSampleSize: Number(e.target.value) } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
          </div>
        </section>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Critical Path</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-500">
              Near-critical slack %
              <input
                type="number"
                step="0.01"
                value={policy.criticalPath.nearCriticalSlackPct}
                onChange={(e) => update({ criticalPath: { ...policy.criticalPath, nearCriticalSlackPct: Number(e.target.value) } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Default external depth
              <input
                type="number"
                value={policy.criticalPath.defaultExternalDepth}
                onChange={(e) => update({ criticalPath: { ...policy.criticalPath, defaultExternalDepth: Number(e.target.value) } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 mt-6">
              <input
                type="checkbox"
                checked={policy.criticalPath.defaultIncludeExternal}
                onChange={(e) => update({ criticalPath: { ...policy.criticalPath, defaultIncludeExternal: e.target.checked } })}
              />
              Include external blockers by default
            </label>
          </div>
        </section>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-6">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Staleness Signals</h4>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="text-xs font-semibold text-slate-500">
              Work item stale (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.workItemStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, workItemStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Critical stale (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.criticalStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, criticalStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Blocked stale (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.blockedStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, blockedStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Unassigned stale (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.unassignedStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, unassignedStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              GitHub PR stale (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.githubStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, githubStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              In-progress no PR (days)
              <input
                type="number"
                value={policy.staleness.thresholdsDays.inProgressNoPrStale}
                onChange={(e) => update({ staleness: { ...policy.staleness, thresholdsDays: { ...policy.staleness.thresholdsDays, inProgressNoPrStale: Number(e.target.value) } } })}
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">Nudge Controls</h5>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={policy.staleness.nudges.enabled}
                  onChange={(e) => update({ staleness: { ...policy.staleness, nudges: { ...policy.staleness.nudges, enabled: e.target.checked } } })}
                />
                Enable nudges
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-500">
                  Cooldown (hours)
                  <input
                    type="number"
                    value={policy.staleness.nudges.cooldownHoursPerItem}
                    onChange={(e) => update({ staleness: { ...policy.staleness, nudges: { ...policy.staleness.nudges, cooldownHoursPerItem: Number(e.target.value) } } })}
                    className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Max nudges/user/day
                  <input
                    type="number"
                    value={policy.staleness.nudges.maxNudgesPerUserPerDay}
                    onChange={(e) => update({ staleness: { ...policy.staleness, nudges: { ...policy.staleness.nudges, maxNudgesPerUserPerDay: Number(e.target.value) } } })}
                    className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                  />
                </label>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Allowed Roles</div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                {(['ADMIN', 'CMO', 'BUNDLE_OWNER', 'WATCHER'] as const).map((role) => {
                  const checked = policy.staleness.nudges.allowedRoles.includes(role);
                  return (
                    <label key={role} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...policy.staleness.nudges.allowedRoles, role]))
                            : policy.staleness.nudges.allowedRoles.filter((r) => r !== role);
                          update({ staleness: { ...policy.staleness, nudges: { ...policy.staleness.nudges, allowedRoles: next } } });
                        }}
                      />
                      {role.replace('_', ' ')}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">Digest</h5>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={policy.staleness.digest.includeStaleSummary}
                  onChange={(e) => update({ staleness: { ...policy.staleness, digest: { ...policy.staleness.digest, includeStaleSummary: e.target.checked } } })}
                />
                Include stale summary in digest
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Min critical stale to include
                <input
                  type="number"
                  value={policy.staleness.digest.minCriticalStaleToInclude}
                  onChange={(e) => update({ staleness: { ...policy.staleness, digest: { ...policy.staleness.digest, minCriticalStaleToInclude: Number(e.target.value) } } })}
                  className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="border border-slate-100 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Bundle Policy Overrides</h4>
              <p className="text-xs text-slate-500 mt-1">Override selected thresholds per bundle. Effective policy merges global + overrides.</p>
            </div>
            <button
              onClick={loadBundles}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600"
            >
              Refresh
            </button>
          </div>

          {bundleMessage && (
            <div className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-2xl px-4 py-3">
              {bundleMessage}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <div className="border border-slate-100 rounded-2xl p-3 max-h-[520px] overflow-auto">
              {bundles.length === 0 && (
                <div className="text-xs text-slate-400 px-2 py-3">No bundles found.</div>
              )}
              {bundles.map((bundle) => {
                const id = String(bundle._id || bundle.id || '');
                const hasOverride = Boolean(overrideIndex[id]);
                const isActive = selectedBundleId === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setSelectedBundleId(id);
                      loadBundlePolicy(id);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-all ${isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-700'}`}
                  >
                    <div>
                      <div className="text-xs font-bold">{bundle.name}</div>
                      <div className={`text-[10px] uppercase tracking-widest ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>{bundle.key}</div>
                    </div>
                    {hasOverride && (
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        Override
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border border-slate-100 rounded-2xl p-4 space-y-4">
              {!selectedBundleId && (
                <div className="text-sm text-slate-400">Select a bundle to view or edit overrides.</div>
              )}
              {selectedBundleId && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-slate-400 font-black">Selected Bundle</div>
                      <div className="text-lg font-bold text-slate-800">
                        {bundles.find((b) => String(b._id || b.id || '') === selectedBundleId)?.name || 'Bundle'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {bundlePolicy?.hasOverrides ? 'Overrides active' : 'Using global policy'}
                    </div>
                  </div>

                  {bundleLoading ? (
                    <div className="text-sm text-slate-400">Loading bundle policy…</div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 block mb-2">Override JSON (partial policy)</label>
                        <textarea
                          value={overrideText}
                          onChange={(e) => setOverrideText(e.target.value)}
                          rows={10}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={saveBundleOverride}
                          disabled={bundleSaving}
                          className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white disabled:opacity-50"
                        >
                          {bundleSaving ? 'Saving…' : 'Save Override'}
                        </button>
                        <button
                          onClick={resetBundleOverride}
                          disabled={bundleSaving}
                          className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 disabled:opacity-50"
                        >
                          Reset to Global
                        </button>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 mb-2">Effective Policy</div>
                        <pre className="bg-slate-900 text-slate-100 text-[11px] rounded-2xl p-3 max-h-64 overflow-auto">
                          {JSON.stringify(bundlePolicy?.effective || {}, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Policy'}
          </button>
          <button
            onClick={restoreDefaults}
            className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600"
          >
            Restore Defaults
          </button>
          <div className="text-xs text-slate-400 ml-auto">
            Version {policy.version} • Updated {policy.updatedAt ? new Date(policy.updatedAt).toLocaleString() : '—'} by {policy.updatedBy || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDeliveryPolicy;
