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
import { Applicant, RegistrationStatus, Shareholder } from './types.js';
import { isLocked } from './shareholdingsVerification.js';
import { LockedAccountError, calculateRemainingDays } from './registration-errors.js';

// Collection names
const COLLECTIONS = {
  APPLICANTS: 'applicants',
  USERS: 'users',
  SHAREHOLDERS: 'shareholders'
} as const;

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
 * Flexible conversion that handles whatever structure the frontend sends
 */
const firestoreToApplicant = (doc: QueryDocumentSnapshot<DocumentData>): Applicant => {
  const data = doc.data();
  
  // Handle submissionDate - can be Timestamp, Date, or string
  let submissionDate = '';
  if (data.submissionDate) {
    submissionDate = timestampToString(data.submissionDate);
  } else if (data.submissionDate === undefined) {
    // If missing, use current date as fallback
    submissionDate = new Date().toISOString().split('T')[0];
  }
  
  // Return with all data from Firestore, ensuring required fields have defaults
  return {
    id: doc.id,
    fullName: data.fullName || data.name || 'Unknown',
    email: data.email || '',
    phoneNumber: data.phoneNumber || data.phone || undefined,
    location: data.location || undefined,
    submissionDate,
    lastActive: data.lastActive || 'Just now',
    status: data.status || RegistrationStatus.PENDING,
    idDocumentUrl: data.idDocumentUrl || data.idDocument || '',
    taxDocumentUrl: data.taxDocumentUrl || data.taxDocument || '',
    holdingsRecord: data.holdingsRecord || undefined,
    emailOtpVerification: data.emailOtpVerification || undefined,
    shareholdingsVerification: data.shareholdingsVerification || undefined,
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
    // Include any additional fields the frontend might send
    ...Object.fromEntries(
      Object.entries(data).filter(([key]) => 
        !['fullName', 'name', 'email', 'phoneNumber', 'phone', 'location', 
          'submissionDate', 'lastActive', 'status', 'idDocumentUrl', 'idDocument',
          'taxDocumentUrl', 'taxDocument', 'holdingsRecord', 'emailOtpVerification',
          'shareholdingsVerification', 'workflowStage', 'accountStatus', 'systemStatus',
          'statusInFrontend', 'isPreVerified', 'registrationId', 'emailGeneratedAt',
          'emailSentAt', 'emailOpenedAt', 'emailOpenedCount', 'linkClickedAt',
          'linkClickedCount', 'accountClaimedAt'].includes(key)
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
   * Get all applicants with optional filters
   * Flexible query that handles missing fields gracefully
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
      
      // Try to order by submissionDate, but don't fail if field is missing
      // Firestore requires an index for orderBy, so we'll handle errors gracefully
      try {
        constraints.push(orderBy('submissionDate', 'desc'));
      } catch (e) {
        // If orderBy fails (e.g., missing index), continue without it
        console.warn('Could not order by submissionDate, continuing without ordering:', e);
      }
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.APPLICANTS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(firestoreToApplicant);
    } catch (error) {
      console.error('Error getting applicants:', error);
      throw error;
    }
  },

  /**
   * Check for duplicate registrations and lockout status
   * Throws LockedAccountError if a locked account is found with matching email, phone, or name
   */
  async checkDuplicateRegistration(
    email: string,
    phoneNumber?: string,
    fullName?: string
  ): Promise<void> {
    try {
      const constraints: QueryConstraint[] = [];
      
      // Build query to check for duplicates by email, phone, or name
      const conditions: QueryConstraint[] = [];
      
      if (email) {
        conditions.push(where('email', '==', email.toLowerCase().trim()));
      }
      
      if (phoneNumber && phoneNumber.trim()) {
        conditions.push(where('phoneNumber', '==', phoneNumber.trim()));
      }
      
      if (fullName && fullName.trim()) {
        // Normalize name for comparison (case-insensitive, trim spaces)
        const normalizedName = fullName.trim().toLowerCase();
        conditions.push(where('fullName', '==', normalizedName));
      }
      
      if (conditions.length === 0) {
        return; // No fields to check
      }
      
      // Use 'or' to check any of the conditions
      // Note: Firestore 'or' requires all conditions to be on the same field or use array-contains
      // For multiple fields, we'll need to query separately and combine results
      const allResults: Applicant[] = [];
      
      // Query by email
      if (email) {
        const emailQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('email', '==', email.toLowerCase().trim()));
        const emailSnapshot = await getDocs(emailQuery);
        allResults.push(...emailSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Query by phone number
      if (phoneNumber && phoneNumber.trim()) {
        const phoneQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('phoneNumber', '==', phoneNumber.trim()));
        const phoneSnapshot = await getDocs(phoneQuery);
        allResults.push(...phoneSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Query by name - Firestore doesn't support case-insensitive queries natively
      // So we'll fetch all and filter client-side, or query exact match and filter
      // For now, we'll query exact match (case-sensitive) and also do client-side filtering
      if (fullName && fullName.trim()) {
        // Try exact match first
        const nameQuery = query(collection(db, COLLECTIONS.APPLICANTS), where('fullName', '==', fullName.trim()));
        const nameSnapshot = await getDocs(nameQuery);
        allResults.push(...nameSnapshot.docs.map(firestoreToApplicant));
      }
      
      // Remove duplicates (same applicant ID)
      const uniqueResults = Array.from(
        new Map(allResults.map(app => [app.id, app])).values()
      );
      
      // Check if any duplicate is locked
      for (const existingApplicant of uniqueResults) {
        // Check if this is a match (case-insensitive for email and name)
        const emailMatch = email && existingApplicant.email && 
                          existingApplicant.email.toLowerCase().trim() === email.toLowerCase().trim();
        const phoneMatch = phoneNumber && existingApplicant.phoneNumber && 
                          existingApplicant.phoneNumber.trim() === phoneNumber.trim();
        const nameMatch = fullName && existingApplicant.fullName && 
                         existingApplicant.fullName.toLowerCase().trim() === fullName.trim().toLowerCase();
        
        // Only check lockout if there's an actual match
        if ((emailMatch || phoneMatch || nameMatch) && isLocked(existingApplicant)) {
          const lockedUntil = existingApplicant.shareholdingsVerification?.step3.lockedUntil;
          if (lockedUntil) {
            const remainingDays = calculateRemainingDays(lockedUntil);
            
            // Determine which field matched (prioritize email > phone > name)
            let matchedField: 'email' | 'phone' | 'name' = 'email';
            if (emailMatch) {
              matchedField = 'email';
            } else if (phoneMatch) {
              matchedField = 'phone';
            } else if (nameMatch) {
              matchedField = 'name';
            }
            
            const fieldLabel = matchedField === 'email' ? 'email address' : 
                              matchedField === 'phone' ? 'phone number' : 'name';
            
            throw new LockedAccountError(
              `This ${fieldLabel} is associated with an account that is locked for 7 days. Please wait ${remainingDays} day${remainingDays !== 1 ? 's' : ''} before registering again.`,
              remainingDays,
              lockedUntil,
              matchedField
            );
          }
        }
      }
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
   * Create a new applicant
   * Checks for duplicate registrations with locked accounts before creating
   */
  async create(applicant: Applicant): Promise<string> {
    try {
      // Check for duplicate registrations with locked accounts
      await this.checkDuplicateRegistration(
        applicant.email,
        applicant.phoneNumber,
        applicant.fullName
      );
      
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicant.id);
      await setDoc(docRef, applicantToFirestore(applicant));
      return docRef.id;
    } catch (error) {
      // Re-throw LockedAccountError as-is (don't wrap it)
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
      
      await updateDoc(docRef, updateData);
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
      
      // Try to order by submissionDate, but handle gracefully if it fails
      try {
        constraints.push(orderBy('submissionDate', 'desc'));
      } catch (e) {
        // If orderBy fails (e.g., missing index or field), continue without it
        console.warn('Could not order by submissionDate in subscription, continuing without ordering:', e);
      }
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.APPLICANTS), ...constraints);
      
      return onSnapshot(q, (snapshot) => {
        try {
          // Firestore onSnapshot automatically handles deletions - deleted docs are removed from snapshot.docs
          // This means the callback will receive an updated array without deleted documents
          const applicants = snapshot.docs.map(firestoreToApplicant);
          
          // Log changes for debugging (only in development)
          if (process.env.NODE_ENV === 'development') {
            const changeCounts = snapshot.docChanges().reduce((acc, change) => {
              acc[change.type] = (acc[change.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            if (Object.keys(changeCounts).length > 0) {
              console.log('Applicants snapshot changes:', changeCounts, `Total: ${applicants.length}`);
            }
          }
          
          callback(applicants);
        } catch (error) {
          console.error('Error processing snapshot data:', error);
          // Still call callback with empty array to prevent UI breaking
          callback([]);
        }
      }, (error) => {
        console.error('Error in applicants subscription:', error);
        // Call callback with empty array on error to prevent UI breaking
        callback([]);
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
      
      return onSnapshot(q, (snapshot) => {
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
   */
  async migrateApplicants(applicants: Applicant[]): Promise<void> {
    try {
      const promises = applicants.map(applicant => 
        applicantService.create(applicant)
      );
      await Promise.all(promises);
      console.log(`Successfully migrated ${applicants.length} applicants to Firestore`);
    } catch (error) {
      console.error('Error migrating applicants:', error);
      throw error;
    }
  },

  /**
   * Migrate mock shareholders to Firestore
   */
  async migrateShareholders(shareholders: Shareholder[]): Promise<void> {
    try {
      const promises = shareholders.map(shareholder => 
        shareholderService.create(shareholder)
      );
      await Promise.all(promises);
      console.log(`Successfully migrated ${shareholders.length} shareholders to Firestore`);
    } catch (error) {
      console.error('Error migrating shareholders:', error);
      throw error;
    }
  }
};

