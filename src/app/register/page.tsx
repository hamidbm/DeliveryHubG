
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Role, Team, TEAM_ROLE_OPTIONS } from '../../types';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    team: Team.ENGINEERING,
    role: TEAM_ROLE_OPTIONS[Team.ENGINEERING][0]
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email, password: formData.password, rememberMe: true })
        });
        if (loginRes.ok) {
          window.location.assign('/');
          return;
        }
        setFormData({
          name: '',
          username: '',
          email: '',
          password: '',
          team: Team.ENGINEERING,
          role: TEAM_ROLE_OPTIONS[Team.ENGINEERING][0]
        });
        setSuccess('Account provisioned successfully. Please sign in.');
      } else {
        setError(data.error || 'Registration failed. Please contact your system administrator.');
      }
    } catch (err) {
      setError('A network error occurred. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 -left-20 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>

      <div className="max-w-xl w-full relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl mb-6 shadow-2xl shadow-blue-500/20 rotate-3 animate-fadeIn">
            <i className="fas fa-id-card text-4xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Access Provisioning</h1>
          <p className="text-slate-500 mt-2 font-medium">Register for DeliveryHub</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] p-10 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl flex items-center gap-3">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl flex items-center gap-3">
              <i className="fas fa-circle-check"></i>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  placeholder="Engineer Name"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  placeholder="first.last"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 max-w-[300px]"
                  placeholder="user@company.com"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Team</label>
                <div className="relative">
                  <select
                    value={formData.team}
                    onChange={(e) => {
                      const nextTeam = e.target.value as Team;
                      setFormData({
                        ...formData,
                        team: nextTeam,
                        role: TEAM_ROLE_OPTIONS[nextTeam][0]
                      });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer max-w-[300px]"
                  >
                    {Object.values(Team).map((teamValue) => (
                      <option key={teamValue} value={teamValue} className="bg-white text-slate-900">
                        {teamValue}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Role</label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer max-w-[300px]"
                  >
                    {TEAM_ROLE_OPTIONS[formData.team].map((roleValue) => (
                      <option key={roleValue} value={roleValue} className="bg-white text-slate-900">
                        {roleValue}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <i className="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Secure Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 max-w-[300px]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <i className="fas fa-circle-notch fa-spin"></i>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Register Account</span>
                    <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
                  </div>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200 text-center">
            <p className="text-slate-500 text-sm">
              Already have credentials?{' '}
              <Link
                href="/login"
                className="text-blue-600 font-bold hover:text-blue-500 transition cursor-pointer"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-[10px] mt-8 uppercase tracking-[0.2em] font-black">
          Security Protocol v4.0.2
        </p>
      </div>
    </div>
  );
}
