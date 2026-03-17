import type { OnboardingRole, UserOnboarding } from '../../../types';
import { getServerDb } from '../client';

const ensureOnboardingIndexes = async () => {
  const db = await getServerDb();
  await db.collection('user_onboarding').createIndex({ userId: 1 }, { unique: true });
  return db;
};

export const findUserOnboarding = async (userId: string) => {
  const db = await ensureOnboardingIndexes();
  return (await db.collection<UserOnboarding>('user_onboarding').findOne({ userId })) as UserOnboarding | null;
};

export const insertUserOnboarding = async (onboarding: UserOnboarding) => {
  const db = await ensureOnboardingIndexes();
  return await db.collection<UserOnboarding>('user_onboarding').insertOne(onboarding);
};

export const updateUserOnboarding = async (
  userId: string,
  updates: {
    role?: OnboardingRole;
    reset?: boolean;
    completeStepId?: string;
    dismissTipId?: string;
  }
) => {
  const db = await ensureOnboardingIndexes();
  const updateDoc: any = { $set: { updatedAt: new Date().toISOString() } };

  if (updates.role) updateDoc.$set.role = updates.role;
  if (updates.reset) {
    updateDoc.$set.completedSteps = [];
    updateDoc.$set.dismissedTips = [];
  }
  if (updates.completeStepId) {
    updateDoc.$addToSet = { ...(updateDoc.$addToSet || {}), completedSteps: String(updates.completeStepId) };
  }
  if (updates.dismissTipId) {
    updateDoc.$addToSet = { ...(updateDoc.$addToSet || {}), dismissedTips: String(updates.dismissTipId) };
  }

  await db.collection<UserOnboarding>('user_onboarding').updateOne({ userId }, updateDoc);
  return (await db.collection<UserOnboarding>('user_onboarding').findOne({ userId })) as UserOnboarding | null;
};
