import { ObjectId } from 'mongodb';
import { getServerDb } from '../client';

export type DashboardContextRecord = {
  bundles: any[];
  applications: any[];
  milestones: any[];
  workItems: any[];
  users: any[];
  snapshots: any[];
};

export const loadDashboardContextRepo = async (): Promise<DashboardContextRecord> => {
  const db = await getServerDb();
  const [bundles, applications, milestones, workItems, users, snapshots] = await Promise.all([
    db.collection('bundles').find({}).project({ _id: 1, id: 1, name: 1, title: 1 }).toArray(),
    db.collection('applications').find({}).project({ _id: 1, id: 1, bundleId: 1, name: 1, status: 1 }).toArray(),
    db.collection('milestones').find({}).project({ _id: 1, id: 1, bundleId: 1, name: 1, targetDate: 1, endDate: 1, startDate: 1, status: 1 }).toArray(),
    db.collection('workitems').find({ $or: [{ isArchived: { $exists: false } }, { isArchived: false }] })
      .project({
        _id: 1, id: 1, key: 1, title: 1, type: 1, status: 1, bundleId: 1, applicationId: 1, milestoneIds: 1,
        createdAt: 1, updatedAt: 1, completedAt: 1, dueDate: 1, assignedTo: 1, assignee: 1, risk: 1, severity: 1, links: 1
      }).toArray(),
    db.collection('users').find({}).project({ _id: 1, id: 1, email: 1, name: 1, team: 1, role: 1 }).toArray(),
    db.collection('portfolio_snapshots').find({}).project({
      createdAt: 1,
      blockedWorkItems: 1,
      overdueWorkItems: 1,
      criticalApplications: 1
    }).toArray()
  ]);
  return { bundles, applications, milestones, workItems, users, snapshots };
};

export const listDashboardMilestoneItemRecords = async (milestoneId: string) => {
  const db = await getServerDb();
  return await db.collection('workitems').find({
    $and: [
      {
        $or: [
          { milestoneIds: milestoneId },
          ...(ObjectId.isValid(milestoneId) ? [{ milestoneIds: new ObjectId(milestoneId) }] : []),
          { milestoneId }
        ]
      },
      { $or: [{ isArchived: { $exists: false } }, { isArchived: false }] }
    ]
  }).project({ status: 1, dueDate: 1, assignedTo: 1, links: 1 }).toArray();
};
