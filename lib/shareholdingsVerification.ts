import { RegistrationStatus, Shareholder, ShareholdingsVerificationChannel, ShareholdingsVerificationMatchResult, ShareholdingsVerificationState, Applicant } from './types';

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DAYS = 7;
const CODE_VALIDITY_HOURS = 168; // 7 days (7 * 24 hours) as per requirements
const CODE_MAX_ATTEMPTS = 3;
// Step 5: cooldown period of 30 seconds to 1 minute. We enforce 1 minute.
const RESEND_COOLDOWN_MS = 60_000;

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

function generate6DigitCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

function formatExpiryDate(iso: string): string {
  // Human readable (demo). Example: Jan 30, 2026
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
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
        step5: undefined,
        step3: { failedAttempts: 0 },
        step4: { failedAttempts: 0 },
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

  // Step 2: Store submission, status will be set by Step 3 verification
  const withStep2 = {
    ...a,
    status: RegistrationStatus.PENDING, // Will be updated by Step 3
    shareholdingsVerification: {
      ...wf,
      step2,
    },
  };

  // Event-driven: Automatically run Step 3 verification immediately after Step 2 submission
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

  // Automatic verification: Only check Shareholdings ID and Company Name
  // Country is optional and only used for profile display, NOT for verification matching
  const target = shareholders.find((s) => {
    if (normalizeId(s.id) !== normalizeId(submission.shareholdingsId)) return false;
    if (normalizeCompanyName(s.name) !== normalizeCompanyName(submission.companyName)) return false;
    // Country is NOT checked - it's optional and only for profile display
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
    const verificationDeadline = addDaysIso(reviewedAt, 3); // 3 days from IRO approval
    return {
      ...a,
      // IRO approved: Keep status as FURTHER_INFO (PENDING) until code is verified
      status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend
      shareholdingsVerification: {
        ...wf,
        step4: {
          ...wf.step4,
          lastResult: 'MATCH',
          failedAttempts: 0, // Reset failed attempts on match
          lastReviewedAt: reviewedAt,
          verificationDeadlineAt: verificationDeadline, // Set 3-day deadline
        },
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
    },
  };
}

export function sendVerificationCode(
  applicant: Applicant,
  channel: ShareholdingsVerificationChannel,
  loginLink: string,
  isManual: boolean = false // Track if this is a manual send (one-time only)
): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;
  if (isLocked(a)) return a;
  if (!wf.step1.wantsVerification) return a;
  if (!wf.step2) return a;
  if (wf.step3.lastResult !== 'MATCH' || wf.step4.lastResult !== 'MATCH') return a; // Only send if auto and manual passed

  // If manual send, check if it was already used (one-time only)
  if (isManual && wf.step5?.manuallySentAt) {
    return a; // Already manually sent, don't allow again
  }

  const issuedAt = nowIso();
  const expiresAt = addHoursIso(issuedAt, CODE_VALIDITY_HOURS);
  const code = generate6DigitCode();

  const messagePreview =
    `Your verification code is ${code}\n` +
    `Expires on ${formatExpiryDate(expiresAt)}\n` +
    `If you did not request this, ignore this message.\n` +
    `${loginLink}`;

  // Simulated delivery (no provider integration in this demo)
  const recipient = channel === 'EMAIL' ? wf.step1.email : wf.step1.contactNumber;
  console.info(
    `[ShareholdingsVerification] Simulated ${channel} send to ${recipient}: code=${code}, expires=${expiresAt}${isManual ? ' (MANUAL SEND)' : ''}`
  );

  return {
    ...a,
    // CODE_SENT: Code sent, waiting for user to enter -> PENDING status (FURTHER_INFO)
    status: RegistrationStatus.FURTHER_INFO, // PENDING in frontend
    shareholdingsVerification: {
      ...wf,
      step5: {
        channel,
        code,
        expiresAt,
        attemptsRemaining: CODE_MAX_ATTEMPTS,
        messagePreview,
        ...(isManual && { manuallySentAt: issuedAt }), // Track manual send timestamp
      },
    },
  };
}

export function resendVerificationCode(applicant: Applicant, loginLink: string): Applicant {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;
  if (isLocked(a)) return a;
  if (!wf.step5) return a;

  const now = nowIso();
  const resendAvailableAt = wf.step5.resendAvailableAt;
  if (isFutureIso(resendAvailableAt)) return a;

  const nextResendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_MS).toISOString();
  const updated = sendVerificationCode(a, wf.step5.channel, loginLink);
  const nextWf = updated.shareholdingsVerification!;

  return {
    ...updated,
    shareholdingsVerification: {
      ...nextWf,
      step5: {
        ...nextWf.step5!,
        resendAvailableAt: nextResendAvailableAt,
      },
    },
  };
}

