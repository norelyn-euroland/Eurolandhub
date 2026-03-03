/**
 * Shareholder Status Mapping Utility
 * 
 * Computes system-derived statuses for shareholders based on account state.
 * Statuses are auto-computed and NOT manually editable.
 */

import { Applicant, Shareholder, RegistrationStatus } from './types.js';
import { getWorkflowStatusInternal } from './shareholdingsVerification.js';

export type ShareholderStatus = 'VERIFIED' | 'PRE-VERIFIED' | null;

/**
 * Compute shareholder status based on account state
 * 
 * @param applicant - Applicant record (if exists)
 * @param shareholder - Shareholder record from masterlist
 * @returns Computed status: VERIFIED, PRE-VERIFIED, or null
 */
export async function computeShareholderStatus(
  applicant: Applicant | null | undefined,
  shareholder: Shareholder | null | undefined
): Promise<ShareholderStatus> {
  // If no applicant exists, check if shareholder has contact info
  if (!applicant) {
    // NULL status: exists in masterlist but no account created
    return null;
  }

  // Check for VERIFIED status
  // VERIFIED = accountClaimed = true AND verificationStatus = approved
  // verificationStatus = approved means: status === APPROVED AND step6.verifiedAt exists
  const internalStatus = await getWorkflowStatusInternal(applicant);
  const isVerified = internalStatus === 'VERIFIED' || internalStatus === 'ACCOUNT_CLAIMED';
  const isApproved = applicant.status === RegistrationStatus.APPROVED;
  const hasVerifiedAt = applicant.shareholdingsVerification?.step6?.verifiedAt !== undefined;
  const accountClaimed = applicant.accountClaimedAt !== undefined;
  
  // VERIFIED: account is claimed AND verification is approved
  if ((isVerified || (isApproved && hasVerifiedAt)) && accountClaimed) {
    return 'VERIFIED';
  }

  // Check for PRE-VERIFIED status
  // PRE-VERIFIED = exists in masterlist AND email exists AND accountCreatedByIRO = true AND accountClaimed = false
  const hasEmail = applicant.email && applicant.email.trim() !== '';
  const isPreVerified = applicant.isPreVerified === true;
  const isNotClaimed = !applicant.accountClaimedAt;

  if (hasEmail && isPreVerified && isNotClaimed) {
    return 'PRE-VERIFIED';
  }

  // NULL status: exists in masterlist but doesn't meet VERIFIED or PRE-VERIFIED criteria
  // This includes cases where:
  // - No email/phone
  // - Account not created by IRO
  // - Account exists but not in pre-verified workflow
  return null;
}

/**
 * Get status badge color class
 */
export function getStatusBadgeColor(status: ShareholderStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    case 'PRE-VERIFIED':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    case null:
      return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300';
    default:
      return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300';
  }
}

/**
 * Get status display label
 */
export function getStatusLabel(status: ShareholderStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'VERIFIED';
    case 'PRE-VERIFIED':
      return 'PRE-VERIFIED';
    case null:
      return '–';
    default:
      return '–';
  }
}

