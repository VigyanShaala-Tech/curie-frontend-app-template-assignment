import {
  COMBINED_REFLECTION_LABEL,
  feedbackAnchorFieldIds,
  feedbackFieldLabel,
  historyRowStatus,
  isCombinedReflectionFeedback,
  orderFieldFeedback,
  wholeStarCount,
} from './curieReview';
import type { CurieFieldFeedback, FormField } from '../types';

const fields: FormField[] = [
  {
    id: 'goal',
    label: 'Goal',
    type: 'textarea',
    required: true,
  },
  {
    id: 'strength',
    label: 'Strength',
    type: 'textarea',
    required: true,
  },
  {
    id: 'contribution',
    label: 'Contribution',
    type: 'textarea',
    required: false,
  },
  {
    id: 'reflection',
    label: 'Personal Development Reflection',
    type: 'textarea',
    required: false,
  },
];

describe('orderFieldFeedback', () => {
  it('orders pins and list rows by template field order', () => {
    const feedback: CurieFieldFeedback[] = [
      {
        field_id: 'contribution',
        weight: 0,
        comment: 'c',
        color: null,
      },
      {
        field_id: 'goal',
        weight: 1,
        comment: 'g',
        color: 'good',
      },
      {
        field_id: 'strength',
        weight: 1,
        comment: 's',
        color: 'needs_revision',
      },
    ];
    expect(
      orderFieldFeedback(fields, feedback).map((entry) => entry.field_id),
    ).toEqual(['goal', 'strength', 'contribution']);
  });
});

describe('combined SWOT reflection presentation', () => {
  const combined: CurieFieldFeedback[] = [{
    field_id: 'reflection',
    weight: 1,
    comment: 'Combined feedback',
    color: 'good',
  }];

  it('uses one combined label and anchors it to both final fields', () => {
    expect(isCombinedReflectionFeedback(fields.map((field) => field.id), combined)).toBe(true);
    expect(feedbackFieldLabel(fields, combined, 'reflection')).toBe(COMBINED_REFLECTION_LABEL);
    expect(feedbackAnchorFieldIds(fields, combined, 'reflection')).toEqual([
      'contribution',
      'reflection',
    ]);
  });

  it('leaves legacy separate contribution and reflection feedback unchanged', () => {
    const legacy: CurieFieldFeedback[] = [
      { ...combined[0], field_id: 'contribution' },
      combined[0],
    ];
    expect(isCombinedReflectionFeedback(fields.map((field) => field.id), legacy)).toBe(false);
    expect(feedbackFieldLabel(fields, legacy, 'reflection')).toBe('Personal Development Reflection');
    expect(feedbackAnchorFieldIds(fields, legacy, 'reflection')).toEqual(['reflection']);
  });
});

describe('wholeStarCount', () => {
  it('rounds to whole stars with no halves', () => {
    expect(wholeStarCount(3.6)).toBe(4);
    expect(wholeStarCount(null)).toBe(0);
  });
});

describe('historyRowStatus', () => {
  it('distinguishes a completed review awaiting instructor approval', () => {
    expect(
      historyRowStatus({
        version_number: 2,
        submitted_at: null,
        feedback_available: false,
        feedback_unavailable_reason: 'pending',
        feedback_status: null,
        instructor_comment: '',
        pdf_url: null,
        download_url: null,
        curie_review_status: 'pending_evaluation',
        awaiting_instructor_approval: true,
      }),
    ).toBe('Awaiting Instructor Review');
  });
});
