import type { VercelRequest, VercelResponse } from '@vercel/node';
import { invitationTemplate } from '../lib/email-templates.js';

/**
 * Convert HTML to plain text while preserving paragraph structure.
 * (Small utility copy to keep this endpoint lightweight.)
 */
function htmlToText(html: string): string {
  if (!html) return '';

  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
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
  text = text.replace(/<br>/gi, '\n');

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

function cleanBodyText(body: string, subject: string): string {
  if (!body || !subject) return body;
  const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const subjectPattern = new RegExp(`^\\s*${escapedSubject}\\s*[\\n\\r\\s]*`, 'i');
  return body.replace(subjectPattern, '').replace(/^Subject:\s*[^\n\r]*[\n\r\s]*/i, '').trim();
}

function structureMessageBody(body: string): string {
  return String(body).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parse LLM response to extract subject and body
 */
function parseLLMResponse(response: string): { subject: string; body: string } {
  // Try to find Subject: line
  const subjectMatch = response.match(/Subject:\s*(.+?)(?:\n|$)/i);
  
  // Try multiple patterns to find Body
  // Pattern 1: Body: followed by content until end or double newline
  let bodyMatch = response.match(/Body:\s*([\s\S]+?)(?:\n\n\n|$)/i);
  
  // Pattern 2: Body: followed by content until end
  if (!bodyMatch) {
    bodyMatch = response.match(/Body:\s*([\s\S]+)/i);
  }
  
  // Pattern 3: If no Body: label, look for content after Subject:
  if (!bodyMatch && subjectMatch) {
    const afterSubject = response.substring(subjectMatch.index! + subjectMatch[0].length);
    bodyMatch = [null, afterSubject.trim()];
  }
  
  // Pattern 4: If no Subject: found, assume entire response is body
  if (!bodyMatch && !subjectMatch) {
    bodyMatch = [null, response.trim()];
  }
  
  const subject = subjectMatch ? subjectMatch[1].trim() : '';
  const body = bodyMatch ? bodyMatch[1].trim() : response.trim();
  
  return { subject, body };
}

/**
 * Adapt message style using Groq models while preserving protected placeholders
 * - Formal & Professional: Llama 3.3 70B Versatile
 * - Casual & Friendly: Qwen2.5 32B Instruct
 * - Default: Uses LLM for structuring only (no style change)
 * Returns both subject and body separately
 */
async function adaptMessageStyle(
  baseSubject: string,
  baseBody: string,
  style: string, 
  apiKey: string
): Promise<{ subject: string; body: string }> {
  
  const normalizedStyle = style.toLowerCase().trim();
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
  const stylePrompts: Record<string, string> = {
    default: `STYLE: DEFAULT

For "default" style, you must ONLY structure the message with proper paragraph breaks. 
DO NOT change any wording, tone, or phrasing. 
Keep the exact original text from the template, just format it properly with correct line breaks.`,
    
    formal: `STYLE: FORMAL

Apply a FORMAL tone with these characteristics:
- Very polite and structured language
- Business-formal vocabulary
- NO contractions (use "do not" not "don't", "you are" not "you're")
- Formal phrases: "We are pleased to inform you" instead of "You have been identified"
- "We extend an invitation" instead of "you are invited"
- "Access the link" or "utilize the provided link" instead of "click the link"
- Complete sentences with formal structure
- Suitable for regulated financial communications
- Respectful and neutral tone

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    
    professional: `STYLE: PROFESSIONAL

Apply a PROFESSIONAL tone with these characteristics:
- Polished, investor-relations appropriate language
- Clear, confident, and courteous
- Professional phrases: "We are pleased to" instead of "You have been"
- "We invite you" or "we're pleased to invite you"
- "Use the link" or "access your account via the link"
- Well-structured sentences
- Business-appropriate but not overly stiff
- Investor-focused and polished

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    
    casual: `STYLE: CASUAL

Apply a CASUAL tone with these characteristics:
- Friendly, conversational language
- Shorter sentences where appropriate
- Relaxed phrasing while staying respectful
- Natural contractions (e.g., "you're", "we've", "it's")
- Approachable and less formal
- "We found you in our records" instead of "You have been identified"
- "we'd like to invite you" or "we're inviting you"
- "just click the link" or "tap the link"
- Still professional but conversational

REQUIRED: The wording MUST be different from the input. Rewrite actively.`,
    
    friendly: `STYLE: FRIENDLY

Apply a FRIENDLY and WELCOMING tone with these characteristics:
- Warm, approachable, and encouraging language
- Polite and reassuring
- Welcoming phrases: "We're excited to" instead of "You have been"
- "We're happy to let you know" or "Great news!"
- "we'd love to invite you" or "we're excited to invite you"
- "simply click the link" or "go ahead and click the link"
- Personal and genuine
- Makes recipient feel valued and welcomed

REQUIRED: The wording MUST be different from the input. Rewrite actively.`
  };

  // Model configuration: Primary and Fallback
  const primaryModel = 'qwen/qwen3-32b';
  const fallbackModel = 'llama-3.3-70b-versatile';

  const stylePrompt = stylePrompts[normalizedStyle] || stylePrompts['professional'];
  
  // Combine global rules with style-specific prompt
  const fullSystemPrompt = `${globalSystemPrompt}\n\n${stylePrompt}`;

  // Helper function to make LLM API call
  const callLLM = async (model: string) => {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
            content: normalizedStyle === 'default' 
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

Required placeholders you MUST include in your email:
- [PROTECTED_FIRST_NAME] - the recipient's first name
- [PROTECTED_LAST_NAME] - the recipient's last name
- [PROTECTED_REGISTRATION_LINK] - the registration URL (must appear on its own line)

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
Euroland Team`
          }
        ],
        temperature: normalizedStyle === 'default' ? 0.3 : 0.85,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    return response;
  };

  // Debug logging
  console.log('LLM Adaptation Request:', {
    style: normalizedStyle,
    primaryModel: primaryModel,
    hasStylePrompt: !!stylePrompt,
    baseSubjectLength: baseSubject.length,
    baseBodyLength: baseBody.length
  });

  let response;
  let usedModel = primaryModel;
  
  try {
    // Try primary model first
    response = await callLLM(primaryModel);
  } catch (primaryError: any) {
    console.warn('Primary model failed, trying fallback:', {
      primaryModel,
      error: primaryError.message,
      fallbackModel
    });
    
    // Fallback to secondary model
    try {
      usedModel = fallbackModel;
      response = await callLLM(fallbackModel);
      console.log('Fallback model succeeded:', { model: fallbackModel });
    } catch (fallbackError: any) {
      console.error('Both models failed:', {
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      throw new Error(`Both LLM models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
    }
  }

  try {
    const data = await response.json();
    const adaptedContent = data.choices[0]?.message?.content || `Subject: ${baseSubject}\n\nBody:\n${baseBody}`;

    // Debug logging
    console.log('LLM Response Received:', {
      style: normalizedStyle,
      model: usedModel,
      responseLength: adaptedContent.length,
      firstChars: adaptedContent.substring(0, 500)
    });
    
    // If the response is suspiciously short (less than 50 chars), it's likely incomplete
    if (adaptedContent.length < 50) {
      console.warn('LLM response is suspiciously short, using fallback');
      return { subject: baseSubject, body: baseBody };
    }

    // Parse the LLM response to extract subject and body
    const parsed = parseLLMResponse(adaptedContent);
    let adaptedSubject = parsed.subject || baseSubject;
    let adaptedBody = parsed.body || baseBody;

    // Safety check: If parsed body is too short (less than base body length), use base body
    if (adaptedBody.length < baseBody.length * 0.5) {
      console.warn('Parsed body is too short, using base body as fallback', {
        parsedLength: adaptedBody.length,
        baseLength: baseBody.length,
      });
      adaptedBody = baseBody;
    }

    // Structure the body with proper formatting
    adaptedBody = structureMessageBody(adaptedBody);
    
    // Fix duplicate "Hello" in greeting (common LLM issue)
    adaptedBody = adaptedBody.replace(/^(Hello\s+)+/i, 'Hello ');
    adaptedBody = adaptedBody.replace(/Hello\s+Hello\s+/gi, 'Hello ');

    // Safety check: Verify placeholders still exist
    const requiredPlaceholders = {
      first_name: '[PROTECTED_FIRST_NAME]',
      last_name: '[PROTECTED_LAST_NAME]',
      registration_link: '[PROTECTED_REGISTRATION_LINK]',
    };

    // Check for missing placeholders
    const missingInBody: string[] = [];
    
    if (!adaptedBody.includes(requiredPlaceholders.first_name)) {
      missingInBody.push(requiredPlaceholders.first_name);
    }
    if (!adaptedBody.includes(requiredPlaceholders.registration_link)) {
      missingInBody.push(requiredPlaceholders.registration_link);
    }
    
    // Recovery mechanism: Re-insert missing placeholders
    if (missingInBody.length > 0) {
      console.warn(`Warning: Placeholders missing from LLM response:`, {
        style: normalizedStyle,
        missingInBody,
      });
      
      // Try to recover by re-inserting placeholders
      if (missingInBody.includes(requiredPlaceholders.first_name)) {
        const greetingPatterns = [
          /^(Hello|Hi|Dear)\s+\[PROTECTED_LAST_NAME\]/i,
          /^(Hello|Hi|Dear)\s+[^,\n]+/i,
          /^(Hello|Hi|Dear)\s*,/i,
        ];
        
        let inserted = false;
        for (const pattern of greetingPatterns) {
          if (pattern.test(adaptedBody) && !inserted) {
            adaptedBody = adaptedBody.replace(pattern, (match) => {
              inserted = true;
              if (match.includes('[PROTECTED_LAST_NAME]')) {
                return match.replace('[PROTECTED_LAST_NAME]', '[PROTECTED_FIRST_NAME]');
              } else if (match.endsWith(',')) {
                return match.replace(/(Hello|Hi|Dear)\s*,/i, '$1 [PROTECTED_FIRST_NAME],');
              } else {
                return match.replace(/(Hello|Hi|Dear)\s+[^,\n]+/i, '$1 [PROTECTED_FIRST_NAME]');
              }
            });
            break;
          }
        }
        
        if (!inserted) {
          adaptedBody = `Hello [PROTECTED_FIRST_NAME],\n\n${adaptedBody}`;
        }
      }
      
      if (missingInBody.includes(requiredPlaceholders.registration_link)) {
        const linkPatterns = [
          /(visit|access|click|use|follow|open)\s+(the\s+)?(link|URL|website|platform)/i,
          /(link|URL|website|platform)\s+(below|above|here|provided)/i,
        ];
        
        let inserted = false;
        for (const pattern of linkPatterns) {
          if (pattern.test(adaptedBody) && !inserted) {
            adaptedBody = adaptedBody.replace(pattern, (match) => {
              inserted = true;
              return `${match} [PROTECTED_REGISTRATION_LINK]`;
            });
            break;
          }
        }
        
        if (!inserted) {
          const registrationParagraph = `\n\nTo claim your verified account, please visit: [PROTECTED_REGISTRATION_LINK]\n`;
          if (adaptedBody.includes('Important:')) {
            adaptedBody = adaptedBody.replace(/(\n\n)?Important:/i, `${registrationParagraph}\n\nImportant:`);
          } else {
            adaptedBody = adaptedBody + registrationParagraph;
          }
        }
      }
      
      // Final check: If critical placeholders are still missing, fallback
      const stillMissing = [
        requiredPlaceholders.first_name,
        requiredPlaceholders.registration_link
      ].filter(p => !adaptedBody.includes(p));
      
      if (stillMissing.length > 0) {
        console.error('Critical: Could not recover missing placeholders. Falling back to original template.', {
          style: normalizedStyle,
          stillMissing
        });
        return { subject: baseSubject, body: structureMessageBody(baseBody) };
      }
    }

    console.log('LLM Adaptation Success:', {
      style: normalizedStyle,
      finalSubjectLength: adaptedSubject.length,
      finalBodyLength: adaptedBody.length
    });

    return { subject: adaptedSubject, body: adaptedBody };
  } catch (error: any) {
    console.error('Error adapting message with Groq:', {
      style: normalizedStyle,
      error: error.message,
      stack: error.stack
    });
    // Fallback to original template on error
    return { subject: baseSubject, body: baseBody };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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

    // Other styles: use LLM but keep placeholders protected
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      // Fallback to default template if no key
      console.warn('Missing GROQ_API_KEY; using default template.');
      res.status(200).json({
        ok: true,
        subject: templateSubject,
        body: structureMessageBody(templateBodyText),
        warning: 'Missing GROQ_API_KEY; using default template.',
      });
      return;
    }

    // Protect placeholders before sending to LLM
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
      .replace(/\{\{registrationLink\}\}/gi, '[PROTECTED_REGISTRATION_LINK]');

    // Adapt message style using LLM
    const adapted = await adaptMessageStyle(protectedSubject, protectedBody, messageStyle, groqKey);

    // Map protected placeholders back to template format {{ ... }}
    const finalSubject = adapted.subject
      .replace(/\[PROTECTED_FIRST_NAME\]/g, '{{ first_name }}')
      .replace(/\[PROTECTED_LAST_NAME\]/g, '{{ last_name }}');

    const finalBody = adapted.body
      .replace(/\[PROTECTED_FIRST_NAME\]/g, '{{ first_name }}')
      .replace(/\[PROTECTED_LAST_NAME\]/g, '{{ last_name }}')
      .replace(/\[PROTECTED_REGISTRATION_LINK\]/g, '{{ registration_link }}');

    res.status(200).json({
      ok: true,
      subject: finalSubject,
      body: finalBody,
    });
  } catch (error: any) {
    console.error('Error generating invitation message:', error);
    res.status(500).json({
      error: 'Failed to generate invitation message',
      message: error.message,
    });
  }
}
