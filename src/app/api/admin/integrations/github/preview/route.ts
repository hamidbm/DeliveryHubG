import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getGitHubClient, getGitHubConfig, extractWorkItemKeys } from '../../../../../../services/github';
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

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const repo = searchParams.get('repo');
    const limitRaw = Number(searchParams.get('limit') || '20');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 20;
    const sinceDaysRaw = Number(searchParams.get('sinceDays') || '14');
    const sinceDays = Number.isFinite(sinceDaysRaw) ? Math.max(sinceDaysRaw, 1) : 14;

    const configResult = getGitHubConfig();
    if (!configResult.ok) {
      return NextResponse.json({ error: 'Missing GitHub configuration', missing: configResult.missing }, { status: 400 });
    }
    const config = configResult.config;

    const targetRepo = repo || config.repos[0];
    if (!targetRepo) {
      return NextResponse.json({ error: 'No repo configured' }, { status: 400 });
    }

    const client = getGitHubClient();
    const items = await client.listPullRequests(config, targetRepo, limit);
    const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const filtered = items.filter((pr: any) => new Date(pr.updatedAt).getTime() >= since);
    const mapped = filtered.map((pr: any) => {
      const state = pr.mergedAt ? 'merged' : pr.state;
      const keys = extractWorkItemKeys([pr.title, pr.body, pr.headRef].filter(Boolean).join(' '));
      return {
        repo: targetRepo,
        number: pr.number,
        title: pr.title,
        state,
        updatedAt: pr.updatedAt,
        url: pr.url,
        workItemKeys: keys
      };
    });
    return NextResponse.json({ items: mapped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Preview failed' }, { status: 500 });
  }
}
