
import React, { useEffect, useMemo, useState } from 'react';
import { Application, ApplicationPlanningMetadata, Bundle, BundleAssignment, BundleProfile, WorkItem, WorkItemType } from '../types';
import { usePathname, useRouter, useSearchParams } from '../App';
import { canEditBundleProfileClient } from '../lib/authzClient';
import CreateWorkItemModal from './CreateWorkItemModal';
import ChangeFeed from './ChangeFeed';
import ScheduleEnvironmentGrid from './applications/ScheduleEnvironmentGrid';
import ScheduleScopeSelector from './applications/ScheduleScopeSelector';
import ScheduleDefaultsPanel from './applications/ScheduleDefaultsPanel';

const parseIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toIsoDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

const addDays = (date: Date, days: number) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const calcDurationDays = (start?: string | null, end?: string | null) => {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) return null;
  const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(diff));
};

const deriveEndDate = (start?: string | null, durationDays?: number | null) => {
  if (!start || !durationDays) return null;
  const startDate = parseIsoDate(start);
  if (!startDate) return null;
  return toIsoDate(addDays(startDate, durationDays));
};

const computeTimelineDurationDays = (envs: Array<{ startDate?: string | null; endDate?: string | null; durationDays?: number | null }>) => {
  const dates = envs.reduce((acc: Date[], env) => {
    const start = parseIsoDate(env.startDate || null);
    const end = parseIsoDate(env.endDate || deriveEndDate(env.startDate || null, env.durationDays || null));
    if (start && end) {
      acc.push(start, end);
    }
    return acc;
  }, []);
  if (!dates.length) return null;
  const min = Math.min(...dates.map((d) => d.getTime()));
  const max = Math.max(...dates.map((d) => d.getTime()));
  const diff = (max - min) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(diff));
};

const computeDerivedMilestoneWeeks = (envs: Array<{ startDate?: string | null; endDate?: string | null; durationDays?: number | null }>, milestoneCount?: number | null) => {
  if (!milestoneCount) return null;
  const timelineDays = computeTimelineDurationDays(envs);
  if (!timelineDays) return null;
  return Number((timelineDays / milestoneCount / 7).toFixed(2));
};

const ENVIRONMENT_SUGGESTIONS = ['DEV', 'SIT', 'INT', 'QA', 'PERF', 'UAT', 'STAGING', 'PREPROD', 'PROD'];

interface ApplicationsProps {
  filterBundle: string;
  filterApp: string;
  selMilestone: string;
  searchQuery: string;
  applications: Application[];
  bundles: Bundle[];
}

