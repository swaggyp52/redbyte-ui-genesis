# Product hardening: human trace labels + signal relationship (2026-04-22)

## Context (Design Phase 10)

Students can highlight full nets and read composite/sequential identity, but **trace state copy** still read like engineering (`Fanin to node.port`, `Fanout from nodeId`, `Net node.out`). That hides **meaning**: what drives a pin, what a source fans out to, and that wire selection shows **one net**.

## Runtime scenarios (evidence)

| # | Flow | Student goal | What was wrong | What we want instead |
|---|------|----------------|----------------|------------------------|
| A | Fanout from a switch/input | “Where does this go?” | Banner: `Fanout from sw0_node` | Plain: what this part **drives** + that paths are highlighted |
| B | Trace net into a load (Trace / port) | “What feeds this input?” | `Fanin to ld0_node.in` | Sentence: **feeds** + part name (Map Pins / label) + port |
| C | One wire selected (auto net) | “Is this the same signal?” | `Net sw0_node.out` | `One net: **SW0** · out — every segment…` |
| D | Verify/Debug linked signal | Relate to Verify | `Verify focus ld0_node.in` | Same pattern: **what drives** named part + port |

## Blocker register (max 5)

1. **Critical — Trace banners used raw `nodeId.port` and “Fanin / Fanout / Net” jargon**  
   **Workflow:** any trace (manual Trace net, Trace →, wire selection, verify/debug).  
   **Root cause:** `setTraceState({ label: ... })` used internal identifiers.  
   **Action:** `formatTracePartName` + `buildStudent*` helpers; Map Pins / labels first, type+id fallback.

2. **High — No single vocabulary for “source vs destination”**  
   **Partially addressed** by “What X drives” vs “What feeds Y”.

3. **Medium — Inspector “Fanout” stat row (eval order strip)** still the word *Fanout* — **out of this slice** (next polish).

4. **Medium — `describeNodeConnectionSummary.incomingLabel` still has `2 upstream sources`** — optional follow-up.

5. **Lower — multi-wire selection net story** (backlog; not this slice).

## Chosen single fix (this slice)

**#1** — Replace all **trace `label`** strings (fan-in, fan-out, wire net, verify, debug) with **student phrasing** and **resolved part names** via `ioRowByNodeId` + `formatTracePartName`.

## Files touched

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` (helpers + `handlePortClick` / `handleFanoutTrace` placement + effects + `applyWireNetTraceForWireId`)
- Tests: `designSurface.fanout.test.tsx`, `designSurface.workstation.test.tsx`

## Validation

- Focused vitest (fanout + workstation)
- `pnpm build:unified`
