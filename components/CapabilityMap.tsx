
import React, { useState, useEffect } from 'react';
import { BusinessCapability, Application } from '../types';

const CapabilityMap: React.FC<{ applications: Application[] }> = ({ applications }) => {
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated Capability Hierarchy
    const mockCaps: BusinessCapability[] = [
      { _id: 'c1', name: 'Commercial Banking', description: 'Core business functions', level: 1 },
      { _id: 'c2', name: 'Lending Services', description: 'Loan origination and servicing', level: 2, parentId: 'c1' },
      { _id: 'c3', name: 'Customer Identity', description: 'KYC and Onboarding', level: 2, parentId: 'c1' },
      { _id: 'c4', name: 'Payments', description: 'Domestic and International rails', level: 1 },
      { _id: 'c5', name: 'Swift Gateway', description: 'ISO 20022 compliance', level: 2, parentId: 'c4' }
    ];
    setCapabilities(mockCaps);
    setLoading(false);
  }, []);

  const getAppsForCap = (capId: string) => {
    return applications.filter(app => app.capabilityIds?.includes(capId));
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      <header>
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Business Capability Map</h2>
        <p className="text-slate-400 font-medium text-lg">Cross-mapping delivery assets to enterprise business functions.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {capabilities.filter(c => c.level === 1).map(rootCap => (
          <div key={rootCap._id} className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm hover:shadow-2xl transition-all">
            <div className="flex items-center gap-4 mb-8">
               <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                  <i className="fas fa-layer-group text-lg"></i>
               </div>
               <h3 className="text-2xl font-black text-slate-800">{rootCap.name}</h3>
            </div>

            <div className="space-y-6">
               {capabilities.filter(c => c.parentId === rootCap._id).map(subCap => {
                 const apps = getAppsForCap(subCap._id!);
                 return (
                   <div key={subCap._id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{subCap.name}</span>
                        <span className="text-[9px] font-bold text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm">{apps.length} Assets</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {apps.length > 0 ? apps.map(app => (
                          <div key={app._id} className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center gap-2 group cursor-pointer hover:border-blue-500 transition-colors">
                             <div className={`w-2 h-2 rounded-full ${app.status.health === 'Healthy' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                             <span className="text-xs font-bold text-slate-700">{app.name}</span>
                          </div>
                        )) : <span className="text-[9px] text-slate-300 italic">No applications mapped</span>}
                      </div>
                   </div>
                 );
               })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CapabilityMap;
