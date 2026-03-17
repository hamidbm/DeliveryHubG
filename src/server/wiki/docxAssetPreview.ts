import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ObjectId } from 'mongodb';

type ExtractedWikiImage = {
  id: string;
  filename: string;
  contentType: string;
  data: string;
  originalPath: string;
};

type DocxAssetPreview = {
  markdown: string;
  images: ExtractedWikiImage[];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const contentTypeFromFilename = (filename: string) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
};

const listFilesRecursive = (dir: string): string[] => {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
};

const rewriteMarkdownImageLinks = (markdown: string, assetId: string, images: ExtractedWikiImage[]) => {
  let next = markdown;

  for (const image of images) {
    const stableUrl = `/api/wiki/assets/${assetId}/images/${image.id}`;
    const normalizedPath = image.originalPath.split(path.sep).join('/');
    const candidates = new Set<string>([
      normalizedPath,
      `./${normalizedPath}`,
      path.basename(normalizedPath),
      `media/${path.basename(normalizedPath)}`
    ]);

    for (const candidate of candidates) {
      const escaped = escapeRegExp(candidate);
      const markdownPattern = new RegExp(`\\((?:[^)"']*?)${escaped}\\)`, 'g');
      next = next.replace(markdownPattern, `(${stableUrl})`);

      const htmlPattern = new RegExp(`src=["'][^"']*${escaped}["']`, 'g');
      next = next.replace(htmlPattern, `src="${stableUrl}"`);
    }
  }

  return next;
};

export async function convertDocxToAssetPreview(buffer: Buffer, assetId: string = new ObjectId().toHexString()): Promise<DocxAssetPreview> {
  const tempId = Date.now();
  const workDir = path.join(os.tmpdir(), `deliveryhub_docx_${tempId}`);
  const tempDocxPath = path.join(workDir, 'input.docx');
  const tempMdPath = path.join(workDir, 'output.md');

  try {
    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(tempDocxPath, buffer);
    execSync(
      `pandoc -f docx -t gfm --wrap=none --extract-media="${workDir}" "${tempDocxPath}" -o "${tempMdPath}"`
    );

    const mediaDir = path.join(workDir, 'media');
    const imageFiles = listFilesRecursive(mediaDir);
    const images: ExtractedWikiImage[] = imageFiles.map((filePath) => ({
      id: new ObjectId().toHexString(),
      filename: path.basename(filePath),
      contentType: contentTypeFromFilename(filePath),
      data: fs.readFileSync(filePath).toString('base64'),
      originalPath: path.relative(workDir, filePath)
    }));

    let markdown = fs.readFileSync(tempMdPath, 'utf8');
    markdown = rewriteMarkdownImageLinks(markdown, assetId, images)
      .replace(/\{#.*?\}/g, '')
      .replace(/<a id="[^"]+"><\/a>/g, '')
      .replace(/([^\n])\n#(?!#)/g, '$1\n\n#')
      .trim();

    return { markdown, images };
  } finally {
    try {
      if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
}
