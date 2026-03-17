import { NextResponse } from 'next/server';
import { isAdminOrCmo } from '../../../../services/authz';
import { getNotificationSettings, saveNotificationSettings } from '../../../../services/notifications';
import { requireStandardUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      accountType: auth.principal.accountType
    };
    if (!(await isAdminOrCmo(user))) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }
    const settings = await getNotificationSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notification settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email,
      accountType: auth.principal.accountType
    };
    if (!(await isAdminOrCmo(user))) {
      return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    }
    const body = await request.json();
    const settings = await saveNotificationSettings(body, auth.principal.userId || 'system');
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification settings' }, { status: 500 });
  }
}
