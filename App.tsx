
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Applications from './components/Applications';
import AIInsights from './components/AIInsights';
import WorkItems from './components/WorkItems';
import Wiki from './components/Wiki';
import Milestones from './components/Milestones';
import GovernanceDocuments from './components/GovernanceDocuments';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Global / Contextual Filters
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeVendor, setActiveVendor] = useState('all');
  const [selSpaceId, setSelSpaceId] = useState('all');
  const [activeApp, setActiveApp] = useState('all');
  const [selMilestone, setSelMilestone] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Trigger for child components (e.g. opening "Create Space" modal in Wiki)
  const [wikiTrigger, setWikiTrigger] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'applications':
        return <Applications filterBundle={activeBundle} />;
      case 'ai-insights':
        return <AIInsights />;
      case 'work-items':
        return <WorkItems />;
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
          />
        );
      case 'reviews':
        return <Milestones />;
      case 'documents':
        return <GovernanceDocuments />;
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
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      // Contextual Filter Props
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
      
      // Actions
      onCreateSpace={() => setWikiTrigger('create-space')}

      // User Props
      userName={user?.name}
      userRole={user?.role}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
