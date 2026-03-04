import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getAdminBootstrapEmails, upsertAdmin } from '../../../../services/db';
import { getBundleOwnership, isAdminOrCmo } from '../../../../services/authz';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function GET() {
  // Await cookies() as it is now asynchronous in recent Next.js versions.
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const normalizedEmail = String(payload.email || '').trim().toLowerCase();
    const bootstrapEmails = getAdminBootstrapEmails();
    if (normalizedEmail && bootstrapEmails.has(normalizedEmail)) {
      const userId = String(payload.id || payload.userId || '');
      if (userId) {
        await upsertAdmin(userId, 'system');
      }
    }
    const userId = String(payload.id || payload.userId || '');
    const bundleOwnership = await getBundleOwnership(userId);
    const isAdminOrCMO = await isAdminOrCmo({
      userId,
      role: payload.role as string | undefined
    });
    return NextResponse.json({
      user: payload,
      permissions: {
        role: payload.role,
        isAdminOrCMO,
        bundleOwnership
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
}
