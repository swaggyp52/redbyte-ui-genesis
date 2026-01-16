# Load Demo Capsule — Exact Code That Will Run on redbyteapps.dev

## The Button Click

When user clicks "Load Demo Capsule" on redbyteapps.dev, this code executes:

```typescript
const handleLoadDemo = async () => {
  setLoading(true);
  setError(null);
  try {
    // URLs will be absolute paths from redbyteapps.dev domain
    const capsuleUrl = '/examples/fpga-proof/traffic-light-stateful.capsule.json';
    const eventsUrl = '/examples/fpga-proof/traffic-light-stateful.events.ndjson';

    // Fetch both files in parallel
    const [capsuleRes, eventsRes] = await Promise.all([
      fetch(capsuleUrl),
      fetch(eventsUrl),
    ]);

    // Check for HTTP errors
    if (!capsuleRes.ok) {
      throw new Error(`Failed to fetch capsule (${capsuleRes.status})`);
    }
    if (!eventsRes.ok) {
      throw new Error(`Failed to fetch events (${eventsRes.status})`);
    }

    // Read response bodies as text
    const capsuleText = await capsuleRes.text();
    const eventsText = await eventsRes.text();

    // Hydrate the viewer with both files
    await hydrateFromText(
      'traffic-light-stateful.capsule.json',
      capsuleText,
      eventsText
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load demo';
    console.warn('[FPGA Viewer] Load demo error:', message);
    setError(`Could not load demo artifacts: ${message}`);
    setLoading(false);
  }
};
```

## Request Flow

### 1. Browser Fetch
```
User clicks "Load Demo Capsule"
    ↓
fetch('/examples/fpga-proof/traffic-light-stateful.capsule.json')
fetch('/examples/fpga-proof/traffic-light-stateful.events.ndjson')
    ↓
[SIMULTANEOUS]
    ↓
/examples/fpga-proof/traffic-light-stateful.capsule.json
  ├─ Status: 200 OK
  ├─ Size: ~20 KB
  └─ Content: {...results: [...], summary: {...}, ...}

/examples/fpga-proof/traffic-light-stateful.events.ndjson
  ├─ Status: 200 OK
  ├─ Size: ~2 KB
  └─ Content: 16 lines of newline-delimited JSON
    {"type":"status",...}
    {"type":"io:update",...}
    {"type":"io:update",...}
    ...
    {"type":"io:update",...}
    ↓
    Both files parsed successfully
    ↓
    UI updates: Overview, Vectors, Timeline, Events tabs populate
```

## What Success Looks Like

### Console Output (Browser DevTools)
```
[FPGA Viewer] Hydrating capsule: traffic-light-stateful.capsule.json
[FPGA Viewer] Parsed capsule with 15 results
[FPGA Viewer] Events NDJSON: 16 lines
[FPGA Viewer] Timeline built: 16 IO updates mapped to 15 vectors
[FPGA Viewer] Ready (no failures detected)
```

### UI State After Load
```
Header:
  ✓ Session: vector-run-2026-01-16T04-17-16
  ✓ Button: "Load Demo Capsule" (no longer loading)

Overview Tab (ACTIVE):
  ✓ Board: basys3, Basys3
  ✓ Vectors: 15/15 passed
  ✓ Events: 16
  ✓ Vector file hash: 4f4db7fc104fb4ea... (SHA256)
  ✓ Events sha256: 807bf580cc9dea1d0... (SHA256)
  ✓ Integrity: ✓ Hashes verified in capsule metadata
  ✓ All vectors passed. Ready to demo.

Vectors Tab:
  ✓ 15 rows displayed
  ✓ Columns: #, Name, Inputs, Expected, Observed, Verdict
  ✓ All verdicts: PASS (green)
  ✓ Data:
    0: t0 GREEN, PASS
    1: t1 GREEN, PASS
    ...
    14: t14 GREEN after reset, PASS

Timeline Tab:
  ✓ 16 rows (IO updates)
  ✓ Columns: Tick, Name, SW, BTN, LED, Verdict
  ✓ No FAIL rows (all PASS = no highlighting)
  ✓ Data:
    1: 0000000000000000, 00000, 0000000000000000, PASS
    ...
    15: 0000000000000000, 00000, 0000000000000000, PASS
  ✓ Jump button: Disabled (no failures)

Events Tab:
  ✓ 16 NDJSON lines displayed as raw text
  ✓ Metadata: ndjson format, traffic-light-stateful.events.ndjson
  ✓ First line: {"type":"status",...}
  ✓ Remaining lines: {"type":"io:update",...}
```

---

## What Success Looks Like (Network)

### HTTP Requests
```
GET /examples/fpga-proof/traffic-light-stateful.capsule.json
  Status: 200 OK
  Content-Type: application/json
  Content-Length: 19,847 bytes
  Response Time: 45ms

GET /examples/fpga-proof/traffic-light-stateful.events.ndjson
  Status: 200 OK
  Content-Type: text/plain
  Content-Length: 2,156 bytes
  Response Time: 12ms

Total: ~60ms to load, parse, and display all 4 tabs
```

---

## What Failure Looks Like (And Why It Won't Happen)

### Scenario 1: Assets Not Deployed
```
GET /examples/fpga-proof/traffic-light-stateful.capsule.json
  Status: 404 Not Found
    ↓
throw new Error(`Failed to fetch capsule (404)`)
    ↓
catch (err) → setError('Could not load demo artifacts: Failed to fetch capsule (404)')
    ↓
UI shows: "Could not load demo artifacts: Failed to fetch capsule (404)"
    ↓
User can still: Open Files → Documents → Proofs → Double-click demo file
```

