/**
 * Document Parser Service
 * Handles document parsing using Docling (or fallback parsers)
 * Converts PDF, CSV, and Images to markdown format
 */

import { parsedDocumentService } from './parsed-document-service';

export interface ParseDocumentResponse {
  success: boolean;
  markdown: string;
  documentId?: string; // Firestore document ID if saved
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
  error?: string;
}

/**
 * Parse a document file and convert to markdown
 * @param file - File object from input
 * @param saveToFirebase - Whether to save the parsed document to Firebase (default: true)
 * @returns Promise with parsed markdown and Firestore document ID
 */
export async function parseDocument(file: File, saveToFirebase: boolean = true): Promise<ParseDocumentResponse> {
  try {
    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      return {
        success: false,
        markdown: '',
        error: `File size exceeds 10MB limit. Your file is ${fileSizeMB}MB. Please upload a smaller file.`,
      };
    }

    // Validate file type - Only allow PNG, JPG, CSV, and PDF
    const validTypes = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg'];
    
    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType && !isValidExtension) {
      return {
        success: false,
        markdown: '',
        error: 'Only PNG, JPG, CSV, and PDF files are allowed. Please upload a supported file type.',
      };
    }

    // Use FormData instead of base64 to avoid stack overflow with large files
    const formData = new FormData();
    formData.append('file', file);

    // Get API URL from environment variable or use default
    // In production (Vercel), use same origin (empty string). In dev, use localhost:3001
    const API_URL = import.meta.env.VITE_API_URL || 
      (import.meta.env.PROD ? '' : 'http://localhost:3001');
    const apiEndpoint = `${API_URL}/api/parse-document`;

    // Call the parsing API endpoint
    let response: Response;
    try {
      response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      });
    } catch (fetchError: any) {
      console.error('Error fetching parse-document:', fetchError);
      // Check if it's a network error (API server not running)
      if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
        return {
          success: false,
          markdown: '',
          error: `Cannot connect to API server at ${apiEndpoint}. Please ensure the API server is running. Start it with: npm run dev:api`,
        };
      }
      return {
        success: false,
        markdown: '',
        error: fetchError?.message || 'Failed to connect to parsing service',
      };
    }

    if (!response.ok) {
      let errorData: any;
      try {
        const errorText = await response.text();
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      
      // Provide helpful error messages
      let errorMessage = errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
      
      // Add instructions if service is unavailable
      if (response.status === 503 && errorData.instructions) {
        errorMessage += '\n\n' + errorData.instructions.join('\n');
      }
      
      return {
        success: false,
        markdown: '',
        error: errorMessage,
      };
    }

    const data = await response.json();
    const markdown = data.markdown || '';
    const metadata = data.metadata || {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };

    // Save to Firebase if requested
    let documentId: string | undefined;
    if (saveToFirebase && markdown) {
      try {
        documentId = await parsedDocumentService.save({
          fileName: metadata.fileName,
          fileType: metadata.fileType,
          fileSize: metadata.fileSize,
          markdown: markdown,
          uploadedAt: new Date().toISOString(),
          parsedAt: new Date().toISOString(),
          status: 'completed',
          metadata: {
            originalFileName: file.name,
            mimeType: file.type,
          },
        });
        console.log('✅ Parsed document saved to Firebase:', documentId);
      } catch (firebaseError) {
        console.error('⚠️ Failed to save to Firebase (parsing still succeeded):', firebaseError);
        // Don't fail the whole operation if Firebase save fails
      }
    }

    return {
      success: true,
      markdown,
      documentId,
      metadata,
    };
  } catch (error: any) {
    console.error('Document parsing error:', error);
    return {
      success: false,
      markdown: '',
      error: error?.message || 'Failed to parse document',
    };
  }
}

/**
 * Parse CSV content directly (for client-side CSV parsing)
 */
export function parseCSVToMarkdown(csvText: string): string {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return '';
  
  // Handle quoted CSV values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const rows = lines.map(parseCSVLine);
  if (rows.length === 0) return '';
  
  const headers = rows[0];
  let markdown = '## Document Data\n\n';
  markdown += '| ' + headers.join(' | ') + ' |\n';
  markdown += '|' + headers.map(() => '---').join('|') + '|\n';
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === headers.length) {
      markdown += '| ' + row.join(' | ') + ' |\n';
    }
  }
  
  return markdown;
}

