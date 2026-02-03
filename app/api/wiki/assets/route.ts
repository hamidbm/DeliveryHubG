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
 * Scans Markdown for local image paths (media/...) and replaces them
 * with embedded Base64 Data URIs from the extracted media folder.
 */
function embedImagesAsBase64(markdown: string, mediaDir: string): string {
  let processedMarkdown = markdown;
  
  if (!fs.existsSync(mediaDir)) return markdown;

  // Pandoc usually extracts to media/image1.png, etc.
  const mediaFiles = fs.readdirSync(mediaDir);
  
  for (const fileName of mediaFiles) {
    const filePath = path.join(mediaDir, fileName);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      const ext = path.extname(fileName).toLowerCase().replace('.', '');
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const base64 = fs.readFileSync(filePath).toString('base64');
      const dataUri = `data:${mimeType};base64,${base64}`;
      
      // Escape special characters in filename for regex
      const safeName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Replace Markdown style: ![](media/image1.png)
      const mdRegex = new RegExp(`!\\[(.*?)\\]\\(media\\/${safeName}\\)`, 'g');
      processedMarkdown = processedMarkdown.replace(mdRegex, `![$1](${dataUri})`);
      
      // Replace HTML style: <img src="media/image1.png" ... />
      const htmlRegex = new RegExp(`src="media\\/${safeName}"`, 'g');
      processedMarkdown = processedMarkdown.replace(htmlRegex, `src="${dataUri}"`);
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
    // 1. Create workspace
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
    
    // 2. Write input
    fs.writeFileSync(tempDocxPath, buffer);

    // 3. Run Pandoc
    // --extract-media tells pandoc to dump images into the specified folder
    // -t gfm ensures GitHub Flavored Markdown (standard headers)
    // --wrap=none prevents unwanted line breaks
    execSync(`pandoc -f docx -t gfm --wrap=none --extract-media="${workDir}" "${tempDocxPath}" -o "${tempMdPath}"`);

    // 4. Read raw markdown
    let content = fs.readFileSync(tempMdPath, 'utf8');

    // 5. Post-process to embed images
    const mediaDir = path.join(workDir, 'media');
    content = embedImagesAsBase64(content, mediaDir);

    // 6. Cleanup noisy Pandoc artifacts
    content = content
      .replace(/\{#.*?\}/g, '') // Remove header IDs
      .replace(/<a id="[^"]+"><\/a>/g, '') // Remove empty anchors
      .replace(/\\([.\-_!*+])/g, '$1') // Unescape common safe chars
      .trim();

    return content;
  } catch (err: any) {
    console.error("Pandoc pipeline failed:", err.message);
    throw new Error(`Advanced conversion failed: ${err.message}`);
  } finally {
    // 7. Recursive cleanup of workspace
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn("Temporary directory cleanup warning:", e);
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

    let previewKind: 'pdf' | 'html' | 'images' | 'markdown' | 'none' = 'none';
    let previewData = ""; 
    let previewStatus: 'ready' | 'pending' | 'failed' = 'ready';

    if (ext === 'docx') {
      try {
        console.log(`Processing deep media extraction for: ${file.name}`);
        const markdown = await convertDocxToMarkdown(buffer);
        previewKind = 'markdown';
        previewData = markdown; 
      } catch (err: any) {
        console.error("Critical conversion failure:", err.message);
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
    console.error("Asset Upload API failure:", error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}
