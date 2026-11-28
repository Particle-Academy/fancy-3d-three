/**
 * `<Stage>` and `<Monitor>` — declarative React API for fancy-3d (three.js).
 *
 *   <Stage>
 *     <Monitor position={[0, 2, 0]} width={4} height={2.5}>
 *       <Card>...real react-fancy components...</Card>
 *     </Monitor>
 *   </Stage>
 *
 * `<Stage>` owns the three renderer + scene + camera (OrbitControls) + render
 * loop and exposes them via context. `<Monitor>` builds a bezel mesh, projects
 * its world-space corners to screen space each frame, and renders its children
 * into a positioned DOM overlay — real, interactive React, not a rasterized
 * snapshot. Mirrors `@particle-academy/fancy-3d-babylon`'s React API.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  FIT_PADDING,
  SCENE_PALETTES,
  fitZoom,
  frameScene,
  resolveSceneTheme,
  sceneBounds,
  sceneToWorld,
  type Scene as FancyScene,
  type SceneNode,
  type SceneTheme,
  type WorldPlacement,
} from "@particle-academy/fancy-3d";
import { createCard3D } from "./primitives";

/* ------------------------------------------------------------------ */
/* 2D perspective transform — maps a unit rectangle to a 4-point quad  */
/* via a 3x3 homography, packed into a CSS matrix3d for transform.     */
/* ------------------------------------------------------------------ */

type Mat3 = [number, number, number, number, number, number, number, number, number];

function adj3(m: Mat3): Mat3 {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

function multmm(a: Mat3, b: Mat3): Mat3 {
  const c: number[] = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let cij = 0;
      for (let k = 0; k < 3; k++) cij += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = cij;
    }
  }
  return c as Mat3;
}

