'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import Applications from '../components/Applications';
import AIInsights from '../components/AIInsights';
import WorkItems from '../components/WorkItems';

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeBundle, setActiveBundle] = useState('all');
  const [activeVendor, setActiveVendor] = useState('all');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium animate-pulse">Initializing Nexus Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'applications':
        return <Applications filterBundle={activeBundle} />;
      case 'ai-insights':
        return <AIInsights />;
      case 'work-items':
        return <WorkItems />;
      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <i className="fas fa-tools text-6xl mb-4"></i>
            <h2 className="text-xl font-bold text-slate-600">Module Under Construction</h2>
          </div>
        );
    }
  };

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      activeBundle={activeBundle}
      setActiveBundle={setActiveBundle}
      activeVendor={activeVendor}
      setActiveVendor={setActiveVendor}
      userName={user.name}
      userRole={user.role}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
}
