
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { NAV_ITEMS } from '../constants';
import { WikiSpace, Application, Bundle, WorkItem, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  activeEpic?: string;
  setActiveEpic?: (id: string) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  bundles: Bundle[];
  applications: Application[];
  epics?: WorkItem[];
  onCreateSpace?: () => void;
  onCreateWorkItem?: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, activeTab, setActiveTab, selSpaceId = 'all', setSelSpaceId, activeBundle, setActiveBundle, activeApp = 'all', setActiveApp,
  activeVendor = 'all', setActiveVendor, selMilestone = 'all', setSelMilestone, activeEpic = 'all', setActiveEpic, searchQuery = '',
  setSearchQuery, bundles = [], applications = [], epics = [], onCreateSpace, onCreateWorkItem, userName = 'Alex Architect',
  userRole = 'Enterprise Architect', onLogout
}) => {
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/wiki/spaces')
      .then(r => r.json())
      .then(data => setSpaces(Array.isArray(data) ? data : []))
      .catch(() => setSpaces([]));
    
    const fetchNotifs = () => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => setNotifications(Array.isArray(data) ? data : []))
        .catch(() => setNotifications([]));
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.addEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasImpediment = notifications.some(n => !n.read && n.type === 'IMPEDIMENT');

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
  };

  const filteredApps = (applications || []).filter(a => activeBundle === 'all' || a.bundleId === activeBundle);
  const showFilterBar = ['dashboard', 'applications', 'work-items', 'wiki', 'reviews', 'documents'].includes(activeTab);

  return (
    <div className="min-h-screen flex flex-col">
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

        <div className="ml-auto flex items-center space-x-6 shrink-0">
          <div className="relative" ref={notifRef}>
             <button 
               onClick={() => setIsNotifOpen(!isNotifOpen)}
               className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${isNotifOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
             >
                <i className={`fas fa-bell ${hasImpediment ? 'animate-bounce text-red-400' : ''}`}></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg">
                    {unreadCount}
                  </span>
                )}
             </button>
             
             {isNotifOpen && (
               <div className="absolute right-0 top-14 w-96 bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden animate-fadeIn z-[100]">
                  <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alert Registry</span>
                     <button onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))} className="text-[9px] font-bold text-blue-600 uppercase hover:underline">Mark all read</button>
                  </header>
                  <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                     {notifications.length === 0 ? (
                       <div className="p-12 text-center text-slate-300">
                          <i className="fas fa- Inbox text-4xl mb-4 opacity-20"></i>
                          <p className="text-[10px] font-black uppercase tracking-widest">System Clear</p>
                       </div>
                     ) : (
                       notifications.map(notif => (
                         <div key={notif._id} className={`p-5 border-b border-slate-50 flex gap-4 hover:bg-slate-50 transition-colors relative group ${!notif.read ? 'bg-blue-50/30' : ''}`}>
                            {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>}
                            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm ${
                              notif.type === 'IMPEDIMENT' ? 'bg-red-50 text-red-600' :
                              notif.type === 'ASSIGNMENT' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                               <i className={`fas ${notif.type === 'IMPEDIMENT' ? 'fa-flag' : notif.type === 'ASSIGNMENT' ? 'fa-user-plus' : 'fa-info-circle'}`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className={`text-xs leading-relaxed ${!notif.read ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{notif.message}</p>
                               <span className="text-[9px] font-bold text-slate-300 uppercase mt-1 block">{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {!notif.read && (
                              <button onClick={() => markRead(notif._id!)} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[8px] text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm">
                                <i className="fas fa-check"></i>
                              </button>
                            )}
                         </div>
                       ))
                     )}
                  </div>
               </div>
             )}
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{userRole}</p>
          </div>
          <div className="group relative">
            <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center overflow-hidden cursor-pointer shadow-lg shadow-black/20">
               <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || '')}&background=0D8ABC&color=fff`} alt="avatar" />
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

      {showFilterBar && (
        <div className="bg-white border-b border-slate-200 h-14 fixed top-16 w-full z-40 flex items-center px-8 justify-between shadow-sm">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
            {activeTab === 'wiki' && (
              <FilterSelect label="Space" value={selSpaceId} onChange={setSelSpaceId!} options={spaces.map(s => ({ id: s._id || s.id!, name: s.name }))} />
            )}
            <FilterSelect label="Bundle" value={activeBundle} onChange={setActiveBundle} options={bundles.map(b => ({ id: b._id, name: b.name }))} />
            <FilterSelect label="App" value={activeApp} onChange={setActiveApp!} options={filteredApps.map(a => ({ id: a._id, name: a.name }))} />
            <FilterSelect label="Milestone" value={selMilestone} onChange={setSelMilestone!} options={[...Array(10)].map((_, i) => ({ id: `M${i+1}`, name: `M${i+1}` }))} />
            {activeTab === 'work-items' && (
              <FilterSelect label="Epic" value={activeEpic} onChange={setActiveEpic!} options={epics.map(e => ({ id: e._id || e.id!, name: e.title }))} />
            )}
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
              <input 
                id="global-search-input"
                type="text" 
                placeholder="Search items... (/)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery?.(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-[11px] font-bold focus:border-blue-500 outline-none w-44 transition-all"
              />
            </div>
            
            {activeTab === 'wiki' ? (
              <button 
                onClick={onCreateSpace}
                className="px-4 py-1.5 bg-slate-900 text-white text-[9px] font-black rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-black/10"
              >
                <i className="fas fa-plus"></i>
                Create Space
              </button>
            ) : activeTab === 'work-items' ? (
              <button 
                onClick={onCreateWorkItem}
                className="px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-lg hover:bg-blue-700 transition-all uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/10"
              >
                <i className="fas fa-plus"></i>
                New Work Item (C)
              </button>
            ) : null}
          </div>
        </div>
      )}

      <main className={`${showFilterBar ? 'mt-[7.5rem]' : 'mt-16'} p-6 flex-grow overflow-y-auto bg-[#F8FAFC]`}>
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
