param(
  [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

Write-Host "[autoheal] RedByte AutoHeal v40 online..." -ForegroundColor Cyan

function Ensure-TsConfig {
  Write-Host "[autoheal] Ensuring tsconfig.json is sane..." -ForegroundColor Yellow
  @"
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "skipLibCheck": true,
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "strict": false
  },
  "include": ["src"],
  "references": []
}
"@ | Set-Content -Path "./tsconfig.json" -Encoding UTF8
  Write-Host "[autoheal] tsconfig.json reset to known-good v40 config." -ForegroundColor Green
}

function Ensure-Dependencies {
  Write-Host "[autoheal] Checking core dependencies..." -ForegroundColor Yellow

  # Runtime deps
  npm install react react-dom three --save | Out-Null

  # Dev deps
  npm install --save-dev typescript @types/react @types/react-dom @types/three vite @vitejs/plugin-react-swc | Out-Null

  Write-Host "[autoheal] Dependencies ensured (react, three, types, vite)." -ForegroundColor Green
}

function Ensure-OrbitControlsTypes {
  Write-Host "[autoheal] Ensuring OrbitControls type declaration..." -ForegroundColor Yellow

  @"
declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher, MOUSE, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement: HTMLElement);

    object: Camera;
    domElement: HTMLElement;

    enabled: boolean;
    target: Vector3;

    minDistance: number;
    maxDistance: number;

    // Extended properties used by RedByte OS 3D system
    enableDamping: boolean;
    dampingFactor: number;

    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;

    update(): void;
    dispose(): void;

    static MOUSE: typeof MOUSE;
  }
}
"@ | Set-Content -Path "src/types/three-orbitcontrols.d.ts" -Encoding UTF8

  Write-Host "[autoheal] OrbitControls types installed." -ForegroundColor Green
}

function Fix-CryptoIdentity {
  Write-Host "[autoheal] Healing CryptoIdentity (WebCrypto digest)..." -ForegroundColor Yellow

  @"
/**
 * CryptoIdentity
 *
 * Client-side cryptographic identity for RedByte users.
 * - Generates an ECDSA P-256 keypair per user
 * - Stores keys in localStorage (NOT secure storage)
 * - Derives a short fingerprint from the public key
 *
 * This is NOT production-grade auth. It is a teaching / demo layer
 * and a backbone you can wire into a real backend later.
 */

export interface UserKeypairRecord {
  publicKey: string;   // base64 (SPKI)
  privateKey: string;  // base64 (PKCS8)
  fingerprint: string; // short hex, e.g. "A1B2C3D4E5F6A7B8"
}

const KEY_PREFIX = "redbyte_user_keys_v1_";

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== "undefined" ? btoa(binary) : "";
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array();
  const binary = typeof atob !== "undefined" ? atob(b64) : "";
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "";
  }
  // Use a sliced buffer so TypeScript is happy with BufferSource
  const copy = data.slice();
  const hashBuf = await crypto.subtle.digest("SHA-256", copy.buffer);
  const arr = Array.from(new Uint8Array(hashBuf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function loadUserKeys(userId: string): UserKeypairRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as UserKeypairRecord;
  } catch {
    return null;
  }
}

export function saveUserKeys(userId: string, record: UserKeypairRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(record));
  } catch {
    // ignore
  }
}

/**
 * ensureUserKeys
 *
 * Returns an existing keypair for the user, or generates a new one
 * using WebCrypto. If crypto APIs are unavailable, returns null.
 */
export async function ensureUserKeys(
  userId: string
): Promise<UserKeypairRecord | null> {
  const existing = loadUserKeys(userId);
  if (existing) return existing;

  if (typeof window === "undefined" || typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }

  // ECDSA P-256 keypair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const pubB64 = bufToBase64(spki);
  const privB64 = bufToBase64(pkcs8);

  const fingerprintFull = await sha256Hex(new Uint8Array(spki));
  const fingerprint = fingerprintFull.slice(0, 16);

  const record: UserKeypairRecord = {
    publicKey: pubB64,
    privateKey: privB64,
    fingerprint,
  };

  saveUserKeys(userId, record);
  return record;
}
"@ | Set-Content -Path "src/os/auth/CryptoIdentity.ts" -Encoding UTF8

  Write-Host "[autoheal] CryptoIdentity healed." -ForegroundColor Green
}

function Fix-BootScreen {
  Write-Host "[autoheal] Healing BootScreen JSX glitches..." -ForegroundColor Yellow
  if (Test-Path "src/os/boot/BootScreen.tsx") {
    (Get-Content "src/os/boot/BootScreen.tsx") `
      -replace "<className", "<span" `
      -replace "</className>", "</span>" `
    | Set-Content "src/os/boot/BootScreen.tsx"
    Write-Host "[autoheal] BootScreen JSX checked & cleaned." -ForegroundColor Green
  } else {
    Write-Host "[autoheal] BootScreen.tsx not found; skipping." -ForegroundColor DarkGray
  }
}

function Ensure-IndexHtml {
  Write-Host "[autoheal] Ensuring index.html is present..." -ForegroundColor Yellow
  if (-not (Test-Path "./index.html")) {
    @"
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RedByte OS</title>
    <meta name="description" content="RedByte OS — Logic, 3D, Simulation, AI Tools" />
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body class="bg-slate-950 text-slate-100">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
"@ | Set-Content -Path "./index.html" -Encoding UTF8
    Write-Host "[autoheal] index.html restored." -ForegroundColor Green
  } else {
    Write-Host "[autoheal] index.html already present." -ForegroundColor DarkGray
  }
}

function Ensure-Redirects {
  Write-Host "[autoheal] Ensuring _redirects for SPA routing..." -ForegroundColor Yellow
  @"
# Cloudflare Pages SPA routing for Vite
/*    /index.html   200
"@ | Set-Content -Path "./_redirects" -Encoding UTF8
  Write-Host "[autoheal] _redirects file written." -ForegroundColor Green
}

function Run-TypeCheck {
  Write-Host "[autoheal] Running TypeScript typecheck (npx tsc --noEmit)..." -ForegroundColor Cyan
  npx tsc --noEmit
  Write-Host "[autoheal] TypeScript check complete." -ForegroundColor Green
}

function Run-Build {
  param([switch]$Skip)
  if ($Skip) {
    Write-Host "[autoheal] Build step skipped by flag." -ForegroundColor DarkGray
    return
  }
  Write-Host "[autoheal] Running npm run build..." -ForegroundColor Cyan
  npm run build
  Write-Host "[autoheal] Build complete." -ForegroundColor Green
}

# ----------------------------------------------------------
# Execute autoheal steps
# ----------------------------------------------------------

Ensure-TsConfig
Ensure-Dependencies
Ensure-OrbitControlsTypes
Fix-CryptoIdentity
Fix-BootScreen
Ensure-IndexHtml
Ensure-Redirects
Run-TypeCheck

if (-not $NoBuild) {
  Run-Build
} else {
  Write-Host "[autoheal] NoBuild flag set; skipping build." -ForegroundColor DarkGray
}

Write-Host "[autoheal] AutoHeal v40 sequence complete." -ForegroundColor Cyan
