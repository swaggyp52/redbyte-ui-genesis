# PHASE 2: SIMULATOR + BRIDGE DEMO

**Status**: Ready for autonomous execution

**Baseline confirmed**:
- ✅ Node v24.13.0, pnpm 10.24.0
- ✅ pnpm quality: EXITCODE=0
- ✅ Scheduled task running
- ✅ main at commit 3a08a79c

---

## Directive: Build Working Bridge + Simulator

Your mission: Create a working **demo** of the FPGA bridge with a simulator backend, validated against locked Phase 1 schemas.

### Must implement:

**Backend package** (`packages/rb-fpga-bridge/`):
- Implement simulator that emits only: `device:connected`, `device:disconnected`, `io:update`, `error:*`, `proof:capsule`
- Every event must include `seq` and `timestamp` (from fpga-events.schema.json)
- Every `proof:capsule` event must include `signature = HMAC_SHA256(canonical_json(events), BRIDGE_SECRET)`
- Simulator is deterministic: same seed → same event sequence (verify this with a test)

**HTTP API** (localhost:4242):
- `GET /api/health` returns `{ ok: true, version: "0.1.0", deviceConnected: boolean, wsPort: 4243 }`
- All responses are fast (<100ms)

**WebSocket API** (localhost:4243):
- Streams events continuously once a client connects
- Each event is valid JSON, matches fpga-events.schema.json
- Client can connect/disconnect multiple times without crashing

**CLI command** (`pnpm --filter @redbyte/fpga-bridge dev`):
- Starts simulator backend automatically
- Binds HTTP to localhost:4242, WS to localhost:4243
- Prints success message: "[fpga-bridge] listening on http://localhost:4242 and ws://localhost:4243"
- Does NOT hang indefinitely; can be killed cleanly with Ctrl+C

**Test harness** (`pnpm --filter @redbyte/fpga-bridge test`):
- Schema validation test: all emitted events pass validation against `fpga-events.schema.json`
- Proof signature test: computed signature matches HMAC rule (see below)
- Determinism test: run simulator with fixed seed + fixed input, verify identical event sequence (by seq ordering)
- All tests print pass/fail clearly

**Proof artifacts** (`ops/proof/fpga-bridge-phase2-*.txt`):
- Created when test suite completes
- Contains:
  - Health response
  - At least 10 streamed events (full JSON)
  - One complete proof capsule (full JSON)
  - Verification output: "signature_valid: true"
- Make it readable (not minified)

### Signature computation (critical):

```javascript
const crypto = require('crypto');

// Canonical JSON: stringify with sorted keys, no extra spaces
function canonical(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

const BRIDGE_SECRET = "dev-secret-key"; // for Phase 2 only, will change for production

// To create signature:
const eventsCanonjson = canonical(proof.events);
const signature = 'hmac-sha256:' + 
  crypto.createHmac('sha256', BRIDGE_SECRET)
    .update(eventsCanonjson)
    .digest('hex');
proof.signature = signature;

// To verify:
const expectedSig = 'hmac-sha256:' + 
  crypto.createHmac('sha256', BRIDGE_SECRET)
    .update(eventsCanonjson)
    .digest('hex');
const valid = (expectedSig === proof.signature);
```

### Simulator behavior (example):

```
Phase 2 Sequence:
  Emit: device:connected (seq=0)
  Wait 100ms
  Emit: io:update SW=0x0001 LED=0x0001 (seq=1)
  Wait 100ms
  Emit: io:update SW=0x0003 LED=0x0003 (seq=2)
  Wait 100ms
  Emit: io:update SW=0x0007 LED=0x0007 (seq=3)
  ... continue pattern until 100+ events
  Emit: proof:capsule with signature (seq=N)
  Emit: device:disconnected (seq=N+1)
```

(Exact pattern doesn't matter; determinism does: same seed → same pattern every run)

### Validation rules:

**Build must pass**:
```bash
pnpm -r build
```

**Bridge must not break main**:
```bash
pnpm quality  # still EXITCODE=0
```

**Bridge must start**:
```bash
pnpm --filter @redbyte/fpga-bridge dev  # binds ports, does not hang
```

**Tests must pass**:
```bash
pnpm --filter @redbyte/fpga-bridge test  # schema + signature + determinism
```

### Scope (STAY WITHIN THESE BOUNDS):

✅ Simulator backend (deterministic event generation)
✅ HTTP health endpoint
✅ WebSocket event streaming
✅ HMAC-SHA256 signature validation
✅ Event schema validation (fpga-events.schema.json)
✅ Proof capsule validation (proof-capsule.schema.json)

❌ Do NOT create UI components
❌ Do NOT integrate with real hardware
❌ Do NOT add new event types (use only: device:connected, device:disconnected, io:update, error:*, proof:capsule)
❌ Do NOT skip sample:frame with a comment; just don't emit it
❌ Do NOT add "temporary hacks"

### Stop conditions:

**SUCCESS**: When you can run these and they all pass:
```bash
pnpm --filter @redbyte/fpga-bridge dev &
sleep 2
curl http://localhost:4242/api/health
# should return { ok: true, version: "0.1.0", deviceConnected: true, wsPort: 4243 }
pnpm --filter @redbyte/fpga-bridge test
# all tests pass, proof file written to ops/proof/fpga-bridge-phase2-*.txt
```

**FAILURE**: If any of these happen, fix immediately (do not push):
- Bridge doesn't start (port binding fails, syntax error, missing deps)
- WS doesn't stream (client connects but receives nothing)
- Events don't validate against schema (required fields missing, wrong types)
- Signature fails verification (HMAC doesn't match)
- pnpm quality fails (you broke the build)
- Test hangs >120s (kill and investigate)

### You stop here (do NOT proceed to Phase 3):

Once Phase 2 demo works, **create a PR** with:
- Title: `feat(fpga): phase2 simulator + bridge demo (signed proofs, deterministic)`
- Description: reference PHASE_1_LOCK_REPORT.md, include proof artifact
- Stop and wait for review

Do NOT merge to main yet. Do NOT start UI.

### Next (Phase 3 comes after review):

Once Phase 2 is reviewed and approved:
- UI agents will build Hardware Panel app
- Integrates with ws://localhost:4243
- Renders I/O + waveforms + proof export
- Also stops at a PR for review

---

**You are authorized to work fully autonomously within Phase 2 scope.**

**You do not need permission for every file.**

**You do need to stop at the PR and wait for human review before Phase 3.**

Go build the bridge.
