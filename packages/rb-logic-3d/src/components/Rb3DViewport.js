import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
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
export const Rb3DViewport = ({ children, width = '100%', height = '100%', className, active = true, cameraPosition = [10, 10, 10], cameraTarget = [0, 0, 0], onCameraChange, frameloop = 'demand', reduceMotion = false, }) => {
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
        return (_jsx("div", { style: { width, height }, className: `flex items-center justify-center bg-gray-900 ${className}`, children: _jsxs("div", { className: "bg-gray-800/90 border border-yellow-700 rounded-lg p-6 text-center max-w-md", children: [_jsx("div", { className: "text-yellow-500 text-2xl mb-3", children: "\u26A0\uFE0F" }), _jsx("div", { className: "font-semibold text-white mb-2", children: "3D View Unavailable" }), _jsx("div", { className: "text-sm text-gray-300", children: "WebGL context was lost. Switch to 2D view." })] }) }));
    }
    const effectiveFrameloop = active ? frameloop : 'never';
    return (_jsx("div", { style: { width, height, position: 'relative' }, className: className, children: _jsxs(Canvas, { frameloop: effectiveFrameloop, camera: { position: cameraPosition, fov: 50 }, gl: {
                antialias: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
            }, onCreated: ({ gl }) => {
                setCanvasEl(gl.domElement);
            }, children: [_jsx("color", { attach: "background", args: ['#0a0a0a'] }), _jsx("fog", { attach: "fog", args: ['#0a0a0a', 20, 60] }), _jsx("ambientLight", { intensity: 0.3 }), _jsx("directionalLight", { position: [10, 10, 5], intensity: 1 }), _jsx(Grid, { args: [100, 100], cellColor: "#333", sectionColor: "#555", fadeDistance: 50 }), _jsx(ViewportControls, { cameraPosition: cameraPosition, cameraTarget: cameraTarget, onCameraChange: onCameraChange, reduceMotion: reduceMotion }), _jsx(ViewportActiveInvalidator, { active: active }), children] }) }));
};
