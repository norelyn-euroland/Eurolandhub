"""
Docling Document Parsing Microservice
Parses PDF, CSV, and Image files and converts them to markdown format.

This service uses IBM Docling to extract text from documents.
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from typing import Optional
import logging

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Docling
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    DOCLING_AVAILABLE = True
    logger.info("Docling imported successfully")
except ImportError as e:
    DOCLING_AVAILABLE = False
    DocumentConverter = None  # Dummy value for type hints
    PdfFormatOption = None
    InputFormat = None
    logger.error(f"Failed to import Docling: {e}")
    logger.warning("Docling not available - PDF/image parsing will be unavailable. CSV parsing will still work.")
except Exception as e:
    DOCLING_AVAILABLE = False
    DocumentConverter = None
    PdfFormatOption = None
    InputFormat = None
    logger.error(f"Unexpected error importing Docling: {e}")
    logger.warning("Docling not available - PDF/image parsing will be unavailable. CSV parsing will still work.")

app = FastAPI(
    title="Docling Document Parser",
    description="Microservice for parsing documents (PDF, CSV, Images) to markdown using Docling",
    version="1.0.0"
)

# CORS middleware to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Docling converter
converter: Optional["DocumentConverter"] = None  # Use string annotation to avoid NameError if import fails

if DOCLING_AVAILABLE:
    try:
        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption()
            }
        )
        logger.info("Docling converter initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Docling converter: {e}", exc_info=True)
        logger.warning("Service will continue without Docling - PDF/image parsing will be unavailable")
        converter = None
        DOCLING_AVAILABLE = False  # Mark as unavailable if initialization fails
else:
    logger.warning("Docling not available - PDF/image parsing will be unavailable. CSV parsing will still work.")


def parse_csv_to_markdown(csv_content: str) -> str:
    """Parse CSV content and convert to markdown table format."""
    lines = [line.strip() for line in csv_content.split('\n') if line.strip()]
    if not lines:
        return ''
    
    # Parse CSV lines (handle quoted values)
    def parse_csv_line(line: str) -> list:
        result = []
        current = ''
        in_quotes = False
        
        for char in line:
            if char == '"':
                in_quotes = not in_quotes
            elif char == ',' and not in_quotes:
                result.append(current.strip())
                current = ''
            else:
                current += char
        result.append(current.strip())
        return result
    
    rows = [parse_csv_line(line) for line in lines]
    if not rows:
        return ''
    
    headers = rows[0]
    markdown = '## Document Data\n\n'
    markdown += '| ' + ' | '.join(headers) + ' |\n'
    markdown += '|' + '|'.join(['---' for _ in headers]) + '|\n'
    
    for row in rows[1:]:
        if len(row) == len(headers):
            markdown += '| ' + ' | '.join(row) + ' |\n'
    
    return markdown


def parse_pdf_with_docling(file_content: bytes, filename: str) -> str:
    """Parse PDF using Docling and convert to markdown."""
    if not DOCLING_AVAILABLE or converter is None:
        raise HTTPException(
            status_code=503,
            detail="Docling is not available. Please install docling: pip install docling"
        )
    
    try:
        # Save file temporarily
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        try:
            # Convert PDF to markdown using Docling
            result = converter.convert(tmp_path)
            
            # Extract markdown from Docling result
            # Docling returns a Document object with markdown property
            if hasattr(result, 'document'):
                markdown = result.document.export_to_markdown()
            elif hasattr(result, 'markdown'):
                markdown = result.markdown
            else:
                # Fallback: try to get text content
                markdown = str(result)
            
            return markdown if markdown else f"## PDF Document: {filename}\n\n*No text extracted from PDF.*"
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        logger.error(f"Error parsing PDF with Docling: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse PDF: {str(e)}"
        )


def parse_image_with_docling(file_content: bytes, filename: str) -> str:
    """Parse image using Docling OCR and convert to markdown."""
    if not DOCLING_AVAILABLE or converter is None:
        logger.error("Image parsing requested but Docling is not available")
        raise HTTPException(
            status_code=503,
            detail="Image parsing is currently unavailable. Docling service is not initialized. Please contact support or try uploading a CSV file instead."
        )
    
    try:
        # Save file temporarily
        import tempfile
        import mimetypes
        
        # Determine file extension
        ext = os.path.splitext(filename)[1] or '.png'
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name
        
        try:
            # Convert image to markdown using Docling
            result = converter.convert(tmp_path)
            
            # Extract markdown from Docling result
            if hasattr(result, 'document'):
                markdown = result.document.export_to_markdown()
            elif hasattr(result, 'markdown'):
                markdown = result.markdown
            else:
                markdown = str(result)
            
            return markdown if markdown else f"## Image Document: {filename}\n\n*No text extracted from image.*"
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        logger.error(f"Error parsing image with Docling: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse image: {str(e)}"
        )


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Docling Document Parser",
        "status": "running",
        "docling_available": DOCLING_AVAILABLE
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "docling_available": DOCLING_AVAILABLE,
        "converter_initialized": converter is not None
    }


@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    """
    Parse uploaded document and return markdown.
    
    Supports:
    - PDF files (.pdf)
    - CSV files (.csv)
    - Image files (.png, .jpg, .jpeg only)
    
    File size limit: 10MB
    """
    # File size limit: 10MB
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
    
    try:
        # Read file content
        file_content = await file.read()
        filename = file.filename or "document"
        content_type = file.content_type or ""
        file_size = len(file_content)
        
        logger.info(f"Parsing file: {filename} (type: {content_type}, size: {file_size} bytes)")
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            file_size_mb = file_size / 1024 / 1024
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds 10MB limit. Your file is {file_size_mb:.2f}MB. Please upload a smaller file."
            )
        
        # Validate file type - Only allow PNG, JPG, CSV, and PDF
        valid_extensions = ['.pdf', '.csv', '.png', '.jpg', '.jpeg']
        valid_types = ['application/pdf', 'text/csv', 'image/png', 'image/jpeg', 'image/jpg']
        
        has_valid_extension = any(filename.lower().endswith(ext) for ext in valid_extensions)
        has_valid_type = content_type.lower() in valid_types
        
        if not has_valid_extension and not has_valid_type:
            raise HTTPException(
                status_code=400,
                detail="Only PNG, JPG, CSV, and PDF files are allowed. Please upload a supported file type."
            )
        
        # Determine file type and parse accordingly
        if filename.lower().endswith('.csv') or 'csv' in content_type.lower():
            # Parse CSV
            csv_text = file_content.decode('utf-8')
            markdown = parse_csv_to_markdown(csv_text)
            file_type = 'text/csv'
            
        elif filename.lower().endswith('.pdf') or 'pdf' in content_type.lower():
            # Parse PDF with Docling
            markdown = parse_pdf_with_docling(file_content, filename)
            file_type = 'application/pdf'
            
        elif any(filename.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg']) or content_type.lower() in ['image/png', 'image/jpeg', 'image/jpg']:
            # Parse image with Docling OCR (only PNG and JPG)
            markdown = parse_image_with_docling(file_content, filename)
            file_type = content_type or 'image'
            
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Please upload PDF, CSV, or Image files only."
            )
        
        return JSONResponse({
            "success": True,
            "markdown": markdown,
            "metadata": {
                "fileName": filename,
                "fileType": file_type,
                "fileSize": len(file_content)
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse document: {str(e)}"
        )


if __name__ == "__main__":
    # Run the service
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

