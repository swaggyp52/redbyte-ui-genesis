import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
const ViewportControls = ({ cameraPosition, cameraTarget, onCameraChange, reduceMotion }) => {
    const controlsRef = useRef(null);
    const { camera, invalidate } = useThree();
    const lastNotifyRef = useRef(0);
    useEffect(() => {
        camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
        if (controlsRef.current) {
            controlsRef.current.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2]);
            controlsRef.current.update();
        }
        invalidate();
    }, [camera, cameraPosition, cameraTarget, invalidate]);
    return (_jsx(OrbitControls, { ref: controlsRef, makeDefault: true, enableDamping: !reduceMotion, dampingFactor: 0.05, minDistance: 2, maxDistance: 100, maxPolarAngle: Math.PI / 2.1, onChange: () => {
            invalidate();
            if (controlsRef.current && onCameraChange) {
                const now = performance.now();
                if (now - lastNotifyRef.current < 33)
                    return;
                lastNotifyRef.current = now;
                const p = controlsRef.current.object.position;
                const t = controlsRef.current.target;
                onCameraChange([p.x, p.y, p.z], [t.x, t.y, t.z]);
            }
        } }));
};
export const Rb3DViewport = ({ children, width = '100%', height = '100%', className, active = true, cameraPosition = [10, 10, 10], cameraTarget = [0, 0, 0], onCameraChange, frameloop = 'demand', reduceMotion = false, enterAnimation = false, }) => {
    const [webglFailed, setWebglFailed] = useState(false);
    const [canvasEl, setCanvasEl] = useState(null);
    // Handle WebGL context loss
    useEffect(() => {
        const handleContextLost = (event) => {
            event.preventDefault();
            console.warn('WebGL context lost - 3D view disabled');
            setWebglFailed(true);
        };
        const handleContextRestored = () => {
            console.log('WebGL context restored');
            setWebglFailed(false);
        };
        const canvas = canvasEl;
        if (!canvas)
            return;
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [canvasEl]);
    if (webglFailed) {
        return (_jsx("div", { style: { width, height }, className: `flex items-center justify-center bg-[#070B14] ${className}`, children: _jsxs("div", { className: "bg-[#0D1117]/90 border border-[#D4930D]/40 rounded-lg p-6 text-center max-w-md", children: [_jsx("div", { className: "text-[#D4930D] text-2xl mb-3", children: "\u26A0\uFE0F" }), _jsx("div", { className: "font-semibold text-[#E6EDF3] mb-2", children: "3D View Unavailable" }), _jsx("div", { className: "text-sm text-[#8B949E]", children: "WebGL context was lost. Switch to 2D view." })] }) }));
    }
    // Use 'always' during entrance animation for smooth camera sweep
    const effectiveFrameloop = !active ? 'never' : enterAnimation ? 'always' : frameloop;
    return (_jsx("div", { style: { width, height, position: 'relative' }, className: className, children: _jsxs(Canvas, { frameloop: effectiveFrameloop, camera: { position: cameraPosition, fov: 50 }, gl: {
                antialias: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
            }, onCreated: ({ gl }) => {
                setCanvasEl(gl.domElement);
            }, children: [_jsx("color", { attach: "background", args: ['#070B14'] }), _jsx("fog", { attach: "fog", args: ['#070B14', 15, 50] }), _jsx("ambientLight", { intensity: 0.15, color: "#8B949E" }), _jsx("directionalLight", { position: [8, 12, 5], intensity: 0.9, color: "#E6EDF3" }), _jsx("directionalLight", { position: [-5, 3, -5], intensity: 0.25, color: "#D4930D" }), _jsx("pointLight", { position: [0, 8, 0], intensity: 0.3, color: "#22D3EE", distance: 30, decay: 2 }), _jsx(Grid, { args: [100, 100], cellColor: "#151B23", sectionColor: "#21262D", fadeDistance: 40 }), _jsx(ViewportControls, { cameraPosition: cameraPosition, cameraTarget: cameraTarget, onCameraChange: onCameraChange, reduceMotion: reduceMotion }), _jsx(ViewportActiveInvalidator, { active: active }), enterAnimation && (_jsx(EnterCameraAnimation, { targetPosition: cameraPosition, targetLookAt: cameraTarget, enabled: enterAnimation })), children] }) }));
};
/** Animates camera from top-down to the target perspective position over 1.2s */
const EnterCameraAnimation = ({ targetPosition, targetLookAt, enabled }) => {
    const { camera, invalidate } = useThree();
    const startRef = useRef(null);
    const doneRef = useRef(!enabled);
    // Top-down starting position: directly above the target, looking down
    const startPos = useRef(new THREE.Vector3(targetLookAt[0], 25, targetLookAt[2] + 0.1));
    const endPos = useRef(new THREE.Vector3(...targetPosition));
    useEffect(() => {
        if (enabled) {
            startRef.current = null;
            doneRef.current = false;
            startPos.current.set(targetLookAt[0], 25, targetLookAt[2] + 0.1);
            endPos.current.set(...targetPosition);
            camera.position.copy(startPos.current);
            camera.lookAt(...targetLookAt);
            invalidate();
        }
    }, [enabled]);
    useFrame(() => {
        if (doneRef.current)
            return;
        if (startRef.current === null) {
            startRef.current = performance.now();
        }
        const elapsed = performance.now() - startRef.current;
        const duration = 1200;
        const t = Math.min(elapsed / duration, 1);
        // Ease out expo
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        camera.position.lerpVectors(startPos.current, endPos.current, eased);
        camera.lookAt(...targetLookAt);
        invalidate();
        if (t >= 1) {
            doneRef.current = true;
        }
    });
    return null;
};
const ViewportActiveInvalidator = ({ active }) => {
    const { invalidate } = useThree();
    const lastActiveRef = useRef(active);
    useEffect(() => {
        if (!lastActiveRef.current && active) {
            invalidate();
        }
        lastActiveRef.current = active;
    }, [active, invalidate]);
    return null;
};
