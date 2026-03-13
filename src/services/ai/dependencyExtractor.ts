import { EntityReference, PortfolioSnapshot } from '../../types/ai';

export type DependencyLinkType = 'dependency' | 'shared_resource' | 'milestone_sequence';

export type DependencyEdge = {
  from: EntityReference;
  to: EntityReference;
  linkType: DependencyLinkType;
};

const asRef = (type: EntityReference['type'], id: string, label: string): EntityReference => ({ type, id, label });

const uniqEdges = (edges: DependencyEdge[]) => {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from.type}:${edge.from.id}->${edge.to.type}:${edge.to.id}:${edge.linkType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractDependencyEdges = (snapshot: PortfolioSnapshot): DependencyEdge[] => {
  const edges: DependencyEdge[] = [];
  const workItems = snapshot.workItems.items || [];
  const milestones = snapshot.milestones.items || [];
  const reviews = snapshot.reviews.items || [];

  const workItemById = new Map<string, (typeof workItems)[number]>();
  workItems.forEach((item) => {
    workItemById.set(String(item.id), item);
    if (item.key) workItemById.set(String(item.key), item);
  });

  // Work item explicit links/dependencies.
  workItems.forEach((item) => {
    const from = asRef('workitem', String(item.id), String(item.key || item.title || item.id));

    (item.links || []).forEach((link) => {
      const targetId = String(link.targetId || link.workItemId || link.itemId || '').trim();
      if (!targetId) return;
      const target = workItemById.get(targetId);
      const to = asRef('workitem', target?.id ? String(target.id) : targetId, target?.key || target?.title || targetId);
      edges.push({ from, to, linkType: 'dependency' });
    });

    const dependsOnId = String(item.dependency?.dependsOn?.id || '').trim();
    const dependsOnName = String(item.dependency?.dependsOn?.name || '').trim();
    if (dependsOnId || dependsOnName) {
      const candidate = dependsOnId ? workItemById.get(dependsOnId) : undefined;
      const to = asRef(
        'workitem',
        candidate?.id ? String(candidate.id) : (dependsOnId || dependsOnName.toLowerCase().replace(/\s+/g, '-')),
        candidate?.key || candidate?.title || dependsOnName || dependsOnId
      );
      edges.push({ from, to, linkType: 'dependency' });
    }

    // WorkItem -> Milestone sequence.
    (item.milestoneIds || []).forEach((milestoneId) => {
      const ms = milestones.find((m) => String(m.id) === String(milestoneId));
      edges.push({
        from,
        to: asRef('milestone', String(milestoneId), ms?.name || String(milestoneId)),
        linkType: 'milestone_sequence'
      });
    });

    // WorkItem -> Application and -> Bundle shared resource relation.
    if (item.applicationId) {
      const app = (snapshot.applications.items || []).find((a) => String(a.id) === String(item.applicationId));
      edges.push({
        from,
        to: asRef('application', String(item.applicationId), app?.name || String(item.applicationId)),
        linkType: 'shared_resource'
      });
    }
    if (item.bundleId) {
      const bundle = (snapshot.bundles.items || []).find((b) => String(b.id) === String(item.bundleId));
      edges.push({
        from,
        to: asRef('bundle', String(item.bundleId), bundle?.name || String(item.bundleId)),
        linkType: 'shared_resource'
      });
    }
  });

  // Milestone to bundle and neighboring milestones in same bundle (sequence).
  milestones.forEach((milestone) => {
    const from = asRef('milestone', String(milestone.id), String(milestone.name || milestone.id));
    if (milestone.bundleId) {
      const bundle = (snapshot.bundles.items || []).find((b) => String(b.id) === String(milestone.bundleId));
      edges.push({
        from,
        to: asRef('bundle', String(milestone.bundleId), bundle?.name || String(milestone.bundleId)),
        linkType: 'milestone_sequence'
      });
    }
  });

  const milestonesByBundle = new Map<string, typeof milestones>();
  milestones.forEach((milestone) => {
    if (!milestone.bundleId) return;
    const arr = milestonesByBundle.get(String(milestone.bundleId)) || [];
    arr.push(milestone);
    milestonesByBundle.set(String(milestone.bundleId), arr);
  });
  milestonesByBundle.forEach((arr) => {
    arr.slice(0, 20).forEach((m1, idx) => {
      const next = arr[idx + 1];
      if (!next) return;
      edges.push({
        from: asRef('milestone', String(m1.id), String(m1.name || m1.id)),
        to: asRef('milestone', String(next.id), String(next.name || next.id)),
        linkType: 'milestone_sequence'
      });
    });
  });

  // Review gating edges to application/bundle/milestone/work items.
  reviews.forEach((review) => {
    const reviewRef = asRef('review', String(review.id), String(review.title || review.id));
    if (review.applicationId) {
      const app = (snapshot.applications.items || []).find((a) => String(a.id) === String(review.applicationId));
      edges.push({
        from: reviewRef,
        to: asRef('application', String(review.applicationId), app?.name || String(review.applicationId)),
        linkType: 'shared_resource'
      });
    }
    if (review.bundleId) {
      const bundle = (snapshot.bundles.items || []).find((b) => String(b.id) === String(review.bundleId));
      edges.push({
        from: reviewRef,
        to: asRef('bundle', String(review.bundleId), bundle?.name || String(review.bundleId)),
        linkType: 'shared_resource'
      });
    }

    // Attach review to milestones in same bundle.
    if (review.bundleId) {
      milestones
        .filter((m) => String(m.bundleId || '') === String(review.bundleId))
        .slice(0, 5)
        .forEach((milestone) => {
          edges.push({
            from: reviewRef,
            to: asRef('milestone', String(milestone.id), String(milestone.name || milestone.id)),
            linkType: 'milestone_sequence'
          });
        });
    }

    // Attach review to first matching work items.
    workItems
      .filter((item) => (
        (review.applicationId && String(item.applicationId || '') === String(review.applicationId))
        || (review.bundleId && String(item.bundleId || '') === String(review.bundleId))
      ))
      .slice(0, 5)
      .forEach((item) => {
        edges.push({
          from: reviewRef,
          to: asRef('workitem', String(item.id), String(item.key || item.title || item.id)),
          linkType: 'dependency'
        });
      });
  });

  return uniqEdges(edges);
};
