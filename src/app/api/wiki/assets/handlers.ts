import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAssetRecord } from '../../../../server/db/repositories/wikiRepo';
import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { buildSheetData } from '../../../../lib/wikiSpreadsheet';
import { requireStandardUser } from '../../../../shared/auth/guards';
import { listWikiAssets } from '../../../../server/db/repositories/wikiRepo';
import { ObjectId } from 'mongodb';
import { convertDocxToAssetPreview } from '../../../../server/wiki/docxAssetPreview';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeFeedback = searchParams.get('includeFeedback') === 'true';
  const assets = await listWikiAssets({ includeFeedback });
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const spaceId = formData.get('spaceId') as string;
    const bundleId = formData.get('bundleId') as string;
    const applicationId = formData.get('applicationId') as string;
    const milestoneId = formData.get('milestoneId') as string;
    const documentTypeId = formData.get('documentTypeId') as string;
    const documentType = formData.get('documentType') as string;
    const themeKey = formData.get('themeKey') as string;
    const artifactKind = formData.get('artifactKind') as string;
    const reviewContextRaw = formData.get('reviewContext') as string;
    const reviewContext = reviewContextRaw ? JSON.parse(reviewContextRaw) : undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const assetId = new ObjectId().toHexString();

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' | 'sheet' = 'none';
    let previewData = "";
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';
    let previewMeta: { sheetNames?: string[]; imageCount?: number } = {};
    let extractedImages: Array<{ id: string; filename: string; contentType: string; data: string }> = [];

    if (ext === 'docx') {
      try {
        console.log(`[Pandoc] Converting document: ${file.name}`);
        const preview = await convertDocxToAssetPreview(buffer, assetId);
        previewKind = 'markdown';
        previewData = preview.markdown;
        extractedImages = preview.images;
        previewMeta = { ...previewMeta, imageCount: preview.images.length };
      } catch (err: any) {
        console.error("[Pandoc] Conversion failed:", err.message);
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
        
        const sheetNames = workbook.worksheets.map(ws => ws.name);
        const sheets = workbook.worksheets.map((worksheet) => {
          const { columns, rows } = buildSheetData(worksheet);
          return { name: worksheet.name, columns, rows };
        });
        previewKind = 'sheet';
        previewData = JSON.stringify({ sheets });
        previewMeta = { sheetNames };
      } catch (err: any) {
        console.error("[ExcelJS] Conversion failed:", err.message);
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

    const assetData = {
      _id: assetId,
      title: title || file.name,
      spaceId,
      content: previewKind === 'markdown' ? previewData : "",
      author: auth.principal.fullName || auth.principal.email || 'Unknown',
      lastModifiedBy: auth.principal.fullName || auth.principal.email || 'Unknown',
      status: 'Published',
      version: 1,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      documentTypeId: documentTypeId || undefined,
      documentType: documentType || undefined,
      artifactKind: artifactKind || 'primary',
      reviewContext: reviewContext || undefined,
      themeKey: themeKey || undefined,
      images: extractedImages,
      file: {
        originalName: file.name,
        ext,
        mimeType: file.type,
        sizeBytes: file.size,
      },
      storage: {
        provider: 'base64',
        objectKey: base64Data,
      },
      preview: {
        status: previewStatus,
        kind: previewKind,
        objectKey: previewData,
        meta: previewMeta,
      },
    };

    const result = await saveWikiAssetRecord(assetData as any);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Asset Upload API Error:", error);
    return NextResponse.json({ error: 'System upload failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireStandardUser(request);
    if (!auth.ok) return auth.response;

    const { id, sheetData, content } = await request.json();
    if (!id || (!sheetData && typeof content !== 'string')) {
      return NextResponse.json({ error: 'Missing asset id or update payload' }, { status: 400 });
    }

    let result;
    if (sheetData) {
      result = await saveWikiAssetRecord({
        _id: id,
        preview: {
          status: 'ready',
          kind: 'sheet',
          objectKey: JSON.stringify(sheetData),
          meta: { sheetNames: sheetData?.sheets?.map((sheet: any) => sheet.name) || [] },
        },
      } as any);
    } else {
      result = await saveWikiAssetRecord({
        _id: id,
        content,
        lastModifiedBy: auth.principal.fullName || auth.principal.email || 'Unknown',
        preview: {
          status: 'ready',
          kind: 'markdown',
          objectKey: content,
        },
      } as any);
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Asset Update API Error:", error);
    return NextResponse.json({ error: 'System update failed' }, { status: 500 });
  }
}
