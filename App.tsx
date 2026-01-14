
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Applications from './components/Applications';
import AIInsights from './components/AIInsights';
import WorkItems from './components/WorkItems';
import Wiki from './components/Wiki';
import Milestones from './components/Milestones';
import GovernanceDocuments from './components/GovernanceDocuments';
import Admin from './components/Admin';
import { Bundle, Application } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
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
  
  // Trigger for child components
  const [wikiTrigger, setWikiTrigger] = useState<string | null>(null);
  const [workItemTrigger, setWorkItemTrigger] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        }
      } catch (err) {
        console.error("Nexus Registry Sync Failed", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard applications={applications} bundles={bundles} />;
      case 'applications':
        return <Applications filterBundle={activeBundle} applications={applications} bundles={bundles} />;
      case 'ai-insights':
        return <AIInsights applications={applications} bundles={bundles} />;
      case 'work-items':
        return (
          <WorkItems 
            applications={applications} 
            bundles={bundles}
            selBundleId={activeBundle}
            selAppId={activeApp}
            selMilestone={selMilestone}
            searchQuery={searchQuery}
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
            <h2 className="text-xl font-bold">Under Construction</h2>
            <p>NexusDelivery engineers are building this view.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Synchronizing Registry...</p>
        </div>
      </div>
    );
  }

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
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      bundles={bundles}
      applications={applications}
      onCreateSpace={() => setWikiTrigger('create-space')}
      onCreateWorkItem={() => setWorkItemTrigger('create-item')}
      userName={user?.name}
      userRole={user?.role}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
