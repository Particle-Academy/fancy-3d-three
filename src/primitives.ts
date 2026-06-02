/**
 * 3D shape primitives for `@particle-academy/fancy-3d` — three.js edition.
 *
 * A primitive is a three.js mesh that can host UI content on its surface —
 * either a flat color, a freeform 2D paint callback, or a `WidgetSpec`
 * rendered through the same painters as the three.js adapter.
 *
 * Every primitive returns a three.js `Mesh` (or a `Group` for composites),
 * ready to position in your scene. Pass `scene` to also add it for you.
 *
 * Mirrors `@particle-academy/fancy-3d-babylon`'s primitive API: same function
 * names, same option shapes. Differences from the Babylon adapter are minor and
 * idiomatic to three (e.g. `doubleSided?: boolean` instead of a `sideOrientation`
 * enum; `scene` is optional since three meshes exist independent of a scene).
 */
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { WidgetSpec } from "@particle-academy/fancy-3d";
import { TEX_SCALE, paintWidget } from "./painters";

export type PaintFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export type SurfaceContent =
  | { type: "color"; color: string }
  | { type: "paint"; paint: PaintFn; pixelWidth?: number; pixelHeight?: number; transparent?: boolean }
  | { type: "widget"; widget: WidgetSpec; pixelWidth?: number; pixelHeight?: number; selected?: boolean };

const DEFAULT_DENSITY = 120;
const MAX_TEXTURE_AXIS = 1024;

function autoPixelSize(worldWidth: number, worldHeight: number, density = DEFAULT_DENSITY) {
  let w = Math.max(96, Math.round(worldWidth * density));
  let h = Math.max(96, Math.round(worldHeight * density));
  const scale = Math.min(1, MAX_TEXTURE_AXIS / Math.max(w, h));
  if (scale < 1) {
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  return { w, h };
}

/** Draw onto a fresh retina canvas and wrap it in a three CanvasTexture. */
function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * TEX_SCALE));
  canvas.height = Math.max(1, Math.round(h * TEX_SCALE));
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.scale(TEX_SCALE, TEX_SCALE);
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

interface Surface {
  material: THREE.Material;
  texture: THREE.CanvasTexture | null;
}

/**
 * Resolve a SurfaceContent to a three material (+ optional texture). UI surfaces
 * (paint/widget) use an unlit `MeshBasicMaterial` so text stays readable
 * regardless of scene lighting — matching the Babylon adapter's self-emissive
 * panels. Flat colors use a lit `MeshStandardMaterial` so structure reads form.
 */
function buildSurface(surface: SurfaceContent, autoSize?: { worldWidth: number; worldHeight: number }): Surface {
  if (surface.type === "color") {
    const color = new THREE.Color(surface.color);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.15),
      roughness: 0.7,
      metalness: 0.0,
    });
    return { material, texture: null };
  }

  let w = surface.pixelWidth;
  let h = surface.pixelHeight;
  if ((w == null || h == null) && autoSize) {
    const auto = autoPixelSize(autoSize.worldWidth, autoSize.worldHeight);
    w = w ?? auto.w;
    h = h ?? auto.h;
  }
  w = w ?? 512;
  h = h ?? 512;

  const transparent = surface.type === "widget" || (surface.type === "paint" && !!surface.transparent);
  const texture = canvasTexture(w, h, (ctx) => {
    if (surface.type === "paint") surface.paint(ctx, w!, h!);
    else paintWidget(ctx, surface.widget, w!, h!, surface.selected ?? false);
  });
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent, toneMapped: false });
  return { material, texture };
}

/** Add to a scene/group if one was supplied (parity with Babylon's auto-add). */
function attach<T extends THREE.Object3D>(obj: T, scene?: THREE.Object3D): T {
  if (scene) scene.add(obj);
  return obj;
}

/* ------------------------------------------------------------------ */
/* Panel — flat 2D plane with one surface                              */
/* ------------------------------------------------------------------ */

export interface PanelOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number;
  height: number;
  surface: SurfaceContent;
  /** Render both faces (e.g. for self-luminous screens). */
  doubleSided?: boolean;
}

