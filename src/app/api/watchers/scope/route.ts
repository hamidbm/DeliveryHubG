import { NextResponse } from 'next/server';
import { listWatchersForScope, canViewScopeWatchers } from '../../../../services/watchers';
import { requireUser } from '../../../../shared/auth/guards';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      role: auth.principal.role || undefined,
      email: auth.principal.email
    };
    const { searchParams } = new URL(request.url);
    const scopeType = String(searchParams.get('scopeType') || '').toUpperCase();
    const scopeId = String(searchParams.get('scopeId') || '');
    if (!scopeType || !scopeId) return NextResponse.json({ error: 'scopeType and scopeId required' }, { status: 400 });
    const allowed = await canViewScopeWatchers(scopeType as any, scopeId, user);
    if (!allowed) return NextResponse.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, { status: 403 });
    const items = await listWatchersForScope(scopeType as any, scopeId);
    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load watchers' }, { status: 500 });
  }
}
