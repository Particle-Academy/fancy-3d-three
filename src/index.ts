/**
 * three.js adapter for `@particle-academy/fancy-3d`.
 *
 * Each widget kind paints onto a 2D HTMLCanvasElement that becomes a three
 * `CanvasTexture`, applied to a plane mesh sized to the widget's pixel rect.
 * The same `Scene` data renders recognizably across the DOM, Babylon, and
 * three.js adapters.
 *
 * `three` is a peer dependency — only consumers building 3D scenes install it.
 *
 *   import { renderScene } from "@particle-academy/fancy-3d";
 *   import { createThreeAdapter, placeOnArc, sceneBounds } from "@particle-academy/fancy-3d-three";
 */
import * as THREE from "three";
import type {
  AdapterContext,
  Scene,
  SceneNode,
  WidgetAdapter,
  WidgetSpec,
} from "@particle-academy/fancy-3d";

import { TEX_SCALE, paintWidget } from "./painters";
export { TEX_SCALE, paintWidget } from "./painters";

const WORLD_SCALE = 1 / 180; // pixels → world units

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

export interface ThreeAdapterDeps {
  /** The three Scene meshes are added to. */
  scene3D: THREE.Scene;
  /** Pixel size for the widget (the scene node's `size` field). */
  sizeFor(spec: WidgetSpec): { w: number; h: number };
}

export function createThreeAdapter(deps: ThreeAdapterDeps): WidgetAdapter<THREE.Object3D> {
  return {
    render(spec: WidgetSpec, ctx: AdapterContext): THREE.Object3D {
      const { w, h } = deps.sizeFor(spec);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * TEX_SCALE));
      canvas.height = Math.max(1, Math.round(h * TEX_SCALE));
      const c = canvas.getContext("2d") as CanvasRenderingContext2D;
      c.scale(TEX_SCALE, TEX_SCALE);
      paintWidget(c, spec, w, h, ctx.selected);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;

      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
      const geo = new THREE.PlaneGeometry(w * WORLD_SCALE, h * WORLD_SCALE);
      const plane = new THREE.Mesh(geo, mat);
      plane.name = `node-${ctx.nodeId}`;
      plane.userData = { nodeId: ctx.nodeId, kind: spec.kind };
      deps.scene3D.add(plane);
      return plane;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * "3D Desktop" layout — wraps the scene's 2D positions onto a partial cylinder
 * facing the camera. DOM `x` becomes angle around the cylinder, DOM `y` becomes
 * height.
 */
export function placeOnCylinder(
  node: SceneNode,
  obj: THREE.Object3D,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  opts: { radius?: number; arc?: number } = {},
) {
  const radius = opts.radius ?? 6;
  const arc = opts.arc ?? Math.PI * 0.9; // ~160°
  const rangeX = bounds.maxX - bounds.minX || 1;
  const rangeY = bounds.maxY - bounds.minY || 1;
  const cx = (node.position.x + (node.size?.w ?? 200) / 2 - bounds.minX) / rangeX;
  const cy = (node.position.y + (node.size?.h ?? 120) / 2 - bounds.minY) / rangeY;
  const angle = (cx - 0.5) * arc;
  const height = (0.5 - cy) * 6;
  obj.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
  // Rotate around Y so the plane's front (+Z normal) points outward toward the
  // orbiting camera.
  obj.rotation.set(0, angle, 0);
}

export function sceneBounds(scene: Scene) {
  const xs = scene.nodes.map((n) => n.position.x);
  const ys = scene.nodes.map((n) => n.position.y);
  const xe = scene.nodes.map((n) => n.position.x + (n.size?.w ?? 200));
  const ye = scene.nodes.map((n) => n.position.y + (n.size?.h ?? 120));
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xe),
    minY: Math.min(...ys),
    maxY: Math.max(...ye),
  };
}

export * from "./primitives";
export * from "./layouts";
