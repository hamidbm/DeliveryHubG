import { getDb } from '../db/client';

export const seedDatabase = async (applications: any[], workItems: any[], wikiPages: any[]) => {
  try {
    const db = await getDb();
    if (applications.length) await db.collection('applications').insertMany(applications);
    if (workItems.length) await db.collection('workitems').insertMany(workItems);
    if (wikiPages.length) await db.collection('wiki_pages').insertMany(wikiPages);
    return { success: true };
  } catch (error) {
    console.error('Seed error:', error);
    return { success: false };
  }
};
