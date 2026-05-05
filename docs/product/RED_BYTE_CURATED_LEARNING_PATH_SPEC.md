---
doc_status: current
used_by_claude: true
last_validated: 2026-05-05
scope: product
---

# RedByte Curated Learning Path — Specification

> **Purpose:** Define the guided student path through existing RedByte examples and lab starters.
> This is a curation spec — it does not add new circuits. All referenced example IDs must already exist in `examplesCatalog.ts` or `labStarters.ts`.

---

## 1. Path Overview

```
Tier 1 (Showcase — combinational)
  └─ logic-gates            AND / OR / XOR truth table
  └─ half-adder             Combinational sum + carry
  └─ full-adder             3-input carry chain

Tier 2 (Showcase — hardware mapping)
  └─ signal-tour            Switch → LED passthrough, board mapping intro

Tier 3 (Showcase — sequential)
  └─ two-bit-counter        CLK100MHZ counter (E3 proof open — note below)

Tier 4 (Lab bridge — FSM)
  └─ lab8-security-lock-fsm Full digital lock reference
  └─ 23_lab8-fsm-lock-starter-basys3  Student bridge scaffold
```

---

## 2. Entries

### 2.1 `logic-gates` — Logic Gates: AND / OR / XOR

| Field | Value |
|-------|-------|
| **Catalog ID** | `logic-gates` |
| **Category** | showcase |
| **Difficulty** | intro |
| **Concepts** | Combinational logic, truth tables, binary inputs |
| **Verify ready** | Yes — 4 vectors (full 2-input truth table) |
| **Export ready** | Draft only — no hardware mapping defined in example |
| **Flagship** | No |

**Student summary:**
Build three gates from two switches. Run the full truth table. Every output must match the expected column before moving on.

**Learning goals:**
1. Understand AND, OR, XOR as functions of two binary inputs.
2. Read a truth-table vector result in the Verify surface.
3. Identify a failing vector and trace which gate is wrong.

**Common mistake:** Wiring OR output to the wrong LED and then not reading the Verify diff carefully.

**Next step after this:** `half-adder` — introduces a multi-output combinational circuit.

---

### 2.2 `half-adder` — Half Adder

| Field | Value |
|-------|-------|
| **Catalog ID** | `half-adder` |
| **Category** | showcase |
| **Difficulty** | intro |
| **Concepts** | Sum, carry, combinational arithmetic |
| **Verify ready** | Check `examplesCatalog.ts` — vectors must cover all 4 input combos |
| **Export ready** | Draft only unless hardware mapping added |
| **Flagship** | No |

**Student summary:**
Wire two inputs through an XOR (sum) and AND (carry). Verify all four input combinations produce the correct sum and carry.

**Learning goals:**
1. See how carry propagates in binary addition.
2. Understand why XOR gives sum and AND gives carry.
3. Match a two-output circuit against a structured truth table.

**Common mistake:** Swapping sum and carry outputs — easy to see in Verify because one column passes and the other fails entirely.

**Next step after this:** `full-adder` — adds a third input (carry-in) and requires chaining.

---

### 2.3 `full-adder` — Full Adder

| Field | Value |
|-------|-------|
| **Catalog ID** | `full-adder` |
| **Category** | showcase |
| **Difficulty** | intro–intermediate |
| **Concepts** | Carry-in, carry-out, combinational arithmetic |
| **Verify ready** | Check `examplesCatalog.ts` — vectors must cover all 8 input combos |
| **Export ready** | Draft only unless hardware mapping added |
| **Flagship** | No |

**Student summary:**
Extend the half adder with a carry-in input. Three inputs, two outputs. Prove all eight combinations before exporting.

**Learning goals:**
1. Understand how a carry ripple works in multi-bit addition.
2. Chain combinational blocks (two half adders + OR for carry-out).
3. Use Verify to catch a missing carry-out path.

**Common mistake:** Forgetting the OR gate that combines the two carry outputs from the half-adder chain.

**Next step after this:** `signal-tour` — introduces hardware mapping on the Basys3.

---

### 2.4 `signal-tour` — Signal Tour: Switches → LEDs ⭐ Flagship

| Field | Value |
|-------|-------|
| **Catalog ID** | `signal-tour` |
| **Category** | showcase |
| **Difficulty** | intro |
| **Concepts** | Pin mapping, hardware trust, passthrough circuits |
| **Verify ready** | Yes — vectors defined for SW0–SW3 passthrough |
| **Export ready** | Trusted — hardware mapping defined, Verify evidence required |
| **Flagship** | **Yes — first example to introduce board mapping and export** |

**Student summary:**
Four switches drive four LEDs directly. Map each port to its Basys3 pin in the Hardware surface. Run Verify. Export only after Compare passes.

**Learning goals:**
1. Understand the Design → Verify → Hardware → Export spine in a complete, simple circuit.
2. Map `SW{N}` and `LD{N}` ports to physical Basys3 pins using XDC names.
3. Distinguish Draft Export (artifact ready) from Trusted Export (Verify Compare PASS + current mapping).
4. See what a NEEDS REVIEW chip means and follow its fix path.

**Common mistake:** Exporting before running Verify Compare — produces a Draft Export without evidence.

**Next step after this:** `two-bit-counter` — introduces sequential logic and the board clock.

