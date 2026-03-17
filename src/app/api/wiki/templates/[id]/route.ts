import { NextRequest, NextResponse } from 'next/server';
import { deactivateWikiTemplateRecord, saveWikiTemplateRecord } from '../../../../../server/db/repositories/wikiRepo';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateData = await request.json();
    const result = await saveWikiTemplateRecord({ ...templateData, _id: id });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deactivateWikiTemplateRecord(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete template' }, { status: 500 });
  }
}
