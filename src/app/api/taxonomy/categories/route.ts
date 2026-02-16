
import { NextResponse } from 'next/server';
import { fetchTaxonomyCategories, saveTaxonomyCategory } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const categories = await fetchTaxonomyCategories(activeOnly);
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await saveTaxonomyCategory(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save category' }, { status: 500 });
  }
}
