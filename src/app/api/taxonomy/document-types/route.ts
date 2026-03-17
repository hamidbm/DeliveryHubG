
import { NextResponse } from 'next/server';
import { listTaxonomyDocumentTypes, saveTaxonomyDocumentTypeRecord } from '../../../../server/db/repositories/taxonomyRepo';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get('active') === 'true';
  const categoryId = searchParams.get('categoryId') || undefined;
  const types = await listTaxonomyDocumentTypes(activeOnly, categoryId);
  return NextResponse.json(types);
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await saveTaxonomyDocumentTypeRecord(data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save document type' }, { status: 500 });
  }
}
