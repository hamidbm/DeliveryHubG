import { NextResponse } from 'next/server';
import { hasAdminRecord } from '../../server/db/repositories/adminsRepo';
import { canComment } from '../../services/authz';
import { resolveCurrentPrincipal, resolvePrincipal } from './principal';
import { isGuestPrincipal, type Principal } from './roles';

type GuardOk = { ok: true; principal: Principal; response?: never };
type GuardFail = { ok: false; response: NextResponse; principal?: never };
export type GuardResult = GuardOk | GuardFail;

const unauthorized = (message = 'Unauthorized') =>
  NextResponse.json({ error: message }, { status: 401 });

const forbidden = (message = 'Forbidden') =>
  NextResponse.json({ error: message }, { status: 403 });

const resolveByContext = async (request?: Request) =>
  request ? await resolvePrincipal(request) : await resolveCurrentPrincipal();

export const requireUser = async (request?: Request): Promise<GuardResult> => {
  const principal = await resolveByContext(request);
  if (!principal) return { ok: false, response: unauthorized() };
  return { ok: true, principal };
};

export const requireStandardUser = async (request?: Request): Promise<GuardResult> => {
  const result = await requireUser(request);
  if (!result.ok) return result;
  if (isGuestPrincipal(result.principal)) {
    return { ok: false, response: forbidden('Guest accounts cannot perform this action') };
  }
  return result;
};

export const requireCommentPermission = async (request?: Request): Promise<GuardResult> => {
  const result = await requireUser(request);
  if (!result.ok) return result;
  if (!canComment(result.principal as any)) {
    return { ok: false, response: forbidden('You do not have permission to comment') };
  }
  return result;
};

export const requireAdmin = async (request?: Request): Promise<GuardResult> => {
  const result = await requireStandardUser(request);
  if (!result.ok) return result;
  if (!(await hasAdminRecord(result.principal.userId))) {
    return { ok: false, response: forbidden('Admin access required') };
  }
  return result;
};