export function verifyCode(applicant: Applicant, enteredCode: string): { success: boolean; applicant: Applicant } {
  const a = ensureWorkflow(applicant);
  const wf = a.shareholdingsVerification!;
  
  if (!wf.step5) {
    return { success: false, applicant: a };
  }

  // Check if code is expired
  const expiresAt = new Date(wf.step5.expiresAt);
  if (expiresAt.getTime() <= Date.now()) {
    return { success: false, applicant: a };
  }

  // Check if code is invalidated
  if (wf.step5.invalidatedAt) {
    const invalidatedAt = new Date(wf.step5.invalidatedAt);
    if (invalidatedAt.getTime() <= Date.now()) {
      return { success: false, applicant: a };
    }
  }

  // Check if attempts remaining
  if (wf.step5.attemptsRemaining <= 0) {
    return { success: false, applicant: a };
  }

  // Verify code
  const codeMatch = wf.step5.code === enteredCode.trim();
  
  if (codeMatch) {
    // VERIFIED: Successfully completed verification
    return {
      success: true,
      applicant: {
        ...a,
        status: RegistrationStatus.APPROVED, // VERIFIED status
        shareholdingsVerification: {
          ...wf,
          step5: {
            ...wf.step5,
            attemptsRemaining: 0, // Mark as used
          },
        },
      },
    };
  }

  // Code mismatch - decrement attempts
  const attemptsRemaining = wf.step5.attemptsRemaining - 1;
  const invalidatedAt = attemptsRemaining <= 0 ? nowIso() : undefined;

  return {
    success: false,
    applicant: {
      ...a,
      shareholdingsVerification: {
        ...wf,
        step5: {
          ...wf.step5,
          attemptsRemaining,
          invalidatedAt,
        },
      },
    },
  };
}

export function getVerificationDeadlineInfo(applicant: Applicant): {
  daysRemaining: number;
  needsVerification: boolean;
} | null {
  const step4 = applicant.shareholdingsVerification?.step4;
  
  // Only show for approved applicants who haven't had code sent yet
  // Check if status is APPROVED OR FURTHER_INFO (since recordManualReview sets it to FURTHER_INFO)
  const isApprovedState = applicant.status === RegistrationStatus.APPROVED || 
                          applicant.status === RegistrationStatus.FURTHER_INFO;
  
  if (
    !isApprovedState ||
    !step4?.verificationDeadlineAt ||
    step4.lastResult !== 'MATCH' ||
    applicant.shareholdingsVerification?.step5?.manuallySentAt // Code already sent
  ) {
    return null;
  }
  
  const deadline = new Date(step4.verificationDeadlineAt);
  const now = new Date();
  const msRemaining = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  
  // Only show if deadline hasn't passed
  if (daysRemaining <= 0) {
    return null; // Deadline passed, don't show notification
  }
  
  return {
    daysRemaining: Math.max(0, daysRemaining),
    needsVerification: true,
  };
}

export function getAutoMatchResult(applicant: Applicant): ShareholdingsVerificationMatchResult | undefined {
  return applicant.shareholdingsVerification?.step3.lastResult;
}


