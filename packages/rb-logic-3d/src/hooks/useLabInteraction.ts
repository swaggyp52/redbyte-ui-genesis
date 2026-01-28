import { useRef, useCallback, useEffect } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { useLabStore } from '../lab-model/store';
import { Vector3 } from 'three';

export const useLabInteraction = () => {
    const { camera, raycaster, pointer, invalidate } = useThree();

    // Actions from store
    const setHoveredPin = useLabStore(state => state.setHoveredPin);
    const startWire = useLabStore(state => state.startWire);
    const addWire = useLabStore(state => state.addWire);
    const cancelWire = useLabStore(state => state.cancelWire);
    const updateDragPosition = useLabStore(state => state.updateDragPosition);

    // State from store
    const interactionMode = useLabStore(state => state.interaction.mode);
    const wireStartPin = useLabStore(state => state.interaction.wireStartPin);

    // Cancel on ESC or Right Click
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') cancelWire();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cancelWire]);

    const lastMoveRef = useRef(0);
    const dragPointRef = useRef(new Vector3());

    const handlePointerMove = useCallback((_event: ThreeEvent<PointerEvent>) => {
        // e.stopPropagation(); // Don't block orbit controls entirely by default

        // If wiring, update drag position for ghost wire
        if (interactionMode === 'wire' && wireStartPin) {
            const now = performance.now();
            if (now - lastMoveRef.current < 33) return;
            lastMoveRef.current = now;

            // Project pointer to a plane at the start pin's height? 
            // Better: Raycast close to standard ground or part height
            // Simple MVP: standard ground plane raycast
            raycaster.setFromCamera(pointer, camera);
            const groundY = 0.5; // Approx breadboard height
            const t = (groundY - raycaster.ray.origin.y) / raycaster.ray.direction.y;
            if (t > 0) {
                const pos = dragPointRef.current;
                pos.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, t);
                updateDragPosition({ x: pos.x, y: pos.y, z: pos.z });
                invalidate();
            }
        }
    }, [interactionMode, wireStartPin, updateDragPosition, raycaster, pointer, camera, invalidate]);

    const handlePinHover = useCallback((nodeId: string, pinId: string, e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation(); // Pin hover blocks other hovers
        setHoveredPin({ nodeId, pinId });
    }, [setHoveredPin]);

    const handlePinUnhover = useCallback((nodeId: string, pinId: string, e: ThreeEvent<PointerEvent>) => {
        setHoveredPin(null);
    }, [setHoveredPin]);

    const handlePinClick = useCallback((nodeId: string, pinId: string, e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();

        if (interactionMode === 'orbit') {
            // Start wiring
            startWire(nodeId, pinId);
        } else if (interactionMode === 'wire') {
            // Complete wiring
            if (wireStartPin && (wireStartPin.nodeId !== nodeId || wireStartPin.pinId !== pinId)) {

                // Add wire to graph
                const state = useLabStore.getState();
                const nextId = `wire-${state.simulation.tick}-${state.timeline.events.length}`;
                addWire({
                    id: nextId,
                    sourceNodeId: wireStartPin.nodeId,
                    sourcePinId: wireStartPin.pinId,
                    targetNodeId: nodeId,
                    targetPinId: pinId,
                    color: '#2ecc71', // Default green
                });

                cancelWire(); // Reset mode
            }
        }
    }, [interactionMode, wireStartPin, startWire, addWire, cancelWire]);

    return {
        handlePointerMove,
        handlePinHover,
        handlePinUnhover,
        handlePinClick
    };
};
