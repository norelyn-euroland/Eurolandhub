import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase.js';
import { Applicant, RegistrationStatus, Shareholder, OfficialShareholder, ShareholderStatusType } from './types.js';
import { isLocked } from './shareholdingsVerification.js';
import { LockedAccountError, calculateRemainingDays } from './registration-errors.js';
import { MOCK_APPLICANTS } from './mockApplicants.js';

// Collection names
const COLLECTIONS = {
  APPLICANTS: 'applicants',
  USERS: 'users',
  SHAREHOLDERS: 'shareholders', // Masterlist data (for ownership reports)
  OFFICIAL_SHAREHOLDERS: 'officialShareholders', // Official investors tracking (pre-verified, verified, null)
  EMAIL_VERIFICATION_CODES: 'emailVerificationCodes'
} as const;

/**
 * Check if email verification document exists in emailVerificationCodes collection
 * Document existence = email verified
 * This is the email verification gate
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const codeDoc = await getDoc(doc(db, COLLECTIONS.EMAIL_VERIFICATION_CODES, userId));
    return codeDoc.exists();
  } catch (error) {
    console.error('Error checking email verification:', error);
    return false;
  }
}

/**
 * Convert Firestore Timestamp to string date
 */
const timestampToString = (timestamp: any): string => {
  if (!timestamp) return '';
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0];
  }
  return timestamp;
};

/**
 * Recursively remove undefined values from an object (Firestore doesn't allow undefined)
 */
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  
  return obj;
};

/**
 * Convert Applicant data for Firestore (handles dates and removes undefined values)
 * Flexible conversion that handles various date formats
 */
const applicantToFirestore = (applicant: Applicant): DocumentData => {
  // Handle submissionDate - can be string (YYYY-MM-DD) or already a Date/Timestamp
  let submissionDateValue: Timestamp;
  
  if (applicant.submissionDate) {
    try {
      // Try parsing as YYYY-MM-DD string
      const dateParts = applicant.submissionDate.split('-');
      if (dateParts.length === 3) {
        const date = new Date(
          parseInt(dateParts[0]),
          parseInt(dateParts[1]) - 1, // Month is 0-indexed
          parseInt(dateParts[2])
        );
        submissionDateValue = Timestamp.fromDate(date);
      } else {
        // Try parsing as ISO string or other format
        submissionDateValue = Timestamp.fromDate(new Date(applicant.submissionDate));
      }
    } catch (e) {
      // If parsing fails, use current date
      console.warn('Could not parse submissionDate, using current date:', e);
      submissionDateValue = Timestamp.fromDate(new Date());
    }
  } else {
    // If missing, use current date
    submissionDateValue = Timestamp.fromDate(new Date());
  }
  
  // Remove undefined values recursively (Firestore doesn't allow undefined)
  const cleaned = removeUndefined(applicant);
  
  return {
    ...cleaned,
    submissionDate: submissionDateValue,
  };
};

/**
 * Convert Firestore document to Applicant
 * Flexible conversion that handles whatever structure the frontend sends.
 * Supports field-name variations so documents created by different frontends
 * (investor registration page, IRO dashboard, email workflow) all map correctly.
 */
const firestoreToApplicant = (doc: QueryDocumentSnapshot<DocumentData>): Applicant => {
  const data = doc.data();
  
  // Handle submissionDate - can be Timestamp, Date, or string
  // Also accept common alternatives: createdAt, created_at, registeredAt, signedUpAt
  let submissionDate = '';
  const rawDate = data.submissionDate || data.createdAt || data.created_at
    || data.registeredAt || data.signedUpAt;
  if (rawDate) {
    submissionDate = timestampToString(rawDate);
  } else {
    // If no date field at all, use current date as fallback
    submissionDate = new Date().toISOString().split('T')[0];
  }

  // Build fullName from whatever fields are available
  const fullName = data.fullName
    || data.name
    || data.displayName
    || [data.firstName, data.lastName].filter(Boolean).join(' ')
    || 'Unknown';
  
  // Return with all data from Firestore, ensuring required fields have defaults
  return {
    id: doc.id,
    fullName,
    email: data.email || '',
    phoneNumber: data.phoneNumber || data.phone || data.mobile || undefined,
    location: data.location || data.country || data.address || undefined,
    submissionDate,
    lastActive: data.lastActive || data.lastLogin || 'Just now',
    status: data.status || RegistrationStatus.PENDING,
    idDocumentUrl: data.idDocumentUrl || data.idDocument || '',
    taxDocumentUrl: data.taxDocumentUrl || data.taxDocument || '',
    holdingsRecord: data.holdingsRecord || undefined,
    emailOtpVerification: data.emailOtpVerification || undefined,
    shareholdingsVerification: (() => {
      const sv = data.shareholdingsVerification;
      if (!sv || typeof sv !== 'object') return undefined;
      // Normalize: if the frontend wrote a partial/empty object, ensure required sub-objects exist
      // If step1 is missing entirely, the object is incomplete — treat as no workflow started
      if (!sv.step1) return undefined;
      const step4 = sv.step4 || { failedAttempts: 0 };
      return {
        ...sv,
        step1: sv.step1,
        step2: sv.step2 || undefined,
        step3: sv.step3 || { failedAttempts: 0 },
        step4: {
          ...step4,
          iroDecision: step4.iroDecision || undefined,
          iroDecisionHistory: step4.iroDecisionHistory || undefined,
        },
        step6: sv.step6 || undefined,
      };
    })(),
    // Pre-verified workflow fields
    workflowStage: data.workflowStage || undefined,
    accountStatus: data.accountStatus || undefined,
    systemStatus: data.systemStatus || undefined,
    statusInFrontend: data.statusInFrontend || undefined,
    isPreVerified: data.isPreVerified || undefined,
    registrationId: data.registrationId || undefined,
    // Email tracking fields
    emailGeneratedAt: data.emailGeneratedAt || undefined,
    emailSentAt: data.emailSentAt || undefined,
    emailOpenedAt: data.emailOpenedAt || undefined,
    emailOpenedCount: data.emailOpenedCount || undefined,
    linkClickedAt: data.linkClickedAt || undefined,
    linkClickedCount: data.linkClickedCount || undefined,
    accountClaimedAt: data.accountClaimedAt || undefined,
    profilePictureUrl: data.profilePictureUrl || data.photoURL || undefined,
    // Compliance tracking fields
    lastIRODecisionAt: data.lastIRODecisionAt || undefined,
    complianceStatus: data.complianceStatus || undefined,
    userLastResponseAt: data.userLastResponseAt || undefined,
    // Holdings update history
    holdingsUpdateHistory: data.holdingsUpdateHistory || undefined,
    // Include any additional fields the frontend might send
    ...Object.fromEntries(
      Object.entries(data).filter(([key]) => 
        !['fullName', 'name', 'displayName', 'firstName', 'lastName',
          'email', 'phoneNumber', 'phone', 'mobile', 'location', 'country', 'address',
          'submissionDate', 'createdAt', 'created_at', 'registeredAt', 'signedUpAt',
          'lastActive', 'lastLogin', 'status', 'idDocumentUrl', 'idDocument',
          'taxDocumentUrl', 'taxDocument', 'holdingsRecord', 'emailOtpVerification',
          'shareholdingsVerification', 'workflowStage', 'accountStatus', 'systemStatus',
          'statusInFrontend', 'isPreVerified', 'registrationId', 'emailGeneratedAt',
          'emailSentAt', 'emailOpenedAt', 'emailOpenedCount', 'linkClickedAt',
          'linkClickedCount', 'accountClaimedAt', 'profilePictureUrl', 'photoURL',
          'lastIRODecisionAt', 'complianceStatus', 'userLastResponseAt', 'holdingsUpdateHistory'].includes(key)
      )
    ),
  } as Applicant;
};

