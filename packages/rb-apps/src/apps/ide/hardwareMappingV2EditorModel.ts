/**
 * Native Map Pins / hardware editor model (conceptual).
 *
 * **Canonical truth** is {@link import('@redbyte/rb-utils').HardwareMappingDocumentV2} on
 * {@link import('./projectRuntime').ProjectRuntimeState.hardwareMappingV2}.
 *
 * **Materialized rows** (`ProjectIoRow[]`) are a *view* produced by
 * {@link materializedIoRowsFromHardwareMappingV2} plus circuit sync
 * (`deriveProjectIoRowsFromCircuitAndV2` in `projectRuntime.ts`). Edit operations that assign pins
 * must call {@link import('@redbyte/rb-utils').applyMaterializedPinToHardwareMappingV2} with the
 * same row ids materialization emits (scalar / bit id, `sliceId[bit]`, bus bit id).
 *
 * Structured edits not yet exposed in UI (group / split / bus wizard) still go through the same
 * document; this module documents the intended architecture.
 */

import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';

/** What the UI ultimately mutates — the persisted hardware mapping document. */
export type HardwareMappingEditorCanonical = HardwareMappingDocumentV2;

/** Row id space matches `materializeIoMappingFromHardwareMappingV2` output. */
export type MaterializedHardwareRowId = string;
