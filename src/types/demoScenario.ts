import type { DeliveryPlanInput } from '../types';

export type DemoScenario = {
  scenarioKey: string;
  scenarioName: string;
  demoTag?: string;
  resetBeforeInstall: boolean;
  bundles: DemoScenarioBundle[];
  defaults?: DemoScenarioDefaults;
};

export type DemoScenarioBundle = {
  tempId: string;
  key?: string;
  name: string;
  description?: string;
  applications: DemoScenarioApplication[];
  planning: DemoScenarioPlanning;
  teams: DemoScenarioTeam[];
  assignmentRules: DemoScenarioAssignmentRules;
};

export type DemoScenarioApplication = {
  tempId: string;
  aid?: string;
  key?: string;
  name: string;
  isActive?: boolean;
  status?: {
    phase?: string;
    health?: 'Healthy' | 'Risk' | 'Critical';
  };
};

export type DemoScenarioPlanning = Omit<DeliveryPlanInput, 'scopeType' | 'scopeId'>;

export type DemoScenarioTeam = {
  tempId: string;
  name: string;
  size?: number;
  users: DemoScenarioUser[];
};

export type DemoScenarioUser = {
  tempId: string;
  name: string;
  username?: string;
  email: string;
  team: string;
  role: string;
  isActive?: boolean;
  assignmentIntent?: 'PRIMARY' | 'SECONDARY' | 'NONE';
  isSvpCandidate?: boolean;
  isBundleOwnerCandidate?: boolean;
};

export type DemoScenarioAssignmentRules = {
  assignSomeToSvp: boolean;
  leaveSomeUnassigned: boolean;
  unassignedPercentage: number;
  svpAssignmentPercentage: number;
  assignEpicsAndFeaturesToOwners: boolean;
  assignStoriesAndTasksToTeamMembers: boolean;
};

export type DemoScenarioDefaults = {
  defaultPassword?: string;
};

export type DemoScenarioValidationResult = {
  valid: boolean;
  errors: Array<{
    path: string;
    code: string;
    message: string;
  }>;
  warnings?: string[];
};

export type BuiltBundlePlanInput = {
  bundleTempId: string;
  bundleName: string;
  bundleId: string;
  input: DeliveryPlanInput;
};

export type DemoScenarioPreviewResponse = {
  scenarioKey: string;
  scenarioName: string;
  bundlePreviews: Array<{
    bundleTempId: string;
    bundleId: string;
    bundleName: string;
    previewId: string;
    milestoneCount: number;
    sprintCount: number;
    roadmapPhaseCount: number;
    epicCount: number;
    featureCount: number;
    storyCount: number;
    taskCount: number;
  }>;
  totals: {
    bundles: number;
    applications: number;
    users: number;
    milestones: number;
    sprints: number;
    roadmapPhases: number;
    epics: number;
    features: number;
    stories: number;
    tasks: number;
  };
  warnings?: string[];
};

export type DemoScenarioInstallResponse = {
  scenarioKey: string;
  scenarioName: string;
  demoTag: string;
  bundlesCreatedOrUpdated: number;
  applicationsCreatedOrUpdated: number;
  usersCreatedOrUpdated: number;
  planRuns: Array<{
    bundleId: string;
    bundleName: string;
    previewId: string;
    runId: string;
    milestoneCount: number;
    sprintCount: number;
    roadmapPhaseCount: number;
    workItemCount: number;
  }>;
  totals: {
    milestones: number;
    sprints: number;
    roadmapPhases: number;
    workItems: number;
  };
};
