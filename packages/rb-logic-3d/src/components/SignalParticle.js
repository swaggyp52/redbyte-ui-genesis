import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import * as THREE from 'three';
const PARTICLE_SPEED = 2; // Units per second (progress per second)
// Note: progress goes 0..1. Speed = 2 means it traverses the specific curve in 0.5s.
// The original code had constant PARTICLE_SPEED regardless of length, which means
// short wires were fast, long wires were fast.
// Actually, progress 0..1 implies normalized.
// If existing code used `progress + delta * SPEED`, then `progress = age * SPEED`.
// So lifetime is determined by `1 / SPEED`.
const TRAVERSAL_DURATION = 1 / PARTICLE_SPEED;
const SPAWN_INTERVAL = 0.2; // Seconds between particle spawns
export const SignalParticleSystem = ({ from, to, isActive, wireId, currentTime, }) => {
    // Create curve path
    const curve = React.useMemo(() => {
        const fromVec = new THREE.Vector3(...from);
        const toVec = new THREE.Vector3(...to);
        // Add slight arc
        const midPoint = new THREE.Vector3().lerpVectors(fromVec, toVec, 0.5);
        midPoint.y += 0.3;
        return new THREE.CatmullRomCurve3([fromVec, midPoint, toVec]);
    }, [from, to]);
    // Purely functional particle determination
    // We want particles spawned at t = k * SPAWN_INTERVAL
    // such that their age at currentTime is < TRAVERSAL_DURATION
    // AND they were spawned after the wire became active (if we tracked that).
    // For A+++ visual polish, we assume "Active" acts as a gate.
    // If not active, no particles. If active, we render the "steady state" stream.
    // This avoids storing "when did it become active".
    if (!isActive)
        return null;
    const nowSec = currentTime / 1000;
    // Particles live from age 0 to TRAVERSAL_DURATION
    // SpawnTime = k * SPAWN_INTERVAL
    // Age = nowSec - SpawnTime
    // 0 <= nowSec - k*INTERVAL <= TRAVERSAL_DURATION
    // k*INTERVAL <= nowSec
    // k*INTERVAL >= nowSec - TRAVERSAL_DURATION
    // k <= nowSec / INTERVAL
    // k >= (nowSec - TRAVERSAL_DURATION) / INTERVAL
    const threadOffset = 0; // Could use wireId hash to offset phases if desired
    const minK = Math.ceil((nowSec - TRAVERSAL_DURATION) / SPAWN_INTERVAL);
    const maxK = Math.floor(nowSec / SPAWN_INTERVAL);
    const particles = [];
    for (let k = minK; k <= maxK; k++) {
        const spawnTime = k * SPAWN_INTERVAL;
        const age = nowSec - spawnTime;
        const progress = age * PARTICLE_SPEED;
        // Safety clamp (though mathematical bounds should hold)
        if (progress >= 0 && progress <= 1) {
            particles.push({ k, progress });
        }
    }
    return (_jsx(_Fragment, { children: particles.map(({ k, progress }) => {
            const position = curve.getPointAt(progress);
            const opacity = 1; // Solid during traversal? Or fade out?
            // Original had "fade out based on AGE vs PARTICLE_LIFETIME".
            // Use a simple fade at the very end
            const fade = progress > 0.8 ? (1 - progress) / 0.2 : 1;
            return (_jsxs("mesh", { position: [position.x, position.y, position.z], children: [_jsx("sphereGeometry", { args: [0.1, 8, 8] }), _jsx("meshStandardMaterial", { color: "#00ffff", emissive: "#00ffff", emissiveIntensity: 1, transparent: true, opacity: fade })] }, `${wireId}-p-${k}`));
        }) }));
};
