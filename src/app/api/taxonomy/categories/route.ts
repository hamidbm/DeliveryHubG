
import { NextResponse } from 'next/server';
import { listTaxonomyCategories, saveTaxonomyCategoryRecord } from '../../../../server/db/repositories/taxonomyRepo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const categories = await listTaxonomyCategories(activeOnly);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await saveTaxonomyCategoryRecord(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save category' }, { status: 500 });
  }
}
