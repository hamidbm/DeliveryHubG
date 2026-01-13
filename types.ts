
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

export interface Bundle {
  _id?: string;
  id?: string; // Legacy/Compat
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
}

export interface ApplicationOwner {
  side: 'OT' | 'SVP';
  role: string;
  name: string;
  email: string;
  title?: string;
  isPrimary: boolean;
}

export interface Application {
  _id?: string;
  id?: string; // Legacy ID mapping
  aid: string; // Enterprise identifier
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
  owners?: ApplicationOwner[];
  vendor?: {
    company: string;
    contractRef?: string;
  };
  governance?: {
    sowSigned: boolean;
    sowDocId?: string;
    notes?: string;
  };
  isActive: boolean;
  migrationProgress?: number; // Legacy/Compat
  status_old?: 'Active' | 'Legacy' | 'Migrating' | 'Decommissioned'; // Legacy/Compat
  vendorCompanies?: string[]; // Legacy/Compat
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkItem {
  id: string;
  title: string;
  type: 'Epic' | 'Feature' | 'User Story' | 'Task';
  status: 'To Do' | 'In Progress' | 'Review' | 'Done';
  applicationId: string;
  assignedTo: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface Milestone {
  id: string;
  name: string;
  applicationId: string;
  vendorCompany: string;
  status: MilestoneStatus;
  dueDate: string;
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
  allowedVendorCompanies?: string[];
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
  createdById?: string;
  updatedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WikiPage {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  parentId?: string;
  spaceId: string; 
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
  vendorCompany?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  lastModifiedBy?: string;
  tags?: string[];
  readingTime?: number;
  version?: number;
  status?: 'Draft' | 'Published' | 'Archived';
  watchers?: string[];
  links?: {
    documentIds: string[];
  };
  themeKey?: string; 
}

export interface WikiComment {
  _id?: string;
  pageId: string;
  parentId?: string;
  author: string;
  authorRole?: string;
  content: string;
  createdAt: string;
}

export interface WikiTemplate {
  _id?: string;
  name: string;
  key: string;
  description: string;
  content: string;
  category: string;
}

export interface WikiVersion extends Omit<WikiPage, 'id'> {
  pageId: string;
  versionedAt: string;
}

export interface AppState {
  activeBundleId: string | 'all';
  activeVendorId: string | 'all';
  currentUser: {
    name: string;
    role: Role;
  };
}
