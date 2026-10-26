import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentForm } from './AssignmentForm';
import type { FormField, Template } from '../types';

const makeTemplate = (fields: FormField[]): Template => ({
  id: 'template',
  template_type_id: 'type',
  name: 'Structured assignment',
  description: '',
  image_url: '',
  image_width: 794,
  image_height: 1123,
  thumbnail_url: '',
  fields,
  field_positions: Object.fromEntries(fields.map((field, index) => [field.id, {
    x: 10,
    y: 10 + index * 10,
    width: 80,
    height: 8,
  }])),
  is_public: true,
  is_active: true,
  created_by: '',
  created_at: '',
  updated_at: '',
});

describe('AssignmentForm', () => {
  it('renders a normal Name & College text field and reuses maxChars', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AssignmentForm
        template={makeTemplate([{
          id: 'identity', label: 'Name & College', type: 'text', required: true, maxChars: 20,
        }])}
        values={{ identity: 'Manoj' }}
        onChange={onChange}
        isMobile={false}
      />,
    );
    const input = screen.getByRole('textbox', { name: /Name & College/ });
    expect(input.getAttribute('maxlength')).toBe('20');
    expect(input.getAttribute('required')).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toContain('assignment-field-identity-count');
    expect(screen.getByText('5/20').id).toBe('assignment-field-identity-count');
    await user.type(input, ' J');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders Career Exploration as progressive desktop table rows and mobile row cards', async () => {
    const user = userEvent.setup();
    const fields: FormField[] = [
      {
        id: 'career', label: 'Career', type: 'text', required: false, section: 'Career Exploration', displayStyle: 'table', tableRow: 'Option 1', tableColumn: 'Career',
      },
      {
        id: 'skills', label: 'Skills', type: 'textarea', required: false, section: 'Career Exploration', displayStyle: 'table', tableRow: 'Option 1', tableColumn: 'Skills',
      },
      {
        id: 'career-2', label: 'Career', type: 'text', required: false, section: 'Career Exploration', displayStyle: 'table', tableRow: 'Option 2', tableColumn: 'Career',
      },
      {
        id: 'skills-2', label: 'Skills', type: 'textarea', required: false, section: 'Career Exploration', displayStyle: 'table', tableRow: 'Option 2', tableColumn: 'Skills',
      },
    ];
    const { container, rerender } = render(
      <AssignmentForm
        template={makeTemplate(fields)}
        values={{ career: 'Engineer', skills: 'Analysis' }}
        onChange={() => undefined}
        isMobile={false}
      />,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Option 1' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Option 2 →' }));
    expect(screen.getByText('Engineer')).toBeTruthy();
    expect(screen.getByText('Analysis')).toBeTruthy();

    rerender(<AssignmentForm template={makeTemplate(fields)} values={{}} onChange={() => undefined} isMobile />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(container.querySelector('.assignment-table-row-card')).toBeTruthy();
    expect(within(container.querySelector('.assignment-table-row-card') as HTMLElement).getByLabelText('Career')).toBeTruthy();
  });

  it('renders Career Progression as ordered progressive stages', async () => {
    const user = userEvent.setup();
    const fields: FormField[] = [
      {
        id: 'build', label: 'Build action', type: 'textarea', required: false, section: 'Career Progression', displayStyle: 'stages', stage: 'Build', stageOrder: 2,
      },
      {
        id: 'explore', label: 'Explore action', type: 'textarea', required: false, section: 'Career Progression', displayStyle: 'stages', stage: 'Explore', stageOrder: 1,
      },
    ];
    render(<AssignmentForm template={makeTemplate(fields)} values={{ explore: 'Research roles' }} onChange={() => undefined} isMobile />);
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explore' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Build →' }));
    expect(screen.getByText('Research roles')).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Explore' })).toBeTruthy();
  });

  it('keeps the current legacy SWOT field focused and the previous full answer readable', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AssignmentForm
        template={makeTemplate([
          {
            id: 'strength', label: 'Strengths', type: 'textarea', required: false,
          },
          {
            id: 'weakness', label: 'Weaknesses', type: 'textarea', required: false,
          },
        ])}
        values={{ strength: 'Curious', weakness: 'Planning' }}
        onChange={() => undefined}
        isMobile
      />,
    );
    expect(screen.getByRole('heading', { name: 'Strengths' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Weaknesses' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Weaknesses →' }));
    expect(screen.getByRole('textbox', { name: 'Weaknesses' })).toBeTruthy();
    expect(screen.getByText('Curious')).toBeTruthy();
    const earlier = container.querySelector('details.assignment-earlier-card');
    expect(earlier?.hasAttribute('open')).toBe(true);
    expect(
      screen.getByRole('textbox', { name: 'Weaknesses' }).previousElementSibling?.classList
        .contains('assignment-field__label--sr-only'),
    ).toBe(true);
  });

  it('gives a required radio group an accessible question name', () => {
    render(
      <AssignmentForm
        template={makeTemplate([{
          id: 'path',
          label: 'Preferred pathway',
          type: 'radio',
          required: true,
          options: ['Research', 'Industry'],
        }])}
        values={{}}
        onChange={() => undefined}
        isMobile
      />,
    );

    expect(screen.getByRole('group', { name: /Preferred pathway/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Research' }).getAttribute('required')).not.toBeNull();
  });

  it('shows template instructions and associates field guidance with the control', () => {
    render(
      <AssignmentForm
        template={makeTemplate([{
          id: 'impact',
          label: 'Who benefits from this career?',
          type: 'textarea',
          required: true,
          section: 'Career impact',
          sectionInstruction: 'Think about people, communities, industries and the environment.',
          guidance: 'Explain who benefits and how their lives could change.',
        }])}
        values={{}}
        onChange={() => undefined}
        isMobile
      />,
    );

    expect(screen.getByText('Think about people, communities, industries and the environment.')).toBeTruthy();
    const guidance = screen.getByText('Explain who benefits and how their lives could change.');
    const input = screen.getByRole('textbox', { name: 'Who benefits from this career?' });
    expect(input.getAttribute('aria-describedby')).toContain(guidance.id);
  });
});
