import { NextResponse } from 'next/server';
import { isAdminOrCmo } from '../../../../services/authz';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { listDeliveryPolicyOverrideRecords } from '../../../../server/db/repositories/deliveryPolicyRepo';

export async function GET() {
  try {
    const auth = await requireStandardUser();
    if (!auth.ok) return auth.response;
    const authUser = {
      userId: auth.principal.userId,
      role: auth.principal.role || '',
      team: auth.principal.team || ''
    };
    if (!(await isAdminOrCmo(authUser))) {
      return NextResponse.json({ error: 'FORBIDDEN_POLICY_READ' }, { status: 403 });
    }

    const overrides = await listDeliveryPolicyOverrideRecords();

    return NextResponse.json({ overrides });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load policy overrides' }, { status: 500 });
  }
}
