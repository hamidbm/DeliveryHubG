import { useEffect, useState } from 'react';
import type { UserOnboarding, OnboardingRole } from '../types';

export type OnboardingStep = {
  id: string;
  title: string;
  why: string;
  cta: { label: string; href: string };
};

export type OnboardingTip = {
  id: string;
  title: string;
  body: string;
};

export type ProgramHelpContent = {
  title: string;
  subtitle: string;
  bullets: string[];
};

export type OnboardingContent = {
  roles: OnboardingRole[];
  steps: Record<OnboardingRole, OnboardingStep[]>;
  tips: OnboardingTip[];
  programHelp?: ProgramHelpContent;
};

export type OnboardingResponse = {
  onboarding: UserOnboarding;
  content: OnboardingContent;
};

let cache: OnboardingResponse | null = null;
let inflight: Promise<OnboardingResponse> | null = null;
const listeners = new Set<(data: OnboardingResponse | null) => void>();

const notify = () => {
  listeners.forEach((fn) => fn(cache));
};

export const getOnboarding = async (): Promise<OnboardingResponse> => {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/api/user/onboarding')
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to load onboarding');
      return await res.json();
    })
    .then((data) => {
      cache = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export const patchOnboarding = async (body: any): Promise<OnboardingResponse> => {
  const res = await fetch('/api/user/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to update onboarding');
  }
  const data = await res.json();
  cache = data;
  notify();
  return data;
};

export const subscribeOnboarding = (fn: (data: OnboardingResponse | null) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useOnboarding = () => {
  const [data, setData] = useState<OnboardingResponse | null>(cache);
  const [loading, setLoading] = useState<boolean>(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!cache) {
      getOnboarding()
        .then((payload) => {
          if (mounted) {
            setData(payload);
            setLoading(false);
          }
        })
        .catch((err: any) => {
          if (mounted) {
            setError(err?.message || 'Failed to load onboarding');
            setLoading(false);
          }
        });
    }
    const unsubscribe = subscribeOnboarding((next) => {
      if (!mounted) return;
      setData(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updateRole = async (role: OnboardingRole) => {
    const updated = await patchOnboarding({ role });
    setData(updated);
    return updated;
  };

  const completeStep = async (stepId: string) => {
    const updated = await patchOnboarding({ completeStepId: stepId });
    setData(updated);
    return updated;
  };

  const dismissTip = async (tipId: string) => {
    const updated = await patchOnboarding({ dismissTipId: tipId });
    setData(updated);
    return updated;
  };

  const reset = async () => {
    const updated = await patchOnboarding({ reset: true });
    setData(updated);
    return updated;
  };

  const tipsById = data?.content?.tips?.reduce<Record<string, OnboardingTip>>((acc, tip) => {
    acc[tip.id] = tip;
    return acc;
  }, {}) || {};

  return {
    onboarding: data?.onboarding,
    content: data?.content,
    tipsById,
    loading,
    error,
    updateRole,
    completeStep,
    dismissTip,
    reset
  };
};
