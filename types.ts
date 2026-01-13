
export enum Role {
  ARCHITECT = 'Enterprise Architect',
  INTERNAL_ENGINEER = 'Internal Engineer',
  VENDOR_ENGINEER = 'Vendor Engineer',
  VENDOR_MANAGER = 'Vendor Manager',
  PM = 'Program Manager',
  EXECUTIVE = 'Leadership / Executive',
  ADMIN = 'Admin'
}

export enum MilestoneStatus {
  PLANNED = 'Planned',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
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

export interface TaxonomyCategory {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface TaxonomyDocumentType {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  categoryId: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
  
  // Enterprise Metadata
  audience?: ('engineering' | 'security' | 'operations' | 'leadership' | 'program_management' | 'product' | 'finance' | 'audit')[];
  lifecyclePhases?: ('strategy' | 'plan' | 'design' | 'build' | 'test' | 'release' | 'operate' | 'improve' | 'retire')[];
  
  defaultTemplate?: string;
  requiredMetadata?: {
    requiresBundle: boolean;
    requiresApplication: boolean;
    requiresMilestone: boolean;
  };
}

export interface Bundle {
  _id?: string;
  id?: string; 
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
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
  lifecycle?: {
    plannedStartDate?: string;
    plannedEndDate?: string;
    goLiveDate?: string;
    hypercareStartDate?: string;
    hypercareEndDate?: string;
  };
  status: {
    phase?: string;
    health: 'Healthy' | 'Risk' | 'Critical';
    lastStatusUpdateAt?: string;
  };
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  owners?: {
    name: string;
    role: string;
  }[];
}

export interface WorkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  applicationId: string;
  assignedTo: string;
  priority: string;
}

export interface Milestone {
  id: string;
  name: string;
  applicationId: string;
  vendorCompany: string;
  status: MilestoneStatus;
  dueDate: string;
}

export interface WikiPage {
  id?: string;
  _id?: string;
  slug?: string;
  title: string;
  content: string;
  parentId?: string;
  spaceId: string; 
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
  documentTypeId?: string; 
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  lastModifiedBy?: string;
  version?: number;
  status?: 'Draft' | 'Published' | 'Archived';
  themeKey?: string; 
}

export interface WikiVersion extends WikiPage {
  versionedAt: string;
  pageId: string;
}

export interface WikiSpace {
  _id?: string;
  id?: string;
  key: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  visibility: 'internal' | 'vendors' | 'specific';
  createdAt?: string;
  defaultThemeKey?: string; 
}

export interface WikiTheme {
  _id?: string;
  key: string;
  name: string;
  description?: string;
  css: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}
