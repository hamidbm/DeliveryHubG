
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NAV_ITEMS, BUNDLES, VENDORS, MILESTONES } from '../constants';
import { WikiSpace, Application, Bundle } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  // Global / Wiki Filter States
  selSpaceId?: string;
  setSelSpaceId?: (id: string) => void;
  activeBundle: string;
  setActiveBundle: (id: string) => void;
  activeApp?: string;
  setActiveApp?: (id: string) => void;
  activeVendor?: string;
  setActiveVendor?: (id: string) => void;
  selMilestone?: string;
  setSelMilestone?: (m: string) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  
  // Actions
  onCreateSpace?: () => void;
  
  // User
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab,
  selSpaceId = 'all',
  setSelSpaceId,
  activeBundle,
  setActiveBundle,
  activeApp = 'all',
  setActiveApp,
  activeVendor = 'all',
  setActiveVendor,
  selMilestone = 'all',
  setSelMilestone,
  searchQuery = '',
  setSearchQuery,
  onCreateSpace,
  userName = 'Alex Architect',
  userRole = 'Enterprise Architect',
  onLogout
}) => {
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    // Fetch contextual data for the sub-nav dropdowns
    fetch('/api/wiki/spaces').then(r => r.json()).then(setSpaces).catch(() => []);
    fetch('/api/applications').then(r => r.json()).then(setApplications).catch(() => []);
  }, []);

  const filteredApps = applications.filter(a => activeBundle === 'all' || a.bundleId === activeBundle);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Top Navbar */}
      <nav className="bg-slate-900 text-white h-16 fixed top-0 w-full z-50 flex items-center px-6 shadow-xl">
        <Link href="/" className="flex items-center space-x-3 mr-12 shrink-0 cursor-pointer">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <i className="fas fa-bolt text-white"></i>
          </div>
          <span className="font-bold text-xl tracking-tight">NexusDelivery</span>
        </Link>

        <div className="flex space-x-1 h-full overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-4 h-full flex items-center space-x-2 text-sm font-medium transition-colors border-b-2 shrink-0 ${
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

        <div className="ml-auto flex items-center space-x-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{userRole}</p>
          </div>
          <div className="group relative">
            <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center overflow-hidden cursor-pointer shadow-lg shadow-black/20">
               <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D8ABC&color=fff`} alt="avatar" />
            </div>
            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 hidden group-hover:block animate-fadeIn">
               <div className="px-4 py-2 border-b border-slate-50 mb-1">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
               </div>
               <Link href="/profile" className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer">
                 <i className="fas fa-user-circle"></i>
                 <span>Profile Settings</span>
               </Link>
               <button onClick={onLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition font-medium">
                 <i className="fas fa-sign-out-alt"></i>
                 <span>Sign Out</span>
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Layer 1: Contextual Sub-navigation & Filters Bar */}
      {/* This bar now consistently shows Space, Bundle, App, Milestone as requested */}
      <div className="bg-white border-b border-slate-200 h-14 fixed top-16 w-full z-40 flex items-center px-8 justify-between shadow-sm">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
          <FilterSelect label="Space" value={selSpaceId} onChange={setSelSpaceId!} options={spaces.map(s => ({ id: s._id || s.id!, name: s.name }))} />
          <FilterSelect label="Bundle" value={activeBundle} onChange={setActiveBundle} options={BUNDLES.map(b => ({ id: b.id, name: b.name }))} />
          <FilterSelect label="App" value={activeApp} onChange={setActiveApp!} options={filteredApps.map(a => ({ id: a.id, name: a.name }))} />
          <FilterSelect label="Milestone" value={selMilestone} onChange={setSelMilestone!} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
        </div>
        
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
            <input 
              type="text" 
              placeholder="Search repository..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-[11px] font-bold focus:border-blue-500 outline-none w-44 transition-all"
            />
          </div>
          
          <button 
            onClick={onCreateSpace}
            className="px-4 py-1.5 bg-slate-900 text-white text-[9px] font-black rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <i className="fas fa-plus"></i>
            Create Space
          </button>

          <div className="hidden xl:flex items-center space-x-2 text-slate-300 italic text-[9px] font-black uppercase tracking-widest">
            <i className="fas fa-shield-alt text-blue-500/50"></i>
            <span>Secure Tunnel</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mt-[7.5rem] p-6 flex-grow overflow-y-auto bg-[#F8FAFC]">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options }: any) => (
  <div className="flex items-center gap-2 whitespace-nowrap">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className="text-[11px] font-bold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-w-[100px]"
    >
      <option value="all">All {label}s</option>
      {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  </div>
);

export default Layout;
