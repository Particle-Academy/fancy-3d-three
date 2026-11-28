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
import { PX_PER_UNIT, nodeSize, sceneBounds as coreSceneBounds } from "@particle-academy/fancy-3d";

import { TEX_SCALE, paintWidget } from "./painters";
export { TEX_SCALE, paintWidget } from "./painters";

/** Scene px to world units: the core's one unit scale, shared with every renderer. */
const WORLD_SCALE = 1 / PX_PER_UNIT;

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
  const { w, h } = nodeSize(node);
  const cx = (node.position.x + w / 2 - bounds.minX) / rangeX;
  const cy = (node.position.y + h / 2 - bounds.minY) / rangeY;
  const angle = (cx - 0.5) * arc;
  const height = (0.5 - cy) * 6;
  obj.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
  // Rotate around Y so the plane's front (+Z normal) points outward toward the
  // orbiting camera.
  obj.rotation.set(0, angle, 0);
}

/**
 * The box around a scene's nodes, in scene px, with the core's default node
 * size for a node that has none. It used to assume 200 x 120 here while the
 * core and the DOM renderer used 240 x 150, so one scene had two extents.
 */
export function sceneBounds(scene: Scene) {
  // An empty scene has no extent, and saying so is the only safe answer: an
  // inverted infinite box would centre every layout on NaN, which renders as
  // nothing, so an empty scene and a broken one would look identical.
  return coreSceneBounds(scene) ?? { minX: 0, maxX: 0, minY: 0, maxY: 0 };
}

export * from "./primitives";
export * from "./layouts";
