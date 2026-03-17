import { NextResponse } from 'next/server';
import { getJiraClient, getJiraConfig, mapJiraIssueToWorkItem } from '../../../../../../services/jira';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { requireStandardUser } from '../../../../../../shared/auth/guards';

const buildJql = (projectKey: string | null, configuredKeys: string[], jql?: string | null) => {
  if (jql) return jql;
  if (projectKey) return `project = ${projectKey} ORDER BY updated DESC`;
  if (configuredKeys.length === 1) return `project = ${configuredKeys[0]} ORDER BY updated DESC`;
  return `project in (${configuredKeys.join(',')}) ORDER BY updated DESC`;
};

export async function GET(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    if (!(await isAdminOrCmo({ userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email }))) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectKey = searchParams.get('projectKey');
    const jql = searchParams.get('jql');
    const limitRaw = Number(searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 20;

    const configResult = getJiraConfig();
    if (!configResult.ok) {
      return NextResponse.json({ error: 'Missing Jira configuration', missing: configResult.missing }, { status: 400 });
    }
    const config = configResult.config;
    const client = getJiraClient();
    const jqlQuery = buildJql(projectKey, config.projectKeys, jql);
    const response = await client.searchIssues(config, jqlQuery, limit, 0);
    const issues = Array.isArray(response?.issues) ? response.issues : [];
    const mapped = issues.map((issue: any) => mapJiraIssueToWorkItem(issue, config));
    return NextResponse.json({ items: mapped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Preview failed' }, { status: 500 });
  }
}
