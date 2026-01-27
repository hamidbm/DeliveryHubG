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

// Global declaration for the platform AI selection bridge
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Re-added readonly modifier to ensure identical modifiers for all declarations of 'aistudio' on the Window interface.
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
  const [currentPath, setCurrentPath] = useState('/');
  const [queryString, setQueryString] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check for API Key selection on boot
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for environments where the bridge might not be ready
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasApiKey(true);
    }
  };

  const searchParams = useMemo(() => new URLSearchParams(queryString), [queryString]);

  const navigationValue = {
    push: (url: string) => {
      const [path, query] = url.split('?');
      if (path && path.startsWith('/')) {
        setCurrentPath(path);
      }
      setQueryString(query || '');
      try {
        if (!window.location.origin.includes('blob')) {
          window.history.pushState({}, '', url);
        }
      } catch (e) {}
    },
    searchParams,
    currentPath,
    pathname: currentPath,
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]"></div>
        
        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-12 text-center shadow-2xl animate-fadeIn relative z-10">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-8 shadow-2xl shadow-blue-500/20 rotate-3">
            <i className="fas fa-robot"></i>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-4 uppercase">AI Core Authorization</h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">
            Nexus requires a valid Gemini API Key to power Infrastructure Mapping and Architecture Reasoning. Please select a key from a paid GCP project to continue.
          </p>
          
          <div className="space-y-4">
            <button 
              onClick={handleSelectKey}
              className="w-full py-4 bg-white text-slate-900 font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-50 transition-all shadow-xl active:scale-95"
            >
              Authorize Nexus AI
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-blue-400 transition-colors"
            >
              View Billing Documentation
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NavigationContext.Provider value={navigationValue}>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        {hasApiKey === null ? null : <RouterSwitcher />}
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
