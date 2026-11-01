# RedByte Bus Model Audit — First-Class Vectors

Synthesized from seven parallel subsystem readings. Branch context: commit 727ef59 already
landed `BusDeclaration`/`BusBitRef`/`Circuit.buses` in rb-logic-core plus `bus.ts` (the bus
authority), with UNCOMMITTED working-tree wiring in `projectFormat.ts`, `circuitStore.ts`,
`bus.ts` (`pruneBusBits`), `index.ts`, and an UNTRACKED `projectFormatBuses.test.ts`.
This audit treats that as the chosen foundation and designs the completion path.

---

## 1. Owner Map

| Subsystem | Canonical files | Owned shapes |
|---|---|---|
| Graph model | `packages/rb-logic-core/src/types.ts` | `PortRef` (:22), `Connection` (:32), `Node` (:54), `Circuit` (:117-126 incl. `buses?`), `Signal` (:17), `NodeDefinition` (:114); NEW `BusBitRef`/`BusDeclaration` (:88-112) |
| Bus authority | `packages/rb-logic-core/src/bus.ts` | `parseVectorLabel` (:52-64), width/slice helpers (:70-141), `readBusWord`/`busWordToBits` (:160-209), `validateBusDeclarations` BUS001-BUS007 (:243-353), `normalizeBusDeclarations` (:364-403), `synthesizeBusDeclarations` (:420-477), `createBusBoundary`/`renameBus`/`deleteBus`/`connectBuses` (:522-727), `pruneBusBits` (:734-755, uncommitted) |
| Stores | `packages/rb-apps/src/stores/circuitStore.ts`; `packages/rb-apps/src/apps/ide/projectRuntime.ts` | `computeCircuitFingerprint` (circuitStore :32-54, bus-aware uncommitted), undo snapshots; `DesignHistorySnapshot` (projectRuntime :482-490), `addDesignIo`/`addDesignBoardIo` (:1380-1554), `setMappingPin(s)` (:869-926), `runVerification` (:1605) |
| Serialization | `packages/rb-apps/src/export/projectFormat.ts` | `RBProject` v1 (:57-110), `normalizeProjectCircuit` (:119-165, bus normalize/prune/synthesize uncommitted), `normalizePortRef` (:529-568), `stableStringify` codec |
| Component defs | `packages/rb-apps/src/apps/ide/componentDefinitions.ts`; `defaultNodeConfig.ts`; `registerFamilyChipMetadata.ts` | `ComponentPortWidth` (:27-29), `ComponentSignalType` (:25), `resolvePortWidth` (:397-405); `config.width` defaults (defaultNodeConfig :12,:21-29); phantom `D[i]`/`Q[i]` port expansion (registerFamilyChipMetadata :28-54) |
| Modules/hierarchy | `packages/rb-apps/src/apps/ide/projectHierarchy.ts`; `rb-logic-core/src/CompositeNode.ts`; `hierarchicalVhdl.ts` | `ModulePort` with `width: 1` literal (:12), `NativeVisualModuleDefinition` (:20-34); `CompositeNodeDef` scalar mappings (:11-17); STD_LOGIC hardcode (hierarchicalVhdl :48) |
| Sim engine | `packages/rb-logic-core/src/CircuitEngine.ts`; `builtins.ts`; `ir/elaborator.ts`; `ir/circuitIR.ts`; `ir/simulationModel.ts` | signal cache `${nodeId}.${portName}` (CircuitEngine :267,:340-343,:484); packed register semantics (`readPackedInput` builtins :357-381, `buildRegisterOutputs` :383-415); `IRSignalType {width}` (circuitIR :67-70), IR007 reserved (:36); width hardcodes `{width:1}` (elaborator :399,:420,:484) |
| Verify runner | `packages/rb-apps/src/apps/ide/sim/simEngineCore.ts`; `verifyScenario.ts`; `verifyScenarioSteps.ts`; `verifyReport.ts`; `rb-utils/src/labProjectSchema.ts` | `runDeterministicVerifyFromModel` (:330/616), bit-crush `normalizeBit` (:1377-1380); `VerifyScenario` (:40-62); step kinds incl. `set_bus`/`assert_bus` (:3-28); `VerifyReport`/`VerifyWaveSample` (:79-103); `TestVector` (:218-224) |
| HDL emitters | `packages/rb-apps/src/export/vhdlExport.ts`; `netlistExport.ts`; `verilogExport.ts`; `fpga/boards/basys3/{basys3ExportModel,basys3ExportContract,basys3Bundle,testbenchGenerator}.ts`; `rb-fpga-toolchain/src/verilog-generator.ts` | `VhdlTopPort`/bindings (:31-49), label heuristic `buildPortGroups` (:211-255); scalar `NetlistPort`/`NetlistNet` (:10-39); `Basys3ExportBindingRef` (:19-30), `parseExplicitVectorLabel` (:253-264); `Basys3PortContract` per-bit (:86-150), `exactXdcLine` (:423-425); testbench entity re-parse (:60-83) |
| Board mapping | `packages/rb-utils/src/hardwareMappingV2.ts`; `apps/ide/{hardwareMappingBridge,hardwareMappingV2EditorModel,ioBusGrouping,ioBus,ioLabels,ioSignalRoles}.ts`; `basys3Pins.ts` | `HardwareMappingEntryV2` scalar/bit/slice/bus/group (:44-115), `expandSlice` (:129-150); rebuild-flattening bridge (:230-249,:352-422); `IoBusGroup` + Base[N] regex (ioBusGrouping :26-40); bracket-stripping `normalizeIoSignalKey` (ioLabels :59); vector-style `xdcPort` catalog (basys3Pins :248,:262) |
| Canvas renderer | `packages/rb-logic-view/src/{LogicCanvas,components/WireView,components/NodeView}.tsx`; `tools/{wireValidation,netHighlight}.ts` | scalar `signal?: 0|1` (WireView :106), ±24 port offsets (:139-146); widthless `ChipMetadata` (NodeView :31-37), `NodeIoPresentation.pinAlias` (:44-48); `isValidConnection` scalar checks (wireValidation :57-62); `computeWireNetIds` (netHighlight :104-149) |

