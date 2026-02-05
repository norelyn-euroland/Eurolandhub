import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applicantService } from '../lib/firestore-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { applicantId, token } = req.query;

  if (!applicantId || !token) {
    // Return 1x1 transparent pixel even if tracking fails
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    return;
  }

  try {
    const applicant = await applicantService.getById(String(applicantId));
    if (applicant) {
      const now = new Date().toISOString();
      const updates: any = {
        emailOpenedCount: (applicant.emailOpenedCount || 0) + 1,
      };
      
      // Only set first open timestamp if not already set
      if (!applicant.emailOpenedAt) {
        updates.emailOpenedAt = now;
      }
      
      await applicantService.update(String(applicantId), updates);
    }

    // Return 1x1 transparent PNG
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  } catch (error) {
    console.error('Error tracking email open:', error);
    // Still return pixel even on error
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
  }
}

