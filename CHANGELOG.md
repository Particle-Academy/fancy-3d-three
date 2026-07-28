# Changelog

## [Unreleased]

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
