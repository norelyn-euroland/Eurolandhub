import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

/**
 * Document Parsing API Endpoint
 * 
 * This endpoint acts as a proxy to the Python Docling microservice.
 * It forwards file uploads to the Python service which handles the actual parsing.
 * 
 * Python microservice URL is configured via DOCLING_SERVICE_URL environment variable.
 * Default: http://localhost:8000 (for local development)
 */

interface ParsedDocument {
  markdown: string;
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
}

// Helper to parse CSV to markdown
function csvToMarkdown(csvText: string): string {
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

// Helper to extract text from base64 image (basic OCR simulation)
// TODO: Integrate Docling or Tesseract.js for actual OCR
function imageToMarkdown(imageBuffer: Buffer, fileName: string): string {
  // Placeholder for Docling integration
  // In production, call Docling API or use OCR service
  return `## Image Document: ${fileName}\n\n*Image content extraction requires OCR processing*\n\n**TODO: Integrate Docling for OCR text extraction**\n\n*Current implementation is a placeholder. Replace with Docling API call.*`;
}

// Helper to parse PDF to markdown (basic extraction)
// TODO: Integrate Docling or pdf-parse library
function pdfToMarkdown(pdfBuffer: Buffer, fileName: string): string {
  // Placeholder for Docling integration
  // In production, call Docling API or use pdf-parse
  return `## PDF Document: ${fileName}\n\n*PDF content extraction requires parsing library*\n\n**TODO: Integrate Docling for PDF text extraction**\n\n*Current implementation is a placeholder. Replace with Docling API call.*`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  // File size limit: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  try {
    // Get Python microservice URL from environment variable
    const doclingServiceUrl = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';
    
    // Parse FormData using busboy (works better in Vercel serverless)
    const fileData = await new Promise<{ buffer: Buffer; fileName: string; fileType: string }>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let fileBuffer: Buffer | null = null;
      let fileName = 'document';
      let fileType = '';

      busboy.on('file', (name, file, info) => {
        const { filename, encoding, mimeType } = info;
        fileName = filename || 'document';
        fileType = mimeType || '';
        
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on('finish', () => {
        if (!fileBuffer) {
          reject(new Error('No file provided'));
        } else {
          resolve({ buffer: fileBuffer, fileName, fileType });
        }
      });

      busboy.on('error', (err) => {
        reject(err);
      });

      // Pipe the request to busboy
      req.pipe(busboy);
    });

    const fileBuffer = fileData.buffer;
    const fileName = fileData.fileName;
    const fileType = fileData.fileType;

    // Validate file size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      res.status(400).json({ 
        error: `File size exceeds 10MB limit. Your file is ${fileSizeMB}MB. Please upload a smaller file.` 
      });
      return;
    }

    // Validate file type - Only allow PNG, JPG, CSV, and PDF
    const validTypes = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg'];
    const isValidType = validTypes.includes(fileType.toLowerCase());
    const isValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExtension) {
      res.status(400).json({ 
        error: 'Only PNG, JPG, CSV, and PDF files are allowed. Please upload a supported file type.' 
      });
      return;
    }

    // For CSV files, we can parse locally (faster, no need for Python service)
    if (fileType.includes('csv') || fileName.toLowerCase().endsWith('.csv')) {
      const csvText = fileBuffer.toString('utf-8');
      const markdown = csvToMarkdown(csvText);
      return res.status(200).json({
        success: true,
        markdown,
        metadata: {
          fileName,
          fileType: 'text/csv',
          fileSize: fileBuffer.length,
        },
      });
    }

    // For PDF and Images, forward to Python Docling service
    try {
      // Create multipart/form-data manually for Python service
      const boundary = `----WebKitFormBoundary${Date.now()}`;
      const CRLF = '\r\n';
      
      // Build multipart body
      const headerPart = 
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
        `Content-Type: ${fileType}${CRLF}${CRLF}`;
      
      const footerPart = `${CRLF}--${boundary}--${CRLF}`;
      
      const bodyBuffer = Buffer.concat([
        Buffer.from(headerPart, 'utf-8'),
        fileBuffer,
        Buffer.from(footerPart, 'utf-8'),
      ]);

      // Forward request to Python microservice
      const pythonResponse = await fetch(`${doclingServiceUrl}/parse`, {
        method: 'POST',
        body: bodyBuffer,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length.toString(),
        },
      });

      if (!pythonResponse.ok) {
        const errorData = await pythonResponse.json().catch(() => ({ 
          detail: `Python service returned ${pythonResponse.status}` 
        }));
        throw new Error(errorData.detail || errorData.error || 'Python service error');
      }

      const result = await pythonResponse.json();
      
      // Return the result from Python service
      res.status(200).json({
        success: true,
        markdown: result.markdown || '',
        metadata: result.metadata || {
          fileName,
          fileType,
          fileSize: fileBuffer.length,
        },
      });
    } catch (pythonError: any) {
      console.error('Python microservice error:', pythonError);
      
      // Fallback: Check if Python service is available
      try {
        const healthCheck = await fetch(`${doclingServiceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        if (!healthCheck.ok) {
          throw new Error('Python service is not healthy');
        }
      } catch (healthError) {
        return res.status(503).json({
          error: 'Document parsing service is unavailable',
          detail: 'The Python Docling microservice is not running or not accessible. Please ensure it is running on ' + doclingServiceUrl,
          fallback: 'You can still use CSV files, which are parsed locally.',
        });
      }
      
      // If health check passes but parse fails, return the error
      res.status(500).json({
        error: 'Failed to parse document',
        detail: pythonError?.message || String(pythonError),
      });
    }
  } catch (error: any) {
    console.error('Document parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse document', 
      detail: error?.message || String(error) 
    });
  }
}

// Disable body parsing for Vercel - we need raw body for busboy
export const config = {
  api: {
    bodyParser: false,
  },
};

