import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function UniverseOrb({ progress = 1 }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // ------------------------------
    // VOID LIGHT + AMBIENCE
    // ------------------------------
    const ambient = new THREE.AmbientLight(0x445577, 1.2);
    scene.add(ambient);

    const voidLight = new THREE.PointLight(0x88bbff, 2.5, 8);
    voidLight.position.set(1.2, 0.5, 2.5);
    scene.add(voidLight);

    // ------------------------------
    // ORB MATERIAL — VOID STORM
    // ------------------------------
    const orbGeo = new THREE.SphereGeometry(1.2, 128, 128);
    const orbMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: progress }
      },
      vertexShader: 
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      ,
      fragmentShader: 
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float uTime;

        // Noise
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          float t = uTime * 0.2;

          float n = noise(vUv * 6.0 + t);
          float glow = pow(max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 4.0);

          vec3 base = mix(vec3(0.02, 0.05, 0.10), vec3(0.12, 0.20, 0.40), n);
          vec3 storm = vec3(0.4, 0.6, 1.2) * pow(n, 8.0);

          vec3 finalColor = base + storm + glow * 0.8;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      ,
    });

    const orb = new THREE.Mesh(orbGeo, orbMat);
    scene.add(orb);

    // ------------------------------
    // RINGS
    // ------------------------------
    const ringGeo = new THREE.RingGeometry(1.4, 2.4, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0d1b2a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });

    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.4;
    ring.rotation.y = 0.3;
    scene.add(ring);

    // ------------------------------
    // PARALLAX CAMERA SHIFT
    // ------------------------------
    const mouse = { x: 0, y: 0 };
    window.addEventListener("mousemove", (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 0.4;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 0.4;
    });

    // ------------------------------
    // Animate
    // ------------------------------
    let frame = 0;
    const animate = () => {
      frame++;

      orb.rotation.y += 0.0025;
      orb.rotation.x += 0.001;

      orbMat.uniforms.uTime.value = frame;

      camera.position.x += (mouse.x * 1.1 - camera.position.x) * 0.03;
      camera.position.y += (mouse.y * -1.0 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      ring.rotation.z += 0.0006;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full"></div>;
}




