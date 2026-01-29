
import { NextResponse } from 'next/server';
import { saveWikiTheme, deleteWikiTheme } from '../../../../../services/db';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const themeData = await request.json();
    const result = await saveWikiTheme({ ...themeData, _id: params.id });
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update theme' }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const result = await deleteWikiTheme(params.id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete theme' }, { status: 500 });
  }
}
