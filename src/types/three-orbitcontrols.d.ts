declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher, MOUSE, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement: HTMLElement);

    object: Camera;
    domElement: HTMLElement;

    enabled: boolean;
    target: Vector3;

    minDistance: number;
    maxDistance: number;

    // Extended properties used by RedByte OS 3D system
    enableDamping: boolean;
    dampingFactor: number;

    rotateSpeed: number;
    zoomSpeed: number;
    panSpeed: number;

    update(): void;
    dispose(): void;

    static MOUSE: typeof MOUSE;
  }
}

