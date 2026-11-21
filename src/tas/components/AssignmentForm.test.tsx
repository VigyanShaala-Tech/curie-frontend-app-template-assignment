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

const swotFields: FormField[] = [
  {
    id: 'strength', label: 'Strengths', type: 'textarea', required: false,
  },
  {
    id: 'weakness', label: 'Weaknesses', type: 'textarea', required: false,
  },
  {
    id: 'opportunity', label: 'Opportunities', type: 'textarea', required: false,
  },
  {
    id: 'threat', label: 'Threats', type: 'textarea', required: false,
  },
];

const remoteSwotTemplate: Template = makeTemplate([
  {
    id: 'strengths', label: 'Strengths', type: 'textarea', required: true, section: 'Strengths',
  },
  {
    id: 'weaknesses', label: 'Weaknesses', type: 'textarea', required: true, section: 'Weaknesses',
  },
  {
    id: 'opportunities', label: 'Opportunities', type: 'textarea', required: true, section: 'Opportunities',
  },
  {
    id: 'threats', label: 'Threats', type: 'textarea', required: true, section: 'Threats',
  },
]);

const remoteFilled = {
  strengths: 'Strong analytical skills',
  weaknesses: 'Tend to overthink',
  opportunities: 'Growing demand for AI',
  threats: 'High competition',
};

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

  it('keeps first-time submission on the step-by-step UI without Earlier answers', async () => {
    const user = userEvent.setup();
    render(
      <AssignmentForm
        template={makeTemplate(swotFields)}
        values={{
          strength: 'Curious',
          weakness: 'Planning',
          opportunity: 'AI demand',
          threat: 'Time',
        }}
        onChange={() => undefined}
        isMobile
      />,
    );

    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Strengths' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Earlier answers' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Weaknesses →' }));
    expect(screen.getByRole('heading', { name: 'Weaknesses' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Strengths' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Earlier answers' })).toBeNull();
    expect(screen.queryByText('Curious')).toBeNull();
  });

  it('wizard mode shows one step at a time without Earlier answers', async () => {
    render(
      <AssignmentForm
        template={remoteSwotTemplate}
        values={remoteFilled}
        onChange={jest.fn()}
        isMobile={false}
        mode="wizard"
      />,
    );

    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Strengths' })).toBeTruthy();
    expect(screen.queryByText('Earlier answers')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Strengths' })).toBeNull();
    expect(screen.queryByLabelText('Weaknesses')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Weaknesses →' }));
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Weaknesses' })).toBeTruthy();
    expect(screen.queryByText('Earlier answers')).toBeNull();
  });

  it('renders template text response fields as auto-growing textareas, not single-line inputs', () => {
    render(
      <AssignmentForm
        template={makeTemplate([{
          id: 'strength',
          label: 'Strengths',
          type: 'text',
          required: false,
        }])}
        values={{
          strength: 'Strong foundation in programming languages (C, C++, Java, Python). Good problem solving.',
        }}
        onChange={() => undefined}
        isMobile={false}
      />,
    );
    const control = screen.getByRole('textbox', { name: 'Strengths' });
    expect(control.tagName).toBe('TEXTAREA');
    expect(control.classList.contains('assignment-field__textarea--auto')).toBe(true);
    expect(control.classList.contains('assignment-field__textarea--from-text')).toBe(true);
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
    expect(screen.getByRole('heading', { name: 'Option 2' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Earlier answers' })).toBeNull();

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
    expect(screen.getByRole('heading', { name: 'Build' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '← Explore' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Earlier answers' })).toBeNull();
  });

  it('shows all saved SWOT responses with Edit in resubmission mode', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <AssignmentForm
        template={makeTemplate(swotFields)}
        values={{
          strength: 'Curious',
          weakness: 'Planning',
          opportunity: 'AI demand',
          threat: 'Time pressure',
        }}
        onChange={onChange}
        isMobile
        resubmissionMode
      />,
    );

    expect(screen.getByRole('heading', { name: 'Earlier answers' })).toBeTruthy();
    expect(screen.getByText('Curious')).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.getByText('AI demand')).toBeTruthy();
    expect(screen.getByText('Time pressure')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Edit / })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Weaknesses →' })).toBeNull();

    await user.click(screen.getAllByRole('button', { name: /^Edit / })[0]);
    expect(screen.getByRole('heading', { name: 'Strengths' })).toBeTruthy();
    const strength = screen.getByRole('textbox', { name: 'Strengths' }) as HTMLTextAreaElement;
    expect(strength.value).toBe('Curious');
    expect(screen.getByRole('button', { name: '← Back to responses' })).toBeTruthy();

    await user.clear(strength);
    await user.type(strength, 'Updated strength');
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '← Back to responses' }));
    expect(screen.getByRole('heading', { name: 'Earlier answers' })).toBeTruthy();
    expect(screen.getByText('Planning')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Strengths' })).toBeNull();

    rerender(
      <AssignmentForm
        template={makeTemplate(swotFields)}
        values={{
          strength: 'Updated strength',
          weakness: 'Planning',
          opportunity: 'AI demand',
          threat: 'Time pressure',
        }}
        onChange={onChange}
        isMobile
        resubmissionMode
        readOnly
      />,
    );
    expect(screen.getByText('Updated strength')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
  });

  it('overview mode lists all saved responses and Edit opens then returns', async () => {
    const onChange = jest.fn();
    render(
      <AssignmentForm
        template={remoteSwotTemplate}
        values={remoteFilled}
        onChange={onChange}
        isMobile={false}
        mode="overview"
      />,
    );

    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Strong analytical skills')).toBeTruthy();
    expect(screen.getByText('Tend to overthink')).toBeTruthy();
    expect(screen.getByText('Growing demand for AI')).toBeTruthy();
    expect(screen.getByText('High competition')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Weaknesses →' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Opportunities' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Opportunities' })).toBeTruthy();
    const input = screen.getByLabelText('Opportunities') as HTMLTextAreaElement;
    expect(input.value).toBe('Growing demand for AI');

    await userEvent.clear(input);
    await userEvent.type(input, 'Updated opportunities');
    expect(onChange).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '← Back to responses' }));
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Tend to overthink')).toBeTruthy();
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

  it('shows the full template instructional stack above the active section control', () => {
    const sectionInstruction = [
      'Talk to family, friends, mentors, or peers.',
      'Using the guiding questions & reflect with your friends and with CURIE',
      'Think of previous life experiences and identify your personal factors.',
      'Note: Think of every factor that is relevant to the goal you are working on.',
      '',
      'Guiding Questions',
      'What do you do well without much effort?',
      'When do you feel confident or in control?',
    ].join('\n');

    render(
      <AssignmentForm
        template={makeTemplate([{
          id: 'impact',
          label: 'Who benefits from this career?',
          type: 'textarea',
          required: true,
          section: 'Career impact',
          sectionInstruction,
          guidance: 'Write 3–5 points relevant to your goal',
          placeholder: 'Explain who benefits and how their lives could change.',
        }])}
        values={{}}
        onChange={() => undefined}
        isMobile
      />,
    );

    expect(screen.getByText(/Talk to family, friends, mentors, or peers/)).toBeTruthy();
    expect(screen.getByText(/Guiding Questions/)).toBeTruthy();
    expect(screen.getByText(/What do you do well without much effort/)).toBeTruthy();
    const guidance = screen.getByText('Write 3–5 points relevant to your goal');
    const placeholderHelp = screen.getByText(
      'Explain who benefits and how their lives could change.',
    );
    const input = screen.getByRole('textbox', { name: 'Who benefits from this career?' });
    const describedBy = input.getAttribute('aria-describedby') || '';
    expect(describedBy).toContain(guidance.id);
    expect(describedBy).toContain(placeholderHelp.id);
    expect(input.getAttribute('placeholder')).toBe(
      'Explain who benefits and how their lives could change.',
    );
  });

  it('keeps instructional content on section Edit and out of the resubmission overview', async () => {
    const user = userEvent.setup();
    const instructionalFields: FormField[] = [
      {
        id: 'alpha',
        label: 'Alpha',
        type: 'textarea',
        required: false,
        sectionInstruction: 'Alpha section instructions for learners.',
        guidance: 'Write clear Alpha points.',
        placeholder: 'Alpha placeholder guidance.',
      },
      {
        id: 'beta',
        label: 'Beta',
        type: 'textarea',
        required: false,
        sectionInstruction: 'Beta section instructions for learners.',
        guidance: 'Write clear Beta points.',
        placeholder: 'Beta placeholder guidance.',
      },
    ];

    render(
      <AssignmentForm
        template={makeTemplate(instructionalFields)}
        values={{ alpha: 'Alpha answer', beta: 'Beta answer' }}
        onChange={() => undefined}
        isMobile
        resubmissionMode
      />,
    );

    expect(screen.getByRole('heading', { name: 'Earlier answers' })).toBeTruthy();
    expect(screen.getByText('Alpha answer')).toBeTruthy();
    expect(screen.getByText('Beta answer')).toBeTruthy();
    expect(screen.queryByText('Alpha section instructions for learners.')).toBeNull();
    expect(screen.queryByText('Write clear Alpha points.')).toBeNull();
    expect(screen.queryByText('Alpha placeholder guidance.')).toBeNull();

    await user.click(screen.getAllByRole('button', { name: /^Edit / })[0]);
    expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
    expect(screen.getByText('Alpha section instructions for learners.')).toBeTruthy();
    expect(screen.getByText('Write clear Alpha points.')).toBeTruthy();
    expect(screen.getByText('Alpha placeholder guidance.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Earlier answers' })).toBeNull();
  });
});
