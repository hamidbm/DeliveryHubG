
import React from 'react';
import { Bundle, Application, WorkItem, Milestone, WikiPage } from './types';

export const BUNDLES: Bundle[] = [];
export const VENDORS = [
  { id: 'v1', name: 'Infosys' },
  { id: 'v2', name: 'Wipro' },
  { id: 'v3', name: 'Cognizant' },
  { id: 'v4', name: 'TCS' },
];
export const APPLICATIONS: Application[] = [];
export const WORK_ITEMS: WorkItem[] = [];
export const MILESTONES: Milestone[] = [];
export const WIKI_PAGES: WikiPage[] = [];

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboards', icon: 'fa-chart-pie' },
  { id: 'applications', label: 'Applications', icon: 'fa-cubes' },
  { id: 'work-items', label: 'Work Items', icon: 'fa-tasks' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'fa-server' },
  { id: 'ops-center', label: 'Ops Center', icon: 'fa-microscope' },
  { id: 'documents', label: 'Documents', icon: 'fa-file-alt' },
  { id: 'reviews', label: 'Reviews', icon: 'fa-clipboard-check' },
  { id: 'wiki', label: 'Wiki', icon: 'fa-book' },
  { id: 'ai-insights', label: 'AI Insights', icon: 'fa-robot' },
  { id: 'admin', label: 'Admin', icon: 'fa-user-shield' },
];
