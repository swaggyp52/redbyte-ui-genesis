# Codex Execution Packet Writer

Purpose: turn a RedByte problem packet into a small, testable implementation prompt for Codex.

Required packet content:

- Raw feedback preserved exactly.
- Normalized problem.
- Product surface and workflow step.
- Related docs and claims.
- Likely code files.
- Related tests/gates.
- Minimal fix options.
- Overengineering risks.
- Do-not-build list.
- Definition of done.

Prompt rules:

- Start from the raw feedback and normalized problem.
- Name files and gates as likely starting points, not permission for broad rewrites.
- Require focused validation before claiming done.
- Preserve one logical change per commit.
- Do not push unless explicitly instructed.