/**
 * Applicant Service
 */
export const applicantService = {
  /**
   * Get a single applicant by ID
   */
  async getById(applicantId: string): Promise<Applicant | null> {
    try {
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicantId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return firestoreToApplicant(docSnap as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting applicant:', error);
      throw error;
    }
  },

  /**
   * Get applicant by registration ID (holdingId)
   */
  async getByRegistrationId(registrationId: string): Promise<Applicant | null> {
    if (!registrationId || !registrationId.trim()) return null;
    try {
      const rid = registrationId.trim();
      const q = query(
        collection(db, COLLECTIONS.APPLICANTS),
        where('registrationId', '==', rid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return firestoreToApplicant(snap.docs[0] as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting applicant by registrationId:', error);
      return null;
    }
  },

  /**
   * Find a pre-verified applicant by email.
   * Used by the claim flow to detect if a registering user matches
   * an existing pre-verified record provisioned by the IRO.
   */
  async findPreVerifiedByEmail(email: string): Promise<Applicant | null> {
    if (!email || !email.trim()) return null;
    try {
      const q = query(
        collection(db, COLLECTIONS.APPLICANTS),
        where('email', '==', email.toLowerCase().trim()),
        where('isPreVerified', '==', true)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Return the most recently updated pre-verified record
        const records = snap.docs.map(d => firestoreToApplicant(d as QueryDocumentSnapshot<DocumentData>));
        records.sort((a, b) => {
          const da = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
          const db_ = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
          return db_ - da;
        });
        return records[0];
      }
      return null;
    } catch (error) {
      console.error('Error finding pre-verified account by email:', error);
      return null;
    }
  },

  /**
   * Find a pre-verified applicant by registrationId.
   * Covers the case where the user provides their shareholder ID during registration.
   */
  async findPreVerifiedByRegistrationId(registrationId: string): Promise<Applicant | null> {
    if (!registrationId || !registrationId.trim()) return null;
    try {
      const q = query(
        collection(db, COLLECTIONS.APPLICANTS),
        where('registrationId', '==', registrationId.trim()),
        where('isPreVerified', '==', true)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return firestoreToApplicant(snap.docs[0] as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error finding pre-verified account by registrationId:', error);
      return null;
    }
  },

  /**
   * Get applicant by email address
   */
  async getByEmail(email: string): Promise<Applicant | null> {
    try {
      const emailQuery = query(
        collection(db, COLLECTIONS.APPLICANTS),
        where('email', '==', email.toLowerCase().trim())
      );
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        return firestoreToApplicant(emailSnapshot.docs[0] as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting applicant by email:', error);
      throw error;
    }
  },

  /**
   * Get all applicants with optional filters
   * Flexible query that handles missing fields gracefully
   * NOTE: We intentionally do NOT use orderBy('submissionDate') in the Firestore query
   * because Firestore silently excludes documents that lack the ordered field.
   * Frontend-registered applicants may not have submissionDate, so we fetch ALL docs
   * and sort client-side to ensure no documents are missed.
   */
  async getAll(filters?: {
    status?: RegistrationStatus;
    limitCount?: number;
  }): Promise<Applicant[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      // DO NOT use orderBy('submissionDate') — Firestore silently drops docs
      // that lack the ordered field. Sort client-side instead.
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.APPLICANTS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      let firestoreApplicants = querySnapshot.docs.map(firestoreToApplicant);
      
      // Remove duplicates: If multiple applicants have the same email or registrationId, keep the most recent one
      const uniqueApplicants = new Map<string, Applicant>();
      for (const applicant of firestoreApplicants) {
        // Use email as primary key (most reliable identifier)
        const key = applicant.email?.toLowerCase().trim() || applicant.id;
        
        if (uniqueApplicants.has(key)) {
          // Compare submission dates - keep the more recent one
          const existing = uniqueApplicants.get(key)!;
          const existingDate = existing.submissionDate ? new Date(existing.submissionDate).getTime() : 0;
          const newDate = applicant.submissionDate ? new Date(applicant.submissionDate).getTime() : 0;
          
          if (newDate > existingDate || (!newDate && existingDate === 0)) {
            // New applicant is more recent or has same date, replace
            uniqueApplicants.set(key, applicant);
          }
          // Otherwise keep the existing one
        } else {
          uniqueApplicants.set(key, applicant);
        }
      }
      
      // Also check for duplicates by registrationId (if email is missing)
      const byRegistrationId = new Map<string, Applicant>();
      for (const applicant of Array.from(uniqueApplicants.values())) {
        if (applicant.registrationId) {
          const regId = applicant.registrationId.trim();
          if (byRegistrationId.has(regId)) {
            // Duplicate by registrationId - keep the one with email or more recent
            const existing = byRegistrationId.get(regId)!;
            const existingDate = existing.submissionDate ? new Date(existing.submissionDate).getTime() : 0;
            const newDate = applicant.submissionDate ? new Date(applicant.submissionDate).getTime() : 0;
            
            // Prefer applicant with email, or more recent if both have/don't have email
            if ((applicant.email && !existing.email) || 
                (newDate > existingDate && (applicant.email || !existing.email))) {
              byRegistrationId.set(regId, applicant);
              // Remove the old one from uniqueApplicants if it exists
              if (existing.email) {
                uniqueApplicants.delete(existing.email.toLowerCase().trim());
              }
            }
          } else {
            byRegistrationId.set(regId, applicant);
          }
        }
      }
      
      // Final list: Use email-based map, but also include registrationId-based entries that don't have email matches
      const finalApplicants = Array.from(uniqueApplicants.values());
      for (const applicant of Array.from(byRegistrationId.values())) {
        if (!applicant.email || !uniqueApplicants.has(applicant.email.toLowerCase().trim())) {
          // This applicant is only in registrationId map and not in email map
          if (!finalApplicants.find(a => a.id === applicant.id)) {
            finalApplicants.push(applicant);
          }
        }
      }
      
      firestoreApplicants = finalApplicants;
      
      // Sort client-side by submissionDate descending (most recent first)
      firestoreApplicants.sort((a, b) => {
        const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
        const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
        return dateB - dateA;
      });
      
      // Only use mock data if Firestore returned nothing (true empty collection)
      if (firestoreApplicants.length === 0) {
        console.log('No applicants in Firestore, using mock data as fallback');
        let mockData = MOCK_APPLICANTS;
        
        // Apply filters to mock data if needed
        if (filters?.status) {
          mockData = mockData.filter(a => a.status === filters.status);
        }
        if (filters?.limitCount) {
          mockData = mockData.slice(0, filters.limitCount);
        }
        
        return mockData;
      }
      
      return firestoreApplicants;
    } catch (error) {
      console.error('Error getting applicants:', error);
      console.log('Using mock data as fallback due to error');
      // On error, return mock data as fallback
      let mockData = MOCK_APPLICANTS;
      
      // Apply filters to mock data if needed
      if (filters?.status) {
        mockData = mockData.filter(a => a.status === filters.status);
      }
      if (filters?.limitCount) {
        mockData = mockData.slice(0, filters.limitCount);
      }
      
      return mockData;
    }
  },

  /**
   * Check for duplicate registrations and lockout status
   * Throws LockedAccountError if a locked account is found with matching email, phone, or name
   */
  async checkDuplicateRegistration(
    email: string,
    phoneNumber?: string,
    fullName?: string,
    registrationId?: string
  ): Promise<{ isDuplicate: boolean; existingApplicant: Applicant | null }> {
    try {
      const allResults: Applicant[] = [];
      
      // Query by email (primary identifier - most reliable)
      if (email && email.trim()) {
        const emailQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('email', '==', email.toLowerCase().trim()));
        const emailSnapshot = await getDocs(emailQuery);
        allResults.push(...emailSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Query by registrationId (important for preventing duplicates from frontend registrations)
      if (registrationId && registrationId.trim()) {
        const regIdQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('registrationId', '==', registrationId.trim()));
        const regIdSnapshot = await getDocs(regIdQuery);
        allResults.push(...regIdSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Query by phone number
      if (phoneNumber && phoneNumber.trim()) {
        const phoneQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('phoneNumber', '==', phoneNumber.trim()));
        const phoneSnapshot = await getDocs(phoneQuery);
        allResults.push(...phoneSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Query by name - Firestore doesn't support case-insensitive queries natively
      // So we'll query exact match and filter client-side
      if (fullName && fullName.trim()) {
        const nameQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('fullName', '==', fullName.trim()));
        const nameSnapshot = await getDocs(nameQuery);
        allResults.push(...nameSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Remove duplicates (same applicant ID)
      const uniqueResults = Array.from(
        new Map(allResults.map(app => [app.id, app])).values()
      );
      
      // Check for matches (case-insensitive for email and name)
      for (const existingApplicant of uniqueResults) {
        const emailMatch = email && existingApplicant.email && 
                          existingApplicant.email.toLowerCase().trim() === email.toLowerCase().trim();
        const phoneMatch = phoneNumber && existingApplicant.phoneNumber && 
                          existingApplicant.phoneNumber.trim() === phoneNumber.trim();
        const nameMatch = fullName && existingApplicant.fullName && 
                         existingApplicant.fullName.toLowerCase().trim() === fullName.trim().toLowerCase();
        const regIdMatch = registrationId && existingApplicant.registrationId && 
                          existingApplicant.registrationId.trim() === registrationId.trim();
        
        if (emailMatch || phoneMatch || nameMatch || regIdMatch) {
          // Found a duplicate - check if locked first
          if (isLocked(existingApplicant)) {
            const lockedUntil = existingApplicant.shareholdingsVerification?.step3.lockedUntil;
            if (lockedUntil) {
              const remainingDays = calculateRemainingDays(lockedUntil);
              
              // Determine which field matched (prioritize email > registrationId > phone > name)
              let matchedField: 'email' | 'phone' | 'name' | 'registrationId' = 'email';
              if (emailMatch) {
                matchedField = 'email';
              } else if (regIdMatch) {
                matchedField = 'registrationId';
              } else if (phoneMatch) {
                matchedField = 'phone';
              } else if (nameMatch) {
                matchedField = 'name';
              }
              
              const fieldLabel = matchedField === 'email' ? 'email address' : 
                                matchedField === 'registrationId' ? 'registration ID' :
                                matchedField === 'phone' ? 'phone number' : 'name';
              
              throw new LockedAccountError(
                `This ${fieldLabel} is associated with an account that is locked for 7 days. Please wait ${remainingDays} day${remainingDays !== 1 ? 's' : ''} before registering again.`,
                remainingDays,
                lockedUntil,
                matchedField
              );
            }
          }
          
          // Return the existing applicant (duplicate found, but not locked)
          console.log('Duplicate registration detected:', {
            email,
            registrationId,
            existingId: existingApplicant.id,
            existingEmail: existingApplicant.email,
            existingRegistrationId: existingApplicant.registrationId,
            matchedBy: emailMatch ? 'email' : regIdMatch ? 'registrationId' : phoneMatch ? 'phone' : 'name'
          });
          return { isDuplicate: true, existingApplicant };
        }
      }
      
      // No duplicate found
      return { isDuplicate: false, existingApplicant: null };
    } catch (error) {
      // Re-throw LockedAccountError as-is
      if (error instanceof LockedAccountError) {
        throw error;
      }
      // For other errors, log and re-throw
      console.error('Error checking duplicate registration:', error);
      throw error;
    }
  },

  /**
   * Create a new applicant.
   *
   * Smart duplicate handling:
   *  - If the registering user matches an existing PRE-VERIFIED record, the system
   *    treats the registration as an "account claim" — it NEVER creates a new record.
   *    Instead it calls markAccountAsClaimed() on the existing record which:
   *      • Updates status: pre_verified → verified (workflowStage, accountStatus, systemStatus)
   *      • Syncs officialShareholders collection (PRE-VERIFIED → VERIFIED)
   *      • Sends the Step-6 verified-account email
   *  - If a duplicate is found that is NOT pre-verified, the records are merged
   *    (existing behaviour — prevents regular registration duplicates).
   *  - If no duplicate exists at all, a new applicant document is created normally.
   */
  async create(applicant: Applicant): Promise<string> {
    try {
      // ── STEP 1: Pre-verified claim check ────────────────────────────────────
      // Before the general duplicate check, look specifically for a pre-verified
      // record that matches by email or registrationId.  We do this first so we
      // can apply the CLAIM flow rather than the generic merge flow.
      let preVerifiedMatch: Applicant | null = null;

      if (applicant.email) {
        preVerifiedMatch = await this.findPreVerifiedByEmail(applicant.email);
      }
      if (!preVerifiedMatch && applicant.registrationId) {
        preVerifiedMatch = await this.findPreVerifiedByRegistrationId(applicant.registrationId);
      }

      if (preVerifiedMatch && preVerifiedMatch.accountStatus !== 'VERIFIED' && preVerifiedMatch.workflowStage !== 'ACCOUNT_CLAIMED') {
        console.log(
          `[CLAIM FLOW] Pre-verified account detected for ${applicant.email || applicant.fullName}. ` +
          `Treating registration as account claim. Existing applicant ID: ${preVerifiedMatch.id}`
        );

        // Attach any new profile/auth data the incoming registration brings
        // (phone, profile picture, etc.) before claiming
        const authUpdates: Partial<Applicant> = {};
        if (applicant.emailOtpVerification) authUpdates.emailOtpVerification = applicant.emailOtpVerification;
        if (applicant.phoneNumber && !preVerifiedMatch.phoneNumber) authUpdates.phoneNumber = applicant.phoneNumber;
        if (applicant.location && !preVerifiedMatch.location) authUpdates.location = applicant.location;
        if (applicant.profilePictureUrl) authUpdates.profilePictureUrl = applicant.profilePictureUrl;
        // Keep the email from the pre-verified record as canonical — do NOT overwrite
        // with a potentially different email from the new registration payload.

        if (Object.keys(authUpdates).length > 0) {
          await this.update(preVerifiedMatch.id, authUpdates);
        }

        // Run the full claim workflow:
        //   • Sets workflowStage = ACCOUNT_CLAIMED
        //   • Sets systemStatus = CLAIMED, accountStatus = VERIFIED, status = APPROVED
        //   • Syncs officialShareholders: PRE-VERIFIED → VERIFIED
        //   • Sends verified-account email (Step 6)
        const { markAccountAsClaimed } = await import('./preverified-workflow.js');
        await markAccountAsClaimed(preVerifiedMatch.id);

        console.log(`[CLAIM FLOW] Account successfully claimed. Applicant ID: ${preVerifiedMatch.id}`);
        return preVerifiedMatch.id;
      }

      // ── STEP 2: General duplicate check ─────────────────────────────────────
      const duplicateCheck = await this.checkDuplicateRegistration(
        applicant.email,
        applicant.phoneNumber,
        applicant.fullName,
        applicant.registrationId
      );
      
      if (duplicateCheck.isDuplicate && duplicateCheck.existingApplicant) {
        const existing = duplicateCheck.existingApplicant;

        // Safety net: if the duplicate IS pre-verified but the first check missed it
        // (e.g. workflowStage was already ACCOUNT_CLAIMED but accountStatus not yet synced)
        // just return the existing ID without overwriting verified state.
        if (existing.isPreVerified && (existing.accountStatus === 'VERIFIED' || existing.workflowStage === 'ACCOUNT_CLAIMED')) {
          console.log(`[CLAIM FLOW] Pre-verified account already claimed. Returning existing ID: ${existing.id}`);
          return existing.id;
        }

        console.log(`Duplicate detected for ${applicant.email || applicant.fullName}. Updating existing applicant instead of creating duplicate.`, {
          existingId: existing.id,
          newId: applicant.id,
          email: applicant.email
        });
        
        // Merge: preserve existing data, patch with newer fields
        const mergedApplicant = {
          ...existing,
          ...applicant,
          id: existing.id, // Keep existing ID
          email: applicant.email || existing.email,
          fullName: applicant.fullName || existing.fullName,
          phoneNumber: applicant.phoneNumber || existing.phoneNumber,
          shareholdingsVerification: applicant.shareholdingsVerification || existing.shareholdingsVerification,
          emailOtpVerification: applicant.emailOtpVerification || existing.emailOtpVerification,
          submissionDate: applicant.submissionDate && new Date(applicant.submissionDate) > new Date(existing.submissionDate || '1970-01-01')
            ? applicant.submissionDate
            : existing.submissionDate,
        };
        
        await this.update(existing.id, mergedApplicant);
        return existing.id;
      }
      
      // ── STEP 3: No duplicate — create fresh applicant ────────────────────────
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicant.id);
      await setDoc(docRef, applicantToFirestore(applicant));
      return docRef.id;
    } catch (error) {
      if (error instanceof LockedAccountError) {
        throw error;
      }
      console.error('Error creating applicant:', error);
      throw error;
    }
  },

  /**
   * Update an existing applicant
   */
  async update(applicantId: string, updates: Partial<Applicant>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicantId);
      
      // Remove undefined values recursively (Firestore doesn't allow undefined)
      const updateData = removeUndefined(updates);
      
      // Handle date conversion if submissionDate is being updated
      if (updates.submissionDate) {
        updateData.submissionDate = Timestamp.fromDate(new Date(updates.submissionDate));
      }
      
      // Log what we're updating (especially for verification status)
      if (updates.status === 'APPROVED' || updates.shareholdingsVerification?.step6?.verifiedAt) {
        console.log('Saving verification status to Firestore:', {
          applicantId,
          status: updates.status,
          step6VerifiedAt: updates.shareholdingsVerification?.step6?.verifiedAt,
          step4LastResult: updates.shareholdingsVerification?.step4?.lastResult,
          fullShareholdingsVerification: updates.shareholdingsVerification
        });
      }
      
      await updateDoc(docRef, updateData);
      
      // Log successful update
      if (updates.status === 'APPROVED' || updates.shareholdingsVerification?.step6?.verifiedAt) {
        console.log('Successfully saved verification status to Firestore:', {
          applicantId,
          status: updateData.status,
          hasStep6: !!updateData.shareholdingsVerification?.step6
        });
      }
    } catch (error) {
      console.error('Error updating applicant:', error);
      throw error;
    }
  },

  /**
   * Update applicant status
   */
  async updateStatus(applicantId: string, status: RegistrationStatus): Promise<void> {
    try {
      await this.update(applicantId, { status });
    } catch (error) {
      console.error('Error updating applicant status:', error);
      throw error;
    }
  },

  /**
   * Delete an applicant
   */
  async delete(applicantId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicantId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting applicant:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for all applicants
   * Returns an unsubscribe function
   * Flexible subscription that handles whatever data structure the frontend sends
   * 
   * NOTE: We intentionally do NOT use orderBy('submissionDate') in the Firestore query
   * because Firestore silently excludes documents that lack the ordered field.
   * Frontend-registered applicants may not have submissionDate, so we fetch ALL docs
   * and sort client-side to ensure every document is included in real-time updates.
   */
  subscribeToApplicants(
    callback: (applicants: Applicant[]) => void,
    filters?: {
      status?: RegistrationStatus;
      limitCount?: number;
    }
  ): Unsubscribe {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      // DO NOT use orderBy('submissionDate') — Firestore silently drops docs
      // that lack the ordered field (e.g. frontend-registered applicants).
      // We sort client-side instead after receiving the snapshot.
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.APPLICANTS), ...constraints);
      
      // Use onSnapshot for real-time updates
      // Removed includeMetadataChanges to prevent firing on local pending writes
      return onSnapshot(q, (snapshot) => {
        try {
          // Firestore onSnapshot automatically handles deletions - deleted docs are removed from snapshot.docs
          // This means the callback will receive an updated array without deleted documents
          let applicants = snapshot.docs.map(firestoreToApplicant);
          
          // Remove duplicates: If multiple applicants have the same email or registrationId, keep the most recent one
          const uniqueApplicants = new Map<string, Applicant>();
          for (const applicant of applicants) {
            // Use email as primary key (most reliable identifier)
            const key = applicant.email?.toLowerCase().trim() || applicant.id;
            
            if (uniqueApplicants.has(key)) {
              // Compare submission dates - keep the more recent one
              const existing = uniqueApplicants.get(key)!;
              const existingDate = existing.submissionDate ? new Date(existing.submissionDate).getTime() : 0;
              const newDate = applicant.submissionDate ? new Date(applicant.submissionDate).getTime() : 0;
              
              if (newDate > existingDate || (!newDate && existingDate === 0)) {
                // New applicant is more recent or has same date, replace
                uniqueApplicants.set(key, applicant);
              }
              // Otherwise keep the existing one
            } else {
              uniqueApplicants.set(key, applicant);
            }
          }
          
          // Also check for duplicates by registrationId (if email is missing)
          const byRegistrationId = new Map<string, Applicant>();
          for (const applicant of Array.from(uniqueApplicants.values())) {
            if (applicant.registrationId) {
              const regId = applicant.registrationId.trim();
              if (byRegistrationId.has(regId)) {
                // Duplicate by registrationId - keep the one with email or more recent
                const existing = byRegistrationId.get(regId)!;
                const existingDate = existing.submissionDate ? new Date(existing.submissionDate).getTime() : 0;
                const newDate = applicant.submissionDate ? new Date(applicant.submissionDate).getTime() : 0;
                
                // Prefer applicant with email, or more recent if both have/don't have email
                if ((applicant.email && !existing.email) || 
                    (newDate > existingDate && (applicant.email || !existing.email))) {
                  byRegistrationId.set(regId, applicant);
                  // Remove the old one from uniqueApplicants if it exists
                  if (existing.email) {
                    uniqueApplicants.delete(existing.email.toLowerCase().trim());
                  }
                }
              } else {
                byRegistrationId.set(regId, applicant);
              }
            }
          }
          
          // Final list: Use email-based map, but also include registrationId-based entries that don't have email matches
          const finalApplicantsList = Array.from(uniqueApplicants.values());
          for (const applicant of Array.from(byRegistrationId.values())) {
            if (!applicant.email || !uniqueApplicants.has(applicant.email.toLowerCase().trim())) {
              // This applicant is only in registrationId map and not in email map
              if (!finalApplicantsList.find(a => a.id === applicant.id)) {
                finalApplicantsList.push(applicant);
              }
            }
          }
          
          applicants = finalApplicantsList;
          
          // Sort client-side by submissionDate descending (most recent first)
          applicants.sort((a, b) => {
            const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0;
            const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0;
            return dateB - dateA;
          });
          
          // Only use mock data if the Firestore collection is truly empty
          let finalApplicants = applicants;
          if (applicants.length === 0) {
            console.log('No applicants in Firestore subscription, using mock data as fallback');
            let mockData = MOCK_APPLICANTS;
            
            // Apply filters to mock data if needed
            if (filters?.status) {
              mockData = mockData.filter(a => a.status === filters.status);
            }
            if (filters?.limitCount) {
              mockData = mockData.slice(0, filters.limitCount);
            }
            
            finalApplicants = mockData;
          }
          
          // Log changes for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            const changeCounts = snapshot.docChanges().reduce((acc, change) => {
              acc[change.type] = (acc[change.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            if (Object.keys(changeCounts).length > 0) {
              console.log('Applicants snapshot changes:', changeCounts, `Total: ${finalApplicants.length}`);
            }
          }
          
          callback(finalApplicants);
        } catch (error) {
          console.error('Error processing snapshot data:', error);
          // On error, use mock data as fallback
          console.log('Using mock data as fallback due to processing error');
          let mockData = MOCK_APPLICANTS;
          
          // Apply filters to mock data if needed
          if (filters?.status) {
            mockData = mockData.filter(a => a.status === filters.status);
          }
          if (filters?.limitCount) {
            mockData = mockData.slice(0, filters.limitCount);
          }
          
          callback(mockData);
        }
      }, (error) => {
        console.error('Error in applicants subscription:', error);
        // On subscription error, use mock data as fallback
        console.log('Using mock data as fallback due to subscription error');
        let mockData = MOCK_APPLICANTS;
        
        // Apply filters to mock data if needed
        if (filters?.status) {
          mockData = mockData.filter(a => a.status === filters.status);
        }
        if (filters?.limitCount) {
          mockData = mockData.slice(0, filters.limitCount);
        }
        
          callback(mockData);
      });
    } catch (error) {
      console.error('Error setting up applicants subscription:', error);
      // Return a no-op unsubscribe function if setup fails
      return () => {};
    }
  }
};

/**
 * Convert Shareholder data for Firestore (handles numeric fields and removes undefined values)
 */
const shareholderToFirestore = (shareholder: Shareholder): DocumentData => {
  // Remove undefined values recursively (Firestore doesn't allow undefined)
  const cleaned = removeUndefined(shareholder);
  
  return cleaned;
};

/**
 * Convert Firestore document to Shareholder
 */
const firestoreToShareholder = (doc: QueryDocumentSnapshot<DocumentData>): Shareholder => {
  const data = doc.data();
  
  return {
    id: doc.id,
    name: data.name || '',
    holdings: data.holdings || 0,
    stake: data.stake || 0,
    rank: data.rank || 0,
    coAddress: data.coAddress || '',
    country: data.country || '',
    accountType: data.accountType || '',
    firstName: data.firstName || undefined,
  } as Shareholder;
};

/**
 * Shareholder Service
 */
export const shareholderService = {
  /**
   * Get a single shareholder by ID
   */
  async getById(shareholderId: string): Promise<Shareholder | null> {
    try {
      const docRef = doc(db, COLLECTIONS.SHAREHOLDERS, shareholderId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return firestoreToShareholder(docSnap as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting shareholder:', error);
      throw error;
    }
  },

  /**
   * Get all shareholders with optional filters
   */
  async getAll(filters?: {
    limitCount?: number;
  }): Promise<Shareholder[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      // Order by holdings descending (highest first)
      try {
        constraints.push(orderBy('holdings', 'desc'));
      } catch (e) {
        console.warn('Could not order by holdings, continuing without ordering:', e);
      }
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.SHAREHOLDERS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(firestoreToShareholder);
    } catch (error) {
      console.error('Error getting shareholders:', error);
      throw error;
    }
  },

  /**
   * Create a new shareholder
   */
  async create(shareholder: Shareholder): Promise<string> {
    try {
      const docRef = doc(db, COLLECTIONS.SHAREHOLDERS, shareholder.id);
      await setDoc(docRef, shareholderToFirestore(shareholder));
      return docRef.id;
    } catch (error) {
      console.error('Error creating shareholder:', error);
      throw error;
    }
  },

  /**
   * Update an existing shareholder
   */
  async update(shareholderId: string, updates: Partial<Shareholder>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SHAREHOLDERS, shareholderId);
      
      // Remove undefined values recursively (Firestore doesn't allow undefined)
      const updateData = removeUndefined(updates);
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating shareholder:', error);
      throw error;
    }
  },

  /**
   * Delete a shareholder
   */
  async delete(shareholderId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SHAREHOLDERS, shareholderId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting shareholder:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for all shareholders
   * Returns an unsubscribe function
   */
  subscribeToShareholders(
    callback: (shareholders: Shareholder[]) => void
  ): Unsubscribe {
    try {
      const q = query(collection(db, COLLECTIONS.SHAREHOLDERS), orderBy('holdings', 'desc'));
      
      // Use onSnapshot with includeMetadataChanges to get all updates including cache hits
      return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
        try {
          // Firestore onSnapshot automatically handles deletions - deleted docs are removed from snapshot.docs
          // This means the callback will receive an updated array without deleted documents
          const shareholders = snapshot.docs.map(firestoreToShareholder);
          
          // Log changes for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            const changeCounts = snapshot.docChanges().reduce((acc, change) => {
              acc[change.type] = (acc[change.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            if (Object.keys(changeCounts).length > 0) {
              console.log('Shareholders snapshot changes:', changeCounts, `Total: ${shareholders.length}`);
            }
          }
          
          callback(shareholders);
        } catch (error) {
          console.error('Error processing snapshot data:', error);
          callback([]);
        }
      }, (error) => {
        console.error('Error in shareholders subscription:', error);
        callback([]);
      });
    } catch (error) {
      console.error('Error setting up shareholders subscription:', error);
      return () => {};
    }
  }
};

/**
 * Batch operations for migrating existing data
 */
export const batchService = {
  /**
   * Migrate mock applicants to Firestore
   * Updates existing documents or creates new ones
   * Bypasses duplicate registration check for batch migrations
   */
  async migrateApplicants(applicants: Applicant[]): Promise<void> {
    try {
      let duplicatesDeleted = 0;
      const duplicateIds: string[] = [];

      // First pass: Find and delete duplicates by email or registrationId
      console.log('🔍 Checking for duplicate accounts...');
      for (const applicant of applicants) {
        if (!applicant.email && !applicant.registrationId) continue;

        try {
          // Check for existing by email
          if (applicant.email) {
            const existingByEmail = await applicantService.getByEmail(applicant.email);
            if (existingByEmail && existingByEmail.id !== applicant.id) {
              // Found duplicate by email with different ID - delete the old one
              console.log(`   🗑️  Found duplicate by email: ${applicant.email} (old ID: ${existingByEmail.id}, new ID: ${applicant.id})`);
              try {
                await deleteDoc(doc(db, COLLECTIONS.APPLICANTS, existingByEmail.id));
                duplicatesDeleted++;
                duplicateIds.push(existingByEmail.id);
                console.log(`   ✅ Deleted duplicate account: ${existingByEmail.id}`);
              } catch (deleteError: any) {
                console.warn(`   ⚠️  Could not delete duplicate ${existingByEmail.id}: ${deleteError.message}`);
              }
            }
          }

          // Check for existing by registrationId (if provided)
          if (applicant.registrationId) {
            const registrationIdQuery = query(
              collection(db, COLLECTIONS.APPLICANTS),
              where('registrationId', '==', applicant.registrationId)
            );
            const registrationIdSnapshot = await getDocs(registrationIdQuery);
            
            if (!registrationIdSnapshot.empty) {
              // Find documents with same registrationId but different ID
              registrationIdSnapshot.docs.forEach((docSnap) => {
                if (docSnap.id !== applicant.id) {
                  console.log(`   🗑️  Found duplicate by registrationId: ${applicant.registrationId} (old ID: ${docSnap.id}, new ID: ${applicant.id})`);
                  try {
                    deleteDoc(doc(db, COLLECTIONS.APPLICANTS, docSnap.id));
                    if (!duplicateIds.includes(docSnap.id)) {
                      duplicatesDeleted++;
                      duplicateIds.push(docSnap.id);
                      console.log(`   ✅ Deleted duplicate account: ${docSnap.id}`);
                    }
                  } catch (deleteError: any) {
                    console.warn(`   ⚠️  Could not delete duplicate ${docSnap.id}: ${deleteError.message}`);
                  }
                }
              });
            }
          }
        } catch (checkError: any) {
          console.warn(`   ⚠️  Error checking duplicates for ${applicant.id}: ${checkError.message}`);
        }
      }

      if (duplicatesDeleted > 0) {
        console.log(`\n✅ Cleaned up ${duplicatesDeleted} duplicate account(s) before migration`);
      }

      // Second pass: Upload/update applicants (using setDoc with merge to overwrite)
      const results = await Promise.allSettled(
        applicants.map(async (applicant) => {
          try {
            // Use setDoc with merge option to overwrite existing documents
            // This ensures we update if exists, create if not, without duplicates
            const docRef = doc(db, COLLECTIONS.APPLICANTS, applicant.id);
            const firestoreData = applicantToFirestore(applicant);
            
            // Check if document exists to determine action
            const existing = await getDoc(docRef);
            const action = existing.exists() ? 'updated' : 'created';
            
            // Use setDoc which will overwrite existing document or create new one
            await setDoc(docRef, firestoreData, { merge: false }); // merge: false means overwrite completely
            
            return { success: true, id: applicant.id, action };
          } catch (error: any) {
            throw new Error(`Failed to migrate applicant ${applicant.id} (${applicant.fullName}): ${error.message || error.code || 'Unknown error'}`);
          }
        })
      );

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        const failures = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason : 'Unknown error');
        console.error(`⚠️  Migration completed with ${failed} failures out of ${applicants.length} applicants:`);
        failures.forEach((failure, index) => {
          console.error(`   ${index + 1}. ${failure}`);
        });
        throw new Error(`${failed} out of ${applicants.length} applicants failed to migrate. Check console for details.`);
      }
      
      const created = results.filter(r => r.status === 'fulfilled' && r.value?.action === 'created').length;
      const updated = results.filter(r => r.status === 'fulfilled' && r.value?.action === 'updated').length;
      
      console.log(`✅ Successfully migrated ${successful} applicants to Firestore`);
      console.log(`   📊 Created: ${created}, Updated: ${updated}, Duplicates removed: ${duplicatesDeleted}`);
    } catch (error) {
      console.error('Error migrating applicants:', error);
      throw error;
    }
  },

  /**
   * Migrate mock shareholders to Firestore
   * Updates existing documents or creates new ones
   */
  async migrateShareholders(shareholders: Shareholder[]): Promise<void> {
    try {
      let duplicatesDeleted = 0;
      const duplicateIds: string[] = [];

      // First pass: Find and delete duplicates by name or ID
      console.log('🔍 Checking for duplicate shareholders...');
      for (const shareholder of shareholders) {
        try {
          // Check for existing by name (case-insensitive)
          if (shareholder.name) {
            const nameQuery = query(
              collection(db, COLLECTIONS.SHAREHOLDERS),
              where('name', '==', shareholder.name)
            );
            const nameSnapshot = await getDocs(nameQuery);
            
            if (!nameSnapshot.empty) {
              // Find documents with same name but different ID
              nameSnapshot.docs.forEach((docSnap) => {
                if (docSnap.id !== shareholder.id) {
                  console.log(`   🗑️  Found duplicate by name: ${shareholder.name} (old ID: ${docSnap.id}, new ID: ${shareholder.id})`);
                  try {
                    deleteDoc(doc(db, COLLECTIONS.SHAREHOLDERS, docSnap.id));
                    if (!duplicateIds.includes(docSnap.id)) {
                      duplicatesDeleted++;
                      duplicateIds.push(docSnap.id);
                      console.log(`   ✅ Deleted duplicate shareholder: ${docSnap.id}`);
                    }
                  } catch (deleteError: any) {
                    console.warn(`   ⚠️  Could not delete duplicate ${docSnap.id}: ${deleteError.message}`);
                  }
                }
              });
            }
          }
        } catch (checkError: any) {
          console.warn(`   ⚠️  Error checking duplicates for ${shareholder.id}: ${checkError.message}`);
        }
      }

      if (duplicatesDeleted > 0) {
        console.log(`\n✅ Cleaned up ${duplicatesDeleted} duplicate shareholder(s) before migration`);
      }

      // Second pass: Upload/update shareholders (using setDoc to overwrite)
      const results = await Promise.allSettled(
        shareholders.map(async (shareholder) => {
          try {
            // Use setDoc to overwrite existing documents or create new ones
            const docRef = doc(db, COLLECTIONS.SHAREHOLDERS, shareholder.id);
            const firestoreData = shareholderToFirestore(shareholder);
            
            // Check if document exists to determine action
            const existing = await getDoc(docRef);
            const action = existing.exists() ? 'updated' : 'created';
            
            // Use setDoc which will overwrite existing document or create new one
            await setDoc(docRef, firestoreData, { merge: false }); // merge: false means overwrite completely
            
            return { success: true, id: shareholder.id, action };
          } catch (error: any) {
            throw new Error(`Failed to migrate shareholder ${shareholder.id} (${shareholder.name}): ${error.message || error.code || 'Unknown error'}`);
          }
        })
      );

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        const failures = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason : 'Unknown error');
        console.error(`⚠️  Migration completed with ${failed} failures out of ${shareholders.length} shareholders:`);
        failures.forEach((failure, index) => {
          console.error(`   ${index + 1}. ${failure}`);
        });
        throw new Error(`${failed} out of ${shareholders.length} shareholders failed to migrate. Check console for details.`);
      }
      
      const created = results.filter(r => r.status === 'fulfilled' && r.value?.action === 'created').length;
      const updated = results.filter(r => r.status === 'fulfilled' && r.value?.action === 'updated').length;
      
      console.log(`✅ Successfully migrated ${successful} shareholders to Firestore`);
      console.log(`   📊 Created: ${created}, Updated: ${updated}, Duplicates removed: ${duplicatesDeleted}`);
    } catch (error) {
      console.error('Error migrating shareholders:', error);
      throw error;
    }
  }
};

/**
 * Convert OfficialShareholder data for Firestore
 */
const officialShareholderToFirestore = (shareholder: OfficialShareholder): DocumentData => {
  return removeUndefined(shareholder);
};

/**
 * Convert Firestore document to OfficialShareholder
 */
const firestoreToOfficialShareholder = (doc: QueryDocumentSnapshot<DocumentData>): OfficialShareholder => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    firstName: data.firstName || undefined,
    email: data.email || undefined,
    phone: data.phone || undefined,
    country: data.country || undefined,
    coAddress: data.coAddress || undefined,
    rank: data.rank || undefined,
    status: data.status || 'NULL',
    applicantId: data.applicantId || undefined,
    holdings: data.holdings || undefined,
    stake: data.stake || undefined,
    accountType: data.accountType || undefined,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
    emailSentAt: data.emailSentAt || undefined,
    accountClaimedAt: data.accountClaimedAt || undefined,
  } as OfficialShareholder;
};

