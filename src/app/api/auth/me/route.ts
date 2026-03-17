import { NextResponse } from 'next/server';
import { saveAdminRecord } from '../../../../server/db/repositories/adminsRepo';
import { getAdminBootstrapEmailsFromEnv } from '../../../../server/db/repositories/usersRepo';
import { getBundleOwnership, isAdminOrCmo } from '../../../../services/authz';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { principal } = auth;
    const normalizedEmail = String(principal.email || '').trim().toLowerCase();
    const bootstrapEmails = getAdminBootstrapEmailsFromEnv();
    if (normalizedEmail && bootstrapEmails.has(normalizedEmail)) {
      await saveAdminRecord(principal.userId, 'system');
    }
    const bundleOwnership = await getBundleOwnership(principal.userId);
    const isAdminOrCMO = await isAdminOrCmo({
      userId: principal.userId,
      role: principal.role || undefined,
      accountType: principal.accountType
    });
    return NextResponse.json({
      user: {
        id: principal.userId,
        userId: principal.userId,
        email: principal.email,
        name: principal.fullName,
        team: principal.team,
        role: principal.role,
        username: principal.username,
        accountType: principal.accountType
      },
      permissions: {
        role: principal.role,
        isAdminOrCMO,
        bundleOwnership,
        isGuest: principal.accountType === 'GUEST'
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
