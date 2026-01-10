
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

export interface Bundle {
  id: string;
  name: string;
  description: string;
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

export interface WikiPage {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  parentId?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  lastModifiedBy?: string;
  tags?: string[];
  readingTime?: number;
  version?: number;
  status?: 'Draft' | 'Published' | 'Archived';
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
