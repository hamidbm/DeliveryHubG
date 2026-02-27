
import { NextRequest, NextResponse } from 'next/server';
import { saveWikiTheme, deleteWikiTheme } from '../../../../../services/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const themeData = await request.json();
    const result = await saveWikiTheme({ ...themeData, _id: id });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update theme' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await deleteWikiTheme(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete theme' }, { status: 500 });
  }
}
