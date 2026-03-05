import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applicantService } from '../../lib/firestore-service.js';

/**
 * Combined tracking handler for email opens and link clicks
 * Routes:
 * - /api/track/email-open -> tracks email open
 * - /api/track/link-click -> tracks link click and redirects
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { slug } = req.query;
  const slugArray = Array.isArray(slug) ? slug : [slug];
  const endpoint = slugArray[0];

  if (endpoint === 'email-open') {
    // Handle email open tracking
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
    return;
  }

  if (endpoint === 'link-click') {
    // Handle link click tracking
    const { applicantId, token, redirect } = req.query;

    if (!applicantId || !token || !redirect) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    try {
      const applicant = await applicantService.getById(String(applicantId));
      if (applicant) {
        const now = new Date().toISOString();
        const updates: any = {
          linkClickedCount: (applicant.linkClickedCount || 0) + 1,
        };
        
        // Only set first click timestamp if not already set
        if (!applicant.linkClickedAt) {
          updates.linkClickedAt = now;
          
          // Update workflow stage to CLAIM_IN_PROGRESS when link is first clicked
          // Following investor provisioning workflow: CLAIM_IN_PROGRESS -> ACTIVE (system status stays ACTIVE)
          if (applicant.isPreVerified && applicant.workflowStage !== 'ACCOUNT_CLAIMED' && applicant.workflowStage !== 'INVITE_EXPIRED') {
            updates.workflowStage = 'CLAIM_IN_PROGRESS';
            updates.systemStatus = 'ACTIVE'; // Ensure system status is ACTIVE
            updates.accountStatus = 'PENDING'; // Account status remains PENDING during claim process
          }
        }
        
        await applicantService.update(String(applicantId), updates);
      }

      // Redirect to the actual registration link
      res.redirect(302, decodeURIComponent(String(redirect)));
    } catch (error) {
      console.error('Error tracking link click:', error);
      // Still redirect even on error
      res.redirect(302, decodeURIComponent(String(redirect)));
    }
    return;
  }

  // Unknown endpoint
  res.status(404).json({ error: 'Not found' });
}

