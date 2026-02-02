# Pre-Deployment Checklist

## ✅ Before Pushing to Render

### 1. Python Service Files (`docling-service/`)

- [x] **requirements.txt** - Contains all dependencies:
  - fastapi==0.104.1
  - uvicorn[standard]==0.24.0
  - python-multipart==0.0.6
  - docling==1.0.0
  - pydantic==2.5.0

- [x] **main.py** - Uses PORT environment variable:
  ```python
  port = int(os.getenv("PORT", 8000))
  uvicorn.run(app, host="0.0.0.0", port=port)
  ```

- [x] **render.yaml** - Render configuration file created
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Port: 10000 (as specified in your Render config)

- [x] **.python-version** - Python version specified (3.11.0)

### 2. Render Service Configuration

**In Render Dashboard, verify:**
- [ ] Root Directory: `docling-service` (if deploying from repo root)
- [ ] Environment: Python 3
- [ ] Build Command: `pip install -r requirements.txt`
- [ ] Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Port: 10000 (or let Render set it automatically via $PORT)

### 3. Code Updates for Production

- [x] **lib/document-parser.ts** - Updated to use same origin in production
- [x] **api/parse-document.ts** - Uses `DOCLING_SERVICE_URL` env var
- [x] **server.js** - Uses `DOCLING_SERVICE_URL` env var (for local dev)

### 4. Environment Variables (Set After Deployment)

**For Vercel (set after Render is deployed):**
- [ ] `DOCLING_SERVICE_URL` = `https://your-render-service.onrender.com`
- [ ] `VITE_API_URL` = (leave empty for production)

**For Render (optional):**
- [ ] `FRONTEND_URL` = `https://your-vercel-app.vercel.app` (for CORS)

### 5. CORS Configuration

- [x] Currently set to `["*"]` (allows all origins)
- [ ] **Optional**: Update to restrict to your Vercel domain for production

### 6. File Structure

```
docling-service/
├── main.py              ✅ Main application
├── requirements.txt     ✅ Dependencies
├── render.yaml          ✅ Render config
├── .python-version      ✅ Python version
├── Dockerfile           ✅ (optional, for Docker deployment)
└── README.md            ✅ Documentation
```

## 🚀 Deployment Steps

### Step 1: Push to Git
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### Step 2: Deploy to Render
1. Go to Render Dashboard
2. Create/Update Web Service
3. Connect to your GitHub repo
4. Set configuration:
   - **Root Directory**: `docling-service`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Deploy

### Step 3: Get Render Service URL
- After deployment, copy the service URL
- Example: `https://docling-service.onrender.com`

### Step 4: Test Render Service
```bash
# Test health endpoint
curl https://your-service.onrender.com/health

# Expected response:
# {
#   "status": "healthy",
#   "docling_available": true,
#   "converter_initialized": true
# }
```

### Step 5: Set Vercel Environment Variables
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add `DOCLING_SERVICE_URL` = your Render service URL
3. Redeploy Vercel app

## ⚠️ Important Notes

1. **Port Configuration**: 
   - Render automatically sets `$PORT` environment variable
   - Your start command uses `$PORT` which is correct
   - The default 8000 in code is only for local development

2. **Build Command**: 
   - `pip install -r requirements.txt` will install all dependencies
   - Make sure requirements.txt is in the `docling-service/` directory

3. **Root Directory**:
   - If deploying from repo root, set Root Directory to `docling-service`
   - Or deploy the `docling-service` folder as a separate repo

4. **First Deployment**:
   - May take 5-10 minutes to build
   - Docling installation can be slow (large dependencies)

## ✅ Ready to Deploy!

Once all items are checked, you're ready to push and deploy!