export function createPanel(opts: PanelOpts): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(opts.width, opts.height);
  const { material } = buildSurface(opts.surface, { worldWidth: opts.width, worldHeight: opts.height });
  if (opts.doubleSided) material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = opts.name ?? "panel";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Billboard — panel that can be set to always face the camera         */
/* ------------------------------------------------------------------ */

export interface BillboardOpts extends PanelOpts {
  /** When true, the mesh is flagged to always face the camera. `<Stage>` honors
   *  the flag each frame; outside a Stage, call `mesh.lookAt(camera.position)`. */
  faceCamera?: boolean;
}

export function createBillboard(opts: BillboardOpts): THREE.Mesh {
  const m = createPanel({ ...opts, scene: undefined, name: opts.name ?? "billboard" });
  if (opts.faceCamera) m.userData.faceCamera = true;
  return attach(m, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Building — rectangular box with optional facade texture             */
/* ------------------------------------------------------------------ */

export interface BuildingOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number;
  height: number;
  depth: number;
  /** Surface applied to all 6 faces (cheap path). */
  surface?: SurfaceContent;
  /** Per-face surfaces; missing faces use `surface` or a default grey. */
  faces?: Partial<Record<BoxFace, SurfaceContent>>;
}

export type BoxFace = "front" | "back" | "right" | "left" | "top" | "bottom";

/** three BoxGeometry group order: +X, -X, +Y, -Y, +Z, -Z. */
const THREE_FACE_ORDER: BoxFace[] = ["right", "left", "top", "bottom", "front", "back"];

export function createBuilding(opts: BuildingOpts): THREE.Mesh {
  const geo = new THREE.BoxGeometry(opts.width, opts.height, opts.depth);

  if (opts.surface && !opts.faces) {
    const { material } = buildSurface(opts.surface, { worldWidth: opts.width, worldHeight: opts.height });
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = opts.name ?? "building";
    return attach(mesh, opts.scene);
  }

  // Per-face: three exposes 6 geometry groups, one per face — assign a material
  // array in +X,-X,+Y,-Y,+Z,-Z order.
  const materials = THREE_FACE_ORDER.map((face) => {
    const surface = opts.faces?.[face] ?? opts.surface ?? { type: "color" as const, color: "#475569" };
    const isSide = face === "front" || face === "back";
    return buildSurface(surface, { worldWidth: isSide ? opts.width : opts.depth, worldHeight: opts.height }).material;
  });
  const mesh = new THREE.Mesh(geo, materials);
  mesh.name = opts.name ?? "building";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Pillar — alias for a tall narrow building                           */
/* ------------------------------------------------------------------ */

export interface PillarOpts {
  scene?: THREE.Object3D;
  name?: string;
  thickness: number;
  height: number;
  surface?: SurfaceContent;
}

export function createPillar(opts: PillarOpts): THREE.Mesh {
  return createBuilding({
    scene: opts.scene,
    name: opts.name ?? "pillar",
    width: opts.thickness,
    depth: opts.thickness,
    height: opts.height,
    surface: opts.surface,
  });
}

/* ------------------------------------------------------------------ */
/* Cylinder — tube with content wrapping the side                      */
/* ------------------------------------------------------------------ */

export interface CylinderOpts {
  scene?: THREE.Object3D;
  name?: string;
  radius: number;
  height: number;
  surface: SurfaceContent;
  tessellation?: number;
}

export function createCylinder(opts: CylinderOpts): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(opts.radius, opts.radius, opts.height, opts.tessellation ?? 48, 1, false);
  const { material } = buildSurface(opts.surface, { worldWidth: opts.radius * 2 * Math.PI, worldHeight: opts.height });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = opts.name ?? "cylinder";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* CurvedPanel — a partial cylindrical sheet (like a wraparound ad)    */
/* ------------------------------------------------------------------ */

export interface CurvedPanelOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number; // arc length
  height: number;
  arc: number; // radians spanned
  surface: SurfaceContent;
  tessellation?: number;
}

export function createCurvedPanel(opts: CurvedPanelOpts): THREE.Mesh {
  const radius = opts.width / opts.arc;
  const segments = Math.max(8, opts.tessellation ?? 48);
  // Open-ended partial cylinder, centered on the +Z axis (thetaStart offsets the
  // arc so it's symmetric about the camera's default forward direction).
  const geo = new THREE.CylinderGeometry(
    radius,
    radius,
    opts.height,
    segments,
    1,
    true,
    Math.PI / 2 - opts.arc / 2,
    opts.arc,
  );
  const { material } = buildSurface(opts.surface, { worldWidth: opts.width, worldHeight: opts.height });
  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = opts.name ?? "curved-panel";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Sphere — full sphere with equirectangular surface                   */
/* ------------------------------------------------------------------ */

export interface SphereOpts {
  scene?: THREE.Object3D;
  name?: string;
  diameter: number;
  surface: SurfaceContent;
  segments?: number;
}

export function createSphere(opts: SphereOpts): THREE.Mesh {
  const geo = new THREE.SphereGeometry(opts.diameter / 2, opts.segments ?? 32, opts.segments ?? 32);
  const { material } = buildSurface(opts.surface, { worldWidth: opts.diameter * Math.PI, worldHeight: (opts.diameter * Math.PI) / 2 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = opts.name ?? "sphere";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Disc — flat disc/circle                                             */
/* ------------------------------------------------------------------ */

export interface DiscOpts {
  scene?: THREE.Object3D;
  name?: string;
  radius: number;
  surface: SurfaceContent;
  tessellation?: number;
}

export function createDisc(opts: DiscOpts): THREE.Mesh {
  const geo = new THREE.CircleGeometry(opts.radius, opts.tessellation ?? 64);
  const { material } = buildSurface(opts.surface, { worldWidth: opts.radius * 2, worldHeight: opts.radius * 2 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = opts.name ?? "disc";
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Card3D — an extruded panel (gives panels physical depth)            */
/* ------------------------------------------------------------------ */

export interface Card3DOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number;
  height: number;
  /** Extrusion depth. Defaults to a thin 0.06 — like real foam-board signage. */
  depth?: number;
  /** Surface for the front face (the visible UI). */
  front: SurfaceContent;
  /** Surface for the side and back faces. Defaults to a dark color. */
  edge?: SurfaceContent;
}

export function createCard3D(opts: Card3DOpts): THREE.Mesh {
  const edge = opts.edge ?? { type: "color" as const, color: "#0b0f17" };
  return createBuilding({
    scene: opts.scene,
    name: opts.name ?? "card3d",
    width: opts.width,
    height: opts.height,
    depth: opts.depth ?? 0.06,
    faces: { front: opts.front, back: edge, top: edge, bottom: edge, left: edge, right: edge },
  });
}

/* ------------------------------------------------------------------ */
/* Sign — a panel mounted on a post                                     */
/* ------------------------------------------------------------------ */

export interface SignOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number;
  height: number;
  postHeight?: number;
  postThickness?: number;
  surface: SurfaceContent;
  postColor?: string;
}

export interface SignResult {
  root: THREE.Group;
  panel: THREE.Mesh;
  post: THREE.Mesh;
}

export function createSign(opts: SignOpts): SignResult {
  const name = opts.name ?? "sign";
  const postHeight = opts.postHeight ?? 1.4;
  const postThickness = opts.postThickness ?? 0.12;
  const postColor = opts.postColor ?? "#1f2937";

  const root = new THREE.Group();
  root.name = `${name}-root`;

  const panel = createBillboard({ name: `${name}-panel`, width: opts.width, height: opts.height, surface: opts.surface });
  panel.position.set(0, postHeight + opts.height / 2, 0);
  root.add(panel);

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(postThickness, postHeight, postThickness),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(postColor), roughness: 0.6 }),
  );
  post.name = `${name}-post`;
  post.position.set(0, postHeight / 2, 0);
  root.add(post);

  attach(root, opts.scene);
  return { root, panel, post };
}

/* ------------------------------------------------------------------ */
/* Monitor — a 3D display: extruded bezel + recessed screen face       */
/* ------------------------------------------------------------------ */

export interface MonitorOpts {
  scene?: THREE.Object3D;
  name?: string;
  width: number;
  height: number;
  /** Front-to-back depth of the display chassis. Defaults to 0.18. */
  depth?: number;
  /** Bezel color. Defaults to near-black. */
  bezel?: string;
  /** Screen surface — color, paint, or widget. */
  screen: SurfaceContent;
  /** Optional kickstand height — when set, the monitor sits on a base. */
  standHeight?: number;
}

export interface MonitorResult {
  root: THREE.Group;
  body: THREE.Mesh;
  screen: THREE.Mesh;
  stand?: THREE.Mesh;
}

export function createMonitor(opts: MonitorOpts): MonitorResult {
  const name = opts.name ?? "monitor";
  const depth = opts.depth ?? 0.18;
  const bezelColor = new THREE.Color(opts.bezel ?? "#0b0f17");
  const bodyMat = new THREE.MeshStandardMaterial({ color: bezelColor, roughness: 0.5, metalness: 0.1 });

  const root = new THREE.Group();
  root.name = `${name}-root`;

  const body = new THREE.Mesh(new THREE.BoxGeometry(opts.width, opts.height, depth), bodyMat);
  body.name = `${name}-body`;
  root.add(body);

  // Screen face — a plane on the +Z front of the bezel (PlaneGeometry faces +Z
  // by default, which is where the default camera sits, so no flip needed).
  const screenInset = 0.04;
  const screen = createPanel({
    name: `${name}-screen`,
    width: opts.width - screenInset * 2,
    height: opts.height - screenInset * 2,
    surface: opts.screen,
  });
  screen.position.set(0, 0, depth / 2 + 0.005);
  root.add(screen);

  let stand: THREE.Mesh | undefined;
  if (opts.standHeight && opts.standHeight > 0) {
    stand = new THREE.Mesh(new THREE.BoxGeometry(opts.width * 0.3, opts.standHeight, depth * 1.5), bodyMat);
    stand.name = `${name}-stand`;
    stand.position.set(0, -opts.height / 2 - opts.standHeight / 2, 0);
    root.add(stand);
  }

  attach(root, opts.scene);
  return { root, body, screen, stand };
}

/* ------------------------------------------------------------------ */
/* Decal — project a 2D pattern onto another mesh's surface            */
/* ------------------------------------------------------------------ */

export interface DecalOpts {
  scene?: THREE.Object3D;
  name?: string;
  /** The mesh to project the decal onto. */
  target: THREE.Mesh;
  /** World-space position the projector sits at. */
  position: THREE.Vector3;
  /** Direction the projector points. Defaults to -Z. */
  normal?: THREE.Vector3;
  /** Size of the decal box. */
  size: { width: number; height: number; depth?: number };
  /** Rotation around the projection axis (radians). */
  angle?: number;
  /** Surface to project. */
  surface: SurfaceContent;
}

export function createDecal(opts: DecalOpts): THREE.Mesh {
  const name = opts.name ?? "decal";
  const normal = (opts.normal ?? new THREE.Vector3(0, 0, -1)).clone().normalize();

  // Orientation: align the decal projector's forward (+Z) to the normal, plus a
  // roll of `angle` around that axis.
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  if (opts.angle) quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), opts.angle));
  const orientation = new THREE.Euler().setFromQuaternion(quat);
  const size = new THREE.Vector3(opts.size.width, opts.size.height, opts.size.depth ?? 1);

  const geo = new DecalGeometry(opts.target, opts.position, orientation, size);
  const { material } = buildSurface(opts.surface, { worldWidth: opts.size.width, worldHeight: opts.size.height });
  // Decals sit on top of the target — offset to avoid z-fighting + show the
  // target through transparent borders.
  (material as THREE.MeshBasicMaterial).transparent = true;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;
  material.depthWrite = false;
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  return attach(mesh, opts.scene);
}

/* ------------------------------------------------------------------ */
/* Helper: paint a widget onto a fresh CanvasTexture (escape hatch)    */
/* ------------------------------------------------------------------ */

export function createWidgetTexture(
  name: string,
  widget: WidgetSpec,
  pixelWidth: number,
  pixelHeight: number,
  selected = false,
): THREE.CanvasTexture {
  const tex = canvasTexture(pixelWidth, pixelHeight, (ctx) => paintWidget(ctx, widget, pixelWidth, pixelHeight, selected));
  tex.name = name;
  return tex;
}
