import { NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { saveWikiAsset, getDb } from '../../../../services/db';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

/**
 * Utility to convert Docx to Markdown using temporary files for both input and output.
 * Disk-to-disk conversion is the most robust way to ensure Pandoc preserves 
 * complex Word formatting like headings, tables, and lists.
 */
async function runPandoc(buffer: Buffer): Promise<string> {
  const tempId = Math.random().toString(36).substring(7);
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `nexus_in_${tempId}.docx`);
  const outputPath = path.join(tempDir, `nexus_out_${tempId}.md`);
  
  // 1. Write incoming binary to disk
  fs.writeFileSync(inputPath, buffer);

  return new Promise((resolve, reject) => {
    try {
      // 2. Execute Pandoc
      // -t gfm+atx_headers: Uses GitHub Flavored Markdown and FORCES # style headings
      // --wrap=none: Prevents unwanted line breaks in long paragraphs
      // -o: Writes directly to file which is safer than stdout for some Pandoc versions
      const pandoc = spawn('pandoc', [
        inputPath, 
        '-t', 'gfm+atx_headers', 
        '--wrap=none',
        '-o', outputPath
      ]);
      
      let errorData = '';

      pandoc.stderr.on('data', (data) => {
        errorData += data.toString();
      });

      pandoc.on('close', (code) => {
        if (code === 0) {
          try {
            // 3. Read the result from the output file
            const result = fs.readFileSync(outputPath, 'utf8');
            console.log(`Pandoc success: Generated ${result.length} characters of Markdown.`);
            
            // Cleanup
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            
            resolve(result);
          } catch (readErr: any) {
            reject(new Error(`Failed to read Pandoc output: ${readErr.message}`));
          }
        } else {
          // Cleanup on failure
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          
          console.error(`Pandoc process exited with code ${code}. Error: ${errorData}`);
          reject(new Error(errorData || `Pandoc failed with exit code ${code}`));
        }
      });

      pandoc.on('error', (err) => {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        console.error(`Pandoc execution error: ${err.message}`);
        reject(new Error(`Pandoc binary not found or inaccessible: ${err.message}`));
      });

    } catch (err: any) {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      reject(err);
    }
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

    if (ext === 'docx' || ext === 'doc') {
      try {
        console.log(`Starting disk-based conversion for: ${file.name}`);
        const markdown = await runPandoc(buffer);
        previewKind = 'markdown';
        previewData = markdown; 
      } catch (err: any) {
        console.error("Critical: Pandoc Pipeline Failure:", err.message);
        previewStatus = 'failed';
        // The error is logged, and previewStatus 'failed' triggers the UI error message
      }
    } else if (ext === 'pdf') {
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
    console.error("Asset API Route Panic:", error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}
