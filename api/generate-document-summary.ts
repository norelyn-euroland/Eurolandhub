import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';
import { PDFParse, VerbosityLevel } from 'pdf-parse';

/**
 * POST /api/generate-document-summary
 *
 * Accepts the PDF file as FormData, extracts text on the server using `pdf-parse`,
 * then feeds the text to Groq for summarization.
 *
 * FormData fields: file (PDF file), title, type, publishDate, regenerationCount
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    // Parse FormData with busboy
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
    
    let title = '';
    let type = '';
    let publishDate = '';
    let regenerationCount = 0;
    let pdfBuffer: Buffer | null = null;

    busboy.on('field', (fieldname, val) => {
      if (fieldname === 'title') title = val;
      else if (fieldname === 'type') type = val;
      else if (fieldname === 'publishDate') publishDate = val;
      else if (fieldname === 'regenerationCount') regenerationCount = parseInt(val, 10) || 0;
    });

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname === 'file') {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('end', () => {
          pdfBuffer = Buffer.concat(chunks);
        });
      } else {
        file.resume(); // Discard non-file fields
      }
    });

    await new Promise<void>((resolve, reject) => {
      busboy.on('finish', resolve);
      busboy.on('error', reject);
      req.pipe(busboy);
    });

    // Validate required fields
    if (!title || !type) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Missing required fields: title and type are required',
      });
      return;
    }

    const validTypes = ['earnings', 'dividend', 'disclosure', 'press_release', 'agm', 'governance', 'esg', 'presentation', 'silent_period'];
    if (!validTypes.includes(String(type))) {
      res.status(400).json({
        success: false,
        error: 'INVALID_TYPE',
        message: `Invalid document type. Must be one of: ${validTypes.join(', ')}`,
      });
      return;
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      res.status(500).json({
        success: false,
        error: 'MISSING_API_KEY',
        message: 'Missing GROQ_API_KEY on server',
      });
      return;
    }

    // ── 1. Extract text from PDF ────────────────────────────────
    let extractedText = '';

    if (pdfBuffer) {
      try {
        console.log('[DocSummary] Extracting text from PDF…', { bufferSize: pdfBuffer.length, bytes: pdfBuffer.length });

        const parser = new PDFParse({
          data: new Uint8Array(pdfBuffer),
          verbosity: VerbosityLevel.ERRORS,
        });
        const textResult = await parser.getText();
        extractedText = String(textResult.text || '').trim();

        // Remove page separator lines like "-- 1 of 10 --"
        extractedText = extractedText.replace(/\n-- \d+ of \d+ --\n/g, '\n');

        console.log('[DocSummary] Text extracted from PDF:', {
          pages: textResult.total,
          textLength: extractedText.length,
          preview: extractedText.slice(0, 300),
        });

        await parser.destroy();
      } catch (extractError: any) {
        console.error('[DocSummary] PDF extraction failed:', extractError);
        res.status(400).json({
          success: false,
          error: 'PDF_EXTRACTION_FAILED',
          message: 'Failed to extract text from PDF. Please ensure the file is a valid PDF.',
          details: extractError.message,
        });
        return;
      }
    }

    // Limit extraction to 5k-6k chars (sweet spot for cleaner, cheaper extraction)
    const MAX_TEXT = 6000;
    const MAX_PAGES = 3;
    
    // Try to limit to first 3 pages if possible, otherwise truncate to 6k chars
    if (extractedText.length > MAX_TEXT) {
      // Simple heuristic: try to find page breaks and limit to first 3 pages
      const pageBreaks = extractedText.match(/\n{2,}/g);
      if (pageBreaks && pageBreaks.length >= MAX_PAGES) {
        const parts = extractedText.split(/\n{2,}/);
        extractedText = parts.slice(0, MAX_PAGES).join('\n\n');
        if (extractedText.length > MAX_TEXT) {
          extractedText = extractedText.slice(0, MAX_TEXT);
        }
      } else {
        extractedText = extractedText.slice(0, MAX_TEXT);
      }
      console.log('[DocSummary] Text truncated to', extractedText.length, 'chars');
    }

    const dateToUse = publishDate || new Date().toISOString().split('T')[0];

    // ── 2. Build prompts ────────────────────────────────────────
    // Using models that are commonly available in Groq
    const primaryModel = 'llama-3.3-70b-versatile';
    const fallbackModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

    const systemPrompt = `You are a financial document analyst specializing in Investor Relations disclosures. Your task is to strictly summarize the factual content of the provided document.

STRICT FORMATTING RULES:
- Write a single natural editorial paragraph (no markdown, no headings, no bullet points, no emojis, no symbols)
- Do NOT output any HTML tags or markup of any kind (no <strong>, no <>)
- Do NOT include calls to action
- Do NOT encourage readers to review the full report
- Do NOT reference the existence of the full document
- Do NOT write phrases such as "for more details" or similar closing statements
- Do NOT address the reader directly
- Do NOT add commentary beyond summarizing the document
- End naturally after presenting material information
- Do NOT invent or infer any numbers or metrics; include figures only if they are explicitly stated in the provided text
- Target length: 150-250 words

TONE & STYLE:
- Professional, neutral, analytical
- Investor-focused
- Clear and direct
- Factual summarization only`;

    // Build user prompt
    let userPrompt = `Document Title: ${title}
Document Type: ${type}
Publish Date: ${dateToUse}

Extracted Content:
${extractedText}`;

    // Add regeneration strictness if regenerating
    if (regenerationCount > 0) {
      userPrompt += `\n\nRewrite the summary to be more concise, more focused on material financial impact, and more direct in tone. Maintain paragraph format and do not use markdown.`;
    }

    // ── 3. Post-processing: Strip markdown if LLM leaks it ──────
    const stripMarkdown = (text: string) => {
      // Remove markdown headers
      text = text.replace(/^#{1,6}\s+/gm, '');
      // Remove markdown bold/italic markers (do NOT convert to HTML)
      text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
      text = text.replace(/\*([^*]+)\*/g, '$1');
      // Remove underscores bold/italic
      text = text.replace(/__([^_]+)__/g, '$1');
      text = text.replace(/_([^_]+)_/g, '$1');
      // Remove stray asterisks
      text = text.replace(/\*/g, '');
      // Remove bullet points
      text = text.replace(/^[-•]\s+/gm, '');
      // Remove numbered lists
      text = text.replace(/^\d+\.\s+/gm, '');
      // Strip any HTML tags (should never be present, but enforce)
      text = text.replace(/<[^>]*>/g, '');
      // Clean up multiple newlines
      text = text.replace(/\n{3,}/g, '\n\n');
      return text.trim();
    };

    // ── 4. Call Groq ────────────────────────────────────────────
    const callGroq = async (model: string) => {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 700, // Targets 150-250 word summaries
        }),
      });

      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Groq API error: ${r.status} - ${t}`);
      }
      return r;
    };

    let response;
    let usedModel = primaryModel;
    try {
      response = await callGroq(primaryModel);
    } catch (primaryError: any) {
      console.warn('[DocSummary] Primary model failed, trying fallback…', primaryError?.message);
      try {
        usedModel = fallbackModel;
        response = await callGroq(fallbackModel);
      } catch (fallbackError: any) {
        res.status(500).json({
          success: false,
          error: 'LLM_BOTH_FAILED',
          message: 'Both LLM models failed. Please try again.',
          details: {
            primary: primaryError?.message || String(primaryError),
            fallback: fallbackError?.message || String(fallbackError),
          },
        });
        return;
      }
    }

    const json = await response.json().catch(() => ({}));
    let summary = String(json?.choices?.[0]?.message?.content || '').trim();
    
    if (!summary) {
      res.status(500).json({
        success: false,
        error: 'EMPTY_SUMMARY',
        message: 'Empty summary generated',
      });
      return;
    }

    // Post-process: Strip markdown / HTML if LLM leaks it
    if (
      summary.includes('##') ||
      summary.includes('**') ||
      summary.includes('- ') ||
      summary.includes('•') ||
      summary.includes('<') ||
      summary.includes('>')
    ) {
      summary = stripMarkdown(summary);
      console.warn('[DocSummary] Markup detected and stripped from output');
    }

    console.log('[DocSummary] ✓ Summary generated', { model: usedModel, summaryLength: summary.length });

    res.status(200).json({
      success: true,
      summary,
      regenerationCount: Number(regenerationCount) + 1,
      model: usedModel,
      extractedTextLength: extractedText.length,
    });
  } catch (error: any) {
    console.error('[DocSummary] Error:', error);
    res.status(500).json({
      success: false,
      error: 'UNKNOWN_ERROR',
      message: error?.message || 'Failed to generate document summary',
    });
  }
}
