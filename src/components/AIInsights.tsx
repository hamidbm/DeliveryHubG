import React, { useState, useEffect } from 'react';
import { Application, Bundle } from '../types';

interface AIInsightsProps {
  applications?: Application[];
  bundles?: Bundle[];
}

const AIInsights: React.FC<AIInsightsProps> = ({ applications = [], bundles = [] }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateAIReport = async () => {
    // Note: We trigger the AI even if applications state is empty because 
    // the API now fetches fresh registry data server-side for consistency.
    setLoading(true);
    try {
      const res = await fetch('/api/ai/portfolio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setInsight(data.summary || "Analysis unavailable.");
    } catch (err) {
      setInsight("Security protocol prevented AI synthesis. Ensure API services are reachable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateAIReport();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
            <i className="fas fa-robot text-blue-600"></i>
            <span>AI Portfolio Insights</span>
          </h1>
          <p className="text-slate-500">Automated risk assessment and delivery forecasting powered by Gemini.</p>
        </div>
        <button 
          onClick={generateAIReport}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          <span>Regenerate Analysis</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-sm font-bold text-slate-600 uppercase tracking-widest">Executive Intelligence Report</span>
          </div>
          <div className="p-8 prose prose-slate max-w-none">
            {loading ? (
              <div className="space-y-4">
                <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse"></div>
                <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
                <div className="h-4 bg-slate-100 rounded w-2/3 animate-pulse"></div>
              </div>
            ) : (
              <div className="text-slate-700 whitespace-pre-wrap">
                {insight || "Analyzing registry data..."}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl text-white shadow-lg">
              <h3 className="font-bold text-lg mb-2">Ask DeliveryHub AI</h3>
              <p className="text-blue-100 text-sm mb-4">Query your delivery metrics using natural language.</p>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="How many apps are at critical health?"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm placeholder:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button className="absolute right-2 top-2 text-white hover:text-blue-200">
                  <i className="fas fa-paper-plane"></i>
                </button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center space-x-2">
               <i className="fas fa-bolt text-amber-500"></i>
               <span>Quick Suggestions</span>
             </h3>
             <ul className="space-y-3">
               {[
                 "Review MemberPortal migration timeline.",
                 "Assess vendor resource allocation risks.",
                 "Architecture board approval pending for LLDs."
               ].map((tip, i) => (
                 <li key={i} className="flex items-start space-x-2 text-sm text-slate-600 border-l-2 border-slate-200 pl-3 py-1 hover:border-blue-500 transition cursor-pointer">
                   {tip}
                 </li>
               ))}
             </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
