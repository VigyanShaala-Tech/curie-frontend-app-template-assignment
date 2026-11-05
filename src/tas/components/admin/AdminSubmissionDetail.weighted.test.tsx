import React from 'react';
import {
  fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasStore } from '../../store/tasStore';
import { adminSubmissionsApi } from '../../services/api';
import { AdminSubmissionDetail } from './AdminSubmissionDetail';
import {
  INSTRUCTOR_OVERRIDE_ACTION,
  INSTRUCTOR_OVERRIDE_CONFIRM,
} from '../../utils/instructorCurieUi';

jest.mock('@openedx/paragon', () => {
  const ReactActual = require('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) => ReactActual.createElement('div', null, children);
  const Button = ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => ReactActual.createElement('button', { type: 'button', onClick, disabled }, children);
  const FormControl = ({
    as,
    value,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
  }: {
    as?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    'aria-label'?: string;
  }) => ReactActual.createElement(as === 'textarea' ? 'textarea' : 'input', {
    'aria-label': ariaLabel,
    placeholder,
    value: value ?? '',
    onChange,
  });
  const FormLabel = ({ children }: { children?: React.ReactNode }) => ReactActual.createElement('label', null, children);
  const Form = { Control: FormControl, Label: FormLabel, Group: Passthrough };
  const Card = Object.assign(Passthrough, {
    Header: ({ title }: { title?: string }) => ReactActual.createElement('div', null, title),
    Section: Passthrough,
  });
  return {
    Button,
    Badge: Passthrough,
    Spinner: () => null,
    Form,
    Card,
    Icon: () => null,
    IconButton: () => null,
    OverlayTrigger: Passthrough,
    Tooltip: Passthrough,
  };
});

jest.mock('../../services/api', () => ({
  adminSubmissionsApi: {
    get: jest.fn(),
    getRubrics: jest.fn(),
    submitFeedback: jest.fn(),
  },
}));

jest.mock('../SubmissionPdfViewer', () => ({ SubmissionPdfViewer: () => null }));
jest.mock('../SubmissionHistory', () => ({ SubmissionHistory: () => null }));
jest.mock('./InstructorCommentEditor', () => ({
  InstructorCommentEditor: ({ value }: { value: string }) => <textarea aria-label="Instructor Comment" value={value} readOnly />,
}));
jest.mock('./InstructorCommentHtml', () => ({
  InstructorCommentHtml: ({ comment }: { comment: string }) => <p>{comment}</p>,
}));

const getSubmission = adminSubmissionsApi.get as jest.Mock;
const getRubrics = adminSubmissionsApi.getRubrics as jest.Mock;
const submitFeedback = adminSubmissionsApi.submitFeedback as jest.Mock;

function criterion(id: string, name: string) {
  return { id, name, indicators: [{ text: `${name} indicator`, marks: 10 }] };
}

const SECTIONS = [
  {
    id: 'sec-gate',
    title: 'Basic Understanding',
    components: [{
      id: 'gate',
      name: 'Overall SWOT Coherence',
      learning_objective: '',
      learning_outcome: '',
      field_ids: [],
      weight: 0,
      is_gate: true,
      criteria: [criterion('gate-rel', 'Task Relevance')],
    }],
  },
  {
    id: 'sec-quad',
    title: 'SWOT Quadrants',
    components: [{
      id: 'strengths',
      name: 'Strengths',
      learning_objective: 'Identify strengths',
      learning_outcome: '3–5 strengths',
      field_ids: ['f-s1'],
      weight: 100,
      is_gate: false,
      criteria: [criterion('s-rel', 'Task Relevance'), criterion('s-rea', 'Reasoning')],
    }],
  },
];

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminSubmissionDetail submissionId="42" onBack={() => undefined} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useTasStore.setState({
    mfeContext: {
      usageKey: 'block-1',
      courseId: 'course-v1:OpenedX+AI101+2025',
      studentId: '5',
      isStaff: true,
      isInstructor: true,
    },
  });
  submitFeedback.mockReset();
  submitFeedback.mockResolvedValue(undefined);
  getSubmission.mockResolvedValue({
    id: '42',
    username: 'tas_student',
    status: 'submitted',
    version: 1,
    template_type_slug: 'swot',
    template_fields: { 'f-s1': 'Strength 1' },
    feedback: null,
  });
  getRubrics.mockResolvedValue({
    display_name: 'SWOT',
    instructions: '',
    schema_version: 2,
    rubrics: [],
    sections: SECTIONS,
  });
});

