import { NextResponse } from 'next/server';
import { getGitHubClient, getGitHubConfig, extractWorkItemKeys } from '../../../../../../services/github';
import { isAdminOrCmo } from '../../../../../../services/authz';
import { emitEvent } from '../../../../../../shared/events/emitEvent';
import { findWorkItemRecord, updateWorkItemRecordById } from '../../../../../../server/db/repositories/workItemsRepo';
import { getGithubLinkRecord, upsertGithubLinkRecord } from '../../../../../../server/db/repositories/githubLinksRepo';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { requireStandardUser } from '../../../../../../shared/auth/guards';

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
    const startMs = Date.now();
    const auth = await requireStandardUser(request);
    if (!auth.ok) {
      return auth.response;
    }
    if (!(await isAdminOrCmo({ userId: auth.principal.userId, role: auth.principal.role || undefined, email: auth.principal.email }))) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
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
          const item = await findWorkItemRecord({
            key: { $regex: new RegExp(`^${escapeRegex(key)}$`, 'i') }
          });
          if (!item) {
            skipped += 1;
            continue;
          }

          const existingLink = await getGithubLinkRecord(repoName, pr.number);
          const nextState = pr.mergedAt ? 'merged' : pr.state;
          const isNewLink = !existingLink;
          const isMergedTransition = existingLink && existingLink.state !== 'merged' && nextState === 'merged';

          await upsertGithubLinkRecord({
            workItemId: String(item._id || item.id || ''),
            repo: repoName,
            prNumber: pr.number,
            url: pr.url,
            state: nextState,
            title: pr.title,
            updatedAt: pr.updatedAt
          });

          const nextGithub = upsertWorkItemPr(item, pr, repoName);
          await updateWorkItemRecordById(String(item._id || item.id || ''), {
            set: { github: nextGithub, updatedAt: nowIso }
          });

          if (isNewLink) linked += 1;
          else updated += 1;

          if (isNewLink) {
            try {
              await emitEvent({
                ts: nowIso,
                type: 'workitem.github.linked',
                actor: { userId: auth.principal.userId, email: auth.principal.email, displayName: auth.principal.fullName },
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
                actor: { userId: auth.principal.userId, email: auth.principal.email, displayName: auth.principal.fullName },
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
      const durationMs = Date.now() - startMs;
      await emitEvent({
        ts: new Date().toISOString(),
        type: 'integrations.github.sync.completed',
        actor: { userId: auth.principal.userId, email: auth.principal.email, displayName: auth.principal.fullName },
        resource: { type: 'integrations.github', id: targetRepos.join(','), title: 'GitHub Sync' },
        payload: {
          name: 'job.github.sync',
          at: new Date().toISOString(),
          durationMs,
          ok: errors === 0,
          counts: { fetched, linked, updated, skipped, errors }
        }
      });
    } catch {}

    return NextResponse.json({ fetched, linked, updated, skipped, errors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
