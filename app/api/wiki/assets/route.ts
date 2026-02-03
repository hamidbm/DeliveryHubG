import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { spawn } from 'child_process';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Utility to convert Docx buffer to Markdown using system Pandoc binary.
 * Expects pandoc to be in the system PATH.
 */
async function runPandoc(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // -f docx: input format is Word
    // -t gfm: output format is GitHub Flavored Markdown
    // --wrap=none: prevent unwanted line breaks in paragraphs
    const pandoc = spawn('pandoc', ['-f', 'docx', '-t', 'gfm', '--wrap=none']);
    
    let output = '';
    let error = '';

    pandoc.stdout.on('data', (data) => {
      output += data.toString();
    });

    pandoc.stderr.on('data', (data) => {
      error += data.toString();
    });

    pandoc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(error || `Pandoc process exited with code ${code}`));
      }
    });

    pandoc.on('error', (err) => {
      reject(new Error(`Failed to start Pandoc process: ${err.message}`));
    });

    // Write buffer to stdin
    pandoc.stdin.write(buffer);
    pandoc.stdin.end();
  });
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

    // Pandoc logic for Word documents
    if (ext === 'docx' || ext === 'doc') {
      try {
        const markdown = await runPandoc(buffer);
        previewKind = 'markdown';
        previewData = markdown; 
      } catch (err) {
        console.error("Pandoc conversion failed:", err);
        previewStatus = 'failed';
      }
    } else if (ext === 'pdf') {
      previewKind = 'pdf';
    } else if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      previewKind = 'images';
    } else if (ext === 'md' || ext === 'markdown') {
      previewKind = 'markdown';
      previewData = buffer.toString('utf-8');
    }

    // Create the asset record
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
        objectKey: base64Data // The binary original
      },
      preview: {
        status: previewStatus,
        kind: previewKind,
        objectKey: previewData // The converted markdown text (for docx)
      }
    };

    const result = await saveWikiAsset(assetData as any);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Asset upload fail:", error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}