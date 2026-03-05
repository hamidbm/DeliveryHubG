
import React, { useEffect, useMemo, useState } from 'react';
import { Application, Bundle, BundleAssignment, BundleProfile, BundleProfileMilestone, WorkItem, WorkItemType } from '../types';
import { usePathname, useRouter, useSearchParams } from '../App';
import { canEditBundleProfileClient } from '../lib/authzClient';
import CreateWorkItemModal from './CreateWorkItemModal';
import ChangeFeed from './ChangeFeed';

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
          <p className="text-slate-500 font-medium mt-1">Bundle-centric status, ownership, and schedule overview.</p>
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
              <div key={bundle._id} className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-col gap-4 shadow-sm">
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
                  <div>Current milestone: <span className="font-semibold text-slate-700">{current?.name || '—'}</span></div>
                  <div>Planned Go-live: <span className="font-semibold text-slate-700">{formatDate(profile?.schedule?.goLivePlanned)}</span></div>
                  <div>Health score: <span className="font-semibold text-slate-700">{health?.healthScore ?? '—'}</span></div>
                  <div>Vendor Lead: <span className="font-semibold text-slate-700">{summarizeOwners(bundle._id, 'svp')}</span></div>
                  <div>Engineering Owner: <span className="font-semibold text-slate-700">{summarizeOwners(bundle._id, 'bundle_owner')}</span></div>
                  <div>Apps: <span className="font-semibold text-slate-700">{apps.length}</span></div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Updated {formatDate(profile?.updatedAt)}</span>
                  <button onClick={() => router.push(`/applications/bundles/${encodeURIComponent(String(bundle._id))}`)} className="text-blue-600">Open Bundle Profile</button>
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
                <th className="px-4 py-3">Current Milestone</th>
                <th className="px-4 py-3">Bundle Status</th>
                <th className="px-4 py-3">Planned Go-live</th>
                <th className="px-4 py-3">Vendor Lead</th>
                <th className="px-4 py-3">Engineering Owner</th>
                <th className="px-4 py-3">Updated At</th>
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
                    <td className="px-4 py-3 text-slate-500">{current?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusClass}`}>
                        {status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(profile?.schedule?.goLivePlanned)}</td>
                    <td className="px-4 py-3 text-slate-500">{summarizeOwners(app.bundleId, 'svp')}</td>
                    <td className="px-4 py-3 text-slate-500">{summarizeOwners(app.bundleId, 'bundle_owner')}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(profile?.updatedAt)}</td>
                  </tr>
                );
              })}
              {filteredApps.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={9}>No applications match the current filters.</td>
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
  bundleName: string;
  profile?: BundleProfile;
  owners: { vendorLead: string; engineeringOwner: string };
  onOpenBundle: () => void;
}> = ({ app, bundleName, profile, owners, onOpenBundle }) => {
  const current = profile?.schedule?.milestones?.find((m) => m.status === 'in_progress') || profile?.schedule?.milestones?.find((m) => m.status !== 'done');
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Application Detail</div>
          <h2 className="text-3xl font-black text-slate-900">{app.name}</h2>
          <div className="text-sm text-slate-500 mt-1">App ID: {app.aid || '—'}</div>
        </div>
        <button onClick={onOpenBundle} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">
          Open Bundle Profile
        </button>
      </div>

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
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'ownership' | 'notes' | 'risks'>('overview');
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

  useEffect(() => {
    loadProfile();
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

  const updateSchedule = (updates: Partial<BundleProfile['schedule']>) => {
    if (!profile) return;
    setProfile({ ...profile, schedule: { ...profile.schedule, ...updates } });
  };

  const updateMilestone = (index: number, updates: Partial<BundleProfileMilestone>) => {
    if (!profile) return;
    const next = [...(profile.schedule?.milestones || [])];
    next[index] = { ...next[index], ...updates };
    updateSchedule({ milestones: next });
  };

  const addMilestone = () => {
    const next = [...(profile?.schedule?.milestones || [])];
    next.push({
      key: `m${next.length + 1}`,
      name: `Milestone ${next.length + 1}`,
      status: 'not_started'
    });
    updateSchedule({ milestones: next });
  };

  const removeMilestone = (index: number) => {
    if (!profile) return;
    const next = [...(profile.schedule?.milestones || [])];
    next.splice(index, 1);
    updateSchedule({ milestones: next });
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

  const [riskItems, setRiskItems] = useState<WorkItem[]>([]);
  const [depsItems, setDepsItems] = useState<WorkItem[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [localHealth, setLocalHealth] = useState<any | null>(health);
  const [programIntel, setProgramIntel] = useState<any | null>(null);
  const [programLists, setProgramLists] = useState<any | null>(null);
  const [intelModal, setIntelModal] = useState<{ title: string; content: React.ReactNode } | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchMessage, setWatchMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'risks') return;
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

  const ensureProgramLists = async () => {
    if (programLists) return programLists;
    const res = await fetch(`/api/program/intel?bundleIds=${encodeURIComponent(bundleId)}&includeLists=true&limit=10`);
    if (!res.ok) return null;
    const data = await res.json();
    setProgramLists(data?.lists || null);
    return data?.lists || null;
  };

  const bandBadge = (band: string) => {
    if (band === 'high') return 'bg-emerald-50 text-emerald-700';
    if (band === 'medium') return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

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
        </div>
        {canEdit && (
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'schedule', label: 'Schedule' },
          { id: 'ownership', label: 'Ownership' },
          { id: 'risks', label: 'Risks & Dependencies' },
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
                {briefError && <div className="text-sm text-rose-500">{briefError}</div>}
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
                        </tr>
                      );
                    })}
                    {(programIntel?.bundleRollups?.[0]?.milestones || []).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 text-sm">No milestones found.</td>
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
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apps in this bundle</div>
              {appsInBundle.length === 0 && <div className="text-sm text-slate-400">No apps mapped to this bundle.</div>}
              {appsInBundle.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {appsInBundle.map((app) => (
                    <div key={String(app._id || app.id)} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{app.name}</div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest">{app.aid || '—'}</div>
                      </div>
                      <button onClick={() => onOpenApp(String(app._id || app.id))} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Open</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">UAT & Go-live</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="text-xs text-slate-500">UAT Planned Start
                    <input type="date" value={profile.schedule?.uatPlannedStart || ''} onChange={(e) => updateSchedule({ uatPlannedStart: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-slate-500">UAT Planned End
                    <input type="date" value={profile.schedule?.uatPlannedEnd || ''} onChange={(e) => updateSchedule({ uatPlannedEnd: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-slate-500">UAT Actual Start
                    <input type="date" value={profile.schedule?.uatActualStart || ''} onChange={(e) => updateSchedule({ uatActualStart: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-slate-500">UAT Actual End
                    <input type="date" value={profile.schedule?.uatActualEnd || ''} onChange={(e) => updateSchedule({ uatActualEnd: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-slate-500">Go-live Planned
                    <input type="date" value={profile.schedule?.goLivePlanned || ''} onChange={(e) => updateSchedule({ goLivePlanned: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                  <label className="text-xs text-slate-500">Go-live Actual
                    <input type="date" value={profile.schedule?.goLiveActual || ''} onChange={(e) => updateSchedule({ goLiveActual: e.target.value || undefined })} disabled={!canEdit} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                  </label>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Milestones</div>
                  {canEdit && (
                    <button onClick={addMilestone} className="text-[10px] font-black uppercase tracking-widest text-blue-600">Add milestone</button>
                  )}
                </div>
                <div className="space-y-3">
                  {(profile.schedule?.milestones || []).map((m, idx) => (
                    <div key={m.key} className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center border border-slate-100 rounded-xl p-3">
                      <input value={m.name} onChange={(e) => updateMilestone(idx, { name: e.target.value })} disabled={!canEdit} className="md:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Milestone name" />
                      <select value={m.status} onChange={(e) => updateMilestone(idx, { status: e.target.value as BundleProfileMilestone['status'] })} disabled={!canEdit} className="border border-slate-200 rounded-lg px-3 py-2 text-xs">
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                        <option value="blocked">Blocked</option>
                      </select>
                      <input type="date" value={m.plannedStart || ''} onChange={(e) => updateMilestone(idx, { plannedStart: e.target.value || undefined })} disabled={!canEdit} className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      <input type="date" value={m.plannedEnd || ''} onChange={(e) => updateMilestone(idx, { plannedEnd: e.target.value || undefined })} disabled={!canEdit} className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      <input type="date" value={m.actualStart || ''} onChange={(e) => updateMilestone(idx, { actualStart: e.target.value || undefined })} disabled={!canEdit} className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      <input type="date" value={m.actualEnd || ''} onChange={(e) => updateMilestone(idx, { actualEnd: e.target.value || undefined })} disabled={!canEdit} className="border border-slate-200 rounded-lg px-3 py-2 text-xs" />
                      <div className="md:col-span-6">
                        <input value={m.deliverables || ''} onChange={(e) => updateMilestone(idx, { deliverables: e.target.value })} disabled={!canEdit} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" placeholder="Deliverables (optional)" />
                      </div>
                      {canEdit && (
                        <button onClick={() => removeMilestone(idx)} className="text-[9px] font-black uppercase tracking-widest text-rose-500">Remove</button>
                      )}
                    </div>
                  ))}
                  {profile.schedule?.milestones?.length === 0 && (
                    <div className="text-sm text-slate-400">No milestones yet. Add milestones to capture the SOW schedule.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ownership' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
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

          {activeTab === 'risks' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button onClick={onAddRisk} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Add Risk</button>
                <button onClick={onAddDependency} className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl">Add Dependency</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Summary</div>
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
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>No risks found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Dependencies</div>
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
                      <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>No dependencies found.</td></tr>
                    )}
                  </tbody>
                </table>
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
                placeholder="Add bundle notes..."
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
