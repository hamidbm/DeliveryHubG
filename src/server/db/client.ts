import { getMongoClientPromise, getMongoDbName } from '../../lib/mongodb';

export const getServerDb = async () => {
  const client = await getMongoClientPromise();
  return client.db(getMongoDbName());
};
