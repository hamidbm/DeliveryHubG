
import React from 'react';
import { NAV_ITEMS, BUNDLES, VENDORS } from '../constants';
import { Role } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeBundle: string;
  setActiveBundle: (id: string) => void;
  activeVendor: string;
  setActiveVendor: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab,
  activeBundle,
  setActiveBundle,
  activeVendor,
  setActiveVendor
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Top Navbar */}
      <nav className="bg-slate-900 text-white h-16 fixed top-0 w-full z-50 flex items-center px-6 shadow-xl">
        <div className="flex items-center space-x-3 mr-12">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <i className="fas fa-bolt text-white"></i>
          </div>
          <span className="font-bold text-xl tracking-tight">NexusDelivery</span>
        </div>

        <div className="flex space-x-1 h-full">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-4 h-full flex items-center space-x-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === item.id 
                ? 'border-blue-500 bg-slate-800 text-white' 
                : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <i className={`fas ${item.icon}`}></i>
              <span className="hidden lg:block">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">Alex Architect</p>
            <p className="text-xs text-slate-400">{Role.ARCHITECT}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center overflow-hidden">
             <img src="https://picsum.photos/40/40?seed=user" alt="avatar" />
          </div>
        </div>
      </nav>

      {/* Sub-navigation & Filters Bar */}
      <div className="bg-white border-b border-slate-200 h-14 fixed top-16 w-full z-40 flex items-center px-6 justify-between shadow-sm">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bundle</label>
            <select 
              value={activeBundle} 
              onChange={(e) => setActiveBundle(e.target.value)}
              className="text-sm border rounded-md px-2 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Bundles</option>
              {BUNDLES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</label>
            <select 
              value={activeVendor}
              onChange={(e) => setActiveVendor(e.target.value)}
              className="text-sm border rounded-md px-2 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Vendors</option>
              {VENDORS.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-slate-400 italic text-xs">
          <i className="fas fa-clock"></i>
          <span>Last sync: 2 mins ago</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mt-32 p-6 flex-grow overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
