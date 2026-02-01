# RedByte OS Deployment Notes

## Production Deployment Guide

This document provides technical deployment instructions for RedByte OS Genesis across various hosting platforms, including runtime requirements, build configuration, environment setup, and troubleshooting procedures.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Build Process](#build-process)
3. [Platform-Specific Deployment](#platform-specific-deployment)
4. [Environment Variables](#environment-variables)
5. [Asset Management](#asset-management)
6. [Performance Optimization](#performance-optimization)
7. [Security Considerations](#security-considerations)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)
10. [Scaling & Load Balancing](#scaling--load-balancing)

---

## System Requirements

### Server Requirements

**Minimum Specifications**:
- **OS**: Linux (Ubuntu 20.04+), Windows Server 2019+, macOS 11+
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4 GB (8 GB recommended)
- **Disk**: 10 GB free space (SSD preferred)
- **Node.js**: v18.0.0 or higher
- **pnpm**: v8.0.0 or higher

**Recommended for Production**:
- **CPU**: 4+ cores
- **RAM**: 16 GB
- **Disk**: 50 GB SSD
- **Network**: 1 Gbps uplink
- **CDN**: Cloudflare, Fastly, or AWS CloudFront for static assets

### Client Requirements

**Supported Browsers**:
- Chrome 90+ (recommended)
- Edge 90+
- Firefox 88+
- Safari 14+

**Browser Features Required**:
- WebAssembly support
- ES2020 module support
- IndexedDB API
- Web Workers
- Canvas API
- File API (for .rbx.zip import/export)

**Client Hardware**:
- **CPU**: Dual-core processor (2.0 GHz+)
- **RAM**: 4 GB (8 GB for large circuits)
- **GPU**: Hardware-accelerated graphics (for 3D Virtual Lab)
- **Display**: 1280x720 minimum (1920x1080 recommended)

---

## Build Process

### Production Build

RedByte OS uses a **pnpm monorepo** with Rollup and Vite for bundling.

#### 1. Install Dependencies

```powershell
cd c:\Users\conno\redbyte-ui
pnpm install --frozen-lockfile
```

#### 2. Build All Packages

```powershell
pnpm -r build
```

**Build Order** (automatic via dependency graph):
1. `@redbyte/rb-primitives` (UI components)
2. `@redbyte/rb-utils` (utilities, schemas)
3. `@redbyte/rb-logic-core` (simulation engine)
4. `@redbyte/rb-logic-3d` (3D Virtual Lab)
5. `@redbyte/rb-fpga-toolchain` (Verilog generation)
6. `@redbyte/rb-lab-engine` (lab grading engine)
7. `@redbyte/rb-instruments` (signal analysis)
8. `@redbyte/rb-apps` (all applications)
9. `@redbyte/rb-shell` (OS shell)
10. `playground` app (main entry point)

**Build Output**:
```
apps/playground/dist/
├── index.html                # Entry point
├── assets/
│   ├── index-[hash].js       # Main bundle
│   ├── index-[hash].css      # Styles
│   ├── vendor-[hash].js      # Dependencies
│   └── ...                   # Lazy-loaded chunks
├── examples/                 # Pre-built circuit examples
│   ├── 01_wire-lamp.json
│   ├── ...
│   └── 18_4bit-alu-basys3.json
└── favicon.ico               # (if added)
```

**Build Time** (reference):
- Clean build: ~90 seconds
- Incremental build: ~15 seconds

#### 3. Verify Build

```powershell
# Check for errors
pnpm -r build 2>&1 | Select-String "error"

# Test production build locally
cd apps/playground
pnpm preview
```

Navigate to `http://localhost:4173` to test.

---

## Platform-Specific Deployment

### Cloudflare Pages (Recommended)

**Why Cloudflare Pages**:
- Global CDN (300+ edge locations)
- Instant cache purging
- Automatic HTTPS
- Free tier: 500 builds/month
- Edge analytics included

**Deployment Steps**:

1. **Connect Repository** (GitHub/GitLab):
   ```bash
   # In Cloudflare dashboard:
   Pages → Create Project → Connect Git
   ```

2. **Configure Build Settings**:
   ```yaml
   Build command: pnpm -r build && cd apps/playground && pnpm build
   Build output directory: apps/playground/dist
   Root directory: (leave blank)
   Environment variables: (see below)
   ```

3. **Set Environment Variables**:
   ```
   NODE_VERSION=18
   PNPM_VERSION=8
   ```

4. **Custom Domain** (optional):
   ```
   redbyteapps.dev → Pages project
   ```

5. **Deploy**:
   - Push to `main` branch → automatic deployment
   - Preview deployments for PRs

**Cloudflare Configuration** (`wrangler.toml`):
```toml
name = "redbyte-os"
compatibility_date = "2025-01-01"

[site]
bucket = "./apps/playground/dist"

[[headers]]
for = "*.js"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
for = "*.css"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
for = "*.json"
[headers.values]
Cache-Control = "public, max-age=3600"
```

---

### Vercel

**Deployment Steps**:

1. **Install Vercel CLI**:
   ```powershell
   pnpm add -g vercel
   ```

2. **Deploy**:
   ```powershell
   cd c:\Users\conno\redbyte-ui\apps\playground
   vercel --prod
   ```

3. **Configure** (`vercel.json`):
   ```json
   {
     "buildCommand": "cd ../.. && pnpm -r build && cd apps/playground && pnpm build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ],
     "headers": [
       {
         "source": "/assets/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "public, max-age=31536000, immutable"
           }
         ]
       }
     ]
   }
   ```

---

### Netlify

**Deployment Steps**:

1. **Connect Repository** or **CLI Deploy**:
   ```powershell
   pnpm add -g netlify-cli
   cd apps/playground
   netlify deploy --prod --dir=dist
   ```

2. **Configure** (`netlify.toml`):
   ```toml
   [build]
     command = "cd ../.. && pnpm -r build && cd apps/playground && pnpm build"
     publish = "apps/playground/dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200

   [[headers]]
     for = "/assets/*"
     [headers.values]
       Cache-Control = "public, max-age=31536000, immutable"
   ```

---

### AWS S3 + CloudFront

**Deployment Steps**:

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://redbyte-os-production
   aws s3 website s3://redbyte-os-production --index-document index.html --error-document index.html
   ```

2. **Upload Build**:
   ```powershell
   cd apps/playground
   aws s3 sync dist/ s3://redbyte-os-production --delete
   ```

3. **Set Cache Headers**:
   ```powershell
   aws s3 cp dist/assets/ s3://redbyte-os-production/assets/ --recursive --cache-control "public, max-age=31536000, immutable"
   ```

4. **Configure CloudFront**:
   - Origin: S3 bucket
   - Viewer protocol: Redirect HTTP to HTTPS
   - Compress objects: Yes
   - Cache policy: CachingOptimized
   - Custom domain: redbyteapps.dev (Route 53)

5. **Invalidate Cache** (on updates):
   ```bash
   aws cloudfront create-invalidation --distribution-id E123ABC456 --paths "/*"
   ```

---

### Docker Deployment

**Dockerfile**:
```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm -r build

# Stage 2: Production
FROM nginx:alpine
COPY --from=builder /app/apps/playground/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf**:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**Build and Run**:
```powershell
docker build -t redbyte-os .
docker run -p 80:80 redbyte-os
```

---

## Environment Variables

### Build-Time Variables

Set in hosting platform or `.env` file:

```bash
# Platform Version
VITE_APP_VERSION=1.0.0

# API Endpoints (if using backend services)
VITE_API_BASE_URL=https://api.redbyteapps.dev

# Feature Flags
VITE_ENABLE_HARDWARE_BRIDGE=true
VITE_ENABLE_ANALYTICS=true

# Analytics Keys (optional)
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
VITE_SENTRY_DSN=https://...@sentry.io/...
```

**Access in Code**:
```typescript
const version = import.meta.env.VITE_APP_VERSION;
```

### Runtime Variables (Server)

For Docker/Node.js deployments:

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

---

## Asset Management

### Static Assets

**Location**: `apps/playground/public/`

```
public/
├── examples/              # Circuit examples (18 JSON files)
├── resources/
│   ├── templates/         # Lab templates
│   └── schemas/           # JSON schemas
├── favicon.ico            # (add in Phase 8)
└── manifest.json          # PWA manifest (future)
```

**Asset Loading**:
```typescript
// Examples auto-loaded from public/examples/
import example01 from './examples/01_wire-lamp.json';

// Resources accessible via fetch
const template = await fetch('/resources/templates/lab-01.json');
```

### CDN Configuration

**Recommended CDN Headers**:
```http
# JavaScript/CSS
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/javascript; charset=utf-8

# JSON Examples
Cache-Control: public, max-age=3600
Content-Type: application/json; charset=utf-8

# Images
Cache-Control: public, max-age=604800
Content-Type: image/png
```

---

## Performance Optimization

### Bundle Optimization

**Current Optimizations**:
- Code splitting (lazy-loaded apps)
- Tree shaking (Rollup)
- Minification (Terser)
- CSS extraction and minification

**Bundle Sizes** (reference):
- Main bundle: ~1.7 MB (gzipped: ~0.8 MB)
- Vendor chunks: ~2.5 MB (gzipped: ~0.9 MB)
- Lazy-loaded apps: 10-60 KB each

**Further Optimizations**:
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'react-vendor': ['react', 'react-dom'],
          'logic-core': ['@redbyte/rb-logic-core']
        }
      }
    }
  }
});
```

### Runtime Performance

**Simulation Engine**:
- Max circuit size: 1000 nodes (recommended < 500)
- Simulation tick rate: 60 Hz (adjustable)
- Waveform buffer: 10,000 ticks (circular buffer)

**3D Virtual Lab**:
- Target FPS: 60
- Low-poly models (< 1000 triangles each)
- Texture atlas (512x512)
- Level-of-detail (LOD) for distant objects

---

## Security Considerations

### Content Security Policy (CSP)

**Recommended Headers**:
```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  worker-src 'self' blob:;
  connect-src 'self' https://api.redbyteapps.dev;
```

**Why `unsafe-inline` for styles**: Inline styles used by React components (consider removing in future).

### HTTPS Configuration

**Always use HTTPS in production**:
```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### File Upload Security

**Validate `.rbx.zip` imports**:
- Check file size (max 10 MB recommended)
- Validate JSON schemas
- Sanitize circuit data (prevent XSS in node labels)

**Backend validation** (if using server):
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
if (file.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

---

## Monitoring & Logging

### Error Tracking

**Sentry Integration**:
```typescript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### Analytics

**Google Analytics**:
```typescript
import ReactGA from 'react-ga4';

ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID);
ReactGA.send({ hitType: 'pageview', page: window.location.pathname });
```

### Custom Metrics

**Log critical events**:
```typescript
// Circuit export
console.log('[EXPORT]', { circuitId, nodeCount, timestamp });

// FPGA synthesis
console.log('[FPGA_EXPORT]', { readinessScore, errors, warnings });

// Hardware session
console.log('[HARDWARE]', { deviceId, testResults });
```

**Aggregate in backend** (future):
- Average circuit size per lab
- FPGA export success rate
- Hardware bridge usage

---

## Troubleshooting

### Build Failures

**Issue**: `pnpm build` fails with "Out of memory"

**Solution**:
```powershell
# Increase Node.js heap size
$env:NODE_OPTIONS="--max-old-space-size=4096"
pnpm -r build
```

---

**Issue**: Vite build fails with "Cannot find module"

**Solution**:
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml
pnpm install
pnpm -r build
```

---

### Runtime Errors

**Issue**: "Application failed to load" on production

**Cause**: Missing assets or incorrect base path

**Solution**:
```typescript
// vite.config.ts
export default defineConfig({
  base: '/', // Ensure correct base path for deployment
});
```

---

**Issue**: Examples fail to load

**Cause**: `public/examples/` not included in build

**Solution**:
```powershell
# Verify examples are in dist/
ls apps/playground/dist/examples/
```

---

### Performance Issues

**Issue**: Simulation lags with large circuits

**Solution**:
- Reduce circuit size (< 500 nodes)
- Lower tick rate (30 Hz instead of 60 Hz)
- Disable waveform recording if not needed

---

**Issue**: 3D Virtual Lab freezes

**Solution**:
- Check GPU acceleration enabled in browser
- Reduce scene complexity (fewer parts)
- Lower texture resolution

---

## Scaling & Load Balancing

### Horizontal Scaling

**Static Site**: No server-side scaling needed (served from CDN)

**Backend Services** (if added):
- Use load balancer (AWS ALB, Cloudflare Load Balancing)
- Stateless API servers (Docker + Kubernetes)
- Shared session storage (Redis, Memcached)

### CDN Configuration

**Cloudflare Workers** (edge compute):
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Serve from cache if available
  const cache = caches.default
  let response = await cache.match(request)
  
  if (!response) {
    response = await fetch(request)
    // Cache for 1 hour
    response = new Response(response.body, response)
    response.headers.set('Cache-Control', 'public, max-age=3600')
    await cache.put(request, response.clone())
  }
  
  return response
}
```

---

## Production Checklist

Before deploying v1.0.0:

- [ ] All packages build successfully
- [ ] Examples load correctly in production build
- [ ] FPGA export generates valid Verilog
- [ ] Evidence capsules include proper fingerprints
- [ ] Error boundaries catch and display errors gracefully
- [ ] All themes (light/dark/terminal) are legible
- [ ] Favicon and branding are present
- [ ] HTTPS configured with valid certificate
- [ ] CDN headers set correctly
- [ ] Analytics and error tracking enabled
- [ ] Documentation deployed (INSTRUCTOR_GUIDE, etc.)
- [ ] Version bumped to 1.0.0
- [ ] Git tag `v1.0.0` created

---

## Additional Resources

- **Instructor Guide**: [INSTRUCTOR_GUIDE.md](./INSTRUCTOR_GUIDE.md)
- **Project Model**: [PROJECT_MODEL.md](./PROJECT_MODEL.md)
- **Examples Catalog**: [EXAMPLES_CATALOG.md](./EXAMPLES_CATALOG.md)
- **User Manual**: [REDBYTE_USER_MANUAL.md](./REDBYTE_USER_MANUAL.md)
- **FPGA Validation**: [docs/fpga-validation-guide.md](./docs/fpga-validation-guide.md)

---

**Copyright © 2025 Connor Angiel — RedByte OS Genesis**  
*Use without permission prohibited. Licensed under the RedByte Proprietary License (RPL-1.0).*
