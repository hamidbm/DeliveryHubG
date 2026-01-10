
import clientPromise from '../lib/mongodb';

export const getDb = async () => {
  const client = await clientPromise;
  return client.db('deliveryhub');
};

export const fetchAllApplications = async () => {
  try {
    const db = await getDb();
    return await db.collection('applications').find({}).toArray();
  } catch (error) {
    console.error("Failed to fetch applications:", error);
    return [];
  }
};

export const fetchAllWorkItems = async () => {
  try {
    const db = await getDb();
    return await db.collection('workitems').find({}).toArray();
  } catch (error) {
    console.error("Failed to fetch work items:", error);
    return [];
  }
};

export const seedDatabase = async (apps: any[], items: any[]) => {
  try {
    const db = await getDb();
    // Clear existing to avoid duplicates in demo
    await db.collection('applications').deleteMany({});
    await db.collection('workitems').deleteMany({});
    
    await db.collection('applications').insertMany(apps);
    await db.collection('workitems').insertMany(items);
    return { success: true };
  } catch (error) {
    console.error("Seeding failed:", error);
    return { success: false };
  }
};
