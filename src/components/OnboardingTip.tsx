'use client';

import React, { useState } from 'react';
import { useOnboarding } from '../lib/onboardingClient';

interface OnboardingTipProps {
  tipId: string;
  className?: string;
  iconClassName?: string;
}

const OnboardingTip: React.FC<OnboardingTipProps> = ({ tipId, className = '', iconClassName = '' }) => {
  const { tipsById, onboarding, dismissTip } = useOnboarding();
  const tip = tipsById?.[tipId];
  const dismissed = onboarding?.dismissedTips?.includes(tipId);
  const [open, setOpen] = useState(false);

  if (!tip || dismissed) return null;

  const close = () => setOpen(false);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="w-5 h-5 rounded-full border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 bg-white flex items-center justify-center text-[10px]"
        aria-label="What is this?"
      >
        <i className={`fas fa-circle-info ${iconClassName}`}></i>
      </button>

      {open && (
        <div className="absolute z-50 top-7 right-0 w-64 bg-white border border-slate-200 rounded-xl p-3 shadow-xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{tip.title}</div>
          <div className="text-xs text-slate-600 mt-1">{tip.body}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissTip(tipId);
              close();
            }}
            className="mt-3 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingTip;
