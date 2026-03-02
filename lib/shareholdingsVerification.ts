import { RegistrationStatus, Shareholder, ShareholdingsVerificationMatchResult, ShareholdingsVerificationState, Applicant, WorkflowStatusInternal, GeneralAccountStatus, ComplianceStatus, IRODecision } from './types.js';
import { isEmailVerified } from './firestore-service.js';

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DAYS = 7;

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(fromIso: string, days: number): string {
  const t = new Date(fromIso).getTime();
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString();
}

function addHoursIso(fromIso: string, hours: number): string {
  const t = new Date(fromIso).getTime();
  return new Date(t + hours * 60 * 60 * 1000).toISOString();
}

function isFutureIso(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function normalizeSpaces(v: string): string {
  return v.trim().replace(/\s+/g, ' ');
}

function normalizeCompanyName(v: string): string {
  return normalizeSpaces(v).toUpperCase();
}

function normalizeId(v: string): string {
  return normalizeSpaces(v);
}

function normalizeCountry(v: string): string {
  return normalizeSpaces(v).toUpperCase();
}

export function ensureWorkflow(applicant: Applicant): Applicant {
  const parts = applicant.fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

  const existing = applicant.shareholdingsVerification;

  // If no workflow at all, create a brand-new one
  if (!existing) {
    const state: ShareholdingsVerificationState = {
      step1: {
        firstName,
        lastName,
        email: applicant.email,
        contactNumber: applicant.phoneNumber || '',
        authProvider: 'GOOGLE',
        // wantsVerification is intentionally undefined until set after Step 2 (Email Verification)
        // The decision "Want to verify account for Investor community and updates?" comes after email verification
      },
      step3: {
        failedAttempts: 0,
      },
      step4: {
        failedAttempts: 0,
      },
    };
    return { ...applicant, shareholdingsVerification: state };
  }

  // Workflow exists but may be partial (e.g. frontend wrote incomplete data).
  // Ensure all required sub-objects have safe defaults so downstream code never crashes.
  const patched: ShareholdingsVerificationState = {
    ...existing,
    step1: existing.step1 || {
      firstName,
      lastName,
      email: applicant.email,
      contactNumber: applicant.phoneNumber || '',
      authProvider: 'GOOGLE' as const,
    },
    // step2 is optional — leave as-is
    step3: existing.step3 || { failedAttempts: 0 },
    step4: existing.step4 || { failedAttempts: 0 },
  };

  // Only create a new object if something was actually patched
  if (patched.step1 !== existing.step1 || patched.step3 !== existing.step3 || patched.step4 !== existing.step4) {
    return { ...applicant, shareholdingsVerification: patched };
  }

  return applicant;
}

export function isLocked(applicant: Applicant): boolean {
  const wf = applicant.shareholdingsVerification;
  return isFutureIso(wf?.step3?.lockedUntil);
}

/**
 * Set whether user wants to proceed with shareholdings verification
 * This decision is made AFTER Step 2 (Email Verification) is complete
 * 
 * Flow:
 * 1. Step 1: Basic User Registration
 * 2. Step 2: Email Verification (Frontend) - handled by frontend, not tracked here
 * 3. Decision: "Want to verify account for Investor community and updates?" (this function)
 *    - If No → SHAREHOLDINGS_DECLINED (unverified account) - Directed to Dynamic Home Page
 *    - If Yes → Proceed to Step 3 (Holdings Registration)
 */
export function setWantsVerification(applicant: Applicant, wantsVerification: boolean): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  const next: ShareholdingsVerificationState = {
    ...wf,
    step1: { ...wf.step1, wantsVerification },
  };

  if (!wantsVerification) {
    // Decision "No": User declined shareholdings verification
    // Redirect to dynamic home page as unverified account
    return {
      ...a,
      status: RegistrationStatus.PENDING, // UNVERIFIED status
      shareholdingsVerification: {
        ...next,
        step2: undefined, // Clear any shareholdings submission
        step3: { failedAttempts: 0 },
        step4: { failedAttempts: 0 },
        step6: undefined,
      },
    };
  }

  // REGISTRATION_PENDING: User wants verification but hasn't submitted Step 3 (Holdings Registration) yet
  // Status should be PENDING (UNVERIFIED) until they submit
  return { 
    ...a, 
    status: RegistrationStatus.PENDING, // UNVERIFIED status until Step 3 submission
    shareholdingsVerification: next 
  };
}

