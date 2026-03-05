/**
 * Pre-verified Account Workflow Status Management
 * 
 * This module handles status transitions for pre-verified accounts according to the
 * investor provisioning workflow mapping.
 * 
 * Workflow Stage to System Status Mapping:
 * - SEND_EMAIL -> NULL (IRO saved but not sent email)
 * - SENT_EMAIL -> ACTIVE (System sent invitation email)
 * - CLAIM_IN_PROGRESS -> ACTIVE (Investor clicked link, started registration)
 * - ACCOUNT_CLAIMED -> CLAIMED (Account fully verified)
 * - INVITE_EXPIRED -> INACTIVE (Invitation expired after 30 days)
 */

import { Applicant, WorkflowStage, SystemStatus, AccountStatus } from './types.js';
import { applicantService } from './firestore-service.js';
import { accountVerifiedTemplate, replaceTemplateVariables } from './email-templates.js';
import { sendEmail } from './resend-service.js';
import { fetchGravatarProfile } from './profile-utils.js';

/**
 * Check if an invitation has expired (30 days since emailSentAt)
 */
export function isInviteExpired(applicant: Applicant): boolean {
  if (!applicant.emailSentAt || !applicant.isPreVerified) {
    return false;
  }

  const sentDate = new Date(applicant.emailSentAt);
  const daysSinceSent = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceSent > 30;
}

/**
 * Update pre-verified account to ACCOUNT_CLAIMED status
 * Called when investor completes basic registration (email OTP verification)
 * 
 * Following workflow mapping:
 * ACCOUNT_CLAIMED -> VERIFIED (accountStatus), CLAIMED (systemStatus)
 * 
 * Sends Step 6 verified account email (from Investors Holdings Verification Workflow)
 */
export async function markAccountAsClaimed(applicantId: string): Promise<void> {
  try {
    // Get applicant data to extract email and name for the verified account email
    const applicant = await applicantService.getById(applicantId);
    if (!applicant) {
      throw new Error(`Applicant not found: ${applicantId}`);
    }

    // Fetch profile picture from Gravatar if email is available
    let profilePictureUrl: string | undefined = undefined;
    if (applicant.email) {
      try {
        const gravatarUrl = await fetchGravatarProfile(applicant.email);
        if (gravatarUrl) {
          profilePictureUrl = gravatarUrl;
          console.log('Found Gravatar profile for:', applicant.email);
        }
      } catch (error) {
        console.warn('Failed to fetch Gravatar profile:', error);
        // Continue without profile picture - non-critical
      }
    }

    // Update status and profile picture
    const accountClaimedAt = new Date().toISOString();
    await applicantService.update(applicantId, {
      accountClaimedAt,
      workflowStage: 'ACCOUNT_CLAIMED' as WorkflowStage,
      systemStatus: 'CLAIMED' as SystemStatus,
      accountStatus: 'VERIFIED' as AccountStatus,
      status: 'APPROVED' as any, // RegistrationStatus.APPROVED
      ...(profilePictureUrl && { profilePictureUrl }), // Only include if we have a profile picture
    });
    console.log('Marked pre-verified account as claimed:', applicantId);

    // Sync to official shareholders collection
    const updatedApplicant = await applicantService.getById(applicantId);
    if (updatedApplicant && updatedApplicant.registrationId) {
      try {
        const { syncOfficialShareholderOnClaim } = await import('./official-shareholder-sync.js');
        await syncOfficialShareholderOnClaim(updatedApplicant);
      } catch (syncError) {
        console.error('Error syncing official shareholder on claim:', syncError);
        // Don't fail if sync fails
      }
    }

    // Send Step 6 verified account email (from Investors Holdings Verification Workflow)
    if (applicant.email) {
      try {
        // Extract first name from fullName
        const nameParts = applicant.fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || applicant.fullName;

        // Replace variables in account verified template (Step 6 message)
        const htmlContent = replaceTemplateVariables(accountVerifiedTemplate.html, {
          first_name: firstName,
        });

        const subject = replaceTemplateVariables(accountVerifiedTemplate.subject, {
          first_name: firstName,
        });

        // Send email via Resend
        const result = await sendEmail({
          to: applicant.email,
          subject,
          html: htmlContent,
          tags: [
            { name: 'category', value: 'transactional' },
            { name: 'type', value: 'account-verified' }
          ],
          headers: {
            'X-Entity-Ref-ID': applicantId,
            'X-Email-Type': 'account-verified'
          }
        });

        if (result.success) {
          console.log('Sent Step 6 verified account email to:', applicant.email);
        } else {
          console.error('Failed to send verified account email:', result.error);
          // Don't throw - status update succeeded, email failure is non-critical
        }
      } catch (emailError) {
        console.error('Error sending verified account email:', emailError);
        // Don't throw - status update succeeded, email failure is non-critical
      }
    }
  } catch (error) {
    console.error('Failed to mark account as claimed:', error);
    throw error;
  }
}

