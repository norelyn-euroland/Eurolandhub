# API Server Setup Guide

## Why the 404 Error Happened

**Problem:** Vite is a frontend-only development server. It does **not** automatically serve `/api/*` routes. When your React app calls `fetch('/api/parse-document')`, Vite looks for a static file at that path, which doesn't exist, resulting in a 404 error.

**Solution:** We created a separate Node.js/Express backend API server that runs independently and handles all `/api/*` routes.

## Architecture

```
┌─────────────────┐         HTTP Request          ┌──────────────────┐
│   Vite Dev      │  ──────────────────────────>  │  Express API     │
│   (Port 3000)   │                                │  (Port 3001)     │
│   Frontend      │  <──────────────────────────  │  Backend         │
└─────────────────┘         JSON Response         └──────────────────┘
```

## Running the Application

### Option 1: Run Both Servers Separately (Recommended for Development)

**Terminal 1 - Start API Server:**
```bash
npm run dev:api
```

**Terminal 2 - Start Vite Frontend:**
```bash
npm run dev
```

### Option 2: Run Both Servers Together

```bash
npm run dev:all
```

This uses `concurrently` to run both servers in one terminal.

## API Endpoints

### Health Check
- **URL:** `http://localhost:3001/health`
- **Method:** GET
- **Response:** `{ "status": "ok", "message": "API server is running" }`

### Parse Document
- **URL:** `http://localhost:3001/api/parse-document`
- **Method:** POST
- **Content-Type:** `multipart/form-data`
- **Body:** FormData with `file` field
- **Response:** 
  ```json
  {
    "success": true,
    "csvText": "...",
    "metadata": {
      "fileName": "...",
      "fileType": "text/csv",
      "fileSize": 12345
    }
  }
  ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# API Server URL (for frontend)
VITE_API_URL=http://localhost:3001
```

## CORS Configuration

The API server is configured to accept requests from:
- `http://localhost:3000` (Vite dev server)
- `http://127.0.0.1:3000` (Alternative localhost)

## Testing the Connection

1. **Test API Server Health:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Test from Browser Console:**
   ```javascript
   fetch('http://localhost:3001/health')
     .then(r => r.json())
     .then(console.log);
   ```

3. **Test File Upload:**
   - Open the app in browser
   - Go to "Add Investors" modal
   - Download the CSV template
   - Fill in investor data
   - Upload the completed CSV file
   - Check browser Network tab - should see successful POST to `/api/parse-document`

## Next Steps

1. ✅ API server is running and reachable
2. ✅ Frontend can connect to API
3. ✅ CSV file upload and parsing works end-to-end

## Troubleshooting

### Port Already in Use
If port 3001 is already in use, change it in `server.js`:
```javascript
const PORT = process.env.PORT || 3002; // Change to 3002 or any available port
```

### CORS Errors
If you see CORS errors, make sure:
- API server is running on port 3001
- Frontend is running on port 3000
- Both are running simultaneously

### 404 Still Appearing
- Verify API server is running: `curl http://localhost:3001/health`
- Check browser Network tab to see the actual request URL
- Verify `VITE_API_URL` environment variable is set correctly



