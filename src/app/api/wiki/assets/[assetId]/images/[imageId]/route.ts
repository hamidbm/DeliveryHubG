import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../../../shared/auth/guards';
import { getWikiAssetById } from '../../../../../../../server/db/repositories/wikiRepo';

export async function GET(request: Request, { params }: { params: Promise<{ assetId: string; imageId: string }> }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { assetId, imageId } = await params;
  const asset = await getWikiAssetById(assetId);
  const image = asset?.images?.find((item: any) => String(item.id) === String(imageId));
  if (!image?.data || !image.contentType) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  return new NextResponse(Buffer.from(image.data, 'base64'), {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'private, max-age=86400'
    }
  });
}
