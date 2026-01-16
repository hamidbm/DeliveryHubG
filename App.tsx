
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Applications from './components/Applications';
import AIInsights from './components/AIInsights';
import WorkItems from './components/WorkItems';
import Wiki from './components/Wiki';
import Milestones from './components/Milestones';
import Admin from './components/Admin';
import ArchitectureHub from './components/ArchitectureHub';
import { Bundle, Application, WorkItem, WorkItemType } from './types';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
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
          setBundles(await bRes.json());
          setApplications(await aRes.json());
        } else router.push('/login');
      } catch (err) { router.push('/login'); }
      finally { setLoading(false); }
    }
    init();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'work-items') {
      fetch('/api/work-items').then(r => r.json()).then(items => {
        setEpics(items.filter((i: WorkItem) => i.type === WorkItemType.EPIC));
      });
    }
  }, [activeTab]);

  if (loading || !user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard applications={applications} bundles={bundles} />;
      case 'applications': return <Applications filterBundle={activeBundle} applications={applications} bundles={bundles} />;
      case 'architecture': return <ArchitectureHub applications={applications} />;
      case 'ai-insights': return <AIInsights applications={applications} bundles={bundles} />;
      case 'work-items': return <WorkItems applications={applications} bundles={bundles} selBundleId={activeBundle} selAppId={activeApp} selMilestone="all" selEpicId="all" searchQuery="" />;
      case 'wiki': return <Wiki currentUser={user} selSpaceId="all" selBundleId={activeBundle} selAppId={activeApp} selMilestone="all" searchQuery="" bundles={bundles} applications={applications} />;
      case 'reviews': return <Milestones applications={applications} bundles={bundles} />;
      case 'admin': return <Admin />;
      default: return null;
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
      onLogout={() => { fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login')); }}
    >
      {renderContent()}
    </Layout>
  );
}
