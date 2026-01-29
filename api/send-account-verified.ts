import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Brevo Template 2 — Account Fully Verified (Final confirmation)
 * Variables expected by your template:
 * - {{ first_name }}
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

  const templateIdRaw = process.env.BREVO_TEMPLATE_ACCOUNT_VERIFIED_ID;
  const templateId = templateIdRaw ? Number(templateIdRaw) : NaN;
  if (!Number.isFinite(templateId)) {
    res.status(500).json({ error: 'Missing/invalid BREVO_TEMPLATE_ACCOUNT_VERIFIED_ID on server' });
    return;
  }

  const { toEmail, firstName } = (req.body ?? {}) as { toEmail?: string; firstName?: string };
  if (!toEmail) {
    res.status(400).json({ error: 'toEmail is required' });
    return;
  }

  const payload: any = {
    sender: {
      name: 'EurolandHUB',
      email: 'no-reply@eurolandhub.com',
    },
    to: [{ email: toEmail, name: firstName || toEmail }],
    templateId,
    params: {
      first_name: firstName || '',
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

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Unexpected error sending email', detail: String(e?.message ?? e) });
  }
}



