import React, { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Node } from '@redbyte/rb-logic-core';
import { SchematicNodeView, type NodeIoPresentation, type SchematicLayers } from '@redbyte/rb-logic-view';
import { netValue, pinWorldPoint, type CircuitScene, type SceneSymbol } from '@redbyte/rb-logic-view/scene';
import type { BoardBinding, LogicValue, ObjectRef } from '@redbyte/rb-studio-kernel';
import {
  cameraTransform,
  fitCamera,
  lodForZoom,
  recallCamera,
  recenterOnResize,
  rememberCamera,
  textTierForZoom,
  zoomAt,
  type Camera,
  type SheetLod,
} from './camera';

/**
 * The persistent sheet. Mounted once for the whole session and never refitted by selection,
 * Run, stage change, lens change or resize: the camera moves only when the student pans, zooms,
 * presses Fit or asks to frame the selection.
 *
 * Rendering contract:
 *  - one world <g transform>: pan and zoom write one attribute, React does not re-render;
 *  - symbols re-render only when topology, selection or level of detail changes;
 *  - values are written imperatively as data-value on each net group, only where they changed.
 */

export type ValueState = 'none' | 'live' | 'recorded' | 'withdrawn';
export type SheetMode = 'edit' | 'explore' | 'inspect';
export interface StateWindow {
  readonly prior: string;
  readonly current: string;
  /** Captured at this step but not yet visible on Q (the event view, before the shared commit). */
  readonly pending?: boolean;
  /** The change happened at the part's own recorded clock edge (false: no edge, e.g. a clear). */
  readonly clocked?: boolean;
  readonly tick?: number;
}

/** Why a pin click did not make a wire, for the status line. */
export type WireRefusal = 'same-direction' | 'same-part';

export interface SheetProps {
  readonly projectId: string;
  readonly scene: CircuitScene;
  readonly values: ReadonlyMap<string, LogicValue>;
  readonly valueState: ValueState;
  readonly stateWindows: ReadonlyMap<string, StateWindow> | null;
  readonly selection: ObjectRef | null;
  readonly selectedNodeId: string | null;
  readonly selectedNetId: string | null;
  readonly selectedWireId: string | null;
  readonly focusNodeIds: ReadonlySet<string> | null;
  readonly unconnected: ReadonlySet<string>;
  readonly bindings: ReadonlyMap<string, BoardBinding>;
  readonly mode: SheetMode;
  readonly reducedMotion: boolean;
  readonly fitRequest: number;
  readonly frameRequest: number;
  /** Zoom about the view centre by `factor`; a new `seq` applies it once. */
  readonly zoomRequest?: { readonly seq: number; readonly factor: number };
  readonly onSelect: (ref: ObjectRef | null) => void;
  readonly onMoveNode: (nodeId: string, position: { x: number; y: number }) => void;
  readonly onConnect: (from: { nodeId: string; port: string }, to: { nodeId: string; port: string }) => void;
  readonly onToggleInput: (nodeId: string) => void;
  readonly onCameraChange?: (camera: Camera) => void;
  /** Nets driven by a clock source keep their neutral ink; their tag shows the recorded level. */
  readonly clockNodeIds?: ReadonlySet<string>;
  /** The recording shows the clock rising at this Moment: clock tags read '↑' instead of the level. */
  readonly clockRose?: boolean;
  /** Edit: the pin a wire is being drawn from (null when none), and a click that made no wire. */
  readonly onPendingWireChange?: (port: { nodeId: string; port: string } | null) => void;
  readonly onWireRefused?: (reason: WireRefusal) => void;
  readonly ariaLabel: string;
  readonly children?: React.ReactNode;
}

const IDENTITY = Object.freeze({ x: 0, y: 0, zoom: 1 });
const SYMBOL_LAYERS: SchematicLayers = Object.freeze({
  netLabels: true,
  values: false,
  boardBindings: false,
  diagnostics: false,
  hierarchy: true,
  buses: true,
});
const GRID = 16;

function ioKind(node: Node): NodeIoPresentation['kind'] | null {
  if (node.type === 'Clock') return 'clock';
  if (node.type === 'INPUT' || node.type === 'Switch') return 'switch';
  if (node.type === 'OUTPUT' || node.type === 'Lamp') return 'led';
  return null;
}

