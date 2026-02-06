import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applicantService } from '../lib/firestore-service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
}

