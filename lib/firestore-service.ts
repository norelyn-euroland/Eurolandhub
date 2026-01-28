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
import { db } from './firebase';
import { Applicant, RegistrationStatus } from './types';

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
    // Include any additional fields the frontend might send
    ...Object.fromEntries(
      Object.entries(data).filter(([key]) => 
        !['fullName', 'name', 'email', 'phoneNumber', 'phone', 'location', 
          'submissionDate', 'lastActive', 'status', 'idDocumentUrl', 'idDocument',
          'taxDocumentUrl', 'taxDocument', 'holdingsRecord', 'emailOtpVerification',
          'shareholdingsVerification'].includes(key)
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
   * Create a new applicant
   */
  async create(applicant: Applicant): Promise<string> {
    try {
      const docRef = doc(db, COLLECTIONS.APPLICANTS, applicant.id);
      await setDoc(docRef, applicantToFirestore(applicant));
      return docRef.id;
    } catch (error) {
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
          const applicants = snapshot.docs.map(firestoreToApplicant);
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
  }
};

