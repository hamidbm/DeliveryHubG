import { NextResponse } from 'next/server';
import { saveWikiTemplate, deactivateWikiTemplate } from '../../../../../services/db';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const templateData = await request.json();
    const result = await saveWikiTemplate({ ...templateData, _id: params.id });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await deactivateWikiTemplate(params.id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete template' }, { status: 500 });
  }
}
