
import React from 'react';
import { Bundle, Vendor, Application, Role, WorkItem, Milestone, MilestoneStatus, WikiPage } from './types';

export const BUNDLES: Bundle[] = [
  { id: 'b1', name: 'GPS', description: 'Global Positioning Services and Logistics' },
  { id: 'b2', name: 'Member', description: 'Member services and identity management' },
  { id: 'b3', name: 'Claims', description: 'Core insurance claims processing' },
  { id: 'b4', name: 'Finance', description: 'Internal financial reporting and billing' },
];

export const VENDORS: Vendor[] = [
  { id: 'v1', name: 'Infosys' },
  { id: 'v2', name: 'Wipro' },
  { id: 'v3', name: 'Cognizant' },
  { id: 'v4', name: 'TCS' },
];

export const APPLICATIONS: Application[] = [
  { id: 'app1', name: 'RouteOptima', bundleId: 'b1', vendorCompanies: ['Infosys'], status: 'Active', health: 'Healthy', migrationProgress: 85 },
  { id: 'app2', name: 'MemberPortal V2', bundleId: 'b2', vendorCompanies: ['Wipro', 'Cognizant'], status: 'Migrating', health: 'Risk', migrationProgress: 45 },
  { id: 'app3', name: 'ClaimsProcessor', bundleId: 'b3', vendorCompanies: ['TCS'], status: 'Legacy', health: 'Healthy', migrationProgress: 10 },
  { id: 'app4', name: 'BillingCore', bundleId: 'b4', vendorCompanies: ['Infosys'], status: 'Decommissioned', health: 'Critical', migrationProgress: 0 },
  { id: 'app5', name: 'LogisticsHub', bundleId: 'b1', vendorCompanies: ['Cognizant'], status: 'Active', health: 'Healthy', migrationProgress: 90 },
];

export const WORK_ITEMS: WorkItem[] = [
  { id: 'wi1', title: 'Implement JWT Authentication', type: 'Feature', status: 'Done', applicationId: 'app2', assignedTo: 'John Doe', priority: 'High' },
  { id: 'wi2', title: 'Migrate DB to MongoDB Atlas', type: 'Epic', status: 'In Progress', applicationId: 'app2', assignedTo: 'Sarah Smith', priority: 'Critical' },
  { id: 'wi3', title: 'Refactor Legacy API Endpoints', type: 'Task', status: 'To Do', applicationId: 'app3', assignedTo: 'Mike Ross', priority: 'Medium' },
  { id: 'wi4', title: 'Azure Load Balancer Config', type: 'Feature', status: 'Review', applicationId: 'app1', assignedTo: 'Emma Watson', priority: 'High' },
];

export const MILESTONES: Milestone[] = [
  { id: 'm1', name: 'Environment Setup', applicationId: 'app2', vendorCompany: 'Wipro', status: MilestoneStatus.COMPLETED, dueDate: '2024-11-01' },
  { id: 'm2', name: 'MVP Launch', applicationId: 'app2', vendorCompany: 'Wipro', status: MilestoneStatus.IN_PROGRESS, dueDate: '2025-02-15' },
  { id: 'm3', name: 'Production Cutover', applicationId: 'app1', vendorCompany: 'Infosys', status: MilestoneStatus.PLANNED, dueDate: '2025-05-20' },
];

// Added missing required spaceId property to each WikiPage
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
