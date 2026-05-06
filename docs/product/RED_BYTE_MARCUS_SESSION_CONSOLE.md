---
doc_status: current
used_by_claude: true
created: 2026-05-06
---

# Marcus Session Console v1

## Purpose

The session console gives the HQ operator a live-readable timeline of what Marcus has done during the current local session. When Marcus uses tools, saves packets, encounters degraded state, or produces warnings, the session console records each event so the operator sees context without inferring it from a final answer alone.

This is operational visibility — not canonical product truth. Events are advisory records.

---

## What This Is Not

- Not streaming token output
- Not a terminal emulator
- Not a full database or audit log
- Not Obsidian writeback
- Not a product-surface change (Design/Verify/Map Pins/Export)
- Not arbitrary command execution
- Not a permanent record — `.redbyte/agent/runs/` is gitignored

---

## Event Types

| Type | Severity | When Emitted |
|------|----------|-------------|
| `user_message` | info | User sends a chat message or command |
| `marcus_reply` | success | Marcus returns a grounded reply |
| `tool_call` | info | A tool is called during the agent loop |
| `tool_result` | info or warn | Tool call returns (warn if ok=false) |
| `warning` | warn | Warning appended to response |
| `degraded_mode` | warn | Marcus falls back to non-Ollama mode |
| `packet_saved` | success | A workbench packet is written to disk |
| `coding_plan_generated` | success or warn | Coding plan tool completes |
| `source_grounding` | info | Source/evidence metadata attached to reply |
| `runtime_status` | info | Health or server state event |
| `error` | error | Any hard failure in a handler |

---

## Event Schema

```typescript
interface HqSessionEvent {
  id: string;           // generated: {type}-{timestamp}-{6hex}
  createdAt: string;    // ISO 8601
  type: HqSessionEventType;
  title: string;        // ≤200 chars
  summary: string;      // ≤500 chars
  severity: 'info' | 'warn' | 'error' | 'success';
  toolName?: string | null;
  packetId?: string | null;
  generatedFiles?: string[];
  sources?: HqSourceRecord[];
  evidenceLevel?: HqEvidenceLevel | null;
  degraded?: boolean;
  metadata?: Record<string, unknown>;
}
```

---

## Storage

- File: `.redbyte/agent/runs/hq/session/events.jsonl`
- One event per line, newline-delimited JSON
- Directory covered by `.gitignore` entry `.redbyte/agent/runs/`
- No database, no cloud sync, no Obsidian writeback
- `listEvents({ limit })` returns newest-first, up to `limit` (default 20, max 200)
- Write failures are warn-only — never crash the main action

---

## Server Endpoints

### `GET /session/events`

Returns the latest session events.

Query params:
- `limit` — integer, 1–200, default 20
- `type` — optional event type filter

Response:
```json
{
  "ok": true,
  "events": [HqSessionEvent...],
  "total": 7
}
```

### `POST /session/clear`

Clears the session events file. Only clears the local JSONL. Does not affect packets.

Response:
```json
{ "ok": true }
```

---

## UI Rules

- Session Console panel appears in the HQ right column
- Shows latest 20 events
- Each row: severity chip, event type, title, timestamp
- Tool/packet chips shown if present
- Warning and degraded events highlighted
- "Refresh session" reloads events
- Empty state: "No session events yet"
- Does not redesign existing HQ panels
- Does not stream tokens
- Does not show charts

---

## Trust Rules

- Session events are operational records, not canonical product truth
- A `packet_saved` event does not make a packet canonical
- A `tool_call` event does not mean the result is authoritative
- Events are scoped to the current machine's local session
- Events are cleared or roll off; do not treat them as permanent evidence
