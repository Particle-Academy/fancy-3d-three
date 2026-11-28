// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PX_PER_UNIT, SCENE_PALETTES, frameScene, sceneToWorld, type Scene } from "@particle-academy/fancy-3d";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The same Scene must look the same on three.js as in the DOM renderer. Before
 * this, the adapter painted every card dark (#0f172a) on any page, laid widgets
 * out at its own density, and the demo had to invent a camera — so the scene
 * came out dark, small and tilted next to the DOM's light, fitted view.
 */

const clearCalls: [unknown, number | undefined][] = [];
vi.mock("three", async (importOriginal) => {
  const real = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    setPixelRatio() {}
    getPixelRatio() { return 1; }
    setClearColor(c: unknown, a?: number) { clearCalls.push([c, a]); }
    setSize() {}
    render() {}
    dispose() {}
  }
  return { ...real, WebGLRenderer: FakeRenderer };
});

/** jsdom has no 2D canvas: record what a painter draws instead. */
function fakeContext() {
  const fills: string[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: "#000000", strokeStyle: "#000000", font: "", lineWidth: 1, textAlign: "left", textBaseline: "top", lineJoin: "miter", globalAlpha: 1,
    save() {}, restore() {}, scale() {}, translate() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {}, clip() {}, stroke() {},
    fill() { fills.push(String(ctx.fillStyle)); },
    fillRect() { fills.push(String(ctx.fillStyle)); },
    fillText() {},
    measureText(t: string) { return { width: t.length * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return { ctx, fills };
}

const THREE = await import("three");
const { paintWidget } = await import("../src/painters");
const { createCard3D } = await import("../src/primitives");
const { SceneView, useStage } = await import("../src/react");

const SCENE: Scene = {
  nodes: [
    { id: "revenue", position: { x: 0, y: 40 }, size: { w: 240, h: 150 }, widget: { kind: "kpi", label: "Revenue", value: "$48.2k", delta: "+12.4%", trend: "up" } },
    { id: "signups", position: { x: 300, y: 0 }, size: { w: 300, h: 220 }, widget: { kind: "chart", title: "Signups", variant: "area", series: [3, 7, 5, 9] } },
    { id: "owner", position: { x: 660, y: 40 }, size: { w: 240, h: 150 }, widget: { kind: "profile", name: "Ava Wu", role: "Admin", initials: "AW", status: "online" } },
  ],
  edges: [],
};

let contexts: ReturnType<typeof fakeContext>[] = [];
let frames: FrameRequestCallback[] = [];
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  contexts = [];
  clearCalls.length = 0;
  frames = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const c = fakeContext();
    contexts.push(c);
    return c.ctx as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { frames.push(cb); return frames.length; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1214 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 440 });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  document.documentElement.className = "";
});

describe("painted cards follow the scene theme", () => {
  it("paints a light card on a light page, as the DOM renderer does", () => {
    const { ctx, fills } = fakeContext();
    paintWidget(ctx as unknown as CanvasRenderingContext2D, SCENE.nodes[0].widget, 240, 150);
    expect(fills[0]).toBe(SCENE_PALETTES.light.card);
  });

  it("gives an extruded card the theme's edge, not a hard-coded near-black", () => {
    const mesh = createCard3D({ width: 2.4, height: 1.5, front: { type: "widget", widget: SCENE.nodes[0].widget } });
    const materials = mesh.material as THREE.Material[];
    // three box groups: +X, -X, +Y, -Y, +Z (front), -Z (back).
    const back = materials[5] as THREE.MeshStandardMaterial;
    expect(`#${back.color.getHexString()}`).toBe(SCENE_PALETTES.light.edge);
  });

  it("lays a widget texture out at the core's unit scale (PX_PER_UNIT scene px per unit)", () => {
    const mesh = createCard3D({ width: 2.4, height: 1.5, front: { type: "widget", widget: SCENE.nodes[0].widget } });
    const front = (mesh.material as THREE.Material[])[4] as THREE.MeshBasicMaterial;
    const image = front.map!.image as HTMLCanvasElement;
    // TEX_SCALE (2) x 2.4 units x PX_PER_UNIT.
    expect(image.width).toBe(2 * 2.4 * PX_PER_UNIT);
    expect(image.height).toBe(2 * 1.5 * PX_PER_UNIT);
  });
});

