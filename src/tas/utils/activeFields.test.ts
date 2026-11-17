import { areRequiredFieldsComplete, getActiveFields, isFieldEmpty } from './activeFields';
import type { Template } from '../types';

const template: Template = {
  id: '1',
  template_type_id: '1',
  name: 'Personal SWOT',
  description: '',
  image_url: '',
  image_width: 794,
  image_height: 1123,
  thumbnail_url: '',
  fields: [
    {
      id: 'goal', label: 'Goal', type: 'textarea', required: true,
    },
    {
      id: 'strength', label: 'Strength', type: 'textarea', required: true,
    },
    {
      id: 'note', label: 'Note', type: 'textarea', required: false,
    },
  ],
  field_positions: {
    goal: {
      x: 10, y: 10, width: 80, height: 10,
    },
    strength: {
      x: 10, y: 40, width: 80, height: 10,
    },
    note: {
      x: 10, y: 70, width: 80, height: 10,
    },
  },
  is_public: true,
  is_active: true,
  created_by: '',
  created_at: '',
  updated_at: '',
};

describe('activeFields', () => {
  it('lists only fields with positions', () => {
    expect(getActiveFields(template).map((field) => field.id)).toEqual([
      'goal', 'strength', 'note',
    ]);
  });

  it('treats blank and whitespace as empty', () => {
    expect(isFieldEmpty({}, 'goal')).toBe(true);
    expect(isFieldEmpty({ goal: '   ' }, 'goal')).toBe(true);
    expect(isFieldEmpty({ goal: 'ok' }, 'goal')).toBe(false);
  });

  it('requires all mandatory active fields, ignoring optional empties', () => {
    expect(areRequiredFieldsComplete(template, {
      goal: 'A',
      strength: 'B',
    })).toBe(true);

    expect(areRequiredFieldsComplete(template, {
      goal: 'A',
      strength: '',
      note: 'optional filled',
    })).toBe(false);

    expect(areRequiredFieldsComplete(template, {
      goal: 'A',
      strength: 'B',
      note: '',
    })).toBe(true);
  });
});
