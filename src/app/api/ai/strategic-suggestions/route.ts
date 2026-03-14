import { NextResponse } from 'next/server';
import { getAuthUserFromCookies } from '../../../../services/visibility';
import { getStrategicSuggestions } from '../../../../services/ai/strategicAdvisor';

export async function GET() {
  const authUser = await getAuthUserFromCookies();
  if (!authUser?.userId) {
    return NextResponse.json({ status: 'error', error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const suggestions = await getStrategicSuggestions();
    return NextResponse.json({ status: 'success', suggestions });
  } catch {
    return NextResponse.json({ status: 'error', error: 'Unable to load strategic suggestions.' }, { status: 500 });
  }
}
