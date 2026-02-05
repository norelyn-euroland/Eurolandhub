import type { VercelRequest, VercelResponse } from '@vercel/node';
import { accountVerifiedTemplate, replaceTemplateVariables } from '../lib/email-templates';
import { sendEmail } from '../lib/resend-service';

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
  if (!toEmail) {
    res.status(400).json({ error: 'toEmail is required' });
    return;
  }

  // Replace variables in account verified template
  const htmlContent = replaceTemplateVariables(accountVerifiedTemplate.html, {
    first_name: firstName || '',
  });

  const subject = replaceTemplateVariables(accountVerifiedTemplate.subject, {
    first_name: firstName || '',
  });

  try {
    const result = await sendEmail({
      to: toEmail,
      subject,
      html: htmlContent,
    });

    if (!result.success) {
      res.status(502).json({ 
        error: 'Resend send failed', 
        details: result.error || 'Unknown error' 
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Unexpected error sending email', detail: String(e?.message ?? e) });
  }
}