describe('AdminSubmissionDetail weighted rubric', () => {
  it('shows components with linked fields instead of per-field cards', async () => {
    renderDetail();

    expect(await screen.findByText('Strengths', undefined, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText('Evaluates: Strength 1')).toBeTruthy();
    expect(screen.getByText('Not counted in total. Reject if not met.')).toBeTruthy();
    expect(screen.getAllByText('Section feedback')).toHaveLength(2);
    expect(screen.getAllByPlaceholderText('Add feedback for this component...')).toHaveLength(2);
    expect(screen.getByLabelText('Instructor Comment')).toBeTruthy();
  }, 20000);

  it('requires every criterion score, then posts component rows', async () => {
    renderDetail();
    await screen.findByText('Strengths', undefined, { timeout: 8000 });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getAllByText('Score is required.')).toHaveLength(3);
    expect(submitFeedback).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Overall SWOT Coherence Task Relevance'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Strengths Task Relevance'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Strengths Reasoning'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Strengths section feedback'), { target: { value: 'Name an example.' } });
    expect(screen.getByText('7 / 10')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    const payload = submitFeedback.mock.calls[0][1];
    expect(payload.status).toBe('approved');
    expect(payload.rubrics).toEqual([
      {
        component_id: 'gate',
        component: 'Overall SWOT Coherence',
        comment: '',
        criterion_scores: [{
          criterion_id: 'gate-rel', criterion: 'Task Relevance', score: 9, max_score: 10,
        }],
      },
      {
        component_id: 'strengths',
        component: 'Strengths',
        comment: 'Name an example.',
        criterion_scores: [
          {
            criterion_id: 's-rel', criterion: 'Task Relevance', score: 8, max_score: 10,
          },
          {
            criterion_id: 's-rea', criterion: 'Reasoning', score: 6, max_score: 10,
          },
        ],
      },
    ]);
    expect(payload.structured_feedback).toBeUndefined();
  }, 20000);

  it('shows saved section feedback on a graded weighted review', async () => {
    getSubmission.mockResolvedValue({
      id: '42',
      username: 'tas_student',
      status: 'rejected',
      version: 1,
      template_type_slug: 'swot',
      template_fields: { 'f-s1': 'Strength 1' },
      feedback: {
        status: 'rejected',
        source: 'human',
        comment: '<p>Overall note</p>',
        rubrics: [{
          component_id: 'strengths',
          component: 'Strengths',
          comment: 'Be more specific.',
          criterion_scores: [
            { criterion_id: 's-rel', criterion: 'Task Relevance', score: 8, max_score: 10 },
            { criterion_id: 's-rea', criterion: 'Reasoning', score: 6, max_score: 10 },
          ],
        }],
      },
    });

    renderDetail();

    expect(await screen.findByText('Be more specific.')).toBeTruthy();
    expect(screen.getByText('Section feedback')).toBeTruthy();
    expect(screen.getByText('8 / 10')).toBeTruthy();
  });

  it('opens the same weighted form for a CURIE override and posts the edited review', async () => {
    window.confirm = jest.fn(() => true);
    const curieCriteria = [
      { criterion: 'Task Relevance', score: 9, max_score: 10 },
      { criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
      { criterion: 'Specificity & Evidence', score: 7, max_score: 10 },
    ];
    getRubrics.mockResolvedValue({
      display_name: 'SWOT',
      instructions: '',
      schema_version: 2,
      rubrics: [],
      sections: [
        {
          id: 'sec-gate',
          title: 'Basic Understanding',
          components: [{
            id: 'gate',
            name: 'Overall SWOT Coherence',
            learning_objective: '',
            learning_outcome: '',
            field_ids: [],
            weight: 0,
            is_gate: true,
            criteria: [
              criterion('g-rel', 'Task Relevance'),
              criterion('g-rea', 'Reasoning / Understanding'),
              criterion('g-spe', 'Specificity & Evidence'),
            ],
          }],
        },
        {
          id: 'sec-goal',
          title: 'Goal',
          components: [{
            id: 'goal',
            name: 'Goal Definition',
            learning_objective: '',
            learning_outcome: '',
            field_ids: ['goal'],
            weight: 100,
            is_gate: false,
            criteria: [
              criterion('goal-rel', 'Task Relevance'),
              criterion('goal-rea', 'Reasoning / Understanding'),
              criterion('goal-spe', 'Specificity & Evidence'),
            ],
          }],
        },
      ],
    });
    getSubmission.mockResolvedValue({
      id: '42',
      username: 'tas_student',
      status: 'submitted',
      version: 1,
      template_type_slug: 'swot',
      template_fields: { goal: 'Goal Definition - Short-Term STEM Goal' },
      feedback: null,
      curie_review: {
        status: 'ready',
        verdict: 'accepted',
        overall_feedback: 'CURIE overall.',
        awaiting_instructor_approval: true,
        instructor_form_locked: false,
        gate_criterion_scores: curieCriteria,
        field_feedback: [{
          field_id: 'goal',
          weight: 1,
          comment: 'The goal is specific.',
          criterion_scores: curieCriteria,
        }],
      },
    });

    renderDetail();

    expect(await screen.findByTestId('curie-staff-output')).toBeTruthy();
    expect(screen.queryByLabelText('Goal Definition section feedback')).toBeNull();
    expect(screen.queryByTestId('structured-override-editor')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION }));

    expect(await screen.findByLabelText('Goal Definition section feedback')).toBeTruthy();
    expect(screen.queryByTestId('curie-staff-output')).toBeNull();
    expect(screen.queryByTestId('structured-override-editor')).toBeNull();
    expect(screen.getByTestId('weighted-rubric-grading')).toBeTruthy();
    expect((screen.getByLabelText('Goal Definition section feedback') as HTMLTextAreaElement).value)
      .toBe('The goal is specific.');
    expect((screen.getByLabelText('Goal Definition Task Relevance') as HTMLInputElement).value).toBe('9');
    expect((screen.getByLabelText('Overall SWOT Coherence Reasoning / Understanding') as HTMLInputElement).value)
      .toBe('8');

    fireEvent.change(screen.getByLabelText('Goal Definition Task Relevance'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Goal Definition section feedback'), {
      target: { value: 'State the timeframe.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_OVERRIDE_CONFIRM);
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    const payload = submitFeedback.mock.calls[0][1];
    expect(payload.status).toBe('approved');
    expect(payload.structured_feedback).toBeUndefined();
    expect(payload.rubrics).toEqual([
      {
        component_id: 'gate',
        component: 'Overall SWOT Coherence',
        comment: '',
        criterion_scores: [
          { criterion_id: 'g-rel', criterion: 'Task Relevance', score: 9, max_score: 10 },
          { criterion_id: 'g-rea', criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
          { criterion_id: 'g-spe', criterion: 'Specificity & Evidence', score: 7, max_score: 10 },
        ],
      },
      {
        component_id: 'goal',
        component: 'Goal Definition',
        comment: 'State the timeframe.',
        criterion_scores: [
          { criterion_id: 'goal-rel', criterion: 'Task Relevance', score: 6, max_score: 10 },
          { criterion_id: 'goal-rea', criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
          { criterion_id: 'goal-spe', criterion: 'Specificity & Evidence', score: 7, max_score: 10 },
        ],
      },
    ]);
  }, 20000);
});
