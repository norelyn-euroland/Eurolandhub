
export enum RegistrationStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  FURTHER_INFO_REQUIRED = 'FURTHER_INFO_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  // Legacy statuses for backward compatibility
  PENDING = 'PENDING',
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
 * Compliance status for tracking user response to IRO decisions
 */
export type ComplianceStatus =
  | 'AWAITING_USER_RESPONSE' // IRO made a decision, waiting for user to respond
  | 'USER_RESPONDED' // User has responded (resubmitted or provided info)
  | 'COMPLIANCE_COMPLETE' // User has fully complied with IRO request
  | 'NO_COMPLIANCE_REQUIRED'; // No compliance needed (e.g., approved)

/**
 * IRO decision tracking
 */
export interface IRODecision {
  decision: 'APPROVED' | 'REJECTED' | 'REQUEST_INFO';
  decisionAt: string; // ISO timestamp
  decisionBy?: string; // IRO identifier (optional)
  emailSentAt?: string; // ISO timestamp when email was sent
  complianceStatus: ComplianceStatus;
  userRespondedAt?: string; // ISO timestamp when user responded
  resubmissionCount?: number; // Number of times user has resubmitted after this decision
  notes?: string; // Optional notes about the decision
}

/**
 * Internal workflow status states (used by system logic)
 */
export type WorkflowStatusInternal =
  | 'SENT_EMAIL'              // Email not verified (gate)
  | 'REGISTRATION_PENDING'    // Email verified, ready to register
  | 'UNDER_REVIEW'            // Application submitted, awaiting IRO
  | 'FURTHER_INFO_REQUIRED'   // IRO requested corrections
  | 'LOCKED_FOR_7_DAYS'       // Locked due to rejection or 3 failed attempts
  | 'VERIFIED'                // IRO approved
  | 'ACCOUNT_CLAIMED'         // Pre-verified account claimed
  | 'INVITATION_EXPIRED';     // Pre-verified invitation expired

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

/**
 * Pre-verified account workflow stages
 */
export type WorkflowStage = 'SEND_EMAIL' | 'SENT_EMAIL' | 'CLAIM_IN_PROGRESS' | 'ACCOUNT_CLAIMED' | 'INVITE_EXPIRED';

/**
 * Account status for dashboard display
 */
export type AccountStatus = 'PENDING' | 'VERIFIED' | 'UNVERIFIED';

/**
 * System status for internal tracking
 */
export type SystemStatus = 'NULL' | 'ACTIVE' | 'CLAIMED' | 'INACTIVE';

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
  // Manual verification request tracking
  manualVerificationRequestedAt?: string; // ISO string - when user requested manual verification after Step 4 failure
  // Compliance tracking
  iroDecision?: IRODecision; // Latest IRO decision and compliance tracking
  iroDecisionHistory?: IRODecision[]; // History of all IRO decisions
}

export interface ShareholdingsVerificationState {
  step1: ShareholdingsVerificationStep1;
  step2?: ShareholdingsVerificationStep2;
  step3: ShareholdingsVerificationStep3;
  step4: ShareholdingsVerificationStep4;
  step6?: { verifiedAt: string }; // ISO string (Phase 3 / Step 6)
}

// @google/genai guidelines: Define a shared ViewType for navigation consistency
export type ViewType = 'dashboard' | 'registrations' | 'detail' | 'shareholders' | 'engagement' | 'documents';

/**
 * Tab filter type for registrations page
 */
export type RegistrationsTabType = 'PENDING' | 'VERIFIED' | 'NON_VERIFIED' | 'PRE_VERIFIED' | 'ALL';

/**
 * Theme enum for dark/light mode
 */
export enum Theme {
  LIGHT = "light",
  DARK = "dark",
}

/**
 * Breadcrumb item for navigation display
 */
export interface BreadcrumbItem {
  label: string;
  view: ViewType;
  onClick?: () => void;
  filter?: {
    tab?: RegistrationsTabType;
    searchQuery?: string;
  };
}

/**
 * Navigation state for tracking current page and filters
 */
export interface NavigationState {
  currentView: ViewType;
  activeRegistrationsTab?: RegistrationsTabType;
  registrationsSearchQuery?: string;
  selectedApplicantId?: string;
}

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

