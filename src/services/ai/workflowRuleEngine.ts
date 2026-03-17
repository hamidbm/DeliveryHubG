import { ObjectId } from 'mongodb';
import { ActionPlan, ForecastSignal, PortfolioSnapshot, WorkflowRule } from '../../types/ai';
import { saveNotification } from '../db';
import {
  listActiveWorkflowRuleRecords,
  listWorkflowRuleRecords,
  upsertWorkflowRuleRecord
} from '../../server/db/repositories/aiWorkspaceRepo';
import {
  bulkAssignWorkItems,
  bulkFlagWorkItems,
  listUnassignedWorkItemCandidates
} from '../../server/db/repositories/workItemsRepo';
import {
  findWorkflowRuleAssigneeCandidate,
  listWorkflowRuleStakeholderEmails
} from '../../server/db/repositories/usersRepo';

export type RuleEvaluationContext = {
  snapshot: PortfolioSnapshot;
  forecastSignals: ForecastSignal[];
  actionPlan?: ActionPlan;
  actor?: { userId?: string; email?: string };
};

type PersistedWorkflowRule = WorkflowRule & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type RuleActionResult = {
  ruleId: string;
  triggered: boolean;
  actions: string[];
};

const toPersistedRule = (rule: WorkflowRule): PersistedWorkflowRule => ({
  ...rule,
  enabled: Boolean(rule.enabled),
  suggestedBy: rule.suggestedBy || 'deterministic'
});

const unassignedRatio = (snapshot: PortfolioSnapshot) => {
  const total = snapshot.workItems.total || 0;
  if (total <= 0) return 0;
  return (snapshot.workItems.unassigned || 0) / total;
};

const shouldTriggerRule = (rule: WorkflowRule, context: RuleEvaluationContext) => {
  switch (rule.id) {
    case 'auto-assign-unassigned':
      return unassignedRatio(context.snapshot) > 0.3;
    case 'notify-milestone-overdue':
      return context.forecastSignals.some((signal) => signal.category === 'milestone_risk' && signal.severity === 'high');
    case 'flag-slip-risk':
      return context.forecastSignals.some((signal) => signal.severity === 'high');
    default:
      return false;
  }
};

const autoAssignUnassignedWork = async () => {
  const candidate = await findWorkflowRuleAssigneeCandidate();
  if (!candidate) return ['No SVP assignee candidate found; skipped auto-assign.'];

  const assignee = String(candidate.email || candidate.name || candidate._id || '').trim();
  if (!assignee) return ['Assignee identity not resolvable; skipped auto-assign.'];

  const unassigned = await listUnassignedWorkItemCandidates(10);

  if (!unassigned.length) return ['No unassigned work items found.'];

  const ids = unassigned.map((item: any) => item._id);
  await bulkAssignWorkItems(ids, assignee, 'Workflow Rule Engine');

  return [`Auto-assigned ${ids.length} unassigned work items to ${assignee}.`];
};

const notifyStakeholders = async () => {
  const emails = await listWorkflowRuleStakeholderEmails(30);
  if (!emails.length) return ['No stakeholder recipients found; skipped notification.'];

  await Promise.all(
    emails.map((email) => saveNotification({
      recipient: email,
      sender: 'Workflow Rule Engine',
      type: 'ALERT',
      message: 'DeliveryHub workflow rule triggered: milestone overdue risk increased.',
      link: '/?tab=ai-insights'
    }))
  );
  return [`Notified ${emails.length} stakeholder(s) about milestone risk.`];
};

const flagSlipRiskItems = async (context: RuleEvaluationContext) => {
  const workItemIds = new Set<string>();
  context.forecastSignals.forEach((signal) => {
    (signal.relatedEntities || []).forEach((entity) => {
      if (entity.type === 'workitem' && entity.id) workItemIds.add(String(entity.id));
    });
  });
  const ids = Array.from(workItemIds).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!ids.length) return ['No work-item references in high slip risk signals.'];

  await bulkFlagWorkItems(ids, 'Workflow Rule Engine');

  return [`Flagged ${ids.length} work item(s) due to high slip risk.`];
};

