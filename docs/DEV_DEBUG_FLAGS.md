# Development Debug Flags

**Authoritative source for dev-only globals, localStorage flags, and environment variables.**

All entries in this document are either dev-only or restricted to non-production environments.

## localStorage Debug Flags

| Key | Purpose | Safe in Prod? | Notes |
|-----|---------|--------------|-------|
| `rb:windowDebug` | Enable windowing system debug API (`window.__RB_WINDOWING__`) | ❌ NO | Gate: guarded by `NODE_ENV !== 'production'` |
| `rb:renderStormReport` | Auto-enable render storm detection UI | ❌ NO | Used in Shell.tsx for debug perf analysis |
| `rb:shell:pinnedApps` | Persisted pinned apps in taskbar | ✅ YES | User preference; safe in prod |
| `rb:shell:booted` | Shell boot status flag | ✅ YES | Initialization flag; safe in prod |
| `rb:shell:booted:v1` | Shell boot status version | ✅ YES | Versioned boot flag; safe in prod |
| `rb:onboarding:dismissed` | Onboarding tutorial dismissed flag | ✅ YES | UX state; safe in prod |
| `rb:classroom:v1` | Classroom mode state | ⚠️ CONDITIONAL | Feature state; verify not altering security |
| `rb:file-associations` | File type associations (settings) | ✅ YES | User preferences; safe in prod |
| `rb:filesystem` | Filesystem state cache | ✅ YES | State cache; safe in prod |
| `rb:flags:${name}` | Dynamic feature flag storage (name is variable) | ⚠️ CONDITIONAL | Feature flags; determine per-flag if UX-altering |
| `rb:window-layout` | Window layout persistence | ✅ YES | User UX state; safe in prod |

## Window Debug APIs

| Global | Purpose | Safe in Prod? | Guard |
|--------|---------|--------------|-------|
| `window.__RB_WINDOWING__` | Windowing store debug methods (snapshot, inspect) | ❌ NO | `NODE_ENV !== 'production'` AND `localStorage.getItem('rb:windowDebug') === '1'` |
| `window.__RB_DEBUG__` | Zustand store instrumentation (getters, setters log) | ❌ NO | `NODE_ENV !== 'production'` (storeInstrumentation.ts) |
| `window.__RB_RUNAWAY__` | Runaway thread watchdog metrics (reason, duration) | ❌ NO | `NODE_ENV === 'development'` (runaway-watchdog.ts) |
| `window.__RB_WATCHDOG_CLEANUP__` | Function to clean up runaway watchdog | ❌ NO | `NODE_ENV === 'development'` (runaway-watchdog.ts) |
| `window.__RB_MOUNT_TRACE__` | React mount trace array (fatal-capture.ts) | ❌ NO | Dev-only hook; guarded by NODE_ENV check |
| `window.__RB_FATAL_CAPTURE_INSTALLED__` | Fatal capture error boundary flag | ❌ NO | Error boundary initialization flag; dev-only |
| `window.__RB_ERROR_BOUNDARY_HIT__` | Error boundary triggered log | ❌ NO | Error tracking; dev-only |
| `window.__RB_BOOT_OK__` | Shell boot completion flag | ✅ YES | Boot signal; safe in prod |
| `window.__RB_BOOT_TS__` | Shell boot timestamp (perf.now()) | ✅ YES | Performance metric; safe in prod |
| `window.__RB_CIRCUIT_STORE__` | Circuit store debug reference | ❌ NO | Debug-only store export |
| `window.__RB_PROJECT_RUNTIME__` | Project runtime store debug reference | ❌ NO | Dev/test store export, guarded by NODE_ENV |
| `window.__RB_CLASSROOM_MODE_STORE__` | Classroom mode store debug reference | ❌ NO | Debug-only store export |
| `window.__RB_AUDIT__` | Audit flag (when true, enables audit logging) | ❌ NO | Gate: `typeof window !== 'undefined' && window.__RB_AUDIT__ === true` |
| `window.__RB_FLAGS__` | Feature flag store (env-injected at deploy time) | ⚠️ CONDITIONAL | Prod-safe if env-injected; validate at build-time |

## Environment Variables (Dev-Only)

