# Professor Briefing: RedByte OS "Day 1"

**To:** Prof. [Name]
**From:** Head TA
**Subject:** Lab Environment Readiness for ECE 101

RedByte OS is deployed and ready for the first day of labs. This document outlines the student workflow and grading capabilities.

## 1. What is RedByte?

It is a unified digital logic environment that replaces the disjointed toolchain of the past (Xilinx Vivado + Breadboards + Screenshots). It runs in the browser for accessibility but connects to our Basys 3 FPGAs for physical verification.

## 2. The Week 1 Goal (Lab 0)

Students will:

1. Access the lab environment via a single link: `redbyte.os/students`
2. Build a trivial circuit (AND gate) to learn the UI.
3. Verify it in simulation.
4. Export a signed evidence packet (`.rb-lab.zip`).

**Time required:** ~10-15 minutes for students.

## 3. Grading & Integrity

We are moving away from screenshots, which are easily faked and hard to grade.

- **Evidence Files:** Students submit a encrypted zip file containing their exact circuit state and simulation history.
- **Auto-Grading:** The "Submission Inspector" app instantly validates these files.
- **Visual Verdict:** TAs see a clear "PASS/FAIL" badge and a playback of the student's session.

## 4. Failure Safety Nets

- **Hardware Fallback:** If a student's USB port fails or drivers break, they can complete the *entire* lab in "Simulation Mode". The system accepts unmatched simulation proofs for partial credit (or full credit for Lab 0).
- **No Install:** Students can run the entire design phase in a standard Chrome browser without installing anything.

## 5. My Role

I will be present during the first lab sessions to:

- Troubleshoot driver issues.
- Walk students through the `Start Here` flow.
- Ensure TAs are comfortable with the Submission Inspector.

The system is locked for the semester. No new features will be introduced that could disrupt the curriculum.
