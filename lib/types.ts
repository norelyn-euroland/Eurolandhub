
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

export type ShareholdingsVerificationChannel = 'EMAIL' | 'SMS';
export type ShareholdingsVerificationMatchResult = 'MATCH' | 'NO_MATCH';

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
  verificationDeadlineAt?: string; // ISO string - 3 days from IRO approval
}

export interface ShareholdingsVerificationStep5 {
  channel: ShareholdingsVerificationChannel;
  code: string;
  expiresAt: string; // ISO string
  attemptsRemaining: number;
  invalidatedAt?: string; // ISO string
  resendAvailableAt?: string; // ISO string
  messagePreview: string;
  manuallySentAt?: string; // ISO string - tracks if manual send button was used (one-time only)
}

export interface ShareholdingsVerificationState {
  step1: ShareholdingsVerificationStep1;
  step2?: ShareholdingsVerificationStep2;
  step3: ShareholdingsVerificationStep3;
  step4: ShareholdingsVerificationStep4;
  step5?: ShareholdingsVerificationStep5;
}

// @google/genai guidelines: Define a shared ViewType for navigation consistency
export type ViewType = 'dashboard' | 'registrations' | 'detail' | 'shareholders' | 'compliance' | 'firebase';

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
