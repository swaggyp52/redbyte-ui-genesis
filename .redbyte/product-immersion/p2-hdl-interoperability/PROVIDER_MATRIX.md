# Simulation Provider Matrix

RedByte simulation is served by **providers**. Each provider declares an honest
evidence tier. RedByte never claims a provider did work it did not do.

| Provider | Source of truth | What it can do | Evidence tier | Honest label |
|----------|-----------------|----------------|---------------|--------------|
| Browser Logic Provider | `state.sim` recompute over the elaborated native circuit | Interactive drive/measure, deterministic recompute, waveform | **Browser-E0** | "Browser logic simulation" |
| Imported VCD Provider | An externally produced `.vcd` waveform | Replay/inspect imported signals; align to project ports where possible | **Imported evidence (E1+ external)** | "Imported waveform (generated outside RedByte)" |

## Rules

- No provider fabricates execution. If a provider cannot produce a value, it reports
  *unknown/unavailable*, never a guessed one.
- The workbench grammar (bench drive, waveform, cross-probe) is identical across
  providers; only the evidence tier and editability differ.
- Provider selection is explicit and visible to the user; the active provider's tier
  is shown wherever results are presented.
- Imported providers are read-only with respect to project source.

_(Filled in during P2-6.)_
