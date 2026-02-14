# RedByte Intelligence Integration Boundary (PRX)

This document defines the initial contract between the existing React workspace and the new intelligence service.

## Boundary Rules
- Existing UI behavior remains source-of-truth while PRX rolls out.
- Service is additive and can be feature-flagged.
- Contract is request/response JSON over HTTP.

## Request Envelope (`POST /v1/analyze`)
- `compare`: simulation/hardware summary and mismatch hints.
- `evidence`: submission readiness and issues.
- `coach`: lab/stage context for pedagogical guidance.
- `repair`: HDL snippet + error context.

Current v1 shape:
- `projectId?`
- `labId`
- `stage`
- `projectSummary`
- `traces?: { sim?, hw? }`
- `gates?`
- `userIntent`

## Response Envelope
- `summary`
- `actions[]`
- `confidence`
- `citations?`
- `debug`

PRX3 evidence action shape (inside `actions[]`):
- `title`
- `why`
- `fixIntent`
- `severity`

## Frontend Rollout
1. Keep current PRV3A compare panel behavior as fallback.
2. Add adapter call behind `RB_INTEL_ENABLED` + `RB_INTEL_URL` feature flags.
3. Map response fields directly to compare/coaching surfaces.
4. Expand to PRV3B once real trace alignment is available.
