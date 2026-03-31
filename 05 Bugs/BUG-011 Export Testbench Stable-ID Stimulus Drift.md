---
type: bug
status: fixed
area: export
priority: critical
source: manual-debug
updated: 2026-03-30
related:
  - "[[Export Contracts]]"
  - "[[Connection Model]]"
---

# BUG-011 Export Testbench Stable-ID Stimulus Drift

## Summary

Entity-based Basys3 export could generate a `testbench.vhd` whose component and signal declarations matched `top.vhd`, while its stimulus and assertion lines still emitted raw stable vector ids such as `input_1` and `output_1`, causing Vivado compile failure.

## Root Cause

The entity-based path in `testbenchGenerator.ts` only resolved vector keys through IO labels. When Verify or project vectors used stable row ids or node ids, especially in flows where student-facing labels collided (`Input 1`, `Input 1`), the generator fell back to raw keys instead of entity refs. The existing consistency guard only compared component ports against entity ports, so broken stimulus/assertion targets were not blocked.

## System Truth

Entity-based `testbench.vhd` must treat the generated entity port list as naming authority and resolve scenario/project vector keys through stable ids, node ids, canonical `nodeId_port` names, unique labels, and Basys3 alias or package-pin hints before emitting VHDL. Export must reject any stimulus or assertion target that is undeclared or points at the wrong entity-port direction.

## Fix

- Expanded the entity-based resolver to derive refs from stable ids, node ids, canonical `nodeId_port` names, unique labels, and Basys3 pin aliases/package pins.
- Strengthened artifact consistency validation so undeclared or direction-invalid stimulus/assertion targets block export.
- Applied the same consistency guard to the runtime-backed testbench path used by the live Export surface.
- Revalidated the live browser export and confirmed the post-fix `testbench.vhd` compiles under Vivado `xvhdl`.

## Links

- [[Export Contracts]]
- [[Connection Model]]