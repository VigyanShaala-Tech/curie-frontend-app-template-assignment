/**
 * Fit a natural-width canvas into a wrapper width, capped at 1.
 * Used for mobile TransformWrapper initialScale.
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
