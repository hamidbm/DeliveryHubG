import { NextResponse } from 'next/server';
import { getArchitectureDiagramById } from '../../../../server/db/repositories/architectureRepo';
import { appendReviewCycle, emitReviewCycleEvent, createReviewWorkItem } from '../../../../services/reviewLifecycle';
import { fetchUsersByIds } from '../../../../services/userDirectory';
import { canSubmitForReview, canViewArchitectureDiagram } from '../../../../services/authz';
import { requireUser } from '../../../../shared/auth/guards';
import { getReviewByResource, saveReviewRecord } from '../../../../server/db/repositories/reviewsRepo';
import { getWikiAssetById, getWikiPageById } from '../../../../server/db/repositories/wikiRepo';

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email,
      role: auth.principal.role || undefined,
      accountType: auth.principal.accountType
    };
    if (!canSubmitForReview(authUser)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    const actor = {
      userId: authUser.userId,
      displayName: authUser.displayName,
      email: authUser.email
    };

    const body = await request.json();
    const resourceType = String(body.resourceType || '');
    const resourceId = String(body.resourceId || '');
    const resourceTitle = body.resourceTitle ? String(body.resourceTitle) : undefined;
    const bundleId = body.bundleId ? String(body.bundleId) : undefined;
    const notes = body.notes ? String(body.notes) : undefined;
    const applicationId = body.applicationId ? String(body.applicationId) : undefined;
    const dueAt = body.dueAt ? String(body.dueAt) : undefined;
    const reviewerUserIds = Array.isArray(body.reviewerUserIds)
      ? body.reviewerUserIds.map((id: any) => String(id)).filter(Boolean)
      : [];

    if (!resourceType || !resourceId || ['undefined', 'null'].includes(resourceId)) {
      return NextResponse.json({ error: 'resourceType and resourceId are required.' }, { status: 400 });
    }

    let artifact: any = null;
    if (resourceType === 'wiki.page') {
      artifact = await getWikiPageById(resourceId);
    } else if (resourceType === 'wiki.asset') {
      artifact = await getWikiAssetById(resourceId);
      if (artifact && (artifact as any).artifactKind === 'feedback') {
        return NextResponse.json({ error: 'Feedback documents cannot be submitted for review.' }, { status: 400 });
      }
      if (artifact && (artifact as any).documentType === 'Feedback Document') {
        return NextResponse.json({ error: 'Feedback documents cannot be submitted for review.' }, { status: 400 });
      }
      const status = artifact?.status;
      if (status && status !== 'Published') {
        return NextResponse.json({ error: 'Artifact must be published before review.' }, { status: 400 });
      }
    } else if (resourceType === 'architecture_diagram') {
      artifact = await getArchitectureDiagramById(resourceId);
      if (!artifact) {
        return NextResponse.json({ error: 'Diagram not found.' }, { status: 404 });
      }
      if (!canViewArchitectureDiagram(authUser, artifact)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const resolvedTitle = resourceTitle || artifact?.title;
    const resolvedBundleId = bundleId || artifact?.bundleId;
    const resolvedApplicationId = applicationId || artifact?.applicationId;

    let review = await getReviewByResource(resourceType, resourceId);
    if (!review) {
      review = {
        resource: { type: resourceType, id: resourceId, title: resolvedTitle, bundleId: resolvedBundleId, applicationId: resolvedApplicationId },
        status: 'active',
        createdBy: actor,
        createdAt: new Date().toISOString(),
        currentCycleId: '',
        cycles: [],
        resourceVersion: artifact?.updatedAt ? { resourceUpdatedAtAtSubmission: String(artifact.updatedAt) } : undefined
      };
      await saveReviewRecord(review);
    } else {
      review.resource = { ...review.resource, title: resolvedTitle, bundleId: resolvedBundleId, applicationId: resolvedApplicationId };
      const currentCycle = review.currentCycleId
        ? (review.cycles || []).find((c) => c.cycleId === review.currentCycleId)
        : null;
      if (currentCycle && currentCycle.status !== 'closed') {
        return NextResponse.json({ error: 'Review cycle already active.' }, { status: 409 });
      }
    }
    if (artifact?.updatedAt) {
      review.resourceVersion = { resourceUpdatedAtAtSubmission: String(artifact.updatedAt) };
    }
    if (!resolvedBundleId && reviewerUserIds.length === 0) {
      return NextResponse.json({ error: 'bundleId or reviewerUserIds is required.' }, { status: 400 });
    }

    const reviewers = reviewerUserIds.length
      ? (() => {
          const seen = new Set<string>();
          const uniqueIds = reviewerUserIds.filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return uniqueIds;
        })()
      : [];
    let reviewerActors: Array<{ userId: string; displayName: string; email?: string }> | undefined = undefined;
    if (reviewers.length > 0) {
      const users = await fetchUsersByIds(reviewers);
      const userMap = new Map(users.map((u: any) => [String(u._id || u.id), u]));
      reviewerActors = reviewers
        .map((id) => userMap.get(id))
        .filter(Boolean)
        .map((u: any) => ({
          userId: String(u._id || u.id),
          displayName: u.name || u.email || 'Reviewer',
          email: u.email
        }));
      if (reviewerActors.length === 0) reviewerActors = undefined;
    }

    const { review: updated, cycle } = await appendReviewCycle({
      review,
      bundleId: resolvedBundleId || '',
      requestedBy: actor,
      notes,
      dueAt,
      reviewers: reviewerActors
    });

    await emitReviewCycleEvent({
      type: 'reviews.cycle.requested',
      actor,
      resource: { type: resourceType, id: resourceId, title: resolvedTitle },
      cycle: { cycleId: cycle.cycleId, number: cycle.number, status: cycle.status }
    });

    await createReviewWorkItem({
      reviewId: String(updated._id || `${resourceType}:${resourceId}`),
      cycleId: cycle.cycleId,
      cycleNumber: cycle.number,
      eventType: 'reviews.cycle.requested',
      resource: { type: resourceType, id: resourceId, title: resolvedTitle },
      bundleId: resolvedBundleId,
      applicationId: resolvedApplicationId,
      dueAt: cycle.dueAt,
      requestedBy: actor,
      notes,
      reviewers: cycle.reviewers,
      actor
    });

    return NextResponse.json({ review: updated, cycle });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to submit review' }, { status: 500 });
  }
}
