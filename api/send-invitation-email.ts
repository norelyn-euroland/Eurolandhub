import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import { invitationTemplate } from '../lib/email-templates';
import { sendEmail } from '../lib/resend-service';

/**
 * Generate secure token for registration link
 */
function generateSecureToken(): string {
  return `${Date.now()}-${randomBytes(16).toString('hex')}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert HTML to plain text while preserving paragraph structure
 * Removes <style> tags, CSS, but keeps paragraph breaks and line structure
 */
function htmlToText(html: string): string {
  if (!html) return '';
  
  // Remove <style> tags and their content (including nested styles)
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
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
}

/**
 * Clean body text to remove subject line if it appears at the start
 * Also removes any subject-like patterns that might be embedded
 */
function cleanBodyText(body: string, subject: string): string {
  if (!body || !subject) return body;
  
  let cleaned = body;
  
  // Remove exact subject match at the beginning
  const escapedSubject = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Structure message body with proper formatting
 * Ensures consistent structure across all styles
 */
function structureMessageBody(body: string): string {
  // Ensure proper paragraph breaks
  let structured = body
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .replace(/\n\n\n/g, '\n\n') // Ensure double newlines for paragraphs
    .trim();
  
  // Ensure greeting is on its own line
  structured = structured.replace(/^(Hello\s+[^,\n]+),/i, 'Hello $1,');
  
  return structured;
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
  // Normalize style to lowercase
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
  const primaryModel = 'qwen2.5-32b-instruct';
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
            content: `Reference template (for context only):

Subject: ${baseSubject}

Body:
${baseBody}

────────────────────────────────────────
YOUR TASK
────────────────────────────────────────
${normalizedStyle === 'default' 
  ? 'For DEFAULT style: ONLY format the text with proper paragraph breaks. DO NOT change any wording - keep the exact original text.'
  : `Generate a COMPLETE email in ${normalizedStyle.toUpperCase()} style.

Write from scratch. Do NOT copy or closely mirror the reference template.
Include all required information and placeholders.
Make it natural and well-developed.`}`
          }
        ],
        temperature: 0.7,
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
      fullResponse: adaptedContent,
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

    // Debug logging
    console.log('LLM Parsed Result:', {
      style: normalizedStyle,
      subjectLength: adaptedSubject.length,
      bodyLength: adaptedBody.length,
      subjectChanged: adaptedSubject !== baseSubject,
      bodyChanged: adaptedBody !== baseBody,
      parsedSubject: adaptedSubject,
      parsedBodyPreview: adaptedBody.substring(0, 200)
    });
    
    // Safety check: If parsed body is too short (less than base body length), use base body
    if (adaptedBody.length < baseBody.length * 0.5) {
      console.warn('Parsed body is too short, using base body as fallback', {
        parsedLength: adaptedBody.length,
        baseLength: baseBody.length,
        parsedBody: adaptedBody
      });
      adaptedBody = baseBody;
    }

    // Structure the body with proper formatting
    adaptedBody = structureMessageBody(adaptedBody);
    
    // Fix duplicate "Hello" in greeting (common LLM issue) - handle multiple duplicates
    adaptedBody = adaptedBody.replace(/^(Hello\s+)+/i, 'Hello ');
    // Also fix if there are duplicates in the middle of the greeting
    adaptedBody = adaptedBody.replace(/Hello\s+Hello\s+/gi, 'Hello ');

    // Safety check: Verify placeholders still exist in body and subject
    const requiredPlaceholders = {
      first_name: '[PROTECTED_FIRST_NAME]',
      last_name: '[PROTECTED_LAST_NAME]',
      registration_link: '[PROTECTED_REGISTRATION_LINK]',
      registration_id: '[PROTECTED_REGISTRATION_ID]'
    };

    // Check for missing placeholders and attempt recovery
    const missingInBody: string[] = [];
    const missingInSubject: string[] = [];
    
    if (!adaptedBody.includes(requiredPlaceholders.first_name)) {
      missingInBody.push(requiredPlaceholders.first_name);
    }
    if (!adaptedBody.includes(requiredPlaceholders.registration_link)) {
      missingInBody.push(requiredPlaceholders.registration_link);
    }
    if (!adaptedSubject.includes(requiredPlaceholders.first_name)) {
      missingInSubject.push(requiredPlaceholders.first_name);
    }
    
    // Recovery mechanism: Re-insert missing placeholders
    if (missingInBody.length > 0 || missingInSubject.length > 0) {
      console.warn(`Warning: Placeholders missing from LLM response:`, {
        style: normalizedStyle,
        missingInBody,
        missingInSubject,
        adaptedBodyPreview: adaptedBody.substring(0, 500),
        adaptedSubjectPreview: adaptedSubject.substring(0, 200)
      });
      
      // Try to recover by re-inserting placeholders
      // Check if greeting exists and add first_name placeholder if missing
      if (missingInBody.includes(requiredPlaceholders.first_name)) {
        // Look for greeting pattern and insert placeholder
        const greetingPattern = /(Hello|Hi|Dear)\s+[^,\n]+/i;
        if (greetingPattern.test(adaptedBody)) {
          adaptedBody = adaptedBody.replace(greetingPattern, (match) => {
            return match.replace(/(Hello|Hi|Dear)\s+[^,\n]+/i, '$1 [PROTECTED_FIRST_NAME]');
          });
          console.log('Recovered: Re-inserted [PROTECTED_FIRST_NAME] in greeting');
        } else {
          // Add greeting at the beginning if missing
          adaptedBody = `Hello [PROTECTED_FIRST_NAME],\n\n${adaptedBody}`;
          console.log('Recovered: Added greeting with [PROTECTED_FIRST_NAME] at start');
        }
      }
      
      // Check if registration link placeholder is missing and try to recover
      if (missingInBody.includes(requiredPlaceholders.registration_link)) {
        // Look for link-related text and insert placeholder
        const linkPatterns = [
          /(visit|access|click|use|follow|open)\s+(the\s+)?(link|URL|website|platform)/i,
          /(link|URL|website|platform)\s+(below|above|here|provided)/i,
          /(registration|account|platform)/i
        ];
        
        let inserted = false;
        for (const pattern of linkPatterns) {
          if (pattern.test(adaptedBody) && !inserted) {
            // Insert placeholder near link-related text
            adaptedBody = adaptedBody.replace(pattern, (match) => {
              inserted = true;
              return `${match} [PROTECTED_REGISTRATION_LINK]`;
            });
            console.log('Recovered: Re-inserted [PROTECTED_REGISTRATION_LINK] near link text');
            break;
          }
        }
        
        // If still not found, add it in a new paragraph about registration
        if (!inserted) {
          const registrationParagraph = `\n\nTo claim your verified account, please visit: [PROTECTED_REGISTRATION_LINK]\n`;
          // Insert before "Important:" section if it exists
          if (adaptedBody.includes('Important:')) {
            adaptedBody = adaptedBody.replace(/(\n\n)?Important:/i, `${registrationParagraph}\n\nImportant:`);
          } else {
            adaptedBody = adaptedBody + registrationParagraph;
          }
          console.log('Recovered: Added new paragraph with [PROTECTED_REGISTRATION_LINK]');
        }
      }
      
      // Recover first_name in subject if missing
      if (missingInSubject.includes(requiredPlaceholders.first_name)) {
        // Try to find where it should be and insert
        if (baseSubject.includes('[PROTECTED_FIRST_NAME]')) {
          // Use base subject as fallback
          adaptedSubject = baseSubject;
          console.log('Recovered: Used base subject with [PROTECTED_FIRST_NAME]');
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
      
      console.log('Recovery successful: All placeholders restored');
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

/**
 * Invitation Email — Auto-generated Invitation Message
 * Sends invitation to pre-verified investors to claim their account
 * 
 * Supports:
 * - "default" style: Uses original template with LLM structuring
 * - Other styles (formal, friendly, casual, professional): Uses Groq LLM to adapt style
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing RESEND_API_KEY on server' });
    return;
  }

  const { 
    toEmail, 
    firstName, 
    lastName,
    registrationId,
    messageStyle = 'default', // 'default', 'formal', 'friendly', 'casual', 'professional'
    preview = false, // If true, return message without sending
    customSubject, // Custom subject line
    customBody // Custom body text
  } = req.body as { 
    toEmail?: string; 
    firstName?: string; 
    lastName?: string;
    registrationId?: string;
    messageStyle?: string;
    preview?: boolean;
    customSubject?: string;
    customBody?: string;
  };

  if (!toEmail || !toEmail.trim()) {
    res.status(400).json({ error: 'toEmail is required and must be a valid email address' });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail.trim())) {
    res.status(400).json({ error: 'Invalid email address format' });
    return;
  }

  try {
    // Step 1: Get template content from local template
    const templateSubject = invitationTemplate.subject;
    const templateHtmlContent = invitationTemplate.html;
    
    // Convert HTML to plain text for body
    let templateBodyText = htmlToText(templateHtmlContent);
    
    // Remove subject line from body if it appears
    templateBodyText = cleanBodyText(templateBodyText, templateSubject);

    if (!templateBodyText) {
      res.status(500).json({ error: 'Template content is empty' });
      return;
    }

    // Step 2: Use fixed demo registration link
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity
    const registrationLink = 'https://eurohub.eurolandir.net/'; // Fixed demo link

    // Step 3: Prepare actual values
    const actualFirstName = firstName || '';
    const actualLastName = lastName || '';
    const actualRegistrationId = registrationId && registrationId.length > 6 
      ? registrationId.slice(-6) 
      : registrationId || '';

    let finalSubject: string;
    let finalBody: string;

    if (customSubject && customBody) {
      // Use custom subject and body, but replace variables if they exist
      finalSubject = String(customSubject)
        .replace(/\{\{ first_name \}\}/gi, actualFirstName)
        .replace(/\{\{firstName\}\}/gi, actualFirstName);
      
      finalBody = String(customBody)
        .replace(/\{\{ first_name \}\}/gi, actualFirstName)
        .replace(/\{\{ registration_link \}\}/gi, registrationLink)
        .replace(/\{\{ registration_id \}\}/gi, actualRegistrationId)
        // Also handle variations without spaces
        .replace(/\{\{firstName\}\}/gi, actualFirstName)
        .replace(/\{\{registrationLink\}\}/gi, registrationLink)
        .replace(/\{\{registrationId\}\}/gi, actualRegistrationId);
      
      // Structure the custom body
      finalBody = structureMessageBody(finalBody);
    } else {
      // For default style, use template directly with proper formatting (no LLM needed)
      if (messageStyle.toLowerCase().trim() === 'default') {
        // Replace variables directly in the template
        finalSubject = templateSubject
          .replace(/\{\{ first_name \}\}/gi, actualFirstName)
          .replace(/\{\{firstName\}\}/gi, actualFirstName);
        
        finalBody = templateBodyText
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
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
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
          // Also handle variations without spaces
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
        
        const adapted = await adaptMessageStyle(protectedSubject, protectedBody, messageStyle, groqApiKey);
        
        console.log('Received adapted message:', {
          messageStyle: messageStyle,
          adaptedSubjectLength: adapted.subject.length,
          adaptedBodyLength: adapted.body.length
        });

        // Replace protected placeholders with actual values
        finalSubject = adapted.subject
          .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
          .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName);
        
        finalBody = adapted.body
          .replace(/\[PROTECTED_FIRST_NAME\]/g, actualFirstName)
          .replace(/\[PROTECTED_LAST_NAME\]/g, actualLastName)
          .replace(/\[PROTECTED_REGISTRATION_LINK\]/g, registrationLink)
          .replace(/\[PROTECTED_REGISTRATION_ID\]/g, actualRegistrationId);
      }
    }

    // Step 5: Clean up duplicate words before converting to HTML
    // Fix duplicate "Hello" and other common duplicates
    finalBody = finalBody.replace(/(Hello\s+)+/gi, 'Hello ');
    finalBody = finalBody.replace(/\b(\w+)(\s+\1\b)+/gi, '$1'); // Remove any repeated words
    
    // Step 6: Create plain text version (better deliverability)
    const finalBodyText = finalBody
      .replace(/\n\n/g, '\n\n') // Preserve paragraph breaks
      .replace(new RegExp(`(${escapeRegex(registrationLink)})`, 'g'), registrationLink);
    
    // Step 7: Convert body to HTML for email sending (simple formatting)
    // Convert newlines to HTML breaks and format links
    let finalBodyHtml = finalBody
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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://eurohub.eurolandir.net';
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

    // If preview mode, return the message without sending
    if (preview) {
      res.status(200).json({ 
        ok: true,
        subject: finalSubject,
        body: finalBody,
        registrationLink,
        expiresAt: expiresAt.toISOString()
      });
      return;
    }

    // Step 6: Send email via Resend
    const trimmedEmail = toEmail.trim();
    
    // Log the email details (without full HTML content for readability)
    console.log('Sending email via Resend:', {
      to: trimmedEmail,
      subject: finalSubject,
      htmlContentLength: finalBodyHtml.length,
      apiKeyPresent: !!apiKey,
    });

    // Clean up any remaining duplicate words in the final body HTML before sending
    finalBodyHtml = finalBodyHtml.replace(/(Hello\s+)+/gi, 'Hello ');
    
    const result = await sendEmail({
      to: trimmedEmail,
      subject: finalSubject,
      html: finalBodyHtml,
      text: finalBodyText, // Plain text version for better deliverability
      replyTo: process.env.RESEND_FROM_EMAIL || 'norelyn.golingan@eirl.ink',
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'invitation' },
        { name: 'message_style', value: messageStyle }
      ],
      headers: {
        'X-Entity-Ref-ID': registrationId || 'unknown',
        'X-Email-Type': 'account-invitation'
      }
    });

    if (!result.success) {
      console.error('Resend email send failed:', {
        error: result.error,
        toEmail: trimmedEmail,
        subject: finalSubject,
      });
      res.status(502).json({ 
        error: 'Resend send failed', 
        details: result.error || 'Failed to send email. Please check Resend API key configuration.'
      });
      return;
    }

    // Log successful email sending
    console.log('Resend email sent successfully:', {
      messageId: result.messageId,
      toEmail: trimmedEmail,
      subject: finalSubject,
      registrationLink
    });

    // Update Firebase when email is sent (only if we have registrationId)
    if (registrationId) {
      try {
        const { applicantService } = require('../lib/firestore-service');
        await applicantService.update(registrationId, {
          emailSentAt: new Date().toISOString(),
          workflowStage: 'SENT_EMAIL',
          systemStatus: 'ACTIVE',
        });
        console.log('Updated email sent timestamp in Firebase for applicant:', registrationId);
      } catch (firebaseError) {
        console.error('Failed to update email sent timestamp in Firebase:', firebaseError);
        // Don't fail the request if Firebase update fails
      }
    }

    res.status(200).json({ 
      ok: true, 
      registrationLink,
      expiresAt: expiresAt.toISOString(),
      message: 'Email sent successfully to ' + trimmedEmail
    });

  } catch (e: any) {
    console.error('Error in send-invitation-email:', e);
    res.status(500).json({ 
      error: 'Unexpected error', 
      detail: String(e?.message ?? e) 
    });
  }
}

