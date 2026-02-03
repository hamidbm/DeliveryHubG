
import { NextResponse } from 'next/server';
import { markNotificationRead } from '../../../../../services/db';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await markNotificationRead(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
