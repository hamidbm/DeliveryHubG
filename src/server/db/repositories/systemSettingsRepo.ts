import { getServerDb } from '../client';

export const getAiSettingsDoc = async () => {
  const db = await getServerDb();
  return await db.collection('ai_settings').findOne({ key: 'ai_settings' });
};

export const getLegacyGlobalConfigDoc = async () => {
  const db = await getServerDb();
  return await db.collection('settings').findOne({ key: 'global_config' });
};

export const saveAiSettingsDoc = async (doc: any) => {
  const db = await getServerDb();
  return await db.collection('ai_settings').updateOne(
    { key: 'ai_settings' },
    { $set: doc },
    { upsert: true }
  );
};