/**
 * Claim a pre-verified account directly by email.
 *
 * Use this when the frontend needs to explicitly trigger the claim for a
 * known pre-verified user (e.g. after OTP verification on the registration page).
 *
 * Returns:
 *   { success: true,  applicantId }          — account claimed successfully
 *   { success: true,  applicantId, already }  — account was already claimed
 *   { success: false, error }                 — no pre-verified record found or claim failed
 */
export async function claimPreVerifiedAccountByEmail(
  email: string,
  extraData?: {
    phoneNumber?: string;
    location?: string;
    profilePictureUrl?: string;
  }
): Promise<{ success: boolean; applicantId?: string; already?: boolean; error?: string }> {
  try {
    const existing = await applicantService.findPreVerifiedByEmail(email);

    if (!existing) {
      return { success: false, error: 'No pre-verified account found for this email address.' };
    }

    // Already claimed — idempotent, return success
    if (existing.accountStatus === 'VERIFIED' || existing.workflowStage === 'ACCOUNT_CLAIMED') {
      console.log('[CLAIM FLOW] Account already claimed:', existing.id);
      return { success: true, applicantId: existing.id, already: true };
    }

    // Attach any additional profile data from the registration form before claiming
    if (extraData) {
      const patch: Partial<typeof existing> = {};
      if (extraData.phoneNumber && !existing.phoneNumber) patch.phoneNumber = extraData.phoneNumber;
      if (extraData.location && !existing.location) patch.location = extraData.location;
      if (extraData.profilePictureUrl) patch.profilePictureUrl = extraData.profilePictureUrl;

      if (Object.keys(patch).length > 0) {
        await applicantService.update(existing.id, patch);
      }
    }

    // Run full claim workflow:
    //   • workflowStage  → ACCOUNT_CLAIMED
    //   • systemStatus   → CLAIMED
    //   • accountStatus  → VERIFIED
    //   • status         → APPROVED
    //   • officialShareholders: PRE-VERIFIED → VERIFIED
    //   • Sends Step-6 verified-account email
    await markAccountAsClaimed(existing.id);

    console.log('[CLAIM FLOW] Pre-verified account claimed via claimPreVerifiedAccountByEmail:', existing.id);
    return { success: true, applicantId: existing.id };
  } catch (error) {
    console.error('[CLAIM FLOW] Failed to claim pre-verified account:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check and update expired invitations
 * Should be called periodically (e.g., via scheduled job or on account access)
 * 
 * Following workflow mapping:
 * INVITE_EXPIRED -> UNVERIFIED (accountStatus), INACTIVE (systemStatus)
 */
export async function checkAndUpdateExpiredInvites(): Promise<void> {
  try {
    // Get all pre-verified accounts that are in SENT_EMAIL or CLAIM_IN_PROGRESS stage
    const applicants = await applicantService.getAll();
    const preVerifiedApplicants = applicants.filter(
      a => a.isPreVerified && 
      (a.workflowStage === 'SENT_EMAIL' || a.workflowStage === 'CLAIM_IN_PROGRESS') &&
      a.emailSentAt
    );

    const updates: Promise<void>[] = [];
    
    for (const applicant of preVerifiedApplicants) {
      if (isInviteExpired(applicant)) {
        updates.push(
          applicantService.update(applicant.id, {
            workflowStage: 'INVITE_EXPIRED' as WorkflowStage,
            systemStatus: 'INACTIVE' as SystemStatus,
            accountStatus: 'UNVERIFIED' as AccountStatus,
          }).then(() => {
            console.log('Updated expired invite for applicant:', applicant.id);
          }).catch((error) => {
            console.error('Failed to update expired invite for applicant:', applicant.id, error);
          })
        );
      }
    }

    await Promise.all(updates);
  } catch (error) {
    console.error('Error checking expired invites:', error);
    throw error;
  }
}

