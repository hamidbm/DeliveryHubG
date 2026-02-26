
import { toPng, toSvg } from 'html-to-image';
import { ensureSafeStylesheetAccess } from './safeStylesheets';

export async function exportMindMapAsPng(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  try {
    ensureSafeStylesheetAccess();
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      quality: 1,
      pixelRatio: 2
    });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Png export failed', err);
  }
}

export async function exportMindMapAsSvg(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  try {
    ensureSafeStylesheetAccess();
    const dataUrl = await toSvg(element, {
      backgroundColor: '#ffffff'
    });
    const link = document.createElement('a');
    link.download = `${filename}.svg`;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Svg export failed', err);
  }
}
