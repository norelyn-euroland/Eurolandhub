import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomInt } from 'crypto';

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
 * - Reads BREVO_API_KEY from server env (never expose in Vite client)
 * - Sends a 6-digit OTP via Brevo transactional email
 * - OTP expires in 1 hour (returns expiresAt to the client)
 *
 * NOTE: For a production-ready flow, you should store a hash of the OTP + attempts/lockout state
 * in your DB (e.g., Firestore) and verify server-side. This demo endpoint only sends the email.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing BREVO_API_KEY on server' });
    return;
  }

  const templateIdRaw = process.env.BREVO_TEMPLATE_EMAIL_OTP_ID;
  const templateId = templateIdRaw ? Number(templateIdRaw) : NaN;
  if (!Number.isFinite(templateId)) {
    res.status(500).json({ error: 'Missing/invalid BREVO_TEMPLATE_EMAIL_OTP_ID on server' });
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

  // Brevo Template 1 — Email Verification (OTP)
  // Variables expected by your template:
  // - {{ first_name }}
  // - {{ otp_code }}
  const payload: any = {
    sender: {
      // Use a verified sender in Brevo, or set from env if you prefer.
      name: 'EurolandHUB',
      email: 'no-reply@eurolandhub.com',
    },
    to: [{ email: toEmail, name: firstName || toEmail }],
    templateId,
    params: {
      first_name: firstName || '',
      otp_code: code,
    },
  };

  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const bodyText = await r.text();
    if (!r.ok) {
      res.status(502).json({ error: 'Brevo send failed', status: r.status, body: bodyText });
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


