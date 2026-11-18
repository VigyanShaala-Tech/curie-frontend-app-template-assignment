import {
  getActiveFields,
  hasMissingRequiredFields,
  isFieldEmpty,
} from './activeFields';
import type { FormField, Template } from '../types';

const field = (partial: Partial<FormField> & Pick<FormField, 'id' | 'label'>): FormField => ({
  type: 'textarea',
  required: false,
  ...partial,
});

const makeTemplate = (fields: FormField[]): Template => ({
  id: 't1',
  template_type_id: 'type',
  name: 'Test',
  description: '',
  image_url: '',
  image_width: 794,
  image_height: 1123,
  thumbnail_url: '',
  fields,
  field_positions: Object.fromEntries(
    fields.map((item, index) => [item.id, {
      x: 10,
      y: 10 + index * 10,
      width: 80,
      height: 8,
    }]),
  ),
  is_public: true,
  is_active: true,
  created_by: '',
  created_at: '',
  updated_at: '',
});

describe('activeFields', () => {
  it('treats blank and whitespace-only values as empty', () => {
    expect(isFieldEmpty({}, 'goal')).toBe(true);
    expect(isFieldEmpty({ goal: '   ' }, 'goal')).toBe(true);
    expect(isFieldEmpty({ goal: 'ok' }, 'goal')).toBe(false);
  });

  it('only considers positioned fields active', () => {
    const template = makeTemplate([
      field({ id: 'goal', label: 'Goal', required: true }),
    ]);
    template.fields.push(field({ id: 'hidden', label: 'Hidden', required: true }));
    expect(getActiveFields(template).map((item) => item.id)).toEqual(['goal']);
  });

  it('reports missing required fields and ignores optional empties', () => {
    const template = makeTemplate([
      field({ id: 'goal', label: 'Goal', required: true }),
      field({ id: 'notes', label: 'Notes', required: false }),
    ]);
    expect(hasMissingRequiredFields(template, {})).toBe(true);
    expect(hasMissingRequiredFields(template, { goal: 'Done' })).toBe(false);
    expect(hasMissingRequiredFields(template, { goal: 'Done', notes: '' })).toBe(false);
  });
});
