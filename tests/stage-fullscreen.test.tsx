// @vitest-environment jsdom
import { act, createRef, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullscreenContext, useFullscreen, useFullscreenContext, type FullscreenController } from "@particle-academy/fancy-3d/fullscreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no WebGL. Everything else about the Stage is real.
const sizes = vi.hoisted(() => ({ calls: [] as Array<[number, number]> }));
vi.mock("three", async (importOriginal) => {
  const real = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    setPixelRatio() {}
    getPixelRatio() {
      return 1;
    }
    setClearColor() {}
    setSize(w: number, h: number) {
      sizes.calls.push([w, h]);
    }
    render() {}
    dispose() {}
  }
  return { ...real, WebGLRenderer: FakeRenderer };
});

const { Stage, SceneView, useStage } = await import("../src/react");
type StageCtx = ReturnType<typeof useStage>;
type StageHandleT = import("../src/react").StageHandle;

let frames: FrameRequestCallback[] = [];
const runFrames = () => {
  for (let i = 0; i < 3; i++) {
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(performance.now()));
  }
};

// The Fullscreen API, mocked as a browser behaves.
let fsElement: Element | null = null;
const proto = HTMLElement.prototype as HTMLElement & { requestFullscreen?: () => Promise<void> };
function installApi() {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fsElement });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
  proto.requestFullscreen = function (this: HTMLElement) {
    fsElement = this;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
  (document as { exitFullscreen?: () => Promise<void> }).exitFullscreen = () => {
    fsElement = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    return Promise.resolve();
  };
}
function removeApi() {
  delete (proto as { requestFullscreen?: unknown }).requestFullscreen;
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => undefined });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  frames = [];
  sizes.calls = [];
  fsElement = null;
  installApi();
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
  document.documentElement.style.overflow = "";
});

const stageEl = () => container.querySelector<HTMLElement>("[data-fancy-3d-stage]")!;
const button = () => container.querySelector<HTMLButtonElement>("[data-fancy-3d-fullscreen-button]");

function Probe({ onStage }: { onStage: (s: StageCtx) => void }) {
  const stage = useStage();
  useEffect(() => {
    onStage(stage);
  }, [stage, onStage]);
  return null;
}

/** Give the Stage box a size, as the browser would once it fills the screen. */
function sizeBox(el: HTMLElement, w: number, h: number) {
  Object.defineProperty(el, "clientWidth", { configurable: true, get: () => w });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => h });
}

