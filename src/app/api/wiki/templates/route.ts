import { NextResponse } from 'next/server';
import { fetchWikiTemplates, saveWikiTemplate } from '../../../../services/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentTypeId = searchParams.get('documentTypeId') || undefined;
  const activeOnly = searchParams.get('active') === 'true';
  const templates = await fetchWikiTemplates({ documentTypeId, activeOnly });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const templateData = await request.json();
    if (!templateData?.name || !templateData?.documentTypeId || !templateData?.content) {
      return NextResponse.json({ error: 'Name, document type, and content are required.' }, { status: 400 });
    }
    const result = await saveWikiTemplate(templateData);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save template' }, { status: 500 });
  }
}
