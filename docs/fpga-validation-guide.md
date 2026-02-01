# FPGA Validation & Troubleshooting Guide

**Last Updated:** 2026-02-01  
**Status:** Phase 7 Complete

---

## Overview

RedByte Logic Playground includes comprehensive validation infrastructure to ensure exported Verilog HDL and constraints are synthesis-ready before hardware deployment. This guide covers validation rules, common issues, and troubleshooting steps.

## Validation Pipeline

### Export Workflow
When you run "Project: Export Verilog", RedByte performs these validation steps:

1. **Verilog Syntax Validation**
   - Check module structure (module/endmodule)
   - Verify port declarations (input/output)
   - Validate signal references
   - Check for syntax errors (parentheses, semicolons)

2. **Constraint Validation**
   - Match XDC constraints to circuit signals
   - Verify pin assignments for target board
   - Check timing constraints
   - Warn about unconstrained signals

3. **Readiness Scoring**
   - Calculate synthesis readiness (0-100%)
   - Errors: -20 points each
   - Warnings: -5 points each
   - Bonuses for proper structure

4. **Export Decision**
   - **Valid (0 errors)**: Export proceeds, score displayed
   - **Invalid (>0 errors)**: Export blocked, errors shown
   - **Warnings only**: Export proceeds with warnings

---

## Validation Rules

### Verilog Syntax Requirements

**Module Structure**
```verilog
✅ VALID:
module Counter (
  input wire clk,
  output wire [7:0] count
);
  // ... implementation ...
endmodule

❌ INVALID:
module Counter (
  input wire clk,
  output wire [7:0] count
  // Missing );
  // ... implementation ...
endmodule  // Never closed properly
```

**Port Declarations**
```verilog
✅ VALID:
input wire clk
input wire reset
output wire [3:0] data

❌ INVALID:
input clk  // Missing wire keyword
output [3:0] data  // Missing wire/reg keyword
```

**Signal Assignments**
```verilog
✅ VALID:
wire sum;
assign sum = a ^ b;

❌ INVALID:
assign result = a ^ b;  // 'result' not declared
```

**Module Names**
```verilog
✅ VALID:
module Counter(...)
module ALU_4bit(...)
module my_circuit(...)

❌ INVALID:
module 8bit_counter(...)  // Cannot start with digit
module counter-fsm(...)   // No hyphens allowed
```

### Constraint Requirements

**Pin Constraints (XDC)**
```tcl
✅ VALID:
set_property PACKAGE_PIN W5 [get_ports clk]
set_property IOSTANDARD LVCMOS33 [get_ports clk]

❌ INVALID:
set_property PACKAGE_PIN W5 clk  // Missing [get_ports ...]
set_property PACKAGE_PIN W5 [get_ports nonexistent]  // Signal doesn't exist
```

**Clock Constraints**
```tcl
✅ VALID:
create_clock -period 10.000 [get_ports clk]

⚠️ WARNING (missing):
# No clock constraint - synthesis may assume arbitrary frequency
```

---

## Common Validation Errors

### Error: `NO_MODULE`
**Message:** "No module declaration found"

**Cause:** Verilog file doesn't contain a `module` keyword

**Fix:**
```verilog
// Add module wrapper:
module MyCircuit (
  input wire in,
  output wire out
);
  // Your circuit here
endmodule
```

### Error: `NO_ENDMODULE`
**Message:** "Missing endmodule declaration"

**Cause:** Module not properly closed

**Fix:** Add `endmodule` at end of file

### Error: `UNMATCHED_PARENS`
**Message:** "Unmatched parentheses: X opening, Y closing"

**Cause:** Mismatched `(` and `)` brackets

**Fix:** Check all port lists and module instantiations for missing brackets

### Error: `INVALID_MODULE_NAME`
**Message:** "Module name 'X' cannot start with a digit"

**Cause:** Module name starts with number (e.g., `8bit_counter`)

**Fix:** Rename to start with letter (e.g., `counter_8bit`)

### Error: `MISSING_SEMICOLON`
**Message:** "assign statement missing semicolon"

**Cause:** Verilog statement not terminated

**Fix:**
```verilog
// Before:
assign out = a & b

// After:
assign out = a & b;
```

---

## Common Validation Warnings

### Warning: `NO_PORTS`
**Message:** "Module has no input or output ports"

**Impact:** Circuit cannot interact with outside world

**Fix:** Add at least one input and one output port

### Warning: `UNDECLARED_SIGNAL`
**Message:** "Signal 'X' assigned but not declared as output or wire"

**Impact:** Synthesis may fail or produce incorrect results

**Fix:** Declare signal properly:
```verilog
wire internal_signal;  // For internal connections
output wire output_signal;  // For outputs
```

### Warning: `UNDECLARED_PORT_SIGNAL`
**Message:** "Signal 'X' used in port connection but not declared"

**Impact:** Module instantiation may fail

**Fix:** Ensure signal exists before using in `.port(signal)` connections

### Warning: `UNCONSTRAINED_SIGNAL`
**Message:** "Circuit signal 'X' has no pin constraint"

**Impact:** Synthesis tool will choose arbitrary pin (may not match board)

**Fix:** Add XDC constraint:
```tcl
set_property PACKAGE_PIN <PIN> [get_ports <signal>]
set_property IOSTANDARD LVCMOS33 [get_ports <signal>]
```

### Warning: `UNKNOWN_SIGNAL`
**Message:** "Constrained signal 'X' not found in circuit"

