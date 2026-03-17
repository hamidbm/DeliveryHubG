import { ObjectId } from 'mongodb';
import type { TaxonomyCategory, TaxonomyDocumentType } from '../../../types';
import { getServerDb } from '../client';

export const listTaxonomyCategories = async (activeOnly = false) => {
  try {
    const db = await getServerDb();
    const query = activeOnly ? { isActive: true } : {};
    return await db.collection('taxonomy_categories').find(query).sort({ sortOrder: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveTaxonomyCategoryRecord = async (category: Partial<TaxonomyCategory>) => {
  const db = await getServerDb();
  const { _id, ...data } = category;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('taxonomy_categories').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  }
  return await db.collection('taxonomy_categories').insertOne(data);
};

export const listTaxonomyDocumentTypes = async (activeOnly = false, categoryId?: string) => {
  try {
    const db = await getServerDb();
    const query: Record<string, unknown> = activeOnly ? { isActive: true } : {};
    if (categoryId) query.categoryId = String(categoryId);
    return await db.collection('taxonomy_document_types').find(query).sort({ sortOrder: 1 }).toArray();
  } catch {
    return [];
  }
};

export const saveTaxonomyDocumentTypeRecord = async (documentType: Partial<TaxonomyDocumentType>) => {
  const db = await getServerDb();
  const { _id, ...data } = documentType;
  if (_id && ObjectId.isValid(_id as string)) {
    return await db.collection('taxonomy_document_types').updateOne({ _id: new ObjectId(_id) }, { $set: data });
  }
  return await db.collection('taxonomy_document_types').insertOne(data);
};
