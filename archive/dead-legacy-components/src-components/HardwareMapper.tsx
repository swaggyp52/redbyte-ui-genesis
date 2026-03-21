import React, { useEffect, useRef } from 'react';
import { useHardwareSessionStore, Target } from '../stores/hardwareSessionStore';
import type { Circuit, Node } from '@redbyte/rb-logic-core';

interface HardwareMapperProps {
    circuit: Circuit;
    onCircuitChange: (circuit: Circuit) => void;
}

const DEVICE_TO_NODE: Record<Target, string> = {
    'basys3': 'fpga-basys3',
    'arduino-uno': 'arduino-uno',
};

export const HardwareMapper: React.FC<HardwareMapperProps> = ({
    circuit,
    onCircuitChange,
}) => {
    const sessions = useHardwareSessionStore((state) => state.sessions);

    // Ref to avoid cyclic dependency/infinite loop if we update circuit
    // We only want to trigger ONCE when status goes to 'connected'
    const processedSessionsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        (Object.keys(sessions) as Target[]).forEach((target) => {
            const session = sessions[target];

            // We only care if connected and verified
            if (session.status === 'connected' && session.verified) {
                const sessionKey = `${target}-${session.connectedAt}`;

                // Avoid re-processing the same session connection
                if (processedSessionsRef.current.has(sessionKey)) return;

                // Check if node already exists
                const nodeType = DEVICE_TO_NODE[target];
                const exists = circuit.nodes.some(n => n.type === nodeType);

                if (!exists) {
                    console.log(`[HardwareMapper] Auto-spawning ${nodeType} for target ${target}`);

                    // Spawn it!
                    const newNode: Node = {
                        id: target,
                        type: nodeType,
                        position: { x: 0, y: 0 },
                        rotation: 0,
                        config: {},
                        state: {},
                    };

                    // Mutate copy
                    const nextCircuit = {
                        ...circuit,
                        nodes: [...circuit.nodes, newNode],
                    };

                    onCircuitChange(nextCircuit);

                    // Mark processed
                    processedSessionsRef.current.add(sessionKey);
                } else {
                    // Already exists, just mark processed so we don't spam checks
                    processedSessionsRef.current.add(sessionKey);
                }
            }
        });
    }, [sessions, circuit, onCircuitChange]);

    return null; // Headless
};
