import { getServerDb } from '../client';

export const loadPortfolioSnapshotSourceData = async () => {
  const db = await getServerDb();
  const [applications, bundles, workItems, reviews, milestones] = await Promise.all([
    db.collection('applications').find(
      {},
      { projection: { _id: 1, id: 1, aid: 1, name: 1, health: 1, status: 1, bundleId: 1 } }
    ).toArray(),
    db.collection('bundles').find(
      {},
      { projection: { _id: 1, id: 1, key: 1, name: 1, title: 1 } }
    ).toArray(),
    db.collection('workitems').find(
      {},
      {
        projection: {
          _id: 1,
          id: 1,
          key: 1,
          title: 1,
          name: 1,
          status: 1,
          dueDate: 1,
          blocked: 1,
          assignee: 1,
          assignedTo: 1,
          bundleId: 1,
          applicationId: 1,
          milestoneId: 1,
          milestoneIds: 1,
          priority: 1,
          links: 1,
          linkSummary: 1,
          dependency: 1
        }
      }
    ).toArray(),
    db.collection('reviews').find(
      {},
      {
        projection: {
          _id: 1,
          id: 1,
          status: 1,
          currentCycleStatus: 1,
          dueDate: 1,
          currentDueAt: 1,
          applicationId: 1,
          bundleId: 1,
          title: 1,
          resource: 1
        }
      }
    ).toArray(),
    db.collection('milestones').find(
      {},
      {
        projection: {
          _id: 1,
          id: 1,
          name: 1,
          title: 1,
          targetDate: 1,
          dueDate: 1,
          endDate: 1,
          status: 1,
          bundleId: 1
        }
      }
    ).toArray()
  ]);

  return { applications, bundles, workItems, reviews, milestones };
};
