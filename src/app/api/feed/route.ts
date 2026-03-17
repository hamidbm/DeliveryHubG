import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import type { FeedItem } from '../../../types';
import { createVisibilityContext } from '../../../services/visibility';
import { normalizeEventType } from '../../../services/eventsTaxonomy';
import { requireUser } from '../../../shared/auth/guards';
import { listMilestoneRefsByBundleId } from '../../../server/db/repositories/milestonesRepo';
import { listEventsByQuery } from '../../../server/db/repositories/eventsRepo';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decodeCursor = (cursor: string) => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.id) return null;
    return { ts: parsed.ts, id: parsed.id } as { ts: string; id: string };
  } catch {
    return null;
  }
};

const encodeCursor = (ts: string | Date, id: string) => {
  const payload = { ts: typeof ts === 'string' ? ts : ts.toISOString(), id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
};

const buildIdCandidates = (value: string) => {
  const candidates: Array<string | ObjectId> = [value];
  if (ObjectId.isValid(value)) {
    candidates.push(new ObjectId(value));
  }
  return candidates;
};

const resolveActor = (actor: any) => {
  if (!actor) return undefined;
  const name = actor.displayName || actor.name || actor.email || actor.userId;
  return {
    userId: actor.userId ? String(actor.userId) : undefined,
    email: actor.email ? String(actor.email) : undefined,
    name: name ? String(name) : undefined
  };
};

const buildLinks = (event: any) => {
  const links: Array<{ label: string; href: string }> = [];
  const resource = event?.resource || {};
  const resourceType = String(resource.type || '');
  const resourceId = String(resource.id || '');
  if (resourceId) {
    if (resourceType.includes('diagram')) {
      links.push({ label: 'Open diagram', href: `/architecture/diagram/${encodeURIComponent(resourceId)}` });
    } else if (resourceType.startsWith('workitems')) {
      links.push({ label: 'Open work item', href: `/work-items/${encodeURIComponent(resourceId)}` });
    } else if (resourceType.startsWith('milestones')) {
      links.push({ label: 'Open milestone', href: `/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(resourceId)}` });
    } else if (resourceType.startsWith('sprints')) {
      links.push({ label: 'Open sprints', href: `/work-items?view=sprints` });
    }
  }
  const bundleId = event?.context?.bundleId || event?.payload?.bundleId;
  if (bundleId) {
    links.push({ label: 'Open bundle', href: `/program?bundleIds=${encodeURIComponent(String(bundleId))}` });
  }
  const milestoneId = event?.context?.milestoneId || event?.payload?.milestoneId;
  if (milestoneId && (!resourceId || String(resourceId) !== String(milestoneId))) {
    links.push({ label: 'Open milestone', href: `/work-items?view=milestone-plan&milestoneId=${encodeURIComponent(String(milestoneId))}` });
  }
  const prUrl = event?.payload?.prUrl;
  if (prUrl) {
    links.push({ label: 'Open PR', href: String(prUrl) });
  }
  return links;
};

const summarizeStatusChange = (from: any, to: any) => {
  const fromLabel = from ? String(from) : '—';
  const toLabel = to ? String(to) : '—';
  return `${fromLabel} → ${toLabel}`;
};

const mapEventToFeedItem = (
  event: any,
  normalized: { canonicalType: string; category: string; modulePrefix: string },
  includeRaw: boolean
): FeedItem => {
  const payload = event?.payload || {};
  const rawType = String(event?.type || '');
  const type = normalized.canonicalType;
  const resource = event?.resource || {};
  const resourceLabel = resource?.title || resource?.id || 'item';

  let title = type;
  let summary = type;
  let severity: FeedItem['severity'] = 'info';

  if (type === 'milestones.milestone.statuschanged') {
    const to = String(payload?.to || '').toUpperCase();
    if (to === 'ACTIVE' || to === 'IN_PROGRESS') title = 'Milestone started';
    else if (to === 'DONE' || to === 'COMPLETED') title = 'Milestone marked done';
    else if (to === 'COMMITTED') title = 'Milestone committed';
    else title = 'Milestone status changed';
    summary = summarizeStatusChange(payload?.from, payload?.to);
  } else if (type === 'sprints.sprint.statuschanged') {
    const to = String(payload?.to || '').toUpperCase();
    if (to === 'ACTIVE') title = 'Sprint started';
    else if (to === 'CLOSED') title = 'Sprint closed';
    else title = 'Sprint status changed';
    summary = summarizeStatusChange(payload?.from, payload?.to);
  } else if (type === 'sprints.sprint.override') {
    title = 'Sprint close override';
    summary = payload?.overrideReason || 'Readiness override applied';
    severity = 'warn';
  } else if (type.startsWith('milestones.scope.')) {
    severity = 'warn';
    const action = String(payload?.action || '').toUpperCase();
    const count = Array.isArray(payload?.workItemIds) ? payload.workItemIds.length : 0;
    const delta = action === 'ADD_ITEMS' ? `+${count}` : action === 'REMOVE_ITEMS' ? `-${count}` : `${count}`;
    if (type === 'milestones.scope.approved') title = 'Scope change approved';
    else if (type === 'milestones.scope.requested') title = 'Scope change requested';
    else if (type === 'milestones.scope.rejected') title = 'Scope change rejected';
    else if (type === 'milestones.scope.cancelled') title = 'Scope change cancelled';
    else if (type === 'milestones.scope.directchanged') title = 'Scope adjusted directly';
    else title = 'Scope updated';
    summary = count ? `${delta} items` : 'Scope updated';
  } else if (type === 'criticalpath.action.executed') {
    const actionType = String(payload?.actionType || '');
    if (actionType === 'REQUEST_ESTIMATE') {
      title = `Requested estimate for ${resourceLabel}`;
      summary = payload?.reason || 'Estimate requested for critical path item.';
      severity = 'warn';
    } else if (actionType === 'NOTIFY_OWNER') {
      title = `Escalated external blocker ${resourceLabel}`;
      summary = payload?.reason || 'External blocker escalated.';
      severity = 'critical';
    } else if (actionType === 'ASSIGN') {
      title = `Assigned owner for ${resourceLabel}`;
      summary = payload?.reason || 'Critical path assignment suggested.';
      severity = 'warn';
    } else if (actionType === 'SET_ESTIMATE') {
      title = `Estimate updated for ${resourceLabel}`;
      summary = payload?.reason || 'Critical path estimate updated.';
    } else {
      title = `Critical path action for ${resourceLabel}`;
      summary = payload?.reason || 'Critical path action executed.';
      severity = 'warn';
    }
  } else if (type.startsWith('dependency.')) {
    title = `Dependency update: ${resourceLabel}`;
    summary = type.replace(/^dependency\./, '').replace(/\./g, ' ');
    severity = type.includes('critical') ? 'critical' : 'warn';
  } else if (type === 'workitem.github.pr.linked') {
    title = `GitHub PR linked to ${resourceLabel}`;
    summary = payload?.prTitle ? `#${payload.prNumber} ${payload.prTitle}` : `PR #${payload?.prNumber || ''}`.trim();
  } else if (type === 'workitem.github.pr.merged') {
    title = `GitHub PR merged for ${resourceLabel}`;
    summary = payload?.prTitle ? `#${payload.prNumber} ${payload.prTitle}` : `PR #${payload?.prNumber || ''}`.trim();
  } else if (type.startsWith('integrations.')) {
    title = 'Integration activity';
    summary = type.replace(/^integrations\./, '').replace(/\./g, ' ');
  } else if (resourceLabel) {
    title = resourceLabel;
    summary = type;
  }

  const occurredAt = event?.ts ? new Date(event.ts).toISOString() : new Date().toISOString();

  return {
    id: String(event?._id || ''),
    occurredAt,
    actor: resolveActor(event?.actor),
    title,
    summary,
    severity,
    links: buildLinks(event),
    rawType,
    canonicalType: normalized.canonicalType,
    category: normalized.category,
    modulePrefix: normalized.modulePrefix,
    raw: includeRaw ? event : undefined
  };
};

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      accountType: auth.principal.accountType
    };

    const { searchParams } = new URL(request.url);
    const scopeType = (searchParams.get('scopeType') || 'PROGRAM').toUpperCase();
    const scopeId = searchParams.get('scopeId') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const includeRaw = searchParams.get('includeRaw') === 'true';
    const limitRaw = Number(searchParams.get('limit') || '50');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    if ((scopeType === 'BUNDLE' || scopeType === 'MILESTONE') && !scopeId) {
      return NextResponse.json({ error: 'scopeId is required', code: 'SCOPE_ID_REQUIRED' }, { status: 400 });
    }

    const filtersParam = searchParams.get('filters');
    const selectedFilters = (filtersParam ? filtersParam.split(',') : ['governance', 'scope', 'dependency'])
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const filterPrefixes: Record<string, string[]> = {
      governance: ['milestones.milestone', 'sprints.sprint'],
      scope: ['milestones.scope'],
      dependency: ['dependency', 'criticalpath'],
      integrations: ['integrations', 'workitem.github']
    };

    const prefixes = Array.from(new Set(selectedFilters.flatMap((filter) => filterPrefixes[filter] || [])));
    if (!prefixes.length) {
      return NextResponse.json({ items: [], nextCursor: null });
    }

    const typeFilters = prefixes.map((prefix) => ({ type: new RegExp(`^${escapeRegex(prefix)}`) }));
    const filters: any[] = [{ $or: typeFilters }];

    if (scopeType === 'BUNDLE' && scopeId) {
      const bundleCandidates = buildIdCandidates(scopeId);
      const bundleQuery = ObjectId.isValid(scopeId)
        ? { $or: [{ bundleId: scopeId }, { bundleId: new ObjectId(scopeId) }] }
        : { bundleId: scopeId };
      const milestoneDocs = await listMilestoneRefsByBundleId(scopeId);
      const milestoneIds = milestoneDocs
        .flatMap((doc: any) => [doc._id, doc.id, doc.name])
        .filter(Boolean)
        .map((value: any) => String(value));
      const scopeFilters: any[] = [
        { 'context.bundleId': { $in: bundleCandidates } },
        { 'payload.bundleId': { $in: bundleCandidates } }
      ];
      if (milestoneIds.length) {
        scopeFilters.push({ 'resource.id': { $in: milestoneIds } });
        scopeFilters.push({ 'payload.milestoneId': { $in: milestoneIds } });
      }
      filters.push({ $or: scopeFilters });
    }

    if (scopeType === 'MILESTONE' && scopeId) {
      const milestoneCandidates = buildIdCandidates(scopeId);
      filters.push({
        $or: [
          { 'context.milestoneId': { $in: milestoneCandidates } },
          { 'payload.milestoneId': { $in: milestoneCandidates } },
          { 'resource.id': { $in: milestoneCandidates } }
        ]
      });
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        const cursorDate = new Date(decoded.ts);
        const cursorId = ObjectId.isValid(decoded.id) ? new ObjectId(decoded.id) : null;
        if (cursorId) {
          filters.push({
            $or: [
              { ts: { $lt: cursorDate } },
              { ts: cursorDate, _id: { $lt: cursorId } }
            ]
          });
        }
      }
    }

    const query = filters.length ? { $and: filters } : {};
    let items = await listEventsByQuery(query, limit);

    const visibility = createVisibilityContext(user);
    items = await visibility.filterVisibleEventsForFeed(items);

    const last = items[items.length - 1];
    const nextCursor = last ? encodeCursor(last.ts, String(last._id)) : null;
    const feedItems = items.map((item) => {
      const normalized = normalizeEventType(item?.type || '');
      return mapEventToFeedItem(item, normalized, includeRaw);
    });

    return NextResponse.json({ items: feedItems, nextCursor });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch feed' }, { status: 500 });
  }
}
