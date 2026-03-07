import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../../services/visibility';
import { previewDeliveryPlan } from '../../../../../services/deliveryPlanGenerator';

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromCookies();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const body = await request.json();
    const preview = await previewDeliveryPlan(body, { userId: String(user.userId), email: user.email });
    return NextResponse.json({ preview });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to preview plan' }, { status: 400 });
  }
}
