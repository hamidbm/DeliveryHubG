const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGO_URL || 'mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin';

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const reviews = await db.collection('reviews').find({ 'cycles.status': 'feedback_sent' }).toArray();
  let updated = 0;
  let scanned = 0;

  for (const review of reviews) {
    for (const cycle of review.cycles || []) {
      if (cycle.status !== 'feedback_sent') continue;
      scanned += 1;
      const query = {
        $or: [
          { reviewCycleId: cycle.cycleId },
          {
            reviewCycleId: cycle.cycleId,
            'linkedResource.type': review.resource?.type,
            'linkedResource.id': review.resource?.id
          }
        ]
      };
      const item = await db.collection('workitems').findOne(query);
      if (!item) continue;
      if (item.status === 'REVIEW') continue;
      const now = new Date().toISOString();
      await db.collection('workitems').updateOne(
        { _id: item._id },
        {
          $set: { status: 'REVIEW', updatedAt: now },
          $push: { activity: { user: cycle.feedbackSentBy?.displayName || 'System', action: 'CHANGED_STATUS', from: item.status, to: 'REVIEW', createdAt: now } }
        }
      );
      updated += 1;
    }
  }

  await client.close();
  console.log(`Scanned ${scanned} feedback_sent cycles. Updated ${updated} work items.`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