---

## 2. Exact Current Scalar Shapes

`packages/rb-logic-core/src/types.ts`:

```typescript
export interface PortRef { nodeId: string; portName: string; port?: string /* legacy */ }   // :22-27
export interface Connection { id?: string; from: PortRef | string; to: PortRef | string;
  fromPin?; toPin?; fromPort?; toPort?; /* legacy aliases */ }                              // :32-41
export interface Node { id; type; position?; x?; y?; rotation?; config?: Record<string,any>;
  params?; label?; state?; inputs?; outputs?; }                                             // :54-69
export type LogicValue = 0 | 1 | 'Z' | 'X';  export type Signal = number | LogicValue;      // :11,:17
export interface BusBitRef { index: number; nodeId: string; }                               // :88-93 (NEW)
export interface BusDeclaration { id; name; direction: 'input'|'output';
  left: number; right: number; bits: BusBitRef[]; }                                         // :102-112 (NEW)
export interface Circuit { nodes: Node[]; connections: Connection[];
  buses?: BusDeclaration[]; }                                                               // :117-126
```

Ports have NO entity: they are `portName` strings on connections plus per-type lists
(`NodeDefinition.inputs/outputs: string[]` :114-124, `ChipMetadata` NodeView :31-37).
Boundary nodes: INPUT exposes port `'out'`, OUTPUT exposes `'in'` (projectRuntime :1467).
Signal address space everywhere: the string `${nodeId}.${portName}` (CircuitEngine :484,
hierarchyStore :31, LogicCanvas :1638). Saved wire (post-`normalizePortRef`, projectFormat
:529-568): `{from:{nodeId,portName}, to:{nodeId,portName}, id?}` — flat shape throws.
`TestVector` (labProjectSchema :218-224): `{tick, inputs: Record<string, boolean|number>,
expected: Record<string, boolean|number>}` — crushed to 0|1 at runtime.
`IoMappingEntry` (labProjectSchema :127-138): `{id, nodeId, port, label?, pin?}` flat scalar.
IR is width-required already: `IRSignalType {width}` (circuitIR :67-70), but elaborator
hardcodes `{width:1}` at :399/:420/:484, so `SimulationModelPortRef.width` is always 1.

---

## 3. Existing Vector Touchpoints & Heuristics

