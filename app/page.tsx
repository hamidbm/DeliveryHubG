
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import Applications from '../components/Applications';
import AIInsights from '../components/AIInsights';
import WorkItems from '../components/WorkItems';
import Wiki from './../components/Wiki';
import Milestones from '../components/Milestones';
import GovernanceDocuments from '../components/GovernanceDocuments';
import Admin from '../components/Admin';
import { Bundle, Application } from '../types';

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
  
  // Dynamic Data Lists
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  // Global / Contextual Filters
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeVendor, setActiveVendor] = useState('all');
  const [selSpaceId, setSelSpaceId] = useState('all');
  const [activeApp, setActiveApp] = useState('all');
  const [selMilestone, setSelMilestone] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [wikiTrigger, setWikiTrigger] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Sync activeTab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    // Preserving pageId if switching back to wiki, otherwise clear it for clean state? 
    // Usually better to keep it if we are on wiki, but let's keep it simple.
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    async function init() {
      try {
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData = await authRes.json();
          setUser(authData.user);
          
          // Parallel fetch of bundles and applications
          const [bRes, aRes] = await Promise.all([
            fetch('/api/bundles?active=true'),
            fetch('/api/applications?active=true')
          ]);
          setBundles(await bRes.json());
          setApplications(await aRes.json());
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

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
      case 'dashboard':
        return <Dashboard applications={applications} bundles={bundles} />;
      case 'applications':
        return <Applications filterBundle={activeBundle} applications={applications} bundles={bundles} />;
      case 'ai-insights':
        return <AIInsights applications={applications} bundles={bundles} />;
      case 'work-items':
        return <WorkItems applications={applications} />;
      case 'wiki':
        return (
          <Wiki 
            currentUser={user}
            selSpaceId={selSpaceId}
            selBundleId={activeBundle}
            selAppId={activeApp}
            selMilestone={selMilestone}
            searchQuery={searchQuery}
            externalTrigger={wikiTrigger}
            onTriggerProcessed={() => setWikiTrigger(null)}
            bundles={bundles}
            applications={applications}
          />
        );
      case 'reviews':
        return <Milestones applications={applications} />;
      case 'documents':
        return <GovernanceDocuments />;
      case 'admin':
        return <Admin />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="fas fa-tools text-6xl mb-4"></i>
            <h2 className="text-xl font-bold text-slate-600">Module Under Construction</h2>
          </div>
        );
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange}
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
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      bundles={bundles}
      applications={applications}
      onCreateSpace={() => setWikiTrigger('create-space')}
      userName={user.name}
      userRole={user.role}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
}
