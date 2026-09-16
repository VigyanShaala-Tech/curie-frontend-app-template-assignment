import { fitScaleToBox, fitScaleToWidth } from './fitScaleToWidth';

describe('fitScaleToWidth', () => {
  it('fits natural width into the wrapper minus padding, capped at 1', () => {
    expect(fitScaleToWidth(400, 794, 16)).toBeCloseTo((400 - 16) / 794);
    expect(fitScaleToWidth(900, 794, 16)).toBe(1);
  });

  it('returns 1 for invalid dimensions', () => {
    expect(fitScaleToWidth(0, 794, 16)).toBe(1);
    expect(fitScaleToWidth(400, 0, 16)).toBe(1);
  });
});

describe('fitScaleToBox', () => {
  it('uses the tighter of width and height so the worksheet fits the pane', () => {
    const widePane = fitScaleToBox(600, 200, 794, 1123, 16);
    expect(widePane).toBeCloseTo((200 - 16) / 1123);
    expect(fitScaleToBox(900, 2000, 794, 1123, 16)).toBe(1);
  });

  it('fits a 390px mobile review pane without clipping Field 8 height', () => {
    const scale = fitScaleToBox(390, 461, 1080, 1400, 48);
    expect(1400 * scale).toBeLessThanOrEqual(461);
    expect(1080 * scale).toBeLessThanOrEqual(390);
  });
});
