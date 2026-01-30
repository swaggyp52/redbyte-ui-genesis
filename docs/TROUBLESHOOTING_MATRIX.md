# RedByte OS Genesis — Troubleshooting Matrix

## Build & Dev Server

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| `pnpm install` fails | Node version mismatch | Ensure Node 18+ and pnpm 8+ |
| Dev server won't start | Port 5173 in use | Kill process on port or use `--port 5174` |
| TypeScript errors in tests | React 19 compat | Known — test types use older `@types/react`. Does not affect runtime |
| `Cannot find module 'three-stdlib'` | Missing optional dep | `pnpm add three-stdlib -w` or ignore (non-critical) |
| Circular dependency warning | `rb-shell ↔ rb-apps` | Known architectural issue — does not cause runtime errors |

## Virtual Lab

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| 3D scene blank / black | WebGL context lost | Refresh browser. Check GPU drivers |
| Parts don't snap to grid | Transform mode incorrect | Ensure `translate` mode in TransformControls |
| Simulation won't start | Lab session not initialized | Open a lab template first via guided sidebar |
| Behavior checks all fail | Circuit not wired correctly | Check wire connections match template requirements |
| Layout lost on refresh | No persist middleware on lab store | Known limitation — layout is session-only |
| `getState()` stale data | Was using non-reactive getState in render | Fixed in P1-1 (useShallow selectors) |

## Evidence & Grading

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| Export produces empty ZIP | No lab session active | Start a lab session before exporting |
| Inspector can't parse ZIP | Schema version mismatch | Fixed in P0-1 — exporter now uses v1 schema |
| No vectors in capsule | Lab template has no behavior checks | Ensure template defines `behavior_checks` |
| `evidenceHash` is short hex | Using DJB2 fallback | SHA-256 requires `crypto.subtle` (HTTPS or localhost) |
| Score shows 0% | Evaluator found no passing checks | Review circuit against template requirements |
| Circuit snapshot missing | Old export format | Re-export with updated code (P1-8 adds snapshot) |
| `verified: true` when offline | Was hardcoded | Fixed in P1-4 — now reads actual transport status |

## Hardware Bridge

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| Bridge shows "offline" | Agent not running | `cd packages/rb-bridge-agent && pnpm dev` |
| "Connection in progress" | Idempotency guard triggered | Wait for current connection attempt to finish |
| "Port already in use" | COM port mutex blocked | Another device ID holds the port lock. Disconnect first |
| Device not discovered | USB not connected / drivers missing | Check Device Manager for COM port. Install FTDI/Arduino drivers |
| WebSocket reconnects loop | WS path mismatch | Client tries `/ws` then falls back to `/`. Check bridge is on :4242 |
| Bridge goes offline permanently | Max retries exceeded | Fixed in P0-5 — background reconnect every 30s |
| Health check fails intermittently | Network timeout | Increase `FETCH_TIMEOUT_MS` or check firewall |
| Two devices claim same port | Missing port mutex | Fixed in P0-2 — `lockedPorts` map prevents double-open |

## Shell & UX

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| App crashes take down shell | No error boundary | Fixed in P1-5 — per-app `AppErrorBoundary` with Retry |
| Window z-order confused | Focus race condition | Click window title bar to re-focus |
| Dock icons not responding | Window store stale | Check console for Zustand errors |
| Theme doesn't persist | localStorage blocked | Check browser privacy settings |
| Snap assist not working | Settings disabled | Check `useSettingsStore` snap assist toggle |

## Recording & Replay

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| Browser tab crashes during recording | Unbounded trace memory | Fixed in P1-3 — capped at 50K samples |
| Replay verification fails | Trace mismatch | Non-deterministic simulation or timing diff |
| Recording mode stuck | `mode` not reset to 'idle' | Call `stopRecording()` or `reset()` |
| Stimulus events out of order | Not normalized | Call `normalizeEvents()` before replay |

## 3D Rendering

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| Memory leak over time | Materials not disposed | Fixed in P1-7 — WireMesh cleanup on unmount |
| Excessive re-renders | Unstable Zustand selectors | Fixed in P1-1 — useShallow for object selectors |
| Wire colors don't update | Was using getState() in render | Fixed — now uses reactive subscription |
| LED doesn't light up | Pin state key mismatch | Check `pinStates[\`nodeId:pinId\`]` format |

## Protocol & Types

| Symptom | Diagnosis | Fix |
|---------|----------|-----|
| Type mismatch on `SetPinsPayload` | Local protocol vs canonical | Fixed in P0-3 — all imports from `@redbyte/rb-protocol` |
| `target` missing on `UploadSketchPayload` | Canonical type was incomplete | Fixed — added `target` field to protocol |
| `BridgeDevice` import error | Dead `rb-fpga-bridge-contract` dep | Fixed in P0-4 — removed dead import |

## Diagnostic Commands

```bash
# Type-check all packages
pnpm -r exec tsc --noEmit

# Check for circular dependencies
npx madge --circular src/

# Run tests
pnpm test

# Check bridge agent health
curl http://localhost:4242/health

# List connected devices
curl http://localhost:4242/devices
```
