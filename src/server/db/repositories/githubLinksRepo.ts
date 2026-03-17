import { getServerDb } from '../client';

const ensureGithubIndexes = async (db: any) => {
  await db.collection('github_links').createIndex({ repo: 1, prNumber: 1 }, { unique: true });
  await db.collection('github_links').createIndex({ workItemId: 1 });
};

export const getGithubLinkRecord = async (repo: string, prNumber: number) => {
  const db = await getServerDb();
  await ensureGithubIndexes(db);
  return await db.collection('github_links').findOne({ repo: String(repo), prNumber: Number(prNumber) });
};

export const upsertGithubLinkRecord = async (input: {
  repo: string;
  prNumber: number;
  workItemId: string;
  url: string;
  state: string;
  title: string;
  updatedAt: string;
}) => {
  const db = await getServerDb();
  await ensureGithubIndexes(db);
  return await db.collection('github_links').updateOne(
    { repo: String(input.repo), prNumber: Number(input.prNumber) },
    {
      $set: {
        workItemId: String(input.workItemId),
        repo: String(input.repo),
        prNumber: Number(input.prNumber),
        url: input.url,
        state: input.state,
        title: input.title,
        updatedAt: input.updatedAt
      }
    },
    { upsert: true }
  );
};
