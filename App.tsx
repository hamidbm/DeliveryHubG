
'use client';

import React, { useState, useEffect, Suspense, createContext, useContext, useMemo } from 'react';
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

// Safe Routing Context for sandboxed environment
const NavigationContext = createContext<{
  push: (url: string) => void;
  searchParams: URLSearchParams;
  currentPath: string;
}>({
  push: () => {},
  searchParams: new URLSearchParams(),
  currentPath: '/',
});

export function useRouter() {
  return useContext(NavigationContext);
}

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
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
  const { currentPath } = useRouter();

  if (currentPath === '/login') return <LoginPage />;
  if (currentPath === '/register') return <RegisterPage />;
  
  return <HomeContent />;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [epics, setEpics] = useState<WorkItem[]>([]);
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeApp, setActiveApp] = useState('all');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    async function init() {
      try {
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData = await authRes.json();
          setUser(authData.user);
          const [bRes, aRes] = await Promise.all([
            fetch('/api/bundles?active=true'),
            fetch('/api/applications?active=true')
          ]);
          
          const bData = await bRes.json();
          const aData = await aRes.json();
          
          setBundles(Array.isArray(bData) ? bData : []);
          setApplications(Array.isArray(aData) ? aData : []);
        } else {
          // If we're not logged in or API fails, provide demo context
          const devUser = { name: 'Demo Architect', role: 'Enterprise Architect', email: 'demo@nexus.com' };
          setUser(devUser);
          
          // Seed dummy data for preview
          setBundles([{ _id: 'b1', name: 'Strategic Portfolio', key: 'STRAT', isActive: true }]);
          setApplications([{ _id: 'a1', aid: 'APP100', name: 'Digital Core Banking', bundleId: 'b1', status: { health: 'Healthy' }, isActive: true }]);
        }
      } catch (err) { 
        setUser({ name: 'Demo Architect', role: 'Enterprise Architect' });
      } finally { 
        setLoading(false); 
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'work-items') {
      fetch('/api/work-items')
        .then(r => r.json())
        .then(items => {
          if (Array.isArray(items)) {
            setEpics(items.filter((i: WorkItem) => i.type === WorkItemType.EPIC));
          }
        })
        .catch(() => setEpics([]));
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium animate-pulse">Synchronizing Nexus Registry...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard applications={applications} bundles={bundles} />;
      case 'applications': return <Applications filterBundle={activeBundle} applications={applications} bundles={bundles} />;
      case 'architecture': return <ArchitectureHub applications={applications} bundles={bundles} activeBundleId={activeBundle} activeAppId={activeApp} />;
      case 'ai-insights': return <AIInsights applications={applications} bundles={bundles} />;
      case 'work-items': return <WorkItems applications={applications} bundles={bundles} selBundleId={activeBundle} selAppId={activeApp} selMilestone="all" selEpicId="all" searchQuery="" />;
      case 'wiki': return <Wiki currentUser={user} selSpaceId="all" selBundleId={activeBundle} selAppId={activeApp} selMilestone="all" searchQuery="" bundles={bundles} applications={applications} />;
      case 'reviews': return <Milestones applications={applications} bundles={bundles} />;
      case 'admin': return <Admin />;
      default: return <Dashboard applications={applications} bundles={bundles} />;
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange}
      activeBundle={activeBundle}
      setActiveBundle={setActiveBundle}
      activeApp={activeApp}
      setActiveApp={setActiveApp}
      bundles={bundles}
      applications={applications}
      epics={epics}
      userName={user.name}
      userRole={user.role}
      onLogout={() => { 
        fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.push('/login')); 
      }}
    >
      {renderContent()}
    </Layout>
  );
}
