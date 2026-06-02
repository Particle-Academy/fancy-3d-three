/**
 * Layout helpers — map 2D scene-node positions onto 3D arrangements (three.js).
 *
 * All layout functions take the same shape: a SceneNode, the Object3D that was
 * built for it, the scene's bounds, and layout-specific options. They mutate
 * `obj.position` (and sometimes `obj.rotation.y`) in place.
 *
 * Pair with `sceneBounds(scene)` from the package root to compute the bounds.
 * Mirrors `@particle-academy/fancy-3d-babylon`'s layout API.
 */
import * as THREE from "three";
import type { SceneNode } from "@particle-academy/fancy-3d";

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function sizeOf(node: SceneNode): { w: number; h: number } {
  return { w: node.size?.w ?? 200, h: node.size?.h ?? 120 };
}

function normalizedCenter(node: SceneNode, bounds: Bounds) {
  const { w, h } = sizeOf(node);
  const cx = (node.position.x + w / 2 - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX);
  const cy = (node.position.y + h / 2 - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY);
  return { cx, cy };
}

/* ------------------------------------------------------------------ */
/* Grid — flat XY grid in front of the camera                          */
/* ------------------------------------------------------------------ */

export interface GridLayoutOpts {
  /** Pixel-to-world unit ratio. Defaults to 1/120. */
  scale?: number;
  /** World-space center of the grid. Defaults to (0, 0, 0). */
  origin?: THREE.Vector3;
}

export function placeOnGrid(node: SceneNode, obj: THREE.Object3D, bounds: Bounds, opts: GridLayoutOpts = {}) {
  const scale = opts.scale ?? 1 / 120;
  const origin = opts.origin ?? new THREE.Vector3(0, 0, 0);
  const { w, h } = sizeOf(node);
  const cx = node.position.x + w / 2 - (bounds.minX + bounds.maxX) / 2;
  const cy = node.position.y + h / 2 - (bounds.minY + bounds.maxY) / 2;
  obj.position.set(origin.x + cx * scale, origin.y - cy * scale, origin.z);
}

/* ------------------------------------------------------------------ */
/* Wall — gallery layout against a vertical plane                      */
/* ------------------------------------------------------------------ */

export interface WallLayoutOpts {
  z?: number;
  spreadX?: number;
  spreadY?: number;
  centerY?: number;
}

export function placeOnWall(node: SceneNode, obj: THREE.Object3D, bounds: Bounds, opts: WallLayoutOpts = {}) {
  const spreadX = opts.spreadX ?? 10;
  const spreadY = opts.spreadY ?? 4;
  const centerY = opts.centerY ?? 1.5;
  const z = opts.z ?? 0;
  const { cx, cy } = normalizedCenter(node, bounds);
  obj.position.set((cx - 0.5) * spreadX, centerY + (0.5 - cy) * spreadY, z);
  obj.rotation.y = 0;
}

/* ------------------------------------------------------------------ */
/* Arc — partial cylinder                                              */
/* ------------------------------------------------------------------ */

export interface ArcLayoutOpts {
  radius?: number;
  arc?: number;
  height?: number;
  baseY?: number;
}

export function placeOnArc(node: SceneNode, obj: THREE.Object3D, bounds: Bounds, opts: ArcLayoutOpts = {}) {
  const radius = opts.radius ?? 6;
  const arc = opts.arc ?? Math.PI * 0.9;
  const height = opts.height ?? 6;
  const baseY = opts.baseY ?? 0;
  const { cx, cy } = normalizedCenter(node, bounds);
  const angle = (cx - 0.5) * arc;
  obj.position.set(Math.sin(angle) * radius, baseY + (0.5 - cy) * height, Math.cos(angle) * radius);
  obj.rotation.y = angle;
}

/* ------------------------------------------------------------------ */
/* Path — distribute along a sequence of waypoints                     */
/* ------------------------------------------------------------------ */

export interface PathLayoutOpts {
  waypoints: THREE.Vector3[];
  faceForward?: boolean;
  byIndex?: boolean;
  nodeCount?: number;
}

function lerpPath(waypoints: THREE.Vector3[], t: number): { pos: THREE.Vector3; tangent: THREE.Vector3 } {
  if (waypoints.length === 0) return { pos: new THREE.Vector3(0, 0, 0), tangent: new THREE.Vector3(0, 0, 1) };
  if (waypoints.length === 1) return { pos: waypoints[0].clone(), tangent: new THREE.Vector3(0, 0, 1) };
  const segments = waypoints.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * segments;
  const i = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - i;
  const a = waypoints[i];
  const b = waypoints[i + 1];
  const pos = a.clone().lerp(b, local);
  const tangent = b.clone().sub(a).normalize();
  return { pos, tangent };
}

export function placeOnPath(node: SceneNode, obj: THREE.Object3D, bounds: Bounds, opts: PathLayoutOpts) {
  const faceForward = opts.faceForward ?? true;
  let t: number;
  if (opts.byIndex) {
    const total = opts.nodeCount ?? Math.max(1, bounds.maxX - bounds.minX);
    const idx = node.position.x;
    t = total > 1 ? idx / (total - 1) : 0.5;
  } else {
    const { cx } = normalizedCenter(node, bounds);
    t = cx;
  }
  const { pos, tangent } = lerpPath(opts.waypoints, t);
  obj.position.copy(pos);
  if (faceForward) obj.rotation.y = Math.atan2(tangent.x, tangent.z);
}

/* ------------------------------------------------------------------ */
/* Sphere — wrap nodes onto a sphere surface                            */
/* ------------------------------------------------------------------ */

export interface SphereLayoutOpts {
  radius?: number;
  center?: THREE.Vector3;
  latSpan?: number;
  lonSpan?: number;
}

export function placeOnSphere(node: SceneNode, obj: THREE.Object3D, bounds: Bounds, opts: SphereLayoutOpts = {}) {
  const radius = opts.radius ?? 5;
  const center = opts.center ?? new THREE.Vector3(0, 0, 0);
  const latSpan = opts.latSpan ?? Math.PI * 0.7;
  const lonSpan = opts.lonSpan ?? Math.PI * 2;
  const { cx, cy } = normalizedCenter(node, bounds);
  const lon = (cx - 0.5) * lonSpan;
  const lat = (0.5 - cy) * latSpan;
  const x = radius * Math.cos(lat) * Math.sin(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.cos(lon);
  obj.position.set(center.x + x, center.y + y, center.z + z);
  obj.rotation.y = lon;
}
