# How to Start All Services

## Quick Start Guide

To run the complete system, you need **2 services** running simultaneously:

### 1. Node.js API Server (Port 3001)
**Required for:** API endpoints and file handling

```bash
npm run dev:api
```

**Expected output:**
```
🚀 API Server running on http://localhost:3001
📡 Health check: http://localhost:3001/health
📄 Parse endpoint: http://localhost:3001/api/parse-document
✅ CORS enabled for: http://localhost:3000
```

### 2. Vite Frontend (Port 3000)
**Required for:** User interface

```bash
npm run dev
```

**Expected output:**
```
  VITE v6.x.x  ready in xxx ms
  ➜  Local:   http://localhost:3000/
```

## Running All Services

### Option 1: Two Separate Terminals (Recommended)

**Terminal 1:**
```bash
npm run dev:api
```

**Terminal 2:**
```bash
npm run dev
```

### Option 2: Single Terminal (API + Frontend together)

```bash
npm run dev:all
```

This runs both the API server and frontend together.

## Verification

### Check API Server
```bash
curl http://localhost:3001/health
```
Or open in browser: `http://localhost:3001/health`

Should return: `{"status":"ok","message":"API server is running"}`

### Check Frontend
Open in browser: `http://localhost:3000`

Should show the EurolandHUB dashboard.

## Troubleshooting

### Error: "Port 3001 already in use"
**Solution:** Change port in `server.js`:
```javascript
const PORT = process.env.PORT || 3002;  // Change to 3002
```

## Service Dependencies

```
Frontend (3000) → API Server (3001)
```

- Frontend needs API Server
- CSV files are parsed locally by the API server

## Quick Health Check Script

Create a file `check-services.ps1` (PowerShell):

```powershell
Write-Host "Checking services..." -ForegroundColor Cyan

# Check API Server
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ API Server: Running" -ForegroundColor Green
} catch {
    Write-Host "❌ API Server: Not running" -ForegroundColor Red
    Write-Host "   Start with: npm run dev:api" -ForegroundColor Yellow
}

# Check Frontend
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2
    Write-Host "✅ Frontend: Running" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend: Not running" -ForegroundColor Red
    Write-Host "   Start with: npm run dev" -ForegroundColor Yellow
}
```

Run with: `powershell -ExecutionPolicy Bypass -File check-services.ps1`



