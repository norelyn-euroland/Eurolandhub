import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import Busboy from 'busboy';
import { Resend } from 'resend';
import { PDFParse, VerbosityLevel } from 'pdf-parse';
import { invitationTemplate } from './lib/email-templates.ts';

// Load env vars from both .env.local (preferred) and .env (fallback)
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Lightweight helpers for template-to-text (used by /api/generate-invitation-message)
function htmlToText(html) {
  if (!html) return '';
  let text = String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  text = text.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
  text = text.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');

  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/ul>/gi, '\n\n');
  text = text.replace(/<\/ol>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  text = text.replace(/<[^>]*>/g, '');

  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#96;/g, '`')
    .replace(/&#x27;/g, "'")
    .replace(/&#160;/g, ' ');

  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanBodyText(body, subject) {
  if (!body || !subject) return body;
  const escapedSubject = String(subject).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subjectPattern = new RegExp(`^\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i');
  return String(body).replace(subjectPattern, '').replace(/^Subject:\s*[^\n\r]*[\n\r\s]*/i, '').trim();
}

function structureMessageBody(body) {
  return String(body).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Adapt invitation message style using Groq while preserving protected placeholders.
 * This is used by /api/generate-invitation-message (template generation),
 * so it MUST NOT inject any real names/links and MUST keep protected placeholders intact.
 */
async function adaptMessageStyle(baseSubject, baseBody, style, groqKey) {
  const normalizedStyle = String(style || '').toLowerCase().trim();

  const globalSystemPrompt = `You are composing an investor invitation email from structured facts.
You are NOT rewriting or paraphrasing any existing email.

Your task is to WRITE A NEW EMAIL from scratch in the requested MESSAGE STYLE.
Each regeneration may vary phrasing, structure, tone, and greeting naturally.

Do NOT reuse wording, sentence structure, or paragraph flow from any prior output.

Focus on clarity, trust, and a clear call-to-action.
This is an invitation email, not a brochure or announcement.

────────────────────────────────────────
PROTECTED PLACEHOLDERS (CRITICAL)
────────────────────────────────────────
You MUST include these EXACT placeholders:
- [PROTECTED_FIRST_NAME]
- [PROTECTED_LAST_NAME]
- [PROTECTED_REGISTRATION_LINK]

Rules:
- Do NOT modify, rename, merge, or remove placeholders
- Do NOT replace placeholders with real values
- You may place them naturally anywhere in the message

────────────────────────────────────────
FACTS YOU MUST COMMUNICATE
────────────────────────────────────────
Your email must clearly communicate ALL of the following facts:

1. The recipient appears in official shareholder records
2. A pre-verified investor account already exists for them
3. They are invited to complete a short registration
4. Registration is completed by visiting [PROTECTED_REGISTRATION_LINK]
5. The invitation link is valid for 30 days
6. After registration, they gain access to verified investor features
7. If the email was received in error, it can be ignored
8. The sender is Euroland Team

────────────────────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────────────────────
Return EXACTLY this format:

Subject:
<write subject line>

Body:
<write full email body>

Do not add explanations, headings, or extra text.`;

  const stylePrompts = {
    formal: `STYLE: FORMAL

Apply a FORMAL tone:
- Very polite and structured language
- NO contractions (use "do not", "you are", etc.)
- Suitable for regulated financial communication

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    professional: `STYLE: PROFESSIONAL

Apply a PROFESSIONAL tone:
- Polished investor-relations voice
- Clear, confident, reassuring
- Slightly warmer than Formal

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    casual: `STYLE: CASUAL

Apply a CASUAL tone:
- Conversational and relaxed
- Contractions are OK
- Approachable but still respectful

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    friendly: `STYLE: FRIENDLY

Apply a FRIENDLY tone:
- Warm, welcoming, encouraging
- Human and personable
- Positive and inviting language

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
  };

  const chosenStylePrompt = stylePrompts[normalizedStyle] || stylePrompts.professional;

  const parseLLMResponse = (responseText) => {
    const text = String(responseText || '');
    const subjectMatch = text.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : '';
    const bodyMatch = text.match(/Body:\s*([\s\S]+)$/i);
    const body = bodyMatch ? bodyMatch[1].trim() : text.trim();
    return { subject, body };
  };

  const callGroq = async (model) => {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 900,
        messages: [
          { role: 'system', content: globalSystemPrompt },
          {
            role: 'user',
            content: `${chosenStylePrompt}

INPUT SUBJECT:
${baseSubject}

INPUT BODY:
${baseBody}`,
          },
        ],
      }),
    });

    const json = await r.json().catch(() => ({}));

    // Normalize errors
    if (!r.ok) {
      const status = r.status;
      const msg =
        json?.error?.message ||
        json?.message ||
        `Groq request failed with status ${status}`;
      const err = new Error(msg);
      err.status = status;
      throw err;
    }

    const content = json?.choices?.[0]?.message?.content;
    return String(content || '');
  };

  const primaryModel = 'qwen/qwen3-32b';
  const fallbackModel = 'llama-3.3-70b-versatile';

  let rateLimitWarning;
  let usedText;

  try {
    usedText = await callGroq(primaryModel);
  } catch (e) {
    const status = e?.status;
    if (status === 429) {
      // Try fallback model on rate-limit
      try {
        usedText = await callGroq(fallbackModel);
        rateLimitWarning = 'primary';
      } catch (e2) {
        if (e2?.status === 429) {
          rateLimitWarning = 'both';
          return { subject: baseSubject, body: baseBody, rateLimitWarning };
        }
        throw e2;
      }
    } else {
      throw e;
    }
  }

  const parsed = parseLLMResponse(usedText);
  const subjectOut = parsed.subject || baseSubject;
  let bodyOut = parsed.body || baseBody;

  // Guardrails: ensure placeholders still exist; if missing, restore them without discarding the styled output
  const required = ['[PROTECTED_FIRST_NAME]', '[PROTECTED_LAST_NAME]', '[PROTECTED_REGISTRATION_LINK]'];
  const missing = required.filter((p) => !String(bodyOut).includes(p));
  if (missing.length > 0) {
    // Restore greeting placeholders if missing
    const hasGreeting = /^(hello|hi|dear|greetings)\b/i.test(String(bodyOut).trim());
    if (!hasGreeting && missing.includes('[PROTECTED_FIRST_NAME]')) {
      bodyOut = `Hello [PROTECTED_FIRST_NAME],\n\n${String(bodyOut).trim()}`;
    }

    // If last name is missing, try to append it to the greeting line (or add a polite opener)
    if (missing.includes('[PROTECTED_LAST_NAME]')) {
      const lines = String(bodyOut).split(/\r?\n/);
      if (lines.length > 0 && /^(hello|hi|dear|greetings)\b/i.test(lines[0])) {
        // Add last name after first name if present; otherwise append at end of greeting
        lines[0] = lines[0]
          .replace(/\[PROTECTED_FIRST_NAME\](?!\s+\[PROTECTED_LAST_NAME\])/g, '[PROTECTED_FIRST_NAME] [PROTECTED_LAST_NAME]')
          .replace(/\s+\[PROTECTED_LAST_NAME\]\s+\[PROTECTED_LAST_NAME\]/g, ' [PROTECTED_LAST_NAME]');
        bodyOut = lines.join('\n');
      } else {
        bodyOut = `Dear [PROTECTED_FIRST_NAME] [PROTECTED_LAST_NAME],\n\n${String(bodyOut).trim()}`;
      }
    }

    // Restore registration link call-to-action if missing
    if (missing.includes('[PROTECTED_REGISTRATION_LINK]')) {
      const cta = `\n\nComplete your registration here: [PROTECTED_REGISTRATION_LINK]`;
      bodyOut = `${String(bodyOut).trim()}${cta}`;
    }

    // Mark that we had to restore placeholders
    rateLimitWarning = rateLimitWarning || 'placeholders';
  }

  return { subject: subjectOut, body: bodyOut, rateLimitWarning };
}

// CORS configuration - allow requests from Vite dev server
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// Middleware to parse JSON — 10 MB limit (FormData will be handled by busboy, not JSON parser)
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

/**
 * POST /api/generate-document-summary
 *
 * Accepts the PDF file as FormData, extracts text on the server using `pdf-parse`,
 * then feeds the text to Groq for summarization.
 *
 * FormData fields: file (PDF file), title, type, publishDate, regenerationCount
 */
app.post('/api/generate-document-summary', async (req, res) => {
  try {
    // Parse FormData with busboy
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
    
    let title = '';
    let type = '';
    let publishDate = '';
    let regenerationCount = 0;
    let pdfBuffer = null;

    busboy.on('field', (fieldname, val) => {
      if (fieldname === 'title') title = val;
      else if (fieldname === 'type') type = val;
      else if (fieldname === 'publishDate') publishDate = val;
      else if (fieldname === 'regenerationCount') regenerationCount = parseInt(val, 10) || 0;
    });

    busboy.on('file', (fieldname, file, info) => {
      if (fieldname === 'file') {
        const chunks = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
          pdfBuffer = Buffer.concat(chunks);
        });
      } else {
        file.resume(); // Discard non-file fields
      }
    });

    await new Promise((resolve, reject) => {
      busboy.on('finish', resolve);
      busboy.on('error', reject);
      req.pipe(busboy);
    });

    // Validate required fields
    if (!title || !type) {
      res.status(400).json({
        success: false,
        error: 'PDF_EXTRACTION_FAILED',
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
      } catch (extractError) {
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
    const stripMarkdown = (text) => {
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
    const callGroq = async (model) => {
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
    } catch (primaryError) {
      console.warn('[DocSummary] Primary model failed, trying fallback…', primaryError?.message);
      try {
        usedModel = fallbackModel;
        response = await callGroq(fallbackModel);
      } catch (fallbackError) {
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
  } catch (error) {
    console.error('[DocSummary] Error:', error);
    res.status(500).json({
      success: false,
      error: 'UNKNOWN_ERROR',
      message: error?.message || 'Failed to generate document summary',
    });
  }
});

/**
 * POST /api/generate-invitation-message
 * Returns an invitation SUBJECT/BODY **template** with raw placeholders preserved:
 * - {{ first_name }}
 * - {{ last_name }}
 * - {{ registration_link }}
 *
 * This is used by the UI to generate a message before selecting recipients,
 * so we must NOT inject any real names or links here.
 */
app.post('/api/generate-invitation-message', async (req, res) => {
  try {
    const { messageStyle = 'default' } = req.body || {};

    // Convert template HTML to plain text body
    const templateSubject = invitationTemplate.subject;
    let templateBodyText = htmlToText(invitationTemplate.html);
    templateBodyText = cleanBodyText(templateBodyText, templateSubject);

    // Default style: return template as-is (placeholders intact)
    if (String(messageStyle).toLowerCase().trim() === 'default') {
      res.status(200).json({
        ok: true,
        subject: templateSubject,
        body: structureMessageBody(templateBodyText),
      });
      return;
    }

    // Other styles: use LLM but keep placeholders protected, then map them back to {{ ... }}
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      // Fallback to default template if no key
      res.status(200).json({
        ok: true,
        subject: templateSubject,
        body: structureMessageBody(templateBodyText),
        warning: 'Missing GROQ_API_KEY; using default template.',
      });
      return;
    }

    const protectedSubject = String(templateSubject)
      .replace(/\{\{ first_name \}\}/gi, '[PROTECTED_FIRST_NAME]')
      .replace(/\{\{firstName\}\}/gi, '[PROTECTED_FIRST_NAME]')
      .replace(/\{\{ last_name \}\}/gi, '[PROTECTED_LAST_NAME]')
      .replace(/\{\{lastName\}\}/gi, '[PROTECTED_LAST_NAME]');

    const protectedBody = String(templateBodyText)
      .replace(/\{\{ first_name \}\}/gi, '[PROTECTED_FIRST_NAME]')
      .replace(/\{\{firstName\}\}/gi, '[PROTECTED_FIRST_NAME]')
      .replace(/\{\{ last_name \}\}/gi, '[PROTECTED_LAST_NAME]')
      .replace(/\{\{lastName\}\}/gi, '[PROTECTED_LAST_NAME]')
      .replace(/\{\{ registration_link \}\}/gi, '[PROTECTED_REGISTRATION_LINK]')
      .replace(/\{\{registrationLink\}\}/gi, '[PROTECTED_REGISTRATION_LINK]')
      .replace(/\{\{ registration_id \}\}/gi, '[PROTECTED_REGISTRATION_ID]')
      .replace(/\{\{registrationId\}\}/gi, '[PROTECTED_REGISTRATION_ID]');

    const adapted = await adaptMessageStyle(protectedSubject, protectedBody, messageStyle, groqKey);
    const outSubject = String(adapted.subject || protectedSubject)
      .replace(/\[PROTECTED_FIRST_NAME\]/g, '{{ first_name }}')
      .replace(/\[PROTECTED_LAST_NAME\]/g, '{{ last_name }}');

    const outBody = String(adapted.body || protectedBody)
      .replace(/\[PROTECTED_FIRST_NAME\]/g, '{{ first_name }}')
      .replace(/\[PROTECTED_LAST_NAME\]/g, '{{ last_name }}')
      .replace(/\[PROTECTED_REGISTRATION_LINK\]/g, '{{ registration_link }}')
      .replace(/\[PROTECTED_REGISTRATION_ID\]/g, '{{ registration_id }}');

    res.status(200).json({
      ok: true,
      subject: outSubject,
      body: structureMessageBody(outBody),
      rateLimitWarning: adapted.rateLimitWarning,
    });
  } catch (e) {
    console.error('Error in generate-invitation-message:', e);
    res.status(500).json({ error: 'Failed to generate invitation template' });
  }
});

/**
 * POST /api/send-invitation-email
 * Local dev implementation of the Vercel serverless function in `api/send-invitation-email.ts`.
 */
app.post('/api/send-invitation-email', async (req, res) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      res.status(500).json({ error: 'Missing RESEND_API_KEY on server' });
      return;
    }

    // Initialize Resend client
    const resend = new Resend(resendApiKey);
    
    // Invitation email template
    const invitationTemplate = {
      subject: 'Invitation to complete your verified investor registration',
      html: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>You have been identified as a shareholder based on our official records.</p>
  <p>An account has been pre-verified for you, and you are invited to complete a simple registration to gain access to exclusive investor features on our platform.</p>
  <p>To claim your verified account, please visit: <a href="{{ registration_link }}">{{ registration_link }}</a></p>
  <p>Once you complete the registration, you will have access to exclusive investor features, including real-time portfolio updates, detailed financial reports, investor communications, and priority support.</p>
  <p>Important: This invitation link is valid for 30 days from the date of this email. If the link expires, you may need to request a new invitation or register through the standard verification process.</p>
  <p>If you did not expect this invitation, you may safely ignore this message.</p>
  <p>Best regards,<br>Euroland Team</p>
</body>
</html>`,
    };

    const {
      toEmail,
      firstName,
      lastName,
      registrationId,
      messageStyle = 'default',
      preview = false,
      customSubject,
      customBody,
    } = req.body || {};

    if (!toEmail || !String(toEmail).trim()) {
      res.status(400).json({ error: 'toEmail is required and must be a valid email address' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(toEmail).trim())) {
      res.status(400).json({ error: 'Invalid email address format' });
      return;
    }

    // Helpers (JS version)
    const generateSecureToken = () =>
      `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Helper to convert HTML to plain text (strip HTML tags and styles)
    const htmlToText = (html) => {
      if (!html) return '';
      
      // Remove <style> tags and their content (including nested styles)
      let text = String(html).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      
      // Remove <script> tags and their content
      text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      
      // Remove HTML comments
      text = text.replace(/<!--[\s\S]*?-->/g, '');
      
      // Remove inline style attributes
      text = text.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
      
      // Remove class attributes (they often contain CSS references)
      text = text.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');
      
      // Convert block-level elements to double newlines (paragraphs)
      text = text.replace(/<\/p>/gi, '\n\n');
      text = text.replace(/<\/div>/gi, '\n\n');
      text = text.replace(/<\/h[1-6]>/gi, '\n\n');
      text = text.replace(/<\/li>/gi, '\n');
      text = text.replace(/<\/ul>/gi, '\n\n');
      text = text.replace(/<\/ol>/gi, '\n\n');
      
      // Convert line breaks to single newlines
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<br>/gi, '\n');
      
      // Remove all remaining HTML tags
      text = text.replace(/<[^>]*>/g, '');
      
      // Decode HTML entities
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#96;/g, '`')
        .replace(/&#x27;/g, "'")
        .replace(/&#160;/g, ' '); // Non-breaking space
      
      // Remove any remaining CSS-like patterns (selectors, rules, etc.)
      text = text.replace(/#[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, ''); // ID selectors
      text = text.replace(/\.[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, ''); // Class selectors
      text = text.replace(/@media[^{]*\{[^}]*\}/g, ''); // Media queries
      text = text.replace(/@[a-zA-Z-]+\s*[^{]*\{[^}]*\}/g, ''); // Other @ rules
      
      // Normalize whitespace but preserve paragraph breaks
      text = text
        .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
        .replace(/\n{3,}/g, '\n\n') // More than 2 newlines to double newline
        .trim();
      
      return text;
    };

    // Structure message body with proper formatting
    const structureMessageBody = (body) => {
      let structured = String(body).trim();
      
      // Normalize existing newlines first
      structured = structured.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
      
      // CRITICAL: Ensure links are ALWAYS on their own line (never inline with text)
      // Match any URL and ensure it has newlines before and after
      structured = structured.replace(/([^\n\s])\s*(https?:\/\/[^\s]+)/g, '$1\n\n$2');
      structured = structured.replace(/(https?:\/\/[^\s]+)\s*([^\n\s])/g, '$1\n\n$2');
      
      // If the body has very few newlines, it's likely a wall of text - add smart breaks
      const newlineCount = (structured.match(/\n/g) || []).length;
      if (newlineCount < 5 && structured.length > 200) {
        // Add paragraph break after greeting (Dear X, / Hello X, / Hi X,)
        structured = structured.replace(/^((?:Dear|Hello|Hi|Greetings|Good\s+(?:morning|afternoon|evening))[^,\n]*,)\s*/i, '$1\n\n');
        
        // Add break before closing signatures
        structured = structured.replace(/\.\s*(Best regards|Sincerely|Warm regards|Kind regards|Regards|Cheers|Thank you|Thanks),?\s*\n?(?:Euroland|The Euroland)/gi, '.\n\n$1,\nEuroland');
        structured = structured.replace(/([.!])\s*(Euroland Team)/gi, '$1\n\n$2');
        
        // Add break before "Important" or "Please note" sections
        structured = structured.replace(/([.!])\s*(Important(?:ly)?:|Please note:|Note:)/gi, '$1\n\n$2');
        
        // Add break before disclaimers
        structured = structured.replace(/([.!])\s*(If you (?:did not|didn't|have not|haven't|were not|weren't|are not|aren't))/gi, '$1\n\n$2');
        
        // Add break before validity notices
        structured = structured.replace(/([.!])\s*(This (?:invitation|link|offer) (?:is valid|will expire|expires))/gi, '$1\n\n$2');
      }
      
      // Final cleanup: normalize multiple newlines, ensure no more than 2 consecutive
      structured = structured.replace(/\n{3,}/g, '\n\n').trim();
      
      return structured;
    };

    // Helper to clean body text and remove subject line if it appears
    const cleanBodyText = (body, subject) => {
      if (!body || !subject) return body;
      
      let cleaned = String(body);
      
      // Remove exact subject match at the beginning
      const escapedSubject = String(subject).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const subjectPattern = new RegExp(`^\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i');
      cleaned = cleaned.replace(subjectPattern, '');
      
      // Remove subject with common prefixes
      const subjectPrefixes = [
        new RegExp(`^Subject:\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i'),
        new RegExp(`^Re:\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i'),
        new RegExp(`^Fwd?:\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i'),
      ];
      
      for (const prefix of subjectPrefixes) {
        cleaned = cleaned.replace(prefix, '');
      }
      
      // Remove standalone "Subject:" lines
      cleaned = cleaned.replace(/^Subject:\s*[^\n\r]*[\n\r\s]*/i, '');
      
      // Extract first meaningful sentence/paragraph (skip any remaining subject-like content)
      // Look for common email body starters
      const bodyStarters = [
        /Hello\s+/i,
        /Dear\s+/i,
        /Hi\s+/i,
        /Greetings/i,
      ];
      
      // If body doesn't start with a greeting, try to find where actual content starts
      let hasGreeting = false;
      for (const starter of bodyStarters) {
        if (starter.test(cleaned)) {
          hasGreeting = true;
          break;
        }
      }
      
      // If no greeting found, try to find first sentence that looks like body content
      if (!hasGreeting && cleaned.length > 50) {
        // Look for patterns that indicate body content (not subject)
        const bodyPattern = /(You have|We are|This is|Please|Thank you|I hope)/i;
        const match = cleaned.search(bodyPattern);
        if (match > 0 && match < 200) {
          // Content starts later, remove everything before it
          cleaned = cleaned.substring(match);
        }
      }
      
      return cleaned.trim();
    };

    // Helper to parse LLM response
    const parseLLMResponse = (response) => {
      const text = String(response);
      
      // Extract subject line (everything after "Subject:" until newline)
      const subjectMatch = text.match(/Subject:\s*(.+?)(?:\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Extract body (everything after "Body:" to the end)
      // Use greedy match to capture the entire body including all paragraphs
      const bodyMatch = text.match(/Body:\s*([\s\S]+)$/i);
      let body = bodyMatch ? bodyMatch[1].trim() : text;
      
      // Debug: log what we parsed
      console.log('parseLLMResponse:', {
        hasSubject: !!subjectMatch,
        subjectLength: subject.length,
        hasBody: !!bodyMatch,
        bodyLength: body.length,
        bodyPreview: body.substring(0, 100)
      });
      
      return { subject, body };
    };

    const adaptMessageStyle = async (baseSubject, baseBody, style, groqKey) => {
      // Normalize style to lowercase
      const normalizedStyle = String(style).toLowerCase().trim();
      // Global system rules (used by ALL styles including default)
      // FINAL SYSTEM PROMPT (with guardrails)
      // This replaces both global + style prompts
      const globalSystemPrompt = `You are composing an investor invitation email from structured facts.
You are NOT rewriting or paraphrasing any existing email.

Your task is to WRITE A NEW EMAIL from scratch in the requested MESSAGE STYLE.
Each regeneration may vary phrasing, structure, tone, and greeting naturally.

Do NOT reuse wording, sentence structure, or paragraph flow from any prior output.

Focus on clarity, trust, and a clear call-to-action.
This is an invitation email, not a brochure or announcement.

────────────────────────────────────────
PROTECTED PLACEHOLDERS (CRITICAL)
────────────────────────────────────────
You MUST include these EXACT placeholders:
- [PROTECTED_FIRST_NAME]
- [PROTECTED_LAST_NAME]
- [PROTECTED_REGISTRATION_LINK]

Rules:
- Do NOT modify, rename, merge, or remove placeholders
- Do NOT replace placeholders with real values
- You may place them naturally anywhere in the message

────────────────────────────────────────
FACTS YOU MUST COMMUNICATE
────────────────────────────────────────
Your email must clearly communicate ALL of the following facts:

1. The recipient appears in official shareholder records
2. A pre-verified investor account already exists for them
3. They are invited to complete a short registration
4. Registration is completed by visiting [PROTECTED_REGISTRATION_LINK]
5. The invitation link is valid for 30 days
6. After registration, they gain access to verified investor features
7. If the email was received in error, it can be ignored
8. The sender is Euroland Team

You may express these facts in ANY wording, order, and structure.

────────────────────────────────────────
NAME USAGE RULES (NOT GREETING-LOCKED)
────────────────────────────────────────
- FORMAL / PROFESSIONAL:
  Use [PROTECTED_LAST_NAME] somewhere in the greeting or opening line
- CASUAL / FRIENDLY:
  Use [PROTECTED_FIRST_NAME] in the greeting or opening line

You are NOT restricted to a single greeting format.
Vary greetings naturally across regenerations.

────────────────────────────────────────
STYLE DEFINITIONS
────────────────────────────────────────
FORMAL:
- Traditional, structured, conservative
- No contractions
- Suitable for regulated financial communication

PROFESSIONAL:
- Polished, modern investor-relations tone
- Clear, confident, reassuring
- Slightly warmer than Formal

CASUAL:
- Conversational and relaxed
- Natural contractions
- Approachable but still respectful

FRIENDLY:
- Warm, welcoming, and encouraging
- Human, positive, and personable
- Makes the recipient feel valued

Ensure each style is clearly distinct in tone and wording.

────────────────────────────────────────
LENGTH & CLARITY GUARDRAILS (IMPORTANT)
────────────────────────────────────────
This is a time-sensitive invitation email.

SUBJECT LINE:
- Keep it short, clear, and decisive
- Target: 40–65 characters
- One clear idea only
- Avoid vague, marketing-heavy, or overly formal phrasing

EMAIL BODY:
- Target length: 900–1,200 characters
- Hard maximum: 1,500 characters
- Be concise and scannable
- Avoid unnecessary background, repetition, or long explanations
- Prefer clarity and action over formality or verbosity
- One sentence per idea where possible

If content becomes too long, simplify rather than expand.

────────────────────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────────────────────
Return EXACTLY this format:

Subject:
<write subject line>

Body:
<write full email body>

Do not add explanations, headings, or extra text.
Write a complete, natural email suitable for an investor inbox.`;

      // Style-specific prompts
      const stylePrompts = {
        default: `STYLE: DEFAULT

For "default" style, you must ONLY structure the message with proper paragraph breaks. 
DO NOT change any wording, tone, or phrasing. 
Keep the exact original text from the template, just format it properly with correct line breaks.`,
        
        formal: `STYLE: FORMAL

Write freely in a FORMAL style. Be creative while maintaining formality.

Guidelines (not restrictions - write freely):
- Traditional business tone
- Structured and reserved
- Longer sentences
- NO contractions
- Authoritative and conservative
- Use "Dear [PROTECTED_FIRST_NAME] [PROTECTED_LAST_NAME]," for greeting

Write naturally and creatively. Make it clearly FORMAL but feel free to express ideas in your own way.`,
        
        professional: `STYLE: PROFESSIONAL

Write freely in a PROFESSIONAL style. Be creative while maintaining professionalism.

Guidelines (not restrictions - write freely):
- Polished investor-relations tone
- Clear, confident, reassuring
- Slightly warmer and more modern than Formal
- Efficient but courteous
- Use "Dear [PROTECTED_FIRST_NAME] [PROTECTED_LAST_NAME]," for greeting

Write naturally and creatively. Make it clearly PROFESSIONAL but feel free to express ideas in your own way.`,
        
        casual: `STYLE: CASUAL

Write freely in a CASUAL style. Be creative while staying respectful.

Guidelines (not restrictions - write freely):
- Conversational and relaxed
- Uses contractions naturally
- Shorter sentences
- Friendly but still respectful
- May greet with first name only: "Hello [PROTECTED_FIRST_NAME],"

Write naturally and creatively. Make it clearly CASUAL but feel free to express ideas in your own way.`,
        
        friendly: `STYLE: FRIENDLY

Write freely in a FRIENDLY style. Be creative while staying warm and welcoming.

Guidelines (not restrictions - write freely):
- Warm, welcoming, and encouraging
- Human and personable
- Makes the recipient feel valued
- Positive and inviting language
- May greet with first name only: "Hello [PROTECTED_FIRST_NAME],"

Write naturally and creatively. Make it clearly FRIENDLY but feel free to express ideas in your own way.`
      };

      // Model configuration: Primary and Fallback
      const primaryModel = 'qwen/qwen3-32b';
      const fallbackModel = 'llama-3.3-70b-versatile';

      const stylePrompt = stylePrompts[normalizedStyle] || stylePrompts.professional;
      
      // Combine global rules with style-specific prompt
      const fullSystemPrompt = `${globalSystemPrompt}\n\n${stylePrompt}`;

      // Helper function to make LLM API call
      const callLLM = async (model) => {
        // For non-default styles, DO NOT show the template - this prevents the LLM from copying it
        // Instead, only provide the placeholders and let it generate fresh content
        const userMessage = normalizedStyle === 'default' 
          ? `Reference template to format:

Subject: ${baseSubject}

Body:
${baseBody}

────────────────────────────────────────
YOUR TASK
────────────────────────────────────────
For DEFAULT style: ONLY format the text with proper paragraph breaks. DO NOT change any wording - keep the exact original text.`
          : `GENERATE A NEW EMAIL

Style: ${normalizedStyle.toUpperCase()}

Required placeholders you MUST include:
- [PROTECTED_FIRST_NAME] - recipient's first name
- [PROTECTED_LAST_NAME] - recipient's last name  
- [PROTECTED_REGISTRATION_LINK] - the URL (MUST be on its own line, never inline with text)

Write a natural, human-sounding email in ${normalizedStyle.toUpperCase()} style.

EMAIL STRUCTURE (follow this flow):
1. Greeting - personalized opening
2. Introduction - why you're reaching out (shareholder records, pre-verified account)
3. Body - details about what they can do (complete registration, access features)
4. Call to Action - the link ALONE on its own line
5. Important note - 30-day validity, what to do if unexpected
6. Closing - brief sign-off with "Euroland Team"

CRITICAL LINK RULE:
The link [PROTECTED_REGISTRATION_LINK] must ALWAYS be on its own line.
WRONG: "Click here to register: [PROTECTED_REGISTRATION_LINK] to get started"
CORRECT: 
"Click here to register:

[PROTECTED_REGISTRATION_LINK]

Once registered, you'll have access..."

Output format:
Subject:
<subject line>

Body:
<greeting>,

<introduction paragraph>

<body paragraph>

[PROTECTED_REGISTRATION_LINK]

<important note paragraph>

<closing>,
Euroland Team`;

        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: fullSystemPrompt
              },
              {
                role: 'user',
                content: userMessage
              },
            ],
            temperature: normalizedStyle === 'default' ? 0.3 : 0.85,
            max_tokens: 2000,
          }),
        });

        if (!r.ok) {
          const t = await r.text();
          const errorText = t.toLowerCase();
          const isRateLimit = r.status === 429 || 
                             errorText.includes('rate limit') || 
                             errorText.includes('quota') ||
                             errorText.includes('too many requests');
          
          if (isRateLimit) {
            throw new Error(`RATE_LIMIT:${r.status}:${t}`);
          }
          throw new Error(`Groq API error: ${r.status} - ${t}`);
        }

        return r;
      };

      // Debug logging
      console.log('LLM Adaptation Request:', {
        style: normalizedStyle,
        originalStyle: style,
        primaryModel: primaryModel,
        hasStylePrompt: !!stylePrompt
      });

      let r;
      let usedModel = primaryModel;
      let primaryRateLimited = false;
      let fallbackRateLimited = false;

      try {
        // Try primary model first
        r = await callLLM(primaryModel);
      } catch (primaryError) {
        const isPrimaryRateLimit = String(primaryError.message).startsWith('RATE_LIMIT:');
        primaryRateLimited = isPrimaryRateLimit;
        
        console.warn('Primary model failed, trying fallback:', {
          primaryModel,
          error: primaryError.message,
          isRateLimit: isPrimaryRateLimit,
          fallbackModel
        });
        
        // Fallback to secondary model
        try {
          usedModel = fallbackModel;
          r = await callLLM(fallbackModel);
          console.log('Fallback model succeeded:', { model: fallbackModel });
          
          // If primary was rate limited but fallback worked, continue processing
          // We'll mark it after parsing the response
          if (isPrimaryRateLimit) {
            // Continue to parse the response, but we'll mark it as using fallback
            // The rateLimitWarning will be set after parsing
          }
        } catch (fallbackError) {
          const isFallbackRateLimit = String(fallbackError.message).startsWith('RATE_LIMIT:');
          fallbackRateLimited = isFallbackRateLimit;
          
          console.error('Both models failed:', {
            primaryError: primaryError.message,
            fallbackError: fallbackError.message,
            primaryRateLimited,
            fallbackRateLimited
          });
          
          // If both are rate limited, return special indicator
          if (isPrimaryRateLimit && isFallbackRateLimit) {
            return { 
              subject: null, 
              body: null, 
              rateLimitWarning: 'both',
              usedModel: null 
            };
          }
          
          throw new Error(`Both LLM models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      }

      try {

        const data = await r.json();
        const adaptedContent = data?.choices?.[0]?.message?.content || `Subject: ${baseSubject}\n\nBody:\n${baseBody}`;
        
        // Debug logging
        console.log('LLM Response Received:', {
          style: normalizedStyle,
          model: usedModel,
          responseLength: adaptedContent.length,
          firstChars: adaptedContent.substring(0, 200)
        });
        
        const parsed = parseLLMResponse(adaptedContent);
        let adaptedSubject = parsed.subject || baseSubject;
        let adaptedBody = parsed.body || baseBody;

        // Debug logging
        console.log('LLM Parsed Result:', {
          style: normalizedStyle,
          subjectChanged: adaptedSubject !== baseSubject,
          bodyChanged: adaptedBody !== baseBody
        });

        // Structure the body with proper formatting
        adaptedBody = structureMessageBody(adaptedBody);
        
        // Fix duplicate "Hello" in greeting (common LLM issue)
        adaptedBody = adaptedBody.replace(/^Hello\s+Hello\s+/i, 'Hello ');

        // Check for missing placeholders and attempt recovery
        const requiredPlaceholders = {
          first_name: '[PROTECTED_FIRST_NAME]',
          last_name: '[PROTECTED_LAST_NAME]',
          registration_link: '[PROTECTED_REGISTRATION_LINK]',
          registration_id: '[PROTECTED_REGISTRATION_ID]'
        };

        const missingInBody = [];
        const missingInSubject = [];
        
        if (!String(adaptedBody).includes(requiredPlaceholders.first_name)) {
          missingInBody.push(requiredPlaceholders.first_name);
        }
        if (!String(adaptedBody).includes(requiredPlaceholders.registration_link)) {
          missingInBody.push(requiredPlaceholders.registration_link);
        }
        if (!String(adaptedSubject).includes(requiredPlaceholders.first_name)) {
          missingInSubject.push(requiredPlaceholders.first_name);
        }
        
        // Recovery mechanism: Re-insert missing placeholders
        if (missingInBody.length > 0 || missingInSubject.length > 0) {
          console.warn('Warning: Placeholders missing from LLM response:', {
            style: normalizedStyle,
            missingInBody,
            missingInSubject
          });
          
          // Try to recover by re-inserting placeholders
          if (missingInBody.includes(requiredPlaceholders.first_name)) {
            const greetingPattern = /(Hello|Hi|Dear)\s+[^,\n]+/i;
            if (greetingPattern.test(adaptedBody)) {
              adaptedBody = String(adaptedBody).replace(greetingPattern, (match) => {
                return match.replace(/(Hello|Hi|Dear)\s+[^,\n]+/i, '$1 [PROTECTED_FIRST_NAME]');
              });
              console.log('Recovered: Re-inserted [PROTECTED_FIRST_NAME] in greeting');
            } else {
              adaptedBody = `Hello [PROTECTED_FIRST_NAME],\n\n${adaptedBody}`;
              console.log('Recovered: Added greeting with [PROTECTED_FIRST_NAME] at start');
            }
          }
          
          if (missingInBody.includes(requiredPlaceholders.registration_link)) {
            // Simply append the link placeholder on its own line before the closing
            // Don't use hardcoded text - just insert the placeholder
            const closingPatterns = [
              /(Best regards|Sincerely|Warm regards|Kind regards|Regards|Cheers|Thank you|Thanks),?\s*\n/i,
              /\n(Euroland Team)/i
            ];
            
            let inserted = false;
            for (const pattern of closingPatterns) {
              if (pattern.test(adaptedBody) && !inserted) {
                adaptedBody = String(adaptedBody).replace(pattern, (match) => {
                  inserted = true;
                  return `\n\n[PROTECTED_REGISTRATION_LINK]\n\n${match}`;
                });
                console.log('Recovered: Inserted [PROTECTED_REGISTRATION_LINK] before closing');
                break;
              }
            }
            
            if (!inserted) {
              // Just append the link on its own line at the end
              adaptedBody = String(adaptedBody).trim() + '\n\n[PROTECTED_REGISTRATION_LINK]';
              console.log('Recovered: Appended [PROTECTED_REGISTRATION_LINK] at end');
            }
          }
          
          if (missingInSubject.includes(requiredPlaceholders.first_name)) {
            if (String(baseSubject).includes('[PROTECTED_FIRST_NAME]')) {
              adaptedSubject = baseSubject;
              console.log('Recovered: Used base subject with [PROTECTED_FIRST_NAME]');
            }
          }
          
          // Final check: If critical placeholders are still missing, fallback
          const stillMissing = [
            requiredPlaceholders.first_name,
            requiredPlaceholders.registration_link
          ].filter(p => !String(adaptedBody).includes(p));
          
          if (stillMissing.length > 0) {
            console.error('Critical: Could not recover missing placeholders. Falling back to original template.', {
              style: normalizedStyle,
              stillMissing
            });
            return { subject: baseSubject, body: structureMessageBody(baseBody) };
          }
          
          console.log('Recovery successful: All placeholders restored');
        }
        
        console.log('LLM Adaptation Success:', {
          style: normalizedStyle,
          finalSubjectLength: adaptedSubject.length,
          finalBodyLength: adaptedBody.length
        });
        
        return { subject: adaptedSubject, body: adaptedBody };
      } catch (parseError) {
        console.error('Error parsing LLM response:', {
          style: normalizedStyle,
          error: parseError.message || parseError
        });
        return { subject: baseSubject, body: baseBody };
      }
    };

    // Get template content from local template
    let templateSubject = invitationTemplate.subject;
    let templateBodyText = '';

    if (!customSubject || !customBody) {
      const templateHtmlContent = invitationTemplate.html;
      // Convert HTML to plain text
      templateBodyText = htmlToText(templateHtmlContent);
      // Remove subject line from body if it appears
      templateBodyText = cleanBodyText(templateBodyText, templateSubject);
      if (!templateBodyText) {
        res.status(500).json({ error: 'Template content is empty' });
        return;
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const registrationLink = 'https://eurohub.eurolandir.net/'; // Fixed demo link

    const actualFirstName = firstName || '';
    const actualLastName = lastName || '';
    const actualRegistrationId =
      registrationId && String(registrationId).length > 6 ? String(registrationId).slice(-6) : registrationId || '';

    let finalSubject = '';
    let finalBody = '';

    if (customSubject && customBody) {
      // Use custom subject and body, but replace variables if they exist
      finalSubject = String(customSubject)
        .replace(/\{\{ first_name \}\}/gi, actualFirstName)
        .replace(/\{\{firstName\}\}/gi, actualFirstName)
        .replace(/\{\{ last_name \}\}/gi, actualLastName)
        .replace(/\{\{lastName\}\}/gi, actualLastName);
      
      finalBody = String(customBody)
        .replace(/\{\{ first_name \}\}/gi, actualFirstName)
        .replace(/\{\{ last_name \}\}/gi, actualLastName)
        .replace(/\{\{ registration_link \}\}/gi, registrationLink)
        .replace(/\{\{ registration_id \}\}/gi, actualRegistrationId)
        .replace(/\{\{firstName\}\}/gi, actualFirstName)
        .replace(/\{\{lastName\}\}/gi, actualLastName)
        .replace(/\{\{registrationLink\}\}/gi, registrationLink)
        .replace(/\{\{registrationId\}\}/gi, actualRegistrationId);
      
      // Structure the custom body
      finalBody = structureMessageBody(finalBody);
    } else {
      // For default style, use template directly with proper formatting (no LLM needed)
      if (String(messageStyle).toLowerCase().trim() === 'default') {
        // Replace variables directly in the template
        finalSubject = String(templateSubject)
          .replace(/\{\{ first_name \}\}/gi, actualFirstName)
          .replace(/\{\{firstName\}\}/gi, actualFirstName);
        
        finalBody = String(templateBodyText)
          .replace(/\{\{ first_name \}\}/gi, actualFirstName)
          .replace(/\{\{ registration_link \}\}/gi, registrationLink)
          .replace(/\{\{ registration_id \}\}/gi, actualRegistrationId)
          .replace(/\{\{firstName\}\}/gi, actualFirstName)
          .replace(/\{\{registrationLink\}\}/gi, registrationLink)
          .replace(/\{\{registrationId\}\}/gi, actualRegistrationId);
        
        // Structure the body with proper formatting
        finalBody = structureMessageBody(finalBody);
      } else {
        // Other styles use LLM for style adaptation
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
          res.status(500).json({ error: 'Missing GROQ_API_KEY for message structuring' });
          return;
        }

        // Replace variables with protected placeholders in subject and body
        const protectedSubject = templateSubject
          .replace(/\{\{ first_name \}\}/gi, '[PROTECTED_FIRST_NAME]')
          .replace(/\{\{firstName\}\}/gi, '[PROTECTED_FIRST_NAME]')
          .replace(/\{\{ last_name \}\}/gi, '[PROTECTED_LAST_NAME]')
          .replace(/\{\{lastName\}\}/gi, '[PROTECTED_LAST_NAME]');
        
        const protectedBody = templateBodyText
          .replace(/\{\{ first_name \}\}/gi, '[PROTECTED_FIRST_NAME]')
          .replace(/\{\{ last_name \}\}/gi, '[PROTECTED_LAST_NAME]')
          .replace(/\{\{ registration_link \}\}/gi, '[PROTECTED_REGISTRATION_LINK]')
          .replace(/\{\{ registration_id \}\}/gi, '[PROTECTED_REGISTRATION_ID]')
          .replace(/\{\{firstName\}\}/gi, '[PROTECTED_FIRST_NAME]')
          .replace(/\{\{lastName\}\}/gi, '[PROTECTED_LAST_NAME]')
          .replace(/\{\{registrationLink\}\}/gi, '[PROTECTED_REGISTRATION_LINK]')
          .replace(/\{\{registrationId\}\}/gi, '[PROTECTED_REGISTRATION_ID]');

        // Adapt/style using Groq
        console.log('Calling adaptMessageStyle with:', {
          messageStyle: messageStyle,
          styleType: typeof messageStyle,
          protectedSubjectLength: protectedSubject.length,
          protectedBodyLength: protectedBody.length
        });
        
        const adapted = await adaptMessageStyle(protectedSubject, protectedBody, messageStyle, groqKey);
        
        // Check for rate limit warnings
        if (adapted.rateLimitWarning) {
          if (adapted.rateLimitWarning === 'both') {
            // Both models rate limited - use default template
            finalSubject = String(templateSubject)
              .replace(/\{\{ first_name \}\}/gi, actualFirstName)
              .replace(/\{\{firstName\}\}/gi, actualFirstName);
            
            finalBody = String(templateBodyText)
              .replace(/\{\{ first_name \}\}/gi, actualFirstName)
              .replace(/\{\{ registration_link \}\}/gi, registrationLink)
              .replace(/\{\{ registration_id \}\}/gi, actualRegistrationId)
              .replace(/\{\{firstName\}\}/gi, actualFirstName)
              .replace(/\{\{registrationLink\}\}/gi, registrationLink)
              .replace(/\{\{registrationId\}\}/gi, actualRegistrationId);
            
            finalBody = structureMessageBody(finalBody);
            
            // Return error response with rate limit indicator
            if (preview) {
              res.status(200).json({
                ok: true,
                subject: finalSubject,
                body: finalBody,
                registrationLink,
                expiresAt: expiresAt.toISOString(),
                rateLimitError: 'both',
                message: 'Both LLM models are currently unavailable due to rate limits. Using default template.'
              });
              return;
            }
          } else if (adapted.rateLimitWarning === 'primary') {
            // Primary rate limited but fallback worked - continue normally but return warning
            console.log('Received adapted message (fallback model):', {
              messageStyle: messageStyle,
              adaptedSubjectLength: adapted.subject.length,
              adaptedBodyLength: adapted.body.length
            });
            
            // Replace protected placeholders with actual values
            finalSubject = String(adapted.subject)
              .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
              .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName);
            
            finalBody = String(adapted.body)
              .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
              .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName)
              .replace(/\[PROTECTED_REGISTRATION_LINK\]/g, registrationLink)
              .replace(/\[PROTECTED_REGISTRATION_ID\]/g, actualRegistrationId);
            
            // Return with warning indicator for preview
            if (preview) {
              res.status(200).json({
                ok: true,
                subject: finalSubject,
                body: finalBody,
                registrationLink,
                expiresAt: expiresAt.toISOString(),
                rateLimitWarning: 'primary',
                message: 'Primary model unavailable. Using fallback model.'
              });
              return;
            }
          }
        } else {
          // Normal flow - no rate limits
          console.log('Received adapted message:', {
            messageStyle: messageStyle,
            adaptedSubjectLength: adapted.subject.length,
            adaptedBodyLength: adapted.body.length
          });
          
          // Replace protected placeholders with actual values
          finalSubject = String(adapted.subject)
            .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
            .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName);
          
          finalBody = String(adapted.body)
            .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
            .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName)
            .replace(/\[PROTECTED_REGISTRATION_LINK\]/g, registrationLink)
            .replace(/\[PROTECTED_REGISTRATION_ID\]/g, actualRegistrationId);
        }
      }
    }

    // Clean up duplicate words before converting to HTML
    // Fix duplicate "Hello" and other common duplicates
    finalBody = String(finalBody).replace(/(Hello\s+)+/gi, 'Hello ');
    finalBody = String(finalBody).replace(/\b(\w+)(\s+\1\b)+/gi, '$1'); // Remove any repeated words

    // Create plain text version (better deliverability)
    const finalBodyText = String(finalBody)
      .replace(/\n\n/g, '\n\n') // Preserve paragraph breaks
      .replace(new RegExp(`(${escapeRegex(registrationLink)})`, 'g'), registrationLink);

    // Convert body to HTML for email sending (simple formatting)
    // Convert newlines to HTML breaks and format links
    let finalBodyHtml = String(finalBody)
      .replace(/\n\n/g, '</p><p>') // Double newlines = paragraphs
      .replace(/\n/g, '<br>') // Single newlines = line breaks
      .replace(new RegExp(`(${escapeRegex(registrationLink)})`, 'g'), 
        `<a href="${registrationLink}">${registrationLink}</a>`);
    
    // Simple email HTML structure
    finalBodyHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>${finalBodyHtml}</p>`;
    
    // Add email tracking (only if not in preview mode and we have registrationId)
    if (!preview && registrationId) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const trackingToken = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add tracking pixel (1x1 transparent image)
      const trackingPixelUrl = `${baseUrl}/api/track-email-open?applicantId=${encodeURIComponent(registrationId)}&token=${trackingToken}`;
      const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
      
      // Wrap registration link with click tracking
      const trackedRegistrationLink = `${baseUrl}/api/track-link-click?applicantId=${encodeURIComponent(registrationId)}&token=${trackingToken}&redirect=${encodeURIComponent(registrationLink)}`;
      
      // Replace the registration link in the HTML with tracked link
      finalBodyHtml = finalBodyHtml.replace(
        new RegExp(escapeRegex(registrationLink), 'g'),
        trackedRegistrationLink
      );
      
      // Add tracking pixel before closing body tag
      finalBodyHtml = finalBodyHtml + trackingPixel;
    }
    
    finalBodyHtml = finalBodyHtml + '</body></html>';

    if (preview) {
      res.status(200).json({
        ok: true,
        subject: finalSubject,
        body: finalBody,
        registrationLink,
        expiresAt: expiresAt.toISOString(),
      });
      return;
    }

    // Get sender from environment or use defaults
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'norelyn.golingan@eirl.ink';
    const fromName = process.env.RESEND_FROM_NAME || 'EurolandHUB';
    const from = `${fromName} <${fromEmail}>`;

    // Log the email details (without full HTML content for readability)
    console.log('Sending email via Resend:', {
      to: String(toEmail).trim(),
      subject: finalSubject,
      htmlContentLength: finalBodyHtml.length,
      apiKeyPresent: !!resendApiKey,
    });

    // Clean up any duplicate words in the final body HTML before sending
    // Fix duplicate "Hello" if it still exists
    finalBodyHtml = String(finalBodyHtml).replace(/(Hello\s+)+/gi, 'Hello ');
    
    const { data, error } = await resend.emails.send({
      from,
      to: String(toEmail).trim(),
      subject: finalSubject,
      html: finalBodyHtml,
      text: finalBodyText, // Plain text version for better deliverability
      reply_to: fromEmail,
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'invitation' },
        { name: 'message_style', value: String(messageStyle) }
      ],
      headers: {
        'X-Entity-Ref-ID': String(registrationId || 'unknown'),
        'X-Email-Type': 'account-invitation',
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    if (error) {
      console.error('Resend email send failed:', {
        error: error,
        toEmail: String(toEmail).trim(),
        subject: finalSubject,
      });
      res.status(502).json({ 
        error: 'Resend send failed', 
        details: typeof error === 'string' ? error : JSON.stringify(error)
      });
      return;
    }

    // Log successful email sending
    console.log('Resend email sent successfully:', {
      messageId: data?.id,
      toEmail: String(toEmail).trim(),
      subject: finalSubject,
      registrationLink
    });

    // Update Firebase when email is sent (only if we have registrationId)
    // Following investor provisioning workflow mapping:
    // SENT_EMAIL -> PENDING (accountStatus), ACTIVE (systemStatus)
    if (registrationId) {
      try {
        // Dynamic import for TypeScript module (tsx can handle .ts extensions)
        const { applicantService } = await import('./lib/firestore-service.ts');
        
        // First, try to find applicant by ID (in case registrationId is the applicant.id)
        let existingApplicant = await applicantService.getById(registrationId);
        
        // If not found, search by registrationId field (holdingId) or email
        if (!existingApplicant) {
          const allApplicants = await applicantService.getAll();
          existingApplicant = allApplicants.find(a => 
            a.registrationId === registrationId || 
            (a.email && a.email.toLowerCase() === String(toEmail).trim().toLowerCase())
          ) || null;
        }
        
        if (!existingApplicant) {
          // If applicant doesn't exist yet (e.g., IRO hasn't clicked Save & Exit),
          // create a pre-verified applicant now so the Pre-verified table/status mapping is accurate.
          const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const fullName = `${actualFirstName || ''} ${actualLastName || ''}`.trim() || 'Unknown';

          await applicantService.create({
            id: newId,
            fullName,
            email: String(toEmail).trim().toLowerCase(),
            phoneNumber: undefined,
            location: undefined,
            submissionDate: new Date().toISOString().split('T')[0],
            lastActive: 'Just now',
            status: 'PENDING',
            idDocumentUrl: '',
            taxDocumentUrl: '',
            // Pre-verified workflow fields
            workflowStage: 'SENT_EMAIL',
            accountStatus: 'PENDING',
            systemStatus: 'ACTIVE',
            statusInFrontend: '',
            isPreVerified: true,
            registrationId: actualRegistrationId || registrationId || undefined,
            // Email tracking fields
            emailSentAt: new Date().toISOString(),
            emailSentCount: 1,
          });

          console.log('Created pre-verified applicant on email send:', newId);
        } else {
          // Get current email sent count or default to 0
          const currentEmailSentCount = existingApplicant.emailSentCount || 0;
          
          await applicantService.update(existingApplicant.id, {
            emailSentAt: new Date().toISOString(),
            emailSentCount: currentEmailSentCount + 1, // Increment send count
            workflowStage: 'SENT_EMAIL',
            systemStatus: 'ACTIVE',
            accountStatus: 'PENDING', // Account status remains PENDING until claimed
          });
          console.log('Updated email sent timestamp and status in Firebase for applicant:', existingApplicant.id);
        }
      } catch (firebaseError) {
        console.error('Failed to update email sent timestamp in Firebase:', firebaseError);
        // Don't fail the request if Firebase update fails
      }
    }

    res.status(200).json({
      ok: true,
      registrationLink,
      expiresAt: expiresAt.toISOString(),
      message: 'Email sent successfully to ' + String(toEmail).trim()
    });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', detail: String(e?.message ?? e) });
  }
});

/**
 * GET /api/track-email-open
 * Local dev implementation for tracking email opens via tracking pixel
 */
app.get('/api/track-email-open', async (req, res) => {
  try {
    const { applicantId, token } = req.query;

    if (!applicantId || !token) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
      return;
    }

        // Dynamic import for TypeScript module (tsx can handle .ts extensions)
        const { applicantService } = await import('./lib/firestore-service.ts');
        const applicant = await applicantService.getById(String(applicantId));
    if (applicant) {
      const now = new Date().toISOString();
      const updates = {
        emailOpenedCount: (applicant.emailOpenedCount || 0) + 1,
      };
      
      if (!applicant.emailOpenedAt) {
        updates.emailOpenedAt = now;
      }
      
      await applicantService.update(String(applicantId), updates);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  } catch (error) {
    console.error('Error tracking email open:', error);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  }
});

/**
 * GET /api/track-link-click
 * Local dev implementation for tracking link clicks
 */
app.get('/api/track-link-click', async (req, res) => {
  try {
    const { applicantId, token, redirect } = req.query;

    if (!applicantId || !token || !redirect) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

        // Dynamic import for TypeScript module (tsx can handle .ts extensions)
        const { applicantService } = await import('./lib/firestore-service.ts');
        const applicant = await applicantService.getById(String(applicantId));
    if (applicant) {
      const now = new Date().toISOString();
      const updates = {
        linkClickedCount: (applicant.linkClickedCount || 0) + 1,
      };
      
      if (!applicant.linkClickedAt) {
        updates.linkClickedAt = now;
      }
      
      await applicantService.update(String(applicantId), updates);
    }

    res.redirect(302, decodeURIComponent(String(redirect)));
  } catch (error) {
    console.error('Error tracking link click:', error);
    res.redirect(302, decodeURIComponent(String(req.query.redirect || 'https://eurohub.eurolandir.net/')));
  }
});

/**
 * POST /api/send-email-otp
 * Local dev implementation of the Vercel serverless function in `api/send-email-otp.ts`.
 */
app.post('/api/send-email-otp', async (req, res) => {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      res.status(500).json({ error: 'Missing RESEND_API_KEY on server' });
      return;
    }

    const { toEmail, firstName } = req.body || {};
    if (!toEmail) {
      res.status(400).json({ error: 'toEmail is required' });
      return;
    }

    // Generate 6-digit OTP code
    const generate6DigitCode = () => {
      const n = Math.floor(Math.random() * 1_000_000);
      return String(n).padStart(6, '0');
    };

    const addHoursIso = (fromIso, hours) => {
      const t = new Date(fromIso).getTime();
      return new Date(t + hours * 60 * 60 * 1000).toISOString();
    };

    const issuedAt = new Date().toISOString();
    const expiresAt = addHoursIso(issuedAt, 1); // 1 hour validity
    const code = generate6DigitCode();

    // OTP template
    const otpTemplate = {
      subject: 'Verify your email address',
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>Hello {{ first_name }},</p>
  <p>Your email verification code is: {{ otp_code }}</p>
  <p>If you did not request this verification, please ignore this email.</p>
  <p>Thanks,<br>Euroland Team</p>
</body>
</html>`,
    };

    // Replace variables in template
    const replaceVariables = (template, vars) => {
      let result = template;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
      }
      return result;
    };

    const htmlContent = replaceVariables(otpTemplate.html, {
      first_name: firstName || '',
      otp_code: code,
    });

    const subject = replaceVariables(otpTemplate.subject, {
      first_name: firstName || '',
    });

    // Create plain text version
    const textContent = `Hello ${firstName || ''},\n\nYour email verification code is: ${code}\n\nIf you did not request this verification, please ignore this email.\n\nThanks,\nEuroland Team`;

    // Get sender from environment
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'norelyn.golingan@eirl.ink';
    const fromName = process.env.RESEND_FROM_NAME || 'EurolandHUB';
    const from = `${fromName} <${fromEmail}>`;

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from,
      to: String(toEmail).trim(),
      subject,
      html: htmlContent,
      text: textContent,
      reply_to: fromEmail,
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'otp' }
      ],
      headers: {
        'List-Unsubscribe': `<mailto:${fromEmail}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    if (error) {
      console.error('Resend OTP email send failed:', error);
      res.status(502).json({
        error: 'Resend send failed',
        details: typeof error === 'string' ? error : JSON.stringify(error)
      });
      return;
    }

    console.log('OTP email sent successfully:', {
      messageId: data?.id,
      toEmail: String(toEmail).trim(),
      code: code // Log for testing purposes
    });

    res.status(200).json({
      ok: true,
      issuedAt,
      expiresAt,
      // NOTE: In production, do NOT return the code
      code: code // Only for testing
    });
  } catch (e) {
    console.error('Error sending OTP email:', e);
    res.status(500).json({ error: 'Unexpected error sending email', detail: String(e?.message ?? e) });
  }
});

// POST /api/parse-document endpoint
app.post('/api/parse-document', (req, res) => {
  console.log('📥 Received request to /api/parse-document');
  
  // Parse FormData using busboy
  const busboy = Busboy({ headers: req.headers });
  let fileBuffer = null;
  let fileName = 'document';
  let fileType = '';

  busboy.on('file', (name, file, info) => {
    const { filename, mimeType } = info;
    fileName = filename || 'document';
    fileType = mimeType || '';
    
    console.log(`📄 Processing file: ${fileName} (${fileType})`);
    
    const chunks = [];
    file.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`✅ File received: ${fileName} (${fileBuffer.length} bytes)`);
    });
  });

  busboy.on('finish', async () => {
    if (!fileBuffer) {
      return res.status(400).json({ 
        success: false,
        error: 'No file provided' 
      });
    }

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      return res.status(400).json({
        success: false,
        error: `File size exceeds 10MB limit. Your file is ${fileSizeMB}MB.`
      });
    }

    // Validate file type - Only allow CSV
    const validTypes = ['text/csv'];
    const validExtensions = ['.csv'];
    const isValidType = validTypes.includes(fileType.toLowerCase());
    const isValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExtension) {
      return res.status(400).json({
        success: false,
        error: 'Only CSV files are allowed. Please download the template, fill it in, and upload it.'
      });
    }

    // Parse CSV file locally
    console.log('📊 Parsing CSV file locally');
    const csvText = fileBuffer.toString('utf-8');
    
    if (!csvText.trim()) {
      return res.status(200).json({
        success: true,
        csvText: '',
        metadata: {
          fileName,
          fileType: 'text/csv',
          fileSize: fileBuffer.length,
        },
      });
    }

    // Return CSV text directly (no markdown conversion)
    return res.status(200).json({
      success: true,
      csvText: csvText,
      metadata: {
        fileName,
        fileType: 'text/csv',
        fileSize: fileBuffer.length,
      },
    });
  });

  busboy.on('error', (err) => {
    console.error('❌ Busboy error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to parse file upload',
      detail: err.message,
    });
  });

  // Pipe the request to busboy
  req.pipe(busboy);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📄 Parse endpoint: http://localhost:${PORT}/api/parse-document`);
  console.log(`✅ CORS enabled for: http://localhost:3000`);
});

