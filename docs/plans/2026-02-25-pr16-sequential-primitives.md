# PR16 — Sequential Primitives: DLatch, TFlipFlop, JKFlipFlop VHDL

Date: 2026-02-25
Author: Connor Angiel
Scope: Add DLatch + TFlipFlop node types; fix JKFlipFlop VHDL export and verify routing

---

## Motivation

Lab 6 (Latches and Flip-Flops) is the gateway lab to Labs 7–8 and requires four sequential
elements: D latch, D flip-flop, T flip-flop, and JK flip-flop. RedByte currently provides
only `DFlipFlop`. `JKFlipFlop` exists in the composite model but is missing VHDL export
and verify output routing. `DLatch` and `TFlipFlop` do not exist.

---

## File Touch List

| File | Change |
|---|---|
| `packages/rb-logic-core/src/composite-defs.ts` | Add `DLatchDef` |
| `packages/rb-logic-core/src/builtins.ts` | Add `TFlipFlopBehavior` |
| `packages/rb-logic-core/src/index.ts` | Export + register `DLatchDef` and `TFlipFlopBehavior` |
| `packages/rb-logic-core/src/analysis/nodeMetaRegistry.ts` | Add `DLatch`, `TFlipFlop` entries |
| `packages/rb-logic-core/src/CircuitEngine.ts` | Add `DLatch`, `TFlipFlop` to `memoryTypes` |
| `packages/rb-apps/src/components/ComponentPalette.tsx` | Add `DLatch`, `TFlipFlop` palette entries |
| `packages/rb-apps/src/export/vhdlExport.ts` | Add VHDL generation for `JKFlipFlop`, `DLatch`, `TFlipFlop`; update `SUPPORTED_LOGIC_TYPES`; update `deriveSignalName` |
| `packages/rb-lab-engine/src/verification/verifyTruthTable.ts` | Widen Q-port routing to all sequential types |
| `packages/rb-logic-core/src/composite.test.ts` | Add DLatch transparency/hold tests |
| `packages/rb-logic-core/src/sequential.test.ts` | New file: TFlipFlop and JKFlipFlop behavioral tests |
| `packages/rb-apps/src/examples/21_lab6-flipflop-starter.json` | Pre-place all 4 element types unconnected |
| `packages/rb-apps/src/examples/24_dlatch-example.json` | New: DLatch with EN toggling |
| `packages/rb-apps/src/examples/25_tff-example.json` | New: TFF divide-by-2 |

---

## Implementation Detail

### 1. DLatchDef (composite-defs.ts)

Same 4-NAND circuit as `DFlipFlopDef`. Only the input mapping changes:
- `EN` maps to `clk_in.isOn` (was `CLK` in DFlipFlop)
- `D` maps to `d_in.isOn`
- Outputs: `Q` from `nand3.out`, `Q_inv` from `nand4.out`

The structural circuit is identical. The port renaming makes the pedagogical distinction
(level-enable vs. clock) explicit in the UI and in student mental models.

### 2. TFlipFlopBehavior (builtins.ts)

Behavioral node — does not use composite subcircuit. State tracks `{ q, lastClk }`.

```typescript
export const TFlipFlopBehavior: NodeBehavior = {
  evaluate(inputs, state) {
    const t   = (inputs.T   ?? 0) as number;
    const clk = (inputs.CLK ?? 0) as number;
    const lastClk = (state.lastClk ?? 0) as number;
    let q = (state.q ?? 0) as number;

    // Rising edge detection
    if (lastClk === 0 && clk === 1) {
      if (t === 1) q = q === 0 ? 1 : 0; // toggle
    }

    return {
      outputs: { Q: q as Signal, out: q as Signal },
      state: { q, lastClk: clk },
    };
  },
};
```

Both `Q` and `out` are emitted for compatibility with downstream port resolution.

### 3. index.ts registrations

```typescript
// In exports:
export { DLatchDef } from './composite-defs';
export { TFlipFlopBehavior } from './builtins';

// In auto-register section:
import { DLatchDef } from './composite-defs';
import { TFlipFlopBehavior } from './builtins';

registerCompositeNode(DLatchDef);
NodeRegistry.register('TFlipFlop', TFlipFlopBehavior);
```

### 4. nodeMetaRegistry.ts additions

```typescript
DLatch: {
  isSequential: true,
  clockPort: "EN",
  note: "level-sensitive D latch; transparent when EN=1",
},
TFlipFlop: {
  isSequential: true,
  clockPort: "CLK",
  note: "edge-triggered toggle flip-flop; Q toggles on rising CLK when T=1",
},
```

### 5. CircuitEngine.ts — memoryTypes

Add `'DLatch'` and `'TFlipFlop'` to the `memoryTypes` Set in `detectCombinationalLoop()`.

```typescript
const memoryTypes = new Set(['Delay', 'DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch', 'Counter4Bit']);
```

### 6. ComponentPalette.tsx — palette entries