/**
 * Submit shareholdings registration information (Step 3: Holdings Registration)
 * 
 * This is called AFTER:
 * 1. Step 1: Basic User Registration
 * 2. Step 2: Email Verification (Frontend) - handled by frontend
 * 3. Decision: User chose "Yes" to proceed with shareholdings verification
 * 
 * Required fields:
 * - shareholdingsId: Registration/Shareholdings ID (required)
 * - companyName: Company Name/Name (required)
 * 
 * Optional fields:
 * - country: Country (optional) - Only checked if provided, used for verification matching
 * 
 * Lockout Enforcement: Before processing, system checks if account is locked.
 * If blocked, user is notified and directed to Dynamic Home Page (unverified).
 * 
 * Automatic verification (Step 4) will check:
 * - Shareholdings ID matches
 * - Company Name matches
 * - Country matches (if provided)
 */
export function submitShareholdingInfo(
  applicant: Applicant,
  submission: { shareholdingsId: string; companyName: string; country?: string },
  shareholders?: Shareholder[]
): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  const submittedAt = nowIso();
  const step2 = {
    shareholdingsId: submission.shareholdingsId,
    companyName: submission.companyName,
    country: submission.country, // Optional - stored for profile display only
    submittedAt,
  };

  // Check if lock is expired - if so, clear lock fields (physical clearing)
  const step3 = wf.step3 || { failedAttempts: 0 };
  const isLockExpired = step3.lockedUntil && new Date(step3.lockedUntil).getTime() <= Date.now();
  
  // Check if this is a resubmission after IRO decision (REJECTED or REQUEST_INFO)
  // If there's an IRO decision requiring user response, this is a compliance resubmission
  const step4 = wf.step4 || { failedAttempts: 0 };
  const isComplianceResubmission = step4.iroDecision && 
    (step4.iroDecision.decision === 'REJECTED' || step4.iroDecision.decision === 'REQUEST_INFO') &&
    step4.iroDecision.complianceStatus === 'AWAITING_USER_RESPONSE';
  
  // Also check for legacy resubmission (NO_MATCH result without IRO decision tracking)
  const isLegacyResubmission = wf.step4?.lastResult === 'NO_MATCH';
  const isResubmission = isComplianceResubmission || isLegacyResubmission || isLockExpired;

  // Update compliance status if this is a compliance resubmission
  let updatedIRODecision: IRODecision | undefined;
  if (isComplianceResubmission && step4.iroDecision) {
    updatedIRODecision = {
      ...step4.iroDecision,
      complianceStatus: 'USER_RESPONDED',
      userRespondedAt: submittedAt,
      resubmissionCount: (step4.iroDecision.resubmissionCount || 0) + 1,
    };
  }

  // Step 3: Store submission, status will be set by Step 4 (automatic verification)
  // If lock expired, clear lock fields (physical clearing)
  const withStep2 = {
    ...a,
    status: isLockExpired ? RegistrationStatus.PENDING_REVIEW : RegistrationStatus.PENDING, // Will be updated by Step 4 or Step 5
    userLastResponseAt: isComplianceResubmission ? submittedAt : a.userLastResponseAt,
    complianceStatus: isComplianceResubmission ? 'USER_RESPONDED' as ComplianceStatus : a.complianceStatus,
    shareholdingsVerification: {
      ...wf,
      step2, // This is Step 3: Holdings Registration submission
      // Reset Step 3 for resubmission (will skip auto check)
      // If lock expired, clear lock fields (physical clearing)
      step3: isResubmission ? {
        ...wf.step3,
        lastResult: undefined, // Clear previous result for resubmission
        lastCheckedAt: undefined,
        lockedUntil: isLockExpired ? undefined : wf.step3?.lockedUntil, // Clear lock if expired
        failedAttempts: isLockExpired ? 0 : (wf.step3?.failedAttempts || 0), // Reset attempts if expired
      } : wf.step3,
      // Reset Step 4 for resubmission
      step4: isResubmission ? {
        ...step4,
        lastResult: undefined, // Clear previous IRO review result
        lastReviewedAt: undefined,
        iroDecision: isLockExpired ? undefined : (updatedIRODecision || step4.iroDecision), // Clear rejection metadata if expired
      } : wf.step4,
    },
  };

  // Resubmission: Skip automatic verification, go directly to UNDER_REVIEW
  if (isResubmission) {
    return {
      ...withStep2,
      status: isLockExpired ? RegistrationStatus.PENDING_REVIEW : RegistrationStatus.FURTHER_INFO_REQUIRED, // PENDING_REVIEW if lock expired
      shareholdingsVerification: {
        ...withStep2.shareholdingsVerification!,
        step3: {
          ...withStep2.shareholdingsVerification!.step3,
          lastResult: undefined, // No auto check for resubmission
        },
        step4: {
          ...withStep2.shareholdingsVerification!.step4,
          lastResult: undefined, // Awaiting IRO review
        },
      },
    };
  }

  // First-time submission: Automatically run Step 4 verification immediately after Step 3 submission
  // This only runs if shareholders data is provided
  if (shareholders && shareholders.length > 0) {
    return runAutoVerification(withStep2, shareholders);
  }

  return withStep2;
}

