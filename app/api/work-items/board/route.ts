
import { NextResponse } from 'next/server';
import { fetchWorkItemsBoard } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    milestoneId: searchParams.get('milestoneId'),
    epicId: searchParams.get('epicId'),
    q: searchParams.get('q')
  };
  
  try {
    const board = await fetchWorkItemsBoard(filters);
    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 });
  }
}
