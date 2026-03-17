import { ObjectId } from 'mongodb';
import type { WikiAsset, WikiPage, WikiTemplate, WikiTheme } from '../../../types';
import { getServerDb } from '../client';

const ensureWikiAssetIndexes = async (db: any) => {
  await db.collection('wiki_assets').createIndex({ artifactKind: 1, bundleId: 1, applicationId: 1, documentTypeId: 1 });
};

const ensureWikiTemplateIndexes = async (db: any) => {
  await db.collection('wiki_templates').createIndex({ documentTypeId: 1, isActive: 1 });
  await db.collection('wiki_templates').createIndex(
    { documentTypeId: 1, isDefault: 1 },
    { unique: true, partialFilterExpression: { isDefault: true } }
  );
};

const ensureWikiAiInsightIndexes = async (db: any) => {
  await db.collection('wiki_ai_insights').createIndex({ targetType: 1, targetId: 1, type: 1, createdAt: -1 });
};

export const listWikiPages = async () => {
  try {
    const db = await getServerDb();
    return await db.collection('wiki_pages').find({}).toArray();
  } catch {
    return [];
  }
};

export const getWikiPageById = async (id: string) => {
  try {
    const db = await getServerDb();
    if (!ObjectId.isValid(id)) return await db.collection('wiki_pages').findOne({ id });
    return await db.collection('wiki_pages').findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
};

export const saveWikiPageRecord = async (page: Partial<WikiPage>) => {
  const db = await getServerDb();
  const { _id, ...data } = page;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    const existing = await db.collection('wiki_pages').findOne({ _id: new ObjectId(_id) });
    if (existing) {
      await db.collection('wiki_history').insertOne({
        ...existing,
        pageId: existing._id,
        _id: new ObjectId(),
        versionedAt: now
      });
    }
    return await db.collection('wiki_pages').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('wiki_pages').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now,
    version: 1
  });
};

export const listWikiHistory = async (pageId: string) => {
  try {
    const db = await getServerDb();
    return await db.collection('wiki_history').find({ pageId: new ObjectId(pageId) }).sort({ versionedAt: -1 }).toArray();
  } catch {
    return [];
  }
};

export const revertWikiPageRecord = async (pageId: string, versionId: string) => {
  const db = await getServerDb();
  const version = await db.collection('wiki_history').findOne({ _id: new ObjectId(versionId) });
  if (!version) throw new Error('Version not found');
  const { _id, pageId: pid, versionedAt, ...data } = version;
  return await saveWikiPageRecord({ ...data, _id: pageId } as any);
};

export const listWikiSpaces = async () => {
  try {
    const db = await getServerDb();
    return await db.collection('wiki_spaces').find({}).toArray();
  } catch {
    return [];
  }
};

export const saveWikiSpaceRecord = async (space: Partial<any>) => {
  const db = await getServerDb();
  const { _id, ...data } = space;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('wiki_spaces').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  }
  return await db.collection('wiki_spaces').insertOne(data);
};

export const listWikiComments = async (pageId: string) => {
  try {
    const db = await getServerDb();
    const page = await db.collection('wiki_pages').findOne({ _id: new ObjectId(pageId) });
    return page?.comments || [];
  } catch {
    return [];
  }
};

export const addWikiCommentRecord = async (commentData: any) => {
  const db = await getServerDb();
  const { pageId, ...comment } = commentData;
  return await db.collection('wiki_pages').updateOne(
    { _id: new ObjectId(pageId) },
    { $push: { comments: { ...comment, createdAt: new Date().toISOString() } } } as any
  );
};

export const listWikiAssets = async ({ includeFeedback = true }: { includeFeedback?: boolean } = {}) => {
  try {
    const db = await getServerDb();
    await ensureWikiAssetIndexes(db);
    const query = includeFeedback ? {} : { artifactKind: { $ne: 'feedback' } };
    return await db.collection('wiki_assets').find(query, { projection: { 'images.data': 0 } }).toArray();
  } catch {
    return [];
  }
};

export const getWikiAssetById = async (id: string) => {
  try {
    const db = await getServerDb();
    await ensureWikiAssetIndexes(db);
    if (!ObjectId.isValid(id)) return await db.collection('wiki_assets').findOne({ id });
    return await db.collection('wiki_assets').findOne({ _id: new ObjectId(id) });
  } catch {
    return null;
  }
};

