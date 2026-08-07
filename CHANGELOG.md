# Changelog

## [Unreleased]

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
