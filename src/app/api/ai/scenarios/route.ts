import { NextResponse } from 'next/server';
import { getDb } from '../../../../services/db';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { ScenarioDefinition } from '../../../../types/ai';

const COLLECTION = 'ai_scenarios';

const parseScenario = async (request: Request): Promise<ScenarioDefinition | null> => {
  try {
    const body = await request.json();
    return body?.scenario || null;
  } catch {
    return null;
  }
};

const normalizeScenario = (scenario: ScenarioDefinition): ScenarioDefinition => ({
  id: String(scenario?.id || '').trim(),
  description: String(scenario?.description || '').trim(),
  changes: Array.isArray(scenario?.changes) ? scenario.changes : []
});

const validateScenario = (scenario: ScenarioDefinition | null) => {
  if (!scenario) return 'Scenario is required.';
  if (!scenario.id?.trim()) return 'Scenario id is required.';
  if (!scenario.description?.trim()) return 'Scenario description is required.';
  if (!Array.isArray(scenario.changes) || scenario.changes.length === 0) return 'Scenario must include at least one change.';
  return null;
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const db = await getDb();
  const scenarios = await db.collection(COLLECTION)
    .find({ userId: authUser.userId }, { projection: { _id: 0, userId: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  return NextResponse.json({ status: 'success', scenarios });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const raw = await parseScenario(request);
  const scenario = normalizeScenario(raw as ScenarioDefinition);
  const validationError = validateScenario(scenario);
  if (validationError) {
    return NextResponse.json({ status: 'error', error: validationError }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection(COLLECTION).updateOne(
    { userId: authUser.userId, id: scenario.id },
    {
      $set: {
        ...scenario,
        userId: authUser.userId,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );

  return NextResponse.json({ status: 'success', scenarioId: scenario.id });
}
