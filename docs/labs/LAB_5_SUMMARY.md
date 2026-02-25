# Lab 5 Summary — 2's Complement Adder/Subtractor

**Source PDF:** `labs/fac_jung002_ECE141_Lab5.pdf`

---

## Learning Objectives

- Design add/subtract circuit using 2's complement representation
- Use mode-controlled inversion + carry-in for subtraction
- Build and verify hierarchical circuit with Overflow, Sign, C_out outputs

## Circuit

Mode=0: ADD (A + B). Mode=1: SUB (A - B = A + NOT(B) + 1).
Subtraction implemented via XOR gates on B inputs + Mode as carry-in to FA[0].
Overflow detection: XOR of carry into and out of the MSB full adder.

## What Is Outdated

- 4-level ISE hierarchy (full_adder → Adder/Subtractor → 2's Complement Converter → top)
- SSD display integration in original — simplified to LED in RedByte version
- Spartan3 board (replaced by Basys3)

## Modern Workflow

- Starter: `20_lab5-addsub-starter-basys3`
- Student adds XOR gates on B path (B XOR Mode for each bit), connects Mode to FA[0].Cin
- Simulation vectors: positive add, negative result, overflow case
- Hardware: M<-SW8, A[3:0]<-SW7-4, B[3:0]<-SW3-0, result->LED[3:0], Overflow->LED[4], C_out->LED[5]
- Gate: `addsub-coverage` — must demonstrate both add and subtract paths
