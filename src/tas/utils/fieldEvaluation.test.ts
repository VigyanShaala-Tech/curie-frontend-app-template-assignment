import {
  buildFieldRubricPayload,
  buildFieldSections,
  orderedTemplateFields,
  resolveFieldEvaluation,
  shouldUseFieldEvaluation,
  validateFieldScoreInputs,
} from './fieldEvaluation';

const templateFields = {
  'f-gate': 'Overall SWOT Coherence & Alignment',
  'f-plans': '3 Action Plans (Using SWOT Combinations)',
  'f-goal': 'Goal Definition - Short-Term STEM Goal',
};

describe('orderedTemplateFields', () => {
  it('keeps template order and the configured label', () => {
    expect(orderedTemplateFields(templateFields).map((field) => field.label)).toEqual([
      'Overall SWOT Coherence & Alignment',
      '3 Action Plans (Using SWOT Combinations)',
      'Goal Definition - Short-Term STEM Goal',
    ]);
  });

  it('uses the field id when a label is blank and skips an empty id', () => {
    expect(orderedTemplateFields({ '': 'ignored', 'f-1': '   ' })).toEqual([
      { id: 'f-1', label: 'f-1' },
    ]);
  });
});

describe('shouldUseFieldEvaluation', () => {
  it('uses field cards only after rubrics load with no criteria and at least one template field', () => {
    expect(shouldUseFieldEvaluation(0, 3, true)).toBe(true);
    expect(shouldUseFieldEvaluation(2, 8, true)).toBe(false);
    expect(shouldUseFieldEvaluation(2, 8, true, 'career-exploration-template')).toBe(false);
    expect(shouldUseFieldEvaluation(2, 4, true, 'swot')).toBe(true);
    expect(shouldUseFieldEvaluation(0, 0, true)).toBe(false);
    expect(shouldUseFieldEvaluation(0, 3, false)).toBe(false);
  });
});

describe('buildFieldSections', () => {
  const fields = orderedTemplateFields(templateFields);

  it('maps scores by criterion name and leaves a field with no row blank', () => {
    const sections = buildFieldSections(fields, [
      {
        field_id: 'f-plans',
        comment: 'List three actions.',
        criterion_scores: [
          { criterion: 'Specificity & Evidence', score: 0 },
          { criterion: 'Task Relevance', score: 3 },
          { criterion: 'Reasoning / Understanding', score: 2 },
        ],
      },
      { field_id: 'f-unknown', comment: 'not on the template', criterion_scores: [] },
    ], []);

    expect(sections.map((section) => section.fieldId)).toEqual(['f-gate', 'f-plans', 'f-goal']);
    expect(sections[0].scores).toEqual({
      'Task Relevance': '',
      'Reasoning / Understanding': '',
      'Specificity & Evidence': '',
    });
    expect(sections[0].feedback).toBe('');
    expect(sections[1].scores).toEqual({
      'Task Relevance': '3',
      'Reasoning / Understanding': '2',
      'Specificity & Evidence': '0',
    });
    expect(sections[1].feedback).toBe('List three actions.');
  });

  it('keeps the first row when the same field id is repeated', () => {
    const sections = buildFieldSections(fields, [
      { field_id: 'f-plans', comment: 'first', criterion_scores: [{ criterion: 'Task Relevance', score: 4 }] },
      { field_id: 'f-plans', comment: 'second', criterion_scores: [{ criterion: 'Task Relevance', score: 9 }] },
    ], []);
    expect(sections[1].feedback).toBe('first');
    expect(sections[1].scores['Task Relevance']).toBe('4');
  });

  it('binds gate scores to the single template field that has no field row', () => {
    const sections = buildFieldSections(
      fields,
      [
        { field_id: 'f-plans', comment: 'plans', criterion_scores: [{ criterion: 'Task Relevance', score: 4 }] },
        { field_id: 'f-goal', comment: 'goal', criterion_scores: [{ criterion: 'Task Relevance', score: 7 }] },
      ],
      [
        { criterion: 'Task Relevance', score: 6 },
        { criterion: 'Reasoning / Understanding', score: 6 },
        { criterion: 'Specificity & Evidence', score: 5 },
      ],
    );
    expect(sections[0].scores['Task Relevance']).toBe('6');
    expect(sections[0].scores['Specificity & Evidence']).toBe('5');
    expect(sections[0].feedback).toBe('');
    expect(sections[1].feedback).toBe('plans');
  });

  it('does not invent a gate section when several fields have no row', () => {
    const sections = buildFieldSections(fields, [], [
      { criterion: 'Task Relevance', score: 6 },
    ]);
    expect(sections.every((section) => section.scores['Task Relevance'] === '')).toBe(true);
    expect(sections).toHaveLength(3);
  });
});

