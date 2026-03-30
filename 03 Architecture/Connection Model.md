---
type: architecture
status: active
area: export
updated: 2026-03-30
related:
  - "[[ADR-001 Enforce Structured Connection Format]]"
  - "[[BUG-001 Connection Fixture Format Mismatch]]"
  - "[[BUG-011 Export Testbench Stable-ID Stimulus Drift]]"
  - "[[Export Contracts]]"
  - "[[Verify Engine]]"
---

# Connection Model

**Package:** `rb-logic-core`, `rb-apps/src/export/projectFormat.ts`
**Status:** Stable — nested object shape is canonical and enforced by validator

---

## Canonical Shape

Every connection in the circuit graph uses:

```typescript
interface Connection {
  id?: string;
  from: PortRef;
  to: PortRef;
}

interface PortRef {
  nodeId: string;
  portName: string;
}
```

Example:
```typescript
{
  id: 'c0',
  from: { nodeId: 'sw0', portName: 'out' },
  to:   { nodeId: 'ld0', portName: 'in'  }
}
```

---

## Validator (`normalizeProjectConnection`)

Located in `packages/rb-apps/src/export/projectFormat.ts`.

`normalizePortRef(value, fallbackPortName, legacyPort, legacyPin, label)` handles three input shapes for backward compatibility during deserialization:

| Input shape | Handling |
|---|---|
| `from: 'nodeId'` (string) | Legacy — nodeId extracted from string; portName from `legacyPort` arg |
| `from: { nodeId, portName }` | Current — read directly |
| `from: undefined` or non-object | **Error thrown:** `"connection N source is missing"` |

> **Critical:** The flat shape `{ fromNodeId, fromPort }` is NOT supported at any layer. It was never a valid format in the project schema.

---

## Where Connections Are Created

- **Circuit store / canvas interactions** — always produce `{ from: { nodeId, portName } }`
- **`injectSimClock`** (`rb-logic-core`) — creates connections with nested shape
- **Test fixtures** — must use nested shape (see [[BUG-001 Connection Fixture Format Mismatch]])

---

## Where Connections Are Consumed

- `normalizeProjectCircuit` — validates on load/deserialize
- `analyzeSequentialLogic` — reads `conn.from.nodeId` / `conn.to.nodeId`
- `validateMultipleDrivers` (basys3ExportService) — reads `conn.to.nodeId`/`conn.to.portName`
- `buildDeterministicVerifyContext` — passes circuit to `elaborateCircuit`

---

## Multiple-Driver Detection

The export service validates that no destination port has more than one incoming connection:

```typescript
// key = "toNodeId.toPortName"
const driverCount = new Map<string, number>();
for (const conn of project.circuit.connections) {
  const key = `${conn.to.nodeId}.${conn.to.portName}`;
  driverCount.set(key, (driverCount.get(key) ?? 0) + 1);
}
```

Violations surface as `{ type: 'logic', severity: 'error' }` in constraint validation.

---

## Export Signal Identity Contract

The circuit connection shape is not enough on its own to keep export trustworthy. When Verify or project vectors are turned into `testbench.vhd`, those vector keys may arrive as:

- stable IO row ids
- boundary node ids
- canonical `nodeId_port` names
- unique student-facing labels

Entity-based testbench generation must translate those keys onto the declared entity refs before emitting stimulus or assertions.

Rules:

- duplicate student-facing labels are never authoritative lookup keys
- Basys3 aliases or package pins may be used to recover the entity ref when labels are blank or the entity is board-grouped (`SW`, `LED`)
- unresolved raw keys are an export consistency failure, not acceptable emitted VHDL

---

## Related

- [[ADR-001 Enforce Structured Connection Format]]
- [[BUG-001 Connection Fixture Format Mismatch]]
- [[BUG-011 Export Testbench Stable-ID Stimulus Drift]]
- [[Export Contracts]]
- [[Authority Chain]]
