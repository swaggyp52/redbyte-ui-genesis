---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: Marcus code intelligence and patch proposal safety contract
---

# RedByte Marcus Code Intelligence

## Purpose

Marcus can inspect repo code in a controlled read-only way so it can prepare implementation proposals for Connor and Codex.

This is the bridge between a Marcus task packet and a Codex implementation prompt:

```text
packet / task -> read-only code context -> proposal-only patch plan -> Codex implements
```

## What Marcus Can Do

- Search allowlisted repo paths.
- Read small bounded snippets from safe text files.
- Summarize likely implementation files.
- Connect code findings to packets, tasks, and product claims.
- Draft patch proposals.
- Generate Codex execution prompts.
- Save proposal artifacts under ignored local run directories.

## What Marcus Cannot Do In v1

- Edit files.
- Apply patches.
- Stage files.
- Commit.
- Push.
- Read secrets or private configs.
- Run arbitrary shell commands.
- Write to Obsidian.
- Claim that a proposal has been applied.

## Safe Code Source Policy

Allowed read-only paths:

- `packages/**`
- `scripts/**`
- `docs/**`
- `.github/instructions/**`
- `.github/prompts/**`
- `.redbyte/agent/skills/**`
- `package.json`
- workspace/package/tsconfig config files when needed

Denied paths:

- `.env*`
- `.redbyte/agent/**/config.json`
- `node_modules/**`
- `dist/**`, `build/**`, `out/**`, `.cache/**`
- `.git/**`
- generated runtime files under `.redbyte/agent/runs/**`
- binary files
- files above the configured max byte limit

All reads must remain inside the repo root. Path traversal is blocked.

## Patch Proposal Schema

```typescript
interface MarcusPatchProposal {
  id: string;
  createdAt: string;
  sourceTaskId: string | null;
  sourcePacketId: string | null;
  title: string;
  productProblem: string;
  targetFiles: string[];
  codeFindings: Array<{ path: string; reason: string; snippet: string }>;
  proposedChanges: string[];
  patchSketch: string;
  risks: string[];
  doNotTouch: string[];
  tests: string[];
  validationCommands: string[];
  evidenceSources: HqSourceRecord[];
  generatedFiles: string[];
  requiresApproval: true;
  applyStatus: 'proposal_only';
}
```

## Rule

A patch proposal is not an applied change.

Marcus proposes. Codex implements. Connor approves.

## Generated Files

Proposal artifacts are written under:

`.redbyte/agent/runs/hq/patch-proposals/`

Each proposal writes:

- `<id>.json`
- `<id>.md`

This directory is covered by the repo ignore rule for `.redbyte/agent/runs/`.

## Validation

Use:

- `pnpm rb:hq:test`
- `pnpm rb:marcus:test`
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `pnpm --filter @redbyte/playground build`