export function runAutoVerification(applicant: Applicant, shareholders: Shareholder[]): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  if (isLocked(a)) return a;
  if (!wf.step1?.wantsVerification) return a;
  if (!wf.step2) return a;

  const checkedAt = nowIso();
  const submission = wf.step2;
  const step3 = wf.step3 || { failedAttempts: 0 };

  // Automatic verification: check Shareholdings ID + Company Name, and Country if provided.
  const target = shareholders.find((s) => {
    if (normalizeId(s.id) !== normalizeId(submission.shareholdingsId)) return false;
    if (normalizeCompanyName(s.name) !== normalizeCompanyName(submission.companyName)) return false;
    if (submission.country && submission.country.trim()) {
      if (normalizeCountry(s.country) !== normalizeCountry(submission.country)) return false;
    }
    return true;
  });

  if (target) {
    return {
      ...a,
      // Step 4 match: UNDER_REVIEW -> PENDING_REVIEW status
      status: RegistrationStatus.PENDING_REVIEW,
      shareholdingsVerification: {
        ...wf,
        step3: {
          ...step3,
          lastResult: 'MATCH',
          failedAttempts: 0, // Reset failed attempts on match
          lockedUntil: undefined, // Clear lockout on match
          lastCheckedAt: checkedAt,
        },
      },
    };
  }

  const failedAttempts = (step3.failedAttempts || 0) + 1;
  const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
  const lockedUntil = shouldLock ? addDaysIso(checkedAt, LOCKOUT_DAYS) : step3.lockedUntil;

  // When failed attempts reach 3, set lock and optionally set status to REJECTED
  return {
    ...a,
    status: shouldLock ? RegistrationStatus.REJECTED : RegistrationStatus.FURTHER_INFO_REQUIRED,
    shareholdingsVerification: {
      ...wf,
      step3: {
        ...step3,
        lastResult: 'NO_MATCH',
        failedAttempts,
        lockedUntil, // Set 7-day lock when failed attempts reach 3
        lastCheckedAt: checkedAt,
      },
    },
  };
}

/**
 * Request manual IRO verification after Step 4 (Automatic Verification) fails
 * This allows users to request manual checking even if automatic verification failed
 * 
 * Flow:
 * 1. Step 4 fails (NO_MATCH) -> Status: RESUBMISSION_REQUIRED
 * 2. User requests manual verification (this function)
 * 3. Status changes to AWAITING_IRO_REVIEW -> Goes directly to Step 5
 * 
 * This bypasses the need to resubmit and allows IRO to manually review the original submission
 */