export const suggestWorkflowRules = (context: RuleEvaluationContext): WorkflowRule[] => {
  const ratio = unassignedRatio(context.snapshot);
  const highMilestoneRisk = context.forecastSignals.some((signal) => signal.category === 'milestone_risk' && signal.severity === 'high');
  const highSlipRisk = context.forecastSignals.some((signal) => signal.severity === 'high');

  return [
    {
      id: 'auto-assign-unassigned',
      description: 'Auto-assign unowned work to available SVP delivery members when ownership risk rises.',
      condition: 'unassignedRatio > 0.30',
      recommendedAction: ratio > 0.3 ? 'Enable now to reduce unowned backlog.' : 'Keep disabled until unassigned ratio rises.',
      suggestedBy: 'deterministic'
    },
    {
      id: 'notify-milestone-overdue',
      description: 'Notify leadership when milestone overdue risk spikes to high.',
      condition: "exists(forecast where category='milestone_risk' and severity='high')",
      recommendedAction: highMilestoneRisk ? 'Enable now for immediate escalation.' : 'Optional; useful for early warning.',
      suggestedBy: 'deterministic'
    },
    {
      id: 'flag-slip-risk',
      description: 'Automatically flag linked work items when forecast slip risk is high.',
      condition: "exists(forecast where severity='high')",
      recommendedAction: highSlipRisk ? 'Enable now to improve visibility in boards.' : 'Enable when high-risk forecast appears.',
      suggestedBy: 'deterministic'
    }
  ];
};

export const listWorkflowRules = async (context: RuleEvaluationContext): Promise<WorkflowRule[]> => {
  const suggestions = suggestWorkflowRules(context);
  const rows = await listWorkflowRuleRecords();
  const byId = new Map<string, PersistedWorkflowRule>();
  rows.forEach((row: any) => {
    if (row?.id) byId.set(String(row.id), row as PersistedWorkflowRule);
  });

  return suggestions.map((rule) => ({
    ...rule,
    enabled: Boolean(byId.get(rule.id)?.enabled)
  }));
};

export const setWorkflowRuleEnabled = async (rule: WorkflowRule, enabled: boolean) => {
  const now = new Date().toISOString();
  const toSave = toPersistedRule({ ...rule, enabled });
  await upsertWorkflowRuleRecord(
    rule.id,
    { $set: { ...toSave, updatedAt: now }, $setOnInsert: { createdAt: now } }
  );
};

export const enforceActiveWorkflowRules = async (context: RuleEvaluationContext) => {
  const active = await listActiveWorkflowRuleRecords();
  const out: RuleActionResult[] = [];

  for (const rawRule of active) {
    const rule: WorkflowRule = {
      id: String(rawRule?.id || ''),
      description: String(rawRule?.description || ''),
      condition: String(rawRule?.condition || ''),
      recommendedAction: String(rawRule?.recommendedAction || ''),
      enabled: Boolean(rawRule?.enabled),
      suggestedBy: rawRule?.suggestedBy === 'AI' ? 'AI' : 'deterministic'
    };
    if (!rule.id || !rule.description) continue;
    const triggered = shouldTriggerRule(rule, context);
    if (!triggered) {
      out.push({ ruleId: rule.id, triggered: false, actions: [] });
      continue;
    }

    let actions: string[] = [];
    if (rule.id === 'auto-assign-unassigned') {
      actions = await autoAssignUnassignedWork();
    } else if (rule.id === 'notify-milestone-overdue') {
      actions = await notifyStakeholders();
    } else if (rule.id === 'flag-slip-risk') {
      actions = await flagSlipRiskItems(context);
    }

    out.push({ ruleId: rule.id, triggered: true, actions });
  }

  return out;
};
