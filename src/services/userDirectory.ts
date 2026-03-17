import { listUsersByIds, resolveUsersForMentions } from '../server/db/repositories/usersRepo';

export const fetchUsersByIds = async (ids: string[]) => listUsersByIds(ids);

export const resolveMentionUsers = async (tokens: string[]) => resolveUsersForMentions(tokens);
