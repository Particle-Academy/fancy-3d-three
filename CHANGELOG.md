# Changelog

## [Unreleased]

## [0.5.0] — 2026-11-28

### Added

- **Full screen for `<Stage>` and `<SceneView>`, with the whole control UX
  inside.** A full-screen button shows by default (bottom right;
  `fullscreenButton={false}` hides it, a corner name moves it). The Stage ROOT
  goes full screen, not the bare canvas, so the Monitors and everything in the
  new **`overlay`** slot come along: breadcrumbs, fact cards, toolbars. The
  overlay is drawn inside the root and passes pointer events to the canvas
  except on its children. Controlled with `fullscreen` / `defaultFullscreen` /
  `onFullscreenChange(on, { source })`, `fullscreenLabels`; a `ref`
  (`StageHandle`) gives `setFullscreen`, `toggleFullscreen`, `getFullscreen`
  and `root`; children and the overlay read the controller with the core's
  `useFullscreenContext()`. It is the core's one implementation
  (`@particle-academy/fancy-3d/fullscreen`): the Fullscreen API, else a fixed
  full-viewport mode; Esc and the button exit; the renderer size and camera
  aspect follow; the canvas keeps keyboard focus. A Stage inside a viewer that
  owns full screen (fancy-graph's `GraphView3D`) defers to it. Mirrors
  fancy-3d-babylon. **Nothing to do** unless the new button overlaps something of
  yours in the bottom-right corner: move it or pass `fullscreenButton={false}`.

### Changed

- **Requires `@particle-academy/fancy-3d` `>=0.7.0`** (peer, was `>=0.6.0`),
  which adds the `./fullscreen` subpath this uses.

## [0.4.0] — 2026-11-28

### Added

- **`<SceneView scene={scene} />` renders a fancy-3d Scene on three.js the way
  the DOM renderer shows it.** Same theme, same scale, same spacing, and a level,
  front-on camera at the DOM `<Canvas fitOnMount>` zoom, all from the core's one
  definition (`sceneToWorld`, `frameScene`, `SCENE_PALETTES`). Options: `theme`,
  `background` (`"theme"` | `"transparent"` | a colour), `showGrid` / `gridSize`
  (the DOM Canvas dot grid), `yaw`, `live(node)` to mount a node as live React on
  a `<Monitor>`, `depth` (0 by default: flat cards, as the DOM draws them;
  a thickness extrudes them), and children rendered inside the Stage. Mirrors
  fancy-3d-babylon's `<SceneView>`. Additive; nothing to do.
- **`<Stage clearColor="transparent">`** shows the page behind the canvas.
- **`<Monitor background="transparent">` and `bezelThickness={0}`** draw no pane
  and no bezel, for live content that brings its own (rounded) card surface.
- Widget surfaces, `createCard3D` and `createWidgetTexture` take an optional
  `theme`.

### Changed

- **BREAKING (visual): painted widgets follow the page theme, in the DOM card's
  colours and proportions.** The painter was a private copy that always drew a
  dark (`#0f172a`) card with text about twice the DOM card's size, so a scene the
  DOM rendered light came out dark here, with a white live card in the middle of
  it. `paintWidget` is now the core's (`@particle-academy/fancy-3d`), shared with
  fancy-3d-babylon: light on a light page, dark under `.dark` / `[data-theme="dark"]`, at
  the DOM card's metrics. **To keep the old look, pass `theme: "dark"`** on the
  widget surface or to `createCard3D`; otherwise do nothing.
- **BREAKING (visual): one unit scale and one default node size, the core's.**
  Widget textures auto-size at `PX_PER_UNIT` (100) scene px per world unit
  (was 120), `createThreeAdapter` planes use
  `1 / PX_PER_UNIT` (was `1 / 180`), `placeOnGrid` defaults to the same scale
  (was `1 / 120`), and a node with no `size` is 240 x 150 everywhere (the layouts
  and `sceneBounds` assumed 200 x 120 while the core and DOM used 240 x 150).
  If you placed nodes with these defaults and tuned a camera around them, pass
  the old `scale` to `placeOnGrid`, or move the camera; the new numbers are the
  ones the DOM view and `<SceneView>` agree on.
- `createCard3D`'s default edge is the theme's card edge, not a near-black.
- **BREAKING: needs `@particle-academy/fancy-3d` 0.6.0 or later.** The shared
  `paintWidget`, palettes, `sceneToWorld` and `frameScene` are imported from it.
  Upgrade the core with this package; nothing else to do. The peer floor rises
  from `>=0.4 <2.0` to `>=0.6.0 <2.0`, and the suite is built and tested against
  the published fancy-3d 0.6.0.

### Fixed

- **`<SceneView>` cards are flat by default, so no dark line runs down an
  off-centre card's inner edge.** Cards were thin extruded boxes, and in the
  perspective view the camera saw the inner side face of every off-centre card:
  a lit, blue-grey 1px line outside its border that the DOM card does not have.
  A painted node is now a flat panel on the scene plane unless `depth > 0` is
  passed. Nothing to do.

- A node with no `size` gets the same default box as in the core and the DOM
  renderer, so `sceneBounds` and the layouts agree with them.

## 0.3.0 — 2026-11-26

### Added

- **`@particle-academy/fancy-3d-three/three` re-exports three.js.** Packages
  built on this adapter (fancy-graph's 3D view first) import three's classes
  from here (custom `RawShaderMaterial`s, instanced geometry, lines, points)
  instead of declaring `three` themselves, so they always share the Stage's one
  copy of three. It is a re-export, not a bundle: `three` stays a peer, and
  every class is identical to the one `three` exports. Nothing to do.

- **`useStage()` now exposes `controls`, the Stage's `OrbitControls`.** A child
  can drive the camera through it: move `controls.target` to re-aim the orbit,
  tune damping or distance limits, or set `enabled = false` while it animates.
  Additive: existing Stages render exactly as before, and the Stage still calls
  `controls.update()` every frame, so `camera.lookAt(controls.target)` still
  runs each frame for code that reads the target that way. Nothing to do;
  if you intercept `camera.lookAt` to find the orbit target, you can read
  `useStage().controls.target` instead. (CC-fancy-0062.)

### Changed

- **CI: the lab-certificate gate verifies against the lab's rotated key list.**
  The lab's first signing key is retired: certificates it already issued still
  verify, and nothing new it signs ever can. Consumers do nothing.

- Rebranded the display name to Fancy Dev Kit (README and package description). Package names, the npm scope, URLs and the `fancy-ui` MCP id are unchanged.
- **Docs:** `AGENTS.md` added: the guide to using this package (install, its entries on the Fancy MCP catalog server, API essentials, traps), and it ships in the package. `CONTRIBUTING.md` added for the contributor notes, with `CLAUDE.md` as a symlink to it. The README points to the MCP server and to `AGENTS.md`. No code changed; nothing to do.
- CI: re-pin org third-party allowlist to 2614224

## 0.2.1 — 2026-11-13

### Changed

- **Releases need a lab-run certificate.** `publish.yml` gains a read-only
  `lab-certificate` job that every publishing job needs: a tag is published only
  when the fancy-labs lab has certified that exact version and commit. Consumers
  do nothing; this changes how releases are cut, not what the package does.

### Fixed

- **The `<Stage>` canvas now shows a keyboard focus ring.** It was focusable (`tabIndex=0`, the camera controls listen on it) but carried an inline `outline: none`, so a keyboard user tabbing onto it saw nothing. `<Stage>` now renders a scoped `<style>` giving the canvas, marked `data-fancy-3d-canvas`, an inset `:focus-visible` box-shadow ring in the kit focus token (`--fancy-focus`, dark `--fancy-focus-dark`, falling back to Tailwind blue-500/400). It is a box-shadow because the inline outline beats any stylesheet outline, and a `<style>` rather than Tailwind classes because a consumer's Tailwind is not guaranteed to scan this package. Nothing to do; set `--fancy-focus` to restyle it.

- **`CHANGELOG.md` is now in the published tarball.** `files` did not whitelist it, so npm never shipped it — and this package puts breaking changes in MINOR releases and tells you in the README to read the entry before taking one. The instruction existed for the author, who has the file, and not for the consumer, who is the only one being instructed. Nothing for you to do; the file simply arrives from this release on.

### Security

- Update Vitest to 4.1.12 and patch the transitive undici development dependency for security fixes; dev toolchain only, nothing to do.

- `source-map-js` is pinned forward to `^1.2.2` via `overrides`. Versions up to
  1.2.1 allow an event-loop denial of service through indexed source-map section
  offsets, and it arrives here transitively through the build toolchain.
  **Nothing for a consumer to do, and no runtime change**: an npm package does
  not ship a lockfile, so this governs builds OF this repo, not anything
  installed FROM it. Recorded rather than left silent because the override it
  sits beside — `shell-quote` `^1.9.0`, added for an earlier advisory — was
  carried with no note of why, and had drifted back inside the vulnerable range
  before anyone looked.
- **Dev toolchain only — no runtime change, nothing for consumers to do.** The
  lockfile now resolves `vite` 8.3.5 (was 8.2.2), whose bundled
  `launch-editor` fixes GHSA-587h-7wmj-h5pm (HIGH, `fs.existsSync()` check
  bypassable on Windows), GHSA-698v-4r3x-3vcv (`escapeCmdArgs()` omits `%`
  escaping on Windows) and GHSA-r825-w8mm-5pxw (editor CLI flag
  misinterpretation). `vite` is only reached through the test/dev toolchain
  and the published package does not ship our lockfile, so the exposure was
  this repo's own dev server.

## 0.2.0 — 2026-08-07

### Changed

- **BREAKING — Node 22 is no longer supported.** `engines.node` moves from `>=22` to `>=22`.

  **What you must do:** on Node 22 or newer, nothing. Note npm only *warns* on an `engines` mismatch while **pnpm fails the install**, so this surfaces differently depending on your package manager. Node 18 is end-of-life and 20 is maintenance-only.

- **BREAKING — React 18 is no longer supported.** `peerDependencies.react` / `react-dom` are now `^19.0.0`.

  **What you must do:** on React 19, nothing. On React 18, stay on the previous release, or upgrade your app to 19 first.

  React 18 support was a claim nothing tested — every build and test in this package ran against 19, so the 18 half of the old range was never executed. An untested compatibility claim is worse than an absent one, because it reads as support.

### Why

These are the kit 0.5 platform floors, applied across every package at once so a consumer never has to resolve a mix. **No API changed, nothing was removed, nothing was renamed** — only what the package requires.

## 0.1.1 — 2026-06-12

- Maintenance only (4 internal commits).

### Changed

- Widened the `@particle-academy/fancy-3d` requirement from `^0.4.0` to `>=0.4 <2.0`, so a
  sibling minor release is an upgrade and not a resolver conflict. **No action
  needed** — widening a range only adds candidates; the version you have today
  still resolves.

  A caret on a `0.x` range locks the MINOR, so this pinned a sibling at
  whatever it happened to be on the day it was written, and each sibling
  release then read as a conflict to the resolver rather than an upgrade.
  Nothing here was using an API the newer minors removed — the range was the
  whole problem.

## 0.1.0

Initial release — three.js engine adapter for `@particle-academy/fancy-3d`, the
three.js sibling of `@particle-academy/fancy-3d-babylon` (same API surface, so a
scene authored for one renders recognizably on the other).

- **Adapter** — `createThreeAdapter` renders any `WidgetSpec` to a `THREE.Object3D`
  (CanvasTexture plane) via the shared painters.
- **Primitives** — `createPanel`, `createBillboard`, `createBuilding`,
  `createPillar`, `createCylinder`, `createCurvedPanel`, `createSphere`,
  `createDisc`, `createCard3D`, `createSign`, `createMonitor`, `createDecal`,
  `createWidgetTexture`.
- **Layouts** — `placeOnGrid`, `placeOnWall`, `placeOnArc`, `placeOnCylinder`,
  `placeOnPath`, `placeOnSphere`, `sceneBounds`.
- **`./engine`** — `threeEngine`, a `CanvasEngine` for `<Canvas engine={threeEngine} />`.
- **`./react`** — `<Stage>` + `<Monitor>`: an OrbitControls render loop and a
  live, interactive React DOM overlay projected onto a 3D screen via a CSS
  `matrix3d` homography.

Builds ESM + CJS + DTS. `@types/three` is a dev-only dependency (three ships no
declarations); consumers don't need it at runtime.
