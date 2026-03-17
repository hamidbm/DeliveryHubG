import { normalizeEventType } from '../../services/eventsTaxonomy';
import { getDb } from '../db/client';
import type { EventRecord } from '../../types';

const ensureEventIndexes = async (db: any) => {
  await db.collection('events').createIndex({ ts: -1 });
  await db.collection('events').createIndex({ type: 1, ts: -1 });
  await db.collection('events').createIndex({ 'actor.userId': 1, ts: -1 });
  await db.collection('events').createIndex({ 'resource.type': 1, 'resource.id': 1, ts: -1 });
  await db.collection('events').createIndex({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });
};

export const emitEvent = async (event: Omit<EventRecord, '_id'>) => {
  const db = await getDb();
  await ensureEventIndexes(db);
  const typePattern = /^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+$/;
  if (!typePattern.test(event.type)) {
    throw new Error(`Invalid event type "${event.type}". Expected <module>.<entity>.<verb>.`);
  }
  const tsValue = event.ts ? new Date(event.ts) : new Date();
  const normalized = normalizeEventType(event.type);
  return await db.collection('events').insertOne({
    ...event,
    ts: tsValue,
    canonicalType: normalized.canonicalType,
    category: normalized.category,
    modulePrefix: normalized.modulePrefix
  });
};
