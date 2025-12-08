# ADR-0003: Circuit Serialization Schema Versioning

**Status:** Accepted
**Date:** 2025-12-08
**Deciders:** Engineering Team
**Context:** Genesis v1 Architecture

---

## Context

Circuits need to be:
1. **Saved** to localStorage for persistence
2. **Loaded** from saved files
3. **Shared** via URL-encoded strings
4. **Exported** to `.rblogic` JSON files
5. **Imported** from user-provided files

Requirements:
- **Forward compatibility**: v1 app SHOULD load v2 circuits (gracefully degrade unknown features)
- **Backward compatibility**: v2 app MUST load v1 circuits
- **Error recovery**: Malformed data should not crash the app
- **Schema evolution**: New node types, properties, or features in future versions

We need a **versioning strategy** that allows:
- Schema changes without breaking existing saved circuits
- Clear migration paths for users
- Simple deserialization logic

---

## Decision

We adopt **explicit schema versioning** with the following design:

### 1. Schema Version Field

All serialized circuits include a `version` field:

```typescript
interface SerializedCircuitV1 {
  version: '1'; // Explicit version string
  nodes: Node[];
  connections: Connection[];
}
```

**Version Format**: String literal (NOT number)
- `'1'` for Genesis v1
- `'2'` for future releases
- Allows semantic versions like `'2.1'` if needed

### 2. Deserialization with Version Check

```typescript
function deserialize(data: any): Circuit {
  if (!data.version) {
    throw new Error('Missing schema version');
  }

  if (data.version === '1') {
    return deserializeV1(data as SerializedCircuitV1);
  }

  if (data.version === '2') {
    return deserializeV2(data as SerializedCircuitV2);
  }

  throw new Error(`Unsupported schema version: ${data.version}`);
}
```

### 3. Node Type Registry

Node types are registered globally at app startup:

```typescript
NodeRegistry.register('PowerSource', PowerSourceBehavior);
NodeRegistry.register('Switch', SwitchBehavior);
NodeRegistry.register('Lamp', LampBehavior);
// ... etc
```

**Unknown node types** are handled gracefully:

```typescript
const behavior = NodeRegistry.get(node.type);
if (!behavior) {
  console.warn(`Unknown node type: ${node.type}, using placeholder`);
  return PlaceholderBehavior; // Renders as gray box with "?"
}
```

### 4. Composite Node Versioning

Composite nodes (RSLatch, DFlipFlop, etc.) are stored **as-is** in the schema:

```json
{
  "version": "1",
  "nodes": [
    {
      "id": "node1",
      "type": "RSLatch",
      "position": { "x": 100, "y": 100 }
    }
  ],
  "connections": []
}
```

**Rationale**: Composite nodes are first-class types in `NodeRegistry`, not expanded sub-circuits.

**Alternative considered**: Store expanded sub-circuits (e.g., RSLatch → 2 NOR gates + wiring).
**Rejected**: Too verbose, loses semantic meaning, harder to debug.

---

## Alternatives Considered

### Alternative 1: No Versioning (Implicit Schema)

**How it works:**
- No `version` field
- Assume data structure matches current app version

**Pros:**
- Simpler schema (fewer fields)

**Cons:**
- No way to detect incompatible data
- Breaking changes force all users to re-export circuits
- Poor error messages ("undefined is not a function")

**Rejected:** Unacceptable UX for data corruption.

### Alternative 2: Semantic Versioning (MAJOR.MINOR.PATCH)

**How it works:**
- Version field is `"1.0.0"`, `"1.1.0"`, etc.
- MAJOR = breaking changes
- MINOR = backward-compatible additions
- PATCH = bug fixes (no schema changes)

**Pros:**
- Familiar convention
- Clear upgrade path

**Cons:**
- Overkill for v1 (no planned minor/patch schema changes)
- String parsing complexity (`version.split('.')`)

**Rejected:** Simple string version is sufficient for Genesis v1.

### Alternative 3: Migration Functions

**How it works:**
- Each schema version has a migration function
- v1 → v2 migration transforms data structure
- Chained migrations: v1 → v2 → v3

**Pros:**
- Explicit upgrade path
- Can transform data automatically

**Cons:**
- Complex to maintain (N migrations for N versions)
- Risk of migration bugs
- Users may want to stay on older versions

**Rejected:** Too complex for v1. Revisit if we reach v3+.

---

## Consequences

### Positive

- **Clear versioning**: Users know which app version created a circuit
- **Graceful degradation**: Unknown node types render as placeholders (not crashes)
- **Future-proof**: Easy to add v2, v3 schemas
- **Error messages**: "Unsupported schema version: 2" is actionable

### Negative

- **No auto-migration**: Users must manually re-export circuits for new schema versions
- **Placeholder UX**: Unknown nodes show as "?" (not ideal, but prevents crashes)

### Neutral

- **Schema size**: Extra `version` field adds ~10 bytes per circuit (negligible)

---

## Implementation

### V1 Schema (Immutable)

```typescript
interface SerializedCircuitV1 {
  version: '1';
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    state?: Record<string, any>;
  }>;
  connections: Array<{
    from: string; // "nodeId:outputPin"
    to: string;   // "nodeId:inputPin"
  }>;
}
```