export function requestManualVerification(applicant: Applicant): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  if (isLocked(a)) {
    // If locked, user cannot request manual verification until lockout expires
    return a;
  }

  // Only allow manual verification request if Step 4 failed (NO_MATCH)
  if (wf.step3?.lastResult !== 'NO_MATCH') {
    // If Step 4 hasn't failed or already passed, no need to request manual verification
    return a;
  }

  // If already in IRO review, don't change anything
  if (wf.step4?.lastResult !== undefined) {
    return a;
  }

  const requestedAt = nowIso();

  // Change status to AWAITING_IRO_REVIEW
  // This allows the submission to go directly to Step 5 (Manual IRO Verification)
  // without requiring resubmission
  const step4 = wf.step4 || { failedAttempts: 0 };
  
  return {
    ...a,
    status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend, AWAITING_IRO_REVIEW internally
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...step4,
        // Keep step3.lastResult as 'NO_MATCH' to track that auto verification failed
        // But allow manual review to proceed
        lastResult: undefined, // No IRO decision yet, awaiting review
        lastReviewedAt: undefined, // Will be set when IRO reviews
        // Track that this was a manual verification request
        manualVerificationRequestedAt: requestedAt,
      },
    },
  };
}

export function recordManualReview(applicant: Applicant, match: boolean): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  if (isLocked(a)) return a;
  
  const step3 = wf.step3 || { failedAttempts: 0 };
  const step4 = wf.step4 || { failedAttempts: 0 };

  // Allow IRO actions even if user declined shareholdings verification
  // If wantsVerification is false, we can still manually approve/reject
  const isShareholdingsDeclined = wf.step1?.wantsVerification === false;
  
  // For shareholdings declined accounts, we can still approve/reject without step2.
  // IMPORTANT: IRO actions should also be allowed even if step2 is missing (some legacy/imported
  // applicants may not have completed the holdings submission state yet).

  const reviewedAt = nowIso();

  // Create IRO decision record
  const iroDecision: IRODecision = {
    decision: match ? 'APPROVED' : 'REJECTED',
    decisionAt: reviewedAt,
    complianceStatus: match ? 'NO_COMPLIANCE_REQUIRED' : 'AWAITING_USER_RESPONSE',
    resubmissionCount: 0,
  };

  // Add to decision history
  const decisionHistory = step4.iroDecisionHistory || [];
  if (step4.iroDecision) {
    decisionHistory.push(step4.iroDecision);
  }

  if (match) {
    // For shareholdings declined accounts, create minimal workflow state for approval
    if (isShareholdingsDeclined) {
      return {
        ...a,
        status: RegistrationStatus.APPROVED,
        lastIRODecisionAt: reviewedAt,
        complianceStatus: 'NO_COMPLIANCE_REQUIRED',
        shareholdingsVerification: {
          ...wf,
          step4: {
            ...step4,
            lastResult: 'MATCH',
            failedAttempts: 0,
            lastReviewedAt: reviewedAt,
            iroDecision,
            iroDecisionHistory: decisionHistory,
          },
          step6: { verifiedAt: reviewedAt },
        },
      };
    }
    
    return {
      ...a,
      // Phase 3 / Step 6: Verified Account (no shareholding OTP step in new workflow)
      status: RegistrationStatus.APPROVED,
      lastIRODecisionAt: reviewedAt,
      complianceStatus: 'NO_COMPLIANCE_REQUIRED',
      shareholdingsVerification: {
        ...wf,
        step4: {
          ...step4,
          lastResult: 'MATCH',
          failedAttempts: 0, // Reset failed attempts on match
          lastReviewedAt: reviewedAt,
          iroDecision,
          iroDecisionHistory: decisionHistory,
        },
        step6: { verifiedAt: reviewedAt },
      },
    };
  }

  // IRO rejected: always set 7-day lock
  // Service must:
  // - Set applicant.status = RegistrationStatus.REJECTED
  // - Set wf.step3.lockedUntil = now + 7 days
  // - Set wf.step4.lastResult = 'NO_MATCH'
  const lockedUntil = addDaysIso(reviewedAt, LOCKOUT_DAYS);
  const failedAttempts = (step4.failedAttempts || 0) + 1;

  return {
    ...a,
    status: RegistrationStatus.REJECTED,
    lastIRODecisionAt: reviewedAt,
    complianceStatus: 'AWAITING_USER_RESPONSE',
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...step4,
        lastResult: 'NO_MATCH',
        failedAttempts,
        lastReviewedAt: reviewedAt,
        iroDecision,
        iroDecisionHistory: decisionHistory,
      },
      step3: {
        ...step3,
        lockedUntil, // Always set 7-day lock on rejection
      },
      step6: undefined,
    },
  };
}