1. **`config.width` (de facto declaration)** — defaultNodeConfig.ts:12 (Register1=1),
   :21-29 (RegisterBus/StateBank=8); clamped 1..32 by `normalizeWidth` (builtins :315-319)
   and `normalizeRegisterWidth` (registerFamilyChipMetadata :7-16). Untyped `Record<string,any>` entry.
2. **Packed + per-bit engine protocol** — `readPackedInput` (builtins :357-381) accepts packed
   number on `D` OR bits named `D[i]`/`Di`/`D_i`; `buildRegisterOutputs` (:383-415) emits packed
   `Q` (a bare number smuggled through `Signal`) plus aliases `Q[i]`,`Qi`,`qi`,`Q_invi` and a
   `width` pseudo-output. State: `bankBits`/`bankValue` (:466-476). `maskForWidth` caps 31 bits
   (:321-324) vs width clamp 32 — latent inconsistency.
3. **Phantom bit-port expansion** — `expandRegisterFamilyChipMetadata` (:28-54) synthesizes
   scalar canvas ports literally named `D[i]`/`Q[i]`; those bracketed strings are stored in
   serialized Connections. DesignSurface.tsx:10628 regex-parses them back.
4. **Base[N] label regex, duplicated ≥4×** — `bus.ts:52` `EXPLICIT_VECTOR_LABEL` (canonical,
   documented byte-identical to) `ioBusGrouping.ts:40`, `basys3ExportModel.ts:253-264`,
   plus variants in `importPortIdentity.ts:13`, `hardwareMappingV2.ts:340`,
   `hardwareMappingGuidance.ts:57`, `vhdlExport.ts:102-111` (`extractLabelIndex`),
   `testbenchGenerator.ts:171`, `ioLabels.ts:59` (bracket STRIPPING), HardwareSurface.tsx:236/1589.
5. **Pin-alias vectorization** — `parseBasys3BoundaryAliasVector` (basys3ExportModel :266-307)
   promotes pin aliases SW3/LD5/AN2/SEG4 into exported vector port names even with scalar labels.
6. **Mapping V2 already vector-shaped** — `HardwareMappingBitV2/SliceV2/BusV2` with
   bitIndex/msb/lsb/width (hardwareMappingV2 :72-108); but every runtime-built document is
   scalar-only (`migrateIoMappingToHardwareMappingV2` :263-296, bridge :230-249), and
   `setMappingPins` (projectRuntime :899-926) FLATTENS structured entries back to scalars.
7. **Definition facade width types** — `ComponentPortWidth` fixed/parameter (componentDefinitions
   :27-29); `resolvePortWidth` (:397-405) whitelists only RegisterBus/StateBank D/Q/Q_inv.
8. **Verify bus verbs, per-bit payloads** — `set_bit`/`set_slice`/`set_bus`/`assert_bus`
   (verifyScenarioSteps :3-14) carry `Record<string,0|1>` bags; `materializeVectorsFromScenarioSteps`
   flattens to scalar TestVectors (:162-218). Bit-crush sites: simEngineCore :989,:1377;
   verifyScenario :426-428; verifyScenarioSteps :298-300; verifyReport :308-311; builtins :311.
9. **HDL text re-parsing** — testbenchGenerator `parseEntityPortInfos` (:60-83) regexes width
   out of generated VHDL (only `downto 0` forms); basys3Bundle sniffs `/STD_LOGIC_VECTOR/i`
   (:240-256) and strips `[N]` for XDC cross-check (:266-281).
10. **ModulePort width eraser** — projectHierarchy `width: 1` literal type (:12), re-asserted
    at :200,:623,:630; `normalizeModulePort` (:680) hardcodes `width: 1` and silently discards
    any serialized width. hierarchicalVhdl hardcodes STD_LOGIC (:45-49,:141,:155).
11. **Renderer** — zero bus semantics in rb-logic-view; wires are `signal?: 0|1`; the full
    Circuit (incl. `buses`) is already passed in but the field is never read.

---

## 4. Extension Design — First-Class Vectors

**Architecture rule (the load-bearing decision): the scalar substrate stays authoritative.**
A "vector" is a declared identity overlay (`Circuit.buses`) over ordinary width-1 boundary
nodes and ordinary nested scalar `Connection`s. There is NO second wire type, NO VectorNet
runtime object, and NO change to `PortRef`/`Connection` serialization. Packed values remain
plain JS numbers (`Signal = number | LogicValue`), always interpreted against a declared
width, never inferred from a runtime value.

