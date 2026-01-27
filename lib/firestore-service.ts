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
  Timestamp,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot
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
 */
const applicantToFirestore = (applicant: Applicant): DocumentData => {
  // Parse date string (format: YYYY-MM-DD) to Date object
  const dateParts = applicant.submissionDate.split('-');
  const date = new Date(
    parseInt(dateParts[0]),
    parseInt(dateParts[1]) - 1, // Month is 0-indexed
    parseInt(dateParts[2])
  );
  
  // Remove undefined values recursively (Firestore doesn't allow undefined)
  const cleaned = removeUndefined(applicant);
  
  return {
    ...cleaned,
    submissionDate: Timestamp.fromDate(date),
  };
};

/**
 * Convert Firestore document to Applicant
 */
const firestoreToApplicant = (doc: QueryDocumentSnapshot<DocumentData>): Applicant => {
  const data = doc.data();
  return {
    ...data,
    id: doc.id,
    submissionDate: timestampToString(data.submissionDate),
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
      
      constraints.push(orderBy('submissionDate', 'desc'));
      
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

