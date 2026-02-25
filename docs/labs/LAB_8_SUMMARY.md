# Lab 8 Summary — Sequential Network Design (Security Lock FSM)

**Source PDF:** `labs/fac_jung002_ECE141_Lab8.pdf`

---

## Learning Objectives

- Apply FSM design procedure: state diagram → reduced state table → flip-flop equations → implementation
- Implement a non-overlapping sequence detector (Moore FSM)
- Integrate counters and display in a larger system
- Test valid and invalid unlock sequences

## System Specification

Inputs: X (serial bit stream), Clock, CE (system enable), Reset, Data[3:0]
Outputs: Open (unlock LED), Code_entered (12-bit counter reached), Cathodes/Anodes (SSD)

Sequence detector: detects 010 or 100 in X. Non-overlapping. 4 matches in 12-bit stream → Open.

Example stream: X = 1 1 0 0 1 0 0 1 0 1 0 0
               Z = 0 0 0 0 0 1 0 0 1 0 0 1
(3 matches — lock should NOT open)

Counter 1: counts 0→4 (sequence matches); Counter 2: counts 0→12 (total bits).
When both reach upper limit simultaneously → Open=1.

## FSM Design Procedure (Paper, Unchanged)

1. State diagram from problem statement
2. Reduce equivalent states (minimization)
3. Binary state encoding
4. Flip-flop input equations (D equations from state table)
5. Output equations (Moore: output depends only on current state)

## What Is Outdated

- Digilab Spartan3 board → replaced by Basys3
- ISE schematic hierarchy → replaced by RedByte canvas with pre-scaffolded blocks
- iMPACT programming → replaced by Vivado Hardware Manager

## Modern Workflow

- Starter: `23_lab8-fsm-lock-starter-basys3`
- Student implements FSM transitions from derived equations (DFF wiring)
- Counter connections from block diagram (Figure 1 of original PDF) are pre-scaffolded
- Simulation: test X = 110010010100 (Figure 2); verify Z outputs; test two unlock streams
- Gate: `fsm-paths` — must demonstrate valid and invalid FSM paths
- Hardware: IN2/IN1/IN0<-SW8/SW7/SW6, ENTER<-SW5, RESET<-SW4, LOCK->LED1

## Required Deliverables (Modern)

- Submission ZIP (circuit + verify evidence, including both valid and invalid path runs)
- Hand-drawn: state diagram, reduced state table, D equations (pre-lab work)
- (Optional) Lab report with schematic screenshot and simulation results
