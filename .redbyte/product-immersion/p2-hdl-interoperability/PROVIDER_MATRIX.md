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

## Implemented (P2-6, model layer)

Code authority: `packages/rb-apps/src/apps/ide/simulationProvider.ts` +
`vcdImport.ts`.

- `SimulationProviderInfo` carries `evidenceTier` (`browser-e0` |
  `imported-external`), `evidenceLabel`, `executesInBrowser`, `external`.
- `BROWSER_LOGIC_PROVIDER` — Browser-E0, executes the browser logic model only
  (never Vivado/hardware). `importedVcdProvider(name)` — imported external
  evidence, `executesInBrowser: false`.
- `parseVcd(text)` — bounded IEEE-1364 VCD reader (`$timescale`, `$scope`/
  `$upscope`, `$var`, `$enddefinitions`; scalar + vector + real value changes)
  → `VcdWaveform` with per-signal timelines, `endTime`, and range-carrying
  diagnostics (never throws; malformed lines degrade to diagnostics).
- `waveformFromVcd(vcd, name)` adapts a parsed VCD into a neutral
  `ProviderWaveform` the Analyzer consumes, tagged imported-external.
- Query helpers: `signalTimeline`, `signalByReference`, `valueAtTime`,
  `evidenceCaption`, `providersComparable` (cross-tier compare allowed, each
  side's tier always shown).

10 unit tests. **No provider fabricates execution.** UI wiring — the waveform
Analyzer selecting a provider and rendering the imported waveform with its
evidence caption — is the follow-on; VCD stays `planned` in the language
capability matrix until that user-facing path lands.
