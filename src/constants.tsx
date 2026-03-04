
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
  { id: 'program', label: 'Program', icon: 'fa-layer-group' },
  { id: 'architecture', label: 'Architecture', icon: 'fa-sitemap' },
  { id: 'wiki', label: 'Wiki', icon: 'fa-book' },
  { id: 'activities', label: 'Activities', icon: 'fa-bolt' },
  { id: 'ai-insights', label: 'AI Insights', icon: 'fa-robot' },
  { id: 'admin', label: 'Admin', icon: 'fa-user-shield' },
];
