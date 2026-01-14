
import { NextResponse } from 'next/server';
import { fetchWorkItemTree } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    bundleId: searchParams.get('bundleId'),
    applicationId: searchParams.get('applicationId'),
    milestoneId: searchParams.get('milestoneId'),
    epicId: searchParams.get('epicId'),
    parentId: searchParams.get('parentId'),
    q: searchParams.get('q'),
    treeMode: searchParams.get('treeMode') || 'hierarchy'
  };
  const tree = await fetchWorkItemTree(filters);
  return NextResponse.json(tree);
}
