
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === 'true') {
      setSuccess('Account provisioned successfully. Please sign in.');
    }
  }, []);

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
        window.location.assign('/');
      } else {
        setError(data.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      window.location.assign('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 -right-20 w-80 h-80 bg-blue-200/40 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 -left-20 w-96 h-96 bg-indigo-200/40 rounded-full blur-[120px]"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-500/30 rotate-3 hover:rotate-0 transition-transform duration-500 animate-fadeIn">
            <i className="fas fa-bolt text-4xl text-white"></i>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">DeliveryHub</h1>
          <p className="text-slate-500 mt-2 font-medium">Enterprise Software Delivery Ecosystem</p>
        </div>

        <div className="bg-white/80 backdrop-blur-2xl border border-slate-200 rounded-[2.5rem] p-10 shadow-2xl">
          <h2 className="text-xl font-bold text-slate-900 mb-8">System Access</h2>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl flex items-center gap-3 animate-shake">
              <i className="fas fa-shield-halved"></i>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl flex items-center gap-3 animate-fadeIn">
              <i className="fas fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Identity</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <i className="fas fa-at"></i>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  placeholder="user@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Passcode</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <i className="fas fa-key"></i>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-5 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
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
                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300 group-hover:border-slate-400'}`}>
                    {rememberMe && <i className="fas fa-check text-[10px] text-white"></i>}
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest select-none">Remember Me</span>
              </label>
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
                  <span>Login</span>
                  <i className="fas fa-arrow-right-to-bracket text-xs group-hover:translate-x-1 transition-transform"></i>
                </div>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200 text-center">
            <p className="text-slate-500 text-sm">
              New to the platform?{' '}
              <Link
                href="/register"
                className="text-blue-600 font-bold hover:text-blue-500 transition cursor-pointer"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}} />
    </div>
  );
}
