import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getJiraClient, getJiraConfig, mapJiraIssueToWorkItem } from '../../../../../../services/jira';
import { isAdminOrCmo } from '../../../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined
  };
};

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401 };
  const allowed = await isAdminOrCmo(user);
  if (!allowed) return { ok: false, status: 403 };
  return { ok: true, status: 200 };
};

const buildJql = (projectKey: string | null, configuredKeys: string[], jql?: string | null) => {
  if (jql) return jql;
  if (projectKey) return `project = ${projectKey} ORDER BY updated DESC`;
  if (configuredKeys.length === 1) return `project = ${configuredKeys[0]} ORDER BY updated DESC`;
  return `project in (${configuredKeys.join(',')}) ORDER BY updated DESC`;
};

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
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
