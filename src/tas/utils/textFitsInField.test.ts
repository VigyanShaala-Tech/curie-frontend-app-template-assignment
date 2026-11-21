import type { FieldLayoutMetrics } from './fieldLayout';
import { textFitsInField } from './textFitsInField';

const layout: FieldLayoutMetrics = {
  fieldId: 'f1',
  boxWidth: 80,
  boxHeight: 30,
  contentWidth: 76,
  contentHeight: 26,
  fontSize: 12,
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: 400,
  lineHeight: 1.3,
  padding: 2,
  color: '#111827',
};

describe('textFitsInField', () => {
  afterEach(() => {
    const probe = document.getElementById('tas-field-fit-probe');
    if (probe) { probe.remove(); }
  });

  it('returns true for empty text', () => {
    expect(textFitsInField('', layout)).toBe(true);
  });

  it('returns true when probe reports no overflow', () => {
    // First call creates the probe; then override scroll metrics.
    textFitsInField('x', layout);
    const probe = document.getElementById('tas-field-fit-probe') as HTMLDivElement;
    Object.defineProperty(probe, 'scrollHeight', { configurable: true, get: () => 20 });
    Object.defineProperty(probe, 'scrollWidth', { configurable: true, get: () => 40 });
    expect(textFitsInField('hello', layout)).toBe(true);
  });

  it('returns false when probe height overflows', () => {
    textFitsInField('x', layout);
    const probe = document.getElementById('tas-field-fit-probe') as HTMLDivElement;
    Object.defineProperty(probe, 'scrollHeight', { configurable: true, get: () => 100 });
    Object.defineProperty(probe, 'scrollWidth', { configurable: true, get: () => 40 });
    expect(textFitsInField('too much text', layout)).toBe(false);
  });

  it('returns false when probe width overflows', () => {
    textFitsInField('x', layout);
    const probe = document.getElementById('tas-field-fit-probe') as HTMLDivElement;
    Object.defineProperty(probe, 'scrollHeight', { configurable: true, get: () => 20 });
    Object.defineProperty(probe, 'scrollWidth', { configurable: true, get: () => 200 });
    expect(textFitsInField('yyyyyyyyyyyyyyyyyyyy', layout)).toBe(false);
  });
});
