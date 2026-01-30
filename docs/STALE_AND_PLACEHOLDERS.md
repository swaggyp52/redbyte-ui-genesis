# RedByte OS Genesis — Stale Code, Placeholders & Toy-Feel Sources

## Placeholders

### 1. Manual Site Hero Mockup
- **File**: `apps/manual-site/src/pages/Home.tsx:41`
- **Content**: `[ Live Simulation Viewport ]` — gray placeholder box instead of real screenshot or embedded demo
- **Fix**: Replace with actual screenshot of Logic Playground or embedded mini-demo

### 2. TruthHUD Fake Latency
- **File**: `packages/rb-apps/src/components/TruthHUD.tsx`
- **Content**: `Lat: {Math.floor(Math.random() * 20)+10}ms` — random number displayed as latency
- **Fix**: Measure actual WS roundtrip ping, or remove the field entirely

### 3. Dead Light Mode
- **File**: `packages/rb-shell/src/Desktop.tsx:75`
- **Content**: `const isLightMode = false;` — hardcoded, all light mode CSS paths unreachable
- **Fix**: Wire to theme store or remove all `isLightMode ? ... : ...` branches

### 4. TruthHUD Verification Status
- **File**: `packages/rb-logic-3d` (referenced in TruthHUD)
- **Content**: `const isVerified = false; // TODO: Connect to verification store`
- **Fix**: Connect to actual verification state from lab evaluator

### 5. Arduino Netlist Lookup
- **File**: `packages/rb-logic-3d/src/...ArduinoBehaviorEngine.ts:23`
- **Content**: `return undefined; // TODO: Real netlist lookup`
- **Fix**: Implement or remove if not needed for MVP

## Stale / Dead Code

### 6. Legacy rb-fpga-bridge-contract Import
- **File**: `packages/rb-apps/src/apps/HardwarePanelApp.tsx:3`
- **Content**: `import type { BridgeDevice } from "@redbyte/rb-fpga-bridge-contract";`
- **Problem**: Dead type import — actual device data comes from hardwareClient using rb-protocol types
- **Fix**: Change import to `@redbyte/rb-protocol` or remove entirely

### 7. Duplicate Protocol Definition
- **File**: `packages/rb-bridge-agent/src/protocol.ts`
- **Problem**: Local copy of protocol types that should come from `@redbyte/rb-protocol`
- **Consumers**: `packages/rb-bridge-agent/src/backends/basys3.ts:3`, test files
- **Fix**: Delete file, update all imports to use `@redbyte/rb-protocol`

### 8. Deprecated CI Workflow
- **File**: `.github/workflows/ci.yml`
- **Content**: Comment says "DISABLED in favor of quality.yml", trigger set to manual only
- **Fix**: Delete file or archive

### 9. Old HardwareSessionStore WebSocket Code
- **File**: `packages/rb-apps/src/stores/hardwareSessionStore.ts`
- **Problem**: Contains overlapping old direct-WebSocket code mixed with new HardwareClient singleton pattern. Dead `connectWS()`, `handleMessage()`, `send()` functions coexist with `syncState()`.
- **Fix**: Remove all old WS code, keep only singleton pattern

### 10. evidenceHash Field Never Set
- **File**: `packages/rb-apps/src/utils/evidenceExport.ts`
- **Content**: `evidenceHash?: string` field exists in LabEvidenceCapsule but is never populated
- **Fix**: Populate with SHA-256 hash, or remove field

### 11. hashedBytes Field Never Populated
- **File**: `packages/rb-apps/src/utils/verifyEvidence.ts`
- **Content**: Schema expects `hashedBytes` but `hashEvidence()` only returns `{ hash: string }`
- **Fix**: Compute and return byte count, or remove from schema

## UI Toy-Feel Issues

### 12. TopBar Z-Index Below Dock
- **File**: Shell CSS
- **Problem**: TopBar is z-30, Dock is z-40. System chrome should be above app launcher.
- **Fix**: Set TopBar to z-50+

### 13. No Per-App Error Boundaries
- **Problem**: If Logic Playground crashes, entire shell crashes. No "Restart app" option.
- **Fix**: Wrap each `<AppInstance>` in `<ErrorBoundary>` with OS-native error card

### 14. Inconsistent Animation Timing
- **Problem**: Most transitions are 140ms, but some overlays use 120ms or 100ms with no documented reason
- **Fix**: Centralize timing constants

### 15. Missing Empty States
- **Problem**: Some panels show blank white/dark space when no content exists (e.g., no probes, no files, no devices)
- **Fix**: Add consistent empty state components with icon + message + action

### 16. Stale Comments Suggesting Old API
- **File**: `packages/rb-apps/src/services/hardwareClient.ts:197,273`
- **Content**: Comments reference old API contract (`schema_version`) that no longer matches implementation
- **Fix**: Update or remove comments

### 17. LogicPlaygroundApp.tsx Component Highlighting TODO
- **File**: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:3345`
- **Content**: `// TODO: Implement component highlighting`
- **Fix**: Implement or remove TODO

### 18. CE Example Pack Loading TODO
- **File**: `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx:3780`
- **Content**: `examples={[]} // TODO: Load CE example pack`
- **Fix**: Load examples or document as intentionally empty for CE mode

### 19. HardwareAutoAdopt Missing Cleanup
- **File**: `packages/rb-apps/src/components/HardwareAutoAdopt.tsx`
- **Problem**: Spawns 3D nodes when hardware connects, but never removes them when hardware disconnects
- **Fix**: Add cleanup effect for disconnected sessions

### 20. Recording Panel No Empty State
- **Problem**: When not recording, the panel shows controls but no context about what recording does
- **Fix**: Add brief explanation + "Learn more" link when in idle mode
