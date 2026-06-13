# @particle-academy/fancy-3d-three

[![Fancified](art/fancified.svg)](https://particle.academy)

three.js adapter for [`@particle-academy/fancy-3d`](https://www.npmjs.com/package/@particle-academy/fancy-3d).

`fancy-3d` ships an engine-agnostic core (Scene types + a `CanvasEngine` interface + a DOM/CSS-3D renderer). This package adds a full WebGL renderer on top with **three.js**, plus the React components that mount onto a three `Scene`: `Stage`, `Monitor`, primitives (`Card3D`, `Monitor`, `Panel`, `Sign`, …), and layout helpers (`placeOnGrid`, `placeOnArc`, `placeOnWall`, `placeOnSphere`, `placeOnPath`).

It's the three.js sibling of `@particle-academy/fancy-3d-babylon` — same API surface (`createThreeAdapter`/`createBabylonAdapter`, the same primitive + layout functions, the same `<Stage>`/`<Monitor>`), so a scene authored for one renders recognizably on the other. They implement the same `CanvasEngine` interface from the core and don't depend on each other.

## Install

```bash
npm install @particle-academy/fancy-3d @particle-academy/fancy-3d-three three
```

You install three packages together: the core (types + `<Canvas>`), this adapter, and three.js itself. None pull in the others, so the core stays lightweight for non-three consumers.

## Usage

### Mount the three engine on `<Canvas>`

```tsx
import { Canvas } from "@particle-academy/fancy-3d";
import { threeEngine } from "@particle-academy/fancy-3d-three/engine";

<Canvas engine={threeEngine} style={{ height: 480 }} />;
```

`EngineHandle.root` is the live `THREE.Scene` — add meshes to it alongside the 2D node graph.

### Declarative `<Stage>` + `<Monitor>` (mount mode)

Render **real, interactive React** onto a 3D display — full text crispness, accessibility, and event handling (not a rasterized texture):

```tsx
import { Stage, Monitor } from "@particle-academy/fancy-3d-three/react";
import { Card, Button } from "@particle-academy/react-fancy";

<Stage style={{ height: 520 }}>
  <Monitor position={[0, 1.6, 0]} width={4} height={2.4} bezel="#0b0f17">
    <Card>
      <Card.Header>Live dashboard</Card.Header>
      <Card.Body>
        <Button color="violet">Real, clickable React on a 3D screen</Button>
      </Card.Body>
    </Card>
  </Monitor>
</Stage>;
```

`<Stage>` owns the renderer + `OrbitControls` camera + render loop. `<Monitor>` builds a bezel mesh and projects its corners to screen space each frame, mapping a DOM overlay onto the 3D quad via a CSS `matrix3d` homography.

### Painted scenes (texture mode)

Render a JSON `Scene` to textured planes:

```tsx
import { renderScene, type Scene } from "@particle-academy/fancy-3d";
import { createThreeAdapter, placeOnArc, sceneBounds } from "@particle-academy/fancy-3d-three";
import * as THREE from "three";

const scene3D = new THREE.Scene();
const adapter = createThreeAdapter({ scene3D, sizeFor: () => ({ w: 240, h: 150 }) });
const bounds = sceneBounds(scene);
renderScene(scene, adapter, (node) => ({ nodeId: node.id, selected: false })).forEach(({ node, rendered }) => {
  placeOnArc(node, rendered, bounds, { radius: 6 });
});
```

### Primitives

Build content-bearing meshes directly. Each takes a `SurfaceContent` (`{ type: "color" }`, `{ type: "paint" }`, or `{ type: "widget" }`) and returns a `THREE.Mesh` (or a `Group` for composites). Pass `scene` to also add it.

```ts
import { createCard3D, createMonitor, createSign, createCurvedPanel } from "@particle-academy/fancy-3d-three";

const card = createCard3D({ scene, width: 3, height: 2, front: { type: "widget", widget: kpi } });
const { root } = createMonitor({ scene, width: 4, height: 2.5, screen: { type: "paint", paint } });
```

Available: `createPanel`, `createBillboard`, `createBuilding`, `createPillar`, `createCylinder`, `createCurvedPanel`, `createSphere`, `createDisc`, `createCard3D`, `createSign`, `createMonitor`, `createDecal`, `createWidgetTexture`.

### Layouts

Map 2D scene positions onto 3D arrangements: `placeOnGrid`, `placeOnWall`, `placeOnArc` (alias `placeOnCylinder`), `placeOnPath`, `placeOnSphere`. Each mutates `obj.position` / `obj.rotation` in place; pair with `sceneBounds(scene)`.

## Notes vs. the Babylon adapter

- `scene` is **optional** on primitives (three meshes exist independent of a scene); pass it to auto-add, matching Babylon's behavior.
- `createBillboard({ faceCamera: true })` flags the mesh (`userData.faceCamera`); `<Stage>` honors it each frame. Outside a Stage, call `mesh.lookAt(camera.position)` in your own loop.
- Panels accept `doubleSided?: boolean` instead of Babylon's `sideOrientation` enum.
- `@types/three` is a dev-only dependency (three ships no declarations); consumers don't need it at runtime.

## License

MIT

---

## ⭐ Star Fancy UI

If this package is useful to you, a quick ⭐ on the repo really helps us build a better kit. Thank you!
