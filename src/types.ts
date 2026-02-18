
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
  PLANNED = 'Planned',
  ACTIVE = 'Active',
  RELEASED = 'Released',
  CANCELLED = 'Cancelled',
  DELAYED = 'Delayed'
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
  SUBTASK = 'SUBTASK'
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
  format: DiagramFormat;
  content: string; 
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
  capabilityIds?: string[];
  tags?: string[];
  createdBy: string;
  updatedAt: string;
  status: 'DRAFT' | 'VERIFIED' | 'OBSOLETE';
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
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  links?: WorkItemLink[];
  rank?: number;
  storyPoints?: number;
  timeEstimate?: number;
  timeLogged?: number;
  isFlagged?: boolean;
  watchers?: string[];
  labels?: string[];
  comments?: WorkItemComment[];
  activity?: WorkItemActivity[];
  attachments?: WorkItemAttachment[];
  checklists?: ChecklistItem[]; 
}

export interface ChecklistItem { id: string; label: string; isCompleted: boolean; createdAt: string; }
export interface WorkItemComment { _id?: string; author: string; body: string; createdAt: string; }
export interface WorkItemLink { type: 'BLOCKS' | 'IS_BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES' | 'IS_DUPLICATED_BY'; targetId: string; targetKey?: string; targetTitle?: string; }
export interface WorkItemActivity { _id?: string; user: string; action: string; field?: string; from?: any; to?: any; createdAt: string; }
export interface WorkItemAttachment { name: string; size: number; type: string; url: string; uploadedBy: string; createdAt: string; }
export interface Notification { _id?: string; recipient: string; sender: string; type: 'MENTION' | 'IMPEDIMENT' | 'ASSIGNMENT' | 'SYSTEM'; message: string; link?: string; read: boolean; createdAt: string; }
export interface Sprint { _id?: string; id?: string; name: string; startDate?: string; endDate?: string; goal?: string; status: 'PLANNED' | 'ACTIVE' | 'CLOSED'; bundleId?: string; applicationId?: string; createdAt?: string; }

export interface Milestone {
  _id?: string;
  id?: string;
  name: string;
  applicationId?: string;
  bundleId?: string;
  vendorCompany?: string;
  status: MilestoneStatus;
  goal?: string;
  dueDate: string;
  startDate: string;
  endDate: string;
  targetCapacity?: number;
  createdAt?: string;
  updatedAt?: string;
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
  resource: { type: string; id: string };
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
  actor: CommentAuthor;
  resource: { type: string; id: string; title?: string };
  context?: { bundleId?: string; appId?: string; docType?: string };
  payload?: any;
  visibility?: { scope: string; teamIds?: string[] };
  correlationId?: string;
}
export interface ReviewReviewer {
  userId: string;
  role?: string;
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
  status: 'requested' | 'in_review' | 'feedback_sent' | 'vendor_addressing' | 'resubmitted' | 'closed';
  requestedBy: CommentAuthor;
  requestedAt: string;
  reviewers: ReviewReviewer[];
  dueAt?: string;
  completedAt?: string;
  notes?: string;
  evidence?: {
    attachments?: any[];
  };
  decision?: ReviewCycleDecision;
  correlationId: string;
}
export interface ReviewRecord {
  _id?: string;
  resource: { type: string; id: string; title?: string };
  status: 'active' | 'closed';
  createdBy: CommentAuthor;
  createdAt: string;
  updatedAt?: string;
  currentCycleId: string;
  cycles: ReviewCycle[];
  resourceVersion?: { versionId?: string; contentHash?: string };
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