/**
 * Record IRO request for further information
 * This keeps the applicant in AWAITING_IRO_REVIEW state but records the IRO action
 * The status is set to FURTHER_INFO (which maps to PENDING in frontend)
 */
export function recordRequestInfo(applicant: Applicant): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  if (isLocked(a)) return a;
  
  const step4 = wf.step4 || { failedAttempts: 0 };

  // Allow IRO actions even if user declined shareholdings verification
  const isShareholdingsDeclined = wf.step1?.wantsVerification === false;
  
  // For shareholdings declined accounts, we can still request info without step2.
  // IMPORTANT: IRO actions should also be allowed even if step2 is missing.

  const requestedAt = nowIso();

  // Create IRO decision record
  const iroDecision: IRODecision = {
    decision: 'REQUEST_INFO',
    decisionAt: requestedAt,
    complianceStatus: 'AWAITING_USER_RESPONSE',
    resubmissionCount: 0,
  };

  // Add to decision history
  const decisionHistory = step4.iroDecisionHistory || [];
  if (step4.iroDecision) {
    decisionHistory.push(step4.iroDecision);
  }

  // Request Info: Keep in AWAITING_IRO_REVIEW state, set status to FURTHER_INFO
  // Don't change step4.lastResult - keep it as undefined or existing value
  // This allows the user to resubmit and go through the workflow again
  return {
    ...a,
    status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend
    lastIRODecisionAt: requestedAt,
    complianceStatus: 'AWAITING_USER_RESPONSE',
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...step4,
        // Don't set lastResult - keep awaiting review
        // Record that IRO requested info
        lastReviewedAt: requestedAt,
        iroDecision,
        iroDecisionHistory: decisionHistory,
      },
    },
  };
}


export function getAutoMatchResult(applicant: Applicant): ShareholdingsVerificationMatchResult | undefined {
  return applicant.shareholdingsVerification?.step3?.lastResult;
}

/**
 * Get the internal workflow status based on applicant state
 * This is a strictly read-only resolver that never mutates Firestore data.
 * 
 * Strict Evaluation Order (Must Follow Exactly):
 * Step 1: Pre-Verified Workflow Stage Check (Backend Only)
 * Step 2: Email Verification Gate
 * Step 3: Lock Check (Logical Only)
 * Step 4: Registration Status Mapping
 * Step 5: Default Fallback
 */
