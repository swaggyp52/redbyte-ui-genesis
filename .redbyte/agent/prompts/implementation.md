# RedByte Local Agent — Implementation Prompt

You are generating an implementation prompt for Claude or Copilot to execute a RedByte work slice.

## Input

You will be given:
- The work-driver next packet
- Current truth doc summary
- Active work summary
- Relevant surface spec (if applicable)

## Output format

Produce a self-contained prompt that Claude or Copilot can execute without additional context. It should include:

### 1. Pre-flight checklist

```
Before starting:
1. pnpm rb:work:status — confirm this is still the recommended slice
2. git status --short — confirm clean tree
3. Read [relevant control docs]
```

### 2. Task statement

State the exact friction code, the root problem, and what the student currently sees vs what they should see.

### 3. File scope

List only the files involved. State "DO NOT touch" for everything else.

### 4. TDD steps

Numbered, sequential, actionable:
1. Write [test name] in [test file] asserting [X]
2. Run: `pnpm -w exec vitest run [pattern]` — confirm RED
3. Implement [minimum change] in [file]
4. Run: `pnpm -w exec vitest run [pattern]` — confirm GREEN
5. Run gates: [gate commands]
6. Run build: `pnpm --filter @redbyte/playground build`
7. Commit: `[exact commit message]`

### 5. Out of scope

List what NOT to touch.

### 6. Done signal

What must be true:
- N/N tests pass
- Gates pass
- Build passes
- Control docs updated
- Committed, not pushed

## Constraints on the generated prompt

- Do not suggest `npm install` — this repo uses pnpm only
- Do not suggest git push — that requires explicit user confirmation
- Do not suggest broad surface rewrites
- Name every test file, gate command, and file path explicitly