**Impact:** Constraint has no effect (harmless but indicates mismatch)

**Fix:** Remove constraint or fix signal name spelling

---

## Synthesis Readiness Scores

### Score Interpretation

**90-100%: Excellent** ✅
- No errors, minimal warnings
- Fully constrained with timing info
- Ready for synthesis

**70-89%: Good** ⚠️
- No errors, some warnings
- May have unconstrained signals
- Will synthesize but review warnings

**50-69%: Fair** ⚠️
- Multiple warnings
- Missing constraints or timing
- Check before synthesis

**0-49%: Poor** ❌
- Many warnings or some errors
- Likely to have synthesis issues
- Review and fix before hardware

**Negative: Failed** ❌
- Critical errors present
- Export blocked
- Fix errors before retrying

### Score Calculation
```
Base: 100 points
- 20 points per Verilog error
- 15 points per constraint error
- 5 points per Verilog warning
- 3 points per constraint warning
+ 10 points for valid module with I/O
+ 5 points for timing constraints
```

---

## Troubleshooting Workflow

### Problem: Export Shows Validation Errors

**Steps:**
1. Read error messages carefully (include line numbers)
2. Check Verilog syntax in problematic areas
3. Verify all signals are declared before use
4. Ensure module has proper structure
5. Fix errors and retry export

### Problem: Low Readiness Score (<70%)

**Steps:**
1. Check for unconstrained signals
2. Add missing XDC constraints
3. Review and fix warnings
4. Add clock and timing constraints if missing
5. Retry export to see improved score

### Problem: Synthesis Fails After Valid Export

**Possible Causes:**
- Board-specific timing violations
- Resource usage exceeds FPGA capacity
- Clock domain crossing issues
- Advanced features not validated by static analysis

**Fixes:**
- Check Vivado synthesis reports
- Simplify circuit if too large
- Add proper timing constraints
- Review FPGA resource utilization

### Problem: Hardware Doesn't Match Simulation

**Causes:**
- Missing input/output constraints
- Incorrect pin assignments
- Clock frequency mismatch
- Timing violations

**Fixes:**
1. Verify XDC constraints match board pinout
2. Check clock frequency in constraints matches board
3. Review timing reports for violations
4. Test with slower clock if needed

---

## Best Practices

### Pre-Export Checklist
- [ ] Circuit simulates correctly in Logic Playground
- [ ] All nodes have valid types and connections
- [ ] Circuit includes clock source if sequential
- [ ] I/O signals have meaningful names
- [ ] No floating (unconnected) outputs

### Post-Export Checklist
- [ ] Verilog validation passed (0 errors)
- [ ] Readiness score ≥ 70%
- [ ] XDC constraints cover all I/O signals
- [ ] Clock constraints present for sequential circuits
- [ ] Downloaded both .v and .xdc files

### Hardware Deployment Checklist
- [ ] Vivado project created with exported files
- [ ] Synthesis completed without errors
- [ ] Implementation passed timing
- [ ] Bitstream generated successfully
- [ ] Board programmed and tested
- [ ] Hardware behavior matches simulation

---

## Hardware-Ready Examples

RedByte includes validated hardware-ready examples:

### Layer 6: FPGA Examples
1. **8-bit Counter (Basys3)**
   - Binary counter with clock input
   - Uses D flip-flops for state
   - Readiness: 95-100%

2. **Traffic Light FSM (Basys3)**
   - 3-state finite state machine
   - Timer-based transitions
   - Readiness: 90-95%

3. **4-bit ALU (Basys3)**
   - Arithmetic Logic Unit
   - Multiple operations (ADD/SUB/AND/OR)
   - Readiness: 90-95%

All examples pass validation and are tested for synthesis compatibility.

---

## Validation API Reference

### For Developers

**Verilog Validation**
```typescript
import { validateVerilog } from '@redbyte/rb-fpga-toolchain';

const result = validateVerilog(verilogCode);
// result: { valid, errors, warnings, moduleInfo }
```

**Constraint Validation**
```typescript
import { validateConstraints } from '@redbyte/rb-fpga-toolchain';

const result = validateConstraints(xdcCode, circuitSignals);
// result: { valid, errors, warnings, pinInfo }
```

**Readiness Score**
```typescript
import { calculateReadinessScore } from '@redbyte/rb-fpga-toolchain';

const score = calculateReadinessScore(verilogResult, constraintResult);
// score: 0-100 (may be negative for critical errors)
```

---

## FAQ

**Q: Can I export Verilog with warnings?**
A: Yes. Warnings don't block export, but review them before synthesis.

**Q: Why is my readiness score low?**
A: Check for unconstrained signals, missing timing constraints, or multiple warnings.

**Q: What if validation passes but synthesis fails?**
A: Validation checks syntax and basic semantics. Advanced issues (timing, resources) require full synthesis.

**Q: Can I customize validation rules?**
A: No. Validation rules ensure standard Verilog compatibility. Customize constraints instead.

**Q: Do I need constraints for simulation?**
A: No. Constraints are only for hardware synthesis/programming.

---

**See Also:**
- [FPGA Workflow Guide](../REDBYTE_USER_MANUAL.md#16-the-fpga-workflow-design--export--synthesize)
- [Phase 7 Completion Report](../PHASE_7_COMPLETION_REPORT.md)
- [Example Circuits](../packages/rb-apps/src/examples/)
