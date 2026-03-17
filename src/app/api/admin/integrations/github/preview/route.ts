import { NextResponse } from 'next/server';
import { getGitHubClient, getGitHubConfig, extractWorkItemKeys } from '../../../../../../services/github';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { requireStandardUser } from '../../../../../../shared/auth/guards';

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