### 4.1 Types and where they land

| Concept | Type | File | Status |
|---|---|---|---|
| Bus identity | `BusDeclaration {id, name, direction, left, right, bits}` | rb-logic-core/src/types.ts:102-112 | LANDED (727ef59) |
| Bus bit membership | `BusBitRef {index, nodeId}` | types.ts:88-93 | LANDED |
| Port width (register family & boundary) | `config.width: number` read via new exported `getDeclaredPortWidth(node, portName): number` accessor | rb-logic-core (new `portWidth.ts`, backed by builtins `normalizeWidth`) | NEW — accessor only, no Node shape change |
| BusBit tap | ordinary scalar `Connection` to the member node (`busBitPortRef`, bus.ts:100-104) | no schema change | LANDED |
| BusSlice | derived view `busSlice(decl, msb, lsb)` (bus.ts:112-141); persist named slices only if product needs, as optional array under same normalize-or-drop discipline | bus.ts | LANDED (view) |
| ScalarNet / VectorNet | NOT introduced as runtime types. Net identity stays per-bit (`computeWireNetIds`); bus is a display/validation grouping over nets | netHighlight.ts (overlay map net→bus) | design decision |
| Packed word bridge | `readBusWord` / `busWordToBits` | bus.ts:160-209 | LANDED |
| IR width | `IRSignalType.width` populated from declarations + `getDeclaredPortWidth`; activate IR007 | ir/elaborator.ts:399,:420,:484 | NEW |
| Mapping bus binding | `busId?: string` on `HardwareMappingBusV2` (:95-99) and `SliceV2` (:83-90) | rb-utils/hardwareMappingV2.ts | NEW, additive |
| Module port width | `ModulePort.width: number` (widen literal `1`) | projectHierarchy.ts:12 | NEW |
| Chip metadata width | `width?: number` on ChipMetadata port entries | rb-logic-view NodeView.tsx:31-37 | NEW, optional |
| Verify bus steps | optional `busRef?`, `width?`, `bitIndex?`, `slice?{msb,lsb}` + integer word `value` on `VerifyScenarioStep` | verifyScenarioSteps.ts:16-28 | NEW, additive |

### 4.2 Serialization schema-version plan

- `RBProject` stays `version: 1`. `Circuit.buses` is optional-additive; old readers ignore
  it, `normalizeBusDeclarations([]/junk/absent) → []`. This matches the repo's field-migration
  precedent (`circuitV1PositionMigration.test.ts`; `DesignHistorySnapshot.hardwareMappingV2`
  optional-with-reconstruction, projectRuntime :485).
- **Change the uncommitted wiring: run `synthesizeBusDeclarations` on DECODE ONLY, not on
  encode** (projectFormat :153-165). Encode must remain a pure projection, or `deleteBus`
  demotion (bus.ts:638-651) is resurrected on the next save (contradicts bus.test.ts:261)
  and every legacy save changes bytes, blowing golden SHAs implicitly.
- `hardwareMappingV2` keeps schemaVersion `'2.0'` with optional `busId` (or bump `'2.1'` with
  a default-undefined normalize branch beside the existing gate, projectFormat :344,:408-410).
- `Netlist.version` → 2: `width?: number` on `NetlistPort`, optional `bit?/range?` on
  `NetlistNet.from/to`; decode accepts v1 as all-width-1.
- `VerifyReport.schemaVersion` → `'rb.verify-report.v2'` with optional per-row
  `bus?: {name,width,bitIndex}` provenance; v1 literal still accepted on decode.
- `PROJECT_HIERARCHY_SCHEMA_VERSION` stays `'rb.project-hierarchy.v1'`; width defaults to 1
  on load (fixing the :680 eraser); bump to v2 only when width>1 ports actually persist.
- Legacy lanes (`CircuitV1`, `RBProjectDoc`, `serialize.ts`, `serialization.ts`) are FROZEN —
  never taught buses. Optionally thread `buses?` through `toCircuitV1`/`fromCircuitV1`
  (convertCircuitV1 :25-105) for the Verilog/proof lanes, or formally deprecate that hop.

### 4.3 Migration plan for legacy scalar projects

