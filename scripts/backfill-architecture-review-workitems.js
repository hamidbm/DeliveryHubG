const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGO_URL || 'mongodb://admin:secretpassword@localhost:27017/deliveryhub?authSource=admin';

const main = async () => {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const cursor = db.collection('workitems').find({
    $or: [
      { 'linkedResource.type': 'architecture_diagram' },
      { reviewId: { $regex: '^architecture_diagram:' } }
    ]
  });

  let scanned = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const item = await cursor.next();
    if (!item) break;
    scanned += 1;

    if (item.linkedResource?.id) continue;

    let review = null;
    if (item.reviewId && ObjectId.isValid(item.reviewId)) {
      review = await db.collection('reviews').findOne({ _id: new ObjectId(item.reviewId) });
    } else if (item.reviewId && String(item.reviewId).includes(':')) {
      const parts = String(item.reviewId).split(':');
      const type = parts[0];
      const id = parts.slice(1).join(':');
      review = await db.collection('reviews').findOne({ 'resource.type': type, 'resource.id': id });
    }

    if (!review?.resource?.id) continue;

    await db.collection('workitems').updateOne(
      { _id: item._id },
      {
        $set: {
          linkedResource: {
            type: review.resource.type,
            id: String(review.resource.id),
            title: review.resource.title
          }
        }
      }
    );
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
