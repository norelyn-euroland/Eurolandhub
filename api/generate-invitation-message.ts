import type { VercelRequest, VercelResponse } from '@vercel/node';
import { invitationTemplate } from '../lib/email-templates';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // NOTE: For production/serverless this returns a placeholder-based template.
  // Styling via LLM is handled by the send endpoint; we keep generation deterministic here.
  const subject = invitationTemplate.subject;
  let body = htmlToText(invitationTemplate.html);
  body = cleanBodyText(body, subject);
  body = structureMessageBody(body);

  res.status(200).json({
    ok: true,
    subject,
    body,
  });
}


