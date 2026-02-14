# RedByte Intelligence Core v1

Production-oriented multi-agent foundation for RedByte Lab OS using Microsoft Agent Framework.

## Scope (PRX v1)

- Orchestrator Agent
- Diff Agent (Sim vs Hardware reasoning)
- Evidence Agent (submission semantics)
- Coach Agent (lab-aware teaching guidance)
- Repair Agent (HDL fix suggestions)
- HTTP server hosting (`agent-as-server`)
- Debug hooks for AI Toolkit Agent Inspector
- Evaluation harness skeleton

## Architecture

```text
React Lab Workspace (existing)
  -> POST /intelligence/analyze (future integration boundary)
  -> RedByte Orchestrator Agent (workflow-as-agent)
       |- Diff Agent
       |- Evidence Agent
       |- Coach Agent
       |- Repair Agent
       -> unified response envelope for UI panels
```

## Quick Start

1. Create/activate a local venv inside this folder.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Configure `.env` from `.env.example`.
4. Run API mode (recommended for app integration):
   - `uvicorn redbyte_intelligence.app:app --host 127.0.0.1 --port 8087 --reload`
5. Optional: run Agent Server mode:
   - `python -m redbyte_intelligence.server`

## Notes

- Foundry model/project is not auto-configured in this repository yet.
- The scaffold uses environment variables and graceful fallbacks so rollout is incremental.
- Current React app remains unchanged unless explicitly wired to call this service.
- Stable integration endpoint for PRX1: `POST /v1/analyze`.
