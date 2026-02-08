import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Rb3DViewport } from './components/Rb3DViewport';
import { Rb3DSceneBoard } from './components/Rb3DSceneBoard';
export const Lab3DScene = ({ leds = 0, switches = 0, buttons = 0, onSwitchToggle, onButtonPress, onButtonRelease, width = '100%', height = '100%', }) => {
    return (_jsxs(Rb3DViewport, { width: width, height: height, cameraPosition: [0, 10, 8], cameraTarget: [0, 0, 0], children: [_jsx("ambientLight", { intensity: 0.5 }), _jsx("directionalLight", { position: [5, 10, 5], intensity: 1.5 }), _jsx("pointLight", { position: [-5, 5, -5], intensity: 0.5 }), _jsx(Rb3DSceneBoard, { leds: leds, switches: switches, buttons: buttons, onSwitchToggle: onSwitchToggle, onButtonPress: onButtonPress, onButtonRelease: onButtonRelease })] }));
};
