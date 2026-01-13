
import React from 'react';
import { Application, Bundle } from '../types';

interface ApplicationsProps {
  filterBundle: string;
  applications: Application[];
  bundles: Bundle[];
}

const Applications: React.FC<ApplicationsProps> = ({ filterBundle, applications = [], bundles = [] }) => {
  const filteredApps = filterBundle === 'all' 
    ? (applications || []) 
    : (applications || []).filter(app => String(app.bundleId) === String(filterBundle));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Application Inventory</h1>
          <p className="text-slate-500">System of record for enterprise software delivery assets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(filteredApps || []).map(app => (
          <div key={app._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition group">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <i className="fas fa-cube text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition">{app.name}</h3>
                    <p className="text-xs text-slate-400 font-medium">{(bundles || []).find(b => String(b._id) === String(app.bundleId))?.name || 'Unassigned'} Cluster</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{app.aid}</span>
                  <HealthBadge health={app.status.health} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Current Phase</span>
                  <span className="text-blue-600">{app.status.phase || 'Onboarding'}</span>
                </div>
                
                <p className="text-xs text-slate-400 line-clamp-2">{app.description || 'No system description provided.'}</p>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Ownership:</span>
                  <div className="flex -space-x-2">
                    {(app.owners || []).slice(0, 3).map((owner, i) => (
                      <div key={i} title={`${owner.name} (${owner.role})`} className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                        {owner.name[0]}
                      </div>
                    ))}
                    {(app.owners || []).length > 3 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                        +{(app.owners || []).length - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 flex justify-around">
               <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center space-x-1">
                 <i className="fas fa-cog"></i>
                 <span>Governance</span>
               </button>
               <div className="w-[1px] h-4 bg-slate-200 self-center"></div>
               <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center space-x-1">
                 <i className="fas fa-file-invoice"></i>
                 <span>Artifacts</span>
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const HealthBadge = ({ health }: any) => {
  const styles: any = {
    Healthy: 'bg-emerald-100 text-emerald-700',
    Risk: 'bg-amber-100 text-amber-700',
    Critical: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tight ${styles[health]}`}>
      {health}
    </span>
  );
};

export default Applications;
