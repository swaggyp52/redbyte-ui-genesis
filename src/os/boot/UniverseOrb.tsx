import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

const UniverseOrb: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || container.offsetWidth || 600;
    const height = container.clientHeight || container.offsetHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#020617"); // slate-950, deep void
    scene.fog = new THREE.FogExp2("#020617", 0.0025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0.4, 4.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Soft ambient + directional "distant star" light
    const ambient = new THREE.AmbientLight(0x6b7280, 0.9); // slate-500
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.3); // sky-400
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.7); // fuchsia-500
    rimLight.position.set(-4, -3, -5);
    scene.add(rimLight);

    // -----------------------------
    // Starfield (very distant, slow)
    // -----------------------------
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1500;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 40 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.cos(phi);
      starPositions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }

    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0x0ea5e9, // sky-500
      size: 0.055,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // -----------------------------
    // Void haze layers (subtle)
    // -----------------------------
    const hazeGroup = new THREE.Group();
    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });

    for (let i = 0; i < 3; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(15 + i * 3, 32, 32),
        hazeMaterial.clone()
      );
      (sphere.material as THREE.MeshBasicMaterial).opacity =
        0.18 + i * 0.04;
      hazeGroup.add(sphere);
    }

    scene.add(hazeGroup);

    // -----------------------------
    // Core Orb: layered, ominous
    // -----------------------------
    const orbGroup = new THREE.Group();

    // outer shell
    const outerGeometry = new THREE.SphereGeometry(1.1, 64, 64);
    const outerMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x020617,
      emissive: 0x020617,
      roughness: 0.15,
      metalness: 0.9,
      transmission: 0.82,
      transparent: true,
      opacity: 0.95,
      thickness: 1.4,
      clearcoat: 0.9,
      clearcoatRoughness: 0.25,
    });
    const outerOrb = new THREE.Mesh(outerGeometry, outerMaterial);
    orbGroup.add(outerOrb);

    // inner core (glowing)
    const coreGeometry = new THREE.SphereGeometry(0.72, 48, 48);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xf97316, // orange-500
      transparent: true,
      opacity: 0.85,
    });
    const coreOrb = new THREE.Mesh(coreGeometry, coreMaterial);
    orbGroup.add(coreOrb);

    // crack overlay (wireframe style)
    const crackGeometry = new THREE.IcosahedronGeometry(0.98, 2);
    const crackMaterial = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // rose-500
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const crackMesh = new THREE.Mesh(crackGeometry, crackMaterial);
    orbGroup.add(crackMesh);

    // energy rings
    const ringsGroup = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
    });

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.01, 16, 128),
      ringMaterial.clone()
    );
    ring1.rotation.x = Math.PI / 2.4;
    ringsGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.012, 16, 128),
      ringMaterial.clone()
    );
    ring2.rotation.y = Math.PI / 2.2;
    ringsGroup.add(ring2);

    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.009, 16, 128),
      ringMaterial.clone()
    );
    ring3.rotation.z = Math.PI / 2.8;
    (ring3.material as THREE.MeshBasicMaterial).opacity = 0.3;
    ringsGroup.add(ring3);

    orbGroup.add(ringsGroup);

    // Slight vertical lift
    orbGroup.position.y = 0.15;

    scene.add(orbGroup);

    // -----------------------------
    // Shockwave pulse
    // -----------------------------
    const shockwaveGeometry = new THREE.RingGeometry(1.4, 1.9, 64);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = -1.2;
    scene.add(shockwave);

    let shockwaveStrength = 0;
    let shockwaveOpacity = 0;

    // -----------------------------
    // Orbit controls (limited)
    // -----------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.45;
    controls.zoomSpeed = 0.6;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 6.0;
    controls.minPolarAngle = Math.PI / 3.2;
    controls.maxPolarAngle = Math.PI / 1.7;

    // -----------------------------
    // Mouse-driven subtle tilt
    // -----------------------------
    const targetTilt = { x: 0, y: 0 };
    const currentTilt = { x: 0, y: 0 };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (event.clientX - cx) / rect.width;
      const dy = (event.clientY - cy) / rect.height;

      targetTilt.y = THREE.MathUtils.clamp(dx * 0.6, -0.7, 0.7);
      targetTilt.x = THREE.MathUtils.clamp(-dy * 0.6, -0.6, 0.6);
    };

    const onClick = () => {
      shockwaveStrength = 1.0;
      shockwaveOpacity = 0.55;
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    // -----------------------------
    // Resize handling
    // -----------------------------
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || container.offsetWidth || width;
      const h = container.clientHeight || container.offsetHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", onResize);

    // -----------------------------
    // Animation loop
    // -----------------------------
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      stars.rotation.y += 0.0004;
      hazeGroup.rotation.y -= 0.00025;

      // Tilt interp
      currentTilt.x += (targetTilt.x - currentTilt.x) * 0.08;
      currentTilt.y += (targetTilt.y - currentTilt.y) * 0.08;
      orbGroup.rotation.x = currentTilt.x + Math.sin(t * 0.15) * 0.03;
      orbGroup.rotation.y = currentTilt.y + Math.cos(t * 0.17) * 0.04;

      coreOrb.rotation.y += 0.12 * clock.getDelta();
      crackMesh.rotation.y -= 0.06;
      crackMesh.rotation.x += 0.03;

      ringsGroup.rotation.y += 0.04;
      ringsGroup.rotation.x -= 0.02;

      // Shockwave
      if (shockwaveStrength > 0.01 || shockwaveOpacity > 0.01) {
        shockwaveStrength *= 0.9;
        shockwaveOpacity *= 0.88;

        const s = 1.4 + (1.2 * (1 - shockwaveStrength)) * 4;
        shockwave.scale.set(s, s, s);
        (shockwave.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, shockwaveOpacity);
      } else {
        (shockwave.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      shockwaveGeometry.dispose();
      shockwaveMaterial.dispose();
      outerGeometry.dispose();
      outerMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      crackGeometry.dispose();
      crackMaterial.dispose();
      ringsGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material && (mesh.material as any).dispose) {
          (mesh.material as any).dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full bg-[#020617] rounded-3xl overflow-hidden"
    />
  );
};

export default UniverseOrb;
