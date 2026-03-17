import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { ScenarioDefinition } from '../../../../types/ai';
import {
  listAiScenarioRecords,
  saveAiScenarioRecord
} from '../../../../server/db/repositories/aiWorkspaceRepo';

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

  const scenarios = await listAiScenarioRecords(authUser.userId);

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

  await saveAiScenarioRecord(authUser.userId, scenario as unknown as Record<string, unknown>);

  return NextResponse.json({ status: 'success', scenarioId: scenario.id });
}
