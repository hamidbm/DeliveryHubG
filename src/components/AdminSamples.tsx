import React from 'react';
import {
  DemoScenario,
  DemoScenarioApplication,
  DemoScenarioBundle,
  DemoScenarioPreviewResponse,
  DemoScenarioInstallResponse,
  DemoScenarioTeam,
  DemoScenarioUser
} from '../types/demoScenario';
import { Role, Team, TEAM_ROLE_OPTIONS } from '../types';

const mkId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

type BundleTab = 'definition' | 'environments' | 'team' | 'strategy';

const DELIVERY_PATTERNS = ['STANDARD_PHASED', 'PRODUCT_INCREMENT', 'MIGRATION', 'COMPLIANCE'];
const BACKLOG_SHAPES = ['LIGHT', 'STANDARD', 'DETAILED'];
const CAPACITY_MODES = ['TEAM_VELOCITY', 'DIRECT_SPRINT_CAPACITY'];
const ENV_FLOWS = ['DEV_UAT_PROD', 'DEV_SIT_UAT_PROD', 'CUSTOM'];
const RELEASE_TYPES = ['BIG_BANG', 'PHASED', 'INCREMENTAL'];
const HEALTH_OPTIONS = ['Healthy', 'Risk', 'Critical'];
const ASSIGNMENT_INTENTS = ['PRIMARY', 'SECONDARY', 'NONE'];
const TEAM_OPTIONS = Object.values(Team);

const ensureTeamRole = (user: DemoScenarioUser): DemoScenarioUser => {
  const nextTeam = TEAM_OPTIONS.includes(user.team as Team) ? (user.team as Team) : Team.ENGINEERING;
  const allowedRoles = TEAM_ROLE_OPTIONS[nextTeam] || [];
  const nextRole = allowedRoles.includes(user.role as Role) ? user.role : (allowedRoles[0] || Role.ENGINEERING_EA);
  return { ...user, team: nextTeam, role: nextRole };
};

const normalizeToSingleTeamPerBundle = (input: DemoScenario): DemoScenario => {
  return {
    ...input,
    bundles: (input.bundles || []).map((bundle) => {
      const users = (bundle.teams || [])
        .flatMap((team) => team.users || [])
        .map((user) => ensureTeamRole({ ...user }));
      const team: DemoScenarioTeam = {
        tempId: bundle.teams?.[0]?.tempId || mkId('team'),
        name: bundle.teams?.[0]?.name || 'Bundle Team',
        size: users.length,
        users
      };
      return { ...bundle, teams: [team] };
    })
  };
};

