
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

export const NAV_TOP = [
  { id: 'delivery', label: 'Delivery', icon: 'fa-gauge', href: '/' },
  { id: 'applications', label: 'Applications', icon: 'fa-cubes', href: '/applications' },
  { id: 'work-items', label: 'Work Items', icon: 'fa-tasks', href: '/?tab=work-items' },
  { id: 'architecture', label: 'Architecture', icon: 'fa-sitemap', href: '/?tab=architecture' },
  { id: 'wiki', label: 'Knowledge', icon: 'fa-book', href: '/?tab=wiki' },
  { id: 'admin', label: 'Admin', icon: 'fa-user-shield', href: '/?tab=admin' }
];

export const NAV_DELIVERY = [
  { id: 'dashboard', label: 'Dashboards', href: '/' },
  { id: 'program', label: 'Program', href: '/program' },
  { id: 'activities', label: 'Activities', href: '/activities/feed' },
  { id: 'ai-insights', label: 'AI Insights', href: '/?tab=ai-insights' }
];
