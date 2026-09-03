// Renders a PDF's first page to a PNG data: URI, entirely client-side —
// pdfjs-dist's browser build runs on the renderer's Chromium canvas, so this
// needs no native module (unlike the Node `canvas` package pdf.js normally
// wants for server-side rendering, which we're deliberately avoiding — see
// structure.md's note on why sql.js replaced better-sqlite3).
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Returns a PNG data: URI for the PDF's first page, or null if rendering fails. */
export async function renderPdfCoverFromBase64(base64: string, targetWidth = 320): Promise<string | null> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: base64ToBytes(base64) }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