1. Decode-time: `normalizeProjectCircuit` runs `normalizeBusDeclarations` → `pruneBusBits` →
   `synthesizeBusDeclarations` (contiguous ≥2-bit Base[N] boundary groups promoted with
   deterministic ids `bus-{in|out}-{name}`, bus.ts:409-411,:420-477). Lone `A[0]`/sparse
   groups stay scalar — surface a design-issue hint rather than silence.
2. Bracketed connection portNames (`Q[3]` from phantom register ports) are NOT rewritten:
   they keep resolving via the engine's alias fan-out (builtins :397-405) until the canvas
   stops synthesizing them; only then migrate under an explicit compatibility parser.
3. `deleteBus` must also rewrite member labels (or re-synthesis is gated off), closing the
   demote/resurrect contradiction.
4. Content-hash churn (`computeRbprojContentHashFromEncoded`, rbprojAutosave :373-394) is a
   one-time event per legacy project — release deliberately with a stale-notice, not silently.

### 4.4 HDL consequences

- `buildDirectionRefs` (basys3ExportModel :129-251) consults `BusDeclaration` membership by
  nodeId FIRST; `parseExplicitVectorLabel` and pin-alias vectorization demoted to legacy
  fallbacks. Declared-but-incompletely-mapped buses become a contract error (new RBEX-CT code
  near basys3ExportContract :190-200) instead of a silent scalar degrade (:188-237).
- `VhdlTopPort` gains `width?/lsb?`; ONE shared formatter renders `STD_LOGIC_VECTOR(msb downto lsb)`
  for vhdlExport :483/:492, basys3ExportModel :212, contract vhdlType :346. Testbench and
  bundle then take structured ports instead of regexing emitted text (delete
  `parseEntityPortInfos` width recovery :60-83, `/STD_LOGIC_VECTOR/i` sniff basys3Bundle :240-256).
- `buildPortGroups` label heuristic (vhdlExport :211-255) becomes declaration-driven with
  label fallback; gap-bit policy (sparse declarations) made explicit ('0' tie-off).
- hierarchicalVhdl reads `ModulePort.width` → STD_LOGIC_VECTOR (:45-49); XDC stays per-bit
  (`SW[3]` lines) — `buildTopXdc` (basys3Bundle :57-136) needs no format change.
- Legacy `top.v` (`circuitToVerilog`) cannot express vectors: drop it from vector bundles or
  extend `input wire [msb:lsb]` (verilog-generator :126-177); lint skip already exists.

### 4.5 Sim consequences

- Elaborator replaces the three `{width:1}` hardcodes (:399,:420,:484) with
  `getDeclaredPortWidth` + declaration lookup; activates IR007 width-mismatch (effective
  width = declared width narrowed by tap/slice; driver vs sink must match). Diagnostics flow
  through existing designIssues/designCompilerDiagnostics consumers.
- Engine unchanged structurally: signal cache stays scalar-keyed; packed numbers already flow.
  Centralize the address builder as exported `signalKey(ref)` replacing inline template
  strings (CircuitEngine :267,:338-343,:484); per-bit alias ports become the deprecated
  compatibility path.
- Bit-crush audit: make `normalizeSignalMap`/`normalizeVectorInputMap` (simEngineCore
  :1272,:989), `normalizeStimulusBit` (verifyScenario :426), `normalizeBitOrRecord`
  (verifyScenarioSteps :302) width-aware via SimulationModel port widths; dev-assert on
  out-of-range instead of coercing to 0.
- Legacy `LogicEngine` (engine.ts) used by determinism/replay cannot carry packed numbers
  (`Record<string, LogicValue>`): keep Replay per-bit (scalar substrate guarantees this) and
  do not route packed words through it.
- Verify: bus steps materialize word values to per-bit scalar TestVector keys (lsb→msb from
  declared width) inside `materializeVectorsFromScenarioSteps` — the deterministic engine and
  hashes keep working; width violations surface as `VerifyEvidencePreflightIssue` kinds.
- Waveform: emit synthetic bus lanes (binary/hex word per tick; 'X' if any bit X/Z) and add a
  multi-char rendering branch in WaveformInstrument (today any multi-char value renders as a
  LOW rail, :490-535) BEFORE emitting bus-valued samples.

### 4.6 Board-mapping consequences

