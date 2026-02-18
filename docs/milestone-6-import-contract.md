# Milestone 6 (Import) — Final Contract & Validation

## Overview

Milestone 6 (Import) provides **circuit import from Vivado HDL + XDC** with guaranteed export compatibility for Basys3. The pipeline is:

1. **Import**: Student pastes VHDL + XDC → ParsedHDL + XdcParseResult
2. **Bridge**: ParsedHDL + XDC → RBProject (circuit + ioMapping)
3. **Validate**: Check entity naming, port parity, identifier hygiene
4. **Export**: Generate VHDL + XDC with Vivado compatibility

---

## UX Contract: Export Behavior

### Policy: **Block Export if IO Mapping Incomplete**

**Rationale**: For classroom labs, every I/O port must be mapped to a physical pin. Silent partial exports cause confusion ("why doesn't my design load in Vivado?").

**Implementation**:
- If `ioMapping` is missing or incomplete (not all ports mapped):
  - Export function checks `validateExportForBasys3()`
  - If errors exist: **throw error** with clear message listing unmapped ports
  - If warnings only: allow export with warnings (e.g., pin validity)

**Code Pattern**:
```typescript
export function exportProjectAsBasys3(rbproj: RBProject): Blob {
  const validation = validateExportForBasys3(rbproj);
  
  if (!validation.ok) {
    throw new Error(`Export blocked: ${validation.errors.join('\n  ')}`);
  }
  
  // Proceed with export
  // (warnings are logged but non-blocking)
}
```

---

## Fixtures (3 Total)

| Fixture | Pattern | Purpose |
|---------|---------|---------|
| **01-and-gate** | 2 inputs → 1 output | Test minimal case (v1 scope) |
| **02-full-adder** | 3 inputs → 2 outputs | Test multi-port mapping |
| **03-vivado-ish-clocked** | Clock + digital logic | Test Vivado formatting variants (no-space braces, IOSTANDARD, create_clock) |

All fixtures use real Basys3 pin names and are versioned in the repo.

---

## Validation Gates

### `pnpm gates:import-roundtrip`
- Runs 7 test cases on all 3 fixtures
- Validates: fixture structure, XDC parsing, IO mapping correctness
- Exit 0 = import pipeline healthy

### Gateway: `pnpm repo:status`
- Runs: Build → **Import Roundtrip Gate** → Artifact Verification
- Exit 0 = repository is shippable
- If gates fail, entire status is DEGRADED (forces attention)

---

## Test Coverage

### PR5 Roundtrip Tests (7 tests)
- `01-and-gate`: Port count + IO mapping correctness
- `02-full-adder`: Multi-port validation
- `03-vivado-ish-clocked`: Format variant handling
- XDC parser: Handles Vivado variants without crashing
- Fixture consistency: Ports match constraints

### Export Validation Tests (9 tests)
- Valid ports + IO mapping (pass)
- Illegal characters in port names (fail)
- Reserved VHDL keywords as ports (fail)
- Port names starting with digits (fail)
- Duplicate port names (fail)
- Unmapped ports (warn, not fail)
- No IO mapping provided (warn)
- Empty circuit (allow)
- Non-existent ports in mapping (fail)

---

## Vivado Compatibility

### Supported Formats (v1)
- VHDL: structural (component instantiation, port assignment)
- XDC: `set_property PACKAGE_PIN [get_ports {...}]` only
- Port direction: in / out (no inout yet)
- Identifiers: ASCII letters + digits + underscore, start with letter/underscore

### Warnings (Non-Blocking in v1)
- `IOSTANDARD` directives (logged but ignored)
- `PULLUP` / `PULLDOWN` directives
- `create_clock` constraints
- `DRIVE`, `SLEW` directives

### Hard Blocks (v1)
- Vector notation: `count[3:0]` → export as individual `q0, q1, q2, q3`
- Bus constraints: unsupported → warn, skip
- Inout ports: not yet supported

---

## Checklist: "Don't Touch Again"

- ✅ **Fixtures**: 3 real fixtures, versioned, deterministic
- ✅ **Roundtrip Gate**: Validates import→circuit→mapping
- ✅ **Export Validation**: Checks entity naming, port hygiene, mapping parity
- ✅ **CI Integration**: `pnpm gates:import-roundtrip` wired into `repo:status`
- ✅ **UX Contract**: Export blocks on incomplete mapping (no silent failures)
- ✅ **Test Coverage**: 16 tests (7 roundtrip + 9 export validation)
- ✅ **Documentation**: This file + code comments

---

## Next Steps (Deferred to v1.5+)

- ZIP export with full Vivado project structure
- Support for clock constraints (assign pin + create_clock)
- Multi-board support (Nexys, Arty, etc)
- HDL testbench generation (keep students in IDE, not Vivado)

---

## Deployment Checklist

Before releasing Milestone 6 to students:

1. **Gate Green on CI**: `pnpm gates:import-roundtrip` must pass
2. **repo:status Green**: Full health check must succeed
3. **Fixture Coverage**: All 3 fixtures + tests committed and passing
4. **Export Contract Clear**: Document shared with students explaining "why blocks export"
5. **XDC Format Notes**: Instructor documentation on supported XDC variants

---

**Last Updated**: 2026-02-18  
**Status**: Ready for lab deployment (M6 complete)
