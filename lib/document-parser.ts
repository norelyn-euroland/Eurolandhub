/**
 * Document Parser Service
 * Handles CSV file parsing for investor data
 */

import { parsedDocumentService } from './parsed-document-service';
import { readCSVFile } from './csv-parser';

export interface ParseDocumentResponse {
  success: boolean;
  csvText?: string; // Changed from markdown to csvText
  documentId?: string; // Firestore document ID if saved
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  error?: string;
}

/**
 * Parse a CSV file
 * @param file - CSV file object
 * @param saveToFirebase - Whether to save to Firebase (default: false, since we don't need markdown anymore)
 * @returns Promise with CSV text
 */
export async function parseDocument(file: File, saveToFirebase: boolean = false): Promise<ParseDocumentResponse> {
  try {
    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      return {
        success: false,
        error: `File size exceeds 10MB limit. Your file is ${fileSizeMB}MB.`,
      };
    }

    // Only allow CSV files
    const validTypes = ['text/csv'];
    const validExtensions = ['.csv'];
    
    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType && !isValidExtension) {
      return {
        success: false,
        error: 'Only CSV files (.csv) are allowed. Please upload a CSV file using the template.',
      };
    }

    // Read CSV file directly
    const csvText = await readCSVFile(file);

    const metadata = {
      fileName: file.name,
      fileType: 'text/csv',
      fileSize: file.size,
    };

    // Optionally save to Firebase if needed
    let documentId: string | undefined;
    if (saveToFirebase && csvText) {
      try {
        documentId = await parsedDocumentService.save({
          fileName: metadata.fileName,
          fileType: metadata.fileType,
          fileSize: metadata.fileSize,
          markdown: csvText, // Store CSV text in markdown field for compatibility
          uploadedAt: new Date().toISOString(),
          parsedAt: new Date().toISOString(),
          status: 'completed',
          metadata: {
            originalFileName: file.name,
            mimeType: file.type,
          },
        });
        console.log('✅ CSV file saved to Firebase:', documentId);
      } catch (firebaseError) {
        console.error('⚠️ Failed to save to Firebase:', firebaseError);
      }
    }

    return {
      success: true,
      csvText,
      documentId,
      metadata,
    };
  } catch (error: any) {
    console.error('CSV parsing error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to parse CSV file',
    };
  }
}