export async function getWorkflowStatusInternal(applicant: Applicant): Promise<WorkflowStatusInternal> {
  const wf = applicant.shareholdingsVerification;

  // Step 1: Pre-Verified Workflow Stage Check (Backend Only)
  // These statuses are for backend / IRO tracking only. They will not be shown in dynamic home.
  if (applicant.workflowStage === 'ACCOUNT_CLAIMED') {
    return 'ACCOUNT_CLAIMED';
  }
  if (applicant.workflowStage === 'INVITE_EXPIRED') {
    return 'INVITATION_EXPIRED';
  }

  // Step 2: Email Verification Gate
  // Check OTP verification document existence in emailVerificationCodes collection
  const emailVerified = await isEmailVerified(applicant.id);
  if (!emailVerified) {
    return 'SENT_EMAIL'; // Blocks all progression
  }

  // Step 3: Lock Check (Logical Only)
  // If lockedUntil exists, check if still locked or expired
  if (wf?.step3?.lockedUntil) {
    const lockedUntil = new Date(wf.step3.lockedUntil);
    if (lockedUntil.getTime() > Date.now()) {
      // Still locked - return LOCKED_FOR_7_DAYS
      return 'LOCKED_FOR_7_DAYS';
    }
    // Lock expired - treat as unlocked (do NOT mutate Firestore), continue
  }

  // Step 4: Registration Status Mapping
  // Map applicant.status (RegistrationStatus) to workflow stage
  if (applicant.status === RegistrationStatus.DRAFT) {
    return 'REGISTRATION_PENDING';
  }
  if (applicant.status === RegistrationStatus.PENDING_REVIEW) {
    return 'UNDER_REVIEW';
  }
  if (applicant.status === RegistrationStatus.FURTHER_INFO_REQUIRED) {
    return 'FURTHER_INFO_REQUIRED';
  }
  if (applicant.status === RegistrationStatus.APPROVED) {
    return 'VERIFIED';
  }
  if (applicant.status === RegistrationStatus.REJECTED) {
    // No REJECTED workflow stage exists - map to REGISTRATION_PENDING
    // (Lock check already happened in Step 3, so if we reach here, lock is expired)
    return 'REGISTRATION_PENDING';
  }

  // Handle legacy statuses for backward compatibility
  if (applicant.status === RegistrationStatus.PENDING) {
    // Check if workflow exists to determine if it's under review or pending registration
    if (wf?.step2) {
      return 'UNDER_REVIEW';
    }
    return 'REGISTRATION_PENDING';
  }
  if (applicant.status === RegistrationStatus.FURTHER_INFO) {
    return 'FURTHER_INFO_REQUIRED';
  }

  // Step 5: Default Fallback
  return 'REGISTRATION_PENDING';
}

/**
 * Map internal workflow status to frontend display label
 * Pre-verified statuses must NOT be visible in dynamic home. They should fallback safely.
 */
export function getWorkflowStatusFrontendLabel(
  internalStatus: WorkflowStatusInternal
): string {
  const mapping: Partial<Record<WorkflowStatusInternal, string>> = {
    'SENT_EMAIL': 'VERIFY EMAIL',
    'REGISTRATION_PENDING': 'CONTINUE TO VERIFY YOUR ACCOUNT',
    'UNDER_REVIEW': 'PENDING',
    'FURTHER_INFO_REQUIRED': 'VERIFY YOUR ACCOUNT',
    'LOCKED_FOR_7_DAYS': 'VERIFY YOUR ACCOUNT',
    'VERIFIED': 'VERIFIED',
  };

  // Pre-verified backend-only states should not surface
  if (internalStatus === 'ACCOUNT_CLAIMED') {
    return 'VERIFIED';
  }

  if (internalStatus === 'INVITATION_EXPIRED') {
    return '—';
  }

  return mapping[internalStatus] || 'CONTINUE TO VERIFY YOUR ACCOUNT';
}

/**
 * Map internal workflow status to General Account Status
 * Do not expose backend-only states directly.
 */
export function getGeneralAccountStatus(
  internalStatus: WorkflowStatusInternal
): GeneralAccountStatus {
  const mapping: Partial<Record<WorkflowStatusInternal, GeneralAccountStatus>> = {
    'SENT_EMAIL': 'UNVERIFIED',
    'REGISTRATION_PENDING': 'PENDING',
    'UNDER_REVIEW': 'PENDING',
    'FURTHER_INFO_REQUIRED': 'UNVERIFIED',
    'LOCKED_FOR_7_DAYS': 'UNVERIFIED',
    'VERIFIED': 'VERIFIED',
  };

  if (internalStatus === 'ACCOUNT_CLAIMED') {
    return 'VERIFIED';
  }

  if (internalStatus === 'INVITATION_EXPIRED') {
    return 'UNVERIFIED';
  }

  return mapping[internalStatus] || 'UNVERIFIED';
}

