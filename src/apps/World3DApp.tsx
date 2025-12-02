import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  type VoxelBlock,
  type VoxelType,
  WORLD_SIZE,
  subscribeWorld,
  seedTestWorld,
  clearWorld,
  setVoxel,
  getVoxel,
} from "../world3d/VoxelWorld";
import { stepVoxelWorldOnce } from "../world3d/Redstone3DEngine";
import { listBlueprints } from "../sim/RedstoneBlueprints";
import {
  importBlueprintIntoWorld,
  exportSliceToBlueprint,
} from "../world3d/BlueprintBridge";
import { resetSimHistory } from "../world3d/SimMetrics";

type Tool = "paint" | "erase" | "eyedropper";

const VOXEL_TYPES: VoxelType[] = [
  "wire",
  "source",
  "gate_and",
  "gate_or",
  "gate_not",
  "repeater",
  "comparator",
  "torch",
  "output",
];

export function World3DApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const voxelGroupRef = useRef<THREE.Group | null>(null);
  const voxelGeometryRef = useRef<THREE.BoxGeometry | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRef = useRef<number | null>(null);

  const [voxels, setVoxels] = useState<VoxelBlock[]>([]);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [tickRate, setTickRate] = useState(4);

  const [blueprints, setBlueprints] = useState<string[]>([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState<string>("");
  const [layerY, setLayerY] = useState<number>(Math.floor(WORLD_SIZE / 2));

  const [activeTool, setActiveTool] = useState<Tool>("paint");
  const [activeType, setActiveType] = useState<VoxelType>("wire");

  useEffect(() => {
    const unsub = subscribeWorld((blocks) => setVoxels(blocks));
    return () => unsub();
  }, []);

  useEffect(() => {
    setBlueprints(listBlueprints());
  }, []);

  // Scene + camera + renderer + orbit controls
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 360;

    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    const radius = WORLD_SIZE * 1.8;
    camera.position.set(radius, radius * 0.8, radius);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(20, 30, 10);
    scene.add(dir);

    const grid = new THREE.GridHelper(WORLD_SIZE * 1.8, WORLD_SIZE);
    grid.position.y = -WORLD_SIZE / 2;
    scene.add(grid);

    const voxelGroup = new THREE.Group();
    voxelGroupRef.current = voxelGroup;
    scene.add(voxelGroup);

    const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
    voxelGeometryRef.current = voxelGeometry;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controlsRef.current = controls;

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("resize", handleResize);

      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();

      if (voxelGeometryRef.current) {
        voxelGeometryRef.current.dispose();
        voxelGeometryRef.current = null;
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
    };
  }, []);

  // Rebuild voxel meshes on world change
  useEffect(() => {
    const group = voxelGroupRef.current;
    const voxelGeometry = voxelGeometryRef.current;
    if (!group || !voxelGeometry) return;

    while (group.children.length) {
      const child = group.children.pop();
      if (child && child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    }

    const centerOffset = WORLD_SIZE / 2;

    const colorForVoxel = (v: VoxelBlock): THREE.Color => {
      switch (v.type) {
        case "source": {
          const c = new THREE.Color(0xfbbf24);
          return c;
        }
        case "wire": {
          const base = new THREE.Color(0x0ea5e9); // sky-500
          const level = v.powerLevel ?? (v.powered ? 15 : 0);
          if (level <= 0) {
            return base.multiplyScalar(0.25);
          }
          const factor = 0.4 + 0.6 * (Math.max(1, Math.min(15, level)) / 15);
          return base.multiplyScalar(factor);
        }
        case "gate_and":
        case "gate_or":
        case "gate_not":
        case "repeater":
        case "comparator": {
          const c = new THREE.Color(0x22c55e); // emerald
          return v.powered ? c : c.multiplyScalar(0.7);
        }
        case "torch": {
          if (v.powered) {
            return new THREE.Color(0xf97316);
          }
          return new THREE.Color(0x7c2d12);
        }
        case "output": {
          const c = new THREE.Color(0xe879f9);
          return v.powered ? c : c.multiplyScalar(0.7);
        }
        case "air":
        default:
          return new THREE.Color(0x64748b);
      }
    };

    for (const v of voxels) {
      if (v.type === "air") continue;

      const material = new THREE.MeshStandardMaterial({
        color: colorForVoxel(v),
        metalness: 0.1,
        roughness: 0.4,
      });

      const mesh = new THREE.Mesh(voxelGeometry, material);
      mesh.position.set(
        v.x - centerOffset + 0.5,
        v.y - centerOffset + 0.5,
        v.z - centerOffset + 0.5
      );
      mesh.userData.vx = v.x;
      mesh.userData.vy = v.y;
      mesh.userData.vz = v.z;
      group.add(mesh);
    }
  }, [voxels]);

  // Simulation loop
  useEffect(() => {
    if (!running) return;

    const interval = 1000 / Math.max(1, tickRate);
    const id = window.setInterval(() => {
      stepVoxelWorldOnce();
      setTick((t) => t + 1);
    }, interval);

    return () => window.clearInterval(id);
  }, [running, tickRate]);

  const handleStep = () => {
    stepVoxelWorldOnce();
    setTick((t) => t + 1);
  };

  const handleReset = () => {
    clearWorld();
    resetSimHistory();
    setTick(0);
    setRunning(false);
  };

  const handleSeed = () => {
    clearWorld();
    resetSimHistory();
    seedTestWorld();
    setTick(0);
  };

  const handleClear = () => {
    clearWorld();
    resetSimHistory();
    setTick(0);
  };

  const handleImportBlueprint = () => {
    if (!selectedBlueprint) {
      window.alert("Select a blueprint to import.");
      return;
    }
    const ok = importBlueprintIntoWorld(selectedBlueprint, layerY, {
      offsetX: 0,
      offsetZ: 0,
      clearLayer: true,
    });
    if (!ok) {
      window.alert("Failed to load blueprint.");
      return;
    }
    setTick(0);
  };

  const handleExportSlice = () => {
    const name = window.prompt(
      `Export Y-level ${layerY} as blueprint name:`,
      selectedBlueprint || "world-slice"
    );
    if (!name) return;
    exportSliceToBlueprint(name, layerY);
    setBlueprints(listBlueprints());
    setSelectedBlueprint(name);
  };

  const applyToolToVoxel = (vx: number, vy: number, vz: number) => {
    if (vx < 0 || vx >= WORLD_SIZE) return;
    if (vy < 0 || vy >= WORLD_SIZE) return;
    if (vz < 0 || vz >= WORLD_SIZE) return;

    if (activeTool === "erase") {
      setVoxel(vx, vy, vz, "air", false);
      return;
    }

    if (activeTool === "eyedropper") {
      const b = getVoxel(vx, vy, vz);
      if (b && b.type !== "air") {
        setActiveType(b.type);
      }
      return;
    }

    if (activeTool === "paint") {
      setVoxel(vx, vy, vz, activeType, false);
    }
  };

  const handleCanvasPointerDown: React.MouseEventHandler<HTMLDivElement> = (
    e
  ) => {
    const mount = mountRef.current;
    const camera = cameraRef.current;
    const group = voxelGroupRef.current;
    if (!mount || !camera || !group) return;

    const rect = mount.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    const voxelHits = raycaster.intersectObjects(group.children, false);
    if (voxelHits.length > 0) {
      const hit = voxelHits[0];
      const vx = hit.object.userData.vx as number;
      const vy = hit.object.userData.vy as number;
      const vz = hit.object.userData.vz as number;
      applyToolToVoxel(vx ?? 0, vy ?? 0, vz ?? 0);
      return;
    }

    // If you click empty space, do nothing (camera is handled by OrbitControls).
  };

  const toolLabel = (t: Tool) => {
    switch (t) {
      case "paint":
        return "Paint";
      case "erase":
        return "Erase";
      case "eyedropper":
        return "Eyedrop";
      default:
        return t;
    }
  };

  return (
    <div className="h-full flex flex-col gap-3 text-xs">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">
            3D Redstone World (Sim + Edit)
          </h1>
          <p className="text-[0.7rem] text-slate-400">
            Voxel-based Redstone simulation with 3D editing tools and 2D
            blueprint import/export. Shared with World Map 2D and Redstone Sim.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[0.65rem] text-emerald-300 font-mono">
            ENGINE://V23-DUST
          </span>
          <span className="text-[0.65rem] text-slate-500 uppercase">
            WORLD://3D-SIM
          </span>
        </div>
      </header>

      <section className="rb-glass rounded-2xl p-3 border border-slate-800/80 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                running
                  ? "border-rose-500/70 text-rose-300"
                  : "border-emerald-500/70 text-emerald-300"
              }`}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? "Pause" : "Run"}
            </button>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-sky-500/70"
              onClick={handleStep}
            >
              Step
            </button>
            <button
              className="px-2 py-1 rounded-xl border border-slate-700/80 text-[0.7rem] hover:border-rose-500/70"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2 text-[0.7rem]">
            <span className="text-slate-400">Tick rate</span>
            <input
              type="range"
              min={1}
              max={20}
              value={tickRate}
              onChange={(e) => setTickRate(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">{tickRate} tps</span>
          </div>

          <div className="flex items-center gap-4 text-[0.7rem] text-slate-400 ml-auto">
            <span>
              Tick:{" "}
              <span className="font-mono text-slate-100">{tick}</span>
            </span>
            <span className="text-slate-500">
              Voxels:{" "}
              <span className="font-mono text-slate-100">
                {voxels.length}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[0.7rem]">
          <div className="flex items-center gap-2">
            {(["paint", "erase", "eyedropper"] as Tool[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTool(t)}
                className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                  activeTool === t
                    ? "border-sky-500/80 text-sky-300 bg-sky-500/10"
                    : "border-slate-700/80 text-slate-300 hover:border-sky-500/60"
                }`}
              >
                {toolLabel(t)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Brush</span>
            <div className="flex items-center gap-1 flex-wrap">
              {VOXEL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveType(t)}
                  className={`px-2 py-1 rounded-xl border text-[0.7rem] ${
                    activeType === t
                      ? "border-emerald-500/80 text-emerald-300 bg-emerald-500/10"
                      : "border-slate-700/80 text-slate-300 hover:border-emerald-500/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              className="px-2 py-1 rounded-xl border border-emerald-500/70 text-[0.7rem] text-emerald-300 hover:bg-emerald-500/10"
              onClick={handleSeed}
            >
              Seed demo world
            </button>
            <button
              className="px-2 py-1 rounded-xl border border-rose-500/70 text-[0.7rem] text-rose-300 hover:bg-rose-500/10"
              onClick={handleClear}
            >
              Clear world
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[0.7rem] pt-1 border-t border-slate-800/80 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Bridge Y-level</span>
            <input
              type="range"
              min={0}
              max={WORLD_SIZE - 1}
              value={layerY}
              onChange={(e) => setLayerY(Number(e.target.value))}
              className="w-32"
            />
            <span className="font-mono text-slate-100">{layerY}</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedBlueprint}
              onChange={(e) => setSelectedBlueprint(e.target.value)}
              className="bg-slate-900/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.7rem] text-slate-100"
            >
              <option value="">Select 2D blueprint...</option>
              {blueprints.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="px-2 py-1 rounded-xl border border-sky-500/70 text-[0.7rem] text-sky-300 hover:bg-sky-500/10"
              onClick={handleImportBlueprint}
              disabled={!selectedBlueprint}
            >
              Import → Y={layerY}
            </button>
          </div>

          <button
            className="px-2 py-1 rounded-xl border border-fuchsia-500/70 text-[0.7rem] text-fuchsia-300 hover:bg-fuchsia-500/10 ml-auto"
            onClick={handleExportSlice}
          >
            Export Y={layerY} slice as blueprint
          </button>
        </div>

        <div className="text-[0.7rem] text-slate-500 mt-1 flex flex-wrap gap-4">
          <span>
            <span className="font-semibold text-slate-300">Camera:</span>{" "}
            Drag with mouse to orbit, scroll to zoom, right-click or middle-click
            to pan.
          </span>
          <span>
            <span className="font-semibold text-slate-300">Editing:</span>{" "}
            Click voxels to {activeTool === "erase" ? "erase" : "paint"} using
            the active brush type. Use eyedrop to pick blocks.
          </span>
        </div>
      </section>

      <section className="flex-1 min-h-0 rb-glass rounded-2xl p-3 border border-slate-800/80">
        <div
          ref={mountRef}
          onMouseDown={handleCanvasPointerDown}
          className="w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-crosshair relative"
        >
          <div className="absolute top-2 right-2 bg-slate-950/80 border border-slate-700/80 rounded-xl px-2 py-1 text-[0.65rem] text-slate-300 pointer-events-none">
            <div className="font-semibold text-slate-100 mb-1">
              Controls
            </div>
            <div>🖱️ Drag: orbit</div>
            <div>🖱️ Wheel: zoom</div>
            <div>🖱️ Right/Middle drag: pan</div>
            <div>👆 Click voxel: {activeTool}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
