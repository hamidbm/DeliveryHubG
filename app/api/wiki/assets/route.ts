import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Robust Docx to HTML conversion using Mammoth.js.
 * This is a pure JS solution that works in all Node environments without 
 * needing external binaries like Pandoc. It preserves headings, tables, and lists.
 */
async function convertDocxToPreview(buffer: Buffer): Promise<string> {
  try {
    // Mammoth maps Word styles (Heading 1, etc.) directly to HTML tags.
    // This is much safer for web rendering than generic markdown conversion.
    const result = await mammoth.convertToHtml({ buffer });
    
    if (result.messages.length > 0) {
      console.log("Mammoth conversion notes:", result.messages);
    }
    
    return result.value; // This is the clean HTML string
  } catch (err: any) {
    console.error("Mammoth core conversion failed:", err.message);
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
    let previewData = base64Data;
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';

    // Handle .docx via Mammoth (Modern Word)
    if (ext === 'docx') {
      try {
        console.log(`Initiating Mammoth conversion for: ${file.name}`);
        const html = await convertDocxToPreview(buffer);
        previewKind = 'markdown'; // Store as markdown kind because marked handles the HTML perfectly
        previewData = html; 
      } catch (err: any) {
        console.error("Critical: Docx conversion failure:", err.message);
        previewStatus = 'failed';
      }
    } 
    // .doc (Legacy) usually requires system binaries, so we treat it as source-only if Mammoth fails
    else if (ext === 'doc') {
      previewStatus = 'failed';
      console.warn("Legacy .doc format detected. Conversion skipped for security/stability.");
    }
    else if (ext === 'pdf') {
      previewKind = 'pdf';
    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      previewKind = 'images';
    } else if (ext === 'md' || ext === 'markdown') {
      previewKind = 'markdown';
      previewData = buffer.toString('utf-8');
    }

    const assetData = {
      title: title || file.name,
      spaceId,
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
