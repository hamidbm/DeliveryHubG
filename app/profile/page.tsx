
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '../../App';
import Layout from '../../components/Layout';
import { Role } from '../../types';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [role, setRole] = useState<Role | string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setRole(data.user.role);
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  const handleUpdate = async (e?: React.FormEvent, overrideRole?: Role) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate password only if user is trying to change it
    if (!overrideRole && password && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const targetRole = overrideRole || role;

    setUpdating(true);

    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: targetRole, 
          password: password || undefined 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Identity updated. You are now recognized as: ${targetRole}`);
        setPassword('');
        setConfirmPassword('');
        setRole(targetRole);
        // Synchronize local state with the new claims returned from the server
        setUser({ ...user, role: targetRole });
      } else {
        setError(data.error || 'The Nexus gateway rejected the update request.');
      }
    } catch (err) {
      setError('Connection to security services lost. Please retry.');
    } finally {
      setUpdating(false);
    }
  };

  const promoteToArchitect = () => {
    handleUpdate(undefined, Role.ARCHITECT);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Accessing Vault...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <Layout
      activeTab="profile"
      setActiveTab={() => {}}
      activeBundle="all"
      setActiveBundle={() => {}}
      activeVendor="all"
      setActiveVendor={() => {}}
      userName={user.name}
      userRole={user.role}
      onLogout={handleLogout}
      bundles={[]}
      applications={[]}
    >
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Profile Configuration</h1>
            <p className="text-slate-500 font-medium">Manage your system-wide identity and permission levels.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Encrypted Session Active
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Summary Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-8 sticky top-40 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
              
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-2xl mb-6">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=256`} 
                      alt="avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {user.role === Role.ARCHITECT && (
                    <div className="absolute top-0 right-4 w-8 h-8 bg-amber-400 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg rotate-12">
                      <i className="fas fa-crown text-[12px] text-white"></i>
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{user.name}</h2>
                <div className="inline-flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full mt-2 border border-slate-100">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{user.role}</span>
                  {user.role === Role.ARCHITECT && <i className="fas fa-certificate text-blue-500 text-[10px]"></i>}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-4">
                <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                    <i className="fas fa-envelope"></i>
                  </div>
                  <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                    <i className="fas fa-key"></i>
                  </div>
                  <span>Security Token Valid</span>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="w-full py-4 rounded-2xl bg-slate-950 text-white font-bold text-sm hover:bg-red-600 transition-all duration-300 shadow-lg shadow-black/10 flex items-center justify-center gap-3 group/logout"
              >
                <i className="fas fa-power-off text-xs group-hover/logout:rotate-90 transition-transform"></i>
                Terminate Session
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">System Permissions</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Account Registry v4.0</p>
                </div>
                <i className="fas fa-shield-halved text-blue-500/20 text-3xl"></i>
              </div>

              <form onSubmit={(e) => handleUpdate(e)} className="p-10 space-y-10">
                {error && (
                  <div className="p-5 bg-red-50 border border-red-100 text-red-600 text-sm rounded-[1.5rem] flex items-center gap-4 animate-shake">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <i className="fas fa-bolt"></i>
                    </div>
                    <span className="font-bold">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="p-5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-[1.5rem] flex items-center gap-4 animate-fadeIn">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <i className="fas fa-check"></i>
                    </div>
                    <span className="font-bold">{success}</span>
                  </div>
                )}

                {/* Role Sector */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <i className="fas fa-id-card"></i>
                      </div>
                      <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Access Node Level</h4>
                    </div>
                    
                    {user.role !== Role.ARCHITECT && (
                      <button 
                        type="button"
                        onClick={promoteToArchitect}
                        disabled={updating}
                        className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl uppercase tracking-[0.1em] hover:bg-amber-100 transition-all flex items-center gap-2 group/promote active:scale-95"
                      >
                        <i className="fas fa-crown group-hover/promote:rotate-12 transition-transform"></i>
                        Elevate to Architect
                      </button>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-700 appearance-none focus:outline-none focus:border-blue-500 transition-all cursor-pointer font-bold text-lg"
                    >
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                      <i className="fas fa-chevron-down"></i>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-2">
                    System Warning: Role changes affect delivery pod authorization.
                  </p>
                </div>

                {/* Security Sector */}
                <div className="space-y-6 pt-10 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                      <i className="fas fa-fingerprint"></i>
                    </div>
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Security Credentials</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">New Passcode</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-700 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-300 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Confirm Identity</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-slate-700 focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-300 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-[1.5rem] transition-all shadow-2xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 group/submit"
                  >
                    {updating ? (
                      <i className="fas fa-circle-notch fa-spin text-xl"></i>
                    ) : (
                      <>
                        <span className="uppercase tracking-[0.2em] text-sm">Commit Changes</span>
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center group-hover/submit:translate-x-1 transition-transform">
                           <i className="fas fa-arrow-right-to-bracket text-xs"></i>
                        </div>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}} />
    </Layout>
  );
}
