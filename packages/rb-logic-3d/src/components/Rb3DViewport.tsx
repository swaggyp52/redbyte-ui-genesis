import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

interface Rb3DViewportProps {
    children?: React.ReactNode;
    width?: number | string;
    height?: number | string;
    className?: string;

    // Camera Control Props
    cameraPosition?: [number, number, number];
    cameraTarget?: [number, number, number];
    onCameraChange?: (position: [number, number, number], target: [number, number, number]) => void;

    // Determinism & Performance
    frameloop?: 'always' | 'demand' | 'never';
    reduceMotion?: boolean;
}

const ViewportControls: React.FC<{
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
    onCameraChange?: (position: [number, number, number], target: [number, number, number]) => void;
    reduceMotion: boolean;
}> = ({ cameraPosition, cameraTarget, onCameraChange, reduceMotion }) => {
    const controlsRef = useRef<OrbitControlsImpl>(null);
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

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping={!reduceMotion}
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={100}
            maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
            onChange={() => {
                invalidate();
                if (controlsRef.current && onCameraChange) {
                    const now = performance.now();
                    if (now - lastNotifyRef.current < 33) return;
                    lastNotifyRef.current = now;
                    const p = controlsRef.current.object.position;
                    const t = controlsRef.current.target;
                    onCameraChange([p.x, p.y, p.z], [t.x, t.y, t.z]);
                }
            }}
        />
    );
};

export const Rb3DViewport: React.FC<Rb3DViewportProps> = ({
    children,
    width = '100%',
    height = '100%',
    className,
    cameraPosition = [10, 10, 10],
    cameraTarget = [0, 0, 0],
    onCameraChange,
    frameloop = 'demand',
    reduceMotion = false,
}) => {
    const [webglFailed, setWebglFailed] = useState(false);
    const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

    // Handle WebGL context loss
    useEffect(() => {
        const handleContextLost = (event: Event) => {
            event.preventDefault();
            console.warn('WebGL context lost - 3D view disabled');
            setWebglFailed(true);
        };

        const handleContextRestored = () => {
            console.log('WebGL context restored');
            setWebglFailed(false);
        };

        const canvas = canvasEl;
        if (!canvas) return;
        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [canvasEl]);

    if (webglFailed) {
        return (
            <div style={{ width, height }} className={`flex items-center justify-center bg-gray-900 ${className}`}>
                <div className="bg-gray-800/90 border border-yellow-700 rounded-lg p-6 text-center max-w-md">
                    <div className="text-yellow-500 text-2xl mb-3">⚠️</div>
                    <div className="font-semibold text-white mb-2">3D View Unavailable</div>
                    <div className="text-sm text-gray-300">
                        WebGL context was lost. Switch to 2D view.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width, height, position: 'relative' }} className={className}>
            <Canvas
                frameloop={frameloop}
                camera={{ position: cameraPosition, fov: 50 }}
                gl={{
                    antialias: true,
                    powerPreference: 'high-performance',
                    failIfMajorPerformanceCaveat: false
                }}
                onCreated={({ gl }) => {
                    setCanvasEl(gl.domElement);
                }}
            >
                <color attach="background" args={['#0a0a0a']} />
                <fog attach="fog" args={['#0a0a0a', 20, 60]} />

                {/* Basic Lighting */}
                <ambientLight intensity={0.3} />
                <directionalLight position={[10, 10, 5]} intensity={1} />

                {/* Grid Floor - could make this optional/configurable */}
                <Grid args={[100, 100]} cellColor="#333" sectionColor="#555" fadeDistance={50} />

                {/* Camera Controls */}
                <ViewportControls
                    cameraPosition={cameraPosition}
                    cameraTarget={cameraTarget}
                    onCameraChange={onCameraChange}
                    reduceMotion={reduceMotion}
                />

                {children}
            </Canvas>
        </div>
    );
};
