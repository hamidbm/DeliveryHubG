
export enum Team {
  ENGINEERING = 'Engineering',
  SVP = 'SVP',
  CMO = 'CMO',
  MANAGEMENT = 'Management',
  BUSINESS = 'Business'
}

export enum Role {
  SVP_DELIVERY_LEAD = 'SVP Delivery Lead',
  SVP_PROJECT_MANAGER = 'SVP Project Manager',
  SVP_TECH_LEAD = 'SVP Tech Lead',
  SVP_ARCHITECT = 'SVP Architect',
  SVP_INFRA_LEAD = 'SVP Infra Lead',
  SVP_SME = 'SVP SME',
  ENGG_LEADER = 'Engg Leader',
  APP_LEADER = 'App Leader',
  OT_PM = 'OT PM',
  APP_SME = 'App SME',
  EA_LEADER = 'EA Leader',
  ENGINEERING_EA = 'Engineering EA',
  ENGINEERING_DBA = 'Engineering DBA',
  ENGINEERING_IT_OPS = 'Engineering IT OPs',
  CMO_MEMBER = 'CMO Member',
  MANAGEMENT = 'Management',
  BUSINESS = 'Business'
}

export const TEAM_ROLE_OPTIONS: Record<Team, Role[]> = {
  [Team.ENGINEERING]: [
    Role.ENGG_LEADER,
    Role.APP_LEADER,
    Role.OT_PM,
    Role.APP_SME,
    Role.EA_LEADER,
    Role.ENGINEERING_EA,
    Role.ENGINEERING_DBA,
    Role.ENGINEERING_IT_OPS
  ],
  [Team.SVP]: [
    Role.SVP_DELIVERY_LEAD,
    Role.SVP_PROJECT_MANAGER,
    Role.SVP_TECH_LEAD,
    Role.SVP_ARCHITECT,
    Role.SVP_INFRA_LEAD,
    Role.SVP_SME
  ],
  [Team.CMO]: [Role.CMO_MEMBER],
  [Team.MANAGEMENT]: [Role.MANAGEMENT],
  [Team.BUSINESS]: [Role.BUSINESS]
};

export enum MilestoneStatus {
  DRAFT = 'Draft',
  COMMITTED = 'Committed',
  PLANNED = 'Planned',
  ACTIVE = 'Active',
  IN_PROGRESS = 'In Progress',
  RELEASED = 'Released',
  DONE = 'Done',
  CANCELLED = 'Cancelled',
  DELAYED = 'Delayed',
  ARCHIVED = 'Archived'
}

export enum HierarchyMode {
  SPACE_BUNDLE_APP_MILESTONE = 'Space → Bundle → Application → Milestone',
  BUNDLE_MILESTONE_TYPE = 'Bundle → Milestone → Type',
  BUNDLE_TYPE_MILESTONE = 'Bundle → Type → Milestone',
  BUNDLE_TYPE = 'Bundle → Type',
  BUNDLE_APP_MILESTONE_TYPE = 'Bundle → Application → Milestone → Type',
  BUNDLE_APP_MILESTONE = 'Bundle → Application → Milestone',
  APP_MILESTONE_TYPE = 'Application → Milestone → Type',
  TYPE_APP_MILESTONE = 'Type → Application → Milestone',
  VENDOR_APP_MILESTONE_TYPE = 'Vendor → Application → Milestone → Type',
  SPACE_APP_MILESTONE_TYPE = 'Space → Application → Milestone → Type',
  SPACE_TYPE_APP_MILESTONE = 'Space → Type → Application → Milestone'
}

export enum WorkItemType {
  EPIC = 'EPIC',
  FEATURE = 'FEATURE',
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
  SUBTASK = 'SUBTASK',
  RISK = 'RISK',
  DEPENDENCY = 'DEPENDENCY'
}

export enum WorkItemStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED'
}

export enum TimeModelStatus {
  TOLERATE = 'TOLERATE',
  INVEST = 'INVEST',
  MIGRATE = 'MIGRATE',
  ELIMINATE = 'ELIMINATE'
}