- Derive `HardwareMappingBusV2` entries mechanically from declarations (busId, width =
  |left-right|+1, bits from `BusBitRef`s). Fix `setMappingPins` (projectRuntime :899-926) to
  route per-row through `applyMaterializedPinToHardwareMappingV2` like `setMappingPin` does —
  prerequisite, or structured entries are corrupted by any bulk write.
- `buildHardwareMappingV2FromProjectIoRows` / `migrateIoMappingToHardwareMappingV2` /
  `synchronizeScalarHardwareMappingV2WithProjectIoRows` (bridge :230-249,:352-422) become
  bus-aware; resync re-anchors bus bits by busId+bitIndex so they survive rename/delete churn.
- `groupIoRowsIntoBuses` (ioBusGrouping :52-95) gains a declarations-first path; regex only
  for undeclared leftovers. HardwareBusPlanner apply switches from N `onSetMappingPin` commits
  to one atomic `map_entry_pins` edit (hardwareMappingV2EditorModel :110-115,:142-162).
- Key normalization: stop bracket-stripping for bit-level keys — add `${busKey}[${bitIndex}]`
  forms to `getIoSignalLookupKeys` (ioLabels :55-113), keep the collapsed key as the bus-level
  key so legacy scenario rekeying still resolves. One role per bus in ioSignalRoles.
- Pin field ambiguity (alias 'SW3' vs package pin 'V17') must be normalized at write time
  before declaration-driven grouping changes which rows vectorize.

---

## 5. Risk Register

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| R1 | Golden SHA gates: any HDL/serialization byte change breaks the two classroom ZIP SHA gates, which are ALREADY drifting under Node 24 for unexplained reasons | CLAUDE.md Known Issues; classroom-golden-*.test.ts | Explain existing drift under Node 20.19.0 FIRST; regenerate goldens in one dedicated reviewed commit; never conflate causes |
| R2 | Encode-side synthesis mutates projects on save; resurrects deleted buses; guarantees golden drift | uncommitted projectFormat :153-165 vs bus.test.ts:261 | Gate `synthesizeBusDeclarations` to decode only; make `deleteBus` rewrite member labels |
| R3 | Fingerprint blindness: pre-fix fingerprint hashed only nodeId/portName; bus/tap changes judged no-ops, corrupting undo | circuitStore :32-54 (bus-aware version uncommitted) | Commit the fingerprint change atomically with any model change; test different-membership ≠ same fingerprint |
| R4 | Three+ parallel PortRef normalizers drift (projectFormat :529, circuitStore :73-82, semanticCircuit :303-316, rb-logic-adapter copies) | reports 1,2 | Consolidate on one exported normalizer from rb-logic-core before adding fields |
| R5 | Silent bit truncation in ≥5 duplicated `normalizeBit` sites turns word 6 into 0 with no diagnostic | simEngineCore :989/:1377, verifyScenario :426, verifyScenarioSteps :298, verifyReport :308, builtins :311 | Single audited width-aware normalize; dev-mode asserts |
| R6 | Namespace collision: `Q[3]` is simultaneously a stored scalar portName, an engine alias output, and future tap syntax | registerFamilyChipMetadata :36-43; builtins :397-405 | Keep aliases as compatibility shim; migrate canvas expansion last; round-trip tests |
| R7 | `setMappingPins` flattens structured V2 entries — corrupts real bus mappings the day they exist | projectRuntime :909 | Fix before persisting bus entries (commit 4 below) |
| R8 | Heuristic precedence: declared bus vs Base[N] label vs SW/LD pin-alias can disagree per row → nondeterministic export | basys3ExportModel :129-307 | Explicit precedence (declaration > label > alias) with tests |
| R9 | Dual engines diverge: legacy LogicEngine (replay/determinism) is LogicValue-only | engine.ts :35; verifyReplay.test.ts | Replay stays per-bit; forbid packed words on that path |
| R10 | Hash blast radius: irHash, traceHash, scenarioContent/StimulusHash, reportHash, autosave contentHash all shift when width/buses serialize | verifyReport :203-227; verifyScenario :158-205; rbprojAutosave :373-394 | Version-keyed digests; deliberate stale-event release notes |
| R11 | Width-eraser sites destroy data on load: `normalizeModulePort` :680, `moduleFromCompositeDefinition` :623/:630 hardcode width 1 | projectHierarchy | Widen literal type so TS flags every site; read-with-default |
| R12 | Waveform/canvas render lies: multi-char values draw as LOW rail; light-mode CSS kills glow filters; memo comparators go stale | WaveformInstrument :490-535; design-workbench-v3.css :1773-1775; NodeView :1665+ | Rendering branches land before emitters; extend comparators with every new prop |
| R13 | maskForWidth caps 31 bits vs width clamp 32; >32 needs BigInt decision | builtins :318-324 | Cap declared width at 31 for now; document |
| R14 | Load-bearing work is uncommitted/untracked (projectFormat, circuitStore, pruneBusBits, projectFormatBuses.test.ts) — a clean wipes persistence while the model stays | git status on branch | Commit 1 below |

