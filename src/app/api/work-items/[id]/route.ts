
import { NextResponse } from 'next/server';
import { fetchWorkItemById, saveWorkItem, getDb, emitEvent } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await fetchWorkItemById(id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const itemData = await request.json();
    const db = await getDb();
    const now = new Date().toISOString();

    // 1. Fetch original state to calculate delta
    const originalItem = await fetchWorkItemById(id);
    if (!originalItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (itemData.status && itemData.status !== originalItem.status) {
      const criticalStatuses = new Set(['DONE', 'BLOCKED', 'REVIEW']);
      if (criticalStatuses.has(itemData.status)) {
        const userName = String(payload.name || '');
        const userRole = String((payload as any).role || '');
        const privilegedRoles = new Set([
          'CMO Architect',
          'SVP Architect',
          'SVP PM',
          'SVP Engineer',
          'Director',
          'VP',
          'CIO'
        ]);
        const isOwner = userName && (originalItem.assignedTo === userName || originalItem.createdBy === userName);
        if (!isOwner && !privilegedRoles.has(userRole)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    if (
      (itemData.priority && itemData.priority !== originalItem.priority) ||
      (itemData.assignedTo !== undefined && itemData.assignedTo !== originalItem.assignedTo)
    ) {
      const userName = String(payload.name || '');
      const userRole = String((payload as any).role || '');
      const privilegedRoles = new Set([
        'CMO Architect',
        'SVP Architect',
        'SVP PM',
        'SVP Engineer',
        'Director',
        'VP',
        'CIO'
      ]);
      const isOwner = userName && (originalItem.assignedTo === userName || originalItem.createdBy === userName);
      if (!isOwner && !privilegedRoles.has(userRole)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 2. Normalize links to avoid duplicates or self-links
    let normalizedLinks = itemData.links;
    if (Array.isArray(itemData.links)) {
      const seen = new Set<string>();
      normalizedLinks = itemData.links
        .filter((l: any) => l && l.targetId && l.type)
        .filter((l: any) => String(l.targetId) !== String(id))
        .filter((l: any) => {
          const key = `${l.type}:${l.targetId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }

    // 2. Commit primary update
    const result = await saveWorkItem({ ...itemData, links: normalizedLinks, _id: id }, payload);

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
          const targetFilter = ObjectId.isValid(link.targetId)
            ? { _id: new ObjectId(link.targetId) }
            : { $or: [{ id: link.targetId }, { key: link.targetKey }] };
          await db.collection('workitems').updateOne(
            targetFilter,
            { 
              $addToSet: { 
                links: { type: inv, targetId: id, targetKey: originalItem.key, targetTitle: originalItem.title } 
              },
              $push: { activity: { user: 'Nexus System', action: 'AUTO_LINK_SYNC', field: 'links', to: `Inferred ${inv} from ${originalItem.key}`, createdAt: now } }
            } as any
          );
        }
      }

      // Find Removed Links
      const removed = oldLinks.filter(ol => !newLinks.some(nl => nl.targetId === ol.targetId && nl.type === ol.type));
      for (const link of removed) {
        const inv = getInverse(link.type);
        if (inv && link.targetId) {
          const targetFilter = ObjectId.isValid(link.targetId)
            ? { _id: new ObjectId(link.targetId) }
            : { $or: [{ id: link.targetId }, { key: link.targetKey }] };
          await db.collection('workitems').updateOne(
            targetFilter,
            { 
              $pull: { links: { targetId: id, type: inv } },
              $push: { activity: { user: 'Nexus System', action: 'AUTO_LINK_PURGE', field: 'links', to: `Severed ${inv} relation with ${originalItem.key}`, createdAt: now } }
            } as any
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const item = await fetchWorkItemById(id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const userName = String(payload.name || '');
    const userRole = String((payload as any).role || '');
    const privilegedRoles = new Set([
      'CMO Architect',
      'SVP Architect',
      'SVP PM',
      'SVP Engineer',
      'Director',
      'VP',
      'CIO'
    ]);
    const isOwner = userName && (item.assignedTo === userName || item.createdBy === userName);
    if (!isOwner && !privilegedRoles.has(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    await db.collection('workitems').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isArchived: true, archivedAt: now, archivedBy: userName, updatedAt: now } }
    );

    try {
      await emitEvent({
        ts: now,
        type: 'workitems.item.archived',
        actor: {
          userId: String((payload as any).id || (payload as any).userId || (payload as any).email || userName),
          displayName: String((payload as any).name || (payload as any).displayName || userName),
          email: (payload as any).email ? String((payload as any).email) : undefined
        },
        resource: { type: 'workitems.item', id: String(item._id || item.id || id), title: item.title },
        context: { bundleId: item.bundleId, appId: item.applicationId }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Archive failed' }, { status: 500 });
  }
}
