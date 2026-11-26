import * as THREE from "three";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import tsupConfig from "../tsup.config";
import * as viaKit from "../src/three";

/**
 * `@particle-academy/fancy-3d-three/three` hands packages built on this adapter
 * the SAME three.js the Stage renders with, so they need no `three` dependency
 * of their own and can never load a second copy. It is a re-export, not a copy:
 * every class must be identical to the one `three` itself exports.
 */
describe("the ./three subpath", () => {
  it("re-exports three.js itself, class for class", () => {
    for (const name of ["RawShaderMaterial", "InstancedBufferGeometry", "InstancedInterleavedBuffer", "InterleavedBufferAttribute", "LineSegments", "Points", "Group", "Vector3", "PerspectiveCamera", "Scene"] as const) {
      expect(viaKit[name], name).toBe(THREE[name]);
    }
    expect(viaKit.GLSL3).toBe(THREE.GLSL3);
    expect(viaKit.CustomBlending).toBe(THREE.CustomBlending);
    expect(Object.keys(viaKit).sort()).toEqual(Object.keys(THREE).sort());
  });

  it("is in the export map and built by tsup, ESM and CJS with types", () => {
    const entry = (pkg.exports as Record<string, { import: { types: string; default: string }; require: { types: string; default: string } }>)["./three"];
    expect(entry).toEqual({
      import: { types: "./dist/three.d.ts", default: "./dist/three.js" },
      require: { types: "./dist/three.d.cts", default: "./dist/three.cjs" },
    });
    const config = (Array.isArray(tsupConfig) ? tsupConfig[0] : tsupConfig) as { entry: string[]; external: (string | RegExp)[] };
    expect(config.entry).toContain("src/three.ts");
    // three stays external: the subpath must hand out the consumer's one copy, never a bundled second one.
    expect(config.external.some((e) => (e instanceof RegExp ? e.test("three") : e === "three"))).toBe(true);
  });

  it("adds no dependency: three is still only a peer", () => {
    expect((pkg as { dependencies?: Record<string, string> }).dependencies ?? {}).toEqual({});
    expect(pkg.peerDependencies.three).toBeDefined();
  });
});
