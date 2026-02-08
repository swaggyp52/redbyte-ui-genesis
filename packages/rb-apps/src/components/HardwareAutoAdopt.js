import React, { useEffect } from 'react';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { useLabStore } from '@redbyte/rb-logic-3d';
/**
 * HardwareAutoAdopt automatically spawns 3D nodes in the Virtual Lab
 * when a hardware session is established, and removes them when disconnected.
 *
 * PHASE 1 Task 1.4: Hardware Auto-Adopt Cleanup
 *
 * Features:
 * - Auto-spawn 3D nodes (Basys3 FPGA, Arduino Uno) when hardware connects
 * - Auto-remove 3D nodes when hardware disconnects
 * - Prevent duplicate nodes (idempotent)
 * - Log add/remove operations for debugging
 */
export const HardwareAutoAdopt = () => {
    const sessions = useHardwareSessionStore((state) => state.sessions);
    const addNode = useLabStore((state) => state.addNode);
    const removeNode = useLabStore((state) => state.removeNode);
    const graphNodes = useLabStore((state) => state.graph.nodes);
    const prevSessionsRef = React.useRef(sessions);
    useEffect(() => {
        const targets = ['basys3', 'arduino-uno'];
        for (const target of targets) {
            const currentSession = sessions[target];
            const previousSession = prevSessionsRef.current[target];
            // PHASE 1.4: ADOPTION (Add node when hardware connects)
            if (currentSession.status === 'connected' && previousSession.status !== 'connected') {
                const alreadyExists = graphNodes.some(n => n.hardware_target === target);
                if (!alreadyExists) {
                    console.log(`[HardwareAutoAdopt] Spawning 3D node for: ${target}`);
                    const type = target === 'basys3' ? 'fpga-basys3' : 'arduino-uno';
                    const xOffset = target === 'basys3' ? -4 : 4;
                    const newNode = {
                        id: `${target}-${Date.now()}`,
                        type: type,
                        pose: {
                            position: { x: xOffset, y: 0.5, z: 0 },
                            rotation: { x: 0, y: 0, z: 0, w: 1 }
                        },
                        properties: {},
                        hardware_target: target
                    };
                    addNode(newNode);
                }
            }
            // PHASE 1.4: CLEANUP (Remove node when hardware disconnects)
            if (currentSession.status !== 'connected' && previousSession.status === 'connected') {
                console.log(`[HardwareAutoAdopt] Cleaning up 3D nodes for: ${target}`);
                const nodeToRemove = graphNodes.find(n => n.hardware_target === target);
                if (nodeToRemove) {
                    console.log(`[HardwareAutoAdopt] Removing node ${nodeToRemove.id} for ${target}`);
                    removeNode(nodeToRemove.id);
                }
            }
        }
        // Update previous session ref for next render
        prevSessionsRef.current = sessions;
    }, [sessions, addNode, removeNode, graphNodes]);
    return null; // Side-effect only component
};
