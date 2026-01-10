
import React from 'react';
import { APPLICATIONS, BUNDLES } from '../constants';

interface ApplicationsProps {
  filterBundle: string;
}

const Applications: React.FC<ApplicationsProps> = ({ filterBundle }) => {
  const filteredApps = filterBundle === 'all' 
    ? APPLICATIONS 
    : APPLICATIONS.filter(app => app.bundleId === filterBundle);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Application Inventory</h1>
          <p className="text-slate-500">System of record for all enterprise software assets.</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center space-x-2">
          <i className="fas fa-plus"></i>
          <span>Add Application</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map(app => (
          <div key={app.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition group">
            <div className="p-6 border-b border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                    <i className="fas fa-cube text-xl"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition">{app.name}</h3>
                    <p className="text-xs text-slate-400 font-medium">{BUNDLES.find(b => b.id === app.bundleId)?.name} Bundle</p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-1">
                    <span>Migration Progress</span>
                    <span>{app.migrationProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        app.migrationProgress > 80 ? 'bg-emerald-500' :
                        app.migrationProgress > 40 ? 'bg-blue-500' : 'bg-slate-400'
                      }`}
                      style={{ width: `${app.migrationProgress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-medium uppercase">Vendors:</span>
                  <div className="flex -space-x-2">
                    {app.vendorCompanies.map((vendor, i) => (
                      <div key={i} title={vendor} className="w-6 h-6 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                        {vendor[0]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-50 flex justify-around">
               <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center space-x-1">
                 <i className="fas fa-cog"></i>
                 <span>Config</span>
               </button>
               <div className="w-[1px] h-4 bg-slate-200 self-center"></div>
               <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center space-x-1">
                 <i className="fas fa-file-invoice"></i>
                 <span>Docs</span>
               </button>
               <div className="w-[1px] h-4 bg-slate-200 self-center"></div>
               <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition flex items-center space-x-1">
                 <i className="fas fa-external-link-alt"></i>
                 <span>Site</span>
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: any) => {
  const styles: any = {
    Active: 'bg-emerald-100 text-emerald-700',
    Legacy: 'bg-amber-100 text-amber-700',
    Migrating: 'bg-blue-100 text-blue-700',
    Decommissioned: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${styles[status]}`}>
      {status}
    </span>
  );
};

export default Applications;
