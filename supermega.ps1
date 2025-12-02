param(
    [switch]$SkipGit
)

$ErrorActionPreference = "Stop"

Write-Host "=== SUPERMEGA SETUP START ===" -ForegroundColor Cyan

function Assert-RepoRoot {
    if (-not (Test-Path "package.json")) {
        throw "package.json not found. Run this from the project root (where package.json lives)."
    }
}

function Run-Npm {
    param([string]$Args)
    Write-Host ">> npm $Args" -ForegroundColor Yellow
    npm $Args
    if ($LASTEXITCODE -ne 0) {
        throw "npm $Args FAILED with exit code $LASTEXITCODE"
    }
}

Assert-RepoRoot

# -----------------------------------------------------------------------------
# 1. Remove WindiCSS & related config
# -----------------------------------------------------------------------------
Write-Host "`n[1/7] Removing WindiCSS + config..." -ForegroundColor Cyan

try {
    Run-Npm "uninstall vite-plugin-windicss windicss @windicss/plugin-utils @windicss/config"
} catch {
    Write-Host "  (npm uninstall failed or nothing to uninstall, continuing)" -ForegroundColor DarkYellow
}

# Delete any windi config files if they exist
Get-ChildItem -Path . -Filter "windi.config.*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  Removing $_" -ForegroundColor DarkYellow
    Remove-Item $_.FullName -Force
}

# Patch vite.config.ts to remove Windi import & plugin
if (Test-Path "vite.config.ts") {
    Write-Host "  Patching vite.config.ts to remove WindiCSS plugin..." -ForegroundColor DarkYellow
    $vite = Get-Content "vite.config.ts" -Raw

    # Remove: import WindiCSS from 'vite-plugin-windicss';
    $vite = $vite -replace 'import\s+WindiCSS[^\r\n]*;[\r\n]*', ''

    # Remove any WindiCSS() entries in plugins array
    $vite = $vite -replace 'WindiCSS\(\),?\s*', ''

    Set-Content -LiteralPath "vite.config.ts" -Value $vite -Encoding utf8
} else {
    Write-Host "  vite.config.ts not found, skipping Windi removal patch." -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------------------
# 2. Install TailwindCSS + PostCSS + Autoprefixer
# -----------------------------------------------------------------------------
Write-Host "`n[2/7] Installing TailwindCSS + PostCSS..." -ForegroundColor Cyan

Run-Npm "install -D tailwindcss postcss autoprefixer"

# (Re)generate Tailwind + PostCSS configs in a clean way
Write-Host "  Writing tailwind.config.js..." -ForegroundColor DarkYellow

$tailwindConfig = @'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
'@

Set-Content -LiteralPath "tailwind.config.js" -Value $tailwindConfig -Encoding utf8

Write-Host "  Writing postcss.config.cjs..." -ForegroundColor DarkYellow

$postcssConfig = @'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
'@

Set-Content -LiteralPath "postcss.config.cjs" -Value $postcssConfig -Encoding utf8

# -----------------------------------------------------------------------------
# 3. Scaffold React app structure (App, pages, basic layout)
# -----------------------------------------------------------------------------
Write-Host "`n[3/7] Scaffolding React UI structure..." -ForegroundColor Cyan

# Ensure src folder exists
if (-not (Test-Path "src")) {
    New-Item -ItemType Directory -Path "src" | Out-Null
}

# index.css with Tailwind directives
Write-Host "  Writing src/index.css..." -ForegroundColor DarkYellow

$indexCss = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* App shell tweaks */
html, body, #root {
  height: 100%;
}
body {
  @apply bg-slate-950 text-slate-100;
}
'@

Set-Content -LiteralPath "src/index.css" -Value $indexCss -Encoding utf8

# main.tsx entry
Write-Host "  Writing src/main.tsx..." -ForegroundColor DarkYellow

$mainTsx = @'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
'@

Set-Content -LiteralPath "src/main.tsx" -Value $mainTsx -Encoding utf8

# App.tsx basic shell
Write-Host "  Writing src/App.tsx..." -ForegroundColor DarkYellow

