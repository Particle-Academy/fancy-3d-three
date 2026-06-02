# Changelog

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
