/**
 * `@particle-academy/fancy-3d-three/three` — three.js itself, re-exported.
 *
 * Packages built on this adapter (fancy-graph's 3D view, for one) import
 * three's classes from here instead of declaring `three` themselves: custom
 * RawShaderMaterials, instanced geometry, lines and points for layers that
 * draw into a `<Stage>`. It is the consumer's one copy of three (a peer of
 * this package, never bundled), so a Stage and everything drawn into it always
 * share the same classes and the same renderer.
 */
export * from "three";
