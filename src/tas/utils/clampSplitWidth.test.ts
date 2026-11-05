import {
  clampSplitWidth,
  DEFAULT_LIST_WIDTH,
  MIN_FORM_WIDTH,
  MIN_LIST_WIDTH,
  NARROW_PRIMARY_SHARE,
  SPLITTER_WIDTH,
} from './clampSplitWidth';

describe('clampSplitWidth', () => {
  const wideContainer = 1200;

  it('keeps a width that is inside the range', () => {
    expect(clampSplitWidth(DEFAULT_LIST_WIDTH, wideContainer)).toBe(DEFAULT_LIST_WIDTH);
  });

  it('raises a width below the list minimum', () => {
    expect(clampSplitWidth(100, wideContainer)).toBe(MIN_LIST_WIDTH);
  });

  it('caps a width that would shrink the form below its minimum', () => {
    const maxList = wideContainer - SPLITTER_WIDTH - MIN_FORM_WIDTH;
    expect(clampSplitWidth(900, wideContainer)).toBe(maxList);
  });

  it('gives the list a smaller share when both minimums cannot fit', () => {
    const containerWidth = 400;
    const available = containerWidth - SPLITTER_WIDTH;
    const listWidth = clampSplitWidth(DEFAULT_LIST_WIDTH, containerWidth);

    expect(available).toBeLessThan(MIN_LIST_WIDTH + MIN_FORM_WIDTH);
    expect(listWidth).toBe(Math.round(available * NARROW_PRIMARY_SHARE));
    expect(listWidth).toBeLessThan(available / 2);
    expect(listWidth + (available - listWidth)).toBe(available);
  });
});
