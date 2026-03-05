import { NextResponse } from 'next/server';
import { getDb } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { getOnboardingContent, inferOnboardingRole, isOnboardingRole } from '../../../../services/onboardingContent';
import type { UserOnboarding, OnboardingRole } from '../../../../types';

const ensureIndexes = async (db: any) => {
  await db.collection('user_onboarding').createIndex({ userId: 1 }, { unique: true });
};

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
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const db = await getDb();
    await ensureIndexes(db);
    const collection = db.collection<UserOnboarding>('user_onboarding');
    let onboarding: UserOnboarding | null = await collection.findOne({ userId: String(user.userId) }) as UserOnboarding | null;
    if (!onboarding) {
      onboarding = await buildDefaultOnboarding(String(user.userId), user.role);
      await collection.insertOne(onboarding);
    }
    return NextResponse.json({ onboarding, content: getOnboardingContent() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load onboarding' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json();
    const db = await getDb();
    await ensureIndexes(db);
    const collection = db.collection<UserOnboarding>('user_onboarding');

    let onboarding: UserOnboarding | null = await collection.findOne({ userId: String(user.userId) }) as UserOnboarding | null;
    if (!onboarding) {
      onboarding = await buildDefaultOnboarding(String(user.userId), user.role);
      await collection.insertOne(onboarding);
    }

    const updates: any = { $set: { updatedAt: new Date().toISOString() } };
    const role = normalizeRole(body?.role);
    if (body?.role && !role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (role) updates.$set.role = role;

    if (body?.reset) {
      updates.$set.completedSteps = [];
      updates.$set.dismissedTips = [];
    }
    if (body?.completeStepId) {
      updates.$addToSet = { ...(updates.$addToSet || {}), completedSteps: String(body.completeStepId) };
    }
    if (body?.dismissTipId) {
      updates.$addToSet = { ...(updates.$addToSet || {}), dismissedTips: String(body.dismissTipId) };
    }

    await collection.updateOne({ userId: String(user.userId) }, updates);
    const refreshed = await collection.findOne({ userId: String(user.userId) });
    return NextResponse.json({ onboarding: refreshed, content: getOnboardingContent() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update onboarding' }, { status: 500 });
  }
}
