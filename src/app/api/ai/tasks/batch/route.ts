import { NextResponse } from 'next/server';
import { saveWorkItem } from '../../../../../services/workItemsService';
import { EntityReference } from '../../../../../types/ai';
import { WorkItemStatus, WorkItemType } from '../../../../../types';
import { requireStandardUser } from '../../../../../shared/auth/guards';
import { findUserByEmail, findUserById } from '../../../../../server/db/repositories/usersRepo';

type IncomingTask = {
  title?: string;
  description?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  linkedEntity?: EntityReference;
  relatedEntities?: EntityReference[];
};

const inferScope = (task: IncomingTask) => {
  const entities = [task.linkedEntity, ...(task.relatedEntities || [])].filter(Boolean) as EntityReference[];
  const workItem = entities.find((item) => item.type === 'workitem');
  const bundle = entities.find((item) => item.type === 'bundle');
  const app = entities.find((item) => item.type === 'application');
  const milestone = entities.find((item) => item.type === 'milestone');

  return {
    parentId: workItem?.id,
    bundleId: bundle?.id,
    applicationId: app?.id,
    milestoneIds: milestone ? [milestone.id] : undefined
  };
};

const priorityMap = (value?: IncomingTask['priority']) => {
  if (value === 'critical') return 'CRITICAL';
  if (value === 'high') return 'HIGH';
  if (value === 'medium') return 'MEDIUM';
  return 'LOW';
};

export async function POST(request: Request) {
  const auth = await requireStandardUser(request);
  if (!auth.ok) return auth.response;
  const authUser = {
    userId: auth.principal.userId,
    email: auth.principal.email
  };

  let body: { tasks?: IncomingTask[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'error', error: 'Invalid JSON body.' }, { status: 400 });
  }

  const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
  if (!tasks.length) {
    return NextResponse.json({ status: 'error', error: 'tasks[] is required.' }, { status: 400 });
  }
  if (tasks.length > 25) {
    return NextResponse.json({ status: 'error', error: 'Maximum 25 tasks per request.' }, { status: 400 });
  }

  const actor = (await findUserById(String(authUser.userId || ''), { name: 1, email: 1 }))
    || (authUser.email ? await findUserByEmail(String(authUser.email), { name: 1, email: 1 }) : null);
  const createdTaskIds: string[] = [];

  for (const task of tasks) {
    const title = String(task?.title || '').trim();
    const description = String(task?.description || '').trim();
    if (!title) continue;

    const scope = inferScope(task);
    const result = await saveWorkItem(
      {
        type: WorkItemType.TASK,
        status: WorkItemStatus.TODO,
        title,
        description: description || `Task created from AI recommendation: ${title}`,
        priority: priorityMap(task.priority),
        parentId: scope.parentId,
        bundleId: scope.bundleId,
        applicationId: scope.applicationId,
        milestoneIds: scope.milestoneIds,
        aiWorkPlan: {
          source: 'ai_action_plan',
          generatedAt: new Date().toISOString()
        } as any
      },
      {
        userId: authUser.userId,
        name: String(actor?.name || authUser.email || 'AI Insights'),
        email: String(actor?.email || authUser.email || '')
      }
    );

    const insertedId = (result as any)?.insertedId;
    if (insertedId) createdTaskIds.push(String(insertedId));
  }

  return NextResponse.json({ status: 'success', createdTaskIds });
}