---

## 6. Implementation Sequence (8 commits)

1. **Commit the in-flight bus persistence — corrected.** Land the working-tree diff
   (projectFormat.ts, circuitStore.ts fingerprint, bus.ts `pruneBusBits`, index.ts) plus
   untracked `projectFormatBuses.test.ts`, but move `synthesizeBusDeclarations` to
   decode-only and make `deleteBus` rewrite member labels. Gates: projectFormatBuses
   round-trip fixed point, bus.test.ts:261, ideSubmissionDeterminism, golden-examples.
2. **One normalizer + one width accessor.** Export `normalizePortRef` and
   `getDeclaredPortWidth(node, portName)` from rb-logic-core; retire circuitStore
   `getConnectionPort` and semanticCircuit `toPortRef` duplicates; make
   `resolvePortWidth` (componentDefinitions :397-405) data-driven from the accessor.
3. **Width into IR.** Replace elaborator `{width:1}` hardcodes (:399,:420,:484) with
   declaration/accessor-derived widths; activate IR007; centralize `signalKey()`; extend
   elaborator.test.ts + vectorRunner.ir-authority.test.ts. SimulationModel consumers get
   real widths with zero shape change.
4. **Mapping binds to bus identity.** `busId` on BusV2/SliceV2; fix `setMappingPins`
   flattening; bus-aware bridge rebuild/resync; declarations-first `groupIoRowsIntoBuses`;
   atomic HardwareBusPlanner apply. Gates: projectRuntime.mapping-authority,
   hardwareMappingBridge, ioBusGrouping, hardwareBusPlanner tests.
5. **Declaration-driven HDL.** Shared vector-type formatter; `buildDirectionRefs`
   declaration precedence + incomplete-bus contract error; `VhdlTopPort.width`; structured
   ports into testbenchGenerator and basys3Bundle (delete text re-parsing); Netlist v2
   fields; hierarchicalVhdl width support after widening `ModulePort.width` and fixing the
   :680 eraser. Golden SHA regeneration in its own reviewed sub-step under Node 20.19.0.
6. **Verify bus steps + report provenance.** Structured `busRef/width/bitIndex/slice` +
   integer word values on steps; width-validated materialization to scalar TestVectors;
   preflight issue kinds; `rb.verify-report.v2` with bus provenance; width-aware normalize
   audit across the five bit-crush sites. Gates: verifyScenarioSteps, verifyDeterminism,
   scenario-stale-ui-gate, scenario-testbench-alignment-gate.
7. **Waveform + canvas vector presentation.** Bus lanes with hex words and collapse groups
   (WaveformInstrument branch first); canvas ribbon styling, `/{width}` glyph, width chips,
   `ChipMetadata.width`, width check in `wireValidation.isValidConnection`, net→bus highlight
   overlay; memo comparators extended. Gates: waveformInstrument.laneControls, wireValidation,
   net-highlight-resolution-gate, NodeView suites, reduced-motion.
8. **Retire the phantom-port heuristic.** `expandRegisterFamilyChipMetadata` renders one
   vector port with tap handles behind a compatibility flag; bracketed-portName parser keeps
   legacy connections resolving; progressively unblock RegisterBus/StateBank capabilities via
   the `ACTIVE_PRODUCT_BOUNDARY_LIMITED_COMPONENTS` choke point (componentDefinitions :443,
   simulation → verification → vhdlExport). Gates: registerFamilyChipMetadata,
   designSurface.registerFamily, componentDefinitions, sequential.test.ts.

Each commit is independently green under the pinned Node 20.19.0 runtime; golden SHA
re-pins happen only in commit 5's dedicated sub-step, after the pre-existing Node-24 drift
is explained (CLAUDE.md obligation).
