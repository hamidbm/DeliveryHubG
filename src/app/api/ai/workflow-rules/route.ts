import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { generateActionPlan } from '../../../../services/ai/actionRecommender';
import { loadStrategicAdvisorContext } from '../../../../services/ai/strategicAdvisor';
import {
  enforceActiveWorkflowRules,
  listWorkflowRules,
  setWorkflowRuleEnabled
} from '../../../../services/ai/workflowRuleEngine';

const loadContext = async () => {
  const context = await loadStrategicAdvisorContext();
  if (!context) return null;
  const actionPlan = generateActionPlan(
    context.report,
    context.trendSignals || [],
    context.forecastSignals || [],
    context.riskPropagationSignals || []
  );
  return { context, actionPlan };
};

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const loaded = await loadContext();
  if (!loaded) {
    return NextResponse.json({ status: 'error', error: 'No AI Insights report found. Generate analysis first.' }, { status: 404 });
  }

  const rules = await listWorkflowRules({
    snapshot: loaded.context.snapshot,
    forecastSignals: loaded.context.forecastSignals || [],
    actionPlan: loaded.actionPlan,
    actor: { userId: authUser.userId, email: authUser.email }
  });
  return NextResponse.json({ status: 'success', rules });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  const loaded = await loadContext();
  if (!loaded) {
    return NextResponse.json({ status: 'error', error: 'No AI Insights report found. Generate analysis first.' }, { status: 404 });
  }

  let body: { ruleId?: string; enabled?: boolean; enforceNow?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const rules = await listWorkflowRules({
    snapshot: loaded.context.snapshot,
    forecastSignals: loaded.context.forecastSignals || [],
    actionPlan: loaded.actionPlan,
    actor: { userId: authUser.userId, email: authUser.email }
  });

  if (body.ruleId) {
    const rule = rules.find((item) => item.id === body.ruleId);
    if (!rule) {
      return NextResponse.json({ status: 'error', error: 'Unknown ruleId.' }, { status: 400 });
    }
    await setWorkflowRuleEnabled(rule, Boolean(body.enabled));
  }

  const enforcement = body.enforceNow
    ? await enforceActiveWorkflowRules({
        snapshot: loaded.context.snapshot,
        forecastSignals: loaded.context.forecastSignals || [],
        actionPlan: loaded.actionPlan,
        actor: { userId: authUser.userId, email: authUser.email }
      })
    : [];

  const latest = await listWorkflowRules({
    snapshot: loaded.context.snapshot,
    forecastSignals: loaded.context.forecastSignals || [],
    actionPlan: loaded.actionPlan,
    actor: { userId: authUser.userId, email: authUser.email }
  });

  return NextResponse.json({ status: 'success', rules: latest, enforcement });
}
