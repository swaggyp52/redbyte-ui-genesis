---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: practical local Ollama setup and runtime troubleshooting for RedByte local agent workflows
---

# RedByte Ollama Local Setup

This guide makes the RedByte local agent harness usable in a real Windows terminal environment.

---

## What Ollama is used for in RedByte

Ollama powers local language-model calls for:
- `pnpm rb:agent:next`
- `pnpm rb:agent:review`
- `pnpm rb:agent:doc-sync`
- `pnpm rb:agent:handoff`
- smoke checks in `pnpm rb:agent:doctor`

## What Ollama is not used for

- It does not edit product files directly.
- It does not stage, commit, or push git changes.
- It is not part of the student-facing IDE runtime.
- It is not installed inside this repository.

---

## Windows setup steps

1. Check whether Ollama CLI is available:

```powershell
Get-Command ollama -ErrorAction SilentlyContinue
ollama --version
```

2. Check whether the local API is reachable:

```powershell
try {
  Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get
} catch {
  Write-Host "OLLAMA_API_DOWN"
  Write-Host $_.Exception.Message
}
```

3. If API is down but CLI exists, start Ollama:

```powershell
Start-Process ollama
```

4. Re-check API:

```powershell
Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get
```

5. Pull a small smoke-test coding model if needed:

```powershell
ollama pull qwen2.5-coder:1.5b-base
```

6. Set model and run RedByte commands:

```powershell
$env:REDBYTE_AGENT_MODEL="qwen2.5-coder:1.5b-base"
pnpm rb:agent:doctor
pnpm rb:agent:context
pnpm rb:agent:next
```

---

## Model recommendations

- `qwen2.5-coder:1.5b-base`
  - Use for smoke tests and lightweight local completion.
  - Lowest-cost local option for command-path validation.
- `qwen2.5-coder:7b`
  - Use for light local planning and review if hardware supports it.
- Larger models
  - Use only when local RAM/VRAM supports them.
  - Verify startup with `pnpm rb:agent:doctor` before relying on outputs.
- `nomic-embed-text`
  - Reserve for embeddings when/if RedByte adds local RAG workflows.

---

## RedByte local agent command flow

Core commands:
- `pnpm rb:agent:doctor`
- `pnpm rb:agent:context`
- `pnpm rb:agent:next`
- `pnpm rb:agent:review`
- `pnpm rb:agent:doc-sync`
- `pnpm rb:agent:handoff`

Suggested sequence:
1. `pnpm rb:agent:doctor`
2. `pnpm rb:agent:context`
3. `pnpm rb:agent:next`
4. After edits, `pnpm rb:agent:review`
5. Before closeout, `pnpm rb:agent:doc-sync` and `pnpm rb:agent:handoff`

---

## Failure modes and actions

1. `ollama` command missing
- Symptom: `Get-Command ollama` returns nothing.
- Action: install Ollama from the official Windows installer at `https://ollama.com/download/windows`.
- Do not install Ollama inside this repo.

2. API down (`http://localhost:11434/api/tags` unreachable)
- Symptom: connection refused/unable to connect.
- Action: run `Start-Process ollama` or `ollama serve`, then re-check API.

3. Model missing
- Symptom: doctor reports configured model not installed.
- Action: run `ollama pull <model>` or set `REDBYTE_AGENT_MODEL` to an installed model.

4. Model too slow or fails to allocate memory
- Symptom: `Ollama API returned 500` with memory/alloc errors.
- Action: switch to a smaller model (for example `qwen2.5-coder:1.5b-base`).

5. Context too large
- Symptom: generation is very slow or fails with context-related errors.
- Action: reduce `REDBYTE_AGENT_CTX_LIMIT` and retry.

---

## Using generated outputs with Copilot/Claude

Generated files are written under `.redbyte/agent/runs/`.

- Use `next-prompt.md` or `next-prompt.json` as the implementation prompt seed.
- Use `review-latest.md` or `review-latest.json` to triage diffs before commit.
- Use `doc-sync-latest.md` or `doc-sync-latest.json` to close documentation gaps.
- Use `handoff-latest.md` to transfer session context cleanly.

Keep run outputs unstaged and gitignored.