### Serialize Function

```typescript
function serialize(circuit: Circuit): SerializedCircuitV1 {
  return {
    version: '1',
    nodes: circuit.nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      state: node.state,
    })),
    connections: circuit.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
    })),
  };
}
```

### Deserialize Function

```typescript
function deserialize(data: any): Circuit {
  if (!data.version) {
    throw new Error('Missing schema version. Invalid circuit file.');
  }

  if (data.version !== '1') {
    throw new Error(
      `Unsupported schema version: ${data.version}. Please upgrade the app.`
    );
  }

  return deserializeV1(data as SerializedCircuitV1);
}

function deserializeV1(data: SerializedCircuitV1): Circuit {
  return {
    nodes: data.nodes.map(node => {
      const behavior = NodeRegistry.get(node.type);
      if (!behavior) {
        console.warn(`Unknown node type: ${node.type}`);
      }
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        state: node.state ?? {},
        behavior: behavior ?? PlaceholderBehavior,
      };
    }),
    connections: data.connections.map(conn => ({
      from: conn.from,
      to: conn.to,
    })),
  };
}
```

---

## Error Handling

### Missing Version Field

```json
{
  "nodes": [],
  "connections": []
}
```

**Error**: `"Missing schema version. Invalid circuit file."`

### Unsupported Version

```json
{
  "version": "99",
  "nodes": [],
  "connections": []
}
```

**Error**: `"Unsupported schema version: 99. Please upgrade the app."`

### Unknown Node Type

```json
{
  "version": "1",
  "nodes": [
    { "id": "node1", "type": "QuantumGate", "position": { "x": 0, "y": 0 } }
  ],
  "connections": []
}
```

**Behavior**:
- Console warning: `"Unknown node type: QuantumGate"`
- Node renders as placeholder (gray box with "?")
- Circuit still loads (no crash)

---

## Future Schema Evolution (V2 Example)

### V2 Schema (Hypothetical)

```typescript
interface SerializedCircuitV2 {
  version: '2';
  metadata: {
    name: string;
    author: string;
    created: number;
  };
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z?: number }; // NEW: 3D support
    state?: Record<string, any>;
  }>;
  connections: Array<{
    from: string;
    to: string;
    delay?: number; // NEW: Explicit wire delays
  }>;
}
```

### Backward Compatibility Strategy

**V2 app MUST load V1 circuits:**

```typescript
function deserialize(data: any): Circuit {
  if (data.version === '1') {
    return deserializeV1(data);
  }
  if (data.version === '2') {
    return deserializeV2(data);
  }
  throw new Error(`Unsupported schema version: ${data.version}`);
}
```

**Optional: Migration helper**

```typescript
function migrateV1toV2(v1: SerializedCircuitV1): SerializedCircuitV2 {
  return {
    version: '2',
    metadata: {
      name: 'Imported from V1',
      author: 'Unknown',
      created: Date.now(),
    },
    nodes: v1.nodes.map(node => ({
      ...node,
      position: { ...node.position, z: 0 }, // Add default Z
    })),
    connections: v1.connections.map(conn => ({
      ...conn,
      delay: 0, // Add default delay
    })),
  };
}
```

---

## Validation

### Unit Tests

```typescript
test('serialize creates valid v1 schema', () => {
  const circuit = createSimpleCircuit();
  const serialized = serialize(circuit);
  expect(serialized.version).toBe('1');
  expect(serialized.nodes).toBeDefined();
  expect(serialized.connections).toBeDefined();
});

test('deserialize loads v1 schema', () => {
  const v1Data: SerializedCircuitV1 = {
    version: '1',
    nodes: [{ id: 'lamp1', type: 'Lamp', position: { x: 0, y: 0 } }],
    connections: [],
  };
  const circuit = deserialize(v1Data);
  expect(circuit.nodes.length).toBe(1);
  expect(circuit.nodes[0].type).toBe('Lamp');
});

test('deserialize throws on missing version', () => {
  const invalid = { nodes: [], connections: [] };
  expect(() => deserialize(invalid)).toThrow('Missing schema version');
});

test('deserialize throws on unsupported version', () => {
  const future = { version: '99', nodes: [], connections: [] };
  expect(() => deserialize(future)).toThrow('Unsupported schema version: 99');
});

test('deserialize handles unknown node types gracefully', () => {
  const withUnknown: SerializedCircuitV1 = {
    version: '1',
    nodes: [{ id: 'unknown1', type: 'FutureGate', position: { x: 0, y: 0 } }],
    connections: [],
  };
  const circuit = deserialize(withUnknown);
  expect(circuit.nodes.length).toBe(1);
  expect(circuit.nodes[0].behavior).toBe(PlaceholderBehavior);
});
```

---

## References

- [JSON Schema Versioning Best Practices](https://json-schema.org/understanding-json-schema/reference/schema.html#id4)
- [Protobuf Versioning](https://protobuf.dev/programming-guides/proto3/#updating)
- [Semantic Versioning 2.0.0](https://semver.org/)

---

## Revisions

- **2025-12-08**: Initial ADR for Genesis v1
