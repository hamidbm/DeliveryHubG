'use client';

import React, { useState, useEffect, Suspense, createContext, useContext, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Applications from './components/Applications';
import AIInsights from './components/AIInsights';
import WorkItems from './components/WorkItems';
import Wiki from './components/Wiki';
import Milestones from './components/Milestones';
import Admin from './components/Admin';
import ArchitectureHub from './components/ArchitectureHub';
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import { Bundle, Application, WorkItem, WorkItemType } from './types';

// Fix: Redefined aistudio declaration to match the expected AIStudio type and readonly modifier from the environment.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    readonly aistudio: AIStudio;
  }
}

// Safe Routing Context for sandboxed environment
const NavigationContext = createContext<{
  push: (url: string) => void;
  searchParams: URLSearchParams;
  currentPath: string;
  pathname: string;
}>({
  push: () => {},
  searchParams: new URLSearchParams(),
  currentPath: '/',
  pathname: '/',
});

export function useRouter() {
  const ctx = useContext(NavigationContext);
  return {
    push: ctx.push,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
  };
}

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
}

export function usePathname() {
  return useContext(NavigationContext).pathname;
}

export default function Home() {
  // Use state-based routing to avoid browser history.pushState domain errors in sandboxes
  const [currentPath, setCurrentPath] = useState('/');
  const [queryString, setQueryString] = useState('');

  const searchParams = useMemo(() => new URLSearchParams(queryString), [queryString]);

  const navigationValue = {
    push: (url: string) => {
      // Parse URL for internal state update
      const [path, query] = url.split('?');
      if (path && path.startsWith('/')) {
        setCurrentPath(path);
      }
      setQueryString(query || '');
      
      // Attempt pushState only if origin matches to avoid "Script error" / Security block
      try {
        if (!window.location.origin.includes('blob')) {
          window.history.pushState({}, '', url);
        }
      } catch (e) {
        console.warn("Navigation: history.pushState suppressed due to sandbox constraints.");
      }
    },
    searchParams,
    currentPath,
    pathname: currentPath,
  };

  return (
    <NavigationContext.Provider value={navigationValue}>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <RouterSwitcher />
      </Suspense>
    </NavigationContext.Provider>
  );
}

function RouterSwitcher() {
  const { currentPath } = useContext(NavigationContext);

  if (currentPath === '/login') return <LoginPage />;
  if (currentPath === '/register') return <RegisterPage />;
  
  return <HomeContent />;
}

// Fix: Completed the truncated HomeContent component and added robust data fetching and layout integration.
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeApp, setActiveApp] = useState('all');
  const [activeVendor, setActiveVendor] = useState('all');
  const [selMilestone, setSelMilestone] = useState('all');
  const [activeEpic, setActiveEpic] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selSpaceId, setSelSpaceId] = useState('all');
  const [user, setUser] = useState<any>(null);
  const [externalTrigger, setExternalTrigger] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bRes, aRes, eRes, uRes] = await Promise.all([
          fetch('/api/bundles'),
          fetch('/api/applications'),
          fetch('/api/work-items?type=EPIC'),
          fetch('/api/auth/me')
        ]);
        if (bRes.ok) setBundles(await bRes.json());
        if (aRes.ok) setApplications(await aRes.json());
        if (eRes.ok) setEpics(await eRes.json());
        if (uRes.ok) {
          const userData = await uRes.json();
          setUser(userData.user);
        }
      } catch (err) {
        console.error("Home data fetch failed", err);
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard applications={applications} bundles={bundles} />;
      case 'applications':
        return <Applications filterBundle={activeBundle} applications={applications} bundles={bundles} />;
      case 'work-items':
        return (
          <WorkItems 
            applications={applications} 
            bundles={bundles} 
            selBundleId={activeBundle} 
            selAppId={activeApp} 
            selMilestone={selMilestone} 
            selEpicId={activeEpic} 
            searchQuery={searchQuery}
            externalTrigger={externalTrigger}
            onTriggerProcessed={() => setExternalTrigger(null)}
          />
        );
      case 'architecture':
        return (
          <ArchitectureHub 
            applications={applications} 
            bundles={bundles} 
            activeBundleId={activeBundle} 
            activeAppId={activeApp}
            onUpdateApplications={() => fetch('/api/applications').then(r => r.json()).then(setApplications)}
          />
        );
      case 'wiki':
        return (
          <Wiki 
            currentUser={user}
            selSpaceId={selSpaceId}
            selBundleId={activeBundle}
            selAppId={activeApp}
            selMilestone={selMilestone}
            searchQuery={searchQuery}
            bundles={bundles}
            applications={applications}
          />
        );
      case 'ai-insights':
        return <AIInsights applications={applications} bundles={bundles} />;
      case 'admin':
        return <Admin />;
      default:
        return <Dashboard applications={applications} bundles={bundles} />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      selSpaceId={selSpaceId}
      setSelSpaceId={setSelSpaceId}
      activeBundle={activeBundle}
      setActiveBundle={setActiveBundle}
      activeApp={activeApp}
      setActiveApp={setActiveApp}
      activeVendor={activeVendor}
      setActiveVendor={setActiveVendor}
      selMilestone={selMilestone}
      setSelMilestone={setSelMilestone}
      activeEpic={activeEpic}
      setActiveEpic={setActiveEpic}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      bundles={bundles}
      applications={applications}
      epics={epics}
      userName={user?.name}
      userRole={user?.role}
      onLogout={handleLogout}
      onCreateWorkItem={() => { setActiveTab('work-items'); setExternalTrigger('create-item'); }}
    >
      {renderActiveView()}
    </Layout>
  );
}
