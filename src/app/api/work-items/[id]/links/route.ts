import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { addWorkItemLink, removeWorkItemLink, fetchWorkItemById, fetchWorkItemByKeyOrId, detectBlocksCycle } from '../../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

const resolveLinkDirection = (sourceId: string, targetId: string, type: string) => {
  const upper = String(type || '').toUpperCase();
  if (upper === 'BLOCKED_BY') {
    return { linkSourceId: targetId, linkTargetId: sourceId, linkType: 'BLOCKS' };
  }
  if (upper === 'DUPLICATED_BY') {
    return { linkSourceId: targetId, linkTargetId: sourceId, linkType: 'DUPLICATES' };
  }
  return { linkSourceId: sourceId, linkTargetId: targetId, linkType: upper };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const body = await request.json();
    const type = String(body?.type || '').toUpperCase();
    const targetKey = body?.targetKey ? String(body.targetKey) : '';
    const targetIdInput = body?.targetId ? String(body.targetId) : '';

    if (!type) return NextResponse.json({ error: 'Missing link type' }, { status: 400 });

    const target = targetIdInput
      ? await fetchWorkItemById(targetIdInput)
      : (targetKey ? await fetchWorkItemByKeyOrId(targetKey) : null);

    if (!target) return NextResponse.json({ error: 'Target not found' }, { status: 404 });

    const resolvedTargetId = String(target._id || target.id || targetIdInput || targetKey);
    const { linkSourceId, linkTargetId, linkType } = resolveLinkDirection(String(id), resolvedTargetId, type);

    if (!['BLOCKS', 'RELATES_TO', 'DUPLICATES'].includes(linkType)) {
      return NextResponse.json({ error: 'Invalid link type' }, { status: 400 });
    }

    if (linkType === 'BLOCKS') {
      const hasCycle = await detectBlocksCycle(linkSourceId, linkTargetId);
      if (hasCycle) {
        return NextResponse.json({ error: 'BLOCKS cycle detected' }, { status: 409 });
      }
    }

    const result = await addWorkItemLink(linkSourceId, linkTargetId, linkType, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to add link' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const body = await request.json();
    const type = String(body?.type || '').toUpperCase();
    const targetKey = body?.targetKey ? String(body.targetKey) : '';
    const targetIdInput = body?.targetId ? String(body.targetId) : '';

    if (!type) return NextResponse.json({ error: 'Missing link type' }, { status: 400 });

    const target = targetIdInput
      ? await fetchWorkItemById(targetIdInput)
      : (targetKey ? await fetchWorkItemByKeyOrId(targetKey) : null);

    if (!target && !targetIdInput) return NextResponse.json({ error: 'Target not found' }, { status: 404 });

    const resolvedTargetId = String(target?._id || target?.id || targetIdInput || targetKey);
    const { linkSourceId, linkTargetId, linkType } = resolveLinkDirection(String(id), resolvedTargetId, type);

    if (!['BLOCKS', 'RELATES_TO', 'DUPLICATES'].includes(linkType)) {
      return NextResponse.json({ error: 'Invalid link type' }, { status: 400 });
    }

    const result = await removeWorkItemLink(linkSourceId, linkTargetId, linkType, payload);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove link' }, { status: 500 });
  }
}