describe("<SceneView>", () => {
  let stage: ReturnType<typeof useStage> | null = null;
  function Probe() {
    stage = useStage();
    return null;
  }
  function render(ui: React.ReactElement) {
    stage = null;
    act(() => root.render(ui));
    return stage!;
  }

  it("frames the camera level and front-on, at the DOM fit's distance", () => {
    const { camera, controls } = render(<SceneView scene={SCENE}><Probe /></SceneView>);
    const f = frameScene(SCENE, { width: 1214, height: 440, fovY: THREE.MathUtils.degToRad(camera.fov) });
    expect(camera.position.x).toBeCloseTo(0, 6);
    expect(camera.position.y).toBeCloseTo(0, 6);
    expect(camera.position.z).toBeCloseTo(f.distance, 6);
    expect(controls.target.toArray()).toEqual([0, 0, 0]);
  });

  it("swings the camera to the viewer's right for a positive yaw", () => {
    const { camera } = render(<SceneView scene={SCENE} yaw={0.4}><Probe /></SceneView>);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.y).toBeCloseTo(0, 6);
  });

  it("paints every card FLAT where the core puts it, as the DOM draws it", () => {
    // A card with thickness shows its inner side face to the camera when it is
    // off-centre: a lit 1px line outside its border that the DOM card does not
    // have. By default a painted card is a plane on the scene plane.
    const { scene } = render(<SceneView scene={SCENE}><Probe /></SceneView>);
    for (const p of sceneToWorld(SCENE)) {
      const mesh = scene.getObjectByName(`scene-node-${p.id}`) as THREE.Mesh;
      expect(mesh, p.id).toBeTruthy();
      expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
      const plane = mesh.geometry as THREE.PlaneGeometry;
      expect(plane.parameters.width).toBeCloseTo(p.width);
      expect(plane.parameters.height).toBeCloseTo(p.height);
      expect(mesh.position.toArray().map((v) => +v.toFixed(6))).toEqual([p.x, p.y, p.z].map((v) => +v.toFixed(6)));
      // Faces the front-on camera (+z), unrotated.
      expect(mesh.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    }
  });

  it("extrudes a card only when a depth is asked for, its face still on the scene plane", () => {
    const { scene } = render(<SceneView scene={SCENE} depth={0.06}><Probe /></SceneView>);
    const p = sceneToWorld(SCENE).find((w) => w.id === "owner")!;
    const mesh = scene.getObjectByName("scene-node-owner") as THREE.Mesh;
    const box = mesh.geometry as THREE.BoxGeometry;
    expect(box).toBeInstanceOf(THREE.BoxGeometry);
    expect(box.parameters.depth).toBeCloseTo(0.06);
    expect(mesh.position.z + box.parameters.depth / 2).toBeCloseTo(p.z);
  });

  it("mounts a live node on a Monitor sized to the node, not as a painted card", () => {
    const { scene } = render(
      <SceneView scene={SCENE} live={(n) => (n.widget.kind === "kpi" ? <b>live</b> : null)}>
        <Probe />
      </SceneView>,
    );
    expect(scene.getObjectByName("scene-node-revenue")).toBeUndefined();
    const overlay = container.querySelector<HTMLElement>('[data-fancy-3d-screen="revenue"]');
    expect(overlay?.style.width).toBe("240px");
    expect(overlay?.style.height).toBe("150px");
  });

  it("clears transparent when asked, so the host's surface shows through", () => {
    render(<SceneView scene={SCENE} background="transparent"><Probe /></SceneView>);
    expect(clearCalls.at(-1)?.[1]).toBe(0);
  });

  it("clears to the theme's canvas colour by default", () => {
    render(<SceneView scene={SCENE} theme="dark"><Probe /></SceneView>);
    const [color, alpha] = clearCalls.at(-1)!;
    expect(`#${(color as THREE.Color).getHexString()}`).toBe(SCENE_PALETTES.dark.canvas);
    expect(alpha).toBe(1);
  });
});
