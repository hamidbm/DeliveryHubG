"use client";

import React, { useMemo } from 'react';
import { useRouter } from '../App';
import { useOnboarding } from '../lib/onboardingClient';
import type { OnboardingRole } from '../types';

const OnboardingStartHere: React.FC = () => {
  const router = useRouter();
  const { onboarding, content, loading, updateRole, completeStep, dismissTip } = useOnboarding();

  const dismissed = onboarding?.dismissedTips?.includes('start_here');

  const steps = useMemo(() => {
    if (!onboarding || !content) return [];
    return content.steps?.[onboarding.role as OnboardingRole] || [];
  }, [onboarding, content]);

  const completed = new Set(onboarding?.completedSteps || []);
  const progress = steps.length ? Math.round((Array.from(completed).filter((id) => steps.some((s) => s.id === id)).length / steps.length) * 100) : 0;

  if (loading || !onboarding || !content || dismissed) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Here</div>
          <div className="text-lg font-semibold text-slate-800">Role-based quickstart checklist</div>
        </div>
        <button
          onClick={() => dismissTip('start_here')}
          className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</span>
          <select
            value={onboarding.role}
            onChange={(e) => updateRole(e.target.value as OnboardingRole)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
          >
            {content.roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-2 bg-blue-600" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step) => {
          const done = completed.has(step.id);
          return (
            <div key={step.id} className={`flex flex-col md:flex-row md:items-center gap-3 border border-slate-100 rounded-xl p-3 ${done ? 'bg-emerald-50/40' : 'bg-white'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {done ? 'Completed' : 'Step'}
                  </span>
                  {done && <i className="fas fa-check text-emerald-600 text-xs"></i>}
                </div>
                <div className="text-sm font-semibold text-slate-800">{step.title}</div>
                <div className="text-xs text-slate-500">{step.why}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    router.push(step.cta.href);
                    completeStep(step.id);
                  }}
                  className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white hover:bg-blue-600"
                >
                  {step.cta.label}
                </button>
                {!done && (
                  <button
                    onClick={() => completeStep(step.id)}
                    className="px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700"
                  >
                    Mark done
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {steps.length === 0 && (
          <div className="text-sm text-slate-400">No steps configured for this role yet.</div>
        )}
      </div>
    </div>
  );
};

export default OnboardingStartHere;
