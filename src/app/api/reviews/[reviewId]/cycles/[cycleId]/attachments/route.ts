import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { emitEvent } from '../../../../../../../shared/events/emitEvent';
import { addReviewCycleAttachments, ensureInReview } from '../../../../../../../services/reviewLifecycle';
import { buildSheetData } from '../../../../../../../lib/wikiSpreadsheet';
import { requireStandardUser } from '../../../../../../../shared/auth/guards';
import { getReviewById } from '../../../../../../../server/db/repositories/reviewsRepo';
import { saveWikiAssetRecord } from '../../../../../../../server/db/repositories/wikiRepo';
import { ObjectId } from 'mongodb';
import { convertDocxToAssetPreview } from '../../../../../../../server/wiki/docxAssetPreview';

const FEEDBACK_DOCUMENT_TYPE = process.env.FEEDBACK_DOCUMENT_TYPE || 'Feedback Document';

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;
    const user = {
      userId: auth.principal.userId,
      displayName: auth.principal.fullName || 'Unknown',
      email: auth.principal.email
    };
    const { reviewId, cycleId } = await params;
    const review = (await getReviewById(reviewId)) as any;
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    const reviewerIds = Array.isArray(cycle.reviewerUserIds)
      ? cycle.reviewerUserIds.map((id: unknown) => String(id))
      : Array.isArray(cycle.reviewers)
        ? cycle.reviewers.map((reviewer: any) => String(reviewer.userId || ''))
        : [];
    const isReviewer = reviewerIds.includes(user.userId);
    if (!isReviewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (cycle.status === 'closed') return NextResponse.json({ error: 'Cycle is closed.' }, { status: 409 });

    await ensureInReview({ reviewId, cycleId, actor: user });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    const resourceType = String(formData.get('resourceType') || review.resource.type || '');
    const resourceId = String(formData.get('resourceId') || review.resource.id || '');
    const resourceTitle = String(formData.get('resourceTitle') || review.resource.title || '');
    const bundleId = String(formData.get('bundleId') || '');
    const applicationId = String(formData.get('applicationId') || '');
    const milestoneId = String(formData.get('milestoneId') || '');
    const documentTypeId = String(formData.get('documentTypeId') || '');
    const reviewedDocumentType = String(formData.get('reviewedDocumentType') || '');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer) as unknown as Buffer;
    const base64Data = buffer.toString('base64');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const assetId = new ObjectId().toHexString();

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' | 'sheet' = 'none';
    let previewData = '';
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';
    let previewMeta: { sheetNames?: string[]; imageCount?: number } = {};
    let extractedImages: Array<{ id: string; filename: string; contentType: string; data: string }> = [];

    if (ext === 'docx') {
      try {
        const preview = await convertDocxToAssetPreview(buffer, assetId);
        previewKind = 'markdown';
        previewData = preview.markdown;
        extractedImages = preview.images;
        previewMeta = { ...previewMeta, imageCount: preview.images.length };
      } catch {
        previewStatus = 'failed';
      }
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      try {
        const workbook = new ExcelJS.Workbook();
        if (ext === 'csv') {
          await workbook.csv.read(Readable.from(buffer));
        } else {
          await workbook.xlsx.load(buffer as any);
        }
        const sheetNames = workbook.worksheets.map((ws) => ws.name);
        const sheets = workbook.worksheets.map((worksheet) => {
          const { columns, rows } = buildSheetData(worksheet);
          return { name: worksheet.name, columns, rows };
        });
        previewKind = 'sheet';
        previewData = JSON.stringify({ sheets });
        previewMeta = { sheetNames };
      } catch {
        previewStatus = 'failed';
      }
    } else if (ext === 'pdf') {
      previewKind = 'pdf';
      previewData = base64Data;
    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      previewKind = 'images';
      previewData = base64Data;
    } else if (ext === 'md' || ext === 'markdown') {
      previewKind = 'markdown';
      previewData = buffer.toString('utf-8');
    }

    const assetData: any = {
      _id: assetId,
      title: file.name,
      spaceId: formData.get('spaceId') || '',
      content: previewKind === 'markdown' ? previewData : '',
      author: user.displayName,
      lastModifiedBy: user.displayName,
      status: 'Published',
      version: 1,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      documentTypeId: undefined,
      documentType: FEEDBACK_DOCUMENT_TYPE,
      artifactKind: 'feedback',
      images: extractedImages,
      reviewContext: {
        reviewId,
        cycleId,
        reviewedResourceType: resourceType,
        reviewedResourceId: resourceId,
        reviewedDocumentType: reviewedDocumentType || undefined
      },
      file: {
        originalName: file.name,
        ext,
        mimeType: file.type,
        sizeBytes: file.size
      },
      storage: {
        provider: 'base64',
        objectKey: base64Data
      },
      preview: {
        status: previewStatus,
        kind: previewKind,
        objectKey: previewData,
        meta: previewMeta
      }
    };

    const result = await saveWikiAssetRecord(assetData);
    const insertedId = (result as any)?.insertedId;
    if (!insertedId) {
      return NextResponse.json({ error: 'Failed to save attachment' }, { status: 500 });
    }

    const updated = await addReviewCycleAttachments({
      review,
      cycleId,
      attachments: [
        {
          assetId: String(insertedId),
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size
        }
      ]
    });

    await emitEvent({
      ts: new Date().toISOString(),
      type: 'reviews.cycle.attachmentuploaded',
      actor: user,
      resource: { type: review.resource.type, id: review.resource.id, title: review.resource.title },
      payload: { reviewId, cycleId, assetId: String(insertedId) },
      correlationId: cycleId
    });

    return NextResponse.json({ review: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to upload attachment' }, { status: 500 });
  }
}