const Applications: React.FC<ApplicationsProps> = ({ filterBundle, filterApp, selMilestone, searchQuery, applications = [], bundles = [] }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [bundleProfiles, setBundleProfiles] = useState<BundleProfile[]>([]);
  const [assignments, setAssignments] = useState<BundleAssignment[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | BundleProfile['status']>('all');
  const [localSearch, setLocalSearch] = useState('');
  const viewParam = searchParams.get('view');
  const viewMode = viewParam === 'apps' ? 'apps' : 'bundles';
  const [bundleHealth, setBundleHealth] = useState<Record<string, any>>({});
  const [createModal, setCreateModal] = useState<{ open: boolean; type?: WorkItemType; bundleId?: string }>({ open: false });
  const [apmSummary, setApmSummary] = useState<{ dependenciesCount: number; highCriticalApps: number }>({
    dependenciesCount: 0,
    highCriticalApps: 0
  });
  const [dependencyCountByApp, setDependencyCountByApp] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      setLoadingProfiles(true);
      try {
        const [profilesRes, assignmentsRes] = await Promise.all([
          fetch('/api/bundle-profiles'),
          fetch('/api/bundle-assignments')
        ]);
        const profileData = await profilesRes.json();
        const assignmentData = await assignmentsRes.json();
        setBundleProfiles(Array.isArray(profileData) ? profileData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      } catch {
        setBundleProfiles([]);
        setAssignments([]);
      } finally {
        setLoadingProfiles(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadHealth = async () => {
      if (!bundles.length) return;
      try {
        const ids = bundles.map((b) => String(b._id)).filter(Boolean).join(',');
        const res = await fetch(`/api/bundles/health?bundleIds=${encodeURIComponent(ids)}`);
        const data = await res.json();
        const map: Record<string, any> = {};
        (data?.bundles || []).forEach((b: any) => { map[String(b.bundleId)] = b; });
        setBundleHealth(map);
      } catch {
        setBundleHealth({});
      }
    };
    loadHealth();
  }, [bundles]);

  useEffect(() => {
    const loadApmSummary = async () => {
      try {
        const res = await fetch('/api/application-dependencies');
        const data = await res.json().catch(() => ({}));
        const deps = Array.isArray(data?.items) ? data.items : [];
        const counts: Record<string, number> = {};
        deps.forEach((dep: any) => {
          const source = String(dep?.sourceApplicationId || '');
          const target = String(dep?.targetApplicationId || '');
          if (source) counts[source] = (counts[source] || 0) + 1;
          if (target) counts[target] = (counts[target] || 0) + 1;
        });
        const highCriticalApps = applications.filter((app) => {
          const level = String((app as any).businessCriticality || '').toUpperCase();
          return level === 'HIGH' || level === 'CRITICAL';
        }).length;
        setApmSummary({
          dependenciesCount: deps.length,
          highCriticalApps
        });
        setDependencyCountByApp(counts);
      } catch {
        setApmSummary((prev) => ({ ...prev, highCriticalApps: applications.filter((app) => {
          const level = String((app as any).businessCriticality || '').toUpperCase();
          return level === 'HIGH' || level === 'CRITICAL';
        }).length }));
        setDependencyCountByApp({});
      }
    };
    loadApmSummary();
  }, [applications]);

  const profileByBundle = useMemo(() => {
    const map = new Map<string, BundleProfile>();
    bundleProfiles.forEach((p) => map.set(String(p.bundleId), p));
    return map;
  }, [bundleProfiles]);

  const assignmentsByBundle = useMemo(() => {
    const map = new Map<string, BundleAssignment[]>();
    assignments.forEach((a) => {
      const key = String(a.bundleId);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [assignments]);

  const getCurrentMilestone = (profile?: BundleProfile) => {
    const milestones = profile?.schedule?.milestones || [];
    if (milestones.length === 0) return null;
    const inProgress = milestones.find((m) => m.status === 'in_progress');
    if (inProgress) return inProgress;
    return milestones.find((m) => m.status !== 'done') || milestones[milestones.length - 1];
  };

  const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString() : '—';

  const filteredApps = useMemo(() => {
    const byBundle = filterBundle === 'all' ? applications : applications.filter((a) => String(a.bundleId) === String(filterBundle));
    const byApp = filterApp === 'all' ? byBundle : byBundle.filter((a) => String(a._id || a.id) === String(filterApp));
    const combinedSearch = `${searchQuery || ''} ${localSearch || ''}`.trim().toLowerCase();
    return byApp.filter((app) => {
      if (combinedSearch) {
        const hay = `${app.name || ''} ${app.aid || ''}`.toLowerCase();
        if (!hay.includes(combinedSearch)) return false;
      }
      if (statusFilter !== 'all') {
        if (getEffectiveStatus(app.bundleId) !== statusFilter) return false;
      }
      if (selMilestone !== 'all') {
        const profile = profileByBundle.get(String(app.bundleId));
        const current = getCurrentMilestone(profile);
        if (!current) return false;
        if (current.key !== selMilestone && current.name !== selMilestone) return false;
      }
      return true;
    });
  }, [applications, filterBundle, filterApp, searchQuery, selMilestone, profileByBundle, statusFilter, localSearch]);

  const bundleName = (bundleId?: string) => bundles.find((b) => String(b._id) === String(bundleId))?.name || '—';

  const summarizeOwners = (bundleId?: string, type?: string) => {
    const list = assignmentsByBundle.get(String(bundleId)) || [];
    const filtered = list.filter((a) => a.assignmentType === type);
    if (filtered.length === 0) return '—';
    const names = filtered.map((a: any) => a.user?.name || a.user?.email || 'User');
    return filtered.length > 1 ? `${names[0]} +${filtered.length - 1}` : names[0];
  };

  const getEffectiveStatus = (bundleId?: string) => {
    const profile = profileByBundle.get(String(bundleId));
    const health = bundleHealth[String(bundleId)];
    if (profile?.statusSource === 'manual') return profile.status || 'unknown';
    return health?.computedStatus || profile?.status || 'unknown';
  };

  const bundlesWithApps = useMemo(() => {
    return bundles.map((b) => {
      const apps = applications.filter((a) => String(a.bundleId) === String(b._id));
      const profile = profileByBundle.get(String(b._id));
      const current = getCurrentMilestone(profile);
      return { bundle: b, apps, profile, current };
    });
  }, [bundles, applications, profileByBundle]);

  const bundleFiltered = bundlesWithApps.filter(({ bundle }) => {
    if (filterBundle !== 'all' && String(bundle._id) !== String(filterBundle)) return false;
    if (statusFilter !== 'all') {
      if (getEffectiveStatus(bundle._id) !== statusFilter) return false;
    }
    if (selMilestone !== 'all') {
      const profile = profileByBundle.get(String(bundle._id));
      const current = getCurrentMilestone(profile);
      if (!current) return false;
      if (current.key !== selMilestone && current.name !== selMilestone) return false;
    }
    const combinedSearch = `${searchQuery || ''} ${localSearch || ''}`.trim().toLowerCase();
    if (combinedSearch) {
      const hay = `${bundle.name || ''}`.toLowerCase();
      if (!hay.includes(combinedSearch)) return false;
    }
    return true;
  });

  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'applications' && pathParts[1] === 'bundles' && pathParts[2]) {
    return (
      <BundleProfileView
        bundleId={pathParts[2]}
        bundleName={bundleName(pathParts[2])}
        assignments={assignmentsByBundle.get(String(pathParts[2])) || []}
        applications={applications}
        health={bundleHealth[String(pathParts[2])] || null}
        onOpenApp={(appId) => router.push(`/applications/${encodeURIComponent(appId)}`)}
        onAddRisk={() => setCreateModal({ open: true, type: WorkItemType.RISK, bundleId: pathParts[2] })}
        onAddDependency={() => setCreateModal({ open: true, type: WorkItemType.DEPENDENCY, bundleId: pathParts[2] })}
      />
    );
  }

  if (pathParts[0] === 'applications' && pathParts[1]) {
    const appId = pathParts[1];
    const app = applications.find((a) => String(a._id || a.id) === String(appId));
    if (!app) {
      return <div className="p-12 text-slate-500">Application not found.</div>;
    }
    const profile = profileByBundle.get(String(app.bundleId));
    return (
      <ApplicationDetail
        app={app}
        applications={applications}
        bundleName={bundleName(app.bundleId)}
        profile={profile}
        owners={{
          vendorLead: summarizeOwners(app.bundleId, 'svp'),
          engineeringOwner: summarizeOwners(app.bundleId, 'bundle_owner')
        }}
        onOpenBundle={() => router.push(`/applications/bundles/${encodeURIComponent(String(app.bundleId))}`)}
      />
    );
  }

  const toggleView = (view: 'bundles' | 'apps') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`/applications?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applications Portfolio</div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Application Registry</h1>
          <p className="text-slate-500 font-medium mt-1">Portfolio-level view of bundles, applications, ownership, lifecycle, and delivery context.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'bundles', label: 'Bundles' },
            { id: 'apps', label: 'Apps' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => toggleView(item.id as any)}
              className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                viewMode === item.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
        <div className="text-sm font-semibold text-slate-800 mr-2">Filters</div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold">
          <option value="all">All status</option>
          <option value="on_track">On track</option>
          <option value="at_risk">At risk</option>
          <option value="blocked">Blocked</option>
          <option value="unknown">Unknown</option>
        </select>
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder={viewMode === 'bundles' ? 'Search bundle name...' : 'Search app name or ID...'}
          className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
        />
        <div className="text-xs text-slate-400">
          {loadingProfiles ? 'Loading bundle profiles...' : viewMode === 'bundles' ? `${bundleFiltered.length} bundles` : `${filteredApps.length} apps`}
        </div>
      </div>

      {viewMode === 'apps' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applications</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{filteredApps.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lifecycle Tracked</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {filteredApps.filter((app) => Boolean((app as any).lifecycleStatus)).length}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Critical Systems</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{apmSummary.highCriticalApps}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dependencies</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{apmSummary.dependenciesCount}</div>
          </div>
        </div>
      )}

      {viewMode === 'bundles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bundleFiltered.map(({ bundle, apps, profile, current }) => {
            const health = bundleHealth[String(bundle._id)];
            const computedStatus = health?.computedStatus;
            const status = profile?.statusSource === 'manual' ? (profile?.status || 'unknown') : (computedStatus || profile?.status || 'unknown');
            const statusClass =
              status === 'on_track' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
              status === 'at_risk' ? 'bg-amber-50 text-amber-600 border-amber-200' :
              status === 'blocked' ? 'bg-rose-50 text-rose-600 border-rose-200' :
              'bg-slate-100 text-slate-500 border-slate-200';
            return (
              <div
                key={bundle._id}
                onClick={() => router.push(`/applications/bundles/${encodeURIComponent(String(bundle._id))}`)}
                className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm cursor-pointer hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-black text-slate-800">{bundle.name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusClass}`}>
                    {status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Current milestone: <span className="font-semibold text-slate-700">{current?.name || 'Not linked yet'}</span></div>
                  <div>Planned Go-live: <span className="font-semibold text-slate-700">{profile?.schedule?.goLivePlanned ? formatDate(profile?.schedule?.goLivePlanned) : 'Not scheduled'}</span></div>
                  <div>Health score: <span className="font-semibold text-slate-700">{health?.healthScore ?? '—'}</span></div>
                  <div>Vendor Lead: <span className="font-semibold text-slate-700">{summarizeOwners(bundle._id, 'svp') === '—' ? 'Ownership incomplete' : summarizeOwners(bundle._id, 'svp')}</span></div>
                  <div>Engineering Owner: <span className="font-semibold text-slate-700">{summarizeOwners(bundle._id, 'bundle_owner') === '—' ? 'Ownership incomplete' : summarizeOwners(bundle._id, 'bundle_owner')}</span></div>
                  <div>Apps: <span className="font-semibold text-slate-700">{apps.length}</span></div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Updated {formatDate(profile?.updatedAt)}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); router.push('/?tab=work-items&view=roadmap'); }} className="text-slate-500">Open Roadmap</button>
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/applications/bundles/${encodeURIComponent(String(bundle._id))}`); }} className="text-blue-600">Open Bundle Profile</button>
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/applications/bundles/${encodeURIComponent(String(bundle._id))}`); }} className="text-blue-600">View Apps</button>
                  </div>
                </div>
              </div>
            );
          })}
          {bundleFiltered.length === 0 && (
            <div className="text-sm text-slate-400">No bundles match the current filters.</div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-4 py-3">App Name</th>
                <th className="px-4 py-3">App ID</th>
                <th className="px-4 py-3">Bundle</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Criticality</th>
                <th className="px-4 py-3">Release Train</th>
                <th className="px-4 py-3">Dependencies</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Updated At</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.map((app) => {
                const profile = profileByBundle.get(String(app.bundleId));
                const current = getCurrentMilestone(profile);
                const health = bundleHealth[String(app.bundleId)];
                const computedStatus = health?.computedStatus;
                const status = profile?.statusSource === 'manual' ? (profile?.status || 'unknown') : (computedStatus || profile?.status || 'unknown');
                const statusClass =
                  status === 'on_track' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                  status === 'at_risk' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  status === 'blocked' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                  'bg-slate-100 text-slate-500 border-slate-200';
                return (
                  <tr key={String(app._id || app.id)} className="border-t border-slate-100 hover:bg-slate-50 transition cursor-pointer" onClick={() => router.push(`/applications/${encodeURIComponent(String(app._id || app.id))}`)}>
                    <td className="px-4 py-3 font-semibold text-slate-800">{app.name}</td>
                    <td className="px-4 py-3 text-slate-500">{app.aid || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{bundleName(app.bundleId)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusClass}`}>
                        {String((app as any).lifecycleStatus || 'ACTIVE').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{(app as any).businessCriticality || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{(app as any).releaseTrain || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{dependencyCountByApp[String(app._id || app.id || app.aid)] || 0}</td>
                    <td className="px-4 py-3 text-slate-500">{(app as any).operationalOwner || summarizeOwners(app.bundleId, 'bundle_owner')}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate((app as any).updatedAt || profile?.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/applications/${encodeURIComponent(String(app._id || app.id))}`);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-blue-600"
                      >
                        Open Application Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredApps.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={10}>No applications match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {createModal.open && (
        <CreateWorkItemModal
          bundles={bundles}
          applications={applications}
          initialBundleId={createModal.bundleId || filterBundle}
          initialAppId=""
          initialType={createModal.type}
          onClose={() => setCreateModal({ open: false })}
          onSuccess={() => setCreateModal({ open: false })}
        />
      )}
    </div>
  );
};

const ApplicationDetail: React.FC<{
  app: Application;
  applications: Application[];
  bundleName: string;
  profile?: BundleProfile;
  owners: { vendorLead: string; engineeringOwner: string };
  onOpenBundle: () => void;
}> = ({ app, applications, bundleName, profile, owners, onOpenBundle }) => {
  const current = profile?.schedule?.milestones?.find((m) => m.status === 'in_progress') || profile?.schedule?.milestones?.find((m) => m.status !== 'done');
  const appId = String(app._id || app.id || app.aid || '');
  const bundleId = app.bundleId ? String(app.bundleId) : null;
  const [activeTab, setActiveTab] = useState<'overview' | 'environments' | 'dependencies' | 'lifecycle' | 'deliveryImpact'>('overview');
  const [appDraft, setAppDraft] = useState<any>({ ...app });
  const [appContextDraft, setAppContextDraft] = useState<any>({ ...app });
  const [appContextEditMode, setAppContextEditMode] = useState(false);
  const [savingApp, setSavingApp] = useState(false);
  const [appSaveError, setAppSaveError] = useState<string | null>(null);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [releaseTrains, setReleaseTrains] = useState<any[]>([]);
  const [scopeMode, setScopeMode] = useState<'bundle' | 'application'>('application');
  const [bundleMetadata, setBundleMetadata] = useState<ApplicationPlanningMetadata | null>(null);
  const [appMetadata, setAppMetadata] = useState<ApplicationPlanningMetadata | null>(null);
  const [resolvedMetadata, setResolvedMetadata] = useState<ApplicationPlanningMetadata | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ApplicationPlanningMetadata | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manualEndDates, setManualEndDates] = useState<Record<string, boolean>>({});
  const [manualActualDates, setManualActualDates] = useState<Record<string, boolean>>({});
  const [dependencies, setDependencies] = useState<any[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependencyForm, setDependencyForm] = useState<{ targetApplicationId: string; dependencyType: string; criticality: string }>({
    targetApplicationId: '',
    dependencyType: 'API',
    criticality: 'MEDIUM'
  });
  const [lifecycle, setLifecycle] = useState<any>({ lifecycleStage: 'ACTIVE', lifecycleOwner: '', lifecycleNotes: '' });
  const [lifecycleInitial, setLifecycleInitial] = useState<any>({ lifecycleStage: 'ACTIVE', lifecycleOwner: '', lifecycleNotes: '' });
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [lifecycleEditMode, setLifecycleEditMode] = useState(false);
  const [deliveryImpact, setDeliveryImpact] = useState<any | null>(null);
  const [deliveryImpactLoading, setDeliveryImpactLoading] = useState(false);
  const [envStrategy, setEnvStrategy] = useState<any | null>(null);
  const [envStrategyDraft, setEnvStrategyDraft] = useState<any | null>(null);
  const [envStrategyLoading, setEnvStrategyLoading] = useState(false);
  const [envStrategySaving, setEnvStrategySaving] = useState(false);

  const normalizeEnvRows = (rows?: any[]) => {
    const seen = new Set<string>();
    const normalized: any[] = [];
    (rows || []).forEach((row) => {
      if (!row?.name) return;
      const name = String(row.name).toUpperCase();
      if (seen.has(name)) return;
      seen.add(name);
      normalized.push({ ...row, name });
    });
    return normalized;
  };

  const buildEmptyMetadata = (scopeType: 'bundle' | 'application', scopeId: string): ApplicationPlanningMetadata => ({
    scopeType,
    scopeId,
    bundleId,
    applicationId: scopeType === 'application' ? appId : undefined,
    environments: [],
    goLive: { planned: null, actual: null },
    planningDefaults: { milestoneCount: null, sprintDurationWeeks: null, milestoneDurationWeeks: null },
    capacityDefaults: { capacityModel: null, deliveryTeams: null, sprintVelocityPerTeam: null, directSprintCapacity: null, teamSize: null, projectSize: null },
    notes: null
  });

  const normalizeMetadata = (data: ApplicationPlanningMetadata | null, scopeType: 'bundle' | 'application', scopeId: string) => ({
    ...buildEmptyMetadata(scopeType, scopeId),
    ...(data || {}),
    environments: normalizeEnvRows(data?.environments || []).map((row) => ({
      ...row,
      endDate: row.endDate || deriveEndDate(row.startDate || null, row.durationDays || null),
      durationDays: typeof row.durationDays === 'number' ? row.durationDays : calcDurationDays(row.startDate || null, row.endDate || null)
    })),
    goLive: data?.goLive || { planned: null, actual: null },
    planningDefaults: data?.planningDefaults || { milestoneCount: null, sprintDurationWeeks: null, milestoneDurationWeeks: null },
    capacityDefaults: data?.capacityDefaults || { capacityModel: null, deliveryTeams: null, sprintVelocityPerTeam: null, directSprintCapacity: null, teamSize: null, projectSize: null }
  });

  const loadPlanningMetadata = async () => {
    if (!appId) return;
    setPlanningLoading(true);
    setPlanningError(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/planning-metadata`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load planning metadata');
      }
      const data = await res.json();
      const bundleMeta = data?.bundleMetadata ? normalizeMetadata(data.bundleMetadata, 'bundle', bundleId || '') : (bundleId ? buildEmptyMetadata('bundle', bundleId) : null);
      const appMeta = normalizeMetadata(data?.applicationMetadata || null, 'application', appId);
      const resolved = normalizeMetadata(data?.resolvedMetadata || data?.planningMetadata || null, 'application', appId);
      setBundleMetadata(bundleMeta);
      setAppMetadata(appMeta);
      setResolvedMetadata(resolved);
    } catch (err: any) {
      setPlanningError(err?.message || 'Failed to load planning metadata');
      setBundleMetadata(bundleId ? buildEmptyMetadata('bundle', bundleId) : null);
      setAppMetadata(buildEmptyMetadata('application', appId));
      setResolvedMetadata(buildEmptyMetadata('application', appId));
    } finally {
      setPlanningLoading(false);
    }
  };

  useEffect(() => {
    loadPlanningMetadata();
  }, [appId]);

  useEffect(() => {
    setAppDraft({ ...app });
    setAppContextDraft({ ...app });
    setAppContextEditMode(false);
  }, [app]);

  useEffect(() => {
    const loadApmRefs = async () => {
      try {
        const [pRes, rRes] = await Promise.all([fetch('/api/application-portfolios'), fetch('/api/release-trains')]);
        const pData = await pRes.json().catch(() => ({}));
        const rData = await rRes.json().catch(() => ({}));
        setPortfolios(Array.isArray(pData?.items) ? pData.items : []);
        setReleaseTrains(Array.isArray(rData?.items) ? rData.items : []);
      } catch {
        setPortfolios([]);
        setReleaseTrains([]);
      }
    };
    loadApmRefs();
  }, []);

  useEffect(() => {
    if (activeTab !== 'dependencies') return;
    const loadDependencies = async () => {
      setDependenciesLoading(true);
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/dependencies`);
        const data = await res.json().catch(() => ({}));
        setDependencies(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setDependencies([]);
      } finally {
        setDependenciesLoading(false);
      }
    };
    loadDependencies();
  }, [activeTab, appId]);

  useEffect(() => {
    if (activeTab !== 'lifecycle') return;
    const loadLifecycle = async () => {
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/lifecycle`);
        const data = await res.json().catch(() => ({}));
        setLifecycle({
          lifecycleStage: data?.lifecycle?.lifecycleStage || appDraft.lifecycleStatus || 'ACTIVE',
          lifecycleOwner: data?.lifecycle?.lifecycleOwner || '',
          lifecycleNotes: data?.lifecycle?.lifecycleNotes || ''
        });
        setLifecycleInitial({
          lifecycleStage: data?.lifecycle?.lifecycleStage || appDraft.lifecycleStatus || 'ACTIVE',
          lifecycleOwner: data?.lifecycle?.lifecycleOwner || '',
          lifecycleNotes: data?.lifecycle?.lifecycleNotes || ''
        });
      } catch {
        setLifecycle({
          lifecycleStage: appDraft.lifecycleStatus || 'ACTIVE',
          lifecycleOwner: '',
          lifecycleNotes: ''
        });
        setLifecycleInitial({
          lifecycleStage: appDraft.lifecycleStatus || 'ACTIVE',
          lifecycleOwner: '',
          lifecycleNotes: ''
        });
      }
    };
    loadLifecycle();
  }, [activeTab, appId, appDraft.lifecycleStatus]);

  useEffect(() => {
    if (activeTab !== 'deliveryImpact') return;
    const loadImpact = async () => {
      setDeliveryImpactLoading(true);
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/delivery-impact`);
        const data = await res.json().catch(() => ({}));
        setDeliveryImpact(data || null);
      } catch {
        setDeliveryImpact(null);
      } finally {
        setDeliveryImpactLoading(false);
      }
    };
    loadImpact();
  }, [activeTab, appId]);

  useEffect(() => {
    if (activeTab !== 'environments') return;
    const loadStrategy = async () => {
      setEnvStrategyLoading(true);
      try {
        const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/environment-strategy`);
        const data = await res.json().catch(() => ({}));
        const strategy = data?.strategy || null;
        setEnvStrategy(strategy);
        setEnvStrategyDraft(strategy ? JSON.parse(JSON.stringify(strategy)) : null);
      } catch {
        setEnvStrategy(null);
        setEnvStrategyDraft(null);
      } finally {
        setEnvStrategyLoading(false);
      }
    };
    loadStrategy();
  }, [activeTab, appId]);

  useEffect(() => {
    if (scopeMode === 'bundle') {
      setEditMode(false);
      setDraft(null);
    }
  }, [scopeMode]);

  const startEdit = () => {
    if (scopeMode !== 'application') {
      setSaveError('Edit bundle schedule in the bundle profile.');
      return;
    }
    setSaveError(null);
    setDraft(JSON.parse(JSON.stringify(normalizeMetadata(appMetadata, 'application', appId))));
    setManualEndDates({});
    setManualActualDates({});
    setEditMode(true);
  };

  const cancelEdit = () => {
    setSaveError(null);
    setDraft(null);
    setManualEndDates({});
    setManualActualDates({});
    setEditMode(false);
  };

  const validateDraft = (data: ApplicationPlanningMetadata) => {
    const errors: string[] = [];
    (data.environments || []).forEach((env) => {
      if (env.startDate && env.endDate) {
        if (new Date(env.startDate).getTime() > new Date(env.endDate).getTime()) {
          errors.push(`${env.name} start date must be before end date.`);
        }
      }
      if (typeof env.durationDays === 'number' && env.durationDays <= 0) {
        errors.push(`${env.name} duration must be positive.`);
      }
      if (env.actualStart && env.actualEnd) {
        if (new Date(env.actualStart).getTime() > new Date(env.actualEnd).getTime()) {
          errors.push(`${env.name} actual start must be before end.`);
        }
      }
    });

    const positiveFields: Array<{ label: string; value?: number | null }> = [
      { label: 'Milestones', value: data.planningDefaults?.milestoneCount },
      { label: 'Sprint duration', value: data.planningDefaults?.sprintDurationWeeks },
      { label: 'Milestone duration', value: data.planningDefaults?.milestoneDurationWeeks },
      { label: 'Delivery teams', value: data.capacityDefaults?.deliveryTeams },
      { label: 'Velocity per team', value: data.capacityDefaults?.sprintVelocityPerTeam },
      { label: 'Direct sprint capacity', value: data.capacityDefaults?.directSprintCapacity },
      { label: 'Team size', value: data.capacityDefaults?.teamSize }
    ];

    positiveFields.forEach((field) => {
      if (typeof field.value === 'number' && field.value <= 0) {
        errors.push(`${field.label} must be positive.`);
      }
    });

    if (errors.length) return errors.join(' ');
    return null;
  };

  const saveDraft = async () => {
    if (!draft) return;
    const timelineDays = (() => {
      const dates = (draft.environments || []).reduce((acc: Date[], env) => {
        const start = parseIsoDate(env.startDate || null);
        const end = parseIsoDate(env.endDate || deriveEndDate(env.startDate || null, env.durationDays || null));
        if (start && end) {
          acc.push(start, end);
        }
        return acc;
      }, []);
      if (!dates.length) return null;
      const min = Math.min(...dates.map((d) => d.getTime()));
      const max = Math.max(...dates.map((d) => d.getTime()));
      const diff = (max - min) / (1000 * 60 * 60 * 24);
      return Math.max(1, Math.ceil(diff));
    })();

    const error = validateDraft(draft);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const milestoneCount = draft.planningDefaults?.milestoneCount;
      const derivedMilestoneDurationWeeks = timelineDays && milestoneCount ? Number((timelineDays / milestoneCount / 7).toFixed(2)) : null;
      const payload = {
        ...draft,
        planningDefaults: {
          ...(draft.planningDefaults || {}),
          milestoneDurationWeeks: derivedMilestoneDurationWeeks ?? draft.planningDefaults?.milestoneDurationWeeks ?? null
        }
      };
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/planning-metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planningMetadata: payload })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save planning metadata');
      }
      const data = await res.json();
      const bundleMeta = data?.bundleMetadata ? normalizeMetadata(data.bundleMetadata, 'bundle', bundleId || '') : (bundleId ? buildEmptyMetadata('bundle', bundleId) : null);
      const appMeta = normalizeMetadata(data?.applicationMetadata || null, 'application', appId);
      const resolved = normalizeMetadata(data?.resolvedMetadata || data?.planningMetadata || null, 'application', appId);
      setBundleMetadata(bundleMeta);
      setAppMetadata(appMeta);
      setResolvedMetadata(resolved);
      setEditMode(false);
      setDraft(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save planning metadata');
    } finally {
      setSaving(false);
    }
  };

  const updateEnvironment = (name: string, field: 'startDate' | 'durationDays' | 'endDate' | 'actualStart' | 'actualEnd', value: any) => {
    if (!editMode) return;
    setDraft((prev) => {
      const base = normalizeMetadata(prev, 'application', appId);
      const rows = base.environments || [];
      const next = rows.map((row) => {
        if (row.name !== name) return row;
        const updated: any = { ...row, [field]: value };
        if (field === 'actualStart' || field === 'actualEnd') {
          setManualActualDates((current) => ({ ...current, [name]: true }));
        }
        if (field === 'endDate') {
          setManualEndDates((current) => ({ ...current, [name]: true }));
          if (row.startDate && value) {
            updated.durationDays = calcDurationDays(row.startDate, value);
          }
        }
        if (field === 'startDate' || field === 'durationDays') {
          const manual = manualEndDates[name];
          if (!manual) {
            const derived = deriveEndDate(field === 'startDate' ? value : row.startDate, field === 'durationDays' ? value : row.durationDays);
            updated.endDate = derived;
          }
        }
        const endDate = updated.endDate || deriveEndDate(updated.startDate, updated.durationDays);
        const manualActual = manualActualDates[name];
        if (!manualActual && updated.startDate && endDate) {
          updated.actualStart = updated.startDate;
          updated.actualEnd = endDate;
        }
        return updated;
      });
      return { ...base, environments: next };
    });
  };

  const updatePlanningDefaults = (updates: Partial<NonNullable<ApplicationPlanningMetadata['planningDefaults']>>) => {
    if (!editMode) return;
    setDraft((prev) => ({
      ...(normalizeMetadata(prev, 'application', appId)),
      planningDefaults: {
        ...(prev?.planningDefaults || {}),
        ...updates
      }
    }));
  };

  const updateCapacityDefaults = (updates: Partial<NonNullable<ApplicationPlanningMetadata['capacityDefaults']>>) => {
    if (!editMode) return;
    setDraft((prev) => ({
      ...(normalizeMetadata(prev, 'application', appId)),
      capacityDefaults: {
        ...(prev?.capacityDefaults || {}),
        ...updates
      }
    }));
  };

  const updateGoLive = (updates: Partial<NonNullable<ApplicationPlanningMetadata['goLive']>>) => {
    if (!editMode) return;
    setDraft((prev) => ({
      ...(normalizeMetadata(prev, 'application', appId)),
      goLive: {
        ...(prev?.goLive || {}),
        ...updates
      }
    }));
  };

  const updateNotes = (value: string | null) => {
    if (!editMode) return;
    setDraft((prev) => ({
      ...(normalizeMetadata(prev, 'application', appId)),
      notes: value
    }));
  };

  const addEnvironment = (name: string) => {
    if (!editMode) return;
    setDraft((prev) => {
      const base = normalizeMetadata(prev, 'application', appId);
      const exists = (base.environments || []).some((row) => row.name === name);
      if (exists) return base;
      const next = [...(base.environments || []), { name, startDate: null, durationDays: null, endDate: null, actualStart: null, actualEnd: null }];
      return { ...base, environments: next };
    });
  };

  const currentMetadata = scopeMode === 'bundle'
    ? normalizeMetadata(bundleMetadata, 'bundle', bundleId || '')
    : normalizeMetadata(editMode ? draft : resolvedMetadata, 'application', appId);

  const derivedMilestoneWeeks = computeDerivedMilestoneWeeks(
    currentMetadata.environments || [],
    currentMetadata.planningDefaults?.milestoneCount || null
  );

  const appOverrideMetadata = normalizeMetadata(appMetadata, 'application', appId);
  const bundleBaseMetadata = normalizeMetadata(bundleMetadata, 'bundle', bundleId || '');

  const allEnvNames = Array.from(new Set([
    ...(bundleBaseMetadata.environments || []).map((row) => row.name),
    ...(appOverrideMetadata.environments || []).map((row) => row.name)
  ])).filter(Boolean);

  const inheritanceMap = allEnvNames.reduce((acc: any, envName) => {
    const bundleRow = bundleBaseMetadata.environments?.find((row) => row.name === envName);
    const appRow = appOverrideMetadata.environments?.find((row) => row.name === envName);
    acc[envName] = {
      startDate: isInheritedValue(appRow?.startDate, bundleRow?.startDate),
      durationDays: isInheritedValue(appRow?.durationDays, bundleRow?.durationDays),
      endDate: isInheritedValue(appRow?.endDate, bundleRow?.endDate),
      actualStart: isInheritedValue(appRow?.actualStart, bundleRow?.actualStart),
      actualEnd: isInheritedValue(appRow?.actualEnd, bundleRow?.actualEnd)
    };
    return acc;
  }, {});

  const isInheritedValue = (appValue: any, bundleValue: any) => {
    if (appValue === null || typeof appValue === 'undefined' || appValue === '') {
      return Boolean(bundleValue);
    }
    return false;
  };

  const goLiveInherited = {
    planned: isInheritedValue(appOverrideMetadata.goLive?.planned, bundleBaseMetadata.goLive?.planned),
    actual: isInheritedValue(appOverrideMetadata.goLive?.actual, bundleBaseMetadata.goLive?.actual)
  };

  const defaultsInheritance = {
    planningDefaults: {
      milestoneCount: isInheritedValue(appOverrideMetadata.planningDefaults?.milestoneCount, bundleBaseMetadata.planningDefaults?.milestoneCount),
      sprintDurationWeeks: isInheritedValue(appOverrideMetadata.planningDefaults?.sprintDurationWeeks, bundleBaseMetadata.planningDefaults?.sprintDurationWeeks),
      milestoneDurationWeeks: isInheritedValue(appOverrideMetadata.planningDefaults?.milestoneDurationWeeks, bundleBaseMetadata.planningDefaults?.milestoneDurationWeeks)
    },
    capacityDefaults: {
      capacityModel: isInheritedValue(appOverrideMetadata.capacityDefaults?.capacityModel, bundleBaseMetadata.capacityDefaults?.capacityModel),
      deliveryTeams: isInheritedValue(appOverrideMetadata.capacityDefaults?.deliveryTeams, bundleBaseMetadata.capacityDefaults?.deliveryTeams),
      sprintVelocityPerTeam: isInheritedValue(appOverrideMetadata.capacityDefaults?.sprintVelocityPerTeam, bundleBaseMetadata.capacityDefaults?.sprintVelocityPerTeam),
      directSprintCapacity: isInheritedValue(appOverrideMetadata.capacityDefaults?.directSprintCapacity, bundleBaseMetadata.capacityDefaults?.directSprintCapacity),
      teamSize: isInheritedValue(appOverrideMetadata.capacityDefaults?.teamSize, bundleBaseMetadata.capacityDefaults?.teamSize),
      projectSize: isInheritedValue(appOverrideMetadata.capacityDefaults?.projectSize, bundleBaseMetadata.capacityDefaults?.projectSize)
    },
    notes: isInheritedValue(appOverrideMetadata.notes, bundleBaseMetadata.notes)
  };

  const renderInherited = (flag: boolean) => flag ? <span className="text-[9px] uppercase tracking-widest text-slate-400">inherited</span> : null;

  const saveApplicationProfile = async () => {
    if (!appContextEditMode) return;
    setSavingApp(true);
    setAppSaveError(null);
    try {
      const payload = { ...appDraft, ...appContextDraft };
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save application profile');
      const next = data || payload;
      setAppDraft(next);
      setAppContextDraft(next);
      setAppContextEditMode(false);
    } catch (err: any) {
      setAppSaveError(err?.message || 'Failed to save application profile');
    } finally {
      setSavingApp(false);
    }
  };

  const addDependency = async () => {
    if (!dependencyForm.targetApplicationId) return;
    const res = await fetch('/api/application-dependencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceApplicationId: appId,
        targetApplicationId: dependencyForm.targetApplicationId,
        dependencyType: dependencyForm.dependencyType,
        criticality: dependencyForm.criticality
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAppSaveError(data?.error || 'Failed to create dependency');
      return;
    }
    setAppSaveError(null);
    setDependencyForm((prev) => ({ ...prev, targetApplicationId: '' }));
    const refresh = await fetch(`/api/applications/${encodeURIComponent(appId)}/dependencies`);
    const next = await refresh.json().catch(() => ({}));
    setDependencies(Array.isArray(next?.items) ? next.items : []);
  };

  const removeDependency = async (id: string) => {
    const res = await fetch(`/api/application-dependencies/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) return;
    setDependencies((prev) => prev.filter((entry) => String(entry?._id) !== String(id)));
  };

  const saveLifecycle = async () => {
    setLifecycleSaving(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/lifecycle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lifecycle)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save lifecycle');
      setLifecycle(data?.lifecycle || lifecycle);
      setLifecycleInitial(data?.lifecycle || lifecycle);
      setAppDraft((prev: any) => ({ ...prev, lifecycleStatus: data?.lifecycle?.lifecycleStage || prev.lifecycleStatus }));
      setAppContextDraft((prev: any) => ({ ...prev, lifecycleStatus: data?.lifecycle?.lifecycleStage || prev.lifecycleStatus }));
      setAppSaveError(null);
      setLifecycleEditMode(false);
    } catch (err: any) {
      setAppSaveError(err?.message || 'Failed to save lifecycle');
    } finally {
      setLifecycleSaving(false);
    }
  };

  const updateEnvStrategyRow = (index: number, field: 'name' | 'order' | 'description', value: string | number) => {
    setEnvStrategyDraft((prev: any) => {
      if (!prev) return prev;
      const rows = Array.isArray(prev.environments) ? [...prev.environments] : [];
      if (!rows[index]) return prev;
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, environments: rows };
    });
  };

  const addEnvStrategyRow = () => {
    setEnvStrategyDraft((prev: any) => {
      const rows = Array.isArray(prev?.environments) ? [...prev.environments] : [];
      rows.push({ name: '', order: rows.length + 1, description: '' });
      return { ...(prev || { applicationId: appId }), environments: rows };
    });
  };

  const saveEnvStrategy = async () => {
    if (!envStrategyDraft) return;
    setEnvStrategySaving(true);
    try {
      const cleaned = {
        environments: (envStrategyDraft.environments || [])
          .map((row: any, idx: number) => ({
            name: String(row?.name || '').toUpperCase(),
            order: Number(row?.order || idx + 1),
            description: row?.description ? String(row.description) : undefined
          }))
          .filter((row: any) => row.name)
      };
      const res = await fetch(`/api/applications/${encodeURIComponent(appId)}/environment-strategy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save environment strategy');
      setEnvStrategy(data?.strategy || cleaned);
      setEnvStrategyDraft(data?.strategy || cleaned);
      setAppSaveError(null);
    } catch (err: any) {
      setAppSaveError(err?.message || 'Failed to save environment strategy');
    } finally {
      setEnvStrategySaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Detail</div>
          <h2 className="text-3xl font-black text-slate-900">{appDraft.name || app.name}</h2>
          <div className="text-sm text-slate-500 mt-1">App ID: {appDraft.aid || app.aid || '—'} • Bundle: {bundleName}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700">
              {String(appDraft.lifecycleStatus || 'ACTIVE')}
            </span>
            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700">
              {(appDraft.businessCriticality || 'MEDIUM')}
            </span>
            {(appDraft.releaseTrain || '').trim() && (
              <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
                {appDraft.releaseTrain}
              </span>
            )}
          </div>
        </div>
        <button onClick={onOpenBundle} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">
          Open Bundle Profile
        </button>
      </div>

      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'environments', label: 'Environments' },
          { id: 'dependencies', label: 'Dependencies' },
          { id: 'lifecycle', label: 'Lifecycle' },
          { id: 'deliveryImpact', label: 'Delivery Impact' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'overview' | 'environments' | 'dependencies' | 'lifecycle' | 'deliveryImpact')}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bundle</div>
              <div className="text-lg font-black text-slate-800">{bundleName}</div>
              <div className="text-xs text-slate-500 mt-2">Status: {profile?.status?.replace('_', ' ') || 'unknown'}</div>
              <div className="text-xs text-slate-500 mt-1">Current milestone: {current?.name || '—'}</div>
              <div className="text-xs text-slate-500 mt-1">Planned Go-live: {profile?.schedule?.goLivePlanned ? new Date(profile.schedule.goLivePlanned).toLocaleDateString() : '—'}</div>
              <div className="text-xs text-slate-500 mt-1">Actual Go-live: {profile?.schedule?.goLiveActual ? new Date(profile.schedule.goLiveActual).toLocaleDateString() : '—'}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Ownership</div>
              <div className="text-sm text-slate-600">Vendor Lead: <span className="font-semibold text-slate-800">{owners.vendorLead}</span></div>
              <div className="text-sm text-slate-600 mt-2">Engineering Owner: <span className="font-semibold text-slate-800">{owners.engineeringOwner}</span></div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bundle Schedule Summary</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
              <div>UAT Planned: {profile?.schedule?.uatPlannedStart ? new Date(profile.schedule.uatPlannedStart).toLocaleDateString() : '—'} → {profile?.schedule?.uatPlannedEnd ? new Date(profile.schedule.uatPlannedEnd).toLocaleDateString() : '—'}</div>
              <div>UAT Actual: {profile?.schedule?.uatActualStart ? new Date(profile.schedule.uatActualStart).toLocaleDateString() : '—'} → {profile?.schedule?.uatActualEnd ? new Date(profile.schedule.uatActualEnd).toLocaleDateString() : '—'}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Context</div>
                <div className="text-xs text-slate-500">Portfolio, ownership, criticality, lifecycle, and release train metadata.</div>
              </div>
              {!appContextEditMode && (
                <button
                  onClick={() => {
                    setAppContextDraft({ ...appDraft });
                    setAppContextEditMode(true);
                  }}
                  className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                >
                  Edit
                </button>
              )}
              {appContextEditMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveApplicationProfile}
                    disabled={savingApp}
                    className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-60"
                  >
                    {savingApp ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setAppContextDraft({ ...appDraft });
                      setAppContextEditMode(false);
                      setAppSaveError(null);
                    }}
                    disabled={savingApp}
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {appSaveError && <div className="text-xs text-rose-500">{appSaveError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
              <label className="space-y-1">Portfolio
                <select value={appContextDraft.portfolioId || ''} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, portfolioId: e.target.value || undefined }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">Unassigned</option>
                  {portfolios.map((p) => <option key={String(p?._id)} value={String(p?._id)}>{p?.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">Release Train
                <select value={appContextDraft.releaseTrain || ''} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, releaseTrain: e.target.value || undefined }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">Unassigned</option>
                  {releaseTrains.map((train) => <option key={String(train?._id)} value={train?.name}>{train?.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">Lifecycle Status
                <select value={appContextDraft.lifecycleStatus || 'ACTIVE'} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, lifecycleStatus: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  {['ACTIVE', 'MAINTENANCE', 'SUNSETTING', 'RETIRED'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">Business Criticality
                <select value={appContextDraft.businessCriticality || 'MEDIUM'} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, businessCriticality: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">Availability Tier
                <select value={appContextDraft.availabilityTier || 'TIER3'} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, availabilityTier: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  {['TIER1', 'TIER2', 'TIER3', 'TIER4'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">Data Sensitivity
                <select value={appContextDraft.dataSensitivity || 'INTERNAL'} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, dataSensitivity: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                  {['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1">Operational Owner
                <input value={appContextDraft.operationalOwner || ''} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, operationalOwner: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400" />
              </label>
              <label className="space-y-1">Business Owner
                <input value={appContextDraft.businessOwner || ''} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, businessOwner: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400" />
              </label>
              <label className="space-y-1">Technical Owner
                <input value={appContextDraft.technicalOwner || ''} onChange={(e) => setAppContextDraft((prev: any) => ({ ...prev, technicalOwner: e.target.value }))} disabled={!appContextEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400" />
              </label>
            </div>
          </div>
        </>
      )}

      {activeTab === 'environments' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Strategy</div>
                <div className="text-xs text-slate-500">Application-level deployment environment order and descriptions.</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addEnvStrategyRow} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600">Add Environment</button>
                <button onClick={saveEnvStrategy} disabled={envStrategySaving} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-60">
                  {envStrategySaving ? 'Saving...' : 'Save Strategy'}
                </button>
              </div>
            </div>
            {envStrategyLoading && <div className="text-xs text-slate-400">Loading environment strategy...</div>}
            {!envStrategyLoading && (
              <div className="space-y-2">
                {(envStrategyDraft?.environments || []).map((row: any, idx: number) => (
                  <div key={`${row?.name || 'env'}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <input
                      value={row?.name || ''}
                      onChange={(e) => updateEnvStrategyRow(idx, 'name', e.target.value)}
                      placeholder="Environment name"
                      className="md:col-span-3 border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      value={Number(row?.order || idx + 1)}
                      onChange={(e) => updateEnvStrategyRow(idx, 'order', Number(e.target.value) || idx + 1)}
                      className="md:col-span-2 border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                    <input
                      value={row?.description || ''}
                      onChange={(e) => updateEnvStrategyRow(idx, 'description', e.target.value)}
                      placeholder="Description (optional)"
                      className="md:col-span-7 border border-slate-200 rounded-lg px-2 py-2 text-xs"
                    />
                  </div>
                ))}
                {(envStrategyDraft?.environments || []).length === 0 && (
                  <div className="text-xs text-slate-400">No environment strategy rows yet.</div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule Metadata</div>
                <ScheduleScopeSelector
                  scope={scopeMode}
                  bundleName={bundleName}
                  appName={app.name}
                  onChange={setScopeMode}
                />
              </div>
              {!editMode && scopeMode === 'application' && (
                <button onClick={startEdit} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                  Edit
                </button>
              )}
              {editMode && (
                <div className="flex items-center gap-2">
                  <button onClick={saveDraft} disabled={saving} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600">
                    Cancel
                  </button>
                </div>
              )}
            </div>
            {planningLoading && <div className="text-xs text-slate-400">Loading planning metadata...</div>}
            {planningError && <div className="text-xs text-rose-500">{planningError}</div>}
            {saveError && <div className="text-xs text-rose-500">{saveError}</div>}
            {scopeMode === 'bundle' && (
              <div className="text-xs text-slate-500">Bundle schedule is view-only here. Edit in the bundle profile.</div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Schedule</div>
            <ScheduleEnvironmentGrid
              environments={currentMetadata.environments || []}
              editable={editMode}
              onFieldChange={updateEnvironment}
              onAddEnvironment={addEnvironment}
              inheritance={scopeMode === 'application' ? inheritanceMap : undefined}
              suggestions={ENVIRONMENT_SUGGESTIONS}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Go-Live / Business Cutover</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <label className="space-y-1">Go-Live Planned
                {editMode ? (
                  <input type="date" value={currentMetadata.goLive?.planned || ''} onChange={(e) => updateGoLive({ planned: e.target.value || null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                ) : (
                  <div className="text-slate-700">{currentMetadata.goLive?.planned ? new Date(currentMetadata.goLive.planned).toLocaleDateString() : '—'} {scopeMode === 'application' && renderInherited(goLiveInherited.planned)}</div>
                )}
              </label>
              <label className="space-y-1">Go-Live Actual
                {editMode ? (
                  <input type="date" value={currentMetadata.goLive?.actual || ''} onChange={(e) => updateGoLive({ actual: e.target.value || null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                ) : (
                  <div className="text-slate-700">{currentMetadata.goLive?.actual ? new Date(currentMetadata.goLive.actual).toLocaleDateString() : '—'} {scopeMode === 'application' && renderInherited(goLiveInherited.actual)}</div>
                )}
              </label>
            </div>
          </div>

          <ScheduleDefaultsPanel
            metadata={currentMetadata}
            editable={editMode}
            onPlanningDefaultsChange={updatePlanningDefaults}
            onCapacityDefaultsChange={updateCapacityDefaults}
            onNotesChange={updateNotes}
            inheritance={scopeMode === 'application' ? defaultsInheritance : undefined}
            derivedMilestoneDurationWeeks={derivedMilestoneWeeks}
          />
        </div>
      )}

      {activeTab === 'dependencies' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cross-Application Dependencies</div>
            {appSaveError && <div className="text-xs text-rose-500">{appSaveError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select value={dependencyForm.targetApplicationId} onChange={(e) => setDependencyForm((prev) => ({ ...prev, targetApplicationId: e.target.value }))} className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <option value="">Select target application</option>
                {applications.filter((entry) => String(entry._id || entry.id || entry.aid) !== appId).map((entry) => (
                  <option key={String(entry._id || entry.id || entry.aid)} value={String(entry._id || entry.id || entry.aid)}>{entry.name}</option>
                ))}
              </select>
              <select value={dependencyForm.dependencyType} onChange={(e) => setDependencyForm((prev) => ({ ...prev, dependencyType: e.target.value }))} className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
                {['API', 'DATA', 'EVENT', 'SHARED_INFRA'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select value={dependencyForm.criticality} onChange={(e) => setDependencyForm((prev) => ({ ...prev, criticality: e.target.value }))} className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <button onClick={addDependency} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                Add Dependency
              </button>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Direction</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-left">Target</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Criticality</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {dependenciesLoading && (
                  <tr><td className="px-4 py-4 text-slate-400" colSpan={7}>Loading dependencies...</td></tr>
                )}
                {!dependenciesLoading && dependencies.map((dep) => {
                  const isOutbound = String(dep?.sourceApplicationId) === appId;
                  return (
                    <tr key={String(dep?._id)} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{isOutbound ? 'Outbound' : 'Inbound'}</td>
                      <td className="px-4 py-2 text-slate-700">{dep?.sourceApplication?.name || dep?.sourceApplicationId}</td>
                      <td className="px-4 py-2 text-slate-700">{dep?.targetApplication?.name || dep?.targetApplicationId}</td>
                      <td className="px-4 py-2 text-slate-500">{dep?.dependencyType}</td>
                      <td className="px-4 py-2 text-slate-500">{dep?.criticality || 'MEDIUM'}</td>
                      <td className="px-4 py-2 text-slate-400">{dep?.updatedAt ? new Date(dep.updatedAt).toLocaleDateString() : (dep?.createdAt ? new Date(dep.createdAt).toLocaleDateString() : '—')}</td>
                      <td className="px-4 py-2">
                        {isOutbound ? (
                          <button onClick={() => removeDependency(String(dep?._id))} className="text-[10px] font-black uppercase tracking-widest text-rose-600">Delete</button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!dependenciesLoading && dependencies.length === 0 && (
                  <tr><td className="px-4 py-4 text-slate-400" colSpan={7}>No dependencies configured yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'lifecycle' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lifecycle Management</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
            <label className="space-y-1">Lifecycle Stage
              <select value={lifecycle.lifecycleStage || 'ACTIVE'} onChange={(e) => setLifecycle((prev: any) => ({ ...prev, lifecycleStage: e.target.value }))} disabled={!lifecycleEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400">
                {[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'MAINTENANCE', label: 'Maintenance' },
                  { value: 'SUNSETTING', label: 'Sunsetting' },
                  { value: 'RETIRED', label: 'Retired' }
                ].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">Lifecycle Owner
              <input value={lifecycle.lifecycleOwner || ''} onChange={(e) => setLifecycle((prev: any) => ({ ...prev, lifecycleOwner: e.target.value }))} disabled={!lifecycleEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400" />
            </label>
            <label className="space-y-1">Notes
              <input value={lifecycle.lifecycleNotes || ''} onChange={(e) => setLifecycle((prev: any) => ({ ...prev, lifecycleNotes: e.target.value }))} disabled={!lifecycleEditMode} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs disabled:bg-slate-50 disabled:text-slate-400" />
            </label>
          </div>
          {!lifecycleEditMode && (
            <button onClick={() => setLifecycleEditMode(true)} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
              Edit
            </button>
          )}
          {lifecycleEditMode && (
            <div className="flex items-center gap-2">
              <button onClick={saveLifecycle} disabled={lifecycleSaving} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-60">
                {lifecycleSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setLifecycle({ ...lifecycleInitial });
                  setLifecycleEditMode(false);
                  setAppSaveError(null);
                }}
                disabled={lifecycleSaving}
                className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deliveryImpact' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Cross-Application Delivery Impact</div>
            {deliveryImpactLoading && <div className="text-sm text-slate-400">Loading impact model...</div>}
            {!deliveryImpactLoading && deliveryImpact && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Outbound deps', value: deliveryImpact?.summary?.outboundDependencies || 0 },
                  { label: 'Inbound deps', value: deliveryImpact?.summary?.inboundDependencies || 0 },
                  { label: 'Connected apps', value: deliveryImpact?.summary?.connectedApplications || 0 },
                  { label: 'Shared train apps', value: deliveryImpact?.summary?.sharedReleaseTrainApplications || 0 },
                  { label: 'Impacted milestones', value: deliveryImpact?.summary?.impactedMilestones || 0 },
                  { label: 'Related work items', value: deliveryImpact?.summary?.relatedWorkItems || 0 }
                ].map((chip) => (
                  <div key={chip.label} className="border border-slate-100 rounded-xl p-3">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{chip.label}</div>
                    <div className="text-lg font-black text-slate-800">{chip.value}</div>
                  </div>
                ))}
              </div>
            )}
            {!deliveryImpactLoading && !deliveryImpact && (
              <div className="text-sm text-slate-400">No delivery impact data available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const BundleProfileView: React.FC<{
  bundleId: string;
  bundleName: string;
  assignments: BundleAssignment[];
  applications: Application[];
  health: any | null;
  onOpenApp: (appId: string) => void;
  onAddRisk: () => void;
  onAddDependency: () => void;
}> = ({ bundleId, bundleName, assignments, applications, health, onOpenApp, onAddRisk, onAddDependency }) => {
  const router = useRouter();
  const [profile, setProfile] = useState<BundleProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'environments' | 'ownership' | 'dependencies' | 'lifecycle' | 'deliveryImpact' | 'notes'>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [briefWeek, setBriefWeek] = useState('');
  const [brief, setBrief] = useState<any | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [scheduleMetadata, setScheduleMetadata] = useState<ApplicationPlanningMetadata | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleEditMode, setScheduleEditMode] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ApplicationPlanningMetadata | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaveError, setScheduleSaveError] = useState<string | null>(null);
  const [scheduleManualEndDates, setScheduleManualEndDates] = useState<Record<string, boolean>>({});
  const [scheduleManualActualDates, setScheduleManualActualDates] = useState<Record<string, boolean>>({});
  const [bundleDependencyCountByApp, setBundleDependencyCountByApp] = useState<Record<string, number>>({});

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bundles/${encodeURIComponent(bundleId)}/profile`);
      const data = await res.json();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const ensureScheduleRows = (rows?: any[]) => {
    const seen = new Set<string>();
    const normalized: any[] = [];
    (rows || []).forEach((row) => {
      if (!row?.name) return;
      const name = String(row.name).toUpperCase();
      if (seen.has(name)) return;
      seen.add(name);
      normalized.push({ ...row, name });
    });
    return normalized;
  };

  const buildEmptySchedule = (): ApplicationPlanningMetadata => ({
    scopeType: 'bundle',
    scopeId: String(bundleId),
    bundleId: String(bundleId),
    environments: ensureScheduleRows([]),
    goLive: { planned: null, actual: null },
    planningDefaults: { milestoneCount: null, sprintDurationWeeks: null, milestoneDurationWeeks: null },
    capacityDefaults: { capacityModel: null, deliveryTeams: null, sprintVelocityPerTeam: null, directSprintCapacity: null, teamSize: null, projectSize: null },
    notes: null
  });

  const normalizeSchedule = (data?: ApplicationPlanningMetadata | null): ApplicationPlanningMetadata => ({
    ...buildEmptySchedule(),
    ...(data || {}),
    environments: ensureScheduleRows(data?.environments || []).map((row) => ({
      ...row,
      endDate: row.endDate || deriveEndDate(row.startDate || null, row.durationDays || null),
      durationDays: typeof row.durationDays === 'number' ? row.durationDays : calcDurationDays(row.startDate || null, row.endDate || null)
    })),
    goLive: data?.goLive || { planned: null, actual: null },
    planningDefaults: data?.planningDefaults || { milestoneCount: null, sprintDurationWeeks: null, milestoneDurationWeeks: null },
    capacityDefaults: data?.capacityDefaults || { capacityModel: null, deliveryTeams: null, sprintVelocityPerTeam: null, directSprintCapacity: null, teamSize: null, projectSize: null }
  });

  const loadScheduleMetadata = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await fetch(`/api/applications/planning-metadata?scopeType=bundle&scopeId=${encodeURIComponent(bundleId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load schedule metadata');
      }
      const data = await res.json();
      setScheduleMetadata(normalizeSchedule(data?.planningMetadata || null));
    } catch (err: any) {
      setScheduleError(err?.message || 'Failed to load schedule metadata');
      setScheduleMetadata(buildEmptySchedule());
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [bundleId]);

  useEffect(() => {
    loadScheduleMetadata();
  }, [bundleId]);

  useEffect(() => {
    const loadDependencyCounts = async () => {
      try {
        const res = await fetch('/api/application-dependencies');
        const data = await res.json().catch(() => ({}));
        const deps = Array.isArray(data?.items) ? data.items : [];
        const counts: Record<string, number> = {};
        deps.forEach((dep: any) => {
          const source = String(dep?.sourceApplicationId || '');
          const target = String(dep?.targetApplicationId || '');
          if (source) counts[source] = (counts[source] || 0) + 1;
          if (target) counts[target] = (counts[target] || 0) + 1;
        });
        setBundleDependencyCountByApp(counts);
      } catch {
        setBundleDependencyCountByApp({});
      }
    };
    loadDependencyCounts();
  }, [bundleId]);

  useEffect(() => {
    const loadWatch = async () => {
      try {
        const res = await fetch('/api/watchers?scopeType=BUNDLE');
        if (!res.ok) return;
        const data = await res.json();
        const match = (data?.items || []).some((w: any) => String(w.scopeId) === String(bundleId));
        setIsWatching(Boolean(match));
      } catch {
        setIsWatching(false);
      }
    };
    loadWatch();
  }, [bundleId]);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const [meRes, adminRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/admin/check')]);
        const meData = await meRes.json();
        const adminData = await adminRes.json();
        setUser(meData?.user || null);
        setIsAdmin(Boolean(adminData?.isAdmin));
      } catch {
        setUser(null);
        setIsAdmin(false);
      }
    };
    loadAuth();
  }, []);

  useEffect(() => {
    setCanEdit(canEditBundleProfileClient(user, isAdmin));
  }, [user, isAdmin]);

  const updateProfile = (updates: Partial<BundleProfile>) => {
    if (!profile) return;
    setProfile({ ...profile, ...updates });
  };

  const startScheduleEdit = () => {
    if (!canEdit) {
      setScheduleSaveError('You do not have permission to edit bundle schedule metadata.');
      return;
    }
    setScheduleSaveError(null);
    setScheduleDraft(JSON.parse(JSON.stringify(normalizeSchedule(scheduleMetadata))));
    setScheduleManualEndDates({});
    setScheduleManualActualDates({});
    setScheduleEditMode(true);
  };

  const cancelScheduleEdit = () => {
    setScheduleSaveError(null);
    setScheduleDraft(null);
    setScheduleManualEndDates({});
    setScheduleManualActualDates({});
    setScheduleEditMode(false);
  };

  const validateScheduleDraft = (data: ApplicationPlanningMetadata) => {
    const errors: string[] = [];
    (data.environments || []).forEach((env) => {
      if (env.startDate && env.endDate) {
        if (new Date(env.startDate).getTime() > new Date(env.endDate).getTime()) {
          errors.push(`${env.name} start date must be before end date.`);
        }
      }
      if (typeof env.durationDays === 'number' && env.durationDays <= 0) {
        errors.push(`${env.name} duration must be positive.`);
      }
      if (env.actualStart && env.actualEnd) {
        if (new Date(env.actualStart).getTime() > new Date(env.actualEnd).getTime()) {
          errors.push(`${env.name} actual start must be before end.`);
        }
      }
    });
    const positiveFields: Array<{ label: string; value?: number | null }> = [
      { label: 'Milestones', value: data.planningDefaults?.milestoneCount },
      { label: 'Sprint duration', value: data.planningDefaults?.sprintDurationWeeks },
      { label: 'Milestone duration', value: data.planningDefaults?.milestoneDurationWeeks },
      { label: 'Delivery teams', value: data.capacityDefaults?.deliveryTeams },
      { label: 'Velocity per team', value: data.capacityDefaults?.sprintVelocityPerTeam },
      { label: 'Direct sprint capacity', value: data.capacityDefaults?.directSprintCapacity },
      { label: 'Team size', value: data.capacityDefaults?.teamSize }
    ];
    positiveFields.forEach((field) => {
      if (typeof field.value === 'number' && field.value <= 0) {
        errors.push(`${field.label} must be positive.`);
      }
    });
    if (errors.length) return errors.join(' ');
    return null;
  };

  const saveScheduleDraft = async () => {
    if (!scheduleDraft) return;
    const timelineDays = (() => {
      const dates = (scheduleDraft.environments || []).reduce((acc: Date[], env) => {
        const start = parseIsoDate(env.startDate || null);
        const end = parseIsoDate(env.endDate || deriveEndDate(env.startDate || null, env.durationDays || null));
        if (start && end) {
          acc.push(start, end);
        }
        return acc;
      }, []);
      if (!dates.length) return null;
      const min = Math.min(...dates.map((d) => d.getTime()));
      const max = Math.max(...dates.map((d) => d.getTime()));
      const diff = (max - min) / (1000 * 60 * 60 * 24);
      return Math.max(1, Math.ceil(diff));
    })();

    const error = validateScheduleDraft(scheduleDraft);
    if (error) {
      setScheduleSaveError(error);
      return;
    }
    setScheduleSaving(true);
    setScheduleSaveError(null);
    try {
      const milestoneCount = scheduleDraft.planningDefaults?.milestoneCount;
      const derivedMilestoneDurationWeeks = timelineDays && milestoneCount ? Number((timelineDays / milestoneCount / 7).toFixed(2)) : null;
      const payload = {
        ...scheduleDraft,
        planningDefaults: {
          ...(scheduleDraft.planningDefaults || {}),
          milestoneDurationWeeks: derivedMilestoneDurationWeeks ?? scheduleDraft.planningDefaults?.milestoneDurationWeeks ?? null
        }
      };
      const res = await fetch('/api/applications/planning-metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          scopeType: 'bundle',
          scopeId: String(bundleId),
          bundleId: String(bundleId)
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save schedule metadata');
      }
      const data = await res.json();
      setScheduleMetadata(normalizeSchedule(data?.planningMetadata || null));
      setScheduleEditMode(false);
      setScheduleDraft(null);
    } catch (err: any) {
      setScheduleSaveError(err?.message || 'Failed to save schedule metadata');
    } finally {
      setScheduleSaving(false);
    }
  };

  const updateScheduleEnvironment = (name: string, field: 'startDate' | 'durationDays' | 'endDate' | 'actualStart' | 'actualEnd', value: any) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => {
      const base = normalizeSchedule(prev);
      const next = (base.environments || []).map((row) => {
        if (row.name !== name) return row;
        const updated: any = { ...row, [field]: value };
        if (field === 'actualStart' || field === 'actualEnd') {
          setScheduleManualActualDates((current) => ({ ...current, [name]: true }));
        }
        if (field === 'endDate') {
          setScheduleManualEndDates((current) => ({ ...current, [name]: true }));
          if (row.startDate && value) {
            updated.durationDays = calcDurationDays(row.startDate, value);
          }
        }
        if (field === 'startDate' || field === 'durationDays') {
          const manual = scheduleManualEndDates[name];
          if (!manual) {
            const derived = deriveEndDate(field === 'startDate' ? value : row.startDate, field === 'durationDays' ? value : row.durationDays);
            updated.endDate = derived;
          }
        }
        const endDate = updated.endDate || deriveEndDate(updated.startDate, updated.durationDays);
        const manualActual = scheduleManualActualDates[name];
        if (!manualActual && updated.startDate && endDate) {
          updated.actualStart = updated.startDate;
          updated.actualEnd = endDate;
        }
        return updated;
      });
      return { ...base, environments: next };
    });
  };

  const addScheduleEnvironment = (name: string) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => {
      const base = normalizeSchedule(prev);
      const exists = (base.environments || []).some((row) => row.name === name);
      if (exists) return base;
      const next = [...(base.environments || []), { name, startDate: null, durationDays: null, endDate: null, actualStart: null, actualEnd: null }];
      return { ...base, environments: next };
    });
  };

  const updateSchedulePlanningDefaults = (updates: Partial<NonNullable<ApplicationPlanningMetadata['planningDefaults']>>) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => ({
      ...(normalizeSchedule(prev)),
      planningDefaults: {
        ...(prev?.planningDefaults || {}),
        ...updates
      }
    }));
  };

  const updateScheduleCapacityDefaults = (updates: Partial<NonNullable<ApplicationPlanningMetadata['capacityDefaults']>>) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => ({
      ...(normalizeSchedule(prev)),
      capacityDefaults: {
        ...(prev?.capacityDefaults || {}),
        ...updates
      }
    }));
  };

  const updateScheduleGoLive = (updates: Partial<NonNullable<ApplicationPlanningMetadata['goLive']>>) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => ({
      ...(normalizeSchedule(prev)),
      goLive: {
        ...(prev?.goLive || {}),
        ...updates
      }
    }));
  };

  const updateScheduleNotes = (value: string | null) => {
    if (!scheduleEditMode) return;
    setScheduleDraft((prev) => ({
      ...(normalizeSchedule(prev)),
      notes: value
    }));
  };

  const toggleBundleWatch = async () => {
    try {
      const res = await fetch('/api/watchers', {
        method: isWatching ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType: 'BUNDLE', scopeId: bundleId })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWatchMessage(data?.error || 'Failed to update watch');
        return;
      }
      setIsWatching(!isWatching);
      setWatchMessage(isWatching ? 'Bundle un-watched.' : 'Bundle watched.');
      setTimeout(() => setWatchMessage(null), 2000);
    } catch (err: any) {
      setWatchMessage(err?.message || 'Failed to update watch');
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bundles/${encodeURIComponent(bundleId)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } finally {
      setSaving(false);
    }
  };

  const vendorLeads = assignments.filter((a) => a.assignmentType === 'svp');
  const engineeringOwners = assignments.filter((a) => a.assignmentType === 'bundle_owner');

  const appsInBundle = useMemo(() => {
    return applications.filter((a) => String(a.bundleId) === String(bundleId));
  }, [applications, bundleId]);

  const scheduleCurrent = normalizeSchedule(scheduleEditMode ? scheduleDraft : scheduleMetadata);
  const scheduleDerivedMilestoneWeeks = computeDerivedMilestoneWeeks(
    scheduleCurrent.environments || [],
    scheduleCurrent.planningDefaults?.milestoneCount || null
  );

  const [riskItems, setRiskItems] = useState<WorkItem[]>([]);
  const [depsItems, setDepsItems] = useState<WorkItem[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [appDependencyItems, setAppDependencyItems] = useState<any[]>([]);
  const [appDependencyLoading, setAppDependencyLoading] = useState(false);
  const [appLifecycleById, setAppLifecycleById] = useState<Record<string, any>>({});
  const [bundleImpactByAppId, setBundleImpactByAppId] = useState<Record<string, any>>({});
  const [bundleImpactLoading, setBundleImpactLoading] = useState(false);
  const [localHealth, setLocalHealth] = useState<any | null>(health);
  const [programIntel, setProgramIntel] = useState<any | null>(null);
  const [programLists, setProgramLists] = useState<any | null>(null);
  const [intelModal, setIntelModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchMessage, setWatchMessage] = useState<string | null>(null);
  const isGuestUser = String(user?.accountType || '').toUpperCase() === 'GUEST';

  useEffect(() => {
    if (activeTab !== 'dependencies') return;
    const loadRisks = async () => {
      setRiskLoading(true);
      try {
        const res = await fetch(`/api/work-items?bundleId=${encodeURIComponent(bundleId)}&types=${encodeURIComponent('RISK,DEPENDENCY')}`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        setRiskItems(items.filter((i: WorkItem) => i.type === WorkItemType.RISK));
        setDepsItems(items.filter((i: WorkItem) => i.type === WorkItemType.DEPENDENCY));
      } catch {
        setRiskItems([]);
        setDepsItems([]);
      } finally {
        setRiskLoading(false);
      }
    };
    loadRisks();
  }, [activeTab, bundleId]);

  useEffect(() => {
    if (health) {
      setLocalHealth(health);
      return;
    }
    const loadHealth = async () => {
      try {
        const res = await fetch(`/api/bundles/health?bundleIds=${encodeURIComponent(bundleId)}`);
        const data = await res.json();
        const row = Array.isArray(data?.bundles) ? data.bundles.find((b: any) => String(b.bundleId) === String(bundleId)) : null;
        setLocalHealth(row || null);
      } catch {
        setLocalHealth(null);
      }
    };
    loadHealth();
  }, [health, bundleId]);

  useEffect(() => {
    const loadIntel = async () => {
      try {
        const res = await fetch(`/api/program/intel?bundleIds=${encodeURIComponent(bundleId)}&includeLists=false`);
        if (!res.ok) return;
        const data = await res.json();
        setProgramIntel(data);
      } catch {
        setProgramIntel(null);
      }
    };
    loadIntel();
  }, [bundleId]);

  useEffect(() => {
    if (activeTab !== 'dependencies' && activeTab !== 'deliveryImpact') return;
    const loadAppDependencies = async () => {
      setAppDependencyLoading(true);
      try {
        const res = await fetch('/api/application-dependencies');
        const data = await res.json().catch(() => ({}));
        setAppDependencyItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setAppDependencyItems([]);
      } finally {
        setAppDependencyLoading(false);
      }
    };
    loadAppDependencies();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'lifecycle') return;
    const loadLifecycles = async () => {
      try {
        const entries = await Promise.all(
          appsInBundle.map(async (entry) => {
            const id = String(entry._id || entry.id || entry.aid || '');
            if (!id) return null;
            const res = await fetch(`/api/applications/${encodeURIComponent(id)}/lifecycle`);
            if (!res.ok) return [id, null] as const;
            const data = await res.json().catch(() => ({}));
            return [id, data?.lifecycle || null] as const;
          })
        );
        const next: Record<string, any> = {};
        entries.forEach((row) => {
          if (!row) return;
          const [id, lifecycle] = row;
          next[id] = lifecycle;
        });
        setAppLifecycleById(next);
      } catch {
        setAppLifecycleById({});
      }
    };
    loadLifecycles();
  }, [activeTab, appsInBundle]);

  useEffect(() => {
    if (activeTab !== 'deliveryImpact') return;
    const loadImpact = async () => {
      setBundleImpactLoading(true);
      try {
        const entries = await Promise.all(
          appsInBundle.map(async (entry) => {
            const id = String(entry._id || entry.id || entry.aid || '');
            if (!id) return null;
            const res = await fetch(`/api/applications/${encodeURIComponent(id)}/delivery-impact`);
            if (!res.ok) return [id, null] as const;
            const data = await res.json().catch(() => ({}));
            return [id, data] as const;
          })
        );
        const next: Record<string, any> = {};
        entries.forEach((row) => {
          if (!row) return;
          const [id, impact] = row;
          next[id] = impact;
        });
        setBundleImpactByAppId(next);
      } catch {
        setBundleImpactByAppId({});
      } finally {
        setBundleImpactLoading(false);
      }
    };
    loadImpact();
  }, [activeTab, appsInBundle]);

  const ensureProgramLists = async () => {
    if (programLists) return programLists;
    const res = await fetch(`/api/program/intel?bundleIds=${encodeURIComponent(bundleId)}&includeLists=true&limit=10`);
    if (!res.ok) return null;
    const data = await res.json();
    setProgramLists(data?.lists || null);
    return data?.lists || null;
  };

  const bundleAppIdSet = useMemo(() => {
    const ids = new Set<string>();
    appsInBundle.forEach((entry) => {
      const id = String(entry._id || entry.id || entry.aid || '');
      if (id) ids.add(id);
    });
    return ids;
  }, [appsInBundle]);

  const bundleDependencyRollup = useMemo(() => {
    const rows = appDependencyItems.filter((dep) => {
      const source = String(dep?.sourceApplicationId || '');
      const target = String(dep?.targetApplicationId || '');
      return bundleAppIdSet.has(source) || bundleAppIdSet.has(target);
    });
    let inbound = 0;
    let outbound = 0;
    let internal = 0;
    let critical = 0;
    let crossBundle = 0;
    const externalBundleCounts: Record<string, number> = {};
    const inboundBundleIds = new Set<string>();
    const outboundBundleIds = new Set<string>();
    rows.forEach((dep) => {
      const source = String(dep?.sourceApplicationId || '');
      const target = String(dep?.targetApplicationId || '');
      const sourceIn = bundleAppIdSet.has(source);
      const targetIn = bundleAppIdSet.has(target);
      if (sourceIn && targetIn) internal += 1;
      if (sourceIn && !targetIn) outbound += 1;
      if (!sourceIn && targetIn) inbound += 1;
      const criticality = String(dep?.criticality || '').toUpperCase();
      if (criticality === 'HIGH' || criticality === 'CRITICAL') critical += 1;
      if ((sourceIn && !targetIn) || (!sourceIn && targetIn)) {
        crossBundle += 1;
        const externalBundleId = sourceIn
          ? String(dep?.targetApplication?.bundleId || '')
          : String(dep?.sourceApplication?.bundleId || '');
        if (externalBundleId) externalBundleCounts[externalBundleId] = (externalBundleCounts[externalBundleId] || 0) + 1;
        if (sourceIn && !targetIn && externalBundleId) outboundBundleIds.add(externalBundleId);
        if (!sourceIn && targetIn && externalBundleId) inboundBundleIds.add(externalBundleId);
      }
    });
    return {
      rows,
      summary: { inbound, outbound, internal, critical, crossBundle },
      externalBundleCounts,
      inboundBundleIds: Array.from(inboundBundleIds),
      outboundBundleIds: Array.from(outboundBundleIds)
    };
  }, [appDependencyItems, bundleAppIdSet]);

  const lifecycleDistribution = useMemo(() => {
    const counts: Record<string, number> = { ACTIVE: 0, MAINTENANCE: 0, SUNSETTING: 0, RETIRED: 0, UNKNOWN: 0 };
    appsInBundle.forEach((entry) => {
      const id = String(entry._id || entry.id || entry.aid || '');
      const lifecycle = appLifecycleById[id];
      const stage = String(lifecycle?.lifecycleStage || (entry as any).lifecycleStatus || 'UNKNOWN').toUpperCase();
      if (!counts[stage]) counts[stage] = 0;
      counts[stage] += 1;
    });
    const maxStage = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';
    const summaryLabel =
      maxStage === 'ACTIVE' ? 'Mostly Active' :
      maxStage === 'MAINTENANCE' ? 'Maintenance Heavy' :
      maxStage === 'SUNSETTING' ? 'Sunsetting Pressure' :
      maxStage === 'RETIRED' ? 'Mostly Retired' :
      'Mixed Lifecycle';
    return { counts, summaryLabel };
  }, [appsInBundle, appLifecycleById]);

  const bundleDeliveryImpact = useMemo(() => {
    const rows = appsInBundle.map((entry) => {
      const id = String(entry._id || entry.id || entry.aid || '');
      const impact = bundleImpactByAppId[id];
      const summary = impact?.summary || {};
      const score = Number(summary?.outboundDependencies || 0)
        + Number(summary?.inboundDependencies || 0)
        + Number(summary?.relatedWorkItems || 0)
        + Number(summary?.impactedMilestones || 0);
      return { app: entry, impact, summary, score };
    });
    const totals = rows.reduce((acc, row) => {
      acc.impactedMilestones += Number(row.summary?.impactedMilestones || 0);
      acc.relatedWorkItems += Number(row.summary?.relatedWorkItems || 0);
      acc.connectedApplications += Number(row.summary?.connectedApplications || 0);
      acc.sharedReleaseTrainApplications += Number(row.summary?.sharedReleaseTrainApplications || 0);
      acc.inboundDependencies += Number(row.summary?.inboundDependencies || 0);
      acc.outboundDependencies += Number(row.summary?.outboundDependencies || 0);
      return acc;
    }, {
      impactedMilestones: 0,
      relatedWorkItems: 0,
      connectedApplications: 0,
      sharedReleaseTrainApplications: 0,
      inboundDependencies: 0,
      outboundDependencies: 0
    });
    const atRiskApps = rows
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return { totals, atRiskApps };
  }, [appsInBundle, bundleImpactByAppId]);

  const bandBadge = (band: string) => {
    if (band === 'high') return 'bg-emerald-50 text-emerald-700';
    if (band === 'medium') return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  const bundleStatus = (profile?.statusSource || 'computed') === 'computed'
    ? (localHealth?.computedStatus || profile?.status || 'unknown')
    : (profile?.status || 'unknown');
  const bundleStatusClass =
    bundleStatus === 'on_track' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    bundleStatus === 'at_risk' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    bundleStatus === 'blocked' ? 'bg-rose-50 text-rose-700 border-rose-200' :
    'bg-slate-100 text-slate-600 border-slate-200';
  const bundleCurrentMilestone = profile?.schedule?.milestones?.find((m) => m.status === 'in_progress')
    || profile?.schedule?.milestones?.find((m) => m.status !== 'done');

  const isAdminCmoRole = (role?: string) => {
    const roleName = String(role || '');
    if (!roleName) return false;
    const lower = roleName.toLowerCase();
    if (lower.includes('admin')) return true;
    if (lower.includes('cmo')) return true;
    return false;
  };

  const getWeekKey = (date: Date) => {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const diff = target.getTime() - firstThursday.getTime();
    const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
    const year = target.getUTCFullYear();
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  const weekOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 4 }).map((_, idx) => {
      const date = new Date(now.getTime() - idx * 7 * 24 * 60 * 60 * 1000);
      return getWeekKey(date);
    });
  }, []);

  useEffect(() => {
    if (!briefWeek && weekOptions.length) setBriefWeek(weekOptions[0]);
  }, [briefWeek, weekOptions]);

  useEffect(() => {
    const loadBrief = async () => {
      if (!briefWeek || !bundleId) return;
      setBriefLoading(true);
      setBriefError(null);
      try {
        const res = await fetch(`/api/briefs/weekly?scopeType=BUNDLE&scopeId=${encodeURIComponent(bundleId)}&weekKey=${encodeURIComponent(briefWeek)}`);
        if (!res.ok) {
          setBriefError('Failed to load brief.');
          setBrief(null);
          return;
        }
        const data = await res.json();
        setBrief(data?.brief || null);
      } catch {
        setBriefError('Failed to load brief.');
        setBrief(null);
      } finally {
        setBriefLoading(false);
      }
    };
    loadBrief();
  }, [briefWeek, bundleId]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle Profile</div>
          <h2 className="text-3xl font-black text-slate-900">{bundleName}</h2>
          <div className="text-xs text-slate-500 mt-1">Bundle ID: {bundleId}</div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${bundleStatusClass}`}>
              {String(bundleStatus).replace('_', ' ')}
            </span>
            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700">
              Apps {appsInBundle.length}
            </span>
            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700">
              Milestone {bundleCurrentMilestone?.name || '—'}
            </span>
            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700">
              Go-live {profile?.schedule?.goLivePlanned ? new Date(profile.schedule.goLivePlanned).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/?tab=work-items&view=roadmap')}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl"
          >
            Open Roadmap
          </button>
          <button
            onClick={() => router.push(`/program?bundleIds=${encodeURIComponent(bundleId)}`)}
            className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
          >
            Open Program
          </button>
          <button
            onClick={() => {
              setActiveTab('overview');
              setTimeout(() => {
                const el = document.getElementById(`bundle-apps-panel-${bundleId}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 0);
            }}
            className="px-4 py-2 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl"
          >
            View Apps in Bundle
          </button>
          {canEdit && (
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'environments', label: 'Environments' },
          { id: 'ownership', label: 'Ownership' },
          { id: 'dependencies', label: 'Dependencies' },
          { id: 'lifecycle', label: 'Lifecycle' },
          { id: 'deliveryImpact', label: 'Delivery Impact' },
          { id: 'notes', label: 'Notes' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-[10px] font-black uppercase rounded-full border transition-all ${
              activeTab === tab.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-slate-400">Loading profile...</div>}
      {!loading && profile && (
        <>
          {activeTab === 'overview' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Intelligence</div>
                  <div className="text-sm font-semibold text-slate-700">Bundle-scoped roadmap confidence</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleBundleWatch}
                    className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border transition-all ${
                      isWatching ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    {isWatching ? 'Watching' : 'Watch Bundle'}
                  </button>
                  <button
                    onClick={() => router.push('/?tab=work-items&view=roadmap')}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    Open Roadmap
                  </button>
                  <button
                    onClick={() => router.push(`/program?bundleIds=${encodeURIComponent(bundleId)}`)}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                  >
                    Open Program
                  </button>
                </div>
              </div>

              {watchMessage && (
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{watchMessage}</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {[
                  { label: 'Blocked', value: programIntel?.summary?.blockedDerived ?? 0 },
                  { label: 'High/Critical', value: programIntel?.summary?.highCriticalRisks ?? 0 },
                  { label: 'Overdue', value: programIntel?.summary?.overdueOpen ?? 0 },
                  { label: 'Avg Confidence', value: programIntel?.bundleRollups?.[0]?.aggregated?.confidenceAvg ?? 0 },
                  { label: 'Avg Readiness', value: programIntel?.bundleRollups?.[0]?.aggregated?.readinessAvg ?? 0 },
                  { label: 'Late Milestones', value: programIntel?.bundleRollups?.[0]?.aggregated?.isLateCount ?? 0 }
                ].map((chip) => (
                  <div key={chip.label} className="border border-slate-100 rounded-xl p-3">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{chip.label}</div>
                    <div className="text-lg font-black text-slate-800">{chip.value}</div>
                  </div>
                ))}
              </div>

              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Weekly Executive Brief</div>
                    <div className="text-xs text-slate-500">Bundle-level highlights and drivers.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={briefWeek}
                      onChange={(e) => setBriefWeek(e.target.value)}
                      className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      {weekOptions.map((wk) => (
                        <option key={wk} value={wk}>{wk}</option>
                      ))}
                    </select>
                    {isAdminCmoRole(user?.role) && (
                      <button
                        onClick={async () => {
                          if (!briefWeek) return;
                          setBriefLoading(true);
                          try {
                            const res = await fetch(`/api/briefs/weekly?scopeType=BUNDLE&scopeId=${encodeURIComponent(bundleId)}&weekKey=${encodeURIComponent(briefWeek)}&force=true`);
                            const data = await res.json();
                            setBrief(data?.brief || null);
                          } catch {}
                          setBriefLoading(false);
                        }}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                </div>
                {briefLoading && <div className="text-sm text-slate-400">Generating brief…</div>}
                {briefError && (
                  <div className="text-sm text-rose-500">
                    Unable to load executive brief. Try regenerate or check data availability.
                  </div>
                )}
                {!briefLoading && brief && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        brief.summary?.band === 'RED' ? 'bg-rose-50 text-rose-700' :
                        brief.summary?.band === 'YELLOW' ? 'bg-amber-50 text-amber-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>
                        {brief.summary?.band || 'GREEN'}
                      </span>
                      <div className="text-sm font-semibold text-slate-700">{brief.summary?.headline}</div>
                    </div>
                    <ul className="list-disc pl-5 text-sm text-slate-600">
                      {(brief.summary?.bullets || []).map((b: string, idx: number) => (
                        <li key={`${b}-${idx}`}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!briefLoading && !brief && !briefError && (
                  <div className="text-sm text-slate-400">No brief available.</div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const lists = await ensureProgramLists();
                    const blockers = lists?.topCrossBundleBlockers || [];
                    setIntelModal({
                      title: 'Cross-bundle blockers',
                      content: (
                        <div className="space-y-3">
                          {blockers.map((b: any) => (
                            <div key={b.blockerId} className="border border-slate-100 rounded-xl p-4">
                              <div className="text-sm font-semibold text-slate-800">{b.blockerKey || b.blockerTitle || b.blockerId}</div>
                              <div className="text-[11px] text-slate-400">Blocked {b.blockedCount} • Status {b.blockerStatus || '—'}</div>
                            </div>
                          ))}
                          {blockers.length === 0 && <div className="text-sm text-slate-400">No cross-bundle blockers.</div>}
                        </div>
                      )
                    });
                  }}
                  className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  View cross-bundle blockers
                </button>
                <button
                  onClick={async () => {
                    const lists = await ensureProgramLists();
                    const milestones = lists?.topAtRiskMilestones || [];
                    setIntelModal({
                      title: 'At-risk milestones',
                      content: (
                        <div className="space-y-3">
                          {milestones.map((m: any) => (
                            <div key={m.milestoneId} className="border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{m.milestoneName || m.milestoneId}</div>
                                <div className="text-[11px] text-slate-400">Blocked {m.blockedDerived} • Risks {m.highCriticalRisks} • Overdue {m.overdueOpen}</div>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${bandBadge(m.readinessBand)}`}>{m.readinessBand}</span>
                            </div>
                          ))}
                          {milestones.length === 0 && <div className="text-sm text-slate-400">No at-risk milestones.</div>}
                        </div>
                      )
                    });
                  }}
                  className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  View at-risk milestones
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                      <th className="text-left py-2 px-3">Milestone</th>
                      <th className="text-left py-2 px-3">Confidence</th>
                      <th className="text-left py-2 px-3">Readiness</th>
                      <th className="text-left py-2 px-3">Capacity</th>
                      <th className="text-left py-2 px-3">Blocked</th>
                      <th className="text-left py-2 px-3">High/Critical</th>
                      <th className="text-left py-2 px-3">Slip</th>
                      <th className="text-left py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(programIntel?.bundleRollups?.[0]?.milestones || []).map((m: any) => {
                      const rollup = m.rollup || {};
                      const readiness = m.readiness || {};
                      return (
                        <tr key={m.milestoneId} className="border-t border-slate-100">
                          <td className="py-3 px-3 text-slate-700 font-semibold">{m.milestoneId}</td>
                          <td className="py-3 px-3 text-slate-500">{rollup.confidence?.score ?? '—'}</td>
                          <td className="py-3 px-3">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${bandBadge(readiness.band || 'low')}`}>
                              {readiness.band || 'low'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{rollup.capacity?.capacityUtilization ?? '—'}</td>
                          <td className="py-3 px-3 text-slate-500">{rollup.totals?.blockedDerived ?? 0}</td>
                          <td className="py-3 px-3 text-slate-500">{(rollup.risks?.openBySeverity?.high || 0) + (rollup.risks?.openBySeverity?.critical || 0)}</td>
                          <td className="py-3 px-3 text-slate-500">{rollup.schedule?.isLate ? `${rollup.schedule?.slipDays || 0}d` : '—'}</td>
                          <td className="py-3 px-3">
                            <button onClick={() => router.push('/?tab=work-items&view=roadmap')} className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                              View in Roadmap
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(programIntel?.bundleRollups?.[0]?.milestones || []).length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400 text-sm">No milestones found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                <ChangeFeed
                  scopeType="BUNDLE"
                  scopeId={bundleId}
                  title="Recent activity"
                  limit={showAllActivity ? 30 : 10}
                  compact={!showAllActivity}
                  showFilters={showAllActivity}
                  headerAction={
                    <button
                      onClick={() => setShowAllActivity((prev) => !prev)}
                      className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                    >
                      {showAllActivity ? 'Collapse' : 'View all'}
                    </button>
                  }
                />
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle Status</div>
              <select
                value={(profile.statusSource || 'computed') === 'computed' ? (localHealth?.computedStatus || profile.status) : profile.status}
                onChange={(e) => updateProfile({ status: e.target.value as BundleProfile['status'] })}
                disabled={!canEdit || (profile.statusSource || 'computed') === 'computed'}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="blocked">Blocked</option>
                <option value="unknown">Unknown</option>
              </select>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">Status Source</div>
              <select
                value={profile.statusSource || 'computed'}
                onChange={(e) => updateProfile({ statusSource: e.target.value as any })}
                disabled={!canEdit}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <option value="computed">Computed</option>
                <option value="manual">Manual</option>
              </select>
              {localHealth && (
                <div className="mt-4 text-xs text-slate-500">
                  Health Score: <span className="font-semibold text-slate-700">{localHealth.healthScore}</span> · Band: <span className="font-semibold text-slate-700">{localHealth.healthBand}</span>
                </div>
              )}
              {(profile.statusSource || 'computed') === 'computed' && (
                <div className="text-xs text-slate-400">Computed from delivery intelligence.</div>
              )}
            </div>
          )}

          {activeTab === 'overview' && (
            <div id={`bundle-apps-panel-${bundleId}`} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apps in this bundle</div>
              <div className="text-xs text-slate-500">Select an application to view Lifecycle, Dependencies, and Delivery Impact tabs.</div>
              {appsInBundle.length === 0 && <div className="text-sm text-slate-400">No apps mapped to this bundle.</div>}
              {appsInBundle.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {appsInBundle.map((app) => (
                    <div key={String(app._id || app.id)} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{app.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">{app.aid || '—'}</div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Lifecycle: <span className="font-semibold text-slate-700">{(app as any).lifecycleStatus || 'ACTIVE'}</span>
                          {' • '}
                          Criticality: <span className="font-semibold text-slate-700">{(app as any).businessCriticality || 'MEDIUM'}</span>
                          {' • '}
                          Release train: <span className="font-semibold text-slate-700">{(app as any).releaseTrain || '—'}</span>
                          {' • '}
                          Dependencies: <span className="font-semibold text-slate-700">{bundleDependencyCountByApp[String(app._id || app.id || app.aid)] || 0}</span>
                          {' • '}
                          Owner: <span className="font-semibold text-slate-700">{(app as any).operationalOwner || '—'}</span>
                        </div>
                      </div>
                      <button onClick={() => onOpenApp(String(app._id || app.id))} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Open App Detail</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'environments' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle Schedule Metadata</div>
                    <div className="text-xs text-slate-500 mt-1">Defaults apply across applications in this bundle.</div>
                  </div>
                  {!scheduleEditMode && canEdit && (
                    <button onClick={startScheduleEdit} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                      Edit
                    </button>
                  )}
                  {scheduleEditMode && (
                    <div className="flex items-center gap-2">
                      <button onClick={saveScheduleDraft} disabled={scheduleSaving} className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg disabled:opacity-60">
                        {scheduleSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelScheduleEdit} disabled={scheduleSaving} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {scheduleLoading && <div className="text-xs text-slate-400">Loading schedule metadata...</div>}
                {scheduleError && <div className="text-xs text-rose-500">{scheduleError}</div>}
                {scheduleSaveError && <div className="text-xs text-rose-500">{scheduleSaveError}</div>}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Schedule</div>
                <ScheduleEnvironmentGrid
                  environments={scheduleCurrent.environments || []}
                  editable={scheduleEditMode}
                  onFieldChange={updateScheduleEnvironment}
                  onAddEnvironment={addScheduleEnvironment}
                  suggestions={ENVIRONMENT_SUGGESTIONS}
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Go-Live / Business Cutover</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <label className="space-y-1">Go-Live Planned
                    {scheduleEditMode ? (
                      <input type="date" value={scheduleCurrent.goLive?.planned || ''} onChange={(e) => updateScheduleGoLive({ planned: e.target.value || null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                    ) : (
                      <div className="text-slate-700">{scheduleCurrent.goLive?.planned ? new Date(scheduleCurrent.goLive.planned).toLocaleDateString() : '—'}</div>
                    )}
                  </label>
                  <label className="space-y-1">Go-Live Actual
                    {scheduleEditMode ? (
                      <input type="date" value={scheduleCurrent.goLive?.actual || ''} onChange={(e) => updateScheduleGoLive({ actual: e.target.value || null })} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                    ) : (
                      <div className="text-slate-700">{scheduleCurrent.goLive?.actual ? new Date(scheduleCurrent.goLive.actual).toLocaleDateString() : '—'}</div>
                    )}
                  </label>
                </div>
              </div>

              <ScheduleDefaultsPanel
                metadata={scheduleCurrent}
                editable={scheduleEditMode}
                onPlanningDefaultsChange={updateSchedulePlanningDefaults}
                onCapacityDefaultsChange={updateScheduleCapacityDefaults}
                onNotesChange={updateScheduleNotes}
                derivedMilestoneDurationWeeks={scheduleDerivedMilestoneWeeks}
              />
            </div>
          )}

          {activeTab === 'ownership' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle Ownership</div>
                <button onClick={() => router.push('/?tab=admin&section=bundle-assignments')} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-600">
                  Manage In Admin
                </button>
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Leads</div>
              <div className="flex flex-wrap gap-2">
                {vendorLeads.length === 0 && <span className="text-sm text-slate-400">—</span>}
                {vendorLeads.map((a: any) => (
                  <span key={a._id} className="px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-semibold">
                    {a.user?.name || a.user?.email || 'User'}
                  </span>
                ))}
              </div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-6">Engineering Owners</div>
              <div className="flex flex-wrap gap-2">
                {engineeringOwners.length === 0 && <span className="text-sm text-slate-400">—</span>}
                {engineeringOwners.map((a: any) => (
                  <span key={a._id} className="px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-semibold">
                    {a.user?.name || a.user?.email || 'User'}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-400">Ownership is managed in Admin → Bundle Assignments.</div>
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div className="space-y-6">
              {!isGuestUser && (
                <div className="flex items-center gap-3">
                  <button onClick={onAddRisk} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Add Risk</button>
                  <button onClick={onAddDependency} className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl">Add Dependency</button>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bundle Dependency Rollup</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Inbound', value: bundleDependencyRollup.summary.inbound },
                    { label: 'Outbound', value: bundleDependencyRollup.summary.outbound },
                    { label: 'Internal', value: bundleDependencyRollup.summary.internal },
                    { label: 'Critical', value: bundleDependencyRollup.summary.critical },
                    { label: 'Cross-bundle', value: bundleDependencyRollup.summary.crossBundle }
                  ].map((chip) => (
                    <div key={chip.label} className="border border-slate-100 rounded-xl p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{chip.label}</div>
                      <div className="text-lg font-black text-slate-800">{chip.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  {bundleDependencyRollup.summary.crossBundle > 0
                    ? `${bundleDependencyRollup.summary.crossBundle} cross-bundle dependencies detected.`
                    : 'No cross-bundle dependencies detected yet.'}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Application Dependency Rollup</div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Direction</th>
                      <th className="px-4 py-2">Source App</th>
                      <th className="px-4 py-2">Target App</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Criticality</th>
                      <th className="px-4 py-2">Scope</th>
                      <th className="px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appDependencyLoading && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={7}>Loading dependencies...</td></tr>
                    )}
                    {!appDependencyLoading && bundleDependencyRollup.rows.map((dep) => {
                      const sourceId = String(dep?.sourceApplicationId || '');
                      const targetId = String(dep?.targetApplicationId || '');
                      const sourceInBundle = bundleAppIdSet.has(sourceId);
                      const targetInBundle = bundleAppIdSet.has(targetId);
                      const direction = sourceInBundle && targetInBundle ? 'Internal' : (sourceInBundle ? 'Outbound' : 'Inbound');
                      const scopeLabel = sourceInBundle && targetInBundle ? 'In-bundle' : 'Cross-bundle';
                      return (
                        <tr key={String(dep?._id)} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-500">{direction}</td>
                          <td className="px-4 py-2 text-slate-700">{dep?.sourceApplication?.name || dep?.sourceApplicationId || '—'}</td>
                          <td className="px-4 py-2 text-slate-700">{dep?.targetApplication?.name || dep?.targetApplicationId || '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{dep?.dependencyType || '—'}</td>
                          <td className="px-4 py-2 text-slate-500">{dep?.criticality || 'MEDIUM'}</td>
                          <td className="px-4 py-2 text-slate-500">
                            {scopeLabel}
                            {scopeLabel === 'Cross-bundle' && (
                              <span className="ml-2 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest">Cross-bundle</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {sourceId && (
                                <button
                                  onClick={() => onOpenApp(sourceId)}
                                  className="text-[10px] font-black uppercase tracking-widest text-blue-600"
                                >
                                  Open Source App
                                </button>
                              )}
                              {targetId && (
                                <button
                                  onClick={() => onOpenApp(targetId)}
                                  className="text-[10px] font-black uppercase tracking-widest text-blue-600"
                                >
                                  Open Target App
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!appDependencyLoading && bundleDependencyRollup.rows.length === 0 && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={7}>No bundle dependencies found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Risk & Dependency Work Item Summary</div>
                {localHealth ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-600">
                    <div>Health score: <span className="font-semibold text-slate-800">{localHealth.healthScore}</span></div>
                    <div>Open risks: <span className="font-semibold text-slate-800">{(localHealth.openRisksBySeverity?.low || 0) + (localHealth.openRisksBySeverity?.medium || 0) + (localHealth.openRisksBySeverity?.high || 0) + (localHealth.openRisksBySeverity?.critical || 0)}</span></div>
                    <div>Overdue items: <span className="font-semibold text-slate-800">{localHealth.overdueCount}</span></div>
                    <div>Blocking deps: <span className="font-semibold text-slate-800">{localHealth.blockingDependenciesCount}</span></div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">Health summary unavailable.</div>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Risks</div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Severity</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Owner</th>
                      <th className="px-4 py-2">Due</th>
                      <th className="px-4 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskItems.map((r) => (
                      <tr key={String(r._id || r.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/work-items/${encodeURIComponent(String(r._id || r.id))}`)}>
                        <td className="px-4 py-2 text-slate-700">{r.title}</td>
                        <td className="px-4 py-2 text-slate-500">{r.risk?.severity || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{r.status}</td>
                        <td className="px-4 py-2 text-slate-500">{r.assignedTo || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{r.dueAt ? new Date(r.dueAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-2 text-slate-400">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!riskLoading && riskItems.length === 0 && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>No bundle risks found. Use Add Risk to track bundle-level delivery risks.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Work Item Dependencies</div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Blocking</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Owner</th>
                      <th className="px-4 py-2">Due</th>
                      <th className="px-4 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depsItems.map((d) => (
                      <tr key={String(d._id || d.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/work-items/${encodeURIComponent(String(d._id || d.id))}`)}>
                        <td className="px-4 py-2 text-slate-700">{d.title}</td>
                        <td className="px-4 py-2 text-slate-500">{d.dependency?.blocking ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 text-slate-500">{d.status}</td>
                        <td className="px-4 py-2 text-slate-500">{d.assignedTo || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{d.dueAt ? new Date(d.dueAt).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-2 text-slate-400">{d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                    {!riskLoading && depsItems.length === 0 && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>No work item dependencies found. This section is separate from cross-application dependency mapping above.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'lifecycle' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bundle Lifecycle Rollup</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Active', value: lifecycleDistribution.counts.ACTIVE || 0 },
                    { label: 'Maintenance', value: lifecycleDistribution.counts.MAINTENANCE || 0 },
                    { label: 'Sunsetting', value: lifecycleDistribution.counts.SUNSETTING || 0 },
                    { label: 'Retired', value: lifecycleDistribution.counts.RETIRED || 0 },
                    { label: 'Unknown', value: lifecycleDistribution.counts.UNKNOWN || 0 }
                  ].map((chip) => (
                    <div key={chip.label} className="border border-slate-100 rounded-xl p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{chip.label}</div>
                      <div className="text-lg font-black text-slate-800">{chip.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-500">Bundle lifecycle posture: <span className="font-semibold text-slate-700">{lifecycleDistribution.summaryLabel}</span></div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Application Lifecycle Table</div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Application</th>
                      <th className="px-4 py-2">Lifecycle Stage</th>
                      <th className="px-4 py-2">Lifecycle Owner</th>
                      <th className="px-4 py-2">Last Updated</th>
                      <th className="px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appsInBundle.map((entry) => {
                      const id = String(entry._id || entry.id || entry.aid || '');
                      const lifecycle = appLifecycleById[id];
                      return (
                        <tr key={id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-700">{entry.name}</td>
                          <td className="px-4 py-2 text-slate-500">{String(lifecycle?.lifecycleStage || (entry as any).lifecycleStatus || 'UNKNOWN').replace('_', ' ')}</td>
                          <td className="px-4 py-2 text-slate-500">{lifecycle?.lifecycleOwner || (entry as any).operationalOwner || '—'}</td>
                          <td className="px-4 py-2 text-slate-400">{lifecycle?.updatedAt ? new Date(lifecycle.updatedAt).toLocaleDateString() : ((entry as any).updatedAt ? new Date((entry as any).updatedAt).toLocaleDateString() : '—')}</td>
                          <td className="px-4 py-2">
                            <button onClick={() => onOpenApp(id)} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Open App Detail</button>
                          </td>
                        </tr>
                      );
                    })}
                    {appsInBundle.length === 0 && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>No lifecycle data available yet. Open application details to update lifecycle data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'deliveryImpact' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Bundle Delivery Impact Rollup</div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Impacted milestones', value: bundleDeliveryImpact.totals.impactedMilestones },
                    { label: 'Related work items', value: bundleDeliveryImpact.totals.relatedWorkItems },
                    { label: 'Connected apps', value: bundleDeliveryImpact.totals.connectedApplications },
                    { label: 'Shared train apps', value: bundleDeliveryImpact.totals.sharedReleaseTrainApplications },
                    { label: 'Inbound deps', value: bundleDeliveryImpact.totals.inboundDependencies },
                    { label: 'Outbound deps', value: bundleDeliveryImpact.totals.outboundDependencies }
                  ].map((chip) => (
                    <div key={chip.label} className="border border-slate-100 rounded-xl p-3">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{chip.label}</div>
                      <div className="text-lg font-black text-slate-800">{chip.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-600">
                  {bundleDeliveryImpact.totals.outboundDependencies > bundleDeliveryImpact.totals.inboundDependencies
                    ? 'This bundle is currently acting as a dependency driver across related applications.'
                    : bundleDeliveryImpact.totals.inboundDependencies > bundleDeliveryImpact.totals.outboundDependencies
                      ? 'This bundle currently depends on external systems and may face inbound dependency pressure.'
                      : 'This bundle currently has balanced delivery impact signals.'}
                </div>
                {bundleImpactLoading && <div className="text-xs text-slate-400 mt-3">Loading delivery impact rollups...</div>}
                {!bundleImpactLoading && bundleDeliveryImpact.atRiskApps.length === 0 && (
                  <div className="text-xs text-slate-500 mt-3">Delivery impact will appear when this bundle participates in plans, milestones, or cross-application dependencies.</div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">At-Risk Applications</div>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Application</th>
                      <th className="px-4 py-2">Dependency Pressure</th>
                      <th className="px-4 py-2">Related Work Items</th>
                      <th className="px-4 py-2">Impacted Milestones</th>
                      <th className="px-4 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundleDeliveryImpact.atRiskApps.map((row) => (
                      <tr key={String(row.app._id || row.app.id)} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-700">{row.app.name}</td>
                        <td className="px-4 py-2 text-slate-500">{Number(row.summary?.inboundDependencies || 0) + Number(row.summary?.outboundDependencies || 0)}</td>
                        <td className="px-4 py-2 text-slate-500">{row.summary?.relatedWorkItems || 0}</td>
                        <td className="px-4 py-2 text-slate-500">{row.summary?.impactedMilestones || 0}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => onOpenApp(String(row.app._id || row.app.id))} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Open App Detail</button>
                        </td>
                      </tr>
                    ))}
                    {!bundleImpactLoading && bundleDeliveryImpact.atRiskApps.length === 0 && (
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>Impact will appear when this bundle participates in plans, milestones, or cross-application dependencies.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Cross-Bundle Impact</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                  <div className="border border-slate-100 rounded-xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundles affecting this bundle</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{bundleDependencyRollup.inboundBundleIds.length}</div>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundles affected by this bundle</div>
                    <div className="text-2xl font-black text-slate-800 mt-1">{bundleDependencyRollup.outboundBundleIds.length}</div>
                  </div>
                </div>
                {bundleDependencyRollup.inboundBundleIds.length === 0 && bundleDependencyRollup.outboundBundleIds.length === 0 && (
                  <div className="text-xs text-slate-500 mt-3">No cross-bundle impact detected yet.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Notes</div>
              <textarea
                value={profile.notes || ''}
                onChange={(e) => updateProfile({ notes: e.target.value })}
                disabled={!canEdit}
                className="w-full min-h-[200px] border border-slate-200 rounded-xl px-4 py-3 text-sm"
                placeholder="Bundle notes can capture program context, assumptions, and coordination details."
              />
            </div>
          )}
        </>
      )}

      {intelModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-6">
          <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">{intelModal.title}</h4>
              <button onClick={() => setIntelModal(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
            </header>
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {intelModal.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Applications;