function multmv(m: Mat3, v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function basisToPoints(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): Mat3 {
  const m: Mat3 = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const v = multmv(adj3(m), [x4, y4, 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

function quadToQuad(
  w: number, h: number,
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number,
): Mat3 {
  const s = basisToPoints(0, 0, w, 0, w, h, 0, h);
  const d = basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4);
  const t = multmm(d, adj3(s));
  const n = t[8];
  for (let i = 0; i < 9; i++) t[i] /= n;
  return t;
}

function matrix3dString(t: Mat3): string {
  return `matrix3d(${t[0]}, ${t[3]}, 0, ${t[6]}, ${t[1]}, ${t[4]}, 0, ${t[7]}, 0, 0, 1, 0, ${t[2]}, ${t[5]}, 0, ${t[8]})`;
}

/* ------------------------------------------------------------------ */
/* Stage context                                                       */
/* ------------------------------------------------------------------ */

interface StageContextValue {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The HTML <canvas> the renderer draws into — its rect anchors overlays. */
  canvas: HTMLCanvasElement;
  /** Subscribe to per-frame ticks (after matrices update, before render). */
  onFrame(cb: () => void): () => void;
  /** The DOM container that screen overlays mount into. */
  overlayRoot: HTMLDivElement;
  /**
   * The Stage's OrbitControls, so a child can drive the camera: move
   * `controls.target` to re-aim the orbit, tune damping or distance limits, or
   * disable it while the child animates. The Stage still calls `controls.update()`
   * (and so `camera.lookAt(controls.target)`) every frame, exactly as before.
   */
  controls: OrbitControls;
}

const StageContext = createContext<StageContextValue | null>(null);

/** Set a Stage background: a CSS colour, or `"transparent"`. */
function applyClearColor(renderer: THREE.WebGLRenderer, color: string) {
  if (color === "transparent") renderer.setClearColor(0x000000, 0);
  else renderer.setClearColor(new THREE.Color(color), 1);
}

export function useStage(): StageContextValue {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("useStage() must be called inside <Stage>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

export interface StageProps {
  children?: ReactNode;
  /** Initial camera radius. Defaults to 10. */
  cameraRadius?: number;
  /** Initial camera target. Defaults to (0, 1.5, 0). */
  cameraTarget?: [number, number, number];
  /** Initial horizontal angle (radians). Defaults to π/2. */
  cameraAlpha?: number;
  /** Initial vertical angle from +Y (radians). Defaults to π/2.4. */
  cameraBeta?: number;
  /** Background clear color (CSS colour), or `"transparent"` to show the page behind the canvas. Defaults to a near-black. */
  clearColor?: string;
  /** Disable the default lights / camera if you want to set your own. */
  bare?: boolean;
  /** Callback after the scene is created — set up custom cameras, lights, meshes. */
  onReady?: (scene: THREE.Scene, ctx: { camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer }) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Keyboard focus ring for the Stage canvas. The canvas is focusable (the camera
 * controls listen on it) and carries an inline `outline: none`, which beats any
 * stylesheet outline — so the ring is a box-shadow, a separate property. Inset,
 * because the Stage container clips overflow. Shipped as a scoped `<style>`
 * rather than Tailwind classes: consumers are not guaranteed to scan this
 * package's dist, and a class nobody generates is a ring nobody sees.
 */
const STAGE_FOCUS_CSS =
  "[data-fancy-3d-canvas]:focus-visible { box-shadow: inset 0 0 0 2px var(--fancy-focus, var(--color-blue-500, #3b82f6)); }" +
  " :where(.dark, [data-theme=\"dark\"]) [data-fancy-3d-canvas]:focus-visible { box-shadow: inset 0 0 0 2px var(--fancy-focus-dark, var(--color-blue-400, #60a5fa)); }";

export function Stage({
  children,
  cameraRadius = 10,
  cameraTarget = [0, 1.5, 0],
  cameraAlpha = Math.PI / 2,
  cameraBeta = Math.PI / 2.4,
  clearColor = "#06080f",
  bare = false,
  onReady,
  className,
  style,
}: StageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<StageContextValue | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !container || !overlay) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, stencil: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    applyClearColor(renderer, clearColor);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    const target = new THREE.Vector3(...cameraTarget);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    if (!bare) {
      // Spherical → cartesian (Babylon ArcRotateCamera alpha/beta convention).
      camera.position.set(
        target.x + cameraRadius * Math.sin(cameraBeta) * Math.cos(cameraAlpha),
        target.y + cameraRadius * Math.cos(cameraBeta),
        target.z + cameraRadius * Math.sin(cameraBeta) * Math.sin(cameraAlpha),
      );
      controls.minDistance = 1;
      controls.maxDistance = 80;
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't dip below the horizon

      const hemi = new THREE.HemisphereLight(0xb3c6ff, 0x1a1a2e, 0.9);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(-0.4, 1, 0.6).multiplyScalar(10);
      scene.add(dir);
    } else {
      camera.position.set(0, 0, cameraRadius);
    }
    camera.lookAt(target);
    controls.update();

    onReady?.(scene, { camera, renderer });

    const frameSubs = new Set<() => void>();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      scene.traverse((o) => {
        if (o.userData && o.userData.faceCamera) o.lookAt(camera.position);
      });
      frameSubs.forEach((cb) => cb());
      renderer.render(scene, camera);
    };

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener("resize", resize);
    loop();

    setStage({
      renderer,
      scene,
      camera,
      canvas,
      overlayRoot: overlay,
      controls,
      onFrame(cb) {
        frameSubs.add(cb);
        return () => frameSubs.delete(cb);
      },
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      setStage(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
      data-fancy-3d-stage=""
    >
      <style data-fancy-3d-stage-css="">{STAGE_FOCUS_CSS}</style>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", outline: "none" }}
        tabIndex={0}
        data-fancy-3d-canvas=""
      />
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} data-fancy-3d-overlay-root="" />
      {stage && <StageContext.Provider value={stage}>{children}</StageContext.Provider>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Monitor — interactive mount point on a 3D mesh                      */
/* ------------------------------------------------------------------ */

export interface MonitorProps {
  children?: ReactNode;
  /** World-space center of the screen. */
  position: [number, number, number];
  /** Mesh dimensions in world units. */
  width: number;
  height: number;
  /** Y-axis rotation in radians. */
  rotationY?: number;
  /** Bezel color. Defaults to a near-black frame. */
  bezel?: string;
  /** Bezel thickness in world units. Defaults to 0.06; 0 draws no bezel. */
  bezelThickness?: number;
  /**
   * Background color visible behind the React content, or `"transparent"`
   * when the content brings its own surface (a rounded card): the pane is then
   * not drawn, so nothing square shows around the content's corners.
   */
  background?: string;
  /** Design-time pixel width for the children. Defaults to `width * 360`. */
  pixelWidth?: number;
  /** Design-time pixel height for the children. Defaults to `height * 360`. */
  pixelHeight?: number;
  /** Optional name on the mesh. */
  name?: string;
}

export function Monitor({
  children,
  position,
  width,
  height,
  rotationY = 0,
  bezel = "#0b0f17",
  bezelThickness = 0.06,
  background = "#0b1220",
  pixelWidth,
  pixelHeight,
  name = "screen",
}: MonitorProps) {
  const stage = useStage();
  const meshRef = useRef<THREE.Mesh | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const innerSize = useRef({
    w: pixelWidth ?? Math.max(120, Math.round(width * 360)),
    h: pixelHeight ?? Math.max(80, Math.round(height * 360)),
  });

  // Build the bezel + projection-target pane.
  useEffect(() => {
    const { scene } = stage;
    const bezelMesh =
      bezelThickness > 0
        ? new THREE.Mesh(
            new THREE.BoxGeometry(width + bezelThickness * 2, height + bezelThickness * 2, bezelThickness),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(bezel), roughness: 0.5, metalness: 0.1 }),
          )
        : null;
    if (bezelMesh) {
      bezelMesh.position.set(position[0], position[1], position[2]);
      bezelMesh.rotation.y = rotationY;
      scene.add(bezelMesh);
    }

    const transparent = background === "transparent";
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(transparent ? "#000000" : background), side: THREE.DoubleSide, toneMapped: false }),
    );
    // A transparent Monitor still needs its pane as the projection target; it is just not drawn.
    pane.visible = !transparent;
    pane.rotation.y = rotationY;
    // Offset the pane forward of the bezel's +Z front so the HTML overlay lines
    // up with the visible face.
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).multiplyScalar(bezelThickness / 2 + 0.001);
    pane.position.set(position[0] + forward.x, position[1] + forward.y, position[2] + forward.z);
    pane.userData = { fancy3d: "screen", screenName: name };
    scene.add(pane);
    meshRef.current = pane;

    return () => {
      scene.remove(pane);
      pane.geometry.dispose();
      (pane.material as THREE.Material).dispose();
      if (bezelMesh) {
        scene.remove(bezelMesh);
        bezelMesh.geometry.dispose();
        (bezelMesh.material as THREE.Material).dispose();
      }
      meshRef.current = null;
    };
  }, [stage, name, width, height, bezel, bezelThickness, background, position, rotationY]);

  // Each frame: project the four corners and apply the matrix3d transform.
  useEffect(() => {
    const unsub = stage.onFrame(() => {
      const mesh = meshRef.current;
      const overlay = overlayRef.current;
      if (!mesh || !overlay) return;
      const { camera, canvas } = stage;
      mesh.updateWorldMatrix(true, false);

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const halfW = width / 2;
      const halfH = height / 2;
      // Mesh-local corners: top-left, top-right, bottom-right, bottom-left.
      const local = [
        new THREE.Vector3(-halfW, halfH, 0),
        new THREE.Vector3(halfW, halfH, 0),
        new THREE.Vector3(halfW, -halfH, 0),
        new THREE.Vector3(-halfW, -halfH, 0),
      ];
      const world = local.map((v) => v.applyMatrix4(mesh.matrixWorld));

      // Behind-camera cull (view-space z >= 0 means behind, since the camera
      // looks down -Z).
      const inFront = world.every((c) => c.clone().applyMatrix4(camera.matrixWorldInverse).z < -0.001);
      // Edge-on cull — hide when nearly perpendicular (projected quad collapses).
      const right = world[1].clone().sub(world[0]);
      const up = world[0].clone().sub(world[3]);
      const normal = new THREE.Vector3().crossVectors(up, right).normalize();
      const center = world[0].clone().add(world[2]).multiplyScalar(0.5);
      const toCam = camera.position.clone().sub(center).normalize();
      const facing = Math.abs(normal.dot(toCam));

      if (!inFront || facing <= 0.05) {
        if (overlay.style.display !== "none") overlay.style.display = "none";
        return;
      }

      const projected = world.map((c) => {
        const ndc = c.clone().project(camera);
        return { x: (ndc.x * 0.5 + 0.5) * cw, y: (-ndc.y * 0.5 + 0.5) * ch, z: ndc.z };
      });

      // Depth-sort overlays: closer-to-camera (smaller NDC z) stacks above.
      const avgZ = (projected[0].z + projected[1].z + projected[2].z + projected[3].z) / 4;
      const depth01 = Math.max(0, Math.min(1, avgZ * 0.5 + 0.5));
      const zStr = String(Math.round((1 - depth01) * 100000));
      if (overlay.style.zIndex !== zStr) overlay.style.zIndex = zStr;

      const w0 = innerSize.current.w;
      const h0 = innerSize.current.h;
      const t = quadToQuad(
        w0, h0,
        projected[0].x, projected[0].y,
        projected[1].x, projected[1].y,
        projected[2].x, projected[2].y,
        projected[3].x, projected[3].y,
      );

      if (overlay.style.display !== "block") overlay.style.display = "block";
      overlay.style.transform = matrix3dString(t);
    });
    return unsub;
  }, [stage, width, height]);

  // Mount the overlay into the stage's overlay root.
  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    if (el.parentElement !== stage.overlayRoot) stage.overlayRoot.appendChild(el);
    return () => {
      if (el.parentElement === stage.overlayRoot) stage.overlayRoot.removeChild(el);
    };
  }, [stage]);

  return (
    <div
      ref={overlayRef}
      data-fancy-3d-screen={name}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: innerSize.current.w,
        height: innerSize.current.h,
        transformOrigin: "0 0",
        pointerEvents: "auto",
        overflow: "hidden",
        background: background === "transparent" ? "transparent" : background,
        borderRadius: background === "transparent" ? 0 : 4,
        display: "none",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SceneView — a fancy-3d Scene, as the DOM renderer shows it          */
/* ------------------------------------------------------------------ */

export interface SceneViewProps {
  /** The scene: the same JSON the DOM `<Canvas>` renders. */
  scene: FancyScene;
  /** Card theme. Default `"auto"`: the page's mode, read as react-fancy (and so the DOM renderer) reads it. */
  theme?: SceneTheme | "auto";
  /**
   * The canvas behind the cards: `"theme"` (default) for the palette's canvas
   * colour, `"transparent"` to show the host's own background (so a page that
   * styles its DOM canvas shows the same surface here), or a CSS colour.
   */
  background?: "theme" | "transparent" | (string & {});
  /** Swing the camera around the scene, in radians; positive moves it to the viewer's right. */
  yaw?: number;
  /**
   * Mount a node as LIVE React on a `<Monitor>` instead of a painted card:
   * return its content (e.g. `domAdapter.render(node.widget, ...)`), or
   * nothing to paint it. Live content is sized to the node, so it lays out
   * exactly as it does in the DOM.
   */
  live?: (node: SceneNode) => ReactNode | null | undefined;
  /**
   * Draw the DOM `<Canvas showGrid gridStyle="dots">` dot grid behind the
   * cards, at the same size, colour and offset, so the surface matches too.
   */
  showGrid?: boolean;
  /** Grid spacing in scene px. Defaults to 20, as `<Canvas>`. */
  gridSize?: number;
  /** Rendered inside the Stage, so they can `useStage()` to add their own meshes or drive the camera. */
  children?: ReactNode;
  /** Card thickness in world units. Defaults to 0.01 (1 scene px), so its sides read as the card's border. */
  depth?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Render a fancy-3d `Scene` on three.js so it looks like the DOM renderer's
 * view of the same Scene: the core's palette, the core's unit scale
 * (`sceneToWorld`), and the core's framing (`frameScene`: level, front-on, at
 * the DOM `<Canvas fitOnMount>` zoom). Drag to orbit; the framing resets when
 * the scene's extent, the viewport or `yaw` changes. Mirrors fancy-3d-babylon's
 * `<SceneView>`.
 */
export function SceneView({ className, style, children, ...props }: SceneViewProps) {
  return (
    <Stage clearColor="transparent" className={className} style={style}>
      <SceneViewContent {...props} />
      {children}
    </Stage>
  );
}

function useSceneTheme(theme: SceneTheme | "auto", el: Element): SceneTheme {
  const [resolved, setResolved] = useState<SceneTheme>(() => resolveSceneTheme(theme, el));
  useEffect(() => {
    const update = () => setResolved(resolveSceneTheme(theme, el));
    update();
    if (theme !== "auto" || typeof MutationObserver === "undefined") return;
    // Follow the page when it switches mode, as the DOM renderer's cards do.
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class", "data-theme"] });
    return () => mo.disconnect();
  }, [theme, el]);
  return resolved;
}

type CardMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;

function disposeCard(mesh: CardMesh) {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    (m as THREE.MeshBasicMaterial).map?.dispose();
    m.dispose();
  }
}

function SceneViewContent({
  scene,
  theme = "auto",
  background = "theme",
  yaw = 0,
  live,
  depth = 0.01,
  showGrid = false,
  gridSize = 20,
}: Omit<SceneViewProps, "className" | "style" | "children">) {
  const stage = useStage();
  const resolved = useSceneTheme(theme, stage.canvas);
  const palette = SCENE_PALETTES[resolved];
  const placements = useMemo(() => sceneToWorld(scene), [scene]);
  const liveContent = new Map<string, ReactNode>();
  if (live) {
    for (const node of scene.nodes) {
      const content = live(node);
      if (content != null && content !== false) liveContent.set(node.id, content);
    }
  }

  // The surface: with a grid, the WebGL canvas clears transparent and the
  // Stage's own box carries the colour and the dots, as the DOM Canvas does.
  const surface = background === "theme" ? palette.canvas : background;
  useEffect(() => {
    const clear = showGrid ? "transparent" : surface;
    applyClearColor(stage.renderer, clear);
    const box = stage.canvas.parentElement;
    if (box) box.style.backgroundColor = showGrid && surface !== "transparent" ? surface : "";
  }, [stage, surface, showGrid]);

  // Frame the camera: level, front-on, at the DOM fit's scale. Keyed on the
  // scene's extent rather than its data, so editing a value does not throw
  // away the user's orbit.
  const extent = JSON.stringify(sceneBounds(scene));
  useEffect(() => {
    const { camera, controls, canvas } = stage;
    const frame = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      paintGrid(stage.canvas.parentElement, showGrid, scene, width, height, gridSize, palette.grid);
      const f = frameScene(scene, { width, height, fovY: THREE.MathUtils.degToRad(camera.fov) });
      // three is right-handed: alpha pi/2 puts the camera on +z, with +x on
      // the viewer's right. A positive yaw swings it to the viewer's right.
      const alpha = Math.PI / 2 - yaw;
      controls.maxPolarAngle = Math.PI / 2;
      controls.minDistance = Math.min(controls.minDistance, f.distance / 4);
      controls.maxDistance = Math.max(controls.maxDistance, f.distance * 4);
      controls.target.set(...f.target);
      camera.position.set(
        f.target[0] + f.distance * Math.sin(f.beta) * Math.cos(alpha),
        f.target[1] + f.distance * Math.cos(f.beta),
        f.target[2] + f.distance * Math.sin(f.beta) * Math.sin(alpha),
      );
      camera.lookAt(controls.target);
      controls.update();
    };
    frame();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(frame);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, extent, yaw, showGrid, gridSize, palette.grid]);

  // Painted cards: rebuilt only when a painted node, the theme or the depth changes.
  const painted = scene.nodes.filter((n) => !liveContent.has(n.id));
  const paintedKey = JSON.stringify([painted, resolved, depth]);
  useEffect(() => {
    const meshes: CardMesh[] = [];
    for (const node of painted) {
      const at = placements.find((p) => p.id === node.id);
      if (!at) continue;
      const mesh = createCard3D({
        scene: stage.scene,
        name: `scene-node-${node.id}`,
        width: at.width,
        height: at.height,
        depth,
        theme: resolved,
        edge: { type: "color", color: palette.cardBorder },
        front: { type: "widget", widget: node.widget, pixelWidth: at.pixelWidth, pixelHeight: at.pixelHeight },
      }) as CardMesh;
      // The card's face sits on the scene plane; its thickness goes behind it.
      mesh.position.set(at.x, at.y, at.z - depth / 2);
      mesh.userData = { ...mesh.userData, nodeId: node.id, kind: node.widget.kind };
      meshes.push(mesh);
    }
    return () => meshes.forEach(disposeCard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paintedKey, placements]);

  return (
    <>
      {[...liveContent.entries()].map(([id, content]) => {
        const at = placements.find((p) => p.id === id);
        return at ? <LiveNode key={id} id={id} at={at} content={content} /> : null;
      })}
    </>
  );
}

function LiveNode({ id, at, content }: { id: string; at: WorldPlacement; content: ReactNode }) {
  const position = useMemo<[number, number, number]>(() => [at.x, at.y, at.z], [at.x, at.y, at.z]);
  return (
    <Monitor
      name={id}
      position={position}
      width={at.width}
      height={at.height}
      pixelWidth={at.pixelWidth}
      pixelHeight={at.pixelHeight}
      bezelThickness={0}
      background="transparent"
    >
      {content}
    </Monitor>
  );
}

/**
 * The DOM Canvas's dot grid on a Stage's box: same dot, spacing x zoom, and the
 * same offset `fitOnMount` pans to, from the core's `fitZoom`.
 */
function paintGrid(box: HTMLElement | null, on: boolean, scene: FancyScene, width: number, height: number, gridSize: number, color: string) {
  if (!box) return;
  const b = sceneBounds(scene);
  if (!on || !b) {
    box.style.backgroundImage = "";
    box.style.backgroundSize = "";
    box.style.backgroundPosition = "";
    return;
  }
  const zoom = fitZoom(b, width, height);
  const contentW = b.maxX - b.minX + FIT_PADDING * 2;
  const contentH = b.maxY - b.minY + FIT_PADDING * 2;
  const panX = (width - contentW * zoom) / 2 - b.minX * zoom + FIT_PADDING * zoom;
  const panY = (height - contentH * zoom) / 2 - b.minY * zoom + FIT_PADDING * zoom;
  box.style.backgroundImage = `radial-gradient(circle, ${color} 1px, transparent 1px)`;
  box.style.backgroundSize = `${gridSize * zoom}px ${gridSize * zoom}px`;
  box.style.backgroundPosition = `${panX}px ${panY}px`;
}
