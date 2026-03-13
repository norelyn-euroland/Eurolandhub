import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applicantService, officialShareholderService } from '../lib/firestore-service.js';
import { syncOfficialShareholderOnStatusChange } from '../lib/official-shareholder-sync.js';

/**
 * Fix Pre-Verified Investors
 * 
 * This endpoint identifies and fixes investors that should be marked as pre-verified
 * but are currently missing from the pre-verified list. This includes:
 * - Investors with emailSentAt but isPreVerified !== true
 * - Investors with registrationId (IRO-created) but isPreVerified !== true
 * - Investors that were batch uploaded by IRO but not properly marked
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const now = new Date().toISOString();
    let fixed = 0;
    const errors: string[] = [];
    const fixedInvestors: Array<{ id: string; email: string; name: string }> = [];

    // Get all applicants
    const allApplicants = await applicantService.getAll({ limitCount: 10000 });

    for (const applicant of allApplicants) {
      try {
        // Check if this applicant should be pre-verified but isn't
        const shouldBePreVerified = 
          // Has registrationId (IRO-created via batch upload or individual add)
          (applicant.registrationId && applicant.registrationId.trim() !== '') ||
          // Has emailSentAt (IRO sent email invitation)
          (applicant.emailSentAt && applicant.emailSentAt.trim() !== '') ||
          // Has workflowStage indicating IRO-created account
          (applicant.workflowStage === 'SEND_EMAIL' || applicant.workflowStage === 'SENT_EMAIL');

        // Skip if already marked as pre-verified
        if (applicant.isPreVerified === true) {
          continue;
        }

        // Only fix if should be pre-verified and has email
        if (shouldBePreVerified && applicant.email && applicant.email.trim() !== '') {
          const updateData: Partial<typeof applicant> = {
            isPreVerified: true,
          };

          // Ensure workflowStage is set if missing
          if (!applicant.workflowStage) {
            if (applicant.emailSentAt) {
              updateData.workflowStage = 'SENT_EMAIL';
              updateData.systemStatus = 'ACTIVE';
            } else {
              updateData.workflowStage = 'SEND_EMAIL';
              updateData.systemStatus = 'NULL';
            }
          }

          // Ensure accountStatus is set
          if (!applicant.accountStatus) {
            updateData.accountStatus = 'PENDING';
          }

          await applicantService.update(applicant.id, updateData);
          
          // Sync to official shareholders collection
          try {
            const updatedApplicant = await applicantService.getById(applicant.id);
            if (updatedApplicant) {
              await syncOfficialShareholderOnStatusChange(updatedApplicant);
            }
          } catch (syncError) {
            console.warn(`Error syncing official shareholder for ${applicant.id}:`, syncError);
            // Don't fail the update if sync fails
          }

          fixed++;
          fixedInvestors.push({
            id: applicant.id,
            email: applicant.email,
            name: applicant.fullName,
          });

          console.log(`Fixed pre-verified status for: ${applicant.fullName} (${applicant.email})`);
        }
      } catch (error) {
        const errorMsg = `Error fixing applicant ${applicant.id}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Pre-verified investors fixed',
      stats: {
        fixed,
        totalProcessed: allApplicants.length,
        errors: errors.length,
      },
      fixedInvestors: fixedInvestors.length > 0 ? fixedInvestors : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

