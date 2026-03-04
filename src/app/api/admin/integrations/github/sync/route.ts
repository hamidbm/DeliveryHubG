import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getGitHubClient, getGitHubConfig, extractWorkItemKeys } from '../../../../../../services/github';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { emitEvent, getDb } from '../../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getUser = async () => {
  const testToken = process.env.NODE_ENV === 'test' ? (globalThis as any).__testToken : null;
  const cookieStore = testToken ? null : await cookies();
  const token = testToken || cookieStore?.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    role: payload.role ? String(payload.role) : undefined,
    email: payload.email ? String(payload.email) : undefined,
    name: payload.name ? String(payload.name) : undefined
  };
};

const requireAdmin = async () => {
  const user = await getUser();
  if (!user?.userId) return { ok: false, status: 401, user: null };
  const allowed = await isAdminOrCmo(user);
  if (!allowed) return { ok: false, status: 403, user };
  return { ok: true, status: 200, user };
};

const ensureGithubIndexes = async (db: any) => {
  await db.collection('github_links').createIndex({ repo: 1, prNumber: 1 }, { unique: true });
  await db.collection('github_links').createIndex({ workItemId: 1 });
};

const upsertWorkItemPr = (item: any, pr: any, repo: string) => {
  const existing = Array.isArray(item.github?.prs) ? item.github.prs : [];
  const idx = existing.findIndex((p: any) => Number(p.number) === Number(pr.number));
  const nextState = pr.mergedAt ? 'merged' : pr.state;
  const next = {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: nextState,
    updatedAt: pr.updatedAt,
    author: pr.author
  };
  const merged = idx >= 0 ? [...existing.slice(0, idx), next, ...existing.slice(idx + 1)] : [...existing, next];
  return {
    repo,
    prs: merged,
    lastSyncedAt: new Date().toISOString()
  };
};

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const repo = body?.repo ? String(body.repo) : '';
    const sinceDaysRaw = Number(body?.sinceDays || 14);
    const sinceDays = Number.isFinite(sinceDaysRaw) ? Math.max(sinceDaysRaw, 1) : 14;
    const limitRaw = Number(body?.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const configResult = getGitHubConfig();
    if (!configResult.ok) {
      return NextResponse.json({ error: 'Missing GitHub configuration', missing: configResult.missing }, { status: 400 });
    }
    const config = configResult.config;
    const targetRepos = repo ? [repo] : config.repos;
    if (!targetRepos.length) {
      return NextResponse.json({ error: 'No repos configured' }, { status: 400 });
    }

    const client = getGitHubClient();
    const db = await getDb();
    await ensureGithubIndexes(db);

    let fetched = 0;
    let linked = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const since = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    const nowIso = new Date().toISOString();

    for (const repoName of targetRepos) {
      const prs = await client.listPullRequests(config, repoName, limit);
      const filtered = prs.filter((pr: any) => new Date(pr.updatedAt).getTime() >= since);
      fetched += filtered.length;

      for (const pr of filtered) {
        try {
          const keys = extractWorkItemKeys([pr.title, pr.body, pr.headRef].filter(Boolean).join(' '));
          if (!keys.length) {
            skipped += 1;
            continue;
          }
          const key = keys[0];
          const item = await db.collection('workitems').findOne({
            key: { $regex: new RegExp(`^${escapeRegex(key)}$`, 'i') }
          });
          if (!item) {
            skipped += 1;
            continue;
          }

          const existingLink = await db.collection('github_links').findOne({ repo: repoName, prNumber: pr.number });
          const nextState = pr.mergedAt ? 'merged' : pr.state;
          const isNewLink = !existingLink;
          const isMergedTransition = existingLink && existingLink.state !== 'merged' && nextState === 'merged';

          await db.collection('github_links').updateOne(
            { repo: repoName, prNumber: pr.number },
            {
              $set: {
                workItemId: String(item._id || item.id || ''),
                repo: repoName,
                prNumber: pr.number,
                url: pr.url,
                state: nextState,
                title: pr.title,
                updatedAt: pr.updatedAt
              }
            },
            { upsert: true }
          );

          const nextGithub = upsertWorkItemPr(item, pr, repoName);
          await db.collection('workitems').updateOne(
            { _id: item._id },
            { $set: { github: nextGithub, updatedAt: nowIso } }
          );

          if (isNewLink) linked += 1;
          else updated += 1;

          if (isNewLink) {
            try {
              await emitEvent({
                ts: nowIso,
                type: 'workitem.github.linked',
                actor: { userId: auth.user?.userId, email: auth.user?.email, displayName: auth.user?.name },
                resource: { type: 'workitems.item', id: String(item._id || item.id || ''), title: item.title },
                payload: { repo: repoName, prNumber: pr.number, prUrl: pr.url, prTitle: pr.title, state: nextState }
              });
            } catch {}
          }
          if (isMergedTransition) {
            try {
              await emitEvent({
                ts: nowIso,
                type: 'workitem.github.merged',
                actor: { userId: auth.user?.userId, email: auth.user?.email, displayName: auth.user?.name },
                resource: { type: 'workitems.item', id: String(item._id || item.id || ''), title: item.title },
                payload: { repo: repoName, prNumber: pr.number, prUrl: pr.url, prTitle: pr.title, state: nextState }
              });
            } catch {}
          }
        } catch {
          errors += 1;
        }
      }
    }

    try {
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'integrations.github.sync.completed',
        actor: { userId: auth.user?.userId, email: auth.user?.email, displayName: auth.user?.name },
        resource: { type: 'integrations.github', id: targetRepos.join(','), title: 'GitHub Sync' },
        payload: { fetched, linked, updated, skipped, errors }
      });
    } catch {}

    return NextResponse.json({ fetched, linked, updated, skipped, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
