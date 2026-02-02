# Deployment Guide for Docling Microservice

This guide explains how to deploy the Python Docling microservice.

## Local Development

1. **Install dependencies:**
```bash
cd docling-service
pip install -r requirements.txt
```

2. **Run the service:**
```bash
python main.py
```

3. **Set environment variable in your Node.js project:**
```bash
# In your .env file or Vercel environment variables
DOCLING_SERVICE_URL=http://localhost:8000
```

## Docker Deployment

### Build and Run Locally

```bash
cd docling-service
docker build -t docling-service .
docker run -p 8000:8000 docling-service
```

### Using Docker Compose

```bash
cd docling-service
docker-compose up -d
```

## Cloud Deployment Options

### Option 1: Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository
3. Select the `docling-service` directory
4. Railway will automatically detect the Dockerfile and deploy
5. Copy the service URL and set it as `DOCLING_SERVICE_URL` in your Vercel environment variables

### Option 2: Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Set:
   - **Root Directory**: `docling-service`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set environment variable `PORT` (Render provides this automatically)
5. Copy the service URL and set it as `DOCLING_SERVICE_URL` in your Vercel environment variables

### Option 3: Google Cloud Run

1. Build and push Docker image:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/docling-service
gcloud run deploy docling-service \
  --image gcr.io/YOUR_PROJECT_ID/docling-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

2. Copy the service URL and set it as `DOCLING_SERVICE_URL` in your Vercel environment variables

### Option 4: AWS ECS / Fargate

1. Build and push Docker image to ECR
2. Create ECS task definition
3. Deploy to Fargate
4. Set up Application Load Balancer
5. Copy the service URL and set it as `DOCLING_SERVICE_URL` in your Vercel environment variables

## Environment Variables

### In Python Service (.env file)
```env
PORT=8000
```

### In Node.js/Vercel Project
```env
DOCLING_SERVICE_URL=https://your-docling-service.railway.app
# or
DOCLING_SERVICE_URL=https://your-docling-service.onrender.com
```

## Health Check

After deployment, verify the service is running:

```bash
curl https://your-docling-service-url/health
```

Expected response:
```json
{
  "status": "healthy",
  "docling_available": true,
  "converter_initialized": true
}
```

## Testing the Integration

1. Start the Python service (locally or deployed)
2. Set `DOCLING_SERVICE_URL` in your Node.js project
3. Upload a PDF or image file through your frontend
4. Check that the parsing works end-to-end

## Troubleshooting

### Service Not Accessible

- Check that the service is running and accessible
- Verify the `DOCLING_SERVICE_URL` is correct
- Check firewall/security group settings
- Ensure CORS is properly configured (already set in the service)

### Docling Not Working

- Verify Docling is installed: `pip list | grep docling`
- Check Python version (requires 3.8+)
- Review service logs for errors
- Ensure system dependencies are installed (for PDF/image processing)

### Timeout Issues

- Increase timeout in your Node.js fetch calls
- Consider increasing memory/CPU for the Python service
- For large files, implement chunked uploads

## Production Recommendations

1. **Use HTTPS**: Always use HTTPS in production
2. **Add Authentication**: Add API key authentication to the Python service
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Monitoring**: Add logging and monitoring (e.g., Sentry, DataDog)
5. **Scaling**: Use container orchestration (Kubernetes, ECS) for auto-scaling
6. **Caching**: Cache parsed results for frequently accessed documents


