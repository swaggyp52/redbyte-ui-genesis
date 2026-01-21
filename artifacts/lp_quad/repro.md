
# Quad Mode Crash Reproduction

**Steps**:

1. Boot RedByte OS.
2. Open **Logic Playground**.
3. Locate the Mode Selector (dropdown in toolbar, default "Build").
4. Select **"Quad"**.
5. **CRASH**: "Application Error: signalsVersion is not defined".

**Evidence**:

- Screenshot: `artifacts/lp_quad/quad_crash.png`
- Error: `Uncaught ReferenceError: signalsVersion is not defined`
