// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Live source ↔ visual cross-probe builder.
 *
 * Given the current design (hierarchy modules, their ports and instances) and
 * the first-class source model, this produces a {@link CrossProbeIndex} whose
 * links carry an *honest* {@link CrossProbeQuality}. Links are found by scanning
 * the verbatim source text for declarations — RedByte never claims a precise
 * location it did not actually find:
 *
 *   - a unique `entity <name>` / `module <name>` declaration → `exact`
 *   - the same declaration in more than one file                → `ambiguous`
 *   - a name that appears only as a bare identifier             → `partial`
 *   - a design element with no backing source                  → no link (the
 *     panel renders it as `unavailable`)
 *
 * The input design shape is intentionally decoupled from the store's hierarchy
 * types so this stays pure and unit-testable; callers adapt their hierarchy into
 * {@link CrossProbeDesignModule}. Deterministic: same inputs → same index.
 */

import type { ProjectSourceModel, SourceFile } from './projectSourceModel';
import { positionAt, type SourceRange } from './sourceDiagnostics';
import {
  buildCrossProbeIndex,
  type CrossProbeIndex,
  type CrossProbeLink,
  type CrossProbeQuality,
} from './sourceCrossProbe';

export interface CrossProbeDesignPort {
  name: string;
  direction?: string;
  width?: number;
  /** Circuit node backing this port, when it maps to one. */
  nodeId?: string;
}

export interface CrossProbeDesignInstance {
  /** Instance name in the parent module (e.g. `u_add0`). */
  name: string;
  /** The module this instance is of, when known. */
  ofModule?: string;
  nodeId?: string;
}

export interface CrossProbeDesignModule {
  id: string;
  name: string;
  ports: CrossProbeDesignPort[];
  instances?: CrossProbeDesignInstance[];
  /** Circuit node backing this module, when it maps to one. */
  nodeId?: string;
}

export interface CrossProbeConstraintPin {
  /** Design port/signal name the constraint targets. */
  port: string;
  /** The physical pin, for the label. */
  pin?: string;
}

export interface LiveCrossProbeInput {
  modules: readonly CrossProbeDesignModule[];
  sourceModel: ProjectSourceModel;
  /** Active XDC constraint text, for constraint ↔ XDC links. */
  constraintText?: string;
  /** Logical id used for the constraint source (defaults to `active.xdc`). */
  constraintSourceId?: string;
}

/** Whole-identifier match: `name` not flanked by identifier characters. */
function identifierRegex(name: string, flags = 'g'): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, flags);
}

function rangeAt(text: string, offset: number, length: number): SourceRange {
  return { start: positionAt(text, offset), end: positionAt(text, offset + length) };
}

