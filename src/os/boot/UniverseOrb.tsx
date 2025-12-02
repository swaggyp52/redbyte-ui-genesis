import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

interface UniverseOrbProps {
  className?: string;
}

/**
 * UniverseOrb
 *
 * Fullscreen Three.js scene with a central interactive orb.
 * - User can rotate, zoom, and pan the view.
 * - Orb gently animates even if user does nothing.
 */
export const UniverseOrb: React.FC<UniverseOrbProps> = ({ className }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617"); // slate-950

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);

    // Central orb
    const orbGeo = new THREE.SphereGeometry(1.4, 64, 64);
    const orbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#38bdf8"), // sky-400
      metalness: 0.7,
      roughness: 0.25,
      emissive: new THREE.Color("#0ea5e9"),
      emissiveIntensity: 0.8,
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    scene.add(orb);

    // Faint outer shell / atmosphere
    const shellGeo = new THREE.SphereGeometry(1.6, 64, 64);
    const shellMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#a855f7"),
      transparent: true,
      opacity: 0.18,
      wireframe: true,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    scene.add(shell);

    // Soft lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x38bdf8, 1.2);
    keyLight.position.set(4, 3, 6);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xa855f7, 0.9);
    rimLight.position.set(-4, -3, -5);
    scene.add(rimLight);

    // Simple starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: new THREE.Color("#64748b"),
      size: 0.08,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controls.minDistance = 4;
    controls.maxDistance = 18;
    controls.target.set(0, 0, 0);
    controls.update();

    // Resize handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation loop
    let lastTime = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Gentle idle motion even if user does nothing
      orb.rotation.y += dt * 0.35;
      orb.rotation.x += dt * 0.12;
      shell.rotation.y -= dt * 0.15;

      stars.rotation.y += dt * 0.02;

      controls.update();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      starGeo.dispose();
      orbGeo.dispose();
      shellGeo.dispose();
      // Materials are GCed with renderer; we avoid manual dispose for simplicity here
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full h-full rounded-3xl overflow-hidden bg-slate-950"}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block bg-slate-950"
      />
    </div>
  );
};
