// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { CompositeNodeDef } from '@redbyte/rb-logic-core';
import type { MacroDefinition } from '../macros/MacroLibrary';
import { IdeButton, IdeInspectorSection, IdeStatusPill } from './IdePrimitives';
import type { DesignFocusContext } from './DesignFocusBanner';

/**
 * S3: Focused-module inspector. Rendered in the Design right-dock whenever a
 * Project → Design focus handoff has landed. This is the serious authoring
 * context that complements the canvas banner: port-by-port interface,
 * instance-count truth (when honestly derivable), description, and quick
 * actions for navigating back.
 *
 * Truth boundaries:
 *  - macros: we can show the LIBRARY definition (name, description, IO ports)
 *    but NOT an instance count — macros expand into raw node clusters on
 *    placement and lose their identity. Reporting a count here would be a
 *    lie.
 *  - custom components: these are composite node types, so nodes with
 *    `type === componentName` are real instances. Count is honest.
 */

export interface DesignFocusInspectorProps {
  context: DesignFocusContext;
  /** Full library entry when context.kind === 'macro'. */
  macro?: MacroDefinition;
  /** Full composite definition when context.kind === 'custom-component'. */
  componentDef?: CompositeNodeDef;
  /**
   * Honest instance count for custom components. Omit for macros (no truthful
   * value). Omit when the caller can't derive it cheaply.
   */
  instanceCount?: number;
  /** Whether the macro is currently armed for click-to-place. */
  isPlacementArmed?: boolean;
  onClear: () => void;
  onBackToProject?: () => void;
  testId?: string;
}

interface PortRowEntry {
  key: string;
  label: string;
  portName: string;
}

export const DesignFocusInspector: React.FC<DesignFocusInspectorProps> = ({
  context,
  macro,
  componentDef,
  instanceCount,
  isPlacementArmed = false,
  onClear,
  onBackToProject,
  testId = 'ide-design-focus-inspector',
}) => {
  const kindLabel = context.kind === 'macro' ? 'Macro' : 'Custom component';
  const displayName =
    context.kind === 'macro' ? context.name : context.componentName;
  const description = context.description;

  const inputRows: PortRowEntry[] = React.useMemo(() => {
    if (context.kind === 'macro' && macro) {
      return macro.inputs.map((port) => ({
        key: port.id,
        label: port.label,
        portName: port.portName,
      }));
    }
    if (context.kind === 'custom-component' && componentDef) {
      return Object.keys(componentDef.inputMapping)
        .sort()
        .map((portName) => ({
          key: `in-${portName}`,
          label: portName,
          portName,
        }));
    }
    return [];
  }, [context.kind, macro, componentDef]);

  const outputRows: PortRowEntry[] = React.useMemo(() => {
    if (context.kind === 'macro' && macro) {
      return macro.outputs.map((port) => ({
        key: port.id,
        label: port.label,
        portName: port.portName,
      }));
    }
    if (context.kind === 'custom-component' && componentDef) {
      return Object.keys(componentDef.outputMapping)
        .sort()
        .map((portName) => ({
          key: `out-${portName}`,
          label: portName,
          portName,
        }));
    }
    return [];
  }, [context.kind, macro, componentDef]);

  const showInstanceCount =
    context.kind === 'custom-component' && typeof instanceCount === 'number';

  return (
    <IdeInspectorSection
      title="Focused asset"
      testId={testId}
      collapsible={false}
    >
      <div
        className="ide-design-focus-inspector-body"
        data-testid={`${testId}-body`}
        data-focus-kind={context.kind}
        data-placement-armed={isPlacementArmed ? '1' : '0'}
      >
        <div className="ide-design-focus-inspector-identity">
          <span
            className="ide-design-focus-inspector-kind"
            data-testid={`${testId}-kind`}
          >
            {kindLabel}
          </span>
          <code
            className="ide-design-focus-inspector-name"
            data-testid={`${testId}-name`}
          >
            {displayName}
          </code>
          {context.kind === 'macro' && isPlacementArmed && (
            <IdeStatusPill tone="ok">Armed for placement</IdeStatusPill>
          )}
        </div>

        {description && (
          <p
            className="ide-design-focus-inspector-description"
            data-testid={`${testId}-description`}
          >
            {description}
          </p>
        )}

        <div className="ide-design-focus-inspector-interface">
          <h5 className="ide-design-focus-inspector-subhead">Interface</h5>
          <div className="ide-design-focus-inspector-io-group">
            <div className="ide-design-focus-inspector-io-heading">
              <span>Inputs</span>
              <span
                className="ide-design-focus-inspector-io-count"
                data-testid={`${testId}-input-count`}
              >
                {inputRows.length}
              </span>
            </div>
            {inputRows.length > 0 ? (
              <ul
                className="ide-kv-list ide-design-focus-inspector-port-list"
                data-testid={`${testId}-input-list`}
              >
                {inputRows.map((row) => (
                  <li className="ide-kv-row" key={row.key}>
                    <code>{row.label}</code>
                    {row.label !== row.portName && <span>{row.portName}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="ide-copy ide-design-focus-inspector-empty"
                data-testid={`${testId}-input-empty`}
              >
                No inputs.
              </p>
            )}
          </div>

          <div className="ide-design-focus-inspector-io-group">
            <div className="ide-design-focus-inspector-io-heading">
              <span>Outputs</span>
              <span
                className="ide-design-focus-inspector-io-count"
                data-testid={`${testId}-output-count`}
              >
                {outputRows.length}
              </span>
            </div>
            {outputRows.length > 0 ? (
              <ul
                className="ide-kv-list ide-design-focus-inspector-port-list"
                data-testid={`${testId}-output-list`}
              >
                {outputRows.map((row) => (
                  <li className="ide-kv-row" key={row.key}>
                    <code>{row.label}</code>
                    {row.label !== row.portName && <span>{row.portName}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="ide-copy ide-design-focus-inspector-empty"
                data-testid={`${testId}-output-empty`}
              >
                No outputs.
              </p>
            )}
          </div>
        </div>

        {showInstanceCount && (
          <div
            className="ide-design-focus-inspector-usage"
            data-testid={`${testId}-usage`}
          >
            <h5 className="ide-design-focus-inspector-subhead">Usage</h5>
            <p className="ide-copy">
              {instanceCount === 0
                ? 'Not used in this circuit yet.'
                : `${instanceCount} instance${instanceCount === 1 ? '' : 's'} in this circuit.`}
            </p>
          </div>
        )}

        <div className="ide-inline-actions ide-design-focus-inspector-actions">
          <IdeButton
            tone="secondary"
            onClick={onClear}
            testId={`${testId}-clear`}
          >
            Clear focus
          </IdeButton>
          {onBackToProject && (
            <IdeButton
              tone="ghost"
              onClick={onBackToProject}
              testId={`${testId}-back-to-project`}
            >
              Back to Project
            </IdeButton>
          )}
        </div>
      </div>
    </IdeInspectorSection>
  );
};
