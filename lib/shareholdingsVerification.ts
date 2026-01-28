import { RegistrationStatus, Shareholder, ShareholdingsVerificationMatchResult, ShareholdingsVerificationState, Applicant, WorkflowStatusInternal, GeneralAccountStatus } from './types';

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
  if (applicant.shareholdingsVerification) return applicant;

  const parts = applicant.fullName.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';

  const state: ShareholdingsVerificationState = {
    step1: {
      firstName,
      lastName,
      email: applicant.email,
      contactNumber: applicant.phoneNumber || '',
      authProvider: 'GOOGLE',
      // wantsVerification is intentionally undefined until set by Step 1 decision
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

export function isLocked(applicant: Applicant): boolean {
  const wf = applicant.shareholdingsVerification;
  return isFutureIso(wf?.step3.lockedUntil);
}

export function setWantsVerification(applicant: Applicant, wantsVerification: boolean): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  const next: ShareholdingsVerificationState = {
    ...wf,
    step1: { ...wf.step1, wantsVerification },
  };

  if (!wantsVerification) {
    // Step 1 decision "No": redirect as unverified. In this admin-only demo, we mark unverified.
    return {
      ...a,
      status: RegistrationStatus.PENDING, // UNVERIFIED status
      shareholdingsVerification: {
        ...next,
        step2: undefined,
        step3: { failedAttempts: 0 },
        step4: { failedAttempts: 0 },
        step6: undefined,
      },
    };
  }

  // REGISTRATION_PENDING: User wants verification but hasn't submitted Step 2 yet
  // Status should be PENDING (UNVERIFIED) until they submit
  return { 
    ...a, 
    status: RegistrationStatus.PENDING, // UNVERIFIED status until Step 2 submission
    shareholdingsVerification: next 
  };
}

/**
 * Submit shareholdings registration information (Step 2)
 * 
 * Required fields:
 * - shareholdingsId: Registration/Shareholdings ID (required)
 * - companyName: Company Name (required)
 * 
 * Optional fields:
 * - country: Country (optional) - Only used for profile display, NOT for verification matching
 * 
 * Automatic verification (Step 3) will check:
 * - Shareholdings ID matches
 * - Company Name matches
 * - Country is NOT checked (optional field for display only)
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

  // Check if this is a resubmission after RESUBMISSION_REQUIRED
  // If Step 4 has a NO_MATCH result, this is a resubmission - skip auto verification
  const isResubmission = wf.step4.lastResult === 'NO_MATCH';

  // Step 2: Store submission, status will be set by Step 3 verification
  const withStep2 = {
    ...a,
    status: RegistrationStatus.PENDING, // Will be updated by Step 3 or Step 4
    shareholdingsVerification: {
      ...wf,
      step2,
      // Reset Step 3 for resubmission (will skip auto check)
      step3: isResubmission ? {
        ...wf.step3,
        lastResult: undefined, // Clear previous result for resubmission
        lastCheckedAt: undefined,
      } : wf.step3,
      // Reset Step 4 for resubmission
      step4: isResubmission ? {
        ...wf.step4,
        lastResult: undefined, // Clear previous IRO review result
        lastReviewedAt: undefined,
      } : wf.step4,
    },
  };

  // Resubmission: Skip automatic verification, go directly to AWAITING_IRO_REVIEW
  if (isResubmission) {
    return {
      ...withStep2,
      status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend
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

  // First-time submission: Automatically run Step 3 verification immediately after Step 2 submission
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
  if (!wf.step1.wantsVerification) return a;
  if (!wf.step2) return a;

  const checkedAt = nowIso();
  const submission = wf.step2;

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
      // Step 3 match: AWAITING_IRO_REVIEW -> PENDING status (FURTHER_INFO)
      status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend
      shareholdingsVerification: {
        ...wf,
        step3: {
          ...wf.step3,
          lastResult: 'MATCH',
          failedAttempts: 0, // Reset failed attempts on match
          lockedUntil: undefined, // Clear lockout on match
          lastCheckedAt: checkedAt,
        },
      },
    };
  }

  const failedAttempts = (wf.step3.failedAttempts || 0) + 1;
  const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? addDaysIso(checkedAt, LOCKOUT_DAYS) : wf.step3.lockedUntil;

  // AUTO_CHECK_FAILED: Failed Step 3 but not locked yet -> UNVERIFIED (PENDING)
  // LOCKED_7_DAYS: Failed 3 times -> UNVERIFIED (PENDING)
  return {
    ...a,
    status: RegistrationStatus.PENDING, // Both AUTO_CHECK_FAILED and LOCKED_7_DAYS are UNVERIFIED
    shareholdingsVerification: {
      ...wf,
      step3: {
        ...wf.step3,
        lastResult: 'NO_MATCH',
        failedAttempts,
        lockedUntil,
        lastCheckedAt: checkedAt,
      },
    },
  };
}

export function recordManualReview(applicant: Applicant, match: boolean): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;

  if (isLocked(a)) return a;
  if (!wf.step1.wantsVerification) return a;
  if (!wf.step2) return a;

  const reviewedAt = nowIso();

  if (match) {
    return {
      ...a,
      // Phase 3 / Step 6: Verified Account (no shareholding OTP step in new workflow)
      status: RegistrationStatus.APPROVED,
      shareholdingsVerification: {
        ...wf,
        step4: {
          ...wf.step4,
          lastResult: 'MATCH',
          failedAttempts: 0, // Reset failed attempts on match
          lastReviewedAt: reviewedAt,
        },
        step6: { verifiedAt: reviewedAt },
      },
    };
  }

  const failedAttempts = (wf.step4.failedAttempts || 0) + 1;
  const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? addDaysIso(reviewedAt, LOCKOUT_DAYS) : wf.step3.lockedUntil;

  // IRO review failed: If 3 failures, lock and set to UNVERIFIED (PENDING)
  // Otherwise, keep as PENDING (UNVERIFIED) for resubmission
  return {
    ...a,
    status: RegistrationStatus.PENDING, // UNVERIFIED status
    shareholdingsVerification: {
      ...wf,
      step4: {
        ...wf.step4,
        lastResult: 'NO_MATCH',
        failedAttempts,
        lastReviewedAt: reviewedAt,
      },
      step3: {
        ...wf.step3,
        lockedUntil,
      },
      step6: undefined,
    },
  };
}


export function getAutoMatchResult(applicant: Applicant): ShareholdingsVerificationMatchResult | undefined {
  return applicant.shareholdingsVerification?.step3.lastResult;
}

/**
 * Get the internal workflow status based on applicant state
 * This determines the current phase of the verification workflow
 */
export function getWorkflowStatusInternal(applicant: Applicant): WorkflowStatusInternal {
  const wf = applicant.shareholdingsVerification;
  const emailOtp = applicant.emailOtpVerification;

  // Phase 1: Email Verification (highest priority if not completed)
  // EMAIL_VERIFICATION_PENDING: OTP sent but not verified yet
  if (emailOtp) {
    // Check if email is verified
    if (emailOtp.verifiedAt) {
      // Email is verified - continue to shareholdings workflow check below
    } else {
      // Email not verified yet - check if OTP is still valid
      const isExpired = emailOtp.expiresAt ? new Date(emailOtp.expiresAt).getTime() <= Date.now() : true;
      const hasAttempts = emailOtp.attemptsRemaining !== undefined && emailOtp.attemptsRemaining > 0;
      
      if (!isExpired && hasAttempts) {
        return 'EMAIL_VERIFICATION_PENDING';
      }
      // If expired or no attempts, still show as pending (user needs to request new code)
      // But for now, we'll treat expired as needing resubmission
      // This could be refined to show a specific "OTP expired" state
    }
  } else {
    // No email OTP state - check if workflow exists (for backward compatibility)
    if (!wf) {
      // No workflow started - default to email verification pending
      return 'EMAIL_VERIFICATION_PENDING';
    }
  }

  // Phase 2: Shareholdings Verification (only if email is verified or no email OTP required)
  if (!wf) {
    // If email is verified but no shareholdings workflow, show email verified
    if (emailOtp?.verifiedAt) {
      return 'EMAIL_VERIFIED';
    }
    return 'EMAIL_VERIFICATION_PENDING';
  }

  // SHAREHOLDINGS_DECLINED: User declined shareholdings verification
  if (wf.step1.wantsVerification === false) {
    return 'SHAREHOLDINGS_DECLINED';
  }

  // REGISTRATION_PENDING: User agreed but hasn't submitted Step 2
  if (wf.step1.wantsVerification === true && !wf.step2) {
    return 'REGISTRATION_PENDING';
  }

  // Check if locked (7-day lockout after 3 failed attempts)
  if (wf.step3.lockedUntil) {
    const lockedUntil = new Date(wf.step3.lockedUntil);
    if (lockedUntil.getTime() > Date.now()) {
      // Still locked - treat as resubmission required
      return 'RESUBMISSION_REQUIRED';
    }
  }

  // VERIFIED: Status is APPROVED and Step 6 exists (completed verification)
  if (applicant.status === RegistrationStatus.APPROVED && wf.step6?.verifiedAt) {
    return 'VERIFIED';
  }

  // Handle resubmission scenario: Step 2 exists but Step 3 has no result (skipped auto check)
  // This means user resubmitted after RESUBMISSION_REQUIRED, goes directly to IRO review
  if (wf.step2 && wf.step3.lastResult === undefined && !wf.step4.lastResult) {
    return 'AWAITING_IRO_REVIEW';
  }

  // Step 3: Auto check passed
  if (wf.step3.lastResult === 'MATCH') {
    // AWAITING_IRO_REVIEW: Step 3 passed, waiting for IRO review
    if (!wf.step4.lastResult) {
      return 'AWAITING_IRO_REVIEW';
    }

    // Step 4: IRO review passed -> VERIFIED
    if (wf.step4.lastResult === 'MATCH') {
      return 'VERIFIED';
    }

    // Step 4: IRO review failed -> RESUBMISSION_REQUIRED
    if (wf.step4.lastResult === 'NO_MATCH') {
      return 'RESUBMISSION_REQUIRED';
    }
  }

  // Step 3: Auto check failed -> RESUBMISSION_REQUIRED
  if (wf.step3.lastResult === 'NO_MATCH') {
    return 'RESUBMISSION_REQUIRED';
  }

  // Default fallback - if email verified but no shareholdings decision yet
  if (emailOtp?.verifiedAt && wf.step1.wantsVerification === undefined) {
    return 'EMAIL_VERIFIED';
  }

  // If Step 2 exists but no Step 3 result yet (shouldn't happen, but handle gracefully)
  if (wf.step2 && wf.step3.lastResult === undefined) {
    return 'REGISTRATION_PENDING';
  }

  return 'REGISTRATION_PENDING';
}

/**
 * Map internal workflow status to frontend display label
 */
export function getWorkflowStatusFrontendLabel(internalStatus: WorkflowStatusInternal): string {
  const mapping: Record<WorkflowStatusInternal, string> = {
    'EMAIL_VERIFICATION_PENDING': 'VERIFY EMAIL',
    'EMAIL_VERIFIED': 'VERIFIED EMAIL NOTIFICATION',
    'SHAREHOLDINGS_DECLINED': 'VERIFY YOUR ACCOUNT',
    'REGISTRATION_PENDING': 'CONTINUE TO VERIFY YOUR ACCOUNT',
    'AWAITING_IRO_REVIEW': 'PENDING',
    'RESUBMISSION_REQUIRED': 'VERIFY YOUR ACCOUNT',
    'VERIFIED': 'VERIFIED',
  };
  return mapping[internalStatus] || 'CONTINUE TO VERIFY YOUR ACCOUNT';
}

/**
 * Map internal workflow status to General Account Status
 * This provides a high-level status for dashboard display
 */
export function getGeneralAccountStatus(internalStatus: WorkflowStatusInternal): GeneralAccountStatus {
  const mapping: Record<WorkflowStatusInternal, GeneralAccountStatus> = {
    'EMAIL_VERIFICATION_PENDING': 'UNVERIFIED',
    'EMAIL_VERIFIED': 'UNVERIFIED',
    'SHAREHOLDINGS_DECLINED': 'UNVERIFIED',
    'REGISTRATION_PENDING': 'PENDING',
    'AWAITING_IRO_REVIEW': 'PENDING',
    'RESUBMISSION_REQUIRED': 'UNVERIFIED',
    'VERIFIED': 'VERIFIED',
  };
  return mapping[internalStatus] || 'UNVERIFIED';
}


