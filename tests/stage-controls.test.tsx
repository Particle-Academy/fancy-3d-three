// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no WebGL. Everything else about the Stage is real: the scene, the
// camera, the OrbitControls and the frame loop.
vi.mock("three", async (importOriginal) => {
  const real = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    setPixelRatio() {}
    getPixelRatio() {
      return 1;
    }
    setClearColor() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  return { ...real, WebGLRenderer: FakeRenderer };
});

const THREE = await import("three");
const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
const { Stage, useStage } = await import("../src/react");

type StageCtx = ReturnType<typeof useStage>;

let frames: FrameRequestCallback[] = [];
const runFrame = () => {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb(performance.now()));
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function Probe({ onStage }: { onStage: (s: StageCtx) => void }) {
  const stage = useStage();
  useEffect(() => {
    onStage(stage);
  }, [stage, onStage]);
  return null;
}

function mount(props: Record<string, unknown> = {}): StageCtx {
  let ctx: StageCtx | null = null;
  act(() => root.render(<Stage {...props}><Probe onStage={(s) => {
    ctx = s;
  }} /></Stage>));
  expect(ctx).not.toBeNull();
  return ctx!;
}

describe("Stage context `controls` handle", () => {
  it("exposes the Stage's OrbitControls, bound to its camera and canvas", () => {
    const stage = mount({ cameraTarget: [1, 2, 3] });
    expect(stage.controls).toBeInstanceOf(OrbitControls);
    expect(stage.controls.object).toBe(stage.camera);
    expect(stage.controls.domElement).toBe(stage.canvas);
    expect(stage.controls.target.toArray()).toEqual([1, 2, 3]);
  });

  it("still calls camera.lookAt(controls.target) every frame, with the target object itself", () => {
    // Consumers that predate the handle find the orbit target this way; keep it working until they migrate.
    const stage = mount();
    const seen: unknown[] = [];
    const original = stage.camera.lookAt.bind(stage.camera);
    stage.camera.lookAt = ((...args: Parameters<typeof original>) => {
      seen.push(args[0]);
      return original(...args);
    }) as typeof stage.camera.lookAt;
    act(() => {
      runFrame();
      runFrame();
    });
    expect(seen.filter((v) => v === stage.controls.target).length).toBeGreaterThanOrEqual(2);
  });

  it("lets a child drive the camera: moving the target changes where the camera looks next frame", () => {
    const stage = mount({ bare: true, cameraRadius: 10, cameraTarget: [0, 0, 0] });
    stage.controls.enableDamping = false;
    stage.controls.target.set(5, 0, 0);
    act(() => runFrame());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(stage.camera.quaternion);
    const toTarget = stage.controls.target.clone().sub(stage.camera.position).normalize();
    expect(forward.dot(toTarget)).toBeCloseTo(1, 5);
  });

  it("renders existing Stages unchanged: same markup", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(<Stage />);
    expect(html).toMatch(/data-fancy-3d-stage=""/);
    expect(html).toMatch(/data-fancy-3d-canvas=""/);
  });
});