function polyline(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function valueAttr(value: LogicValue | undefined, state: ValueState): string | null {
  if (state === 'none' || state === 'withdrawn') return null;
  if (value === undefined) return 'none';
  return value === 1 ? '1' : value === 0 ? '0' : value === 'X' ? 'x' : 'z';
}

interface SheetNodeProps {
  readonly symbol: SceneSymbol;
  readonly lod: SheetLod;
  readonly selected: boolean;
  readonly dimmed: boolean;
  readonly mode: SheetMode;
  readonly pendingPort: { nodeId: string; port: string } | null;
  readonly binding: BoardBinding | undefined;
  readonly stateWindow: StateWindow | undefined;
  readonly onPointerDown: (event: React.PointerEvent<SVGGElement>, symbol: SceneSymbol) => void;
  readonly onPortClick: (nodeId: string, port: string) => void;
  readonly onActivate: (symbol: SceneSymbol) => void;
}

const SheetNode = memo(function SheetNode({
  symbol, lod, selected, dimmed, mode, pendingPort, binding, stateWindow, onPointerDown, onPortClick, onActivate,
}: SheetNodeProps) {
  const kind = ioKind(symbol.node);
  const name = symbol.node.label?.trim() || symbol.nodeId;
  const body = symbol.geometry.body;
  // The margin prints what the port's title does not already say: the board resource when it
  // differs from the name, and the package pin.
  const margin = binding
    ? binding.name.toUpperCase() === name.toUpperCase()
      ? binding.packagePin ? `pin ${binding.packagePin}` : null
      : binding.packagePin ? `${binding.name} · ${binding.packagePin}` : binding.name
    : null;
  // The state window is printed on the register, in the band between its data and clock rows.
  const dataPin = symbol.geometry.pins.find((pin) => pin.direction === 'in' && !pin.clock);
  const clockPin = symbol.geometry.pins.find((pin) => pin.clock);
  const windowY = dataPin && clockPin ? (dataPin.y + clockPin.y) / 2 : (body.minY + body.maxY) / 2;
  return (
    <g
      className={`mrd-sheet-node${dimmed ? ' mrd-dimmed' : ''}`}
      data-sheet-node={symbol.nodeId}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${name}, ${symbol.geometry.typeLabel || symbol.node.type}${binding ? `, bound to ${binding.name}` : ''}`}
      onPointerDown={(event) => onPointerDown(event, symbol)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate(symbol);
        }
      }}
    >
      <SchematicNodeView
        node={symbol.node}
        geometry={symbol.geometry}
        labelPosition={symbol.label}
        camera={IDENTITY}
        lod={lod}
        isSelected={selected}
        ioPresentation={kind ? { kind, label: name } : undefined}
        layers={SYMBOL_LAYERS}
        wireStartPort={pendingPort ? { nodeId: pendingPort.nodeId, portName: pendingPort.port } : undefined}
        onPortClick={mode === 'edit' ? onPortClick : undefined}
      />
      <rect className="mrd-focus-ring" x={symbol.x + body.minX - 7} y={symbol.y + body.minY - 7}
        width={body.maxX - body.minX + 14} height={body.maxY - body.minY + 14} rx={3} />
      {binding && margin && lod !== 'overview' ? (
        <text className="mrd-margin-pin" x={symbol.x} y={symbol.y + symbol.geometry.bounds.maxY + 22} textAnchor="middle" data-margin-pin={binding.name}>
          {margin}
        </text>
      ) : null}
      {stateWindow && lod !== 'overview' ? (
        <g className="mrd-state-window" data-state-window={symbol.nodeId} data-pending={stateWindow.pending ? '1' : undefined}
          transform={`translate(${symbol.x + (body.minX + body.maxX) / 2}, ${symbol.y + windowY})`}>
          <title>{stateWindow.pending
            ? stateWindow.clocked ? `Captured ${stateWindow.current} at this clock edge · Q updates just after it` : `Changes to ${stateWindow.current} at this step, with no clock edge · Q updates just after it`
            : stateWindow.prior === stateWindow.current ? `Stored value ${stateWindow.current}, unchanged at t${stateWindow.tick ?? ''}`
              : stateWindow.clocked ? `Stored value: ${stateWindow.prior} before t${stateWindow.tick ?? ''}'s clock edge, ${stateWindow.current} after it`
                : `Stored value: ${stateWindow.prior} at the previous tick, ${stateWindow.current} at t${stateWindow.tick ?? ''} (not at a clock edge)`}</title>
          <rect x={-21} y={-8} width={42} height={16} rx={2} />
          <text x={0} y={4} textAnchor="middle">{`${stateWindow.prior}→${stateWindow.current}${stateWindow.pending ? '…' : ''}`}</text>
        </g>
      ) : null}
    </g>
  );
});

