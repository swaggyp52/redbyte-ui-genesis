# RedByte Agent Memory

This directory holds the configuration template for the Obsidian + Ollama memory bridge.

Tracked:
- `config.example.json`
- `README.md`
- `.gitignore`

Local-only:
- `config.json`
- `index/**`
- `runs/**`
- `*.jsonl`
- `*.sqlite`
- `*.db`

The v0 bridge is read-only for the Obsidian vault. Keep `allowVaultWrites` set to `false` unless a future, explicit slice changes the capability model.
