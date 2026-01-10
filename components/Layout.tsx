import React from 'react';
import Link from 'next/link';
import { NAV_ITEMS, BUNDLES, VENDORS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeBundle: string;
  setActiveBundle: (id: string) => void;
  activeVendor: string;
  setActiveVendor: (id: string) => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab,
  activeBundle,
  setActiveBundle,
  activeVendor,
  setActiveVendor,
  userName = 'Alex Architect',
  userRole = 'Enterprise Architect',
  onLogout
}) => {
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
            {/* Dropdown Menu */}
            <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 hidden group-hover:block animate-fadeIn">
               <div className="px-4 py-2 border-b border-slate-50 mb-1">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
               </div>
               <Link 
                href="/profile"
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer"
               >
                 <i className="fas fa-user-circle"></i>
                 <span>Profile Settings</span>
               </Link>
               <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition font-medium"
               >
                 <i className="fas fa-sign-out-alt"></i>
                 <span>Sign Out</span>
               </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sub-navigation & Filters Bar */}
      <div className="bg-white border-b border-slate-200 h-14 fixed top-16 w-full z-40 flex items-center px-6 justify-between shadow-sm overflow-x-auto">
        <div className="flex items-center space-x-6 shrink-0">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bundle</label>
            <select 
              value={activeBundle} 
              onChange={(e) => setActiveBundle(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
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
              className="text-sm border border-slate-200 rounded-lg px-3 py-1 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            >
              <option value="all">All Vendors</option>
              {VENDORS.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="hidden md:flex items-center space-x-2 text-slate-400 italic text-[10px] font-medium uppercase tracking-widest shrink-0">
          <i className="fas fa-shield-alt text-blue-500"></i>
          <span>Secure Session Active</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mt-32 p-6 flex-grow overflow-y-auto bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
