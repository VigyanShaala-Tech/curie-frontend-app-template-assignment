/**
 * Width limits for the Rubrics page vertical splitter.
 * The list pane is primary; the edit form is secondary and keeps the remainder.
 */

export const DEFAULT_LIST_WIDTH = 380;
export const MIN_LIST_WIDTH = 260;
export const MIN_FORM_WIDTH = 340;
export const SPLITTER_WIDTH = 10;

/** Share of free space given to the list when both minimums cannot fit. */
export const NARROW_PRIMARY_SHARE = 0.35;

export interface SplitWidthOptions {
  minPrimary?: number;
  minSecondary?: number;
  splitterWidth?: number;
}

/**
 * Clamp the primary pane width inside a horizontal split.
 *
 * `containerWidth` includes the splitter. The splitter is removed first, then
 * the proposed width is kept between `minPrimary` and the space left after
 * `minSecondary`. When the container is too narrow for both minimums, the
 * primary pane gets a smaller share and the secondary pane gets the rest.
 */
export function clampSplitWidth(
  proposedWidth: number,
  containerWidth: number,
  options: SplitWidthOptions = {},
): number {
  const minPrimary = options.minPrimary ?? MIN_LIST_WIDTH;
  const minSecondary = options.minSecondary ?? MIN_FORM_WIDTH;
  const splitterWidth = options.splitterWidth ?? SPLITTER_WIDTH;
  const available = Math.max(0, containerWidth - splitterWidth);

  if (available === 0) {
    return 0;
  }

  if (available < minPrimary + minSecondary) {
    return Math.min(available, Math.max(0, Math.round(available * NARROW_PRIMARY_SHARE)));
  }

  const maxPrimary = available - minSecondary;
  return Math.min(Math.max(proposedWidth, minPrimary), maxPrimary);
}
