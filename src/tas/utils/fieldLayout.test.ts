import type { FormField, FieldPosition } from '../types';
import { calculateFontSize } from './positioning';
import {
  FIELD_TEXT_FONT_FAMILY,
  FIELD_TEXT_FONT_WEIGHT,
  FIELD_TEXT_LINE_HEIGHT,
  FIELD_TEXT_PADDING_PX,
  resolveFieldFontSize,
  resolveFieldLayout,
} from './fieldLayout';

describe('resolveFieldFontSize', () => {
  const field = (fontSize?: number): FormField => ({
    id: 'f1',
    label: 'Test',
    type: 'textarea',
    required: false,
    fontSize,
  });

  it('uses field.fontSize when provided', () => {
    expect(resolveFieldFontSize(field(14), 100)).toBe(14);
  });

  it('falls back to calculateFontSize(height)', () => {
    expect(resolveFieldFontSize(field(), 100)).toBe(calculateFontSize(100));
    expect(resolveFieldFontSize(field(), 10)).toBe(calculateFontSize(10));
  });
});

describe('resolveFieldLayout', () => {
  const field: FormField = {
    id: 'strengths',
    label: 'Strengths',
    type: 'textarea',
    required: true,
    fontSize: 12,
  };
  const position: FieldPosition = {
    x: 10, y: 20, width: 50, height: 10,
  };

  it('resolves box and content sizes from % positions', () => {
    const layout = resolveFieldLayout(field, position, 800, 1000);
    expect(layout.boxWidth).toBe(400);
    expect(layout.boxHeight).toBe(100);
    expect(layout.contentWidth).toBe(400 - FIELD_TEXT_PADDING_PX * 2);
    expect(layout.contentHeight).toBe(100 - FIELD_TEXT_PADDING_PX * 2);
    expect(layout.fontSize).toBe(12);
    expect(layout.fontFamily).toBe(FIELD_TEXT_FONT_FAMILY);
    expect(layout.fontWeight).toBe(FIELD_TEXT_FONT_WEIGHT);
    expect(layout.lineHeight).toBe(FIELD_TEXT_LINE_HEIGHT);
    expect(layout.padding).toBe(FIELD_TEXT_PADDING_PX);
  });
});
