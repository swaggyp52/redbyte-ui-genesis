# API Authentication

## Overview

The RedByte API server supports optional Bearer token authentication to protect lab submission endpoints.

## Configuration

### Enable Authentication

Set the `RB_API_TOKEN` environment variable:

```powershell
# Windows PowerShell
$env:RB_API_TOKEN = "your-secret-token-here"
pnpm ops:server

# Or in one line:
$env:RB_API_TOKEN = "classroom-token-2026"; pnpm ops:server
```

```bash
# Linux/Mac
export RB_API_TOKEN="your-secret-token-here"
pnpm ops:server
```

### Disable Authentication (Development)

Simply don't set the`RB_API_TOKEN` variable. The server will accept all requests.

## Usage

### Client Requests

When authentication is enabled, clients must include the `Authorization` header:

```javascript
const response = await fetch('http://localhost:3001/api/labs/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/zip',
    'Authorization': 'Bearer your-secret-token-here'
  },
  body: zipFileBlob
});
```

### Protected Endpoints

- `POST /api/labs/ingest` - Submit lab for grading
- `GET /api/labs/runs` - List all runs
- `GET /api/labs/runs/:id` - Get run details  
- `POST /api/labs/diff` - Compare submission to golden fixture
- `GET /api/labs/runs/:id/artifacts/:name` - Get run artifacts

### Public Endpoints

- `GET /health` - Health check (always public)
- `GET /` - Server info (always public)

## Error Responses

### 401 Unauthorized

Missing or invalid token:

```json
{
  "error": "Authentication required",
  "message": "Please provide a valid authorization token. Contact your instructor if you need help."
}
```

## Token Distribution

### For Classroom Use

1. Generate a strong token:

   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
   ```

2. Share token securely with students (e.g., via LMS, course website, or email)

3. Start server with token:

   ```powershell
   $env:RB_API_TOKEN = "<generated-token>"
   pnpm ops:server
   ```

### Token Rotation

To rotate tokens:

1. Generate new token
2. Update `RB_API_TOKEN` environment variable
3. Restart server
4. Notify students of new token

## Security Notes

- **Fixed Token**: Current implementation uses a single shared token for all users
- **Network Security**: Deploy behind firewall or use HTTPS proxy in production
- **Future**: Can be upgraded to JWT or LMS/SSO integration without breaking changes

## Verification

Check if auth is enabled:

```powershell
curl http://localhost:3001/health
```

Response includes `authEnabled` field:

```json
{
  "status": "ok",
  "timestamp": 1707246123456,
  "authEnabled": true
}
```