/**
 * Check if a user has not completed verification and is stuck/incomplete
 * Returns true if user needs to take action to continue verification
 */
export async function isVerificationIncomplete(applicant: Applicant): Promise<boolean> {
  const internalStatus = await getWorkflowStatusInternal(applicant);
  
  // Users who are stuck and need to take action
  const incompleteStatuses: WorkflowStatusInternal[] = [
    'REGISTRATION_PENDING',
    'FURTHER_INFO_REQUIRED',
  ];
  
  return incompleteStatuses.includes(internalStatus);
}

/**
 * Get the reason why verification is incomplete
 * Helps identify what action the user needs to take
 */
export async function getIncompleteReason(applicant: Applicant): Promise<string | null> {
  const wf = applicant.shareholdingsVerification;
  
  if (!wf) {
    return 'User has not started verification workflow';
  }
  
  // User hasn't made a decision about verification (after Step 2: Email Verification)
  if (wf.step1?.wantsVerification === undefined) {
    return 'User has completed email verification but has not decided whether to verify account for Investor community';
  }
  
  // User declined verification (after Step 2: Email Verification)
  if (wf.step1.wantsVerification === false) {
    return 'User declined shareholdings verification - Directed to Dynamic Home Page as unverified account';
  }
  
  // User agreed but hasn't submitted Step 3 (Holdings Registration)
  if (wf.step1.wantsVerification === true && !wf.step2) {
    return 'User agreed to verify but has not submitted holdings information (Step 3)';
  }
  
  // User submitted but needs to resubmit (FURTHER_INFO_REQUIRED)
  const internalStatus = await getWorkflowStatusInternal(applicant);
  if (internalStatus === 'FURTHER_INFO_REQUIRED') {
    return 'User needs to resubmit holdings information after rejection';
  }
  
  // User is locked
  if (internalStatus === 'LOCKED_FOR_7_DAYS') {
    return 'User account is locked due to multiple failed attempts or IRO rejection';
  }
  
  return null;
}

/**
 * Calculate how many days since user last made progress in verification
 * Returns the number of days, or null if user has completed verification
 */
export function getDaysSinceLastProgress(applicant: Applicant): number | null {
  const wf = applicant.shareholdingsVerification;
  if (!wf) {
    // Use submissionDate as baseline if no workflow
    if (applicant.submissionDate) {
      const days = Math.floor((Date.now() - new Date(applicant.submissionDate).getTime()) / (1000 * 60 * 60 * 24));
      return days;
    }
    return null;
  }
  
  // Check if user is verified
  const internalStatus = getWorkflowStatusInternal(applicant);
  if (internalStatus === 'VERIFIED') {
    return null; // User completed verification
  }
  
  // Find the most recent timestamp from workflow steps
  const timestamps: number[] = [];
  
  // Step 1: Use submissionDate as baseline
  if (applicant.submissionDate) {
    timestamps.push(new Date(applicant.submissionDate).getTime());
  }
  
  // Step 2: Holdings submission timestamp
  if (wf.step2?.submittedAt) {
    timestamps.push(new Date(wf.step2.submittedAt).getTime());
  }
  
  // Step 3: Auto verification timestamp
  if (wf.step3?.lastCheckedAt) {
    timestamps.push(new Date(wf.step3.lastCheckedAt).getTime());
  }
  
  // Step 4: IRO review timestamp
  if (wf.step4?.lastReviewedAt) {
    timestamps.push(new Date(wf.step4.lastReviewedAt).getTime());
  }
  
  // Step 6: Verification timestamp
  if (wf.step6?.verifiedAt) {
    timestamps.push(new Date(wf.step6.verifiedAt).getTime());
  }
  
  // Use lastActive as fallback
  if (applicant.lastActive) {
    try {
      const lastActiveTime = new Date(applicant.lastActive).getTime();
      if (!isNaN(lastActiveTime)) {
        timestamps.push(lastActiveTime);
      }
    } catch (e) {
      // Ignore invalid dates
    }
  }
  
  if (timestamps.length === 0) {
    return null;
  }
  
  const mostRecent = Math.max(...timestamps);
  const days = Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24));
  return days;
}

