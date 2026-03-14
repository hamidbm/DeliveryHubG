const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGO_URL || 'mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin';

const buildNarrative = ({ resourceLabel, resourceType, cycleLabel, requestedBy, dueLabel, submitterNote }) => {
  return [
    '## Review Required',
    '',
    `**Resource:** ${resourceLabel} (${resourceType})`,
    `**Cycle:** ${cycleLabel}`,
    `**Requested by:** ${requestedBy}`,
    `**Due:** ${dueLabel}`,
    '',
    '### Submitter Note',
    submitterNote || 'No submitter note provided.'
  ].join('\n');
};

const parseReviewLookup = (reviewId) => {
  if (!reviewId) return null;
  const reviewIdStr = String(reviewId);
  if (ObjectId.isValid(reviewIdStr)) {
    return { type: 'id', value: new ObjectId(reviewIdStr) };
  }
  const idx = reviewIdStr.indexOf(':');
  if (idx > 0) {
    const type = reviewIdStr.slice(0, idx);
    const id = reviewIdStr.slice(idx + 1);
    if (type && id) return { type: 'resource', value: { type, id } };
  }
  return null;
};

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const cursor = db.collection('workitems').find({ reviewId: { $exists: true, $ne: null } });
  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const item = await cursor.next();
    if (!item) break;
    scanned += 1;

    const lookup = parseReviewLookup(item.reviewId);
    if (!lookup) continue;

    let review = null;
    if (lookup.type === 'id') {
      review = await db.collection('reviews').findOne({ _id: lookup.value });
    } else if (lookup.type === 'resource') {
      review = await db.collection('reviews').findOne({
        'resource.type': lookup.value.type,
        'resource.id': lookup.value.id
      });
    }
    if (!review) continue;

    const cycleId = item.reviewCycleId;
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);

    const linkedResource = item.linkedResource || {
      type: review.resource?.type,
      id: review.resource?.id,
      title: review.resource?.title
    };

    const reviewRequestedBy = item.reviewRequestedBy || cycle?.requestedBy;
    const reviewNotes = typeof item.reviewNotes === 'string' && item.reviewNotes.trim().length
      ? item.reviewNotes
      : cycle?.notes;
    const reviewCycleNumber = item.reviewCycleNumber || cycle?.number;
    const dueAt = item.dueAt || cycle?.dueAt;

    const requester = reviewRequestedBy?.displayName || reviewRequestedBy?.email || reviewRequestedBy?.userId || 'Unknown';
    const resourceLabel = linkedResource?.title || linkedResource?.id || review.resource?.title || review.resource?.id || 'Resource';
    const resourceType = linkedResource?.type || review.resource?.type || 'resource';
    const cycleLabel = reviewCycleNumber ? `#${reviewCycleNumber}` : (cycleId || '—');
    const dueLabel = dueAt
      ? new Date(dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'TBD';

    const needsDescription = !item.description || !String(item.description).startsWith('## Review Required');
    const description = needsDescription
      ? buildNarrative({
          resourceLabel,
          resourceType,
          cycleLabel,
          requestedBy: requester,
          dueLabel,
          submitterNote: reviewNotes
        })
      : item.description;

    const update = {
      linkedResource,
      reviewRequestedBy,
      reviewNotes,
      reviewCycleNumber,
      dueAt,
      description
    };

    await db.collection('workitems').updateOne({ _id: item._id }, { $set: update });
    updated += 1;
  }

  await cursor.close();
  await client.close();

  console.log(`Scanned ${scanned} work items. Updated ${updated}.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
