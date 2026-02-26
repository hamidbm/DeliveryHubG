
import React, { useEffect, useState } from 'react';
import CapabilityMap from './CapabilityMap';
import IntegrationMatrix from './IntegrationMatrix';
import PortfolioStrategy from './PortfolioStrategy';
import InfrastructureExplorer from './InfrastructureExplorer';
import OpsCenter from './OpsCenter';
import GovernanceDocuments from './GovernanceDocuments';
import ArchitectureDiagrams from './ArchitectureDiagrams';
import { Application, Bundle } from '../types';
import { useSearchParams } from '../App';

interface ArchitectureHubProps {
  applications: Application[];
  bundles: Bundle[];
  activeBundleId?: string;
  activeAppId?: string;
  onUpdateApplications?: () => void;
}

type SubTab = 'capabilities' | 'integrations' | 'lifecycle' | 'diagrams' | 'infrastructure' | 'observability' | 'governance';

const ArchitectureHub: React.FC<ArchitectureHubProps> = ({ applications, bundles, activeBundleId = 'all', activeAppId = 'all', onUpdateApplications }) => {
  const searchParams = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('capabilities');

  const tabs = [
    { id: 'capabilities', label: 'Capabilities', icon: 'fa-layer-group' },
    { id: 'integrations', label: 'Integrations', icon: 'fa-network-wired' },
    { id: 'lifecycle', label: 'TIME Matrix', icon: 'fa-compass' },
    { id: 'diagrams', label: 'Diagrams', icon: 'fa-project-diagram' },
    { id: 'infrastructure', label: 'Infrastructure', icon: 'fa-server' },
    { id: 'observability', label: 'Ops Center', icon: 'fa-microscope' },
    { id: 'governance', label: 'Governance', icon: 'fa-file-shield' },
  ];

  const renderActiveView = () => {
    switch (activeSubTab) {
      case 'capabilities': return <CapabilityMap applications={applications} />;
      case 'integrations': return <IntegrationMatrix applications={applications} />;
      case 'lifecycle': return <PortfolioStrategy applications={applications} bundles={bundles} onUpdate={onUpdateApplications} />;
      case 'diagrams': return <ArchitectureDiagrams applications={applications} bundles={bundles} activeBundleId={activeBundleId} activeAppId={activeAppId} />;
      case 'infrastructure': return <InfrastructureExplorer applications={applications} onUpdate={onUpdateApplications} />;
      case 'observability': return <OpsCenter applications={applications} />;
      case 'governance': return <GovernanceDocuments />;
      default: return <CapabilityMap applications={applications} />;
    }
  };

  useEffect(() => {
    const sub = searchParams.get('subtab');
    const hasDiagramFocus = Boolean(searchParams.get('diagramId') || searchParams.get('focus') === 'review');
    if (sub && tabs.some((t) => t.id === sub)) {
      setActiveSubTab(sub as SubTab);
      return;
    }
    if (hasDiagramFocus) {
      setActiveSubTab('diagrams');
    }
  }, [searchParams]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Sub-Navigation Header */}
      <div className="bg-white px-8 py-4 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-6 shrink-0">
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Enterprise Architecture</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nexus EAM Plane</p>
          </div>
          <div className="h-8 w-[1px] bg-slate-100"></div>
          <nav className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as SubTab)}
                className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${
                  activeSubTab === tab.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-white hover:bg-blue-500'
                }`}
              >
                <i className={`fas ${tab.icon}`}></i>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:flex items-center gap-2 px-6 py-2 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-inner">
           <i className="fas fa-robot text-xs animate-pulse"></i>
           <span className="text-[9px] font-black uppercase tracking-widest">Gemini Architecture Sync Active</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[700px]">
        {renderActiveView()}
      </div>
    </div>
  );
};

export default ArchitectureHub;
