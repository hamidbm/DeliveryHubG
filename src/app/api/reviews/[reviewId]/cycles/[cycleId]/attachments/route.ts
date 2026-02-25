import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import ExcelJS from 'exceljs';
import { addReviewCycleAttachments, emitEvent, ensureInReview, fetchReviewById, saveWikiAsset } from '../../../../../../../services/db';
import { buildSheetData } from '../../../../../../../lib/wikiSpreadsheet';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');
const FEEDBACK_DOCUMENT_TYPE = process.env.FEEDBACK_DOCUMENT_TYPE || 'Feedback Document';

const getUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: String(payload.id || payload.userId || ''),
    displayName: String(payload.name || 'Unknown'),
    email: payload.email ? String(payload.email) : undefined
  };
};

function embedImagesAsBase64(markdown: string, mediaDir: string): string {
  let processedMarkdown = markdown;
  if (!fs.existsSync(mediaDir)) return markdown;
  const mediaFiles = fs.readdirSync(mediaDir);
  for (const fileName of mediaFiles) {
    const filePath = path.join(mediaDir, fileName);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      const ext = path.extname(fileName).toLowerCase().replace('.', '');
      const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
      const base64 = fs.readFileSync(filePath).toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;
      const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const mdPattern = new RegExp(`\\([^"\\)]*?\\/?media\\/${safeFileName}\\)`, 'g');
      processedMarkdown = processedMarkdown.replace(mdPattern, `(${dataUri})`);
      const htmlPattern = new RegExp(`src="[^"]*?\\/?media\\/${safeFileName}"`, 'g');
      processedMarkdown = processedMarkdown.replace(htmlPattern, `src="${dataUri}"`);
    }
  }
  return processedMarkdown;
}

async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  const tempId = Date.now();
  const workDir = path.join(os.tmpdir(), `nexus_conv_${tempId}`);
  const tempDocxPath = path.join(workDir, `input.docx`);
  const tempMdPath = path.join(workDir, `output.md`);

  try {
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(tempDocxPath, buffer);
    execSync(
      `pandoc -f docx -t gfm --wrap=none --extract-media="${workDir}" "${tempDocxPath}" -o "${tempMdPath}"`
    );
    let content = fs.readFileSync(tempMdPath, 'utf8');
    const mediaDir = path.join(workDir, 'media');
    content = embedImagesAsBase64(content, mediaDir);
    content = content
      .replace(/\{#.*?\}/g, '')
      .replace(/<a id="[^"]+"><\/a>/g, '')
      .replace(/([^\n])\n#(?!#)/g, '$1\n\n#')
      .trim();
    return content;
  } finally {
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string; cycleId: string }> }) {
  try {
    const user = await getUser();
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { reviewId, cycleId } = await params;
    const review = await fetchReviewById(reviewId);
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    const cycle = (review.cycles || []).find((c) => c.cycleId === cycleId);
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    const isReviewer = (cycle.reviewerUserIds || []).includes(user.userId);
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
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' | 'sheet' = 'none';
    let previewData = '';
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';
    let previewMeta: { sheetNames?: string[] } = {};

    if (ext === 'docx') {
      try {
        const markdown = await convertDocxToMarkdown(buffer);
        previewKind = 'markdown';
        previewData = markdown;
      } catch {
        previewStatus = 'failed';
      }
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      try {
        const workbook = new ExcelJS.Workbook();
        if (ext === 'csv') {
          await workbook.csv.read(buffer);
        } else {
          await workbook.xlsx.load(buffer);
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

    const result = await saveWikiAsset(assetData);
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
