// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Rb3DViewport } from './components/Rb3DViewport';
import { Basys3Board3D } from './components/Basys3Board3D';

export interface Lab3DSceneProps {
    // Board State (16-bit Basys3)
    leds?: number;     // 16-bit integer: LD0 = bit 0, LD15 = bit 15
    switches?: number; // 16-bit integer: SW0 = bit 0, SW15 = bit 15
    buttons?: number;  // 5-bit integer: BTNC=0, BTNU=1, BTNL=2, BTNR=3, BTND=4

    /**
     * Signal names currently mapped to physical Basys3 pins in the student's project.
     * E.g. ['SW0', 'SW1', 'LD0', 'CLK100MHZ'] — these components glow teal on the board
     * to show the hardware↔software connection.
     */
    mappedPins?: string[];

    // Interaction
    onSwitchToggle?: (index: number, newValue: boolean) => void;
    onButtonPress?: (index: number) => void;
    onButtonRelease?: (index: number) => void;

    // Layout
    width?: number | string;
    height?: number | string;
}

export const Lab3DScene: React.FC<Lab3DSceneProps> = ({
    leds = 0,
    switches = 0,
    buttons = 0,
    mappedPins = [],
    onSwitchToggle,
    onButtonPress,
    onButtonRelease,
    width = '100%',
    height = '100%',
}) => {
    return (
        <Rb3DViewport
            width={width}
            height={height}
            cameraPosition={[0, 16, 13]}
            cameraTarget={[0, 0, 1]}
        >
            <ambientLight intensity={0.6} />
            <directionalLight position={[6, 12, 8]} intensity={1.4} castShadow />
            <directionalLight position={[-6, 8, -6]} intensity={0.4} color="#8ec7ff" />
            <pointLight position={[0, 8, -6]} intensity={0.3} color="#2ec4b6" />

            <Basys3Board3D
                leds={leds}
                switches={switches}
                buttons={buttons}
                mappedPins={mappedPins}
                onSwitchToggle={onSwitchToggle}
                onButtonPress={onButtonPress}
                onButtonRelease={onButtonRelease}
            />
        </Rb3DViewport>
    );
};
