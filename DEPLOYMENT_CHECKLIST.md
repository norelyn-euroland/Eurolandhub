# Deployment Checklist

## ✅ Step 1: Render Service (Python Docling) - COMPLETED
- [x] Service deployed to Render
- [x] Service URL: `https://eurolandhub.onrender.com` (or your specific service URL)
- [ ] Service is healthy (test: `curl https://your-service.onrender.com/health`)

## 📋 Step 2: Vercel Environment Variables

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:

### Required Variables:
1. **`DOCLING_SERVICE_URL`**
   - Value: `https://eurolandhub.onrender.com` (or your Render service URL)
   - Environment: Production, Preview, Development (all)

2. **`VITE_API_URL`** (Optional)
   - Value: Leave empty (uses same origin in production)
   - Environment: Production only
   - Or set to your Vercel domain: `https://your-app.vercel.app`

### How to Add:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Add each variable above
6. **Important**: After adding variables, redeploy your app!

## 📋 Step 3: Update CORS in Python Service (Optional but Recommended)

If you want to restrict CORS for security, update `docling-service/main.py`:

```python
import os

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local dev
        "https://your-vercel-app.vercel.app",  # Production
        os.getenv("FRONTEND_URL", ""),  # From env var
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Then add `FRONTEND_URL` environment variable in Render:
- Key: `FRONTEND_URL`
- Value: `https://your-vercel-app.vercel.app`

## 🧪 Step 4: Testing

### Test 1: Render Service Health Check
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

### Test 2: Test Document Parsing (from Render)
```bash
curl -X POST https://eurolandhub.onrender.com/parse \
  -F "file=@test.pdf"
```

### Test 3: Test from Vercel API
1. Deploy to Vercel with environment variables set
2. Upload a document through your app
3. Check Vercel function logs for any errors
4. Check Render service logs

## 📝 Step 5: Verify Deployment

### Check Vercel Logs:
1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `/api/parse-document`
3. Check logs for successful requests

### Check Render Logs:
1. Go to Render Dashboard → Your Service → Logs
2. Verify requests are being received
3. Check for any errors

## ⚠️ Important Notes

1. **Render Free Tier**: Services sleep after 15 minutes of inactivity
   - First request after sleep: 30-60 second delay
   - Solution: Upgrade to Standard plan ($7/month) for always-on

2. **Cold Starts**: First request to Render service may be slow
   - This is normal for free tier
   - Subsequent requests are fast

3. **File Size Limits**: 
   - Render free tier: Check limits
   - Your app limit: 10MB per file

4. **Environment Variables**: 
   - Must redeploy Vercel after adding/changing env vars
   - Changes take effect on next deployment

## 🔧 Troubleshooting

### Issue: "Cannot connect to Python Docling service"
- **Check**: Is `DOCLING_SERVICE_URL` set correctly in Vercel?
- **Check**: Is Render service running? (may be sleeping on free tier)
- **Solution**: Wait 30-60 seconds for first request, or upgrade Render plan

### Issue: CORS errors
- **Check**: Is CORS configured in Python service?
- **Solution**: Update `allow_origins` in `docling-service/main.py` with your Vercel URL

### Issue: 404 errors
- **Check**: Is the Render service URL correct?
- **Check**: Does the service have the `/parse` endpoint?
- **Solution**: Test the Render service directly with curl

## ✅ Final Checklist

- [ ] Render service is deployed and healthy
- [ ] `DOCLING_SERVICE_URL` is set in Vercel
- [ ] `VITE_API_URL` is set (or left empty) in Vercel
- [ ] Vercel app is redeployed after setting env vars
- [ ] Health check works: `curl https://your-service.onrender.com/health`
- [ ] Document upload works from the app
- [ ] No errors in Vercel function logs
- [ ] No errors in Render service logs

## 🎉 You're Done!

Once all checks pass, your deployment is complete and ready for production use!

