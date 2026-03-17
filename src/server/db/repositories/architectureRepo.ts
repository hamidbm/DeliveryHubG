import { ObjectId } from 'mongodb';
import type { AppInterface, ArchitectureDiagram, BusinessCapability } from '../../../types';
import { getServerDb } from '../client';

export const listArchitectureDiagrams = async (filters: { bundleId?: string | null; applicationId?: string | null } = {}) => {
  try {
    const db = await getServerDb();
    const query: Record<string, unknown> = {};
    if (filters.bundleId && filters.bundleId !== 'all') query.bundleId = String(filters.bundleId);
    if (filters.applicationId && filters.applicationId !== 'all') query.applicationId = String(filters.applicationId);
    return await db.collection('architecture_diagrams').find(query).sort({ updatedAt: -1, title: 1 }).toArray();
  } catch {
    return [];
  }
};

export const getArchitectureDiagramById = async (id: string) => {
  try {
    const db = await getServerDb();
    if (ObjectId.isValid(id)) {
      return await db.collection('architecture_diagrams').findOne({ _id: new ObjectId(id) });
    }
    return await db.collection('architecture_diagrams').findOne({ id });
  } catch {
    return null;
  }
};

export const saveArchitectureDiagramRecord = async (diagram: Partial<ArchitectureDiagram>, user?: { name?: string }) => {
  const db = await getServerDb();
  const { _id, ...data } = diagram;
  const now = new Date().toISOString();
  const userName = user?.name || 'System';

  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('architecture_diagrams').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now } }
    );
  }

  return await db.collection('architecture_diagrams').insertOne({
    ...data,
    createdBy: userName,
    updatedAt: now
  });
};

export const deleteArchitectureDiagramRecord = async (id: string) => {
  const db = await getServerDb();
  return await db.collection('architecture_diagrams').deleteOne({ _id: new ObjectId(id) });
};

export const listCapabilities = async () => {
  try {
    const db = await getServerDb();
    return await db.collection('capabilities').find({}).sort({ level: 1, name: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveCapabilityRecord = async (capability: Partial<BusinessCapability>) => {
  const db = await getServerDb();
  const { _id, ...data } = capability;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('capabilities').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  }
  return await db.collection('capabilities').insertOne(data);
};

export const deleteCapabilityRecord = async (id: string) => {
  const db = await getServerDb();
  return await db.collection('capabilities').deleteOne({ _id: new ObjectId(id) });
};

export const listInterfaces = async (appId?: string) => {
  try {
    const db = await getServerDb();
    const query = appId && appId !== 'all' ? { $or: [{ sourceAppId: appId }, { targetAppId: appId }] } : {};
    return await db.collection('interfaces').find(query).toArray();
  } catch {
    return [];
  }
};

export const saveInterfaceRecord = async (data: Partial<AppInterface>) => {
  const db = await getServerDb();
  const { _id, ...rest } = data;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('interfaces').updateOne({ _id: new ObjectId(_id) }, { $set: rest });
  }
  return await db.collection('interfaces').insertOne(rest);
};

export const deleteInterfaceRecord = async (id: string) => {
  const db = await getServerDb();
  return await db.collection('interfaces').deleteOne({ _id: new ObjectId(id) });
};

const ensureDiagramTemplateIndexes = async (db: any) => {
  try {
    await db.collection('diagram_templates').createIndex({ key: 1 }, { unique: true });
    await db.collection('diagram_templates').createIndex({ diagramType: 1, format: 1, isActive: 1 });
    await db.collection('diagram_templates').createIndex(
      { diagramType: 1, format: 1, isDefault: 1 },
      { unique: true, partialFilterExpression: { isDefault: true } }
    );
  } catch {}
};

export const listDiagramTemplates = async (filters: {
  diagramType?: string;
  format?: string;
  includeInactive?: boolean;
} = {}) => {
  try {
    const db = await getServerDb();
    await ensureDiagramTemplateIndexes(db);
    const query: Record<string, unknown> = filters.includeInactive ? {} : { isActive: { $ne: false } };
    if (filters.diagramType) query.diagramType = filters.diagramType;
    if (filters.format) query.format = filters.format;
    return await db.collection('diagram_templates').find(query).sort({ isDefault: -1, name: 1 }).toArray();
  } catch {
    return [];
  }
};

export const getDiagramTemplateById = async (id: string) => {
  try {
    const db = await getServerDb();
    await ensureDiagramTemplateIndexes(db);
    if (ObjectId.isValid(id)) {
      return await db.collection('diagram_templates').findOne({ _id: new ObjectId(id) });
    }
    return await db.collection('diagram_templates').findOne({ id });
  } catch {
    return null;
  }
};

export const saveDiagramTemplateRecord = async (template: any, user?: { name?: string }) => {
  const db = await getServerDb();
  await ensureDiagramTemplateIndexes(db);
  const now = new Date().toISOString();
  const actor = user?.name || 'System';
  const { _id, ...data } = template;

  if (_id && ObjectId.isValid(_id)) {
    if (data.isDefault && data.diagramType && data.format) {
      await db.collection('diagram_templates').updateMany(
        { diagramType: data.diagramType, format: data.format, isDefault: true, _id: { $ne: new ObjectId(_id) } },
        { $set: { isDefault: false, updatedAt: now, updatedBy: actor } }
      );
    }
    return await db.collection('diagram_templates').updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...data, updatedAt: now, updatedBy: actor } }
    );
  }
  const result = await db.collection('diagram_templates').insertOne({
    ...data,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor
  });
  if (data.isDefault && data.diagramType && data.format) {
    await db.collection('diagram_templates').updateMany(
      { diagramType: data.diagramType, format: data.format, isDefault: true, _id: { $ne: result.insertedId } },
      { $set: { isDefault: false, updatedAt: now, updatedBy: actor } }
    );
  }
  return result;
};

export const deleteDiagramTemplateRecord = async (id: string) => {
  const db = await getServerDb();
  await ensureDiagramTemplateIndexes(db);
  if (ObjectId.isValid(id)) {
    return await db.collection('diagram_templates').deleteOne({ _id: new ObjectId(id) });
  }
  return await db.collection('diagram_templates').deleteOne({ id });
};
