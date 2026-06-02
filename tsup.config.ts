import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/react.tsx", "src/engine.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // `three` and its examples/jsm subpaths (OrbitControls, DecalGeometry) stay
  // external — the host installs three once and the adapter binds to it.
  external: [
    "react",
    "react-dom",
    /^three(\/.*)?$/,
    "@particle-academy/fancy-3d",
    "@particle-academy/react-fancy",
  ],
  treeshake: true,
});