---

### 2.5 `two-bit-counter` — 2-Bit Up Counter (Basys3)

| Field | Value |
|-------|-------|
| **Catalog ID** | `two-bit-counter` |
| **Category** | showcase |
| **Difficulty** | intermediate |
| **Concepts** | Sequential logic, D flip-flops, board clock, waveforms |
| **Verify ready** | E1/E2 ready; **E3 proof open** (see note) |
| **Export ready** | Draft only until E3 passes |
| **Flagship** | No |

**⚠ Open proof:** E3 (waveform/board-clock path) is not yet closed. Do not present this as fully trusted until `RED_BYTE_CURRENT_TRUTH.md` marks E3 complete.

**Student summary:**
A two-bit counter driven by the 100 MHz board clock. Use SW0 as enable and BTNC as reset. Watch Q0 and Q1 toggle in the Verify waveform view.

**Learning goals:**
1. Connect a board clock (`CLK100MHZ` / pin `W5`) to a sequential circuit.
2. Understand how D flip-flops store and advance state on each clock edge.
3. Use the waveform view in Verify to trace sequential state changes.
4. Distinguish mapped hardware (pins assigned) from verified trust (Verify Compare PASS).

**Common mistake:** Connecting a switch as the clock instead of `CLK100MHZ` — the counter will appear to work manually but will not synthesize correctly.

**Next step after this:** `lab8-security-lock-fsm` / `23_lab8-fsm-lock-starter-basys3` — FSM design.

---

### 2.6 `23_lab8-fsm-lock-starter-basys3` — ECE141 Security Lock Starter (Lab 8 Bridge)

| Field | Value |
|-------|-------|
| **Catalog ID** | `23_lab8-fsm-lock-starter-basys3` |
| **Lab starter ID** | `lab8-security-lock-fsm` |
| **Category** | course |
| **Difficulty** | advanced |
| **Concepts** | FSM, sequential logic, milestone tracking, digital lock |
| **Verify ready** | Yes — invalid and valid sequence vectors defined |
| **Export ready** | After student completes scaffold and passes Verify |
| **Flagship** | No |

**Student summary:**
A scaffold with the key subsystems pre-labeled but not fully wired: bit/window capture, valid-group detection, milestone tracking, and LOCK output. Build one subsystem at a time. Use ENTER (SW5) as the manual clock and RESET (SW4) as clear for every flip-flop. Run the invalid sequence check first, then the valid sequence check.

**Learning goals:**
1. Design a finite state machine from a behavioral description (3-bit groups, 4-milestone unlock).
2. Use ENTER as a manual clock to step through state transitions and check them in Verify.
3. Separate subsystem concerns: bit counting, valid-group detection, milestone advancement, output.
4. Prove FSM correctness with structured Verify vectors before exporting to Vivado.

**Common mistake:** Wiring ENTER as a data input instead of CLK on every flip-flop — the FSM will not advance on button press.

**Next step after this:** Full Lab 8 final project reference package (external to RedByte).

---

## 3. Proof Status Summary

| Example | E1 | E2 | E3 | Export |
|---------|----|----|-----|--------|
| `logic-gates` | ? | ? | n/a | Draft |
| `half-adder` | ? | ? | n/a | Draft |
| `full-adder` | ? | ? | n/a | Draft |
| `signal-tour` | ✅ | ✅ | n/a | Trusted (with Verify) |
| `two-bit-counter` | ✅ | ✅ | ❌ open | Draft until E3 closed |
| `23_lab8-fsm-lock-starter-basys3` | ✅ | ✅ | n/a | After student completes |

`?` = not yet audited against current proof matrix. Must be verified against `examplesCatalog.ts` vectors before marking trusted.

---

## 4. Implementation Plan (for follow-on slice)

The purpose of this spec is to define **what the path should be**. Implementing it means adding short curation metadata to the example definitions. That is a separate slice.

### Candidate files to edit (follow-on slice only)

| File | Change |
|------|--------|
| `packages/rb-apps/src/apps/ide/examplesCatalog.ts` | Add `learningPath` metadata field (order, tier, nextExample) per entry |
| `packages/rb-apps/src/apps/ide/labStarters.ts` | Add `learningGoals` array to each starter if not present |
| `docs/STUDENT_RELEASE_READINESS.md` | Update E1/E2/E3 columns for `logic-gates`, `half-adder`, `full-adder` after audit |

### Constraints for that slice

- Do not add new examples if existing ones cover the concept.
- Do not add copy that promises Trusted Export without Verify evidence.
- Run `pnpm -w exec vitest run examplesCatalog` and `pnpm rb:doc:validate` before committing.
- Commit: `docs(redbyte): update current truth layer` or `feat(examples): add learning path metadata`.

---

## 5. References

- `packages/rb-apps/src/apps/ide/examplesCatalog.ts` — example definitions (source of truth)
- `packages/rb-apps/src/apps/ide/labStarters.ts` — lab starter definitions
- `docs/STUDENT_RELEASE_READINESS.md` — certification tier matrix (E1/E2/E3)
- `docs/product/RED_BYTE_CURRENT_TRUTH.md` — live proof status
- `docs/product/RED_BYTE_WORK_QUEUE.md` — queue item 6 (this spec closes it)
