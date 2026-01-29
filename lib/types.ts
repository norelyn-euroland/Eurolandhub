
export enum RegistrationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FURTHER_INFO = 'FURTHER_INFO'
}

export enum AccountType {
  INDIVIDUAL = 'INDIVIDUAL',
  JOINT = 'JOINT',
  TRUST = 'TRUST',
  CORPORATE = 'CORPORATE',
  ORDINARY = 'ORDINARY'
}

export type ShareholdingsVerificationMatchResult = 'MATCH' | 'NO_MATCH';

/**
 * Internal workflow status states (used by system logic)
 */
export type WorkflowStatusInternal =
  | 'EMAIL_VERIFICATION_PENDING'
  | 'EMAIL_VERIFIED'
  | 'SHAREHOLDINGS_DECLINED'
  | 'REGISTRATION_PENDING'
  | 'AWAITING_IRO_REVIEW'
  | 'RESUBMISSION_REQUIRED'
  | 'LOCKED_FOR_7_DAYS'
  | 'VERIFIED';

/**
 * Frontend display labels for workflow status
 */
export type WorkflowStatusFrontend =
  | 'VERIFY EMAIL'
  | 'VERIFIED EMAIL NOTIFICATION'
  | 'VERIFY YOUR ACCOUNT'
  | 'CONTINUE TO VERIFY YOUR ACCOUNT'
  | 'PENDING'
  | 'VERIFIED';

/**
 * General Account Status - High-level status for dashboard display
 */
export type GeneralAccountStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';

export interface EmailOtpVerificationState {
  /**
   * Email OTP (Phase 1 / Step 2)
   * - Expires in 1 hour
   * - 3 attempts max
   * - After 3 failures: lock for 3 days (user can retry verification after 3 days)
   */
  lastIssuedAt?: string; // ISO
  expiresAt?: string; // ISO
  attemptsRemaining?: number;
  lockedUntil?: string; // ISO
  verifiedAt?: string; // ISO
}

export interface ShareholdingsVerificationStep1 {
  firstName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  authProvider: 'GOOGLE';
  wantsVerification?: boolean;
}

export interface ShareholdingsVerificationStep2 {
  shareholdingsId: string;
  companyName: string;
  country?: string;
  submittedAt: string; // ISO string
}

export interface ShareholdingsVerificationStep3 {
  lastResult?: ShareholdingsVerificationMatchResult;
  failedAttempts: number;
  lockedUntil?: string; // ISO string
  lastCheckedAt?: string; // ISO string
}

export interface ShareholdingsVerificationStep4 {
  lastResult?: ShareholdingsVerificationMatchResult;
  failedAttempts: number;
  lastReviewedAt?: string; // ISO string
}

export interface ShareholdingsVerificationState {
  step1: ShareholdingsVerificationStep1;
  step2?: ShareholdingsVerificationStep2;
  step3: ShareholdingsVerificationStep3;
  step4: ShareholdingsVerificationStep4;
  step6?: { verifiedAt: string }; // ISO string (Phase 3 / Step 6)
}

// @google/genai guidelines: Define a shared ViewType for navigation consistency
export type ViewType = 'dashboard' | 'registrations' | 'detail' | 'shareholders';

export interface HoldingsDataPoint {
  timestamp: string; // ISO string
  share_price: number; // USD
  shares_held: number; // absolute shares
  total_shares_outstanding: number; // absolute shares
}

export interface HoldingsRecord {
  companyId: string; // Maps to Shareholder.id
  companyName: string; // Maps to Shareholder.name
  sharesHeld: number;
  ownershipPercentage: number;
  sharesClass: string; // Maps to Shareholder.accountType
  registrationDate: string;
}

export interface HoldingsSummary {
  companyId: string;
  companyName: string;
  sharesHeld: number;
  ownershipPercentage: number;
  sharesClass: string;
  registrationDate: string;
  currentSharePrice: number;
  currentMarketValue: number;
  timeSeriesData: HoldingsDataPoint[];
}

export interface Applicant {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  location?: string;
  submissionDate: string;
  lastActive: string;
  status: RegistrationStatus;
  idDocumentUrl: string;
  taxDocumentUrl: string;
  holdingsRecord?: HoldingsRecord; // Optional, only for verified shareholders
  emailOtpVerification?: EmailOtpVerificationState;
  shareholdingsVerification?: ShareholdingsVerificationState;
}

export interface Shareholder {
  rank: number;
  holdings: number;
  stake: number;
  id: string;
  name: string;
  firstName?: string;
  coAddress: string;
  country: string;
  accountType: AccountType | string;
}

export interface AIAnalysisResult {
  riskScore: number;
  summary: string;
  discrepancies: string[];
  recommendation: string;
}
