import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// Collection name for parsed documents
const COLLECTIONS = {
  PARSED_DOCUMENTS: 'parsed_documents'
} as const;

/**
 * Parsed Document Interface
 */
export interface ParsedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  markdown: string;
  uploadedAt: string; // ISO string
  parsedAt: string; // ISO string
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  metadata?: {
    originalFileName?: string;
    mimeType?: string;
    [key: string]: any;
  };
}

/**
 * Convert Firestore Timestamp to ISO string
 */
const timestampToIso = (timestamp: any): string => {
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
 * Convert ParsedDocument to Firestore format
 */
const parsedDocumentToFirestore = (doc: ParsedDocument): DocumentData => {
  return {
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    markdown: doc.markdown,
    uploadedAt: Timestamp.fromDate(new Date(doc.uploadedAt)),
    parsedAt: Timestamp.fromDate(new Date(doc.parsedAt)),
    status: doc.status,
    error: doc.error || null,
    metadata: doc.metadata || null,
  };
};

/**
 * Convert Firestore document to ParsedDocument
 */
const firestoreToParsedDocument = (doc: QueryDocumentSnapshot<DocumentData>): ParsedDocument => {
  const data = doc.data();
  return {
    id: doc.id,
    fileName: data.fileName || '',
    fileType: data.fileType || '',
    fileSize: data.fileSize || 0,
    markdown: data.markdown || '',
    uploadedAt: timestampToIso(data.uploadedAt),
    parsedAt: timestampToIso(data.parsedAt),
    status: data.status || 'pending',
    error: data.error || undefined,
    metadata: data.metadata || undefined,
  };
};

/**
 * Parsed Document Service
 */
export const parsedDocumentService = {
  /**
   * Save a parsed document to Firestore
   */
  async save(parsedDoc: Omit<ParsedDocument, 'id'>): Promise<string> {
    try {
      const now = new Date().toISOString();
      const docData: Omit<ParsedDocument, 'id'> = {
        ...parsedDoc,
        uploadedAt: parsedDoc.uploadedAt || now,
        parsedAt: parsedDoc.parsedAt || now,
      };

      const docRef = doc(collection(db, COLLECTIONS.PARSED_DOCUMENTS));
      await setDoc(docRef, parsedDocumentToFirestore({ ...docData, id: docRef.id } as ParsedDocument));
      
      return docRef.id;
    } catch (error) {
      console.error('Error saving parsed document:', error);
      throw error;
    }
  },

  /**
   * Get a parsed document by ID
   */
  async getById(documentId: string): Promise<ParsedDocument | null> {
    try {
      const docRef = doc(db, COLLECTIONS.PARSED_DOCUMENTS, documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return firestoreToParsedDocument(docSnap as QueryDocumentSnapshot<DocumentData>);
    } catch (error) {
      console.error('Error getting parsed document:', error);
      throw error;
    }
  },

  /**
   * Get all parsed documents, ordered by most recent first
   */
  async getAll(limitCount?: number): Promise<ParsedDocument[]> {
    try {
      const constraints: any[] = [orderBy('parsedAt', 'desc')];
      
      if (limitCount) {
        constraints.push(limit(limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.PARSED_DOCUMENTS), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(firestoreToParsedDocument);
    } catch (error) {
      console.error('Error getting parsed documents:', error);
      throw error;
    }
  },

  /**
   * Delete a parsed document
   */
  async delete(documentId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.PARSED_DOCUMENTS, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting parsed document:', error);
      throw error;
    }
  },
};