/**
 * Official Shareholder Service
 * Manages the officialShareholders collection for tracking pre-verified, verified, and null status investors
 */
export const officialShareholderService = {
  /**
   * Get a single official shareholder by ID
   */
  async getById(shareholderId: string): Promise<OfficialShareholder | null> {
    try {
      const docRef = doc(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS, shareholderId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return firestoreToOfficialShareholder(docSnap as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting official shareholder:', error);
      throw error;
    }
  },

  /**
   * Get all official shareholders with optional filters
   */
  async getAll(filters?: {
    status?: ShareholderStatusType;
    limitCount?: number;
  }): Promise<OfficialShareholder[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      // Order by updatedAt descending (most recent first)
      try {
        constraints.push(orderBy('updatedAt', 'desc'));
      } catch (e) {
        console.warn('Could not order by updatedAt, continuing without ordering:', e);
      }
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(firestoreToOfficialShareholder);
    } catch (error) {
      console.error('Error getting official shareholders:', error);
      throw error;
    }
  },

  /**
   * Create a new official shareholder
   */
  async create(shareholder: OfficialShareholder): Promise<string> {
    try {
      const docRef = doc(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS, shareholder.id);
      const now = new Date().toISOString();
      
      const firestoreData = officialShareholderToFirestore({
        ...shareholder,
        createdAt: now,
        updatedAt: now,
      });
      
      await setDoc(docRef, firestoreData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating official shareholder:', error);
      throw error;
    }
  },

  /**
   * Create or update an official shareholder
   */
  async upsert(shareholder: OfficialShareholder): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS, shareholder.id);
      const now = new Date().toISOString();
      
      // Check if document exists
      const existing = await getDoc(docRef);
      const firestoreData = officialShareholderToFirestore({
        ...shareholder,
        updatedAt: now,
        createdAt: existing.exists() ? shareholder.createdAt : now,
      });
      
      await setDoc(docRef, firestoreData, { merge: true });
    } catch (error) {
      console.error('Error upserting official shareholder:', error);
      throw error;
    }
  },

  /**
   * Update an existing official shareholder
   */
  async update(shareholderId: string, updates: Partial<OfficialShareholder>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS, shareholderId);
      const updateData = removeUndefined({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating official shareholder:', error);
      throw error;
    }
  },

  /**
   * Delete an official shareholder
   */
  async delete(shareholderId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS, shareholderId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting official shareholder:', error);
      throw error;
    }
  },

  /**
   * Subscribe to real-time updates for official shareholders
   */
  subscribeToOfficialShareholders(
    callback: (shareholders: OfficialShareholder[]) => void,
    filters?: { status?: ShareholderStatusType }
  ): Unsubscribe {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      // Do NOT use orderBy here — ordering is done client-side after applicant data is merged.
      // Using Firestore orderBy('updatedAt') combined with includeMetadataChanges caused
      // a self-triggering loop: any write inside the callback changed updatedAt → new snapshot
      // → callback fires again → re-orders the list continuously.
      // Client-side sort (in ShareholdersRegistry) is stable and won't cause Firestore writes.
      
      const q = query(collection(db, COLLECTIONS.OFFICIAL_SHAREHOLDERS), ...constraints);
      
      // Do NOT use includeMetadataChanges:true — that fires the callback on local pending writes
      // (before server confirms), which caused intermediate reorders on every Firestore write.
      return onSnapshot(q, (snapshot) => {
        try {
          const shareholders = snapshot.docs.map(firestoreToOfficialShareholder);
          callback(shareholders);
        } catch (error) {
          console.error('Error processing official shareholders snapshot:', error);
          callback([]);
        }
      }, (error) => {
        console.error('Error in official shareholders subscription:', error);
        callback([]);
      });
    } catch (error) {
      console.error('Error subscribing to official shareholders:', error);
      // Return a no-op unsubscribe function
      return () => {};
    }
  },
};

