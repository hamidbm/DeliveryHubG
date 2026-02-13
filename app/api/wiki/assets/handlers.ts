import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as XLSX from 'xlsx';
import { buildSheetData } from '../../../../lib/wikiSpreadsheet';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Robustly embeds images as Base64.
 * Pandoc often inserts the absolute path of the temporary media directory into the Markdown.
 * This function finds those paths and replaces them with Data URIs.
 */
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

      // Escape filename for regex
      const safeFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Pattern 1: Replace Markdown style ![](path/to/media/image.png)
      const mdPattern = new RegExp(`\\([^"\\)]*?\\/?media\\/${safeFileName}\\)`, 'g');
      processedMarkdown = processedMarkdown.replace(mdPattern, `(${dataUri})`);

      // Pattern 2: Replace HTML style src="path/to/media/image.png"
      const htmlPattern = new RegExp(`src="[^"]*?\\/?media\\/${safeFileName}"`, 'g');
      processedMarkdown = processedMarkdown.replace(htmlPattern, `src="${dataUri}"`);
    }
  }

  return processedMarkdown;
}

/**
 * Converts Docx to High-Quality Markdown using Pandoc with embedded media.
 */
async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  const tempId = Date.now();
  const workDir = path.join(os.tmpdir(), `nexus_conv_${tempId}`);
  const tempDocxPath = path.join(workDir, `input.docx`);
  const tempMdPath = path.join(workDir, `output.md`);

  try {
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(tempDocxPath, buffer);

    // Execute Pandoc with media extraction
    // -t gfm ensures GitHub Flavored Markdown (standard ATX headers)
    execSync(
      `pandoc -f docx -t gfm --wrap=none --extract-media="${workDir}" "${tempDocxPath}" -o "${tempMdPath}"`
    );

    let content = fs.readFileSync(tempMdPath, 'utf8');

    // Process images: find extracted files and embed them as Data URIs
    const mediaDir = path.join(workDir, 'media');
    content = embedImagesAsBase64(content, mediaDir);

    // Standardize headers and cleanup Word artifacts
    content = content
      // Remove Pandoc header IDs: # Header {#id}
      .replace(/\{#.*?\}/g, '')
      // Remove empty HTML anchors
      .replace(/<a id="[^"]+"><\/a>/g, '')
      // Ensure headers have a newline before them if they don't already
      .replace(/([^\n])\n#(?!#)/g, '$1\n\n#')
      .trim();

    return content;
  } catch (err: any) {
    console.error("Pandoc conversion pipeline failed:", err.message);
    throw new Error(`Advanced document conversion failed: ${err.message}`);
  } finally {
    // Recursive cleanup of the workspace
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn("Workspace cleanup warning:", e);
    }
  }
}

export async function GET() {
  const db = await getDb();
  const assets = await db.collection('wiki_assets').find({}).toArray();
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const spaceId = formData.get('spaceId') as string;
    const bundleId = formData.get('bundleId') as string;
    const applicationId = formData.get('applicationId') as string;
    const milestoneId = formData.get('milestoneId') as string;
    const documentTypeId = formData.get('documentTypeId') as string;
    const themeKey = formData.get('themeKey') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' | 'sheet' = 'none';
    let previewData = "";
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';
    let previewMeta: { sheetNames?: string[] } = {};

    if (ext === 'docx') {
      try {
        console.log(`[Pandoc] Converting document: ${file.name}`);
        const markdown = await convertDocxToMarkdown(buffer);
        previewKind = 'markdown';
        previewData = markdown;
      } catch (err: any) {
        console.error("[Pandoc] Conversion failed:", err.message);
        previewStatus = 'failed';
      }
    } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames || [];
        const sheets = sheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const { columns, rows } = buildSheetData(sheet);
          return { name, columns, rows };
        });
        previewKind = 'sheet';
        previewData = JSON.stringify({ sheets });
        previewMeta = { sheetNames };
      } catch (err: any) {
        console.error("[XLSX] Conversion failed:", err.message);
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
      title: title || file.name,
      spaceId,
      content: previewKind === 'markdown' ? previewData : "",
      author: payload.name as string,
      lastModifiedBy: payload.name as string,
      status: 'Published',
      version: 1,
      bundleId: bundleId || undefined,
      applicationId: applicationId || undefined,
      milestoneId: milestoneId || undefined,
      documentTypeId: documentTypeId || undefined,
      themeKey: themeKey || undefined,
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

    const result = await saveWikiAsset(assetData as any);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Asset Upload API Error:", error);
    return NextResponse.json({ error: 'System upload failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nexus_auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const { id, sheetData, content } = await request.json();
    if (!id || (!sheetData && typeof content !== 'string')) {
      return NextResponse.json({ error: 'Missing asset id or update payload' }, { status: 400 });
    }

    let result;
    if (sheetData) {
      result = await saveWikiAsset({
        _id: id,
        preview: {
          status: 'ready',
          kind: 'sheet',
          objectKey: JSON.stringify(sheetData),
          meta: { sheetNames: sheetData?.sheets?.map((sheet: any) => sheet.name) || [] },
        },
      } as any);
    } else {
      result = await saveWikiAsset({
        _id: id,
        content,
        lastModifiedBy: payload?.name as string,
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
