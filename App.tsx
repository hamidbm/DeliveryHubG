
import React, { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Applications from './components/Applications';
import AIInsights from './components/AIInsights';
import WorkItems from './components/WorkItems';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeVendor, setActiveVendor] = useState('all');

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
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <i className="fas fa-book-open text-6xl mb-4 text-slate-200"></i>
            <h2 className="text-xl font-bold text-slate-600">Knowledge Base</h2>
            <p>Module implementation scheduled for Milestone 4.</p>
          </div>
        );
      case 'documents':
        return (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <i className="fas fa-folder-open text-6xl mb-4 text-slate-200"></i>
            <h2 className="text-xl font-bold text-slate-600">Governance Documents</h2>
            <p>Secure document vault implementation in progress.</p>
          </div>
        );
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

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      activeBundle={activeBundle}
      setActiveBundle={setActiveBundle}
      activeVendor={activeVendor}
      setActiveVendor={setActiveVendor}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