export const saveWikiAssetRecord = async (asset: Partial<WikiAsset>) => {
  const db = await getServerDb();
  await ensureWikiAssetIndexes(db);
  const { _id, ...data } = asset;
  const now = new Date().toISOString();

  if (_id && ObjectId.isValid(_id as string)) {
    const existing = await db.collection('wiki_assets').findOne({ _id: new ObjectId(_id) });
    if (!existing) {
      return await db.collection('wiki_assets').insertOne({
        _id: new ObjectId(_id),
        ...data,
        artifactKind: data.artifactKind || 'primary',
        createdAt: now,
        updatedAt: now,
        version: data.version || 1
      });
    }
    return await db.collection('wiki_assets').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('wiki_assets').insertOne({
    ...data,
    artifactKind: data.artifactKind || 'primary',
    createdAt: now,
    updatedAt: now,
    version: 1
  });
};

export const listWikiThemes = async (activeOnly = false) => {
  try {
    const db = await getServerDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('wiki_themes').find(query).toArray();
  } catch {
    return [];
  }
};

export const saveWikiThemeRecord = async (theme: Partial<WikiTheme>) => {
  const db = await getServerDb();
  const { _id, ...data } = theme;
  if (_id) {
    const idValue = typeof _id === 'string' ? _id : String(_id);
    if (ObjectId.isValid(idValue)) {
      return await db.collection('wiki_themes').updateOne({ _id: new ObjectId(idValue) }, { $set: data });
    }
  }
  if (data.key) {
    return await db.collection('wiki_themes').updateOne(
      { key: data.key },
      { $set: data },
      { upsert: true }
    );
  }
  return await db.collection('wiki_themes').insertOne(data);
};

export const deleteWikiThemeRecord = async (id: string) => {
  const db = await getServerDb();
  return await db.collection('wiki_themes').deleteOne({ _id: new ObjectId(id) });
};

export const listWikiTemplates = async ({
  documentTypeId,
  activeOnly = false
}: {
  documentTypeId?: string;
  activeOnly?: boolean;
}) => {
  try {
    const db = await getServerDb();
    await ensureWikiTemplateIndexes(db);
    const query: Record<string, unknown> = {};
    if (documentTypeId) query.documentTypeId = String(documentTypeId);
    if (activeOnly) query.isActive = true;
    return await db.collection('wiki_templates').find(query).sort({ isDefault: -1, updatedAt: -1, name: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveWikiTemplateRecord = async (template: Partial<WikiTemplate>, user?: { name?: string }) => {
  const db = await getServerDb();
  await ensureWikiTemplateIndexes(db);
  const { _id, ...data } = template;
  const now = new Date().toISOString();
  const docTypeId = data.documentTypeId ? String(data.documentTypeId) : undefined;
  const payload = {
    ...data,
    documentTypeId: docTypeId,
    updatedAt: now,
    updatedBy: user?.name || data.updatedBy
  };

  if (payload.isDefault && docTypeId) {
    const excludeId = _id && ObjectId.isValid(String(_id)) ? new ObjectId(String(_id)) : null;
    await db.collection('wiki_templates').updateMany(
      { documentTypeId: docTypeId, isDefault: true, ...(excludeId ? { _id: { $ne: excludeId } } : {}) },
      { $set: { isDefault: false, updatedAt: now } }
    );
  }

  if (_id && ObjectId.isValid(String(_id))) {
    return await db.collection('wiki_templates').updateOne(
      { _id: new ObjectId(String(_id)) },
      { $set: payload }
    );
  }

  return await db.collection('wiki_templates').insertOne({
    ...payload,
    isActive: payload.isActive ?? true,
    isDefault: payload.isDefault ?? false,
    createdAt: now,
    createdBy: user?.name || data.createdBy
  });
};

export const deactivateWikiTemplateRecord = async (id: string, user?: { name?: string }) => {
  const db = await getServerDb();
  await ensureWikiTemplateIndexes(db);
  return await db.collection('wiki_templates').updateOne(
    { _id: new ObjectId(id) },
    { $set: { isActive: false, updatedAt: new Date().toISOString(), updatedBy: user?.name } }
  );
};

export const saveWikiAiInsightRecord = async ({
  targetId,
  targetType,
  type,
  content
}: {
  targetId: string;
  targetType: 'page' | 'asset';
  type: string;
  content: string;
}) => {
  const db = await getServerDb();
  await ensureWikiAiInsightIndexes(db);
  const now = new Date().toISOString();
  return await db.collection('wiki_ai_insights').insertOne({
    targetId: String(targetId),
    targetType,
    type,
    content,
    createdAt: now
  });
};

export const listWikiAiInsights = async (targetId: string, targetType: 'page' | 'asset') => {
  try {
    const db = await getServerDb();
    await ensureWikiAiInsightIndexes(db);
    const items = await db
      .collection('wiki_ai_insights')
      .find({ targetId: String(targetId), targetType })
      .sort({ createdAt: -1 })
      .toArray();
    const latest: Record<string, { content: string; generatedAt: string }> = {};
    for (const item of items) {
      if (!latest[item.type]) {
        latest[item.type] = { content: item.content, generatedAt: item.createdAt };
      }
    }
    return latest;
  } catch {
    return {};
  }
};

export const clearWikiAiInsightRecords = async (targetId: string, targetType: 'page' | 'asset') => {
  const db = await getServerDb();
  await ensureWikiAiInsightIndexes(db);
  return await db.collection('wiki_ai_insights').deleteMany({ targetId: String(targetId), targetType });
};
