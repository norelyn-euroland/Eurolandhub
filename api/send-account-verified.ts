import type { VercelRequest, VercelResponse } from '@vercel/node';
import { accountVerifiedTemplate, replaceTemplateVariables } from '../lib/email-templates.js';
import { sendEmail } from '../lib/resend-service.js';

/**
 * Account Verified Email
 * Variables expected by template:
 * - {{ first_name }}
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

  const { toEmail, firstName } = (req.body ?? {}) as { toEmail?: string; firstName?: string };
  if (!toEmail || !String(toEmail).trim()) {
    res.status(400).json({ error: 'toEmail is required and must be a valid email address' });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = String(toEmail).trim();
  if (!emailRegex.test(trimmedEmail)) {
    res.status(400).json({ error: 'Invalid email address format' });
    return;
  }

  // Replace variables in account verified template
  const htmlContent = replaceTemplateVariables(accountVerifiedTemplate.html, {
    first_name: firstName || '',
  });

  const subject = replaceTemplateVariables(accountVerifiedTemplate.subject, {
    first_name: firstName || '',
  });

  // Verify the link is included in the email
  if (!htmlContent.includes('eurohub.eurolandir.net')) {
    console.error('WARNING: Account verified email template is missing the investor portal link!');
  } else {
    console.log('Account verified email includes investor portal link');
  }

  try {
    const result = await sendEmail({
      to: trimmedEmail,
      subject,
      html: htmlContent,
    });

    if (!result.success) {
      res.status(502).json({ 
        error: 'Resend send failed', 
        details: result.error || 'Unknown error',
        message: `Failed to send email: ${result.error || 'Unknown error'}`
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e: any) {
    const errorMessage = e?.message || String(e) || 'Unknown error';
    res.status(500).json({ 
      error: 'Unexpected error sending email', 
      details: errorMessage,
      message: `Unexpected error: ${errorMessage}`
    });
  }
}






