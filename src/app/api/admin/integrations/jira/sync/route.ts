import { NextResponse } from 'next/server';
import { emitEvent } from '../../../../../../shared/events/emitEvent';
import { saveWorkItem } from '../../../../../../services/workItemsService';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { getJiraClient, getJiraConfig, mapJiraIssueToWorkItem } from '../../../../../../services/jira';
import { requireStandardUser } from '../../../../../../shared/auth/guards';
import { findBundleByAnyId } from '../../../../../../server/db/repositories/bundlesRepo';
import { findWorkItemRecord, updateWorkItemRecordById, ensureWorkItemsIndexes } from '../../../../../../server/db/repositories/workItemsRepo';

const buildJql = (projectKey: string | null, configuredKeys: string[], jql?: string | null) => {
  if (jql) return jql;
  if (projectKey) return `project = ${projectKey} ORDER BY updated DESC`;
  if (configuredKeys.length === 1) return `project = ${configuredKeys[0]} ORDER BY updated DESC`;
  return `project in (${configuredKeys.join(',')}) ORDER BY updated DESC`;
};

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    if (!(await isAdminOrCmo({ userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email }))) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }

    const body = await request.json();
    const projectKey = body?.projectKey ? String(body.projectKey) : null;
    const mode = body?.mode === 'IMPORT_ONLY' ? 'IMPORT_ONLY' : 'UPSERT';
    const limitRaw = Number(body?.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const jql = body?.jql ? String(body.jql) : null;

    const configResult = getJiraConfig();
    if (!configResult.ok) {
      return NextResponse.json({ error: 'Missing Jira configuration', missing: configResult.missing }, { status: 400 });
    }
    const config = configResult.config;
    const client = getJiraClient();
    const jqlQuery = buildJql(projectKey, config.projectKeys, jql);

    await ensureWorkItemsIndexes();

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    let startAt = 0;
    const pageSize = Math.min(50, limit);
    const issues: any[] = [];
    while (fetched < limit) {
      const response = await client.searchIssues(config, jqlQuery, Math.min(pageSize, limit - fetched), startAt);
      const batch = Array.isArray(response?.issues) ? response.issues : [];
      issues.push(...batch);
      fetched += batch.length;
      const total = Number(response?.total || 0);
      if (batch.length === 0 || fetched >= total) break;
      startAt += batch.length;
    }

    for (const issue of issues) {
      try {
        const mapped = mapJiraIssueToWorkItem(issue, config);
        const existing = await findWorkItemRecord({
          'jira.host': config.host,
          'jira.key': mapped.key
        });
        if (existing) {
          if (mode === 'IMPORT_ONLY') {
            skipped += 1;
            continue;
          }
          await updateWorkItemRecordById(String(existing._id || existing.id || ''), {
            set: {
              title: mapped.title,
              status: mapped.status,
              storyPoints: mapped.storyPoints,
              assignedTo: mapped.assignedTo,
              updatedAt: new Date().toISOString(),
              jira: { ...existing.jira, ...mapped.jira }
            }
          });
          updated += 1;
          continue;
        }

        const projectKeyResolved = mapped.jiraProjectKey || projectKey || mapped.key.split('-')[0];
        let bundleId = projectKeyResolved || 'unassigned';
        if (projectKeyResolved) {
          const bundle = await findBundleByAnyId(projectKeyResolved);
          if (bundle?._id) bundleId = String(bundle._id);
        }

        await saveWorkItem({
          key: mapped.key,
          title: mapped.title,
          status: mapped.status,
          storyPoints: mapped.storyPoints,
          assignedTo: mapped.assignedTo,
          type: mapped.type,
          priority: 'MEDIUM',
          bundleId: bundleId,
          jira: mapped.jira
        }, { name: 'Jira Sync', userId: 'jira-sync', email: auth.principal.email });
        created += 1;
      } catch (err: any) {
        errors.push({ key: issue?.key, error: err.message || String(err) });
      }
    }

    try {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'integrations.jira.sync.completed',
        actor: { userId: auth.principal.userId, email: auth.principal.email, displayName: auth.principal.fullName },
        resource: { type: 'integrations.jira', id: config.host, title: 'Jira Sync' },
        payload: { fetched: issues.length, created, updated, skipped, errors: errors.length }
      });
    } catch {}

    return NextResponse.json({ fetched: issues.length, created, updated, skipped, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