describe("Stage full screen", () => {
  it("shows a full-screen button by default, inside the Stage root", () => {
    act(() => root.render(<Stage />));
    expect(button()).not.toBe(null);
    expect(stageEl().contains(button())).toBe(true);
    expect(stageEl().getAttribute("data-fancy-3d-fullscreen")).toBe("false");
  });

  it("fullscreenButton={false} hides it", () => {
    act(() => root.render(<Stage fullscreenButton={false} />));
    expect(button()).toBe(null);
  });

  it("the button full-screens the Stage root, overlay and Monitors included", async () => {
    act(() =>
      root.render(
        <Stage overlay={<nav data-crumbs="">crumbs</nav>}>
          <Probe onStage={() => {}} />
        </Stage>,
      ),
    );
    act(() => button()!.click());
    await flush();
    expect(document.fullscreenElement).toBe(stageEl());
    expect(stageEl().contains(container.querySelector("[data-crumbs]"))).toBe(true);
    expect(stageEl().contains(container.querySelector("[data-fancy-3d-overlay-root]"))).toBe(true);
    expect(stageEl().getAttribute("data-fancy-3d-fullscreen-mode")).toBe("native");
  });

  it("the overlay layer passes clicks through except on its content", () => {
    act(() => root.render(<Stage overlay={<button type="button" data-crumb="">x</button>} />));
    const layer = container.querySelector<HTMLElement>("[data-fancy-3d-stage-overlay]")!;
    expect(layer.style.pointerEvents).toBe("none");
    const css = container.querySelector("style[data-fancy-3d-stage-css]")!.textContent!;
    expect(css).toMatch(/\[data-fancy-3d-stage-overlay\]\s*>\s*\*\s*\{\s*pointer-events:\s*auto/);
  });

  it("is controlled, and reports the user's change", async () => {
    const onChange = vi.fn();
    act(() => root.render(<Stage fullscreen={false} onFullscreenChange={onChange} />));
    act(() => button()!.click());
    await flush();
    expect(onChange).toHaveBeenCalledWith(true, { source: "user" });
    expect(document.fullscreenElement).toBe(null);
    act(() => root.render(<Stage fullscreen onFullscreenChange={onChange} />));
    await flush();
    expect(document.fullscreenElement).toBe(stageEl());
  });

  it("has a handle method", async () => {
    const ref = createRef<StageHandleT>();
    act(() => root.render(<Stage ref={ref} />));
    act(() => ref.current!.setFullscreen(true));
    await flush();
    expect(ref.current!.getFullscreen()).toEqual({ fullscreen: true, mode: "native" });
    expect(ref.current!.root).toBe(stageEl());
    act(() => ref.current!.toggleFullscreen());
    await flush();
    expect(ref.current!.getFullscreen()).toEqual({ fullscreen: false, mode: null });
  });

  it("a resize recalculates the renderer size and the camera aspect (expanded fallback)", async () => {
    removeApi();
    let stage: StageCtx | null = null;
    act(() =>
      root.render(
        <Stage>
          <Probe onStage={(s) => (stage = s)} />
        </Stage>,
      ),
    );
    act(() => button()!.click());
    await flush();
    expect(stageEl().style.position).toBe("fixed");
    sizeBox(stageEl(), 1600, 900);
    act(() => runFrames());
    expect(sizes.calls.at(-1)).toEqual([1600, 900]);
    expect(stage!.camera.aspect).toBeCloseTo(1600 / 900);
  });

  it("the canvas keeps keyboard focus across the switch", async () => {
    act(() => root.render(<Stage />));
    const canvas = container.querySelector<HTMLCanvasElement>("[data-fancy-3d-canvas]")!;
    canvas.focus();
    act(() => {
      button()!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      button()!.click();
    });
    await flush();
    expect(document.activeElement).toBe(canvas);
  });

  it("children and the overlay can read the controller (to render their own toggle)", () => {
    let seen: FullscreenController | null = null;
    function Reader() {
      seen = useFullscreenContext();
      return null;
    }
    act(() => root.render(<Stage overlay={<Reader />} />));
    expect(seen).not.toBe(null);
    expect(seen!.fullscreen).toBe(false);
  });

  it("inside a viewer that owns full screen, the Stage defers to it", async () => {
    let seen: FullscreenController | null = null;
    function Reader() {
      seen = useFullscreenContext();
      return null;
    }
    function Outer() {
      const ref = useRef<HTMLDivElement>(null);
      const fs = useFullscreen(ref);
      return (
        <FullscreenContext.Provider value={fs}>
          <div ref={ref} data-outer="">
            <Stage fullscreenButton={false} overlay={<Reader />} />
          </div>
        </FullscreenContext.Provider>
      );
    }
    act(() => root.render(<Outer />));
    // The Stage's own hook is inert: no handle on it, and its children get the outer controller.
    expect(stageEl().hasAttribute("data-fancy-3d-fullscreen")).toBe(false);
    act(() => seen!.setFullscreen(true));
    await flush();
    expect(document.fullscreenElement).toBe(container.querySelector("[data-outer]"));
  });
});

describe("SceneView full screen", () => {
  it("passes the full-screen props and the overlay to its Stage", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const onChange = vi.fn();
    act(() =>
      root.render(<SceneView scene={{ nodes: [] }} onFullscreenChange={onChange} overlay={<div data-fact-card="">fact</div>} />),
    );
    expect(stageEl().contains(container.querySelector("[data-fact-card]"))).toBe(true);
    act(() => button()!.click());
    await flush();
    expect(onChange).toHaveBeenCalledWith(true, { source: "user" });
    expect(document.fullscreenElement).toBe(stageEl());
  });
});
