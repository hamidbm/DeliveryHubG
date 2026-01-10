'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccess('Account provisioned successfully. Please sign in.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please provide all credentials.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/');
      } else {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setError('Connection to Nexus gateway timed out.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-500/30 rotate-3 hover:rotate-0 transition-transform duration-500 animate-fadeIn">
            <i className="fas fa-bolt text-4xl text-white"></i>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">NexusPortal</h1>
          <p className="text-slate-400 mt-2 font-medium">Enterprise Software Delivery Ecosystem</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-8">System Access</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-center gap-3 animate-shake">
              <i className="fas fa-shield-halved"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-2xl flex items-center gap-3 animate-fadeIn">
              <i className="fas fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Identity</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600 group-focus-within:text-blue-500 transition-colors">
                  <i className="fas fa-at"></i>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-700"
                  placeholder="nexus-id@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Passcode</label>
                <button type="button" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-tighter">Secure recovery</button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-600 group-focus-within:text-blue-500 transition-colors">
                  <i className="fas fa-key"></i>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-700 group-hover:border-slate-500'}`}>
                    {rememberMe && <i className="fas fa-check text-[10px] text-white"></i>}
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest select-none">Remember Me</span>
              </label>
              
              <div className="group relative">
                <i className="fas fa-circle-info text-slate-600 hover:text-blue-500 transition-colors cursor-help"></i>
                <div className="absolute bottom-full right-0 mb-3 w-56 p-3 bg-slate-800 border border-slate-700 rounded-xl text-[10px] text-slate-300 leading-relaxed shadow-2xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-20">
                  <p className="font-bold text-blue-400 mb-1 uppercase tracking-tighter">Extended Session (30 Days)</p>
                  Checking this ensures persistent access. For your security, avoid this on public or shared workstations to prevent unauthorized portal access.
                  <div className="absolute top-full right-2 w-2 h-2 bg-slate-800 border-r border-b border-slate-700 rotate-45 -translate-y-1"></div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              {loading ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Initialize Session</span>
                  <i className="fas fa-arrow-right-to-bracket text-xs group-hover:translate-x-1 transition-transform"></i>
                </div>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800/50 text-center">
            <p className="text-slate-500 text-sm">
              New to the platform?{' '}
              <Link href="/register" className="text-blue-500 font-bold hover:text-blue-400 transition">
                Request Provisioning
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            <i className="fas fa-lock"></i>
            <span>AES-256</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            <i className="fas fa-fingerprint"></i>
            <span>MFA READY</span>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
