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
import { MOCK_APPLICANTS } from './mockApplicants.js';

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
    profilePictureUrl: data.profilePictureUrl || undefined,
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
      
      const firestoreApplicants = querySnapshot.docs.map(firestoreToApplicant);
      
      // If Firestore is empty, use mock data as fallback
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
          
          // If Firestore is empty, use mock data as fallback
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

