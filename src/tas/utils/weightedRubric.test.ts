import type { WeightedComponent, WeightedSection } from '../types';
import {
  buildWeightedFeedbackPayload,
  draftFromCurieReview,
  draftFromWeightedFeedback,
  feedbackFromWeightedRows,
  parsePastedIndicators,
  validateWeightedRubric,
  validateWeightedScores,
  weightedTotals,
} from './weightedRubric';

function criterion(id: string, name: string, marks: number[]) {
  return { id, name, indicators: marks.map((m, i) => ({ text: `${name} ${i}`, marks: m })) };
}

function component(id: string, weight: number, isGate = false): WeightedComponent {
  return {
    id,
    name: id,
    learning_objective: '',
    learning_outcome: '',
    field_ids: [],
    weight,
    is_gate: isGate,
    criteria: [
      criterion(`${id}-rel`, 'Task Relevance', [4, 6]),
      criterion(`${id}-rea`, 'Reasoning', [10]),
      criterion(`${id}-spe`, 'Specificity', [10]),
    ],
  };
}

const SECTIONS: WeightedSection[] = [
  { id: 'gate', title: 'Basic Understanding', components: [component('coherence', 0, true)] },
  { id: 'quad', title: 'Quadrants', components: [component('strengths', 50), component('plans', 50)] },
];

describe('parsePastedIndicators', () => {
  it('splits Excel cells on ";" and reads "(n)" marks', () => {
    expect(parsePastedIndicators(
      'Explicitly STEM-related (4); timeframe is 3–6 months (3); goal is stated before the SWOT (3).',
    )).toEqual([
      { text: 'Explicitly STEM-related', marks: 4 },
      { text: 'timeframe is 3–6 months', marks: 3 },
      { text: 'goal is stated before the SWOT', marks: 3 },
    ]);
  });

  it('splits lines, strips bullets, and keeps text without marks', () => {
    expect(parsePastedIndicators('• A STEM career field is named (3)\n\n• Answered\n')).toEqual([
      { text: 'A STEM career field is named', marks: 3 },
      { text: 'Answered', marks: 0 },
    ]);
  });

  it('keeps ";" inside a line that is not a list of marked parts', () => {
    expect(parsePastedIndicators('Skills; habits or abilities (5)')).toEqual([
      { text: 'Skills; habits or abilities', marks: 5 },
    ]);
  });
});

describe('validateWeightedRubric', () => {
  it('accepts a complete rubric', () => {
    expect(validateWeightedRubric('SWOT', SECTIONS)).toEqual([]);
  });

  it('reports weight totals, gate weights and indicator totals', () => {
    const broken: WeightedSection[] = [{
      id: 's',
      title: 'S',
      components: [component('a', 40), { ...component('g', 5, true) }],
    }];
    broken[0].components[0].criteria[0].indicators[0].marks = 1; // 1 + 6 = 7
    const errors = validateWeightedRubric('', broken);
    expect(errors).toContain('Rubric name is required.');
    expect(errors).toContain('g: a gate component must have 0% weight.');
    expect(errors).toContain('a / Task Relevance: indicator marks must add up to 10 (now 7).');
    expect(errors).toContain('Component weights must add up to 100% (now 40%).');
  });
});

describe('weighted scoring', () => {
  const draft = {
    strengths: { 'strengths-rel': '8', 'strengths-rea': '7', 'strengths-spe': '6' },
    plans: { 'plans-rel': '10', 'plans-rea': '10', 'plans-spe': '10' },
    coherence: { 'coherence-rel': '0', 'coherence-rea': '0', 'coherence-spe': '0' },
  };

  it('averages criteria then applies weights; gates add nothing', () => {
    // strengths: avg 7 → 5 marks × 0.7 = 3.5; plans: 5; total 8.5 / 10
    expect(weightedTotals(SECTIONS, draft)).toEqual({ earned: 8.5, max: 10 });
  });

  it('requires every criterion score, gates included', () => {
    const errors = validateWeightedScores(SECTIONS, { ...draft, plans: { 'plans-rel': '11' } });
    expect(errors['plans::plans-rel']).toBe('Score cannot be greater than 10.');
    expect(errors['plans::plans-rea']).toBe('Score is required.');
    expect(errors['strengths::strengths-rel']).toBeUndefined();
  });

  it('round-trips the feedback payload into a draft', () => {
    const notes = { strengths: 'Name a specific example.', plans: '', coherence: '' };
    const payload = buildWeightedFeedbackPayload(SECTIONS, draft, notes);
    expect(payload[1]).toEqual({
      component_id: 'strengths',
      component: 'strengths',
      comment: 'Name a specific example.',
      criterion_scores: [
        {
          criterion_id: 'strengths-rel', criterion: 'Task Relevance', score: 8, max_score: 10,
        },
        {
          criterion_id: 'strengths-rea', criterion: 'Reasoning', score: 7, max_score: 10,
        },
        {
          criterion_id: 'strengths-spe', criterion: 'Specificity', score: 6, max_score: 10,
        },
      ],
    });
    expect(draftFromWeightedFeedback(SECTIONS, payload)).toEqual(draft);
    expect(feedbackFromWeightedRows(SECTIONS, payload)).toEqual(notes);
  });

  it('prefills component scores and section feedback from a CURIE review', () => {
    const sections = SECTIONS.map((section) => ({
      ...section,
      components: section.components.map((component) => (
        component.id === 'strengths'
          ? { ...component, field_ids: ['strength', 'plans'] }
          : component
      )),
    }));
    const draft = draftFromCurieReview(sections, {
      gate_criterion_scores: [
        { criterion: 'Task Relevance', score: 4 },
        { criterion: 'Reasoning', score: 5 },
        { criterion: 'Specificity', score: 6 },
      ],
      field_feedback: [
        {
          field_id: 'strength',
          comment: ' Add a source. ',
          criterion_scores: [
            { criterion: 'Task Relevance', score: 8 },
            { criterion: 'Reasoning', score: 6 },
            { criterion: 'Specificity', score: 4 },
          ],
        },
        {
          field_id: 'plans',
          comment: 'The sequence is clear.',
          criterion_scores: [
            { criterion: 'Task Relevance', score: 10 },
            { criterion: 'Reasoning', score: 8 },
            { criterion: 'Specificity', score: 6 },
          ],
        },
      ],
    });
    expect(draft.scores.coherence).toEqual({
      'coherence-rel': '4',
      'coherence-rea': '5',
      'coherence-spe': '6',
    });
    expect(draft.scores.strengths).toEqual({
      'strengths-rel': '9',
      'strengths-rea': '7',
      'strengths-spe': '5',
    });
    expect(draft.feedback.strengths).toBe('Add a source.\n\nThe sequence is clear.');
    expect(draft.feedback.coherence).toBeUndefined();
    expect(draft.scores.plans).toBeUndefined();
  });
});