export interface User {
  _id?: string;
  id?: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  team: Team;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttachmentRef {
  assetId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export type AssignmentType =
  | 'cmo_reviewer'
  | 'assigned_cmo'
  | 'bundle_owner'
  | 'svp'
  | 'observer';

export interface BundleAssignment {
  _id?: string;
  bundleId: string;
  userId: string;
  assignmentType: AssignmentType;
  active: boolean;
  isPrimary?: boolean;
  startAt?: string;
  endAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  notes?: string;
}

export interface BundleProfileMilestone {
  key: string;
  name: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status: 'not_started' | 'in_progress' | 'done' | 'blocked';
  deliverables?: string;
}

export interface BundleProfile {
  _id?: string;
  bundleId: string;
  status: 'on_track' | 'at_risk' | 'blocked' | 'unknown';
  statusSource?: 'manual' | 'computed';
  schedule: {
    milestones: BundleProfileMilestone[];
    uatPlannedStart?: string;
    uatPlannedEnd?: string;
    uatActualStart?: string;
    uatActualEnd?: string;
    goLivePlanned?: string;
    goLiveActual?: string;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: { userId: string; name: string };
}

export interface BusinessCapability {
  _id?: string;
  name: string;
  description: string;
  parentId?: string;
  level: number;
}

export interface AppInterface {
  _id?: string;
  sourceAppId: string;
  targetAppId: string;
  type: 'REST' | 'SOAP' | 'KAFKA' | 'DB_LINK' | 'FILE';
  dataCriticality: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'ACTIVE' | 'DEPRECATED' | 'PLANNED';
  contractUrl?: string;
  dataEntities?: string[];
  description?: string;
}

export enum DiagramFormat {
  MERMAID = 'MERMAID',
  DRAWIO = 'DRAWIO',
  IMAGE = 'IMAGE',
  PDF = 'PDF',
  MINDMAP = 'MINDMAP',
  MINDMAP_MD = 'MINDMAP_MD'
}

export interface ArchitectureDiagram {
  _id?: string;
  title: string;
  diagramType?: string;
  format: DiagramFormat;
  content: string; 
  contentHash?: string;
  documentTypeId?: string;
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
  capabilityIds?: string[];
  tags?: string[];
  sourceTemplateId?: string;
  createdFromTemplate?: boolean;
  createdFromUpload?: boolean;
  createdBy: string;
  updatedAt: string;
  status: 'DRAFT' | 'VERIFIED' | 'OBSOLETE';
  reviewSummary?: {
    reviewId?: string;
    reviewKeyId?: string;
    currentCycleId?: string;
    currentCycleStatus?: string;
    currentCycleNumber?: number;
    currentDueAt?: string;
    reviewers?: Array<{ userId: string; displayName: string; email?: string }>;
    story?: { id: string; key: string };
  };
}

export interface DiagramTemplate {
  _id?: string;
  key: string;
  name: string;
  description?: string;
  diagramType: string;
  format: 'mermaid' | 'drawio' | 'mindmap_md' | DiagramFormat;
  content: string;
  preview?: { kind: 'none' | 'base64' | 'url'; data?: string };
  tags?: string[];
  isActive: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface InfrastructureNode {
  _id?: string;
  name: string;
  type: 'K8S_CLUSTER' | 'VM_SCALE_SET' | 'SERVERLESS_FUNCTION' | 'DATABASE_INST';
  provider: 'AZURE' | 'AWS' | 'GCP' | 'ON_PREM';
  region: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  cpuUsage: number;
  memUsage: number;
  appsCount: number;
}

export interface AppTelemetry {
  timestamp: string;
  cpu: number;
  memory: number;
  latency: number;
  errorRate: number;
}

export interface Application {
  _id?: string;
  id?: string; 
  aid: string; 
  name: string;
  bundleId: string;
  bundleKey?: string;
  description?: string;
  tags?: string[];
  capabilityIds?: string[];
  techStack?: string[];
  cloudMetadata?: {
    provider: 'AZURE' | 'GCP' | 'AWS' | 'HYBRID';
    subscriptionId: string;
    environment: 'PROD' | 'UAT' | 'DEV';
    terraformCode?: string;
    lastAppliedAt?: string;
  };
  lifecycle?: {
    goLiveDate?: string;
    sunsetDate?: string;
    timeStatus?: TimeModelStatus;
    businessCriticality: 'MISSION_CRITICAL' | 'BUSINESS_CRITICAL' | 'SUPPORT';
  };
  status: {
    phase?: string;
    health: 'Healthy' | 'Risk' | 'Critical';
    lastStatusUpdateAt?: string;
    telemetry?: AppTelemetry[]; 
  };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Bundle {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  visibility?: 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
  wipLimits?: Record<string, number>;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkItem {
  _id?: string;
  id?: string;
  key: string;
  type: WorkItemType;
  title: string;
  description?: string;
  aiWorkPlan?: string; 
  status: WorkItemStatus;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  bundleId: string;
  applicationId?: string;
  milestoneIds?: string[];
  parentId?: string;
  sprintId?: string;
  assignedTo?: string;
  assigneeUserIds?: string[];
  assignedAt?: string;
  watcherUserIds?: string[];
  dueAt?: string;
  context?: { bundleId: string; appId?: string };
  scopeRef?: { type: 'bundle' | 'application' | 'initiative'; id: string; name: string };
  scopeDerivation?: 'direct' | 'unscoped_fallback';
  linkedResource?: { type: string; id: string; title?: string };
  reviewId?: string;
  reviewCycleId?: string;
  reviewCycleNumber?: number;
  reviewCycleStatus?: string;
  reviewRequestedBy?: { userId?: string; displayName?: string; email?: string };
  reviewNotes?: string;
  jira?: { host: string; key: string; issueId?: string; url?: string; lastSyncedAt?: string };
  reviewVendorResponse?: string;
  reviewVendorResponseAt?: string;
  reviewVendorResponseBy?: { userId?: string; displayName?: string; email?: string };
  reviewReviewerNote?: string;
  reviewFeedbackAttachments?: Array<{ assetId?: string; filename?: string; mimeType?: string; sizeBytes?: number }>;
  github?: {
    repo?: string;
    prs?: Array<{
      number: number;
      title: string;
      url: string;
      state: 'open' | 'closed' | 'merged';
      updatedAt: string;
      author?: string;
    }>;
    lastSyncedAt?: string;
  };
  dedupKey?: string;
  resolution?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  links?: WorkItemLink[];
  rank?: number;
  storyPoints?: number;
  timeEstimateHours?: number;
  timeEstimate?: number;
  timeLogged?: number;
  isFlagged?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  completedAt?: string;
  watchers?: string[];
  labels?: string[];
  comments?: WorkItemComment[];
  activity?: WorkItemActivity[];
  attachments?: WorkItemAttachment[];
  checklists?: ChecklistItem[]; 
  isBlocked?: boolean;
  linkSummary?: WorkItemLinkSummary;
  risk?: {
    probability: 1 | 2 | 3 | 4 | 5;
    impact: 1 | 2 | 3 | 4 | 5;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    area?: 'schedule' | 'cost' | 'scope' | 'security' | 'compliance' | 'operations' | 'vendor' | 'other';
    mitigation?: string;
  };
  dependency?: {
    blocking: boolean;
    dependsOn?: { type: 'bundle' | 'app' | 'external'; id?: string; name?: string };
  };
}

export interface ChecklistItem { id: string; label: string; isCompleted: boolean; createdAt: string; }
export interface WorkItemComment { _id?: string; author: string; body: string; createdAt: string; }
export interface WorkItemLink { type: 'BLOCKS' | 'RELATES_TO' | 'DUPLICATES'; targetId: string; targetKey?: string; targetTitle?: string; }
export type WorkItemLinkDerivedType = 'BLOCKS' | 'BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES' | 'DUPLICATED_BY';
export interface WorkItemLinkSummaryItem {
  type: WorkItemLinkDerivedType;
  targetId: string;
  targetKey?: string;
  targetTitle?: string;
  targetStatus?: WorkItemStatus;
}
export interface WorkItemLinkSummary {
  blocks: WorkItemLinkSummaryItem[];
  blockedBy: WorkItemLinkSummaryItem[];
  duplicates: WorkItemLinkSummaryItem[];
  duplicatedBy: WorkItemLinkSummaryItem[];
  relatesTo: WorkItemLinkSummaryItem[];
  openBlockersCount: number;
}
export interface WorkItemActivity { _id?: string; user: string; action: string; field?: string; from?: any; to?: any; createdAt: string; }
export interface WorkItemAttachment { assetId?: string; name: string; size: number; type: string; url: string; uploadedBy: string; createdAt: string; }

export interface ScopeChangeRequest {
  _id?: string;
  milestoneId: string;
  action: 'ADD_ITEMS' | 'REMOVE_ITEMS';
  workItemIds: string[];
  requestedBy: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
  before?: { committedPoints: number; targetCapacity?: number };
  after?: { committedPoints: number; targetCapacity?: number };
  allowOverCapacity?: boolean;
}
export interface Notification {
  _id?: string;
  recipient: string;
  sender: string;
  type: string;
  message: string;
  title?: string;
  body?: string;
  severity?: 'info' | 'warn' | 'critical';
  link?: string;
  read: boolean;
  createdAt: string;
}
export interface Sprint { _id?: string; id?: string; name: string; startDate?: string; endDate?: string; goal?: string; status: 'PLANNED' | 'ACTIVE' | 'CLOSED'; bundleId?: string; applicationId?: string; createdAt?: string; }

export interface BundleCapacity {
  _id?: string;
  bundleId: string;
  unit: 'POINTS_PER_SPRINT' | 'POINTS_PER_WEEK';
  value: number;
  updatedAt?: string;
  updatedBy?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface Milestone {
  _id?: string;
  id?: string;
  name: string;
  applicationId?: string;
  bundleId?: string;
  vendorCompany?: string;
  status: MilestoneStatus;
  ownerUserId?: string;
  ownerEmail?: string;
  goal?: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  targetCapacity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MilestoneRollup {
  milestoneId: string;
  policy?: {
    strategy: 'global' | 'bundle' | 'strictest';
    globalVersion: number;
    bundleVersions?: Array<{ bundleId: string; version: number }>;
  };
  dataQuality?: {
    score: number;
    issues: Array<{ key: string; count: number; detail: string }>;
  };
  staleness?: {
    staleCount: number;
    criticalStaleCount: number;
    blockedStaleCount: number;
    unassignedStaleCount: number;
    githubStaleCount: number;
  };
  forecast?: {
    estimatedCompletionDate: string;
    sprintsRemaining: number;
    varianceDays: number;
    band: 'on-track' | 'at-risk' | 'off-track';
    monteCarlo?: {
      enabled: boolean;
      iterations: number;
      remainingPointsUsed: number;
      p50: string;
      p80: string;
      p90: string;
      hitProbability: number;
      mean?: number;
      stdDev?: number;
    } | null;
  } | null;
  totals: {
    items: number;
    openItems: number;
    doneItems: number;
    blockedDerived: number;
    blockedStatus: number;
    overdueOpen: number;
  };
  warnings?: string[];
  capacity: {
    targetCapacity?: number;
    committedPoints: number;
    completedPoints: number;
    remainingPoints: number;
    committedHours: number;
    completedHours: number;
    remainingHours: number;
    isOverCapacity: boolean;
    capacityUtilization: number | null;
  };
  risks: {
    openBySeverity: { low: number; medium: number; high: number; critical: number };
    openTotal: number;
  };
  dependencies: {
    openBlockingDependencies: number;
  };
  schedule: {
    startDate?: string;
    endDate?: string;
    isLate: boolean;
    slipDays: number;
  };
  confidence: {
    score: number;
    band: 'high' | 'medium' | 'low';
    drivers: Array<{ key: string; detail: string }>;
  };
}

export interface CriticalPathResult {
  milestoneId: string;
  policy?: {
    strategy: 'global' | 'bundle' | 'strictest';
    globalVersion: number;
    bundleVersions?: Array<{ bundleId: string; version: number }>;
  };
  cycleDetected: boolean;
  cycleNodes?: Array<{ id: string; key?: string; title?: string }>;
  criticalPath: {
    nodes: Array<{
      id: string;
      key?: string;
      title?: string;
      status?: string;
      remainingPoints: number;
      sprintId?: string;
      bundleId?: string;
      milestoneIds?: string[];
      assignee?: string;
      watchersCount?: number;
      scope: 'IN_MILESTONE' | 'EXTERNAL';
    }>;
    remainingPoints: number;
  };
  nearCritical: Array<{ id: string; key?: string; title?: string; slackPoints: number }>;
  externalBlockers: Array<{
    blockerId: string;
    blockerKey?: string;
    blockerTitle?: string;
    blockedId: string;
    blockedKey?: string;
    blockedTitle?: string;
    blockerMilestoneId?: string;
    blockerBundleId?: string;
  }>;
  external: { includedNodes: number; depthUsed: number };
  nodesByScope: { inMilestone: number; external: number };
  nodes?: Array<{
    id: string;
    key?: string;
    title?: string;
    status?: string;
    bundleId?: string;
    milestoneIds?: string[];
    remainingPoints: number;
    scope: 'IN_MILESTONE' | 'EXTERNAL';
    isCritical: boolean;
    isNearCritical: boolean;
  }>;
  edges?: Array<{ fromId: string; toId: string }>;
  topActions: Array<{
    type: 'UNBLOCK' | 'ASSIGN' | 'SET_ESTIMATE' | 'REQUEST_ESTIMATE' | 'NOTIFY_OWNER' | 'SCOPE_REDUCE';
    itemId: string;
    key?: string;
    title?: string;
    bundleId?: string;
    milestoneIds?: string[];
    reason: string;
  }>;
}

export interface DeliveryPolicy {
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
    monteCarlo: {
      enabled: boolean;
      iterations: number;
      useCriticalPath: boolean;
      minSampleSize: number;
      pLevels: number[];
    };
  };
  criticalPath: {
    nearCriticalSlackPct: number;
    defaultIncludeExternal: boolean;
    defaultExternalDepth: number;
  };
  commitReview: {
    enabled: boolean;
    minHitProbability: number;
    blockIfP80AfterEndDate: boolean;
    blockOnExternalBlockers: boolean;
    maxCriticalStale: number;
    maxHighRisks: number;
    capacityOvercommitThreshold: number;
    drift: {
      enabled: boolean;
      majorSlipDays: number;
      majorHitProbDrop: number;
      majorDataQualityDrop: number;
      majorExternalBlockersIncrease: number;
      requireReReviewOnMajor: boolean;
    };
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
}

export interface CommitmentReview {
  milestoneId: string;
  canCommit: boolean;
  score: number;
  band: 'GREEN' | 'YELLOW' | 'RED';
  checks: Array<{ key: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string }>;
  snapshot: {
    rollup: MilestoneRollup;
    monteCarlo?: MilestoneRollup['forecast'] extends infer F ? F extends { monteCarlo?: infer M } ? M : undefined : undefined;
    capacitySignal?: { overcommitMax: number; horizonWeeks: number };
    criticalPath?: { externalCount: number; remainingPoints: number };
    staleness?: { criticalStaleCount: number };
  };
}

export interface WikiPage { id?: string; _id?: string; slug?: string; title: string; content: string; summary?: string; parentId?: string; spaceId: string; bundleId?: string; applicationId?: string; milestoneId?: string; documentTypeId?: string; createdAt?: string; updatedAt?: string; author?: string; lastModifiedBy?: string; version?: number; status?: 'Draft' | 'Published' | 'Archived'; themeKey?: string; }

export interface WikiAsset {
  _id?: string;
  id?: string;
  title: string;
  content: string; // Added content field to support Markdown extracted from assets
  spaceId: string;
  category?: string;
  tags?: string[];
  author: string;
  lastModifiedBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'Published' | 'Draft';
  themeKey?: string;
  applicationId?: string;
  bundleId?: string;
  milestoneId?: string;
  documentTypeId?: string;
  documentType?: string;
  artifactKind?: 'primary' | 'feedback';
  reviewContext?: {
    reviewId: string;
    cycleId: string;
    reviewedResourceType: string;
    reviewedResourceId: string;
    reviewedDocumentType?: string;
  };
  file: {
    originalName: string;
    ext: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256?: string;
  };
  storage: {
    provider: 'gridfs' | 'base64';
    objectKey: string; // The data or ID
  };
  preview: {
    status: 'pending' | 'ready' | 'failed';
    kind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' | 'sheet';
    objectKey?: string;
    meta?: {
      pageCount?: number;
      slideCount?: number;
      sheetNames?: string[];
    };
    error?: string | null;
  };
}

export interface WikiVersion extends WikiPage { versionedAt: string; pageId: string; }
export interface WikiSpace { _id?: string; id?: string; key: string; name: string; description?: string; icon?: string; color?: string; visibility: 'internal' | 'vendors' | 'specific'; createdAt?: string; defaultThemeKey?: string; }
export interface WikiTheme { _id?: string; key: string; name: string; description?: string; css: string; isActive: boolean; isDefault: boolean; createdAt?: string; updatedAt?: string; }
export interface WikiComment { author: string; body: string; createdAt: string; }
export interface CommentAuthor {
  userId: string;
  displayName: string;
  email?: string;
}
export interface CommentThread {
  _id?: string;
  resource: { type: string; id: string; title?: string };
  anchor?: { kind: string; data: any };
  status: 'open' | 'resolved';
  createdBy: CommentAuthor;
  createdAt: string;
  lastActivityAt: string;
  messageCount: number;
  participants: string[];
  reviewId?: string;
  reviewCycleId?: string;
}
export interface CommentMessage {
  _id?: string;
  threadId: string;
  author: CommentAuthor;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  mentions?: string[];
  attachments?: any[];
}
export interface EventRecord {
  _id?: string;
  ts: string;
  type: string;
  canonicalType?: string;
  category?: string;
  modulePrefix?: string;
  actor: CommentAuthor;
  resource: { type: string; id: string; title?: string };
  context?: { bundleId?: string; appId?: string; milestoneId?: string; documentTypeId?: string; docType?: string };
  payload?: any;
  visibility?: { scope: string; teamIds?: string[] };
  correlationId?: string;
}
export type FeedSeverity = 'info' | 'warn' | 'critical';
export interface FeedItem {
  id: string;
  occurredAt: string;
  actor?: { userId?: string; email?: string; name?: string };
  title: string;
  summary: string;
  severity: FeedSeverity;
  links: Array<{ label: string; href: string }>;
  rawType: string;
  canonicalType?: string;
  category?: string;
  modulePrefix?: string;
  raw?: any;
}
export interface ReviewReviewer {
  userId: string;
  displayName: string;
  email?: string;
}
export interface ReviewCycleDecision {
  outcome: 'acknowledged' | 'partially_accepted' | 'declined';
  decidedBy: CommentAuthor;
  decidedAt: string;
  rationale?: string;
}
export interface ReviewCycle {
  cycleId: string;
  number: number;
  status: 'requested' | 'in_review' | 'feedback_sent' | 'vendor_addressing' | 'closed';
  requestedBy: CommentAuthor;
  requestedAt: string;
  reviewers: ReviewReviewer[];
  reviewerUserIds?: string[];
  dueAt?: string;
  inReviewAt?: string;
  inReviewBy?: CommentAuthor;
  feedbackSentAt?: string;
  feedbackSentBy?: CommentAuthor;
  closedAt?: string;
  closedBy?: CommentAuthor;
  reviewerNote?: {
    body: string;
    createdAt: string;
    createdBy: CommentAuthor;
  };
  vendorResponse?: {
    body: string;
    submittedAt: string;
    submittedBy: CommentAuthor;
  };
  completedAt?: string;
  notes?: string;
  evidence?: {
    attachments?: AttachmentRef[];
  };
  feedbackAttachments?: AttachmentRef[];
  decision?: ReviewCycleDecision;
  correlationId: string;
}
export interface ReviewRecord {
  _id?: string;
  resource: { type: string; id: string; title?: string; bundleId?: string; applicationId?: string };
  status: 'active' | 'closed';
  createdBy: CommentAuthor;
  createdAt: string;
  updatedAt?: string;
  currentCycleId: string;
  currentCycleStatus?: ReviewCycle['status'];
  currentDueAt?: string;
  currentReviewerUserIds?: string[];
  currentRequestedAt?: string;
  currentRequestedByUserId?: string;
  cycles: ReviewCycle[];
  resourceVersion?: { versionId?: string; contentHash?: string; resourceUpdatedAtAtSubmission?: string };
}

export interface FeedbackPackage {
  _id?: string;
  resource: { type: string; id: string; title?: string };
  createdAt: string;
  importedBy: CommentAuthor;
  source: 'historical_import';
  effectiveAt?: string;
  summary?: string;
  attachments: AttachmentRef[];
  status: 'feedback_sent' | 'closed';
}
export interface UserEventState {
  userId: string;
  lastSeenAt: string;
  commentLastSeen?: Record<string, string>;
}
export interface TaxonomyCategory { _id?: string; id?: string; key: string; name: string; description?: string; icon?: string; isActive: boolean; sortOrder: number; }
export interface TaxonomyDocumentType { _id?: string; id?: string; key: string; name: string; categoryId: string; description?: string; icon?: string; isActive: boolean; sortOrder: number; audience?: string[]; lifecyclePhases?: string[]; defaultTemplate?: string; requiredMetadata?: { requiresBundle: boolean; requiresApplication: boolean; requiresMilestone: boolean; }; }

export interface WikiTemplate {
  _id?: string;
  name: string;
  documentTypeId: string;
  content: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
