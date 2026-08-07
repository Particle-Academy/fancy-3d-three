import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { sceneBounds } from "../src/index";
import { placeOnArc, placeOnGrid, placeOnWall } from "../src/layouts";
import type { Scene, SceneNode } from "@particle-academy/fancy-3d";

const node = (x: number, y: number, w?: number, h?: number): SceneNode =>
    ({
        id: `n-${x}-${y}`,
        position: { x, y },
        size: w != null ? { w, h: h ?? 120 } : undefined,
        widget: { kind: "kpi" },
    }) as unknown as SceneNode;

const scene = (nodes: SceneNode[]): Scene => ({ nodes, edges: [] }) as unknown as Scene;

const BOUNDS = { minX: 0, maxX: 400, minY: 0, maxY: 240 };

describe("sceneBounds", () => {
    it("spans from each node's origin to its far corner", () => {
        // maxX/maxY must include the node's SIZE, not just its position, or
        // anything laid out from these bounds is off by half a card.
        const b = sceneBounds(scene([node(0, 0, 200, 120), node(300, 100, 200, 120)]));

        expect(b).toEqual({ minX: 0, maxX: 500, minY: 0, maxY: 220 });
    });

    it("assumes a default card size for a node that declares none", () => {
        const b = sceneBounds(scene([node(0, 0)]));

        expect(b.maxX).toBe(200);
        expect(b.maxY).toBe(120);
    });

    it("handles negative positions", () => {
        const b = sceneBounds(scene([node(-100, -50, 100, 50)]));

        expect(b.minX).toBe(-100);
        expect(b.maxX).toBe(0);
    });

    it("returns finite bounds for an empty scene", () => {
        // Math.min(...[]) is Infinity and Math.max(...[]) is -Infinity, so an
        // unguarded spread hands a caller inverted infinite bounds. Anything
        // that then frames a camera or centres a layout on them produces NaN
        // positions, and a NaN transform renders as nothing at all — an empty
        // scene and a broken one look identical.
        const b = sceneBounds(scene([]));

        expect(Number.isFinite(b.minX)).toBe(true);
        expect(Number.isFinite(b.maxX)).toBe(true);
        expect(Number.isFinite(b.minY)).toBe(true);
        expect(Number.isFinite(b.maxY)).toBe(true);
    });
});

describe("placeOnGrid", () => {
    it("puts a node centred in the bounds at the layout origin", () => {
        const obj = new THREE.Object3D();
        placeOnGrid(node(100, 60, 200, 120), obj, BOUNDS);

        // Node centre is (200, 120); bounds centre is (200, 120) → offset zero.
        expect(obj.position.x).toBeCloseTo(0, 6);
        expect(obj.position.y).toBeCloseTo(0, 6);
    });

    it("flips the y axis, because screen y grows downward and world y grows up", () => {
        // Getting this backwards mirrors the whole scene vertically, which
        // looks plausible until you read a label.
        const lower = new THREE.Object3D();
        placeOnGrid(node(100, 200, 200, 120), lower, BOUNDS);

        expect(lower.position.y).toBeLessThan(0);
    });

    it("scales pixels into world units", () => {
        const a = new THREE.Object3D();
        const b = new THREE.Object3D();
        placeOnGrid(node(400, 60, 200, 120), a, BOUNDS, { scale: 1 / 120 });
        placeOnGrid(node(400, 60, 200, 120), b, BOUNDS, { scale: 1 / 60 });

        expect(Math.abs(b.position.x)).toBeCloseTo(Math.abs(a.position.x) * 2, 6);
    });

    it("offsets everything by the supplied origin", () => {
        const obj = new THREE.Object3D();
        placeOnGrid(node(100, 60, 200, 120), obj, BOUNDS, { origin: new THREE.Vector3(5, 6, 7) });

        expect(obj.position.x).toBeCloseTo(5, 6);
        expect(obj.position.y).toBeCloseTo(6, 6);
        expect(obj.position.z).toBeCloseTo(7, 6);
    });
});

describe("placeOnArc", () => {
    it("puts the middle of the scene straight ahead on the arc", () => {
        const obj = new THREE.Object3D();
        placeOnArc(node(100, 60, 200, 120), obj, BOUNDS, { radius: 6 });

        // Centre → angle 0 → sin 0, cos 1.
        expect(obj.position.x).toBeCloseTo(0, 6);
        expect(obj.position.z).toBeCloseTo(6, 6);
        expect(obj.rotation.y).toBeCloseTo(0, 6);
    });

    it("turns each node to face the viewer as it moves round the arc", () => {
        // Position and rotation must use the SAME angle, or cards on the edges
        // of the arc sit correctly but face away.
        const obj = new THREE.Object3D();
        placeOnArc(node(300, 60, 200, 120), obj, BOUNDS, { radius: 6, arc: Math.PI });

        expect(obj.rotation.y).not.toBe(0);
        expect(obj.position.x).toBeCloseTo(Math.sin(obj.rotation.y) * 6, 6);
        expect(obj.position.z).toBeCloseTo(Math.cos(obj.rotation.y) * 6, 6);
    });
});

describe("placeOnWall", () => {
    it("keeps the wall flat — no per-node rotation", () => {
        const obj = new THREE.Object3D();
        placeOnWall(node(100, 60, 200, 120), obj, BOUNDS);

        expect(obj.rotation.y).toBe(0);
    });

    it("spreads across the wall and hangs it around eye height", () => {
        const left = new THREE.Object3D();
        const right = new THREE.Object3D();
        placeOnWall(node(0, 60, 200, 120), left, BOUNDS, { spreadX: 10 });
        placeOnWall(node(200, 60, 200, 120), right, BOUNDS, { spreadX: 10 });

        expect(left.position.x).toBeLessThan(right.position.x);
        expect(left.position.y).toBeCloseTo(1.5, 6);
    });
});
