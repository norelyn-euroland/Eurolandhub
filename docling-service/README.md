# Docling Document Parsing Microservice

A Python microservice that uses IBM Docling to parse documents (PDF, CSV, Images) and convert them to markdown format.

## Features

- **PDF Parsing**: Extracts text from PDF documents using Docling
- **CSV Parsing**: Converts CSV files to markdown tables
- **Image OCR**: Extracts text from images using Docling's OCR capabilities
- **REST API**: FastAPI-based RESTful API
- **CORS Enabled**: Ready to be called from frontend applications

## Prerequisites

- Python 3.8 or higher
- pip

## Installation

1. Navigate to the service directory:
```bash
cd docling-service
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
python main.py
```

The service will start on `http://localhost:8000`

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status.

### Parse Document
```
POST /parse
Content-Type: multipart/form-data

Body:
  file: <file upload>
```

**Response:**
```json
{
  "success": true,
  "markdown": "# Extracted markdown content...",
  "metadata": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "fileSize": 12345
  }
}
```

## Testing

### Using curl

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test document parsing
curl -X POST http://localhost:8000/parse \
  -F "file=@document.pdf"
```

### Using Python requests

```python
import requests

# Parse a document
with open('document.pdf', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/parse',
        files={'file': f}
    )
    print(response.json())
```

## Deployment

### Docker (Recommended)

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t docling-service .
docker run -p 8000:8000 docling-service
```

### Vercel / Serverless

For serverless deployment, you may need to adjust the service to work with serverless functions. Consider using a container service like Railway, Render, or Google Cloud Run instead.

## Environment Variables

- `PORT`: Port number to run the service on (default: 8000)

## Integration with Node.js Backend

The Node.js API endpoint (`api/parse-document.ts`) should be updated to call this Python service instead of parsing locally.

Example integration:
```typescript
const response = await fetch('http://localhost:8000/parse', {
  method: 'POST',
  body: formData, // FormData with file
});
```

## Troubleshooting

### Docling Installation Issues

If Docling fails to install, you may need additional system dependencies:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y python3-dev build-essential

# macOS
brew install python3
```

### Memory Issues

For large documents, you may need to increase memory limits. Consider running the service with more memory allocated.

## License

MIT