const AdminSamples: React.FC = () => {
  const [scenario, setScenario] = React.useState<DemoScenario | null>(null);
  const [activeBundleId, setActiveBundleId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<BundleTab>('definition');

  const [loading, setLoading] = React.useState(true);
  const [previewing, setPreviewing] = React.useState(false);
  const [installing, setInstalling] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const [validationErrors, setValidationErrors] = React.useState<Array<{ path: string; code: string; message: string }>>([]);
  const [previewResult, setPreviewResult] = React.useState<DemoScenarioPreviewResponse | null>(null);
  const [installResult, setInstallResult] = React.useState<DemoScenarioInstallResponse | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const loadDefaultScenario = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    setValidationErrors([]);
    try {
      const res = await fetch('/api/admin/sample/scenario/default');
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || 'Failed to load default scenario.');
        setScenario(null);
        setActiveBundleId(null);
      } else {
        const nextScenario = data?.scenario || null;
        const normalized = nextScenario ? normalizeToSingleTeamPerBundle(nextScenario) : null;
        setScenario(normalized);
        setActiveBundleId(normalized?.bundles?.[0]?.tempId || null);
      }
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load default scenario.');
      setScenario(null);
      setActiveBundleId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDefaultScenario();
  }, [loadDefaultScenario]);

  const patchScenario = (updater: (prev: DemoScenario) => DemoScenario) => {
    setScenario((prev) => (prev ? updater(prev) : prev));
  };

  const patchBundle = (bundleTempId: string, updater: (bundle: DemoScenarioBundle) => DemoScenarioBundle) => {
    patchScenario((prev) => ({
      ...prev,
      bundles: prev.bundles.map((bundle) => (bundle.tempId === bundleTempId ? updater(bundle) : bundle))
    }));
  };

  const addBundle = () => {
    const bundle: DemoScenarioBundle = {
      tempId: mkId('bundle'),
      name: 'New Demo Bundle',
      key: '',
      description: '',
      applications: [{ tempId: mkId('app'), name: 'New Demo App', aid: '', key: '', isActive: true, status: { phase: 'MIGRATION', health: 'Healthy' } }],
      planning: {
        devStartDate: '2026-01-05',
        uatStartDate: '2026-02-05',
        goLiveDate: '2026-03-05',
        milestoneCount: 3,
        sprintDurationWeeks: 2,
        milestoneDurationStrategy: 'AUTO_DISTRIBUTE',
        deliveryPattern: 'STANDARD_PHASED',
        backlogShape: 'STANDARD',
        capacityMode: 'TEAM_VELOCITY',
        deliveryTeams: 2,
        sprintVelocityPerTeam: 20,
        createTasksUnderStories: true,
        environmentFlow: 'DEV_SIT_UAT_PROD',
        releaseType: 'PHASED',
        suggestMilestoneOwners: true,
        suggestWorkItemOwners: true,
        createDependencySkeleton: true,
        preallocateStoriesToSprints: true,
        autoLinkMilestonesToRoadmap: true,
        generateDraftOnly: true
      },
      teams: [
        {
          tempId: mkId('team'),
          name: 'Delivery Team',
          size: 1,
          users: [{
            tempId: mkId('user'),
            name: 'New User',
            username: 'new.user',
            email: `new.user.${Date.now()}@demo.deliveryhub.local`,
            team: Team.ENGINEERING,
            role: TEAM_ROLE_OPTIONS[Team.ENGINEERING][0],
            isActive: true,
            assignmentIntent: 'PRIMARY',
            isSvpCandidate: false,
            isBundleOwnerCandidate: false
          }]
        }
      ],
      assignmentRules: {
        assignSomeToSvp: true,
        leaveSomeUnassigned: true,
        unassignedPercentage: 15,
        svpAssignmentPercentage: 10,
        assignEpicsAndFeaturesToOwners: true,
        assignStoriesAndTasksToTeamMembers: true
      }
    };

    patchScenario((prev) => ({ ...prev, bundles: [...prev.bundles, bundle] }));
    setActiveBundleId(bundle.tempId);
    setActiveTab('definition');
  };

  const removeBundle = (bundleTempId: string) => {
    patchScenario((prev) => {
      const bundles = prev.bundles.filter((bundle) => bundle.tempId !== bundleTempId);
      if (activeBundleId === bundleTempId) {
        setActiveBundleId(bundles[0]?.tempId || null);
      }
      return { ...prev, bundles };
    });
  };

  const addApp = (bundleTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({
      ...bundle,
      applications: [...bundle.applications, { tempId: mkId('app'), name: 'New Application', aid: '', key: '', isActive: true, status: { phase: 'MIGRATION', health: 'Healthy' } }]
    }));
  };

  const removeApp = (bundleTempId: string, appTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({ ...bundle, applications: bundle.applications.filter((app) => app.tempId !== appTempId) }));
  };

  const addTeam = (bundleTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({ ...bundle, teams: [{ tempId: mkId('team'), name: 'Bundle Team', size: 0, users: [] }] }));
  };

  const removeTeam = (bundleTempId: string, teamTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({ ...bundle, teams: bundle.teams.filter((team) => team.tempId !== teamTempId) }));
  };

  const addUser = (bundleTempId: string, teamTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({
      ...bundle,
      teams: bundle.teams.map((team) => {
        if (team.tempId !== teamTempId) return team;
        const users = [
          ...team.users,
          {
            tempId: mkId('user'),
            name: 'New User',
            username: 'new.user',
            email: `new.user.${Date.now()}@demo.deliveryhub.local`,
            team: Team.ENGINEERING,
            role: TEAM_ROLE_OPTIONS[Team.ENGINEERING][0],
            isActive: true,
            assignmentIntent: 'PRIMARY' as const,
            isSvpCandidate: false,
            isBundleOwnerCandidate: false
          } as DemoScenarioUser
        ];
        return { ...team, size: users.length, users };
      })
    }));
  };

  const removeUser = (bundleTempId: string, teamTempId: string, userTempId: string) => {
    patchBundle(bundleTempId, (bundle) => ({
      ...bundle,
      teams: bundle.teams.map((team) => {
        if (team.tempId !== teamTempId) return team;
        const users = team.users.filter((user) => user.tempId !== userTempId);
        return { ...team, size: users.length, users };
      })
    }));
  };

  const callPreview = async () => {
    if (!scenario) return;
    setPreviewing(true);
    setMessage(null);
    setValidationErrors([]);
    setPreviewResult(null);
    try {
      const res = await fetch('/api/admin/sample/scenario/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationErrors(Array.isArray(data?.errors) ? data.errors : []);
        setMessage(data?.error || 'Preview failed.');
        return;
      }
      setPreviewResult(data.preview || null);
      setMessage('Preview generated successfully.');
    } catch (error: any) {
      setMessage(error?.message || 'Preview failed.');
    } finally {
      setPreviewing(false);
    }
  };

  const callInstall = async () => {
    if (!scenario) return;
    setInstalling(true);
    setMessage(null);
    setValidationErrors([]);
    setInstallResult(null);
    try {
      const res = await fetch('/api/admin/sample/scenario/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      if (!res.ok) {
        setValidationErrors(Array.isArray(data?.errors) ? data.errors : []);
        setMessage(data?.error || 'Install failed.');
        return;
      }
      setInstallResult(data.result || null);
      setMessage('Sample data generated successfully.');
    } catch (error: any) {
      setMessage(error?.message || 'Install failed.');
    } finally {
      setInstalling(false);
    }
  };

  const callReset = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/sample/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || 'Reset failed.');
        return;
      }
      setMessage('Sample data reset completed.');
      setPreviewResult(null);
      setInstallResult(null);
    } catch (error: any) {
      setMessage(error?.message || 'Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="p-12 text-slate-500 text-sm font-semibold">Loading demo scenario...</div>;
  if (!scenario) {
    return (
      <div className="p-12 space-y-4">
        <div className="text-rose-600 text-sm font-semibold">Unable to load scenario.</div>
        <button onClick={loadDefaultScenario} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-widest">Retry</button>
      </div>
    );
  }

  const activeBundle = scenario.bundles.find((bundle) => bundle.tempId === activeBundleId) || scenario.bundles[0] || null;

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="px-12 py-10 border-b border-slate-100 bg-white sticky top-0 z-30 space-y-6">
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg"><i className="fas fa-vial text-xl"></i></div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Admin • Samples</div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Sample Data Scenario Builder</h3>
              <p className="text-sm text-slate-500 font-medium mt-2">Scenario: {scenario.scenarioName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={callReset} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-200 text-rose-600 disabled:opacity-50">{resetting ? 'Resetting...' : 'Reset Sample Data'}</button>
            <button onClick={callPreview} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-200 text-blue-600 disabled:opacity-50">{previewing ? 'Previewing...' : 'Preview'}</button>
            <button onClick={callInstall} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white disabled:opacity-50">{installing ? 'Generating...' : 'Generate Sample'}</button>
          </div>
        </div>

      </header>

      <div className="p-10 space-y-8 overflow-y-auto">
        <section className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scenario Definition</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <TextField label="Scenario Key" value={scenario.scenarioKey} onChange={(v) => patchScenario((prev) => ({ ...prev, scenarioKey: v }))} />
            <TextField label="Scenario Name" value={scenario.scenarioName} onChange={(v) => patchScenario((prev) => ({ ...prev, scenarioName: v }))} />
            <TextField label="Demo Tag (optional)" value={scenario.demoTag || ''} onChange={(v) => patchScenario((prev) => ({ ...prev, demoTag: v }))} />
            <TextField label="Default Password" value={scenario.defaults?.defaultPassword || ''} onChange={(v) => patchScenario((prev) => ({ ...prev, defaults: { ...(prev.defaults || {}), defaultPassword: v } }))} type="password" />
          </div>
          <CheckField label="Reset existing demo data before install" checked={Boolean(scenario.resetBeforeInstall)} onChange={(checked) => patchScenario((prev) => ({ ...prev, resetBeforeInstall: checked }))} />
        </section>

        <section className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundles</div>
          <div className="flex items-end gap-5 flex-wrap border-b border-slate-100 pb-1">
            {scenario.bundles.map((bundle) => (
              <div key={bundle.tempId} className="flex items-center gap-1">
                <button
                  onClick={() => setActiveBundleId(bundle.tempId)}
                  className={`pb-2 text-sm font-bold transition-colors border-b-2 ${
                    activeBundle?.tempId === bundle.tempId
                      ? 'text-slate-900 border-slate-900'
                      : 'text-slate-400 border-transparent hover:text-slate-700'
                  }`}
                >
                  {bundle.name}
                </button>
                <button
                  onClick={() => removeBundle(bundle.tempId)}
                  className="w-5 h-5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  title="Remove bundle"
                >
                  ×
                </button>
              </div>
            ))}
            <button onClick={addBundle} className="px-3 py-2 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">+ Add Bundle</button>
          </div>
        </section>

        {activeBundle ? (
          <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            <div className="px-6 pt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected Bundle</div>
              <div className="text-lg font-black text-slate-900">{activeBundle.name}</div>
            </div>
            <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-2 flex-wrap">
              {([
                { key: 'definition', label: 'Bundle Definition' },
                { key: 'environments', label: 'Environments' },
                { key: 'team', label: 'Team' },
                { key: 'strategy', label: 'Milestone Strategy' }
              ] as Array<{ key: BundleTab; label: string }>).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-1 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                    activeTab === tab.key ? 'text-slate-900 border-slate-900 bg-slate-50' : 'text-slate-400 border-transparent hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'definition' && (
                <BundleDefinitionTab
                  bundle={activeBundle}
                  onChange={(next) => patchBundle(activeBundle.tempId, () => next)}
                  onAddApp={() => addApp(activeBundle.tempId)}
                  onRemoveApp={(appTempId) => removeApp(activeBundle.tempId, appTempId)}
                />
              )}

              {activeTab === 'environments' && (
                <EnvironmentsTab
                  bundle={activeBundle}
                  onChange={(next) => patchBundle(activeBundle.tempId, () => next)}
                />
              )}

              {activeTab === 'team' && (
                <TeamTab
                  bundle={activeBundle}
                  onChange={(next) => patchBundle(activeBundle.tempId, () => next)}
                  onAddTeam={() => addTeam(activeBundle.tempId)}
                  onRemoveTeam={(teamTempId) => removeTeam(activeBundle.tempId, teamTempId)}
                  onAddUser={(teamTempId) => addUser(activeBundle.tempId, teamTempId)}
                  onRemoveUser={(teamTempId, userTempId) => removeUser(activeBundle.tempId, teamTempId, userTempId)}
                />
              )}

              {activeTab === 'strategy' && (
                <MilestoneStrategyTab
                  bundle={activeBundle}
                  onChange={(next) => patchBundle(activeBundle.tempId, () => next)}
                />
              )}
            </div>
          </section>
        ) : (
          <section className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm text-slate-500">No bundle configured. Add a bundle to continue.</section>
        )}

        {validationErrors.length > 0 && (
          <section className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
            <div className="text-xs font-black uppercase tracking-widest text-rose-600 mb-2">Validation Errors</div>
            <ul className="space-y-1 text-xs text-rose-700">
              {validationErrors.map((err, idx) => (
                <li key={`${err.path}-${idx}`}>{err.path}: {err.message}</li>
              ))}
            </ul>
          </section>
        )}

        {message && <section className="bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700">{message}</section>}

        {previewResult && (
          <section className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-3">
            <div className="text-sm font-black uppercase tracking-widest text-slate-500">Preview Summary</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {previewResult.bundlePreviews.map((bundle) => (
                <div key={bundle.bundleTempId} className="bg-white border border-slate-200 rounded-2xl p-3 text-xs">
                  <div className="font-black text-slate-700 mb-2">{bundle.bundleName}</div>
                  <div>Milestones: {bundle.milestoneCount}</div>
                  <div>Sprints: {bundle.sprintCount}</div>
                  <div>Roadmap Phases: {bundle.roadmapPhaseCount}</div>
                  <div>Epics: {bundle.epicCount}</div>
                  <div>Features: {bundle.featureCount}</div>
                  <div>Stories: {bundle.storyCount}</div>
                  <div>Tasks: {bundle.taskCount}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-600">
              Totals: bundles {previewResult.totals.bundles}, apps {previewResult.totals.applications}, users {previewResult.totals.users}, milestones {previewResult.totals.milestones}, sprints {previewResult.totals.sprints}, roadmap phases {previewResult.totals.roadmapPhases}, epics {previewResult.totals.epics}, features {previewResult.totals.features}, stories {previewResult.totals.stories}, tasks {previewResult.totals.tasks}
            </div>
          </section>
        )}

        {installResult && (
          <section className="bg-slate-900 text-white rounded-3xl p-6 space-y-3">
            <div className="text-sm font-black uppercase tracking-widest">Install Summary</div>
            <div className="text-xs">Demo Tag: {installResult.demoTag}</div>
            <div className="text-xs">Users Upserted: {installResult.usersCreatedOrUpdated} | Bundles Upserted: {installResult.bundlesCreatedOrUpdated} | Applications Upserted: {installResult.applicationsCreatedOrUpdated}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
              {installResult.planRuns.map((run) => (
                <div key={run.runId} className="bg-slate-800 rounded-xl p-3">
                  <div className="font-black">{run.bundleName}</div>
                  <div>Milestones: {run.milestoneCount}</div>
                  <div>Sprints: {run.sprintCount}</div>
                  <div>Roadmap: {run.roadmapPhaseCount}</div>
                  <div>Work Items: {run.workItemCount}</div>
                </div>
              ))}
            </div>
            <div className="text-xs">Totals: milestones {installResult.totals.milestones}, sprints {installResult.totals.sprints}, roadmap phases {installResult.totals.roadmapPhases}, work items {installResult.totals.workItems}</div>
          </section>
        )}

        <footer className="flex justify-end gap-2 border-t border-slate-100 pt-6">
          <button onClick={callReset} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-200 text-rose-600 disabled:opacity-50">{resetting ? 'Resetting...' : 'Reset Sample Data'}</button>
          <button onClick={callPreview} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-200 text-blue-600 disabled:opacity-50">{previewing ? 'Previewing...' : 'Preview Plan'}</button>
          <button onClick={callInstall} disabled={previewing || installing || resetting} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-slate-900 text-white disabled:opacity-50">{installing ? 'Generating...' : 'Generate Sample Data'}</button>
        </footer>
      </div>
    </div>
  );
};

const BundleDefinitionTab: React.FC<{
  bundle: DemoScenarioBundle;
  onChange: (bundle: DemoScenarioBundle) => void;
  onAddApp: () => void;
  onRemoveApp: (appTempId: string) => void;
}> = ({ bundle, onChange, onAddApp, onRemoveApp }) => {
  const setApp = (appTempId: string, updater: (app: DemoScenarioApplication) => DemoScenarioApplication) => {
    onChange({ ...bundle, applications: bundle.applications.map((app) => (app.tempId === appTempId ? updater(app) : app)) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TextField label="Bundle Name" value={bundle.name} onChange={(v) => onChange({ ...bundle, name: v })} />
        <TextField label="Bundle Key" value={bundle.key || ''} onChange={(v) => onChange({ ...bundle, key: v })} />
        <TextField label="Description" value={bundle.description || ''} onChange={(v) => onChange({ ...bundle, description: v })} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applications</div>
          <button onClick={onAddApp} className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">+ Add Application</button>
        </div>

        {bundle.applications.map((app) => (
          <div key={app.tempId} className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <TextField label="Name" value={app.name} onChange={(v) => setApp(app.tempId, (curr) => ({ ...curr, name: v }))} />
            <TextField label="AID" value={app.aid || ''} onChange={(v) => setApp(app.tempId, (curr) => ({ ...curr, aid: v }))} />
            <TextField label="Key" value={app.key || ''} onChange={(v) => setApp(app.tempId, (curr) => ({ ...curr, key: v }))} />
            <TextField label="Phase" value={app.status?.phase || ''} onChange={(v) => setApp(app.tempId, (curr) => ({ ...curr, status: { ...(curr.status || {}), phase: v } }))} />
            <SelectField label="Health" value={app.status?.health || 'Healthy'} options={HEALTH_OPTIONS} onChange={(v) => setApp(app.tempId, (curr) => ({ ...curr, status: { ...(curr.status || {}), health: v as 'Healthy' | 'Risk' | 'Critical' } }))} />
            <div className="flex items-end">
              <button onClick={() => onRemoveApp(app.tempId)} className="w-full px-2 py-2 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EnvironmentsTab: React.FC<{ bundle: DemoScenarioBundle; onChange: (bundle: DemoScenarioBundle) => void }> = ({ bundle, onChange }) => (
  <div className="space-y-4">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment Timeline</div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <TextField label="Planned Start" type="date" value={bundle.planning.plannedStartDate || ''} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, plannedStartDate: v } })} />
      <TextField label="Dev Start" type="date" value={bundle.planning.devStartDate} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, devStartDate: v } })} />
      <TextField label="Integration Start" type="date" value={bundle.planning.integrationStartDate || ''} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, integrationStartDate: v } })} />
      <TextField label="UAT Start" type="date" value={bundle.planning.uatStartDate} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, uatStartDate: v } })} />
      <TextField label="Go Live" type="date" value={bundle.planning.goLiveDate} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, goLiveDate: v } })} />
      <TextField label="Stabilization End" type="date" value={bundle.planning.stabilizationEndDate || ''} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, stabilizationEndDate: v } })} />
      <SelectField label="Environment Flow" value={bundle.planning.environmentFlow || 'DEV_SIT_UAT_PROD'} options={ENV_FLOWS} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, environmentFlow: v as any } })} />
      <SelectField label="Release Type" value={bundle.planning.releaseType || 'PHASED'} options={RELEASE_TYPES} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, releaseType: v as any } })} />
    </div>
  </div>
);

