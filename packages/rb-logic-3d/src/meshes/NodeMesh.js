import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createNeonMaterial, NODE_COLORS } from '../materials/neonMaterial';
import { createNodeGeometry, getGeometryRotation, getGeometryScale } from './geometries';
import { SelectionGlow } from '../components/SelectionGlow';
export const NodeMesh = React.forwardRef(({ id, type, position, isActive, isSelected = false, isMismatch = false, pulse = 0, onSelect, onHover, }, ref) => {
    const localRef = useRef(null);
    // Merge refs so both local usage and parent access work
    React.useImperativeHandle(ref, () => localRef.current);
    const [hovered, setHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const material = useMemo(() => {
        const color = isMismatch ? '#f97316' : NODE_COLORS[type] || '#94a3b8';
        return createNeonMaterial(color, isActive || isMismatch);
    }, [type, isActive, isMismatch]);
    const geometry = useMemo(() => createNodeGeometry(type), [type]);
    const rotation = useMemo(() => getGeometryRotation(type), [type]);
    const scale = useMemo(() => getGeometryScale(type), [type]);
    useEffect(() => {
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);
    useFrame(() => {
        if (localRef.current) {
            // Update emissive intensity based on active state
            const mat = localRef.current.material;
            const pulseBoost = pulse * 0.3;
            const targetIntensity = (isActive ? 0.35 : 0) + pulseBoost;
            mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, targetIntensity, 0.08);
        }
    });
    const handleClick = (event) => {
        event.stopPropagation();
        if (!isDragging && onSelect) {
            onSelect(id, event.shiftKey);
        }
        setIsDragging(false);
    };
    const handlePointerDown = (event) => {
        event.stopPropagation();
        setIsDragging(false);
    };
    const handlePointerMove = (event) => {
        if (event.buttons > 0) {
            setIsDragging(true);
        }
    };
    const handlePointerOver = (event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = isSelected ? 'grab' : 'pointer';
        if (onHover) {
            onHover(id);
        }
    };
    const handlePointerOut = () => {
        setHovered(false);
        document.body.style.cursor = 'default';
        if (onHover) {
            onHover(null);
        }
    };
    return (_jsx("mesh", { ref: localRef, position: position, material: material, geometry: geometry, rotation: rotation, scale: scale, onClick: handleClick, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerOver: handlePointerOver, onPointerOut: handlePointerOut, userData: { nodeId: id }, children: _jsx(SelectionGlow, { isSelected: isSelected, isHovered: hovered }) }));
});
NodeMesh.displayName = 'NodeMesh';
