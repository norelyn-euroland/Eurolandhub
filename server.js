import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Busboy from 'busboy';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow requests from Vite dev server
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

// Middleware to parse JSON (for other endpoints)
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

// POST /api/parse-document endpoint
app.post('/api/parse-document', (req, res) => {
  console.log('📥 Received request to /api/parse-document');
  
  // Parse FormData using busboy
  const busboy = Busboy({ headers: req.headers });
  let fileBuffer = null;
  let fileName = 'document';
  let fileType = '';

  busboy.on('file', (name, file, info) => {
    const { filename, mimeType } = info;
    fileName = filename || 'document';
    fileType = mimeType || '';
    
    console.log(`📄 Processing file: ${fileName} (${fileType})`);
    
    const chunks = [];
    file.on('data', (chunk) => {
      chunks.push(chunk);
    });
    
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      console.log(`✅ File received: ${fileName} (${fileBuffer.length} bytes)`);
    });
  });

  busboy.on('finish', async () => {
    if (!fileBuffer) {
      return res.status(400).json({ 
        success: false,
        error: 'No file provided' 
      });
    }

    // File size limit: 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (fileBuffer.length > MAX_FILE_SIZE) {
      const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
      return res.status(400).json({
        success: false,
        error: `File size exceeds 10MB limit. Your file is ${fileSizeMB}MB.`
      });
    }

    // Validate file type - Only allow PNG, JPG, CSV, and PDF
    const validTypes = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg'];
    const isValidType = validTypes.includes(fileType.toLowerCase());
    const isValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExtension) {
      return res.status(400).json({
        success: false,
        error: 'Only PNG, JPG, CSV, and PDF files are allowed.'
      });
    }

    // For CSV files, parse locally (faster, no need for Python service)
    if (fileType.includes('csv') || fileName.toLowerCase().endsWith('.csv')) {
      console.log('📊 Parsing CSV file locally');
      const csvText = fileBuffer.toString('utf-8');
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return res.status(200).json({
          success: true,
          markdown: '# CSV Document\n\n*Empty CSV file*',
          metadata: {
            fileName,
            fileType: 'text/csv',
            fileSize: fileBuffer.length,
          },
        });
      }

      // Parse CSV to markdown table
      const parseCSVLine = (line) => {
        const result = [];
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
      const headers = rows[0];
      let markdown = '# CSV Document\n\n';
      markdown += '| ' + headers.join(' | ') + ' |\n';
      markdown += '|' + headers.map(() => '---').join('|') + '|\n';
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length === headers.length) {
          markdown += '| ' + row.join(' | ') + ' |\n';
        }
      }

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
    const doclingServiceUrl = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';
    console.log(`🔄 Forwarding ${fileType} file (${fileName}, ${fileBuffer.length} bytes) to Docling service at ${doclingServiceUrl}`);
    
    // First, check if Python service is available
    try {
      const healthCheck = await fetch(`${doclingServiceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      
      if (!healthCheck.ok) {
        console.warn(`⚠️ Python service health check failed: ${healthCheck.status}`);
        throw new Error(`Python service is not healthy (status: ${healthCheck.status})`);
      }
      
      const healthData = await healthCheck.json();
      console.log(`✅ Python service is healthy:`, healthData);
    } catch (healthError) {
      console.error(`❌ Cannot connect to Python Docling service at ${doclingServiceUrl}:`, healthError.message);
      console.error(`   Make sure the Python service is running. Start it with:`);
      console.error(`   cd docling-service`);
      console.error(`   python main.py`);
      return res.status(503).json({
        success: false,
        error: 'Document parsing service is unavailable',
        detail: `Cannot connect to Python Docling service at ${doclingServiceUrl}. The service is not running.`,
        instructions: [
          '1. Open a new terminal',
          '2. Navigate to: cd docling-service',
          '3. Start the service: python main.py',
          '4. Wait for "Application startup complete" message',
          '5. Try uploading the file again'
        ],
        fallback: 'You can still use CSV files, which are parsed locally without the Python service.',
      });
    }

    try {
      // Manually construct multipart/form-data body for FastAPI compatibility
      // This ensures proper boundary formatting that FastAPI expects
      const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
      const CRLF = '\r\n';
      
      // Build multipart body
      const headerPart = 
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
        `Content-Type: ${fileType || 'application/octet-stream'}${CRLF}${CRLF}`;
      
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
        const errorText = await pythonResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { detail: errorText || `Python service returned ${pythonResponse.status}` };
        }
        
        console.error(`❌ Python service error (${pythonResponse.status}):`, errorData);
        
        // Check if Python service is available
        try {
          const healthCheck = await fetch(`${doclingServiceUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          
          if (!healthCheck.ok) {
            return res.status(503).json({
              success: false,
              error: 'Document parsing service is unavailable',
              detail: `The Python Docling microservice is not running or not accessible at ${doclingServiceUrl}. Please ensure it is running.`,
              fallback: 'You can still use CSV files, which are parsed locally.',
            });
          }
        } catch (healthError) {
          return res.status(503).json({
            success: false,
            error: 'Document parsing service is unavailable',
            detail: `Cannot connect to Python Docling service at ${doclingServiceUrl}. Please ensure it is running.`,
            fallback: 'You can still use CSV files, which are parsed locally.',
          });
        }

        // If health check passes but parse fails, return the error
        return res.status(500).json({
          success: false,
          error: 'Failed to parse document',
          detail: errorData.detail || errorData.error || String(errorData),
        });
      }

      const result = await pythonResponse.json();
      console.log('✅ Successfully parsed document with Docling');
      console.log('📄 Markdown length:', result.markdown?.length || 0, 'characters');
      
      // Extract markdown from result (handle different response formats)
      let markdown = '';
      if (result.markdown) {
        markdown = result.markdown;
      } else if (result.document && typeof result.document.export_to_markdown === 'function') {
        markdown = result.document.export_to_markdown();
      } else if (result.document && result.document.markdown) {
        markdown = result.document.markdown;
      } else if (typeof result === 'string') {
        markdown = result;
      }
      
      // Return the result from Python service
      return res.status(200).json({
        success: true,
        markdown: markdown || '# Document Parsed\n\n*No text content extracted.*',
        metadata: result.metadata || {
          fileName,
          fileType,
          fileSize: fileBuffer.length,
        },
      });
    } catch (pythonError) {
      console.error('❌ Error calling Python Docling service:', pythonError);
      
      // Check if Python service is available
      try {
        const healthCheck = await fetch(`${doclingServiceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (!healthCheck.ok) {
          return res.status(503).json({
            success: false,
            error: 'Document parsing service is unavailable',
            detail: `The Python Docling microservice is not running at ${doclingServiceUrl}. Please start it with: cd docling-service && python main.py`,
            fallback: 'You can still use CSV files, which are parsed locally.',
          });
        }
      } catch (healthError) {
        return res.status(503).json({
          success: false,
          error: 'Document parsing service is unavailable',
          detail: `Cannot connect to Python Docling service at ${doclingServiceUrl}. Please ensure it is running.`,
          fallback: 'You can still use CSV files, which are parsed locally.',
        });
      }

      // If health check passes but parse fails, return the error
      return res.status(500).json({
        success: false,
        error: 'Failed to parse document',
        detail: pythonError?.message || String(pythonError),
      });
    }
  });

  busboy.on('error', (err) => {
    console.error('❌ Busboy error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to parse file upload',
      detail: err.message,
    });
  });

  // Pipe the request to busboy
  req.pipe(busboy);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📄 Parse endpoint: http://localhost:${PORT}/api/parse-document`);
  console.log(`✅ CORS enabled for: http://localhost:3000`);
});

