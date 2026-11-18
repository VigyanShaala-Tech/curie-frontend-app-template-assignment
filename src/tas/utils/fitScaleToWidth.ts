/**
 * Fit a natural-width canvas into a container width, capped at 1.
 * Extra page height is not scaled away; callers use it as scroll height.
 */
export function fitScaleToWidth(
  clientWidth: number,
  naturalW: number,
  padding: number,
): number {
  if (clientWidth <= 0 || naturalW <= 0) { return 1; }
  return Math.min(1, (clientWidth - padding) / naturalW);
}

/** Fit a natural-size canvas into a pane without clipping, capped at 1. */
export function fitScaleToBox(
  clientWidth: number,
  clientHeight: number,
  naturalW: number,
  naturalH: number,
  padding: number,
): number {
  const scaleW = fitScaleToWidth(clientWidth, naturalW, padding);
  if (clientHeight <= 0 || naturalH <= 0) { return scaleW; }
  const scaleH = Math.min(1, (clientHeight - padding) / naturalH);
  return Math.min(scaleW, scaleH);
}

/** Width-fit scale plus the on-screen box. Height grows with the image. */
export function fittedCanvasBox(
  containerWidth: number,
  naturalW: number,
  naturalH: number,
  padding = 0,
): { scale: number; width: number; height: number } {
  const scale = fitScaleToWidth(containerWidth, naturalW, padding);
  return {
    scale,
    width: Math.max(0, naturalW * scale),
    height: Math.max(0, naturalH * scale),
  };
}
