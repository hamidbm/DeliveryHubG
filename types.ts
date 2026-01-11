
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
  APP_MILESTONE_TYPE = 'Application → Milestone → Type',
  TYPE_APP_MILESTONE = 'Type → Application → Milestone',
  VENDOR_APP_MILESTONE_TYPE = 'Vendor → Application → Milestone → Type',
  SPACE_APP_MILESTONE_TYPE = 'Space → Application → Milestone → Type',
  SPACE_TYPE_APP_MILESTONE = 'Space → Type → Application → Milestone'
}

export interface Bundle {
  _id?: string;
  id: string;
  name: string;
  description: string;
  applicationNames?: string[];
}

export interface Vendor {
  id: string;
  name: string;
}

export interface Application {
  id: string;
  name: string;
  bundleId: string;
  vendorCompanies: string[];
  status: 'Active' | 'Legacy' | 'Migrating' | 'Decommissioned';
  health: 'Healthy' | 'Risk' | 'Critical';
  migrationProgress: number;
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
  defaultThemeKey?: string; // New: Default theme for space
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
  themeKey?: string; // New: Specific theme for page
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
