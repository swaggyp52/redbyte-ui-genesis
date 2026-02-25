# ECE141 Lab 1 — Basic Gate Operation
## Basys3 + Vivado + RedByte Edition

**Course:** ECE141 Digital Logic Design Lab — Gannon University
**Tools required:** RedByte (browser — no install), no Basys3 or Vivado needed for this lab

---

## Objective

Become familiar with RedByte circuit design software. Draw and simulate a simple logic
circuit using NOT and AND gates. Build a truth table for the circuit and verify that the
simulation outputs match your expected results.

---

## Background

RedByte is a browser-based digital logic design tool that replaces Xilinx ISE for this course.
You draw circuits by dragging gates onto a canvas, wire them together, and verify behavior
by running a truth table simulation. No software installation is needed — open your browser
and go to the course URL provided by your instructor.

The circuit in this lab implements the function:

```
F = NOT( NOT(A) AND B )
```

which is equivalent to: F = A OR NOT(B) by De Morgan's theorem.

You will build this circuit, derive the truth table manually, enter the truth table as
simulation test vectors, and verify that the simulation agrees with your predictions.

---

## Pre-Lab (Complete Before Coming to Lab)

1. Draw the logic circuit from the expression F = NOT( NOT(A) AND B ).
   Use standard logic gate symbols (inverter triangle, AND gate D-shape).

2. Derive the full truth table by hand for inputs A and B:

   | A | B | NOT(A) | NOT(A) AND B | F = NOT(NOT(A) AND B) |
   |---|---|---|---|---|
   | 0 | 0 | | | |
   | 0 | 1 | | | |
   | 1 | 0 | | | |
   | 1 | 1 | | | |

3. Write the simplified Boolean expression for F.

---

## Lab Procedure

### Step 1 — Open RedByte and Select Lab 1

1. Open the RedByte URL in your browser (provided by instructor).
2. Click the Project surface icon (top of left rail).
3. In the Lab selector, choose "Lab 1 - Basic Gate Operation".
4. Click "Load Starter" to open the blank canvas.

### Step 2 — Draw the Circuit on the Design Surface

The Design surface is your schematic canvas. Gates are placed by dragging from
the palette (left side) or using the Add menu.

1. Click the Design surface icon (pencil/canvas icon on the left rail).

2. Add a NOT gate for input A:
   - In the node palette, find "NOT" (inverter)
   - Click to place it on the canvas
   - This will be the NOT gate on A

3. Add an AND gate:
   - Find "AND2" in the palette
   - Place it to the right of the NOT gate

4. Add a second NOT gate for the output:
   - Place a second NOT gate to the right of the AND gate

5. Add Input nodes:
   - Add an Input node labeled "A"
   - Add an Input node labeled "B"

6. Add an Output node:
   - Add an Output node labeled "F"

7. Wire the circuit:
   - Connect A → NOT gate input
   - Connect NOT gate output → AND gate input 1
   - Connect B → AND gate input 2
   - Connect AND gate output → second NOT gate input
   - Connect second NOT gate output → F

8. Verify the canvas looks like:
   ```
   A --[NOT]--+
              +--[AND2]--[NOT]-- F
   B ----------+
   ```

9. If you see a green connection indicator, the wire is correctly connected.

### Step 3 — Enter Test Vectors in the Verify Surface

The Verify surface replaces ModelSim's HDL Bencher. You enter input combinations
and expected outputs as rows in a truth table.

1. Click the Verify surface icon on the left rail.

2. You will see input columns (A, B) and an output column (F).

3. Enter the 4 rows from your pre-lab truth table:

   | Row | A | B | F (expected) |
   |---|---|---|---|
   | 1 | 0 | 0 | 1 |
   | 2 | 0 | 1 | 0 |
   | 3 | 1 | 0 | 1 |
   | 4 | 1 | 1 | 1 |

   Note: If your pre-lab truth table gives different values, use YOUR values.
   The simulation will tell you if your circuit disagrees with your expected values.

4. Click "Run Verification".

### Step 4 — Interpret Results

- Each row shows PASS (green) or FAIL (red).
- If all 4 rows are PASS: your circuit correctly implements the expected function.
- If any row FAILS: check your wiring. The FAIL row shows expected vs. actual output.

Common issues if a row fails:
- NOT gate on wrong wire (check A is going through NOT before AND)
- AND gate inputs swapped (does not matter for AND, but would matter for other gates)
- Output NOT gate missing

### Step 5 — Export Submission ZIP

1. Click the Project surface icon.
2. Enter your name in the "Student name" field.
3. Click "Export Submission ZIP".
4. Save the `.zip` file. This is your submission artifact.
5. Submit the `.zip` to your instructor via the course submission system.

---

## What to Include in Your Lab Report

1. Your hand-drawn circuit schematic (from pre-lab).
2. The completed truth table (from pre-lab).
3. The simplified Boolean expression for F.
4. A screenshot of the RedByte Verify surface showing all 4 rows as PASS.
5. Explanation: for the row (A=0, B=1) → F=0: why does the circuit produce 0?
   Walk through each gate step by step.

---

## Grading Checklist

- [ ] Truth table is correct (all 4 input combinations covered)
- [ ] Boolean expression for F is correct and simplified
- [ ] Circuit in RedByte correctly implements F = NOT(NOT(A) AND B)
- [ ] Verify surface shows PASS on all 4 rows
- [ ] Submission ZIP exported and submitted

---

## Troubleshooting

**"I can't see the gate palette."**
Make sure you are on the Design surface (pencil icon), not the Verify or Project surface.

**"My output is always 0."**
Check that all wires are fully connected. A dangling wire (not attached to a node port)
shows as a different color. Click on the wire endpoints to confirm connection.

**"The verify surface shows FAIL on row (1,0)."**
The circuit is not implementing the correct function. Re-check the wire from A through the
first NOT gate to the AND gate input 1.

**"I don't see F in the verify surface."**
The output node must be labeled "F". Double-click the output node on the canvas and set
its label. Then return to Verify.