export const Sheet: React.FC<SheetProps> = ({
  projectId, scene, values, valueState, stateWindows, selectedNodeId, selectedNetId, selectedWireId, focusNodeIds,
  unconnected, bindings, mode, reducedMotion, fitRequest, frameRequest, zoomRequest, onSelect, onMoveNode, onConnect, onToggleInput,
  onCameraChange, ariaLabel, children, clockNodeIds, clockRose = false, onPendingWireChange, onWireRefused,
}) => {
  const gridId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const worldRef = useRef<SVGGElement | null>(null);
  const gridRef = useRef<SVGPatternElement | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const animationRef = useRef<number | null>(null);
  const netRefs = useRef(new Map<string, SVGGElement>());
  const tagRefs = useRef(new Map<string, SVGTextElement>());
  const pendingPathRef = useRef<SVGPathElement | null>(null);
  const [lod, setLod] = useState<SheetLod>('edit');
  const [pendingPort, setPendingPort] = useState<{ nodeId: string; port: string } | null>(null);
  const [panning, setPanning] = useState(false);

  const applyCamera = useCallback((camera: Camera, persist = true) => {
    cameraRef.current = camera;
    worldRef.current?.setAttribute('transform', cameraTransform(camera));
    if (gridRef.current) {
      const size = GRID * camera.zoom;
      gridRef.current.setAttribute('width', String(size));
      gridRef.current.setAttribute('height', String(size));
      gridRef.current.setAttribute('x', String(camera.x % size));
      gridRef.current.setAttribute('y', String(camera.y % size));
    }
    svgRef.current?.setAttribute('data-zoom', camera.zoom.toFixed(3));
    svgRef.current?.setAttribute('data-text', textTierForZoom(camera.zoom));
    const nextLod = lodForZoom(camera.zoom);
    setLod((current) => (current === nextLod ? current : nextLod));
    if (persist) rememberCamera(projectId, camera);
    onCameraChange?.(camera);
  }, [projectId, onCameraChange]);

  const travelTo = useCallback((target: Camera) => {
    const from = cameraRef.current;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    if (!from || reducedMotion) {
      applyCamera(target);
      return;
    }
    const start = performance.now();
    const duration = 240;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      applyCamera({ x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, zoom: from.zoom + (target.zoom - from.zoom) * k }, t === 1);
      animationRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animationRef.current = requestAnimationFrame(step);
  }, [applyCamera, reducedMotion]);

  // Size tracking; the first measured size frames the work once per session (or restores it).
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      const previous = sizeRef.current;
      sizeRef.current = { width: rect.width, height: rect.height };
      if (rect.width <= 0 || rect.height <= 0) return;
      if (!cameraRef.current) {
        applyCamera(recallCamera(projectId) ?? fitCamera(scene.bounds, rect.width, rect.height));
      } else if (previous.width !== rect.width || previous.height !== rect.height) {
        applyCamera(recenterOnResize(cameraRef.current, previous, sizeRef.current));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
    // The camera is owned by the student; topology changes never refit it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (fitRequest === 0) return;
    const { width, height } = sizeRef.current;
    travelTo(fitCamera(scene.bounds, width, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequest]);

  // Zoom about the centre of the view (the title-strip View controls).
  useEffect(() => {
    const camera = cameraRef.current;
    if (!zoomRequest || zoomRequest.seq === 0 || !camera) return;
    applyCamera(zoomAt(camera, zoomRequest.factor, sizeRef.current.width / 2, sizeRef.current.height / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomRequest?.seq]);

  useEffect(() => {
    if (frameRequest === 0 || !selectedNodeId) return;
    const focus = scene.symbolById.get(selectedNodeId);
    if (!focus) return;
    const neighbours = new Set<string>([selectedNodeId]);
    for (const net of scene.nets) {
      const touches = net.driver.nodeId === selectedNodeId || net.loads.some((load) => load.nodeId === selectedNodeId);
      if (!touches) continue;
      neighbours.add(net.driver.nodeId);
      for (const load of net.loads) neighbours.add(load.nodeId);
    }
    let box = { ...focus.bounds };
    for (const id of neighbours) {
      const symbol = scene.symbolById.get(id);
      if (!symbol) continue;
      box = {
        minX: Math.min(box.minX, symbol.bounds.minX), minY: Math.min(box.minY, symbol.bounds.minY),
        maxX: Math.max(box.maxX, symbol.bounds.maxX), maxY: Math.max(box.maxY, symbol.bounds.maxY),
      };
    }
    const { width, height } = sizeRef.current;
    travelTo(fitCamera(box, width, height, 72, 2.2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameRequest]);

  // Values: O(nets) comparison, O(changed) DOM writes, zero React re-renders of symbols.
  useLayoutEffect(() => {
    for (const net of scene.nets) {
      const group = netRefs.current.get(net.netId);
      if (!group) continue;
      const value = valueState === 'live' || valueState === 'recorded' ? netValue(net, values) : undefined;
      const attr = valueAttr(value, valueState);
      if (attr === null) {
        if (group.hasAttribute('data-value')) group.removeAttribute('data-value');
      } else if (group.getAttribute('data-value') !== attr) {
        group.setAttribute('data-value', attr);
      }
      const tag = tagRefs.current.get(net.netId);
      const clock = clockNodeIds?.has(net.driver.nodeId) ?? false;
      const text = value === undefined ? '' : clock && clockRose ? '↑' : String(value);
      if (tag && tag.textContent !== text) tag.textContent = text;
    }
  }, [scene, values, valueState, clockNodeIds, clockRose]);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    const camera = cameraRef.current ?? IDENTITY;
    return {
      x: (clientX - (rect?.left ?? 0) - camera.x) / camera.zoom,
      y: (clientY - (rect?.top ?? 0) - camera.y) / camera.zoom,
    };
  }, []);

  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const camera = cameraRef.current;
    if (!camera) return;
    const rect = svgRef.current!.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
      const factor = Math.exp(-event.deltaY * 0.0015);
      applyCamera(zoomAt(camera, factor, event.clientX - rect.left, event.clientY - rect.top));
    } else {
      applyCamera({ ...camera, x: camera.x - event.deltaX });
    }
  }, [applyCamera]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Background drag pans; a click without movement clears the selection.
  const onBackgroundPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget && !(event.target as Element).classList.contains('mrd-sheet-bg')) return;
    const camera = cameraRef.current;
    if (!camera) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) setPanning(true);
      moved = true;
      applyCamera({ ...camera, x: camera.x + dx, y: camera.y + dy }, false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPanning(false);
      if (moved && cameraRef.current) rememberCamera(projectId, cameraRef.current);
      if (!moved) {
        if (pendingPort) setPendingPort(null);
        else onSelect(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const activate = useCallback((symbol: SceneSymbol) => {
    if (mode === 'explore' && (symbol.geometry.kind === 'io-in' || symbol.geometry.kind === 'clock')) onToggleInput(symbol.nodeId);
    onSelect({ kind: 'node', scope: [], nodeId: symbol.nodeId });
  }, [mode, onSelect, onToggleInput]);

  // Symbol press: a click selects (and drives an input while exploring); a drag moves it in Edit.
  const onSymbolPointerDown = useCallback((event: React.PointerEvent<SVGGElement>, symbol: SceneSymbol) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const group = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = cameraRef.current?.zoom ?? 1;
    let moved = false;
    const move = (e: PointerEvent) => {
      if (mode !== 'edit') return;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;
      if (!moved && Math.hypot(dx * zoom, dy * zoom) < 4) return;
      moved = true;
      group.setAttribute('transform', `translate(${Math.round(dx / GRID) * GRID} ${Math.round(dy / GRID) * GRID})`);
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        const dx = Math.round((e.clientX - startX) / zoom / GRID) * GRID;
        const dy = Math.round((e.clientY - startY) / zoom / GRID) * GRID;
        group.removeAttribute('transform');
        if (dx !== 0 || dy !== 0) onMoveNode(symbol.nodeId, { x: symbol.x + dx, y: symbol.y + dy });
      } else {
        activate(symbol);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [activate, mode, onMoveNode]);

  const onPortClick = useCallback((nodeId: string, port: string) => {
    if (!pendingPort) {
      setPendingPort({ nodeId, port });
      return;
    }
    if (pendingPort.nodeId === nodeId && pendingPort.port === port) {
      setPendingPort(null);
      return;
    }
    const pinDirection = (id: string, name: string) =>
      scene.symbolById.get(id)?.geometry.pins.find((pin) => pin.id === name)?.direction ?? null;
    const a = pendingPort;
    const b = { nodeId, port };
    const aDir = pinDirection(a.nodeId, a.port);
    const bDir = pinDirection(b.nodeId, b.port);
    if (a.nodeId === b.nodeId) onWireRefused?.('same-part');
    else if (aDir && bDir && aDir !== bDir) onConnect(aDir === 'out' ? a : b, aDir === 'out' ? b : a);
    else onWireRefused?.('same-direction');
    setPendingPort(null);
  }, [onConnect, onWireRefused, pendingPort, scene]);

  useEffect(() => {
    if (mode !== 'edit') setPendingPort(null);
  }, [mode]);
  useEffect(() => {
    onPendingWireChange?.(pendingPort);
  }, [onPendingWireChange, pendingPort]);

  useEffect(() => {
    if (!pendingPort) return;
    const start = pinWorldPoint(scene.index.get(pendingPort.nodeId), pendingPort.port);
    const move = (e: PointerEvent) => {
      const point = toWorld(e.clientX, e.clientY);
      if (start) pendingPathRef.current?.setAttribute('d', `M ${start.x} ${start.y} L ${point.x} ${point.y}`);
    };
    const escape = (e: KeyboardEvent) => {
      // Capture phase: cancelling the pending wire consumes this Esc (the studio skips it).
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setPendingPort(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', escape, true);
    };
  }, [pendingPort, scene, toWorld]);

  const selectedSymbol = selectedNodeId ? scene.symbolById.get(selectedNodeId) ?? null : null;
  const unconnectedPoints = useMemo(() => [...unconnected].flatMap((key) => {
    const dot = key.lastIndexOf('.');
    const point = pinWorldPoint(scene.index.get(key.slice(0, dot)), key.slice(dot + 1));
    return point ? [{ key, x: point.x, y: point.y }] : [];
  }), [scene, unconnected]);

  return (
    <div className="mrd-sheet-wrap" style={{ position: 'absolute', inset: 0 }}>
      <svg
        ref={svgRef}
        className="mrd-sheet"
        data-testid="meridian-sheet"
        data-renderer="schematic"
        data-lod={lod}
        data-mode={mode}
        data-value-state={valueState}
        data-panning={panning ? '1' : '0'}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onBackgroundPointerDown}
      >
        <defs>
          <pattern id={`mrd-grid-${gridId}`} ref={gridRef} patternUnits="userSpaceOnUse" width={GRID} height={GRID}>
            <path className="mrd-sheet-grid-minor" d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" />
          </pattern>
        </defs>
        <rect className="mrd-sheet-bg" x={0} y={0} width="100%" height="100%" fill={`url(#mrd-grid-${gridId})`} />
        <g ref={worldRef} data-layer="world">
          {/* The selection ring hugs the part's body and lies under the wires and value tags,
              so it never strikes through a name, a pin or a value. */}
          <g data-layer="selection">
            {selectedSymbol ? (
              <g data-selection-ring={selectedSymbol.nodeId}>
                <rect className="mrd-ring-inner" x={selectedSymbol.x + selectedSymbol.geometry.body.minX - 4} y={selectedSymbol.y + selectedSymbol.geometry.body.minY - 4}
                  width={selectedSymbol.geometry.body.maxX - selectedSymbol.geometry.body.minX + 8} height={selectedSymbol.geometry.body.maxY - selectedSymbol.geometry.body.minY + 8} rx={2} />
                <rect className="mrd-ring-outer" x={selectedSymbol.x + selectedSymbol.geometry.body.minX - 8} y={selectedSymbol.y + selectedSymbol.geometry.body.minY - 8}
                  width={selectedSymbol.geometry.body.maxX - selectedSymbol.geometry.body.minX + 16} height={selectedSymbol.geometry.body.maxY - selectedSymbol.geometry.body.minY + 16} rx={4} />
              </g>
            ) : null}
          </g>
          <g data-layer="nets">
            {scene.nets.map((net) => {
              // In focus: the net's driver and at least one of its loads lie in the focused cone.
              const dimmed = focusNodeIds ? !(focusNodeIds.has(net.driver.nodeId) && net.loads.some((load) => focusNodeIds.has(load.nodeId))) : false;
              const anchor = net.wires[0]?.points[0];
              return (
                <g
                  key={net.netId}
                  ref={(element) => {
                    if (element) netRefs.current.set(net.netId, element);
                    else netRefs.current.delete(net.netId);
                  }}
                  className={`mrd-net${dimmed ? ' mrd-dimmed' : ''}`}
                  data-net-id={net.netId}
                  data-clock={clockNodeIds?.has(net.driver.nodeId) ? '1' : undefined}
                  data-selected={selectedNetId === net.netId ? '1' : undefined}
                >
                  {net.wires.map((wire) => {
                    const d = polyline(wire.points);
                    return (
                      <g key={wire.wireId} data-wire-id={wire.wireId}>
                        <path className="mrd-net-halo" d={d} />
                        <path className="mrd-net-line" d={d} style={selectedWireId === wire.wireId ? { strokeWidth: 3.5 } : undefined} />
                        <path
                          className="mrd-net-hit"
                          d={d}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            onSelect({ kind: 'wire', scope: [], wireId: wire.wireId });
                          }}
                        />
                      </g>
                    );
                  })}
                  {net.junctions.map((junction) => (
                    <circle key={`${junction.x},${junction.y}`} className="mrd-net-junction" cx={junction.x} cy={junction.y} r={3.5} />
                  ))}
                  {anchor ? (
                    <text
                      className="mrd-net-tag"
                      data-net-tag={net.netId}
                      x={anchor.x + 6}
                      y={anchor.y - 6}
                      ref={(element) => {
                        if (element) tagRefs.current.set(net.netId, element);
                        else tagRefs.current.delete(net.netId);
                      }}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
          <g data-layer="symbols">
            {scene.symbols.map((symbol) => (
              <SheetNode
                key={symbol.nodeId}
                symbol={symbol}
                lod={lod}
                selected={selectedNodeId === symbol.nodeId}
                dimmed={focusNodeIds ? !focusNodeIds.has(symbol.nodeId) : false}
                mode={mode}
                pendingPort={pendingPort && pendingPort.nodeId === symbol.nodeId ? pendingPort : null}
                binding={bindings.get(symbol.nodeId)}
                stateWindow={stateWindows?.get(symbol.nodeId)}
                onPointerDown={onSymbolPointerDown}
                onPortClick={onPortClick}
                onActivate={activate}
              />
            ))}
          </g>
          <g data-layer="attention">
            {unconnectedPoints.map((point) => (
              <g key={point.key} className="mrd-unconnected" data-unconnected={point.key}>
                <title>Unconnected input · the simulator reads it as 0</title>
                <circle cx={point.x} cy={point.y} r={3.5} />
                {/* Edit shows no values: only the hollow marker, never a value-like 0. */}
                {mode !== 'edit' ? <text x={point.x - 6} y={point.y - 6} textAnchor="end">0·</text> : null}
              </g>
            ))}
            {pendingPort ? <path ref={pendingPathRef} className="mrd-pending-wire" d="" /> : null}
          </g>
        </g>
      </svg>
      {children}
    </div>
  );
};
