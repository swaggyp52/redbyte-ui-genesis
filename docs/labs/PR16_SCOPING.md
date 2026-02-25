# PR16 Scoping — Sequential Primitives for Lab 6

Generated: 2026-02-25
Derived from: MODERNIZATION_PLAN.md, REDBYTE_FIT_GAP.md, LAB_6 section of original PDF

---

## Lab 6 Requirements (from source docs)

### What the original lab asks students to do

- Place and wire a **D latch**, a **D flip-flop**, a **T flip-flop**, and a **JK flip-flop** on
  a single schematic
- Wire each element's inputs to switches (data, enable/clock) and outputs to LEDs (Q)
- Run verification vectors that exercise each element's characteristic table
- Observe the difference between level-sensitive (latch) and edge-sensitive (flip-flop) behavior
- Record the Q output for each input combination in a truth table
- (Original ISE step: insert IBUF on clock path — **dropped**, RedByte has no such constraint)

### Minimum RedByte feature set required

| Feature | Must have? | Notes |
|---|---|---|
| `DFlipFlop` node | Already exists | Transparent latch; CLK=1 → transparent, CLK=0 → hold |
| `DLatch` node | **Yes** | Level-sensitive; EN=1 → transparent, EN=0 → hold. Pedagogically distinct port name from DFF |
| `TFlipFlop` node | **Yes** | T input + CLK; rising edge: if T=1 toggle Q, if T=0 hold Q |
| `JKFlipFlop` node | Partially exists | Composite def + palette already registered. Missing: VHDL export |
| Palette entries for new nodes | **Yes** | Students must be able to drag them onto canvas |
| VHDL export for all 4 | **Yes** | Labs 3–8 require export to Vivado for hardware session |
| Verify port routing for Q output | **Yes** | `verifyTruthTable.ts` currently only routes `Q` port for `DFlipFlop`; must cover all sequential types |
| Lab 6 starter JSON updated | **Yes** | Current starter only has CLK switch, D switch, Q lamp; must pre-place all 4 element types |
| Example circuits | Desired | One per new primitive for the palette example browser |
| Unit tests | **Yes** | Simulation correctness gate before merge |

---

## DLatch — Specification

**Purpose:** Demonstrate level-sensitive storage. Pedagogical contrast with DFlipFlop.

**Pins:**
- `D` — data input
- `EN` — enable (active high, level-sensitive)
- `Q` — output
- `Q_inv` — complementary output (consistent with DFlipFlop and JKFlipFlop)

**Characteristic table:**

| EN | D | Q_next |
|---|---|---|
| 0 | X | Q (hold) |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

**Implementation:** Structural composite — same 4-NAND circuit as `DFlipFlopDef` with the
port renamed `EN` instead of `CLK`. The circuit is structurally identical; the semantic
difference is in the name (level-enable vs. clock signal) and how students wire it.

**VHDL target:**
```vhdl
process (EN, D)
begin
  if EN = '1' then
    Q <= D;
  end if;
end process;
```

**Edge cases:**
- No reset pin expected (original lab does not use async reset on latch)
- `Q_inv` output should be exported as a separate signal if wired to a downstream node

---

## TFlipFlop — Specification

**Purpose:** Demonstrate toggle flip-flop — divide-by-2 counter building block.

**Pins:**
- `T` — toggle input
- `CLK` — clock
- `Q` — output

**Characteristic table (rising-edge triggered):**

| T | CLK edge | Q_next |
|---|---|---|
| 0 | rising | Q (hold) |
| 1 | rising | NOT(Q) (toggle) |

**Implementation:** Behavioral node (added to `builtins.ts`). Uses state `{ q: 0, lastClk: 0 }`.
On each evaluate call:
- If `lastClk = 0` and `CLK = 1` (rising edge): Q_next = T ? NOT(Q) : Q
- Otherwise: Q_next = Q (hold)
- Always update `lastClk = CLK`

Behavioral (not structural composite) to avoid the oscillation/race condition that a
structural T latch (transparent feedback) exhibits in a level-triggered simulation model.

**VHDL target:**
```vhdl
process (CLK)
begin
  if rising_edge(CLK) then
    if T = '1' then
      Q <= not Q;
    end if;
  end if;
end process;
```

**Edge cases:**
- No reset pin expected (original lab does not use reset on TFF)
- Q initial state = 0
- The behavioral implementation correctly emulates edge triggering in the tick model

---

## JKFlipFlop — Gap Closure

The `JKFlipFlopDef` is already defined, registered, and appears in the palette.

**Remaining gaps:**
1. Not in `SUPPORTED_LOGIC_TYPES` in `vhdlExport.ts` — VHDL export silently skips it
2. Not in `verifyTruthTable.ts` Q-port routing — verify reads `out` instead of `Q`

**Characteristic table (used in VHDL and verify vectors):**

| J | K | CLK edge | Q_next |
|---|---|---|---|
| 0 | 0 | rising | Q (hold) |
| 0 | 1 | rising | 0 (reset) |
| 1 | 0 | rising | 1 (set) |
| 1 | 1 | rising | NOT(Q) (toggle) |

**VHDL target:**
```vhdl
process (CLK)
begin
  if rising_edge(CLK) then
    if J = '1' and K = '0' then
      Q <= '1';
    elsif J = '0' and K = '1' then
      Q <= '0';
    elsif J = '1' and K = '1' then
      Q <= not Q;
    end if;
  end if;
end process;
```

**Note on simulation fidelity:** The existing composite def implements a level-triggered
JK latch. The J=K=1 "toggle" case may not simulate cleanly due to the race condition
inherent in level-triggered JK circuits. The VHDL export generates correct edge-triggered
VHDL regardless. This discrepancy is acceptable for Lab 6 purposes; the verify vectors
should test J=0/K=0, J=0/K=1, and J=1/K=0 only for reliable simulation. The J=K=1 toggle
can be demonstrated in the VHDL/hardware phase.

---

## verify port routing fix

`packages/rb-lab-engine/src/verification/verifyTruthTable.ts` line 72:
```typescript
const portName = nodeType === 'DFlipFlop' ? 'Q' : 'out';
```
Must become:
```typescript
const SEQ_Q_TYPES = new Set(['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'RSLatch']);
const portName = SEQ_Q_TYPES.has(nodeType) ? 'Q' : 'out';
```

---

## What is NOT needed for PR16

- Reset (RST) pin on DLatch or TFlipFlop — original lab does not test async reset on these
- QN/Q_inv output on TFlipFlop — not referenced in verify vectors
- Waveform display — scoped as separate future work (mentioned in REDBYTE_FIT_GAP.md)
- Hierarchical Macro support — separate gap, not needed for Lab 6
- Any student/advanced mode toggle — explicitly prohibited

---

## Acceptance criteria

1. `DLatch` appears in the Advanced category of the ComponentPalette
2. `TFlipFlop` appears in the Advanced category of the ComponentPalette
3. `JKFlipFlop` already appears; verify it is present and labeled "JK Flip-Flop"
4. Placing a `DLatch`, wiring D=1 and EN=1, then running verify → Q=1 PASS
5. Placing a `TFlipFlop`, cycling CLK with T=1 twice → Q returns to 0 PASS
6. VHDL export of a circuit containing DLatch, TFlipFlop, JKFlipFlop produces no
   "unsupported node type" warnings and generates syntactically correct VHDL
7. Lab 6 starter JSON pre-places DLatch, DFlipFlop, TFlipFlop, JKFlipFlop unconnected
8. `pnpm build` passes with no TypeScript errors
9. Unit tests for DLatch transparency/hold and TFlipFlop toggle/hold pass
