import type { WidgetSpec } from "@particle-academy/fancy-3d";
import { paintWidget as paintSceneWidget, type PaintWidgetOptions } from "@particle-academy/fancy-3d";

/** Texture pixels per scene px: painted cards stay sharp when the camera zooms in. */
export const TEX_SCALE = 2;

/**
 * Paint a widget card onto a 2D context. The painter is the core's
 * (`@particle-academy/fancy-3d`'s `paintWidget`), so this adapter, the Babylon.js
 * one and the DOM renderer draw the same card: the same palette (light or dark,
 * following the page as react-fancy does unless `opts.theme` says otherwise) and
 * the DOM card's metrics. The positional `selected` is kept for existing callers.
 */
export function paintWidget(
  ctx: CanvasRenderingContext2D,
  spec: WidgetSpec,
  w: number,
  h: number,
  selected = false,
  opts: Omit<PaintWidgetOptions, "selected"> = {},
): void {
  paintSceneWidget(ctx, spec, w, h, { ...opts, selected });
}