describe('resolveFieldEvaluation', () => {
  it('prefers saved field rows and the saved overall comment', () => {
    const resolved = resolveFieldEvaluation({
      templateFields,
      feedbackRubrics: [
        {
          field_id: 'f-goal',
          comment: 'Edited goal feedback',
          criterion_scores: [{ criterion: 'Task Relevance', score: 9 }],
        },
      ],
      feedbackComment: 'Edited overall',
      fieldEvaluation: {
        overall_feedback: 'AI overall',
        field_feedback: [
          { field_id: 'f-goal', comment: 'AI goal', criterion_scores: [{ criterion: 'Task Relevance', score: 1 }] },
        ],
      },
    });
    expect(resolved.overall).toBe('Edited overall');
    expect(resolved.sections[2].feedback).toBe('Edited goal feedback');
    expect(resolved.sections[2].scores['Task Relevance']).toBe('9');
  });

  it('keeps a cleared overall comment when field rows were saved', () => {
    const resolved = resolveFieldEvaluation({
      templateFields,
      feedbackRubrics: [{ field_id: 'f-goal', comment: '', criterion_scores: [] }],
      feedbackComment: '',
      fieldEvaluation: { overall_feedback: 'AI overall' },
    });
    expect(resolved.overall).toBe('');
  });

  it('uses optional field evaluation feedback when nothing has been saved', () => {
    const resolved = resolveFieldEvaluation({
      templateFields,
      feedbackRubrics: [],
      feedbackComment: '',
      fieldEvaluation: {
        overall_feedback: 'Priority for revision.',
        field_feedback: [
          { field_id: 'f-plans', comment: 'No action plans.', criterion_scores: [] },
        ],
      },
    });
    expect(resolved.overall).toBe('Priority for revision.');
    expect(resolved.sections[1].feedback).toBe('No action plans.');
  });
});

describe('validateFieldScoreInputs and payload', () => {
  const fields = orderedTemplateFields({ 'f-1': 'Strengths (Internal)' });

  it('allows a fully blank field and rejects a partial or out-of-range triple', () => {
    expect(validateFieldScoreInputs(fields, { 'f-1': {} })).toEqual({});
    const partial = validateFieldScoreInputs(fields, {
      'f-1': { 'Task Relevance': '4' },
    });
    expect(partial['f-1::Reasoning / Understanding']).toBe('Score is required.');
    expect(validateFieldScoreInputs(fields, {
      'f-1': {
        'Task Relevance': '11',
        'Reasoning / Understanding': '1',
        'Specificity & Evidence': '1',
      },
    })['f-1::Task Relevance']).toBe('Score cannot be greater than 10.');
  });

  it('saves one row per field without a marks value', () => {
    const rows = buildFieldRubricPayload(
      fields,
      {
        'f-1': {
          'Task Relevance': '10',
          'Reasoning / Understanding': '8',
          'Specificity & Evidence': '',
        },
      },
      { 'f-1': 'Keep the full note.' },
    );
    expect(rows).toEqual([
      {
        field_id: 'f-1',
        comment: 'Keep the full note.',
        criterion_scores: [
          { criterion: 'Task Relevance', score: 10, max_score: 10 },
          { criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
          { criterion: 'Specificity & Evidence', score: null, max_score: 10 },
        ],
      },
    ]);
    expect(rows[0]).not.toHaveProperty('marks');
  });
});