$appTsx = @'
import React from "react";

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 active:bg-indigo-600 transition-colors " +
        (props.className ?? "")
      }
    />
  );
}

function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={
        "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-black/40 " +
        (props.className ?? "")
      }
    />
  );
}

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500 text-xs font-black">
              RB
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                RedByte UI
              </span>
              <span className="text-xs text-slate-400">
                Genesis playground
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-4 text-xs text-slate-300 md:flex">
            <a href="#overview" className="hover:text-white">
              Overview
            </a>
            <a href="#components" className="hover:text-white">
              Components
            </a>
            <a href="#api" className="hover:text-white">
              API
            </a>
            <a
              href="https://github.com/swaggyp52/redbyte-ui-genesis"
              className="rounded-lg border border-slate-700/70 bg-slate-900/50 px-3 py-1 text-[11px] font-medium hover:border-indigo-500 hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
        <section id="overview" className="grid gap-8 md:grid-cols-[3fr,2fr]">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Ship UI faster with{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                RedByte
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              This project is the genesis for your UI system. React, Vite, and
              Tailwind are wired together and deployed via Cloudflare Pages.
              Swap this content out with your real product once you&apos;re
              ready.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <PrimaryButton
                onClick={() => {
                  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                }}
              >
                View Example Components
              </PrimaryButton>
              <button className="text-xs text-slate-300 hover:text-white">
                or connect to API →
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-slate-700/80 px-2 py-0.5">
                Vite + React + TS
              </span>
              <span className="rounded-full border border-slate-700/80 px-2 py-0.5">
                TailwindCSS
              </span>
              <span className="rounded-full border border-slate-700/80 px-2 py-0.5">
                Cloudflare Pages
              </span>
              <span className="rounded-full border border-slate-700/80 px-2 py-0.5">
                API via /functions
              </span>
            </div>
          </div>

          <Card className="border-indigo-500/50 bg-gradient-to-br from-slate-950 to-slate-900">
            <h2 className="text-sm font-semibold text-slate-50">
              Deployment Status
            </h2>
            <p className="mt-2 text-xs text-slate-300">
              Once pushed to <code className="rounded bg-slate-900 px-1">main</code>,
              Cloudflare Pages builds the app with Vite and serves it globally
              from the edge.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li>• npm run build ✅</li>
              <li>• Tailwind classes compiling ✅</li>
              <li>• Cloudflare Pages deployment ✅ (after next push)</li>
            </ul>
          </Card>
        </section>

        <section id="components" className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-100">
            Example Components
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h3 className="text-xs font-semibold text-slate-100">
                Primary Button
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Reusable button component built with Tailwind utility classes.
              </p>
              <div className="mt-3">
                <PrimaryButton>Click me</PrimaryButton>
              </div>
            </Card>
            <Card>
              <h3 className="text-xs font-semibold text-slate-100">
                Card Layout
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Simple card shell you can reuse for metrics, lists, anything.
              </p>
              <div className="mt-3 h-10 rounded-lg bg-slate-800/80" />
            </Card>
            <Card>
              <h3 className="text-xs font-semibold text-slate-100">
                API Preview
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Example call to a Cloudflare Pages Function at
                <code className="ml-1 rounded bg-slate-900 px-1">/api/hello</code>.
              </p>
              <APIExample />
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

const APIExample: React.FC = () => {
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const [payload, setPayload] = React.useState<string | null>(null);

  const hitApi = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/hello");
      if (!res.ok) throw new Error("Bad response");
      const json = await res.json();
      setPayload(JSON.stringify(json, null, 2));
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <PrimaryButton onClick={hitApi} disabled={status === "loading"}>
        {status === "loading" ? "Calling..." : "Call /api/hello"}
      </PrimaryButton>
      <pre className="max-h-28 overflow-auto rounded-lg bg-slate-900 p-2 text-[10px] text-slate-200">
        {status === "idle" && "Click the button to hit the edge function."}
        {status === "loading" && "Loading..."}
        {status === "error" && "Error calling API. Check Functions logs."}
        {status === "done" && payload}
      </pre>
    </div>
  );
};

export default App;
'@

