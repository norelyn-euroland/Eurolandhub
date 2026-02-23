import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

/**
 * Generate Document Summary API Endpoint (Vercel Serverless)
 *
 * Accepts a PDF or text file upload (FormData) and returns an AI-generated summary.
 * Uses `unpdf` for serverless-compatible PDF text extraction (no @napi-rs/canvas needed).
 * Falls back to raw text if the file is not a PDF.
 */

const SUMMARY_SYSTEM_PROMPT = `You are a financial document analyst for Euroland.
Summarize the document text below in 2-4 concise paragraphs.
Focus on key financial figures, dates, company names, and actionable takeaways.
Write as direct factual statements. Do NOT use phrases like "appears to be", "seems to", "it is likely", or "the document appears".
Do NOT address the reader or add your own commentary or point of view. Just state what the document contains.`;

async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // Dynamic import so unpdf is only loaded at runtime (avoids build issues)
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return { text: text || '', pages: pdf.numPages };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    // Check if the request is JSON (text-based) or FormData (file upload)
    const contentType = req.headers['content-type'] || '';

    let documentText = '';

    if (contentType.includes('application/json')) {
      // JSON body: { text: "..." } or { csvText: "..." }
      const { text, csvText } = req.body as { text?: string; csvText?: string };
      documentText = (text || csvText || '').trim();
    } else if (contentType.includes('multipart/form-data')) {
      // File upload via FormData
      const fileData = await new Promise<{ buffer: Buffer; fileName: string; fileType: string }>((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        let fileBuffer: Buffer | null = null;
        let fileName = 'document';
        let fileType = '';

        busboy.on('file', (_name: string, file: NodeJS.ReadableStream, info: { filename?: string; mimeType?: string }) => {
          fileName = info.filename || 'document';
          fileType = info.mimeType || '';
          const chunks: Buffer[] = [];
          file.on('data', (chunk: Buffer) => chunks.push(chunk));
          file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });

        busboy.on('finish', () => {
          if (!fileBuffer) reject(new Error('No file provided'));
          else resolve({ buffer: fileBuffer, fileName, fileType });
        });

        busboy.on('error', reject);
        req.pipe(busboy);
      });

      const { buffer, fileName, fileType } = fileData;

      // Determine if PDF
      const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        console.log('[DocSummary] Extracting text from PDF…', { bufferSize: buffer.length, bytes: buffer.length });
        const { text, pages } = await extractTextFromPDF(buffer);
        console.log('[DocSummary] Text extracted from PDF:', {
          pages,
          textLength: text.length,
          preview: text.slice(0, 200),
        });
        documentText = text;
      } else {
        // Plain text / CSV
        documentText = buffer.toString('utf-8');
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Unsupported Content-Type. Send JSON body or multipart/form-data with a file.',
      });
      return;
    }

    if (!documentText) {
      res.status(400).json({ success: false, error: 'No text could be extracted from the document.' });
      return;
    }

    // Truncate for LLM token limits (~1600 chars ≈ ~400 tokens)
    const maxLen = 1620;
    const truncated = documentText.length > maxLen;
    const content = truncated ? documentText.slice(0, maxLen) : documentText;
    if (truncated) console.log(`[DocSummary] Text truncated to ${maxLen} chars`);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      res.status(503).json({ success: false, error: 'GROQ_API_KEY is not configured.' });
      return;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: `Summarize:\n\n${content}` },
        ],
      }),
    });

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const msg = json?.error?.message || `Groq API error: ${response.status}`;
      console.error('Groq API error:', msg);
      res.status(502).json({ success: false, error: msg });
      return;
    }

    const summary = json?.choices?.[0]?.message?.content?.trim() || 'Could not generate summary.';
    console.log('[DocSummary] ✓ Summary generated', {
      model: 'llama-3.3-70b-versatile',
      summaryLength: summary.length,
    });

    res.status(200).json({ success: true, summary });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[DocSummary] Error:', msg);
    res.status(500).json({
      success: false,
      error: 'Failed to generate document summary',
      detail: msg,
    });
  }
}

// Disable body parsing for Vercel - we need raw body for busboy (file uploads)
export const config = {
  api: {
    bodyParser: false,
  },
};