/** Offsets of `entity <name>` (VHDL) or `module <name>` (Verilog/SV) declarations. */
function declarationOffsets(file: SourceFile, name: string): number[] {
  const keyword = file.language === 'vhdl' ? 'entity' : 'module';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${keyword}\\s+(${escaped})(?![A-Za-z0-9_])`, 'gi');
  const offsets: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(file.text)) !== null) {
    // Point at the identifier, not the keyword.
    offsets.push(match.index + match[0].length - name.length);
  }
  return offsets;
}

/** First whole-identifier offset of `name` in `text`, or -1. */
function firstIdentifierOffset(text: string, name: string): number {
  const match = identifierRegex(name).exec(text);
  return match ? match.index : -1;
}

/** Design source files (RTL + testbench), where module/port declarations live. */
function hdlSources(model: ProjectSourceModel): SourceFile[] {
  return model.files.filter(
    (file) =>
      (file.fileset === 'design' || file.fileset === 'simulation') &&
      (file.language === 'vhdl' || file.language === 'verilog' || file.language === 'systemverilog'),
  );
}

/**
 * Build the live cross-probe index. Emits `exact`/`ambiguous`/`partial` links;
 * design elements with no source match simply produce no link, which the panel
 * reports as `unavailable`.
 */
export function buildLiveCrossProbeIndex(input: LiveCrossProbeInput): CrossProbeIndex {
  const sources = hdlSources(input.sourceModel);
  const links: CrossProbeLink[] = [];

  for (const module of input.modules) {
    // ── module ↔ source ──
    const declaring = sources
      .map((file) => ({ file, offsets: declarationOffsets(file, module.name) }))
      .filter((entry) => entry.offsets.length > 0);

    let moduleSource: SourceFile | undefined;
    if (declaring.length === 1 && declaring[0].offsets.length === 1) {
      const { file, offsets } = declaring[0];
      moduleSource = file;
      links.push({
        kind: 'module',
        moduleId: module.id,
        nodeId: module.nodeId,
        elementKey: module.name,
        sourceId: file.id,
        range: rangeAt(file.text, offsets[0], module.name.length),
        quality: 'exact',
        label: module.name,
      });
    } else if (declaring.length >= 1) {
      // Declared in more than one place (or more than once) → ambiguous.
      const { file, offsets } = declaring[0];
      moduleSource = file;
      links.push({
        kind: 'module',
        moduleId: module.id,
        nodeId: module.nodeId,
        elementKey: module.name,
        sourceId: file.id,
        range: rangeAt(file.text, offsets[0], module.name.length),
        quality: 'ambiguous',
        label: module.name,
      });
    } else {
      // No declaration — fall back to a bare identifier mention (partial).
      const mentioning = sources.find((file) => firstIdentifierOffset(file.text, module.name) >= 0);
      if (mentioning) {
        moduleSource = mentioning;
        const offset = firstIdentifierOffset(mentioning.text, module.name);
        links.push({
          kind: 'module',
          moduleId: module.id,
          nodeId: module.nodeId,
          elementKey: module.name,
          sourceId: mentioning.id,
          range: rangeAt(mentioning.text, offset, module.name.length),
          quality: 'partial',
          label: module.name,
        });
      }
      // else: no link — unavailable (rendered by the panel).
    }

    // ── port ↔ declaration (searched within the module's source) ──
    if (moduleSource) {
      for (const port of module.ports) {
        const offset = firstIdentifierOffset(moduleSource.text, port.name);
        if (offset >= 0) {
          links.push({
            kind: 'port',
            moduleId: module.id,
            nodeId: port.nodeId,
            elementKey: port.name,
            sourceId: moduleSource.id,
            range: rangeAt(moduleSource.text, offset, port.name.length),
            quality: 'partial',
            label: port.name,
          });
        }
      }

      // ── instance ↔ instantiation ──
      for (const instance of module.instances ?? []) {
        const offset = firstIdentifierOffset(moduleSource.text, instance.name);
        if (offset >= 0) {
          links.push({
            kind: 'instance',
            moduleId: module.id,
            nodeId: instance.nodeId,
            elementKey: instance.name,
            sourceId: moduleSource.id,
            range: rangeAt(moduleSource.text, offset, instance.name.length),
            quality: 'partial',
            label: instance.ofModule ? `${instance.name} : ${instance.ofModule}` : instance.name,
          });
        }
      }
    }
  }

  // ── constraint ↔ XDC ──
  if (input.constraintText && input.constraintText.trim().length > 0) {
    const sourceId = input.constraintSourceId ?? 'active.xdc';
    const text = input.constraintText;
    for (const module of input.modules) {
      for (const port of module.ports) {
        const offset = firstIdentifierOffset(text, port.name);
        if (offset >= 0) {
          links.push({
            kind: 'constraint',
            moduleId: module.id,
            nodeId: port.nodeId,
            elementKey: port.name,
            sourceId,
            range: rangeAt(text, offset, port.name.length),
            quality: 'exact',
            label: port.name,
          });
        }
      }
    }
  }

  return buildCrossProbeIndex(links);
}

/** The link quality for a design element, or `unavailable` when it has none. */
export function qualityForLinks(links: readonly CrossProbeLink[]): CrossProbeQuality {
  if (links.length === 0) return 'unavailable';
  // Report the best (most confident) quality among the element's links.
  const rank: Record<CrossProbeQuality, number> = {
    exact: 0,
    partial: 1,
    ambiguous: 2,
    stale: 3,
    unavailable: 4,
  };
  return links.reduce<CrossProbeQuality>((best, link) => {
    const q = link.quality ?? 'partial';
    return rank[q] < rank[best] ? q : best;
  }, 'unavailable');
}
