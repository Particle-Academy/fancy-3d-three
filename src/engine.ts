/**
 * three.js engine adapter for `@particle-academy/fancy-3d`'s <Canvas>.
 *
 * Mounts a three `WebGLRenderer` + `Scene` + camera into a `<canvas>` overlaid
 * on the Canvas DOM container, then exposes the live `Scene` via
 * `EngineHandle.root` so child components can register meshes alongside the 2D
 * node graph.
 *
 *   import { Canvas } from "@particle-academy/fancy-3d";
 *   import { threeEngine } from "@particle-academy/fancy-3d-three/engine";
 *
 *   <Canvas engine={threeEngine} style={{ height: 480 }} />
 */
import * as THREE from "three";
import type { CanvasEngine, EngineHandle, ViewportState } from "@particle-academy/fancy-3d";

export const threeEngine: CanvasEngine = {
  name: "three",
  mount(host: HTMLElement, _viewport: ViewportState): EngineHandle {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    const overlay = renderer.domElement;
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none"; // the 2D node graph owns interaction
    overlay.dataset.fancy3dCanvasEngine = "three";
    host.appendChild(overlay);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xb3c6ff, 0x1a1a2e, 1.0);
    scene.add(hemi);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderer.render(scene, camera);
    };
    loop();

    function updateViewport(_v: ViewportState) {
      // The 3D camera owns its own view; 2D viewport changes are observed but
      // don't move the camera. Consumers can drive the camera off the scene.
    }

    function dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      if (overlay.parentElement === host) host.removeChild(overlay);
    }

    return {
      name: "three",
      root: scene,
      updateViewport,
      dispose,
    };
  },
};
