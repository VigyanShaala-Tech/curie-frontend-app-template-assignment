import {
  buildAssignmentSections,
  buildAssignmentSteps,
  validateStructuralMetadata,
} from './assignmentStructure';
import type { FormField } from '../types';

const field = (overrides: Partial<FormField>): FormField => ({
  id: 'field', label: 'Field', type: 'text', required: false, ...overrides,
});

describe('assignment structure', () => {
  it('gives legacy SWOT fields independent Cards sections', () => {
    const sections = buildAssignmentSections([
      field({ id: 'strength', label: 'Strengths' }),
      field({ id: 'weakness', label: 'Weaknesses' }),
    ]);
    expect(sections.map((item) => [item.title, item.displayStyle])).toEqual([
      ['Strengths', 'cards'], ['Weaknesses', 'cards'],
    ]);
  });

  it('groups Career Exploration fields into table rows and columns', () => {
    const fields = [
      field({
        id: 'career', section: 'Career options', displayStyle: 'table', tableRow: '1', tableColumn: 'Career',
      }),
      field({
        id: 'skills', section: 'Career options', displayStyle: 'table', tableRow: '1', tableColumn: 'Skills',
      }),
    ];
    expect(buildAssignmentSections(fields)[0].fields).toHaveLength(2);
    expect(validateStructuralMetadata(fields)).toEqual([]);
  });

  it('orders Career Progression fields with explicit stage metadata', () => {
    const fields = [
      field({
        id: 'later', section: 'Progression', displayStyle: 'stages', stage: 'Build', stageOrder: 2,
      }),
      field({
        id: 'first', section: 'Progression', displayStyle: 'stages', stage: 'Explore', stageOrder: 1,
      }),
    ];
    expect(validateStructuralMetadata(fields)).toEqual([]);
    expect(fields.sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0))[0].stage).toBe('Explore');
  });

  it('keeps a normal Name & College field as a text input section', () => {
    const sections = buildAssignmentSections([
      field({
        id: 'identity', label: 'Name & College', type: 'text', maxChars: 80,
      }),
    ]);
    expect(sections[0].fields[0]).toMatchObject({ type: 'text', maxChars: 80 });
  });

  it('requires the metadata that table and stage layouts need', () => {
    expect(validateStructuralMetadata([
      field({ label: 'Career', section: 'Careers', displayStyle: 'table' }),
      field({
        id: 'step', label: 'Step', section: 'Path', displayStyle: 'stages',
      }),
    ])).toEqual([
      'Career: Table fields need a row and column.',
      'Step: Stage fields need a stage name and order.',
    ]);
  });

  it('uses Cards sections, Table rows, and ordered Stages as learner steps', () => {
    const steps = buildAssignmentSteps([
      field({ id: 'name', label: 'Name', section: 'Details' }),
      field({ id: 'college', label: 'College', section: 'Details' }),
      field({
        id: 'career-1', section: 'Careers', displayStyle: 'table', tableRow: 'Option 1', tableColumn: 'Career',
      }),
      field({
        id: 'career-2', section: 'Careers', displayStyle: 'table', tableRow: 'Option 2', tableColumn: 'Career',
      }),
      field({
        id: 'launch', section: 'Progression', displayStyle: 'stages', stage: 'Launch', stageOrder: 3,
      }),
      field({
        id: 'discover', section: 'Progression', displayStyle: 'stages', stage: 'Discover', stageOrder: 1,
      }),
    ]);

    expect(steps.map((step) => [step.title, step.fields.map((item) => item.id)])).toEqual([
      ['Details', ['name', 'college']],
      ['Option 1', ['career-1']],
      ['Option 2', ['career-2']],
      ['Discover', ['discover']],
      ['Launch', ['launch']],
    ]);
  });

  it('carries the exact instruction for each generated learner step', () => {
    const steps = buildAssignmentSteps([
      field({
        id: 'career-1', section: 'Careers', displayStyle: 'table', tableRow: 'Option 1', tableColumn: 'Career', sectionInstruction: 'Compare role, employer and impact.',
      }),
      field({
        id: 'career-2', section: 'Careers', displayStyle: 'table', tableRow: 'Option 2', tableColumn: 'Career', sectionInstruction: 'Consider a genuinely different pathway.',
      }),
    ]);

    expect(steps.map((step) => step.instruction)).toEqual([
      'Compare role, employer and impact.',
      'Consider a genuinely different pathway.',
    ]);
  });
});
