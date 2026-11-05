import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WeightedSection } from '../../types';
import { emptySection } from '../../utils/weightedRubric';
import { WeightedRubricEditor, type TemplateFieldOption } from './WeightedRubricEditor';

jest.mock('@openedx/paragon', () => {
  const ReactActual = jest.requireActual('react');
  const Button = ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => ReactActual.createElement('button', { type: 'button', onClick, 'aria-label': ariaLabel }, children);
  const Checkbox = ({
    children,
    checked,
    onChange,
  }: {
    children?: React.ReactNode;
    checked?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => ReactActual.createElement(
    'label',
    null,
    ReactActual.createElement('input', { type: 'checkbox', checked, onChange }),
    children,
  );
  return { Button, Form: { Checkbox }, Icon: () => null };
});

let latest: WeightedSection[] = [];

const Harness: React.FC<{ fields?: TemplateFieldOption[] }> = ({ fields = [] }) => {
  const [sections, setSections] = useState<WeightedSection[]>(() => [emptySection()]);
  latest = sections;
  return <WeightedRubricEditor sections={sections} onChange={setSections} templateFields={fields} />;
};

describe('WeightedRubricEditor', () => {
  it('starts with one component and the three default criteria', () => {
    render(<Harness />);
    expect(screen.getAllByLabelText('Component name')).toHaveLength(1);
    expect(latest[0].components[0].criteria.map((c) => c.name)).toEqual([
      'Task Relevance',
      'Reasoning / Understanding',
      'Specificity & Evidence',
    ]);
    expect(screen.getByText('Choose a template above to link fields.')).toBeTruthy();
  });

  it('adds and deletes sections, components, criteria and indicators', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Add component'));
    fireEvent.click(screen.getAllByText('Add criterion')[0]);
    fireEvent.click(screen.getAllByText('Indicator')[0]);
    fireEvent.click(screen.getByText('Add section'));

    expect(latest).toHaveLength(2);
    expect(latest[0].components).toHaveLength(2);
    expect(latest[0].components[0].criteria).toHaveLength(4);
    expect(latest[0].components[0].criteria[0].indicators).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText('Delete indicator')[0]);
    fireEvent.click(screen.getAllByLabelText(/^Delete criterion/)[3]);
    fireEvent.click(screen.getAllByLabelText(/^Delete component/)[1]);
    fireEvent.click(screen.getAllByLabelText(/^Delete section/)[1]);

    expect(latest).toHaveLength(1);
    expect(latest[0].components).toHaveLength(1);
    expect(latest[0].components[0].criteria).toHaveLength(3);
    expect(latest[0].components[0].criteria[0].indicators).toHaveLength(1);
  });

  it('turns a pasted Excel cell into indicators with marks', () => {
    render(<Harness />);
    fireEvent.paste(screen.getAllByLabelText('Indicator text')[0], {
      clipboardData: { getData: () => 'Explicitly STEM-related (4); timeframe is 3–6 months (3); stated first (3)' },
    });
    expect(latest[0].components[0].criteria[0].indicators).toEqual([
      { text: 'Explicitly STEM-related', marks: 4 },
      { text: 'timeframe is 3–6 months', marks: 3 },
      { text: 'stated first', marks: 3 },
    ]);
    expect(screen.getByText('Total 10 / 10')).toBeTruthy();
  });

  it('links template fields by label and shows the weight total', () => {
    render(<Harness fields={[{ id: 'f-1', label: 'Strength 1' }, { id: 'f-2', label: 'Strength 2' }]} />);
    fireEvent.change(screen.getByLabelText('Add template field to component'), { target: { value: 'f-2' } });
    expect(latest[0].components[0].field_ids).toEqual(['f-2']);
    expect(screen.getByText('Strength 2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Add template field to component'), { target: { value: 'f-2' } });
    expect(latest[0].components[0].field_ids).toEqual(['f-2']);
    expect(screen.getByText('Strength 2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Weight of component in percent'), { target: { value: '100' } });
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Gate (reject if not met)'));
    expect(latest[0].components[0]).toMatchObject({ is_gate: true, weight: 0 });
    expect(screen.getByText('Gate · 0%')).toBeTruthy();
  });
});
