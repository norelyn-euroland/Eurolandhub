# Render Service Setup - Next Steps

## ✅ What You've Done
- Deployed service to Render
- Service URL: `https://eurolandhub.onrender.com` (or your specific URL)

## 🔍 Verify Your Render Service

### Step 1: Check Service Type
Based on your Render dashboard, you have a service running. Let's verify it's the Python Docling service:

1. **Check the service URL**: Go to your Render dashboard
2. **Test the health endpoint**:
   ```bash
   curl https://eurolandhub.onrender.com/health
   ```
   
   Expected response:
   ```json
   {
     "status": "healthy",
     "docling_available": true,
     "converter_initialized": true
   }
   ```

### Step 2: Verify Service Configuration
In Render dashboard, check:
- **Root Directory**: Should be `docling-service` (if deploying only Python service)
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment**: Python 3

## 📋 Next Steps for Vercel Deployment

### Step 1: Set Environment Variables in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add these variables:

   **Variable 1: `DOCLING_SERVICE_URL`**
   - Value: `https://eurolandhub.onrender.com` (your Render service URL)
   - Environments: ✅ Production, ✅ Preview, ✅ Development
   
   **Variable 2: `VITE_API_URL`** (Optional)
   - Value: Leave **empty** (will use same origin in production)
   - Environments: ✅ Production only

3. **Important**: After adding variables, you MUST redeploy:
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**

### Step 2: Update CORS (Optional but Recommended)

If you want to restrict CORS for security, update your Python service:

1. In Render dashboard → Your Service → **Environment** tab
2. Add environment variable:
   - Key: `FRONTEND_URL`
   - Value: `https://your-vercel-app.vercel.app` (your Vercel domain)

3. Update `docling-service/main.py`:

```python
import os

# CORS middleware to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local dev
        os.getenv("FRONTEND_URL", ""),  # Production from env var
        "https://your-vercel-app.vercel.app",  # Your Vercel domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

4. Redeploy the Render service after updating the code

## 🧪 Testing

### Test 1: Render Service Health
```bash
curl https://eurolandhub.onrender.com/health
```

### Test 2: Render Service Parse Endpoint
```bash
curl -X POST https://eurolandhub.onrender.com/parse \
  -F "file=@test.pdf"
```

### Test 3: Full Integration Test
1. Deploy to Vercel with environment variables
2. Open your app
3. Try uploading a document
4. Check:
   - Vercel function logs (Dashboard → Functions → parse-document → Logs)
   - Render service logs (Dashboard → Your Service → Logs)

## ⚠️ Important Notes

### Render Free Tier Limitations:
- **Sleep Mode**: Service sleeps after 15 min inactivity
- **Cold Start**: First request takes 30-60 seconds
- **Solution**: Upgrade to Standard plan ($7/month) for always-on

### Vercel Environment Variables:
- **Must redeploy** after adding/changing env vars
- Changes only apply to new deployments
- Use "Redeploy" button after setting variables

## 🔧 Troubleshooting

### Issue: "Cannot connect to Python Docling service"
**Solution:**
1. Check `DOCLING_SERVICE_URL` is set in Vercel
2. Verify Render service is running (may be sleeping)
3. Wait 30-60 seconds for first request (cold start)

### Issue: CORS errors in browser
**Solution:**
1. Update CORS in Python service with your Vercel URL
2. Add `FRONTEND_URL` env var in Render
3. Redeploy both services

### Issue: 404 Not Found
**Solution:**
1. Verify Render service URL is correct
2. Check service is deployed and running
3. Test health endpoint directly

## ✅ Final Checklist

- [ ] Render service is deployed and accessible
- [ ] Health check works: `curl https://your-service.onrender.com/health`
- [ ] `DOCLING_SERVICE_URL` is set in Vercel
- [ ] Vercel app is redeployed after setting env vars
- [ ] Document upload works from the app
- [ ] No errors in logs

## 🎉 Ready to Deploy!

Once you've completed these steps, your app will be fully connected and ready for production!

