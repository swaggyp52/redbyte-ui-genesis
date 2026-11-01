import React, { useMemo } from 'react';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import {
  buildGeometryIndex,
  routeBounds,
  routeCircuit,
  placeSchematicLabels,
  unionBounds,
  SchematicNodeView,
  SchematicWireView,
  DEFAULT_SCHEMATIC_LAYERS,
  type ChipMetadata,
  type NodeIoPresentation,
  type SchematicLayers,
} from '@redbyte/rb-logic-view';
import { getDesignChipMetadata } from '../designChipMetadata';
import { getDesignChipMetadataForNode } from '../registerFamilyChipMetadata';
import '../surfaces/design/design-schematic.css';

export type SchematicProjectionValue = 0 | 1 | 'X' | 'Z';

/** A module definition's boundary, enough to draw an instance with its real pins. */
export interface SchematicProjectionModule {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly ports: readonly { readonly name: string; readonly direction: 'input' | 'output' | string }[];
}

export interface SchematicProjectionProps {
  readonly circuit: Circuit;
  /** Names the drawing for assistive technology, e.g. "2-Bit Up Counter schematic". */
  readonly ariaLabel: string;
  /** Boundary labels the project already derived; the node's own label is the fallback. */
  readonly ioLabelByNodeId?: ReadonlyMap<string, string>;
  /** Module definitions, so instances are drawn with the ports Design gives them. */
  readonly modules?: readonly SchematicProjectionModule[];
  readonly selectedNodeId?: string | null;
  readonly onSelectNode?: (nodeId: string) => void;
  /** Recorded inspection can select an exact connection without editing it. */
  readonly onSelectWire?: (wireId: string) => void;
  readonly selectedWireId?: string | null;
  /** Activating a node twice (double-click or Enter on the selected node) opens it for editing. */
  readonly onOpenNode?: (nodeId: string) => void;
  /** Only the caller's actual drivable boundary inputs receive this action. */
  readonly onToggleInput?: (nodeId: string) => void;
  readonly drivableInputIds?: ReadonlySet<string>;
  /** Values keyed `${nodeId}.${pinId}`. Absent keys are drawn as unvalued, never as zero. */
  readonly values?: ReadonlyMap<string, SchematicProjectionValue>;
  readonly layers?: Partial<SchematicLayers>;
  readonly testId?: string;
  readonly className?: string;
}

const CAMERA = Object.freeze({ x: 0, y: 0, zoom: 1 });
const MARGIN = 32;
const EMPTY_VALUES: ReadonlyMap<string, SchematicProjectionValue> = new Map();

function ioKind(node: Node): NodeIoPresentation['kind'] | null {
  if (node.type === 'Clock') return 'clock';
  if (node.type === 'INPUT' || node.type === 'Switch') return 'switch';
  if (node.type === 'OUTPUT' || node.type === 'Lamp') return 'led';
  return null;
}

/**
 * The project's circuit, drawn with the same symbols, pin geometry and router as Design, and
 * nothing else of Design: no editing store, no simulation, no camera to manage. The student's
 * own placement is kept, so the drawing here is recognisably the one they made.
 *
 * It replaces the block-diagram stand-in that Project and the Start previews used to show,
 * which arranged a different set of rectangles in a different order and so did not look like
 * the student's work.
 */
