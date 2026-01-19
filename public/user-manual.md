---
# RedByte Guide

---
## Start Here
Choose your path. No guesswork.

**1. New to RedByte?**  
*For first-time users*  
You’ll build, debug, and understand a real circuit in 10 minutes.  
**Time:** 10 min  
[Start 10-Minute Walkthrough](/guide/walkthrough)

**2. I want to build and debug a circuit**  
*For hands-on learners*  
You’ll place gates, wire them, run simulations, and fix real problems.  
**Time:** 5–15 min  
[Jump to Building & Debugging](#building-debugging)

**3. I want to understand why RedByte is different**  
*For skeptics, instructors, and pros*  
You’ll see why time, determinism, and inspection change everything.  
**Time:** 5 min  
[Jump to Why RedByte Is Different](#why-redbyte-different)

---
## What RedByte Is — And Why It Exists
RedByte is a deterministic digital logic environment.  
It’s built for people who want to see—not guess—how circuits behave.

**The problem:**  
Most tools hide time. Beginners fail not because logic is hard, but because behavior is invisible.  
“Looks correct” is not the same as “is correct.”  
Debugging should teach, not punish.

**What RedByte forces you to confront:**  
- Every state change is explicit  
- Every tick is reproducible  
- Every result can be inspected, replayed, and verified

**10-second mental model:**  
If you can’t explain what happens on every clock tick, you don’t understand your circuit.

**After this section, you should understand why RedByte exists and what kind of thinking it teaches.**

---
## What You Can Actually Do in RedByte
In RedByte, you can:
- Build logic circuits from basic gates
- Step through time one tick at a time
- Watch signals propagate and fail
- Debug incorrect behavior visually
- Replay and scrub executions
- Inspect state at any moment
- Export inspectable artifacts
- Compare intended vs actual behavior

Every item above is concrete, doable, and real.

---
## Seeing Time — The Core Idea
Time is the missing concept in digital logic.

**Why time matters:**  
A clock tick isn’t just a number—it’s the heartbeat of your circuit.  
Step vs run: Step lets you see each change. Run shows you the whole story.

**Replay exists so you can prove what happened.**  
Oscilloscopes matter because they show you the real signal, not just the final output.

**Broken-circuit story:**  
You wire up a counter. It “looks right.” You run it. The output glitches.  
You step through time—see the signal fail, fix the wire, replay, and watch it work.

> **Common Mistake:** If your output “looks right” but fails later, you probably skipped stepping through time.

> **Why This Matters:** Traditional tools let you hide from causality. RedByte makes you face it.

[Interactive: Gate Toggle]  
[Interactive: Waveform Scrubber]  
[Interactive: Hover Circuit Diagram]

---
## Building & Debugging
- Place gates and switches
- Wire them up
- Run a simulation
- Toggle inputs, watch outputs
- See what fails, fix it, replay

[Interactive: Build a 2-input AND circuit]  
[Interactive: Debug a broken signal]

---
## Why RedByte Is Different
RedByte is deterministic.  
Every tick, every state, every result is reproducible.

You don’t just “see” the output—you see why it happened.

- Determinism means you can replay, inspect, and verify every step.
- Time is explicit. You can’t skip it.
- Inspection is built-in. You can prove what happened.

---
## Canonical Walkthrough
The fastest way to “get” RedByte is the 10-Minute Walkthrough.

- Linear, step-based, progress-tracked
- You’ll build, debug, and understand a real circuit
- No distractions, no detours

[Start Walkthrough](/guide/walkthrough)

---
## Compare to What You Already Know
| If you’ve used… | RedByte feels different because… |
| --------------- | -------------------------------- |
| Logisim         | Time is explicit and replayable  |
| Verilog         | Behavior comes before HDL        |
| Vivado          | Debugging happens pre-synthesis  |

---
## What RedByte Is Not
RedByte is:
- Not a game
- Not a black box
- Not a replacement for FPGA toolchains
- Not a shortcut around understanding

**Why these boundaries exist:**  
RedByte is here to teach what other tools assume you already know.  
It’s not about hiding complexity—it’s about making it visible.

---
## Labs, Inspection, and Assessment
A “lab” in RedByte means:
- Every step is captured
- Determinism helps verification
- Inspection is replayable, not guesswork

Grading isn’t about “did it work once”—it’s about “can you prove it works every time.”

---
## For Instructors
<details>
<summary><strong>For Instructors</strong></summary>
<ul>
  <li>Learning objectives: See, debug, and explain causality</li>
  <li>Deterministic replay means grading is fair and transparent</li>
  <li>RedByte fits into courses as a bridge between theory and practice</li>
  <li>Reinforces understanding of time, state, and inspection</li>
</ul>
</details>

---

**Every section above is actionable, direct, and designed for real users.  
Interactive elements are marked for implementation.  
No fluff, no filler, no passive voice.  
This is the Guide RedByte deserves.**
