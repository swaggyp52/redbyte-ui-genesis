import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
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

export const Rb3DViewport: React.FC<Rb3DViewportProps> = ({
    children,
    width = '100%',
    height = '100%',
    className,
    cameraPosition = [10, 10, 10],
    cameraTarget = [0, 0, 0],
    onCameraChange,
    frameloop = 'always', // In future, switch to 'demand' for optimization
    reduceMotion = false,
}) => {
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const [webglFailed, setWebglFailed] = useState(false);

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

        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('webglcontextlost', handleContextLost);
            canvas.addEventListener('webglcontextrestored', handleContextRestored);

            return () => {
                canvas.removeEventListener('webglcontextlost', handleContextLost);
                canvas.removeEventListener('webglcontextrestored', handleContextRestored);
            };
        }
    }, []);

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
            >
                <color attach="background" args={['#0a0a0a']} />
                <fog attach="fog" args={['#0a0a0a', 20, 60]} />

                {/* Basic Lighting */}
                <ambientLight intensity={0.3} />
                <directionalLight position={[10, 10, 5]} intensity={1} />

                {/* Grid Floor - could make this optional/configurable */}
                <Grid args={[100, 100]} cellColor="#333" sectionColor="#555" fadeDistance={50} />

                {/* Camera Controls */}
                <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    enableDamping={!reduceMotion}
                    dampingFactor={0.05}
                    minDistance={2}
                    maxDistance={100}
                    maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
                    onChange={() => {
                        if (controlsRef.current && onCameraChange) {
                            // Throttle this in real implementation
                            const p = controlsRef.current.object.position;
                            const t = controlsRef.current.target;
                            onCameraChange([p.x, p.y, p.z], [t.x, t.y, t.z]);
                        }
                    }}
                />

                {children}
            </Canvas>
        </div>
    );
};
