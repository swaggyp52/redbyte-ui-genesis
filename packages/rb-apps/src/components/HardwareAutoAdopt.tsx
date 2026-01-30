import React, { useEffect } from 'react';
import { useHardwareSessionStore, Target } from '../stores/hardwareSessionStore';
import { useLabStore, LabNode } from '@redbyte/rb-logic-3d';

/**
 * HardwareAutoAdopt automatically spawns 3D nodes in the Virtual Lab
 * when a hardware session is established.
 */
export const HardwareAutoAdopt: React.FC = () => {
    const sessions = useHardwareSessionStore((state) => state.sessions);
    const addNode = useLabStore((state) => state.addNode);
    const graphNodes = useLabStore((state) => state.graph.nodes);

    useEffect(() => {
        // Targets we want to auto-adopt
        const targets: Target[] = ['basys3', 'arduino-uno'];

        for (const target of targets) {
            const session = sessions[target];
            if (session.status === 'connected') {
                // Check if we already have this node in the 3D scene
                // We check by hardware_target property
                const alreadyExists = graphNodes.some(n => n.hardware_target === target);

                if (!alreadyExists) {
                    console.log(`[HardwareAutoAdopt] Spawning 3D node for: ${target}`);

                    const type = target === 'basys3' ? 'fpga-basys3' : 'arduino-uno';
                    const xOffset = target === 'basys3' ? -4 : 4;

                    const newNode: LabNode = {
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
        }
    }, [sessions, addNode, graphNodes]);

    return null; // Side-effect only component
};
