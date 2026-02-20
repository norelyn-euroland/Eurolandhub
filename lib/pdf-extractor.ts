/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files using pdfjs-dist v5.
 *
 * The worker file (pdf.worker.min.mjs) is served from /public so Vite
 * can deliver it as a plain static asset — no bundler magic needed.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Point to the static copy in /public (copied from node_modules/pdfjs-dist/build/)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/** Maximum characters to extract (≈ 7 500 tokens — well within Groq limits) */
const MAX_TEXT_LENGTH = 30_000;

/**
 * Extract text content from a PDF file.
 * @param file – PDF File object from the user's file picker / drag-drop.
 * @returns Extracted text (truncated to MAX_TEXT_LENGTH if needed).
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log(
      '[PDF Extractor] Starting extraction for:',
      file.name,
      `(${(file.size / 1024).toFixed(1)} KB)`
    );

    const arrayBuffer = await file.arrayBuffer();

    // pdfjs-dist v5 expects a typed-array or ArrayBuffer
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    console.log(`[PDF Extractor] PDF loaded — ${pdf.numPages} page(s)`);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => (typeof item === 'string' ? item : item.str || ''))
        .join(' ');

      fullText += pageText + '\n\n';

      // Stop early once we have more than enough text
      if (fullText.length >= MAX_TEXT_LENGTH) {
        console.log(
          `[PDF Extractor] Reached max text length at page ${pageNum}/${pdf.numPages}`
        );
        break;
      }
    }

    const trimmed = fullText.trim();
    console.log(`[PDF Extractor] Extraction complete — ${trimmed.length} characters`);

    if (!trimmed) {
      console.warn(
        '[PDF Extractor] No text extracted (the PDF may be scanned / image-based)'
      );
    }

    if (trimmed.length > MAX_TEXT_LENGTH) {
      return (
        trimmed.slice(0, MAX_TEXT_LENGTH) +
        '\n\n[… document truncated for summarization …]'
      );
    }

    return trimmed;
  } catch (error: any) {
    console.error('[PDF Extractor] Extraction failed:', error);
    throw new Error(
      `Failed to extract text from PDF: ${error?.message || 'Unknown error'}`
    );
  }
}