export const SchematicProjection: React.FC<SchematicProjectionProps> = ({
  circuit,
  ariaLabel,
  ioLabelByNodeId,
  modules,
  selectedNodeId = null,
  onSelectNode,
  onSelectWire,
  selectedWireId = null,
  onOpenNode,
  onToggleInput,
  drivableInputIds,
  values = EMPTY_VALUES,
  layers,
  testId = 'ide-schematic-projection',
  className,
}) => {
  const geometry = useMemo(() => {
    const byId = new Map((modules ?? []).map((module) => [module.id, module]));
    const byName = new Map((modules ?? []).map((module) => [module.name, module]));
    const metadata = (type: string, node?: Node): ChipMetadata | undefined => {
      const definitionId = node && typeof node.config?.moduleDefinitionId === 'string' ? node.config.moduleDefinitionId : null;
      const definition = (definitionId ? byId.get(definitionId) : undefined) ?? byName.get(type);
      if (definition) {
        return {
          name: definition.displayName || definition.name,
          inputs: definition.ports.filter((port) => port.direction === 'input').map((port) => ({ id: port.name, name: port.name })),
          outputs: definition.ports.filter((port) => port.direction === 'output').map((port) => ({ id: port.name, name: port.name })),
          color: '#5b68d8',
          layer: 1,
        };
      }
      return node ? getDesignChipMetadataForNode(node) ?? getDesignChipMetadata(type) : getDesignChipMetadata(type);
    };
    return buildGeometryIndex(circuit.nodes, metadata);
  }, [circuit.nodes, modules]);

  const nets = useMemo(() => routeCircuit(circuit, geometry), [circuit, geometry]);
  const labels = useMemo(() => placeSchematicLabels(geometry, nets), [geometry, nets]);

  const viewBox = useMemo(() => {
    const nodes = unionBounds(geometry.values());
    if (!nodes) return `0 0 400 240`;
    const wires = routeBounds(nets);
    const nameBounds = [...labels.values()].map(label => label.bounds);
    const minX = Math.min(nodes.minX, wires?.minX ?? nodes.minX, ...nameBounds.map(box => box.minX)) - MARGIN;
    const minY = Math.min(nodes.minY, wires?.minY ?? nodes.minY, ...nameBounds.map(box => box.minY)) - MARGIN;
    const maxX = Math.max(nodes.maxX, wires?.maxX ?? nodes.maxX, ...nameBounds.map(box => box.maxX)) + MARGIN;
    const maxY = Math.max(nodes.maxY, wires?.maxY ?? nodes.maxY, ...nameBounds.map(box => box.maxY)) + MARGIN;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [geometry, nets, labels]);

  const resolvedLayers = useMemo<SchematicLayers>(
    () => ({ ...DEFAULT_SCHEMATIC_LAYERS, boardBindings: false, diagnostics: false, values: values.size > 0, ...layers }),
    [layers, values.size],
  );
  const signals = useMemo(() => new Map(values), [values]);
  const interactive = Boolean(onSelectNode);

  const activate = (nodeId: string) => {
    if (selectedNodeId === nodeId && onOpenNode) onOpenNode(nodeId);
    else onSelectNode?.(nodeId);
  };

  return (
    <figure className={`rb-schematic-projection${className ? ` ${className}` : ''}`} data-testid={testId}>
      <svg
        className="rb-schematic"
        data-renderer="schematic"
        role={interactive ? 'group' : 'img'}
        aria-label={ariaLabel}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        {nets.flatMap((net) =>
          net.wires.map((wire) => (
            <g key={wire.wireId} role={onSelectWire ? 'button' : undefined}
              tabIndex={onSelectWire ? 0 : undefined}
              aria-label={onSelectWire ? `Connection from ${circuit.nodes.find(n => n.id === wire.fromNodeId)?.label ?? wire.fromNodeId} to ${circuit.nodes.find(n => n.id === wire.toNodeId)?.label ?? wire.toNodeId}` : undefined}
              aria-pressed={onSelectWire ? selectedWireId === wire.wireId : undefined}
              data-projection-wire={wire.wireId}
              onKeyDown={event => {
                if (onSelectWire && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault(); onSelectWire(wire.wireId);
                }
              }}>
            <SchematicWireView
              wire={wire}
              camera={CAMERA}
              isSelected={selectedWireId === wire.wireId}
              isNetHighlighted={selectedNodeId !== null && (wire.fromNodeId === selectedNodeId || wire.toNodeId === selectedNodeId)}
              signal={values.get(`${wire.fromNodeId}.${wire.fromPort}`)}
              onSelect={() => onSelectWire?.(wire.wireId)}
            />
            </g>
          )),
        )}
        {Array.from(geometry.values()).map((entry) => {
          const kind = ioKind(entry.node);
          const label = ioLabelByNodeId?.get(entry.node.id);
          const view = (
            <SchematicNodeView
              node={entry.node}
              geometry={entry.geometry}
              labelPosition={labels.get(entry.node.id)}
              camera={CAMERA}
              lod="edit"
              isSelected={selectedNodeId === entry.node.id}
              signals={signals}
              ioPresentation={kind ? { kind, label } : undefined}
              layers={resolvedLayers}
              onToggleSwitch={drivableInputIds?.has(entry.node.id) ? onToggleInput : undefined}
            />
          );
          if (!interactive) return <g key={entry.node.id}>{view}</g>;
          const name = label ?? entry.node.label ?? entry.node.id;
          return (
            <g
              key={entry.node.id}
              className="rb-schematic-projection-node"
              role="button"
              tabIndex={0}
              aria-pressed={selectedNodeId === entry.node.id}
              aria-label={`${name}, ${entry.node.type}`}
              data-projection-node={entry.node.id}
              onClick={() => activate(entry.node.id)}
              onDoubleClick={() => onOpenNode?.(entry.node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (drivableInputIds?.has(entry.node.id) && onToggleInput) onToggleInput(entry.node.id);
                  else activate(entry.node.id);
                }
              }}
            >
              {view}
            </g>
          );
        })}
      </svg>
    </figure>
  );
};
