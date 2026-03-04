import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomInt } from 'crypto';
import { otpTemplate, replaceTemplateVariables } from '../lib/email-templates.js';
import { sendEmail } from '../lib/resend-service.js';

function generate6DigitCode(): string {
  // crypto-secure 0..999999
  const n = randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

function addHoursIso(fromIso: string, hours: number): string {
  const t = new Date(fromIso).getTime();
  return new Date(t + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Vercel Serverless Function
 * Resend OTP email verification code (Step 2 of Investors - Holdings Verification Workflow)
 * - Reads RESEND_API_KEY from server env (never expose in Vite client)
 * - Sends a new 6-digit OTP via Resend transactional email
 * - OTP expires in 1 hour (returns expiresAt to the client)
 * 
 * Use this endpoint when a user requests to resend their verification code
 * 
 * NOTE: For a production-ready flow, you should store a hash of the OTP + attempts/lockout state
 * in your DB (e.g., Firestore) and verify server-side. This demo endpoint only sends the email.
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

  const issuedAt = new Date().toISOString();
  const expiresAt = addHoursIso(issuedAt, 1); // 1 hour validity
  const code = generate6DigitCode();

  // Replace variables in OTP template
  const htmlContent = replaceTemplateVariables(otpTemplate.html, {
    first_name: firstName || '',
    otp_code: code,
  });

  const subject = replaceTemplateVariables(otpTemplate.subject, {
    first_name: firstName || '',
  });

  // Modify subject to indicate this is a resend
  const resendSubject = subject.replace('Verify your email address', 'Verify your email address - New Code');

  try {
    const result = await sendEmail({
      to: toEmail,
      subject: resendSubject,
      html: htmlContent,
      tags: [
        { name: 'category', value: 'transactional' },
        { name: 'type', value: 'otp-resend' }
      ],
    });

    if (!result.success) {
      res.status(502).json({ 
        error: 'Resend send failed', 
        details: result.error || 'Unknown error' 
      });
      return;
    }

    res.status(200).json({
      ok: true,
      issuedAt,
      expiresAt,
      // NOTE: do NOT return `code` in production.
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Unexpected error sending email', detail: String(e?.message ?? e) });
  }
}


