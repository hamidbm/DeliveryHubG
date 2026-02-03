import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Enhanced Docx to HTML conversion using Mammoth.js.
 * Includes a custom style map to catch common Word styles that are often 
 * lost during default conversion, specifically headings and titles.
 */
async function convertDocxToPreview(buffer: Buffer): Promise<string> {
  try {
    // Explicitly mapping Word styles to HTML tags ensures that 
    // standard Enterprise Word templates render correctly in the web view.
    const options = {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        // Fallbacks for commonly used bolded paragraph "pseudo-headings"
        "p:bold => strong" 
      ]
    };

    const result = await mammoth.convertToHtml({ buffer }, options);
    
    if (result.messages.length > 0) {
      console.log("Mammoth conversion diagnostics:", result.messages);
    }
    
    return result.value; 
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

    if (ext === 'docx') {
      try {
        console.log(`Initiating High-Fidelity conversion for: ${file.name}`);
        const html = await convertDocxToPreview(buffer);
        previewKind = 'markdown'; // Marked handles the HTML inside the markdown context perfectly
        previewData = html; 
      } catch (err: any) {
        console.error("Critical: Docx conversion failure:", err.message);
        previewStatus = 'failed';
      }
    } 
    else if (ext === 'doc') {
      previewStatus = 'failed';
      console.warn("Legacy .doc format (binary) not supported for conversion.");
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
