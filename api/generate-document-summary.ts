import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

/**
 * Generate Document Summary API Endpoint (Vercel Serverless)
 *
 * Accepts a PDF or text file upload (FormData) and returns an AI-generated summary.
 * Uses `unpdf` for serverless-compatible PDF text extraction (no @napi-rs/canvas needed).
 * Falls back to raw text if the file is not a PDF.
 */

const SUMMARY_SYSTEM_PROMPT = `You are a financial document analyst. Your task is to write a summary of the provided document.

STRICT OUTPUT RULES:
1. Write ONLY the summary content - no introductions, no explanations, no meta-commentary
2. Do NOT use phrases like "Let me summarize", "I'll provide", "Here's what", "The document shows", "Based on the document"
3. Do NOT address yourself or the reader - write in third person, factual statements only
4. Do NOT include prefixes like "Summary:", "Here's the summary:", "Document Summary:"
5. Do NOT use markdown formatting (no **bold**, *italic*, # headers, code blocks, or lists)
6. Start immediately with the factual content - no introductory phrases

CONTENT REQUIREMENTS:
- 2-4 concise paragraphs
- Focus on key financial figures, dates, company names, and actionable takeaways
- Write as direct factual statements
- Do NOT use uncertain language like "appears to be", "seems to", "it is likely", "the document appears"
- Write as if stating facts directly, not describing what you're doing

EXAMPLE OF CORRECT OUTPUT:
"The company reported revenue of $500 million in 2024, representing a 15% increase from the previous year. Key initiatives included expansion into three new markets and the launch of a sustainability program targeting carbon neutrality by 2030."

EXAMPLE OF INCORRECT OUTPUT (DO NOT DO THIS):
"Let me provide a summary of this document. The document shows that the company reported revenue..."
"Here's what I found in the document: The company appears to have..."
"Summary: Based on my analysis, the document indicates that..."`;

// Maximum number of pages to scan for summary generation
// Can be overridden via environment variable DOCUMENT_SUMMARY_MAX_PAGES
const MAX_PAGES_TO_SCAN = parseInt(process.env.DOCUMENT_SUMMARY_MAX_PAGES || '10', 10);

async function extractTextFromPDF(buffer: Buffer, maxPages?: number): Promise<{ text: string; pages: number; scannedPages: number }> {
  // Dynamic import so unpdf is only loaded at runtime (avoids build issues)
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const totalPages = pdf.numPages;
  
  // Limit pages to scan (default: first 10 pages, or use provided maxPages)
  const pagesToScan = maxPages || MAX_PAGES_TO_SCAN;
  const pagesToExtract = Math.min(pagesToScan, totalPages);
  
  // Extract text from specified page range (1-indexed)
  const pageNumbers = Array.from({ length: pagesToExtract }, (_, i) => i + 1);
  const { text } = await extractText(pdf, { 
    pages: pageNumbers,
    mergePages: true 
  });
  
  return { 
    text: text || '', 
    pages: totalPages,
    scannedPages: pagesToExtract
  };
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
        console.log('[DocSummary] Extracting text from PDF…', { 
          bufferSize: buffer.length, 
          bytes: buffer.length,
          maxPagesToScan: MAX_PAGES_TO_SCAN 
        });
        const { text, pages, scannedPages } = await extractTextFromPDF(buffer);
        console.log('[DocSummary] Text extracted from PDF:', {
          totalPages: pages,
          scannedPages: scannedPages,
          textLength: text.length,
          preview: text.slice(0, 200),
          note: scannedPages < pages ? `Only scanned first ${scannedPages} of ${pages} pages` : 'Scanned all pages',
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

    // Use the same LLM model strategy as email generation
    const primaryModel = 'qwen/qwen3-32b';
    const fallbackModel = 'llama-3.3-70b-versatile';

    // Helper function to make LLM API call
    const callLLM = async (model: string) => {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.3,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: `Summarize:\n\n${content}` },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      return response;
    };

    let response;
    let usedModel = primaryModel;

    try {
      // Try primary model first (same as email generation)
      response = await callLLM(primaryModel);
    } catch (primaryError: any) {
      console.warn('[DocSummary] Primary model failed, trying fallback:', {
        primaryModel,
        error: primaryError.message,
        fallbackModel,
      });

      try {
        // Fallback to secondary model
        response = await callLLM(fallbackModel);
        usedModel = fallbackModel;
      } catch (fallbackError: any) {
        console.error('[DocSummary] Both models failed:', {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message,
        });
        const msg = fallbackError?.message || `Groq API error: Failed to generate summary with both models.`;
        res.status(502).json({ success: false, error: msg });
        return;
      }
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    let rawSummary = json?.choices?.[0]?.message?.content?.trim() || 'Could not generate summary.';
    
    // Strip <think>...</think> blocks (Qwen thinking mode internal monologue)
    rawSummary = rawSummary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Remove conversational prefixes and meta-commentary
    const conversationalPatterns = [
      /^(Let me|I'll|I will|Let me provide|I'll provide|I will provide|Here's|Here is|Here are)\s+(?:a\s+)?(?:brief\s+)?(?:summary|summarize|what|the\s+summary|the\s+document|findings|analysis)[:.]?\s*/i,
      /^(Summary|Document Summary|Summary of|Summary:)\s*:?\s*/i,
      /^(Based on|According to|From|In)\s+(?:the\s+)?(?:document|text|provided\s+information|analysis)[,.]?\s*/i,
      /^(The\s+document\s+shows|The\s+document\s+indicates|The\s+document\s+reveals|The\s+document\s+states)[,.]?\s*/i,
      /^(This\s+document|This\s+text|This\s+summary)\s+(?:shows|indicates|reveals|states|contains)[,.]?\s*/i,
    ];
    
    conversationalPatterns.forEach(pattern => {
      rawSummary = rawSummary.replace(pattern, '');
    });
    
    // Remove markdown code blocks
    rawSummary = rawSummary
      .replace(/^```(?:markdown|text|plaintext)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    
    // Remove markdown formatting
    rawSummary = rawSummary
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove markdown links
      .replace(/^[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();
    
    // Remove conversational phrases within the text
    rawSummary = rawSummary
      .replace(/\b(Let me|I'll|I will|I can|I should|I need to|I want to|I'm going to|I'm here to)\s+\w+/gi, '')
      .replace(/\b(Here's|Here is|Here are|This is|That is)\s+(?:what|the|a)\s+/gi, '')
      .replace(/\b(Based on|According to|From|In)\s+(?:the\s+)?(?:document|text|provided\s+information)[,.]?\s+/gi, '')
      .trim();
    
    // Clean up excessive whitespace and newlines
    rawSummary = rawSummary
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
      .replace(/^\s*[.,;:]\s*/gm, '') // Remove leading punctuation on new lines
      .trim();
    
    const summary = rawSummary || 'Could not generate summary.';
    
    console.log('[DocSummary] ✓ Summary generated', {
      model: usedModel,
      summaryLength: summary.length,
    });

    res.status(200).json({ success: true, summary, model: usedModel });
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
