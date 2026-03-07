import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { createDeliveryPlan } from '../../../../../services/deliveryPlanGenerator';

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const previewId = String(body?.previewId || '');
    if (!previewId) return NextResponse.json({ error: 'previewId is required' }, { status: 400 });
    const result = await createDeliveryPlan(previewId, { userId: String(user.userId), email: user.email });
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create plan' }, { status: 500 });
  }
}