| Variable | Purpose | Safe in Prod? | Notes |
|----------|---------|--------------|-------|
| `RB_BRIDGE_DRYRUN` | Hardware bridge dry-run mode (skip real FPGA) | ❌ NO | Used in tests; hardwareClient checks `process.env?.RB_BRIDGE_DRYRUN === '1'` |
| `RB_DEMO_MODE` | Demo mode (skip hardware operations) | ❌ NO | hardwareClient checks `process.env.RB_DEMO_MODE === '1'` |
| `UPDATE_RBPROJ_GOLDEN` | Update golden snapshot files (tests) | ❌ NO | rbproject-roundtrip-gate.test.ts: `process.env.UPDATE_RBPROJ_GOLDEN === '1'` |
| `UPDATE_RBX_EVIDENCE_GOLDEN` | Update RBX evidence golden files (tests) | ❌ NO | rbx-evidence-determinism-gate.test.ts |
| `RB_FPGA_MOCK` | Force FPGA bridge into mock mode | ❌ NO | rb-fpga-bridge/index.js |
| `RB_FPGA_SIM` | Force FPGA bridge into sim mode | ❌ NO | rb-fpga-bridge/index.js |
| `RB_FPGA_TRACE` | Enable hardware trace logging | ⚠️ CONDITIONAL | rb-fpga-bridge/index.js; only safe if logs don't leak secrets |
| `RB_FPGA_TRACE_PATH` | Path to hardware trace output | ⚠️ CONDITIONAL | Server-side only; safe in prod if not accessible |
| `RB_FPGA_DRYRUN` | FPGA programming dry-run (skip actual programming) | ❌ NO | vivado/programBitstream.js |

## Environment Variables (Infrastructure - Prod-Safe)

| Variable | Purpose | Safe in Prod? |
|----------|---------|--------------|
| `RB_FPGA_HTTP_PORT` | Hardware bridge HTTP port | ✅ YES |
| `RB_FPGA_WS_PORT` | Hardware bridge WebSocket port | ✅ YES |
| `RB_FPGA_BAUD` | Serial port baud rate | ✅ YES |
| `REDBYTE_FPGA_PORT` | FPGA serial port override (COM5, /dev/ttyUSB0) | ✅ YES |
| `RB_FPGA_SEED` | Mock FPGA random seed | ✅ YES (when in mock mode) |
| `RB_FPGA_BIN_MS` | Hardware bin size (milliseconds) | ✅ YES |
| `RB_FPGA_PROGRAM_TIMEOUT_MS` | Programming timeout | ✅ YES |
| `RB_FPGA_PROGRAM_LOG_KEEP` / `_TAIL` / `_MAX_BYTES` | Log management | ✅ YES |
| `RB_FPGA_HMAC_SECRET` | Proof signing secret | ✅ YES (if NOT hardcoded "changeme") |
| `RB_FPGA_CABLE` | Vivado cable name override | ✅ YES |
| `RB_FPGA_DEVICE` | Vivado device override | ✅ YES |
| `VIVADO_PATH` | Vivado installation path | ✅ YES |
| `VITE_CLASSROOM_MODE` | Classroom mode flag | ⚠️ CONDITIONAL | Feature flag; determine if UX-altering |
| `NODE_ENV` | Standard build environment (development/production/test) | ✅ YES |

## Scanning & Compliance Rules

1. **window.__RB_* assignments**: Every assignment must be guarded by `NODE_ENV !== 'production'` or checked via `isDevBuild()` helper.
2. **localStorage debug keys**: Every `localStorage.getItem('rb:*')` or `setItem('rb:*')` must have a key in the table above OR be a persistent key (e.g., `rb:window-layout`).
3. **console.***: Debug logging is allowed in dev; must be guarded or removed before prod.
4. **Feature flags** (`window.__RB_FLAGS__`): If used to alter UX/perf, must be env-injected at build time and immutable.

## Production Build Checklist

Before shipping:
- [ ] No `window.__RB_*` assignments in production path
- [ ] All dev-only env vars have `NODE_ENV !== 'production'` guards
- [ ] No unguarded `console.error`, `console.warn`, `console.log` spam
- [ ] `localStorage` reads only for known keys in this doc
- [ ] `NODE_ENV` set correctly at build time (`vite build` → NODE_ENV=production)

---

**Last Updated**: 2026-02-06  
**Gate**: `pnpm ui:dev-guards-contract-gate` (validates compliance)
