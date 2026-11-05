import React from 'react';
import {
  fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasStore } from '../../store/tasStore';
import { adminSubmissionsApi } from '../../services/api';
import { AdminSubmissionDetail } from './AdminSubmissionDetail';

jest.mock('@openedx/paragon', () => {
  const ReactActual = jest.requireActual('react');
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
    'aria-label': ariaLabel,
  }: {
    as?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
    'aria-label'?: string;
  }) => ReactActual.createElement(as === 'textarea' ? 'textarea' : 'input', {
    'aria-label': ariaLabel,
    value: value ?? '',
    onChange,
  });
  const FormLabel = ({ children }: { children?: React.ReactNode }) => ReactActual.createElement('label', null, children);
  const FormGroup = ({ children }: { children?: React.ReactNode }) => ReactActual.createElement('div', null, children);
  const Form = { Control: FormControl, Label: FormLabel, Group: FormGroup };
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

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
  submitFeedback.mockResolvedValue(undefined);
});

describe('AdminSubmissionDetail evaluation modes', () => {
  it('keeps the rubric category form when the block has criteria', async () => {
    getSubmission.mockResolvedValue({
      id: '42',
      username: 'tas_student',
      status: 'submitted',
      version: 1,
      template_fields: { goal: 'Goal Definition - Short-Term STEM Goal' },
      feedback: null,
    });
    getRubrics.mockResolvedValue({
      display_name: 'Career',
      instructions: '',
      rubrics: [{ criterion: 'Content Quality', options: [{ name: 'Quality', marks: 7 }], feedbacks: [] }],
    });

    renderDetail();

    expect(await screen.findByText('Content Quality')).toBeTruthy();
    expect(screen.getByText('Criteria Preview')).toBeTruthy();
    expect(screen.queryByText('Section feedback')).toBeNull();
    expect(screen.getByLabelText('Instructor Comment')).toBeTruthy();
  });

  it('renders one card per template field and posts field rows without marks', async () => {
    getSubmission.mockResolvedValue({
      id: '42',
      username: 'tas_student',
      status: 'submitted',
      version: 1,
      template_fields: {
        'f-plans': '3 Action Plans (Using SWOT Combinations)',
        'f-goal': 'Goal Definition - Short-Term STEM Goal',
      },
      feedback: null,
    });
    getRubrics.mockResolvedValue({ display_name: 'SWOT', instructions: '', rubrics: [] });

    renderDetail();

    await screen.findByText('3 Action Plans (Using SWOT Combinations)', undefined, { timeout: 8000 });
    expect(screen.getByText('Goal Definition - Short-Term STEM Goal')).toBeTruthy();
    expect(screen.getAllByText('Section feedback')).toHaveLength(2);
    expect(screen.getByLabelText('Overall feedback')).toBeTruthy();
    expect(screen.queryByText('Criteria Preview')).toBeNull();

    fireEvent.change(screen.getByLabelText('Overall feedback'), { target: { value: 'Revise the plans.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    const payload = submitFeedback.mock.calls[0][1];
    expect(payload.comment).toBe('Revise the plans.');
    expect(payload.status).toBe('approved');
    expect(payload.rubrics).toEqual([
      {
        field_id: 'f-plans',
        comment: '',
        criterion_scores: [
          { criterion: 'Task Relevance', score: null, max_score: 10 },
          { criterion: 'Reasoning / Understanding', score: null, max_score: 10 },
          { criterion: 'Specificity & Evidence', score: null, max_score: 10 },
        ],
      },
      {
        field_id: 'f-goal',
        comment: '',
        criterion_scores: [
          { criterion: 'Task Relevance', score: null, max_score: 10 },
          { criterion: 'Reasoning / Understanding', score: null, max_score: 10 },
          { criterion: 'Specificity & Evidence', score: null, max_score: 10 },
        ],
      },
    ]);
    expect(payload.rubrics[0]).not.toHaveProperty('marks');
  }, 20000);
});
