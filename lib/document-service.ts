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
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { Document, DocumentType, DocumentStatus } from './types.js';

// Collection name
const COLLECTIONS = {
  DOCUMENTS: 'documents'
} as const;

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToISO = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return timestamp;
};

/**
 * Convert ISO string to Firestore Timestamp
 */
const isoToTimestamp = (isoString: string): Timestamp => {
  return Timestamp.fromDate(new Date(isoString));
};

/**
 * Convert Document data for Firestore (minimal schema)
 */
const documentToFirestore = (document: Document): DocumentData => {
  return {
    title: document.title,
    type: document.type,
    status: document.status,
    publishDate: document.publishDate,
    createdAt: isoToTimestamp(document.createdAt),
    updatedAt: isoToTimestamp(document.updatedAt),
    summary: document.summary,
    summaryRegenerationCount: document.summaryRegenerationCount || 0,
  };
};

/**
 * Convert Firestore document to Document (minimal schema)
 */
const firestoreToDocument = (doc: QueryDocumentSnapshot<DocumentData>): Document => {
  const data = doc.data();
  
  return {
    id: doc.id,
    title: data.title || '',
    type: data.type as DocumentType,
    status: data.status as DocumentStatus,
    publishDate: data.publishDate || new Date().toISOString().split('T')[0],
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
    summary: data.summary || '',
    summaryRegenerationCount: data.summaryRegenerationCount || 0,
  } as Document;
};

/**
 * Document Service
 */
export const documentService = {
  /**
   * Get a single document by ID
   */
  async getById(documentId: string): Promise<Document | null> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return firestoreToDocument(docSnap as QueryDocumentSnapshot<DocumentData>);
      }
      return null;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  /**
   * Get all documents with optional filters
   */
  async getAll(filters?: {
    type?: DocumentType;
    status?: DocumentStatus;
    limitCount?: number;
  }): Promise<Document[]> {
    try {
      const constraints: QueryConstraint[] = [];
      
      if (filters?.type) {
        constraints.push(where('type', '==', filters.type));
      }
      
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }
      
      // Order by createdAt descending (newest first)
      constraints.push(orderBy('createdAt', 'desc'));
      
      if (filters?.limitCount) {
        constraints.push(limit(filters.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.DOCUMENTS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(firestoreToDocument);
    } catch (error) {
      console.error('Error getting documents:', error);
      throw error;
    }
  },

  /**
   * Create a new document
   */
  async create(document: Document): Promise<string> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, document.id);
      await setDoc(docRef, documentToFirestore(document));
      return docRef.id;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  /**
   * Update an existing document
   */
  async update(documentId: string, updates: Partial<Document>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
      
      const updateData: any = {
        updatedAt: Timestamp.now(),
      };
      
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.publishDate !== undefined) updateData.publishDate = updates.publishDate;
      if (updates.summary !== undefined) updateData.summary = updates.summary;
      if (updates.summaryRegenerationCount !== undefined) updateData.summaryRegenerationCount = updates.summaryRegenerationCount;
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async delete(documentId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },

  /**
   * Archive a document (soft delete)
   */
  async archive(documentId: string): Promise<void> {
    try {
      await this.update(documentId, { status: 'archived' });
    } catch (error) {
      console.error('Error archiving document:', error);
      throw error;
    }
  },
};

