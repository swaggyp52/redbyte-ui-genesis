---
doc_status: current
used_by_claude: true
created: 2026-05-06
slice: feat(hq): add Marcus workbench history
---

# Marcus Workbench History

## Purpose

Marcus outputs are local-first generated artifacts. Chat answers, coding plans, problem packets, trace reports, and bench summaries should be saved to disk and browsable from the HQ surface so Connor can review, compare, and reuse recent outputs without losing them on page refresh.

This is **not** canonical product truth. Canonical truth is repo docs, code, and tests. Workbench packets are generated evidence with explicit confidence levels.

---

## Packet Types

| Type | Source endpoint | Description |
|------|----------------|-------------|
| `chat_answer` | `POST /chat` | Marcus grounded answers to free-form questions |
| `coding_plan` | `POST /coding-plan` | Codex packets from generate_codex_packet tool |
| `problem_packet` | `POST /problem-intake` | Structured problem intake from raw feedback |
| `trace_report` | `POST /trace-claim` | Claim trace reports against repo docs |
| `bench_summary` | `GET /bench-evidence` | Bench evidence classification summaries |
| `control_snapshot` | `GET /snapshot` | Control-next + bench + claims combined snapshot |
| `fallback_report` | `POST /chat` (degraded) | Degraded/offline Marcus fallback responses |

---

## Packet Fields

```typescript
interface HqPacket {
  id: string;             // e.g. "chat_answer-20260506T045900Z-abc123"
  createdAt: string;      // ISO 8601
  type: HqPacketType;
  title: string;          // derived from prompt or tool output
  summary: string;        // first 280 chars of reply
  prompt: string;         // sanitized user prompt
  reply: string;          // full reply text
  mode: string;           // chat mode or endpoint name
  toolsUsed: Array<{ name: string; ok: boolean; summary: string }>;
  sources: HqSourceRecord[];
  evidenceLevel: HqEvidenceLevel;
  sourceConfidence: HqSourceConfidence;
  generatedFiles: string[];
  warnings: string[];
  requiresApproval: boolean;
  degraded: boolean;
  path: string;           // relative path under .redbyte/agent/runs/hq/packets/
  tags: string[];
}
```

---

## Storage Contract

- **Directory**: `.redbyte/agent/runs/hq/packets/`
- **Format**: one `.json` file per packet
- **Naming**: `{type}-{timestamp}-{6-char-hash}.json`
- **Gitignored**: yes — this is a generated output directory
- **No database**: simple file-per-packet JSON store
- **Limit for UI**: display latest 20 packets; older packets remain on disk
- **Retention**: manual; no automatic purge in v1

---

## Trust Rules

1. Packets are generated evidence, not canonical truth.
2. Repo docs (`docs/`) always override packet content on product facts.
3. Evidence level and source confidence from packets are advisory only.
4. Packets marked `requiresApproval: true` must not be applied without review.
5. Degraded packets (Ollama offline) must be clearly labelled.
6. Packet IDs are sanitized; path traversal is blocked at read time.

---

## UI Rules

- Show latest 10–20 packets in a compact "Workbench History" panel.
- Display: type chip, title, createdAt (relative), evidenceLevel, sourceConfidence, warning count, generated file count.
- Click a packet to preview its summary and sources.
- Do not redesign the main Marcus console.
- Empty state: "No saved packets yet."
- Add a small "Saved" indicator after a successful Marcus response saves a packet.

---

## Out of Scope (v1)

- Obsidian writeback
- Cloud sync
- Full-text search across packets
- Deletion endpoint (packets age out manually)
- Packet editing
- Cross-session tagging UI
