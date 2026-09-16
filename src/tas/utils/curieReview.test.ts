import { orderFieldFeedback, wholeStarCount } from './curieReview';
import type { CurieFieldFeedback, FormField } from '../types';

const fields: FormField[] = [
  { id: 'goal', label: 'Goal', type: 'textarea', required: true },
  { id: 'strength', label: 'Strength', type: 'textarea', required: true },
  { id: 'contribution', label: 'Contribution', type: 'textarea', required: false },
];

describe('orderFieldFeedback', () => {
  it('orders pins and list rows by template field order', () => {
    const feedback: CurieFieldFeedback[] = [
      { field_id: 'contribution', weight: 0, comment: 'c', color: null },
      { field_id: 'goal', weight: 1, comment: 'g', color: 'good' },
      { field_id: 'strength', weight: 1, comment: 's', color: 'needs_revision' },
    ];
    expect(orderFieldFeedback(fields, feedback).map((entry) => entry.field_id)).toEqual([
      'goal',
      'strength',
      'contribution',
    ]);
  });
});

describe('wholeStarCount', () => {
  it('rounds to whole stars with no halves', () => {
    expect(wholeStarCount(3.6)).toBe(4);
    expect(wholeStarCount(null)).toBe(0);
  });
});
