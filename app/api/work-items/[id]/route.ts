
import { NextResponse } from 'next/server';
import { fetchWorkItemById, saveWorkItem, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const item = await fetchWorkItemById(params.id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const itemData = await request.json();
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Fetch original state to calculate delta
    const originalItem = await fetchWorkItemById(params.id);
    if (!originalItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // 2. Commit primary update
    const result = await saveWorkItem({ ...itemData, _id: params.id }, payload);

    // 3. Handle Bi-directional Linking Logic (Sync inverse relationships)
    if (itemData.links && Array.isArray(itemData.links)) {
      const oldLinks = originalItem.links || [];
      const newLinks = itemData.links;

      // Symmetric mapping helper
      const getInverse = (type: string) => {
        const map: Record<string, string> = {
          'BLOCKS': 'IS_BLOCKED_BY',
          'IS_BLOCKED_BY': 'BLOCKS',
          'DUPLICATES': 'IS_DUPLICATED_BY',
          'IS_DUPLICATED_BY': 'DUPLICATES',
          'RELATES_TO': 'RELATES_TO'
        };
        return map[type] || '';
      };

      // Find Added Links
      const added = newLinks.filter(nl => !oldLinks.some(ol => ol.targetId === nl.targetId && ol.type === nl.type));
      for (const link of added) {
        const inv = getInverse(link.type);
        if (inv && link.targetId) {
          await db.collection('workitems').updateOne(
            { _id: new ObjectId(link.targetId) },
            { 
              $addToSet: { 
                links: { type: inv, targetId: params.id, targetKey: originalItem.key, targetTitle: originalItem.title } 
              },
              $push: { activity: { user: 'Nexus System', action: 'AUTO_LINK_SYNC', field: 'links', to: `Inferred ${inv} from ${originalItem.key}`, createdAt: now } as any }
            }
          );
        }
      }

      // Find Removed Links
      const removed = oldLinks.filter(ol => !newLinks.some(nl => nl.targetId === ol.targetId && nl.type === ol.type));
      for (const link of removed) {
        const inv = getInverse(link.type);
        if (inv && link.targetId) {
          await db.collection('workitems').updateOne(
            { _id: new ObjectId(link.targetId) },
            { 
              $pull: { links: { targetId: params.id, type: inv } },
              $push: { activity: { user: 'Nexus System', action: 'AUTO_LINK_PURGE', field: 'links', to: `Severed ${inv} relation with ${originalItem.key}`, createdAt: now } as any }
            }
          );
        }
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Patch Error:", error);
    return NextResponse.json({ error: error.message || 'Update failed' }, { status: 500 });
  }
}