const TeamTab: React.FC<{
  bundle: DemoScenarioBundle;
  onChange: (bundle: DemoScenarioBundle) => void;
  onAddTeam: () => void;
  onRemoveTeam: (teamTempId: string) => void;
  onAddUser: (teamTempId: string) => void;
  onRemoveUser: (teamTempId: string, userTempId: string) => void;
}> = ({ bundle, onChange, onAddTeam, onRemoveTeam, onAddUser, onRemoveUser }) => {
  const setTeam = (teamTempId: string, updater: (team: DemoScenarioTeam) => DemoScenarioTeam) => {
    onChange({ ...bundle, teams: bundle.teams.map((team) => (team.tempId === teamTempId ? updater(team) : team)) });
  };
  const setUser = (teamTempId: string, userTempId: string, updater: (user: DemoScenarioUser) => DemoScenarioUser) => {
    setTeam(teamTempId, (team) => {
      const users = team.users.map((user) => (user.tempId === userTempId ? updater(user) : user));
      return { ...team, users, size: users.length };
    });
  };

  const firstTeam = bundle.teams[0] || null;
  const [selectedUserTempId, setSelectedUserTempId] = React.useState<string>('');

  React.useEffect(() => {
    if (!firstTeam?.users?.length) {
      setSelectedUserTempId('');
      return;
    }
    if (!selectedUserTempId || !firstTeam.users.some((user) => user.tempId === selectedUserTempId)) {
      setSelectedUserTempId(firstTeam.users[0].tempId);
    }
  }, [firstTeam, selectedUserTempId]);

  const selectedUser = firstTeam?.users.find((user) => user.tempId === selectedUserTempId) || null;

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bundle Team</div>
      {!firstTeam ? (
        <button onClick={onAddTeam} className="px-3 py-2 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">Create Team</button>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <TextField label="Team Name" value={firstTeam.name} onChange={(v) => setTeam(firstTeam.tempId, (curr) => ({ ...curr, name: v }))} />
            <NumberField label="Team Size" value={firstTeam.users.length} onChange={() => {}} disabled />
            <div className="md:col-span-2 flex justify-end">
              <button onClick={() => onRemoveTeam(firstTeam.tempId)} className="px-2 py-2 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest">Remove Team</button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <label className="space-y-1 block md:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Members</div>
                <select
                  value={selectedUserTempId}
                  onChange={(e) => setSelectedUserTempId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700"
                >
                  {(firstTeam.users || []).map((user) => (
                    <option key={user.tempId} value={user.tempId}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button onClick={() => onAddUser(firstTeam.tempId)} className="flex-1 px-2 py-2 rounded-lg border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600">+ Add</button>
                {selectedUser && (
                  <button onClick={() => onRemoveUser(firstTeam.tempId, selectedUser.tempId)} className="flex-1 px-2 py-2 rounded-lg border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-widest">Remove</button>
                )}
              </div>
            </div>

            {selectedUser ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField label="Name" value={selectedUser.name} onChange={(v) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, name: v }))} />
                <TextField label="Username" value={selectedUser.username || ''} onChange={(v) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, username: v }))} />
                <TextField label="Email" value={selectedUser.email} onChange={(v) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, email: v }))} />
                <SelectField
                  label="Team"
                  value={TEAM_OPTIONS.includes(selectedUser.team as Team) ? selectedUser.team : Team.ENGINEERING}
                  options={TEAM_OPTIONS}
                  onChange={(v) => {
                    const nextTeam = v as Team;
                    setUser(firstTeam.tempId, selectedUser.tempId, (curr) => {
                      const allowedRoles = TEAM_ROLE_OPTIONS[nextTeam] || [];
                      const nextRole = allowedRoles.includes(curr.role as Role) ? curr.role : (allowedRoles[0] || curr.role);
                      return { ...curr, team: nextTeam, role: nextRole };
                    });
                  }}
                />
                <SelectField
                  label="Role"
                  value={selectedUser.role}
                  options={(TEAM_ROLE_OPTIONS[(TEAM_OPTIONS.includes(selectedUser.team as Team) ? selectedUser.team : Team.ENGINEERING) as Team] || []).map((v) => String(v))}
                  onChange={(v) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, role: v }))}
                />
                <SelectField label="Intent" value={selectedUser.assignmentIntent || 'PRIMARY'} options={ASSIGNMENT_INTENTS} onChange={(v) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, assignmentIntent: v as any }))} />
                <div className="flex items-center gap-4 md:col-span-2">
                  <CheckField label="Active" checked={selectedUser.isActive !== false} onChange={(checked) => setUser(firstTeam.tempId, selectedUser.tempId, (curr) => ({ ...curr, isActive: checked }))} />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No team member selected.</div>
            )}
            <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3">
              Assignment behavior is derived from each member's team:
              Engineering users become bundle owners, SVP users become bundle delivery assignees, and CMO users are assigned as CMO contacts.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MilestoneStrategyTab: React.FC<{ bundle: DemoScenarioBundle; onChange: (bundle: DemoScenarioBundle) => void }> = ({ bundle, onChange }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <NumberField label="Milestones" value={bundle.planning.milestoneCount} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, milestoneCount: v } })} />
      <NumberField label="Sprint Duration (weeks)" value={bundle.planning.sprintDurationWeeks} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, sprintDurationWeeks: v } })} />
      <SelectField label="Milestone Strategy" value={bundle.planning.milestoneDurationStrategy} options={['AUTO_DISTRIBUTE', 'FIXED_WEEKS']} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, milestoneDurationStrategy: v as any } })} />
      <NumberField label="Milestone Weeks" value={bundle.planning.milestoneDurationWeeks || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, milestoneDurationWeeks: v } })} />

      <SelectField label="Delivery Pattern" value={bundle.planning.deliveryPattern} options={DELIVERY_PATTERNS} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, deliveryPattern: v as any } })} />
      <SelectField label="Backlog Shape" value={bundle.planning.backlogShape} options={BACKLOG_SHAPES} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, backlogShape: v as any } })} />
      <NumberField label="Stories / Feature" value={bundle.planning.storiesPerFeatureTarget || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, storiesPerFeatureTarget: v } })} />
      <NumberField label="Features / Milestone" value={bundle.planning.featuresPerMilestoneTarget || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, featuresPerMilestoneTarget: v } })} />

      <NumberField label="Tasks / Story" value={bundle.planning.tasksPerStoryTarget || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, tasksPerStoryTarget: v } })} />
      <SelectField label="Capacity Mode" value={bundle.planning.capacityMode || 'TEAM_VELOCITY'} options={CAPACITY_MODES} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, capacityMode: v as any } })} />
      <NumberField label="Delivery Teams" value={bundle.planning.deliveryTeams || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, deliveryTeams: v } })} />
      <NumberField label="Velocity / Team" value={bundle.planning.sprintVelocityPerTeam || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, sprintVelocityPerTeam: v } })} />

      <NumberField label="Direct Capacity" value={bundle.planning.directSprintCapacity || 0} onChange={(v) => onChange({ ...bundle, planning: { ...bundle.planning, directSprintCapacity: v } })} />
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <CheckField label="Create Tasks Under Stories" checked={Boolean(bundle.planning.createTasksUnderStories)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, createTasksUnderStories: checked } })} />
      <CheckField label="Create Dependency Skeleton" checked={Boolean(bundle.planning.createDependencySkeleton)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, createDependencySkeleton: checked } })} />
      <CheckField label="Suggest Milestone Owners" checked={Boolean(bundle.planning.suggestMilestoneOwners)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, suggestMilestoneOwners: checked } })} />
      <CheckField label="Suggest Work Item Owners" checked={Boolean(bundle.planning.suggestWorkItemOwners)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, suggestWorkItemOwners: checked } })} />
      <CheckField label="Preallocate Stories To Sprints" checked={Boolean(bundle.planning.preallocateStoriesToSprints)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, preallocateStoriesToSprints: checked } })} />
      <CheckField label="Auto Link Milestones To Roadmap" checked={Boolean(bundle.planning.autoLinkMilestonesToRoadmap)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, autoLinkMilestonesToRoadmap: checked } })} />
      <CheckField label="Generate Draft Only" checked={Boolean(bundle.planning.generateDraftOnly)} onChange={(checked) => onChange({ ...bundle, planning: { ...bundle.planning, generateDraftOnly: checked } })} />
    </div>

    <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
      <CheckField label="Assign Some To SVP" checked={Boolean(bundle.assignmentRules.assignSomeToSvp)} onChange={(checked) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, assignSomeToSvp: checked } })} />
      <CheckField label="Leave Some Unassigned" checked={Boolean(bundle.assignmentRules.leaveSomeUnassigned)} onChange={(checked) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, leaveSomeUnassigned: checked } })} />
      <CheckField label="Assign Epics/Features To Owners" checked={Boolean(bundle.assignmentRules.assignEpicsAndFeaturesToOwners)} onChange={(checked) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, assignEpicsAndFeaturesToOwners: checked } })} />
      <CheckField label="Assign Stories/Tasks To Team" checked={Boolean(bundle.assignmentRules.assignStoriesAndTasksToTeamMembers)} onChange={(checked) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, assignStoriesAndTasksToTeamMembers: checked } })} />
      <NumberField label="Unassigned %" value={bundle.assignmentRules.unassignedPercentage} onChange={(v) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, unassignedPercentage: v } })} />
      <NumberField label="SVP Assignment %" value={bundle.assignmentRules.svpAssignmentPercentage} onChange={(v) => onChange({ ...bundle, assignmentRules: { ...bundle.assignmentRules, svpAssignmentPercentage: v } })} />
    </div>
  </div>
);

const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }> = ({ label, value, onChange, type = 'text', disabled }) => (
  <label className="space-y-1 block">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700" />
  </label>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <label className="space-y-1 block">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <input type="number" value={Number.isFinite(value) ? value : 0} disabled={disabled} onChange={(e) => onChange(Number(e.target.value || 0))} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700" />
  </label>
);

const SelectField: React.FC<{ label: string; value: string; options: string[]; onChange: (value: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="space-y-1 block">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  </label>
);

const CheckField: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

export default AdminSamples;
