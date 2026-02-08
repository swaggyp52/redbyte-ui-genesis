import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
const NODE_COLORS = {
    PowerSource: '#4ade80',
    Switch: '#60a5fa',
    Lamp: '#fbbf24',
    Wire: '#94a3b8',
    AND: '#c084fc',
    OR: '#f472b6',
    NOT: '#fb923c',
    NAND: '#a78bfa',
    XOR: '#ec4899',
    Clock: '#3B82F6',
    Delay: '#a3e635',
    FullAdder: '#818cf8',
    RSLatch: '#f87171',
    DFlipFlop: '#34d399',
    JKFlipFlop: '#fcd34d',
    Counter4Bit: '#e879f9',
};
const NodeViewComponent = ({ node, camera, isSelected, isHighlighted = false, isMismatchHighlighted = false, mismatchPortKeys = null, onSelect, onMove, onPortClick, onToggleSwitch, onNodeDoubleClick, onProbeToggle, signals, chipMetadata, wireStartPort, onPortHover, onPortLeave, probedPorts, highlightedPort, debugTick, }) => {
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
    const [dragPosition, setDragPosition] = React.useState({ x: node.position.x, y: node.position.y });
    const [hoveredPort, setHoveredPort] = React.useState(null);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isToggleHovered, setIsToggleHovered] = React.useState(false);
    const [hoveredProbePort, setHoveredProbePort] = React.useState(null);
    const getPortValue = React.useCallback((portName) => {
        if (!signals)
            return 0;
        return (signals.get(`${node.id}.${portName}`) ?? 0);
    }, [signals, node.id]);
    const isPortMismatch = React.useCallback((portName) => {
        if (!mismatchPortKeys)
            return false;
        return mismatchPortKeys.has(`${node.id}:${portName}`);
    }, [mismatchPortKeys, node.id]);
    const renderHoverBadge = (x, y, portName) => {
        if (!isHovered || hoveredPort !== portName)
            return null;
        const value = getPortValue(portName);
        const tickLabel = typeof debugTick === 'number' ? `t${debugTick}` : 't';
        return (_jsxs("g", { children: [_jsx("rect", { x: x - 20, y: y - 10, width: 36, height: 16, rx: 2, fill: "#1e293b", stroke: "#00ffff", strokeWidth: 1, style: { pointerEvents: 'none' } }), _jsxs("text", { x: x - 2, y: y - 2, textAnchor: "middle", dominantBaseline: "middle", fill: value === 1 ? '#22c55e' : '#9ca3af', fontSize: 8, fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: [tickLabel, ":", value] })] }));
    };
    const renderMismatchRing = (x, y, portName) => {
        if (!isPortMismatch(portName))
            return null;
        return (_jsx("circle", { cx: x, cy: y, r: 6, fill: "none", stroke: "#ef4444", strokeWidth: 2, opacity: 0.9, className: "animate-pulse", style: { pointerEvents: 'none' } }));
    };
    const screenX = (isDragging ? dragPosition.x : node.position.x) * camera.zoom + camera.x;
    const screenY = (isDragging ? dragPosition.y : node.position.y) * camera.zoom + camera.y;
    const size = 48 * camera.zoom;
    const isSwitch = node.type === 'Switch' || node.type === 'INPUT';
    const switchState = node.state?.isOn ?? 0;
    const toggleWidth = size * 0.75; // Increased from 0.66
    const toggleHeight = 16; // Increased from 14
    const toggleX = -toggleWidth / 2;
    const toggleY = -size / 2 - 20; // Moved slightly further up
    const toggleHitWidth = size * 1.0; // Increased hit area
    const toggleHitHeight = 28; // Increased hit area
    const toggleHitX = -toggleHitWidth / 2;
    const toggleHitY = toggleY - (toggleHitHeight - toggleHeight) / 2;
    const isIssueHighlighted = (portName) => highlightedPort?.nodeId === node.id && highlightedPort.portName === portName;
    const handlePointerDown = (e) => {
        if (e.button !== 0)
            return;
        e.stopPropagation();
        // Capture pointer to ensure we get events even if cursor leaves the element
        e.currentTarget.setPointerCapture(e.pointerId);
        // Don't start drag yet - wait for movement
        // Store initial client position to calculate delta
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragPosition({ x: node.position.x, y: node.position.y });
        onSelect(node.id, e.shiftKey);
    };
    const handleToggleClick = (e) => {
        e.stopPropagation();
        // Only toggle if NOT drawing a wire
        if (!wireStartPort && onToggleSwitch) {
            onToggleSwitch(node.id);
        }
    };
    const handleToggleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDoubleClick = (e) => {
        e.stopPropagation();
        // Double-click for chip drill-down only (not switches)
        if (!isSwitch && onNodeDoubleClick) {
            onNodeDoubleClick(node.id);
        }
    };
    const handlePointerMove = (e) => {
        // Only start drag if mouse moved more than 3px (prevents accidental drag on click)
        if (!isDragging && dragStart.x !== 0) {
            const dx = Math.abs(e.clientX - dragStart.x);
            const dy = Math.abs(e.clientY - dragStart.y);
            if (dx > 3 || dy > 3) {
                setIsDragging(true);
            }
        }
        if (!isDragging)
            return;
        // Use camera zoom to convert screen delta to world delta
        const dx = (e.clientX - dragStart.x) / camera.zoom;
        const dy = (e.clientY - dragStart.y) / camera.zoom;
        // Update local position immediately for smooth dragging
        setDragPosition({
            x: node.position.x + dx,
            y: node.position.y + dy,
        });
    };
    const handlePointerUp = (e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (isDragging) {
            // Commit the final position when drag ends
            onMove(node.id, dragPosition.x, dragPosition.y);
            setIsDragging(false);
            setDragStart({ x: 0, y: 0 });
        }
        else if (dragStart.x !== 0) {
            // Click without drag
            setDragStart({ x: 0, y: 0 });
        }
    };
    // No longer need global window listener because we have pointer capture!
    const color = NODE_COLORS[node.type] || '#94a3b8';
    const isActive = signals?.get(`${node.id}.out`) === 1;
    const isChip = !!chipMetadata;
    // Render custom chip with black-box appearance
    if (isChip && chipMetadata) {
        const chipColor = chipMetadata.color || '#1e293b'; // Dark slate for chips
        const chipHeight = size * 1.5; // Taller for chips with multiple ports
        const portSpacing = chipHeight / (Math.max(chipMetadata.inputs.length, chipMetadata.outputs.length) + 1);
        return (_jsxs("g", { transform: `translate(${screenX}, ${screenY}) rotate(${node.rotation})`, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onDoubleClick: handleDoubleClick, onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), style: { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }, children: [isHighlighted && (_jsx("rect", { x: -size / 2 - 4, y: -chipHeight / 2 - 4, width: size + 8, height: chipHeight + 8, fill: "none", stroke: "#3B82F6", strokeWidth: 2, rx: 8, className: "animate-pulse", style: { pointerEvents: 'none' } })), _jsx("rect", { x: -size / 2, y: -chipHeight / 2, width: size, height: chipHeight, fill: chipColor, stroke: isSelected ? '#3b82f6' : isHovered ? '#8b5cf6' : '#475569', strokeWidth: isSelected ? 3 : isHovered ? 2.5 : 2, rx: 6 }), isMismatchHighlighted && (_jsx("rect", { x: -size / 2 - 4, y: -chipHeight / 2 - 4, width: size + 8, height: chipHeight + 8, fill: "none", stroke: "#f97316", strokeWidth: 2, rx: 8, opacity: 0.8, style: { pointerEvents: 'none' } })), isHovered && onNodeDoubleClick && (_jsx("text", { x: 0, y: -chipHeight / 2 - 8, textAnchor: "middle", fill: "#8b5cf6", fontSize: 9, fontWeight: "500", style: { pointerEvents: 'none', userSelect: 'none' }, children: "Double-click to explore" })), _jsx("circle", { cx: 0, cy: -chipHeight / 4, r: 3, fill: "#64748b", opacity: 0.5 }), _jsx("circle", { cx: -6, cy: chipHeight / 4, r: 2, fill: "#64748b", opacity: 0.5 }), _jsx("circle", { cx: 6, cy: chipHeight / 4, r: 2, fill: "#64748b", opacity: 0.5 }), _jsx("line", { x1: 0, y1: -chipHeight / 4 + 3, x2: -6, y2: chipHeight / 4 - 2, stroke: "#64748b", strokeWidth: 1, opacity: 0.3 }), _jsx("line", { x1: 0, y1: -chipHeight / 4 + 3, x2: 6, y2: chipHeight / 4 - 2, stroke: "#64748b", strokeWidth: 1, opacity: 0.3 }), _jsx("text", { x: 0, y: chipHeight / 2 + 12, textAnchor: "middle", fill: "#94a3b8", fontSize: Math.max(8, 10 * camera.zoom), fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: chipMetadata.name }), chipMetadata.layer !== undefined && (_jsxs("text", { x: 0, y: -chipHeight / 2 - 8, textAnchor: "middle", fill: "#64748b", fontSize: Math.max(7, 8 * camera.zoom), style: { pointerEvents: 'none', userSelect: 'none' }, children: ["L", chipMetadata.layer] })), chipMetadata.inputs.map((input, i) => {
                    const yPos = -chipHeight / 2 + portSpacing * (i + 1);
                    const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === input.id;
                    const isHovered = hoveredPort === input.id;
                    const shouldGlow = isWireStart || (isHovered && wireStartPort);
                    const isIssueHighlight = isIssueHighlighted(input.id);
                    return (_jsxs("g", { children: [shouldGlow && (_jsx("circle", { cx: -size / 2, cy: yPos, r: 8, fill: "#00ffff", opacity: 0.4, style: { pointerEvents: 'none' } })), isIssueHighlight && (_jsx("rect", { x: -size / 2 - 6, y: yPos - 6, width: 12, height: 12, fill: "none", stroke: "#f59e0b", strokeWidth: 2, rx: 2, opacity: 0.8, style: { pointerEvents: 'none' } })), renderMismatchRing(-size / 2, yPos, input.id), _jsx("rect", { x: -size / 2 - 10, y: yPos - 10, width: 20, height: 20, fill: "transparent", style: { cursor: 'crosshair' }, onClick: (e) => {
                                    e.stopPropagation();
                                    // P-click to toggle probe
                                    if (e.shiftKey || (e.altKey && e.button === 0)) {
                                        const label = `${chipMetadata?.name || node.type} ${input.name || input.id}`;
                                        onProbeToggle?.(node.id, input.id, label);
                                    }
                                    else {
                                        onPortClick?.(node.id, input.id);
                                    }
                                }, onContextMenu: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Right-click to toggle probe
                                    const label = `${chipMetadata?.name || node.type} ${input.name || input.id}`;
                                    onProbeToggle?.(node.id, input.id, label);
                                }, onMouseEnter: () => {
                                    setHoveredPort(input.id);
                                    if (wireStartPort) {
                                        onPortHover?.(input.id);
                                    }
                                }, onMouseLeave: () => {
                                    setHoveredPort(null);
                                    if (wireStartPort) {
                                        onPortLeave?.();
                                    }
                                } }), _jsx("rect", { x: -size / 2 - 4, y: yPos - 4, width: 8, height: 8, fill: isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#3b82f6", stroke: probedPorts?.has(`${node.id}.${input.id}`) ? "#00ffff" : "#fff", strokeWidth: probedPorts?.has(`${node.id}.${input.id}`) ? 2 : isHovered ? 2 : 1, rx: 1, style: { pointerEvents: 'none' } }), probedPorts?.has(`${node.id}.${input.id}`) && (_jsxs(_Fragment, { children: [_jsx("rect", { x: -size / 2 - 4, y: yPos - 4, width: 8, height: 8, fill: "none", stroke: "#00ffff", strokeWidth: 3, rx: 1, opacity: 0.4, style: { pointerEvents: 'none' }, className: "animate-pulse" }), isHovered && hoveredPort === input.id && (_jsxs("g", { children: [_jsx("rect", { x: -size / 2 - 28, y: yPos - 8, width: 16, height: 14, rx: 2, fill: "#1e293b", stroke: "#00ffff", strokeWidth: 1, style: { pointerEvents: 'none' } }), _jsx("text", { x: -size / 2 - 20, y: yPos, textAnchor: "middle", dominantBaseline: "middle", fill: signals?.get(`${node.id}.${input.id}`) === 1 ? '#22c55e' : '#9ca3af', fontSize: 9, fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: signals?.get(`${node.id}.${input.id}`) ?? 0 })] }))] })), renderHoverBadge(-size / 2 - 12, yPos, input.id), _jsx("text", { x: -size / 2 - 8, y: yPos, textAnchor: "end", dominantBaseline: "middle", fill: "#94a3b8", fontSize: Math.max(6, 8 * camera.zoom), style: { pointerEvents: 'none', userSelect: 'none' }, children: input.name })] }, `input-${input.id}`));
                }), chipMetadata.outputs.map((output, i) => {
                    const yPos = -chipHeight / 2 + portSpacing * (i + 1);
                    const outputSignal = signals?.get(`${node.id}.${output.id}`) === 1;
                    const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === output.id;
                    const isHovered = hoveredPort === output.id;
                    const shouldGlow = isWireStart || (isHovered && wireStartPort);
                    const isIssueHighlight = isIssueHighlighted(output.id);
                    return (_jsxs("g", { children: [shouldGlow && (_jsx("circle", { cx: size / 2, cy: yPos, r: 8, fill: "#00ffff", opacity: 0.4, style: { pointerEvents: 'none' } })), isIssueHighlight && (_jsx("circle", { cx: size / 2, cy: yPos, r: 7, fill: "none", stroke: "#f59e0b", strokeWidth: 2, opacity: 0.8, style: { pointerEvents: 'none' } })), renderMismatchRing(size / 2, yPos, output.id), _jsx("circle", { cx: size / 2, cy: yPos, r: 10, fill: "transparent", style: { cursor: 'crosshair' }, onClick: (e) => {
                                    e.stopPropagation();
                                    // P-click to toggle probe
                                    if (e.shiftKey || (e.altKey && e.button === 0)) {
                                        const label = `${chipMetadata?.name || node.type} ${output.name || output.id}`;
                                        onProbeToggle?.(node.id, output.id, label);
                                    }
                                    else {
                                        onPortClick?.(node.id, output.id);
                                    }
                                }, onContextMenu: (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Right-click to toggle probe
                                    const label = `${chipMetadata?.name || node.type} ${output.name || output.id}`;
                                    onProbeToggle?.(node.id, output.id, label);
                                }, onMouseEnter: () => {
                                    setHoveredPort(output.id);
                                    if (wireStartPort) {
                                        onPortHover?.(output.id);
                                    }
                                }, onMouseLeave: () => {
                                    setHoveredPort(null);
                                    if (wireStartPort) {
                                        onPortLeave?.();
                                    }
                                } }), _jsx("circle", { cx: size / 2, cy: yPos, r: 4, fill: isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : outputSignal ? '#22c55e' : '#6b7280', stroke: probedPorts?.has(`${node.id}.${output.id}`) ? "#00ffff" : "#fff", strokeWidth: probedPorts?.has(`${node.id}.${output.id}`) ? 2 : isHovered ? 2 : 1, style: { pointerEvents: 'none' } }), probedPorts?.has(`${node.id}.${output.id}`) && (_jsxs(_Fragment, { children: [_jsx("circle", { cx: size / 2, cy: yPos, r: 6, fill: "none", stroke: "#00ffff", strokeWidth: 3, opacity: 0.4, style: { pointerEvents: 'none' }, className: "animate-pulse" }), isHovered && hoveredPort === output.id && (_jsxs("g", { children: [_jsx("rect", { x: size / 2 + 12, y: yPos - 8, width: 16, height: 14, rx: 2, fill: "#1e293b", stroke: "#00ffff", strokeWidth: 1, style: { pointerEvents: 'none' } }), _jsx("text", { x: size / 2 + 20, y: yPos, textAnchor: "middle", dominantBaseline: "middle", fill: outputSignal ? '#22c55e' : '#9ca3af', fontSize: 9, fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: outputSignal ? '1' : '0' })] }))] })), renderHoverBadge(size / 2 + 12, yPos, output.id), _jsx("text", { x: size / 2 + 8, y: yPos, textAnchor: "start", dominantBaseline: "middle", fill: "#94a3b8", fontSize: Math.max(6, 8 * camera.zoom), style: { pointerEvents: 'none', userSelect: 'none' }, children: output.name })] }, `output-${output.id}`));
                })] }));
    }
    // Standard node rendering
    return (_jsxs("g", { transform: `translate(${screenX}, ${screenY}) rotate(${node.rotation})`, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onDoubleClick: handleDoubleClick, style: { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }, "data-testid": `node-${node.type}-${node.id}`, children: [isHighlighted && (_jsx("rect", { x: -size / 2 - 4, y: -size / 2 - 4, width: size + 8, height: size + 8, fill: "none", stroke: "#3B82F6", strokeWidth: 2, rx: 6, className: "animate-pulse", style: { pointerEvents: 'none' } })), _jsx("rect", { x: -size / 2, y: -size / 2, width: size, height: size, fill: isActive ? color : '#2a2a2a', stroke: isSelected ? '#3b82f6' : color, strokeWidth: isSelected ? 3 : 1, rx: 4 }), isMismatchHighlighted && (_jsx("rect", { x: -size / 2 - 3, y: -size / 2 - 3, width: size + 6, height: size + 6, fill: "none", stroke: "#f97316", strokeWidth: 2, rx: 6, opacity: 0.8, style: { pointerEvents: 'none' } })), _jsx("text", { x: 0, y: 0, textAnchor: "middle", dominantBaseline: "middle", fill: "#fff", fontSize: Math.max(10, 12 * camera.zoom), style: { pointerEvents: 'none', userSelect: 'none' }, children: node.type }), !['PowerSource', 'Clock'].includes(node.type) && (() => {
                const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'in';
                const isHovered = hoveredPort === 'in';
                const shouldGlow = isWireStart || (isHovered && wireStartPort);
                const isIssueHighlight = isIssueHighlighted('in');
                return (_jsxs("g", { children: [shouldGlow && (_jsx("circle", { cx: -size / 2, cy: 0, r: 8, fill: "#00ffff", opacity: 0.4, style: { pointerEvents: 'none' } })), isIssueHighlight && (_jsx("circle", { cx: -size / 2, cy: 0, r: 8, fill: "none", stroke: "#f59e0b", strokeWidth: 2, opacity: 0.8, style: { pointerEvents: 'none' } })), renderMismatchRing(-size / 2, 0, 'in'), _jsx("circle", { cx: -size / 2, cy: 0, r: 5, fill: isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#3b82f6", stroke: probedPorts?.has(`${node.id}.in`) ? "#00ffff" : "#fff", strokeWidth: probedPorts?.has(`${node.id}.in`) ? 2.5 : isHovered ? 2.5 : 1.5, style: { cursor: 'crosshair' }, onClick: (e) => {
                                e.stopPropagation();
                                // P-click or right-click to toggle probe
                                if ((e.shiftKey) || (e.altKey && e.button === 0)) {
                                    const label = `${node.type} in`;
                                    onProbeToggle?.(node.id, 'in', label);
                                }
                                else {
                                    onPortClick?.(node.id, 'in');
                                }
                            }, onContextMenu: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const label = `${node.type} in`;
                                onProbeToggle?.(node.id, 'in', label);
                            }, onMouseEnter: () => setHoveredPort('in'), onMouseLeave: () => setHoveredPort(null) }), probedPorts?.has(`${node.id}.in`) && (_jsxs(_Fragment, { children: [_jsx("circle", { cx: -size / 2, cy: 0, r: 7, fill: "none", stroke: "#00ffff", strokeWidth: 3, opacity: 0.4, style: { pointerEvents: 'none' }, className: "animate-pulse" }), isHovered && hoveredPort === 'in' && (_jsxs("g", { children: [_jsx("rect", { x: -size / 2 - 26, y: -8, width: 16, height: 14, rx: 2, fill: "#1e293b", stroke: "#00ffff", strokeWidth: 1, style: { pointerEvents: 'none' } }), _jsx("text", { x: -size / 2 - 18, y: 0, textAnchor: "middle", dominantBaseline: "middle", fill: signals?.get(`${node.id}.in`) === 1 ? '#22c55e' : '#9ca3af', fontSize: 9, fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: signals?.get(`${node.id}.in`) ?? 0 })] }))] })), renderHoverBadge(-size / 2 - 12, 0, 'in')] }));
            })(), !['Lamp'].includes(node.type) && (() => {
                const isWireStart = wireStartPort?.nodeId === node.id && wireStartPort?.portName === 'out';
                const isHovered = hoveredPort === 'out';
                const shouldGlow = isWireStart || (isHovered && wireStartPort);
                const isIssueHighlight = isIssueHighlighted('out');
                return (_jsxs("g", { children: [shouldGlow && (_jsx("circle", { cx: size / 2, cy: 0, r: 8, fill: "#00ffff", opacity: 0.4, style: { pointerEvents: 'none' } })), isIssueHighlight && (_jsx("circle", { cx: size / 2, cy: 0, r: 8, fill: "none", stroke: "#f59e0b", strokeWidth: 2, opacity: 0.8, style: { pointerEvents: 'none' } })), renderMismatchRing(size / 2, 0, 'out'), _jsx("circle", { cx: size / 2, cy: 0, r: 5, fill: isWireStart ? "#00ffff" : probedPorts?.has(`${node.id}.out`) ? "#00ffff" : isActive ? '#22c55e' : '#9ca3af', stroke: probedPorts?.has(`${node.id}.out`) ? "#00ffff" : "#fff", strokeWidth: probedPorts?.has(`${node.id}.out`) ? 2.5 : isHovered ? 2.5 : 1.5, style: { cursor: 'crosshair' }, onClick: (e) => {
                                e.stopPropagation();
                                // P-click to toggle probe
                                if (e.shiftKey || (e.altKey && e.button === 0)) {
                                    const label = `${node.type} out`;
                                    onProbeToggle?.(node.id, 'out', label);
                                }
                                else {
                                    onPortClick?.(node.id, 'out');
                                }
                            }, onContextMenu: (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const label = `${node.type} out`;
                                onProbeToggle?.(node.id, 'out', label);
                            }, onMouseEnter: () => setHoveredPort('out'), onMouseLeave: () => setHoveredPort(null) }), probedPorts?.has(`${node.id}.out`) && (_jsxs(_Fragment, { children: [_jsx("circle", { cx: size / 2, cy: 0, r: 7, fill: "none", stroke: "#00ffff", strokeWidth: 3, opacity: 0.4, style: { pointerEvents: 'none' }, className: "animate-pulse" }), isHovered && hoveredPort === 'out' && (_jsxs("g", { children: [_jsx("rect", { x: size / 2 + 10, y: -8, width: 16, height: 14, rx: 2, fill: "#1e293b", stroke: "#00ffff", strokeWidth: 1, style: { pointerEvents: 'none' } }), _jsx("text", { x: size / 2 + 18, y: 0, textAnchor: "middle", dominantBaseline: "middle", fill: isActive ? '#22c55e' : '#9ca3af', fontSize: 9, fontWeight: "600", style: { pointerEvents: 'none', userSelect: 'none' }, children: isActive ? '1' : '0' })] }))] })), renderHoverBadge(size / 2 + 12, 0, 'out')] }));
            })()] }));
};
// Memoize NodeView to prevent unnecessary re-renders
export const NodeView = React.memo(NodeViewComponent, (prevProps, nextProps) => {
    // Only re-render if relevant props change
    return (prevProps.node.id === nextProps.node.id &&
        prevProps.node.type === nextProps.node.type &&
        prevProps.node.position.x === nextProps.node.position.x &&
        prevProps.node.position.y === nextProps.node.position.y &&
        prevProps.node.rotation === nextProps.node.rotation &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isHighlighted === nextProps.isHighlighted &&
        prevProps.camera.x === nextProps.camera.x &&
        prevProps.camera.y === nextProps.camera.y &&
        prevProps.camera.zoom === nextProps.camera.zoom &&
        JSON.stringify(prevProps.node.state) === JSON.stringify(nextProps.node.state) &&
        JSON.stringify(prevProps.chipMetadata) === JSON.stringify(nextProps.chipMetadata) &&
        prevProps.wireStartPort?.nodeId === nextProps.wireStartPort?.nodeId &&
        prevProps.wireStartPort?.portName === nextProps.wireStartPort?.portName &&
        // Check if relevant signals changed
        (() => {
            // Get all ports for this node
            const getPorts = (nodeType) => {
                if (nodeType === 'AND' || nodeType === 'NAND')
                    return ['a', 'b', 'out'];
                if (nodeType === 'OR' || nodeType === 'NOR' || nodeType === 'XOR' || nodeType === 'XNOR')
                    return ['a', 'b', 'out'];
                if (nodeType === 'NOT')
                    return ['in', 'out'];
                if (nodeType === 'VoltageSource')
                    return ['out'];
                if (nodeType === 'LDR')
                    return ['resistance', 'v_out'];
                if (nodeType === 'FixedResistor')
                    return ['resistance'];
                if (nodeType === 'VoltageDivider')
                    return ['v_in', 'r1', 'r2', 'v_out'];
                if (nodeType === 'LM358')
                    return ['V_plus', 'V_minus', 'out'];
                return ['in', 'out'];
            };
            const ports = getPorts(prevProps.node.type);
            for (const port of ports) {
                const prevSignal = prevProps.signals?.get(`${prevProps.node.id}.${port}`);
                const nextSignal = nextProps.signals?.get(`${nextProps.node.id}.${port}`);
                if (prevSignal !== nextSignal)
                    return false;
            }
            return true;
        })());
});
