import { NextRequest, NextResponse } from 'next/server';
import { saveWikiTemplate, deactivateWikiTemplate } from '../../../../../services/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const templateData = await request.json();
    const result = await saveWikiTemplate({ ...templateData, _id: id });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deactivateWikiTemplate(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete template' }, { status: 500 });
  }
}