In the `COMPONENTS` array, add after `DFlipFlop`:
```typescript
{ type: 'DLatch',    name: 'D Latch',      description: 'Level-sensitive latch, transparent when EN=1', Icon: LatchIcon,   category: 'Advanced', color: '#f87171' },
{ type: 'TFlipFlop', name: 'T Flip-Flop',  description: 'Toggle flip-flop, Q flips on rising CLK when T=1', Icon: FlipFlopIcon, category: 'Advanced', color: '#a78bfa' },
```

### 7. vhdlExport.ts additions

**In `SUPPORTED_LOGIC_TYPES`:**
```typescript
const SUPPORTED_LOGIC_TYPES = new Set([
  'AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR',
  'FullAdder', 'MUX4', 'DFlipFlop',
  'DLatch', 'TFlipFlop', 'JKFlipFlop',   // PR16
]);
```

**In `deriveSignalName` prefix map:**
```typescript
DFlipFlop: 'dff',
DLatch:    'dlatch',
TFlipFlop: 'tff',
JKFlipFlop: 'jkff',
```

**DLatch VHDL block** (inserted after DFlipFlop block):
```vhdl
process (EN, D)
begin
  if EN = '1' then
    Q <= D;
  end if;
end process;
```
Signal map: `${node.id}:Q` and `${node.id}:out` → `sigName`.

**TFlipFlop VHDL block:**
```vhdl
process (CLK)
begin
  if rising_edge(CLK) then
    if T = '1' then
      sigName <= not sigName;
    end if;
  end if;
end process;
```
Signal map: `${node.id}:Q` and `${node.id}:out` → `sigName`.

**JKFlipFlop VHDL block:**
```vhdl
process (CLK)
begin
  if rising_edge(CLK) then
    if J = '1' and K = '0' then
      sigName <= '1';
    elsif J = '0' and K = '1' then
      sigName <= '0';
    elsif J = '1' and K = '1' then
      sigName <= not sigName;
    end if;
  end if;
end process;
```
Signal map: `${node.id}:Q`, `${node.id}:Q_inv`, `${node.id}:out` → `sigName` / `sigName_inv`.

### 8. verifyTruthTable.ts fix

Replace the single-type check with a set membership check:
```typescript
const SEQUENTIAL_Q_TYPES = new Set(['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch']);
const portName = SEQUENTIAL_Q_TYPES.has(nodeType) ? 'Q' : 'out';
```

### 9. Tests

**composite.test.ts — DLatch block:**
- EN=0, D=1 → Q holds at 0 (initial state)
- EN=1, D=1 → Q=1 (transparent)
- EN=1, D=0 → Q=0 (transparent)
- EN=0 after D changes → Q still holds last value

**sequential.test.ts — TFlipFlop block:**
- T=0, CLK: 0→1 → Q unchanged (hold)
- T=1, CLK: 0→1 → Q toggles (0→1)
- T=1, CLK: 1→0 → Q unchanged (no edge)
- T=1, CLK: 0→1 again → Q toggles back (1→0)

**sequential.test.ts — JKFlipFlop block:**
- J=0, K=0, CLK: 0→1 → Q holds
- J=0, K=1, CLK: 0→1 → Q=0 (reset)
- J=1, K=0, CLK: 0→1 → Q=1 (set)

---

## Acceptance Criteria

- [ ] `DLatch` draggable from palette; EN=1 makes Q follow D; EN=0 holds Q
- [ ] `TFlipFlop` draggable from palette; T=1 + CLK rising edge toggles Q
- [ ] `JKFlipFlop` already in palette; VHDL export no longer warns/skips it
- [ ] All 3 new types appear in exported VHDL with correct process blocks
- [ ] `verifyTruthTable` routes Q port correctly for all 5 sequential types
- [ ] Lab 6 starter pre-places all 4 elements (DLatch, DFF, TFF, JKFF)
- [ ] `pnpm build` exits 0, no TypeScript errors
- [ ] All new unit tests pass

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| DLatch composite def oscillates (EN=1, D toggles rapidly) | Low | Transparent latch stabilizes correctly; same behavior as existing DFlipFlop |
| TFlipFlop behavioral node receives no CLK input in verify | Low | Default inputs.CLK=0; lastClk=0; no rising edge fires; Q=0 (safe default) |
| JKFlipFlop J=K=1 toggle in simulation produces oscillation | Medium | Note in docs; verify vectors should not test J=K=1 in simulation phase; VHDL phase handles toggle correctly |
| VHDL TFlipFlop uses `not sigName` — signal assigned in same process | Low | Standard VHDL pattern; Vivado synthesis handles self-referencing flip-flop signals correctly |
| `.js` sibling files out of sync (per AGENTS.md JS mirror policy) | Medium | Check for `.js` siblings of modified `.ts` files; update if present |

---

## Definition of Done

1. All files in touch list modified
2. `pnpm build` clean
3. Unit tests pass
4. Lab 6 starter JSON shows all 4 elements on canvas when opened in RedByte
5. AI_STATE.md updated with Change Log entry