/**
 * Get all users who are stuck in the verification process
 * Useful for generating reports or sending reminders
 */
export async function getIncompleteVerifications(applicants: Applicant[]): Promise<Applicant[]> {
  const results = await Promise.all(
    applicants.map(async (applicant) => ({
      applicant,
      isIncomplete: await isVerificationIncomplete(applicant),
    }))
  );
  return results.filter(r => r.isIncomplete).map(r => r.applicant);
}

/**
 * Get users who have been stuck for a specific number of days or more
 * Useful for identifying users who need follow-up
 */
export async function getStuckUsers(applicants: Applicant[], minDays: number = 3): Promise<Applicant[]> {
  const results = await Promise.all(
    applicants.map(async (applicant) => ({
      applicant,
      isIncomplete: await isVerificationIncomplete(applicant),
      daysStuck: getDaysSinceLastProgress(applicant),
    }))
  );
  return results
    .filter(r => r.isIncomplete && r.daysStuck !== null && r.daysStuck >= minDays)
    .map(r => r.applicant);
}

/**
 * Get verification progress stage for tracking purposes
 * Returns a string describing the current stage the user is at
 */
export async function getVerificationStage(applicant: Applicant): Promise<string> {
  const wf = applicant.shareholdingsVerification;
  const internalStatus = await getWorkflowStatusInternal(applicant);
  
  if (!wf) {
    return 'Not Started';
  }
  
  if (internalStatus === 'VERIFIED') {
    return 'Completed';
  }
  
  if (wf.step1?.wantsVerification === undefined) {
    return 'Awaiting Decision (After Email Verification)';
  }
  
  if (wf.step1.wantsVerification === false) {
    return 'Declined - Unverified Account';
  }
  
  if (!wf.step2) {
    return 'Awaiting Holdings Submission (Step 3)';
  }
  
  if (wf.step3?.lastResult === undefined && !wf.step4?.lastResult) {
    return 'Awaiting Verification';
  }
  
  if (wf.step3?.lastResult === 'MATCH' && !wf.step4?.lastResult) {
    return 'Awaiting IRO Review';
  }
  
  if (wf.step4?.lastResult === 'NO_MATCH') {
    return 'Needs Resubmission';
  }
  
  if (internalStatus === 'LOCKED_FOR_7_DAYS') {
    return 'Locked';
  }
  
  if (internalStatus === 'FURTHER_INFO_REQUIRED') {
    return 'Needs Resubmission';
  }
  
  return 'In Progress';
}

/**
 * Mark user response to IRO decision
 * This function is called when IRO manually marks that a user has responded,
 * or when the system detects a user resubmission
 */
export function markUserResponse(applicant: Applicant, notes?: string): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;
  const step4 = wf.step4 || { failedAttempts: 0 };

  if (!step4.iroDecision) {
    // No IRO decision to respond to
    return a;
  }

  const respondedAt = nowIso();
  const updatedIRODecision: IRODecision = {
    ...step4.iroDecision,
    complianceStatus: 'USER_RESPONDED',
    userRespondedAt: respondedAt,
    notes: notes || step4.iroDecision.notes,
  };

  return {
    ...a,
    complianceStatus: 'USER_RESPONDED',
    userLastResponseAt: respondedAt,
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...step4,
        iroDecision: updatedIRODecision,
      },
    },
  };
}

/**
 * Mark compliance as complete (e.g., after IRO reviews user's response)
 */
export function markComplianceComplete(applicant: Applicant): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;
  const step4 = wf.step4 || { failedAttempts: 0 };

  if (!step4.iroDecision) {
    return a;
  }

  const updatedIRODecision: IRODecision = {
    ...step4.iroDecision,
    complianceStatus: 'COMPLIANCE_COMPLETE',
  };

  return {
    ...a,
    complianceStatus: 'COMPLIANCE_COMPLETE',
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...step4,
        iroDecision: updatedIRODecision,
      },
    },
  };
}


