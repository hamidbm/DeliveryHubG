import { NextResponse } from 'next/server';
import { getNotificationSettings, getUserNotificationPrefs, saveUserNotificationPrefs } from '../../../../services/notifications';
import { requireStandardUser, requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const prefs = await getUserNotificationPrefs(auth.principal.userId);
    const settings = await getNotificationSettings();
    const availableTypes = Object.keys(settings.enabledTypes || {}).sort();
    return NextResponse.json({ prefs, availableTypes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch notification preferences' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const prefs = await saveUserNotificationPrefs(auth.principal.userId, body || {});
    return NextResponse.json({ prefs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update notification preferences' }, { status: 500 });
  }
}