export interface HoldingsUpdateHistoryEntry {
  updatedAt: string; // ISO timestamp
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
  holdingsUpdateHistory?: HoldingsUpdateHistoryEntry[]; // History of holdings updates (timestamps only)
  emailOtpVerification?: EmailOtpVerificationState;
  shareholdingsVerification?: ShareholdingsVerificationState;
  // Pre-verified account workflow fields
  workflowStage?: WorkflowStage; // Current workflow stage for pre-verified accounts
  accountStatus?: AccountStatus; // Account status displayed in dashboard
  systemStatus?: SystemStatus; // Internal system status
  statusInFrontend?: string; // Status label for frontend display (optional)
  isPreVerified?: boolean; // Flag to indicate this originated from manual provisioning workflow
  registrationId?: string; // Registration ID (holdingId) for pre-verified accounts created by IRO
  // Email tracking fields
  emailGeneratedAt?: string; // ISO timestamp when message was generated
  emailSentAt?: string; // ISO timestamp when email was sent
  emailSentCount?: number; // Number of times email was sent
  emailOpenedAt?: string; // ISO timestamp when email was first opened
  emailOpenedCount?: number; // Number of times email was opened
  linkClickedAt?: string; // ISO timestamp when link was first clicked
  linkClickedCount?: number; // Number of times link was clicked
  accountClaimedAt?: string; // ISO timestamp when account was verified/claimed
  profilePictureUrl?: string; // Profile picture URL from email provider (e.g., Gravatar)
  // Compliance tracking
  lastIRODecisionAt?: string; // ISO timestamp of most recent IRO decision
  complianceStatus?: ComplianceStatus; // Current compliance status
  userLastResponseAt?: string; // ISO timestamp when user last responded to IRO decision
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

/**
 * Shareholder Status for official investors tracking
 */
export type ShareholderStatusType = 'PRE-VERIFIED' | 'VERIFIED' | 'NULL';

/**
 * Official Shareholder Record
 * Tracks official investors from masterlist (pre-verified, verified, no-contact)
 * This collection persists independently of applicants collection
 */
export interface OfficialShareholder {
  id: string; // Registration ID (holdingId) - primary key
  name: string; // Full name
  email?: string; // Email if available
  phone?: string; // Phone if available
  country?: string; // Country if available
  status: ShareholderStatusType; // PRE-VERIFIED, VERIFIED, or NULL
  applicantId?: string; // Link to applicants collection if account exists
  holdings?: number; // Number of shares held
  stake?: number; // Ownership percentage
  accountType?: string; // Account type (Ordinary, etc.)
  // Timestamps
  createdAt: string; // ISO timestamp when record was created
  updatedAt: string; // ISO timestamp when record was last updated
  // Status-specific fields
  emailSentAt?: string; // ISO timestamp when invitation email was sent (for PRE-VERIFIED)
  accountClaimedAt?: string; // ISO timestamp when account was claimed (for VERIFIED)
}

export interface AIAnalysisResult {
  riskScore: number;
  summary: string;
  discrepancies: string[];
  recommendation: string;
}

// ── Engagement Analytics Types ──────────────────────────────────────────

/**
 * Engagement score level for quick categorization
 */
export type EngagementLevel = 'high' | 'medium' | 'low';

/**
 * Engagement record for investor activity tracking
 */
export interface EngagementRecord {
  investorId: string;
  investorName: string;
  investorEmail: string;
  investorType: 'official' | 'guest';
  profilePictureUrl?: string;
  lastActive: string; // ISO timestamp
  recentlyViewed?: {
    documentId: string;
    documentTitle: string;
    readCompletion: number; // 0-100
  };
  documentsViewed: Array<{
    documentId: string;
    documentTitle: string;
    readCompletion: number; // 0-100
    viewedAt: string; // ISO timestamp
  }>;
  interactions: {
    likes: number;
    comments: number;
    reactions: number;
  };
  commentsPosted: Array<{
    documentTitle: string;
    commentText: string;
    postedAt: string; // ISO timestamp
  }>;
  eventActivity: {
    joined: number;
    requested: number;
  };
  meetingRequests: number;
  engagementScore: number; // 0-100
  engagementLevel: EngagementLevel;
}

/**
 * Event type for investor events and meetings
 */
export type IREventType = 'meeting' | 'briefing' | 'webinar' | 'earnings_discussion' | 'other';

/**
 * Participant selection mode for event invitations
 */
export type ParticipantMode = 'all' | 'selected' | 'vip';

/**
 * Event/Meeting interface for IRO event management
 */
export interface IREvent {
  id: string;
  title: string;
  description: string;
  eventType: IREventType;
  dateTime: string; // ISO timestamp
  endDateTime?: string; // ISO timestamp
  location?: string;
  meetingLink?: string;
  createdBy: string; // IRO user ID
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  participantMode: ParticipantMode;
  invitations: {
    invited: string[]; // Investor IDs
    accepted: string[];
    declined: string[];
    pending: string[];
  };
}

/**
 * Document types for investor relations documents
 */
export type DocumentType =
  | 'earnings'
  | 'dividend'
  | 'disclosure'
  | 'press_release'
  | 'agm'
  | 'governance'
  | 'esg'
  | 'presentation'
  | 'silent_period';

/**
 * Document status
 */
export type DocumentStatus = 'draft' | 'published' | 'archived';

/**
 * Document interface for investor relations documents
 */
export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  publishDate: string; // ISO date string (YYYY-MM-DD)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  summary: string;
  summaryRegenerationCount?: number;
}
