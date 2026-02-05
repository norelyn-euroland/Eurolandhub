import type { VercelRequest, VercelResponse } from '@vercel/node';
import Busboy from 'busboy';

/**
 * Document Parsing API Endpoint
 * 
 * Handles CSV file uploads and returns CSV text directly
 */

interface ParsedDocument {
  csvText: string;
  metadata?: {
    fileName: string;
    fileType: string;
    fileSize: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  // File size limit: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

  try {
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

    // Validate file type - Only allow CSV
    const validTypes = ['text/csv'];
    const validExtensions = ['.csv'];
    const isValidType = validTypes.includes(fileType.toLowerCase());
    const isValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExtension) {
      res.status(400).json({ 
        error: 'Only CSV files are allowed. Please download the template, fill it in, and upload it.' 
      });
      return;
    }

    // For CSV files, parse locally
    if (fileType.includes('csv') || fileName.toLowerCase().endsWith('.csv')) {
      const csvText = fileBuffer.toString('utf-8');
      return res.status(200).json({
        success: true,
        csvText: csvText,
        metadata: {
          fileName,
          fileType: 'text/csv',
          fileSize: fileBuffer.length,
        },
      });
    }

    // Should not reach here if validation is correct
    res.status(400).json({
      error: 'Only CSV files are allowed. Please download the template, fill it in, and upload it.'
    });
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