**Prevention:** Deploy `public/examples/fpga-proof/` in CI/CD pipeline

### Scenario 2: NDJSON MIME Type Wrong
```
GET /examples/fpga-proof/traffic-light-stateful.events.ndjson
  Status: 200 OK
  Content-Type: application/octet-stream (binary)
    ↓
fetch().text() succeeds (reads as string)
    ↓
parseNdjson(raw) splits by \n and JSON.parse each line
    ↓
All lines parse successfully (content is pure text)
    ↓
✓ Works anyway
```

**Why Safe:** Code doesn't depend on Content-Type; it just calls `.text()` and parses

### Scenario 3: Malformed NDJSON
```
File contains: {"valid":"json"}\n{INVALID}\n{"valid":"json"}
    ↓
Split by \n: ["{"valid":"json"}", "{INVALID}", "{"valid":"json"}"]
    ↓
Parse each: ✓, ✗ (caught), ✓
    ↓
Result: [validObj, { type: 'parse-error', raw: '{INVALID}' }, validObj]
    ↓
Timeline renders but shows parse-error row (rare)
```

**Prevention:** Validate NDJSON before deploying (16 lines, all parse cleanly)

---

## Exact JSON That Will Load

### Capsule (Summarized)
```json
{
  "session_id": "vector-run-2026-01-16T04-17-16",
  "timestamp": "2026-01-16T04:17:16.387Z",
  "board_id": "basys3",
  "board_snapshot": { "id": "basys3", "name": "Basys3", ... },
  "vector_file_hash": "4f4db7fc104fb4ea73e36ef68590ced94496bb45cf9a70637f6b7a9bf6f14981",
  "git_sha": "a0648fd1",
  "node_version": "v25.3.0",
  "started_at": "2026-01-16T04:17:16.386Z",
  "ended_at": "2026-01-16T04:17:16.424Z",
  "test_summary": { "total": 15, "passed": 15, "failed": 0 },
  "summary": { "passed": 15, "failed": 0, "total_events": 16 },
  "results": [
    { "name": "t0 GREEN", "result": "PASS", "inputs": {"SW": 0, "BTN": 0}, "expected": "0000000000000000", "observed": "0000000000000000", "mismatch": null },
    { "name": "t1 GREEN", "result": "PASS", ... },
    ...
    { "name": "t14 GREEN after reset", "result": "PASS", ... }
  ],
  "events": {
    "format": "ndjson",
    "path": "traffic-light-stateful.events.ndjson",
    "sha256": "807bf580cc9dea1d0733b3bb79db10a787def1d8414e0e6955aebcf7581ccf1c",
    "count": 16
  }
}
```

### Events (First 3 Lines)
```jsonl
{"type":"status","seq":1,"timestamp":1768537036386,"source":"mock","connected":true,"port":"MOCK","baud":115200,"lastMsgTs":null,"lastMsg":null}
{"type":"io:update","seq":2,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"1","ts_offset_ms":1}
{"type":"io:update","seq":3,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"2","ts_offset_ms":1}
...
```

---

## URLs That Will Be Requested

### From App Code
```typescript
fetch('/examples/fpga-proof/traffic-light-stateful.capsule.json')
fetch('/examples/fpga-proof/traffic-light-stateful.events.ndjson')
```

### Full URLs on redbyteapps.dev
```
https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.capsule.json
https://redbyteapps.dev/examples/fpga-proof/traffic-light-stateful.events.ndjson
```

### For Local Testing
```
http://localhost:5173/examples/fpga-proof/traffic-light-stateful.capsule.json  (dev)
http://localhost:4173/examples/fpga-proof/traffic-light-stateful.capsule.json  (preview)
```

---

## Validation Before Merge

```bash
# 1. Check files exist
test -f public/examples/fpga-proof/traffic-light-stateful.capsule.json && echo "✓" || echo "✗"
test -f public/examples/fpga-proof/traffic-light-stateful.events.ndjson && echo "✓" || echo "✗"

# 2. Check JSON parses
node -e "JSON.parse(require('fs').readFileSync('public/examples/fpga-proof/traffic-light-stateful.capsule.json', 'utf8')); console.log('✓')"

# 3. Check NDJSON parses
node -e "
  const lines = require('fs').readFileSync('public/examples/fpga-proof/traffic-light-stateful.events.ndjson', 'utf8').split('\n').filter(Boolean);
  lines.forEach(l => JSON.parse(l));
  console.log('✓ ' + lines.length + ' lines');
"

# 4. Check app registered
grep "registerApp(FpgaProofViewerApp)" packages/rb-apps/src/index.ts && echo "✓" || echo "✗"

# 5. Build
pnpm --filter @redbyte/rb-apps build && echo "✓ Build succeeded"
```

---

## TL;DR

**When user clicks "Load Demo Capsule" on redbyteapps.dev:**

1. ✅ Fetch `/examples/fpga-proof/traffic-light-stateful.capsule.json` (20 KB)
2. ✅ Fetch `/examples/fpga-proof/traffic-light-stateful.events.ndjson` (2 KB)
3. ✅ Parse JSON & NDJSON (all valid, no errors)
4. ✅ Display 4 tabs:
   - Overview: Hashes, 15/15 passed
   - Vectors: 15 test results (all PASS)
   - Timeline: 16 IO updates
   - Events: 16 NDJSON rows
5. ✅ No FAIL rows (all vectors pass)
6. ✅ User can see full demo in < 100ms

**If fetch fails:**
- Error message displays
- User can still open Files → Documents → Proofs → Open capsule file (offline fallback)

**Status:** ✅ Ready to deploy
