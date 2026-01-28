// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Rb3DViewport } from './components/Rb3DViewport';
import { Rb3DSceneBoard } from './components/Rb3DSceneBoard';

export interface Lab3DSceneProps {
    // Board State
    leds?: number; // 8-bit integer
    switches?: number; // 8-bit integer
    buttons?: number; // 4-bit integer

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
            cameraPosition={[0, 10, 8]}
            cameraTarget={[0, 0, 0]}
        >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <pointLight position={[-5, 5, -5]} intensity={0.5} />

            <Rb3DSceneBoard
                leds={leds}
                switches={switches}
                buttons={buttons}
                onSwitchToggle={onSwitchToggle}
                onButtonPress={onButtonPress}
                onButtonRelease={onButtonRelease}
            />
        </Rb3DViewport>
    );
};
