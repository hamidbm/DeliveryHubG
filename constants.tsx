
import React from 'react';
import { Bundle, Application, WorkItem, Milestone, MilestoneStatus, WikiPage, WorkItemType, WorkItemStatus } from './types';

// Hard-coded lists removed to enforce dynamic fetching from MongoDB
export const BUNDLES: Bundle[] = [];

export const VENDORS = [
  { id: 'v1', name: 'Infosys' },
  { id: 'v2', name: 'Wipro' },
  { id: 'v3', name: 'Cognizant' },
  { id: 'v4', name: 'TCS' },
];

export const APPLICATIONS: Application[] = [];

// Fix: Corrected WorkItem properties to use defined enums (WorkItemType, WorkItemStatus) and exact uppercase string literals for priority.
// Added missing required properties 'key' and 'bundleId' to satisfy WorkItem interface.
export const WORK_ITEMS: WorkItem[] = [
  { id: 'wi1', key: 'WI-1', bundleId: 'b1', title: 'Implement JWT Authentication', type: WorkItemType.FEATURE, status: WorkItemStatus.DONE, applicationId: 'app2', assignedTo: 'John Doe', priority: 'HIGH' },
  { id: 'wi2', key: 'WI-2', bundleId: 'b1', title: 'Migrate DB to MongoDB Atlas', type: WorkItemType.EPIC, status: WorkItemStatus.IN_PROGRESS, applicationId: 'app2', assignedTo: 'Sarah Smith', priority: 'CRITICAL' },
  { id: 'wi3', key: 'WI-3', bundleId: 'b2', title: 'Refactor Legacy API Endpoints', type: WorkItemType.TASK, status: WorkItemStatus.TODO, applicationId: 'app3', assignedTo: 'Mike Ross', priority: 'MEDIUM' },
  { id: 'wi4', key: 'WI-4', bundleId: 'b1', title: 'Azure Load Balancer Config', type: WorkItemType.FEATURE, status: WorkItemStatus.REVIEW, applicationId: 'app1', assignedTo: 'Emma Watson', priority: 'HIGH' },
];

// Fix: Added required 'startDate' and 'endDate' properties to Milestone entries.
// Fix: Replaced invalid 'COMPLETED' with 'RELEASED' and 'IN_PROGRESS' with 'ACTIVE' to match MilestoneStatus enum.
export const MILESTONES: Milestone[] = [
  { id: 'm1', name: 'Environment Setup', applicationId: 'app2', vendorCompany: 'Wipro', status: MilestoneStatus.RELEASED, dueDate: '2024-11-01', startDate: '2024-10-01', endDate: '2024-11-01' },
  { id: 'm2', name: 'MVP Launch', applicationId: 'app2', vendorCompany: 'Wipro', status: MilestoneStatus.ACTIVE, dueDate: '2025-02-15', startDate: '2024-11-15', endDate: '2025-02-15' },
  { id: 'm3', name: 'Production Cutover', applicationId: 'app1', vendorCompany: 'Infosys', status: MilestoneStatus.PLANNED, dueDate: '2025-05-20', startDate: '2025-03-01', endDate: '2025-05-20' },
];

export const WIKI_PAGES: WikiPage[] = [
  { id: 'w1', title: 'Getting Started', content: '## Welcome\nThis is the core onboarding documentation for the platform.', spaceId: 'default' },
  { id: 'w2', title: 'Architecture Standards', content: '### Cloud Standards\nAll applications must follow the 12-factor app methodology.', spaceId: 'default' },
  { id: 'w3', title: 'Deployment Guide', content: 'Use the standard CI/CD pipeline defined in Jenkins.', parentId: 'w2', spaceId: 'default' },
];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboards', icon: 'fa-chart-pie' },
  { id: 'applications', label: 'Applications', icon: 'fa-cubes' },
  { id: 'work-items', label: 'Work Items', icon: 'fa-tasks' },
  { id: 'documents', label: 'Documents', icon: 'fa-file-alt' },
  { id: 'reviews', label: 'Reviews', icon: 'fa-clipboard-check' },
  { id: 'wiki', label: 'Wiki', icon: 'fa-book' },
  { id: 'ai-insights', label: 'AI Insights', icon: 'fa-robot' },
  { id: 'admin', label: 'Admin', icon: 'fa-user-shield' },
];