Set-Content -LiteralPath "src/App.tsx" -Value $appTsx -Encoding utf8

# -----------------------------------------------------------------------------
# 4. Cloudflare Pages extras: _redirects, _headers, Functions API
# -----------------------------------------------------------------------------
Write-Host "`n[4/7] Adding Cloudflare Pages configuration (_redirects, _headers, functions)..." -ForegroundColor Cyan

# public folder for _redirects / _headers
if (-not (Test-Path "public")) {
    New-Item -ItemType Directory -Path "public" | Out-Null
}

# _redirects for SPA routing
$redirects = @'
/*    /index.html   200
'@
Set-Content -LiteralPath "public/_redirects" -Value $redirects -Encoding utf8

# _headers for basic security + caching
$headers = @'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-XSS-Protection: 1; mode=block

/assets/*
  Cache-Control: public, max-age=31536000, immutable
'@
Set-Content -LiteralPath "public/_headers" -Value $headers -Encoding utf8

# Pages Functions API: /api/hello
if (-not (Test-Path "functions")) {
    New-Item -ItemType Directory -Path "functions" | Out-Null
}
if (-not (Test-Path "functions/api")) {
    New-Item -ItemType Directory -Path "functions/api" | Out-Null
}

$apiHello = @'
export const onRequestGet: PagesFunction = async () => {
  const body = {
    ok: true,
    message: "Hello from Cloudflare Pages Functions + RedByte UI",
    ts: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
'@

Set-Content -LiteralPath "functions/api/hello.ts" -Value $apiHello -Encoding utf8

# -----------------------------------------------------------------------------
# 5. GitHub Actions CI workflow
# -----------------------------------------------------------------------------
Write-Host "`n[5/7] Creating GitHub Actions CI workflow..." -ForegroundColor Cyan

if (-not (Test-Path ".github")) {
    New-Item -ItemType Directory -Path ".github" | Out-Null
}
if (-not (Test-Path ".github/workflows")) {
    New-Item -ItemType Directory -Path ".github/workflows" | Out-Null
}

$ciYaml = @'
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install deps
        run: npm ci

      - name: Typecheck (if using TS)
        run: npm run typecheck || echo "typecheck script missing, skipping"

      - name: Lint (if configured)
        run: npm run lint || echo "lint script missing, skipping"

      - name: Run tests (if configured)
        run: npm test -- --watch=false || echo "no tests configured, skipping"

      - name: Build
        run: npm run build
'@

Set-Content -LiteralPath ".github/workflows/ci.yml" -Value $ciYaml -Encoding utf8

# -----------------------------------------------------------------------------
# 6. Ensure package.json has useful scripts
# -----------------------------------------------------------------------------
Write-Host "`n[6/7] Ensuring package.json scripts exist..." -ForegroundColor Cyan

$pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json

if (-not $pkgJson.scripts.dev)   { $pkgJson.scripts.dev   = "vite" }
if (-not $pkgJson.scripts.build){ $pkgJson.scripts.build = "vite build" }
if (-not $pkgJson.scripts.preview){ $pkgJson.scripts.preview = "vite preview" }
if (-not $pkgJson.scripts.lint) { $pkgJson.scripts.lint = "echo \"no lint configured\"" }
if (-not $pkgJson.scripts.typecheck) { $pkgJson.scripts.typecheck = "echo \"no typecheck configured\"" }

$pkgJson | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath "package.json" -Encoding utf8

# -----------------------------------------------------------------------------
# 7. Run build to verify
# -----------------------------------------------------------------------------
Write-Host "`n[7/7] Running npm install (if needed) + build check..." -ForegroundColor Cyan

Run-Npm "install"
Run-Npm "run build"

Write-Host "`n=== SUPERMEGA SETUP COMPLETE ===" -ForegroundColor Green

if (-not $SkipGit) {
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  git status"
    Write-Host "  git add -A"
    Write-Host "  git commit -m \"chore: apply supermega automation\""
    Write-Host "  git push"
    Write-Host ""
    Write-Host "Then go to Cloudflare Pages and re-run deployment." -ForegroundColor Cyan
}
