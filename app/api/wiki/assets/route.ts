import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Strips remaining Pandoc noise and Word bookmarks.
 * Ensures headings are clean and text isn't over-escaped.
 */
function cleanPandocMarkdown(text: string): string {
  return text
    // 1. Remove Pandoc's explicit header IDs if generated: # Header {#id}
    .replace(/\{#.*?\}/g, '')
    // 2. Remove empty HTML anchors injected by Word as bookmarks
    .replace(/<a id="[^"]+"><\/a>/g, '')
    // 3. Normalize escaping for common characters Pandoc might still escape occasionally
    .replace(/\\([.\-_!*+])/g, '$1')
    // 4. Cleanup multiple empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts Docx to High-Quality Markdown using Pandoc.
 */
async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  const tempId = Date.now();
  const tempDocxPath = path.join(os.tmpdir(), `nexus_input_${tempId}.docx`);
  const tempMdPath = path.join(os.tmpdir(), `nexus_output_${tempId}.md`);

  try {
    // Write the buffer to a temporary file
    fs.writeFileSync(tempDocxPath, buffer);

    // Execute Pandoc command: docx -> gfm (GitHub Flavored Markdown)
    // --wrap=none prevents unwanted line breaking in mid-sentence
    execSync(`pandoc -f docx -t gfm --wrap=none "${tempDocxPath}" -o "${tempMdPath}"`);

    // Read the converted content
    const rawMarkdown = fs.readFileSync(tempMdPath, 'utf8');

    // Clean up
    return cleanPandocMarkdown(rawMarkdown);
  } catch (err: any) {
    console.error("Pandoc conversion process failed:", err.message);
    throw new Error(`External conversion tool (Pandoc) failed: ${err.message}`);
  } finally {
    // Cleanup temporary files
    try { if (fs.existsSync(tempDocxPath)) fs.unlinkSync(tempDocxPath); } catch (e) {}
    try { if (fs.existsSync(tempMdPath)) fs.unlinkSync(tempMdPath); } catch (e) {}
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

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' = 'none';
    let previewData = ""; 
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';

    if (ext === 'docx') {
      try {
        console.log(`Invoking Pandoc Engine for: ${file.name}`);
        const markdown = await convertDocxToMarkdown(buffer);
        previewKind = 'markdown';
        previewData = markdown; 
      } catch (err: any) {
        console.error("Critical: Pandoc execution failure:", err.message);
        previewStatus = 'failed';
      }
    } 
    else if (ext === 'pdf') {
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
        sizeBytes: file.size
      },
      storage: {
        provider: 'base64',
        objectKey: base64Data 
      },
      preview: {
        status: previewStatus,
        kind: previewKind,
        objectKey: previewData 
      }
    };

    const result = await saveWikiAsset(assetData as any);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Asset Upload API Route Panic:", error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}
