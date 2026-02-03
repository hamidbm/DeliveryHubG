import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Strips Mammoth's aggressive escaping and Word's noisy HTML anchors
 * to produce human-readable "Standard" Markdown.
 */
function cleanMammothMarkdown(raw: string): string {
  return raw
    // 1. Unescape periods, dashes, and underscores that Mammoth over-escapes
    // Example: "headings\." becomes "headings."
    .replace(/\\([.\-_!*+])(?!\d)/g, '$1') 
    
    // 2. Remove empty HTML anchors often placed inside headings by Word
    // Example: "# <a id="_top"></a>Title" becomes "# Title"
    .replace(/<a id="[^"]+"><\/a>/g, '')
    
    // 3. Normalize multiple spaces that sometimes occur around stripped tags
    .replace(/  +/g, ' ')
    
    // 4. Ensure there's a space after headings (sometimes Mammoth concatenates them)
    .replace(/^(#+)([^#\s])/gm, '$1 $2')
    
    .trim();
}

/**
 * Converts Docx to High-Quality, Clean Markdown.
 */
async function convertDocxToMarkdown(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.convertToMarkdown({ buffer });
    
    if (result.messages.length > 0) {
      console.log("Mammoth conversion notes:", result.messages);
    }
    
    // Process the raw output to get "Clean Markdown"
    return cleanMammothMarkdown(result.value);
  } catch (err: any) {
    console.error("Mammoth markdown conversion failed:", err.message);
    throw new Error(`Word parsing failed: ${err.message}`);
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
        console.log(`Processing Clean Markdown conversion for: ${file.name}`);
        const markdown = await convertDocxToMarkdown(buffer);
        previewKind = 'markdown';
        previewData = markdown; 
      } catch (err: any) {
        console.error("Critical: Docx conversion failure:", err.message);
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
