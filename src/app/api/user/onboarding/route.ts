import { NextResponse } from 'next/server';
import { getOnboardingContent, inferOnboardingRole, isOnboardingRole } from '../../../../services/onboardingContent';
import { findUserOnboarding, insertUserOnboarding, updateUserOnboarding } from '../../../../server/db/repositories/onboardingRepo';
import { requireUser } from '../../../../shared/auth/guards';
import type { UserOnboarding, OnboardingRole } from '../../../../types';

const normalizeRole = (value?: string): OnboardingRole | null => {
  if (!value) return null;
  const normalized = String(value || '').toUpperCase();
  return isOnboardingRole(normalized) ? (normalized as OnboardingRole) : null;
};

const buildDefaultOnboarding = async (userId: string, roleHint?: string): Promise<UserOnboarding> => {
  const inferred = await inferOnboardingRole({ userId, role: roleHint });
  const now = new Date().toISOString();
  return {
    userId,
    role: inferred,
    createdAt: now,
    updatedAt: now,
    completedSteps: [],
    dismissedTips: []
  };
};

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;
    const user = auth.principal;

    let onboarding: UserOnboarding | null = await findUserOnboarding(String(user.userId));
    if (!onboarding) {
      onboarding = await buildDefaultOnboarding(String(user.userId), user.role);
      await insertUserOnboarding(onboarding);
    }
    return NextResponse.json({ onboarding, content: getOnboardingContent() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load onboarding' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = auth.principal;

    const body = await request.json();
    let onboarding: UserOnboarding | null = await findUserOnboarding(String(user.userId));
    if (!onboarding) {
      onboarding = await buildDefaultOnboarding(String(user.userId), user.role);
      await insertUserOnboarding(onboarding);
    }
    const role = normalizeRole(body?.role);
    if (body?.role && !role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const refreshed = await updateUserOnboarding(String(user.userId), {
      role: role || undefined,
      reset: Boolean(body?.reset),
      completeStepId: body?.completeStepId ? String(body.completeStepId) : undefined,
      dismissTipId: body?.dismissTipId ? String(body.dismissTipId) : undefined
    });
    return NextResponse.json({ onboarding: refreshed, content: getOnboardingContent() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update onboarding' }, { status: 500 });
  }
}
