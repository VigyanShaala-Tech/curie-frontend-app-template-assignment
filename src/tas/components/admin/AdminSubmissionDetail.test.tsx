import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSubmissionDetail } from './AdminSubmissionDetail';
import { adminSubmissionsApi } from '../../services/api';
import { useTasStore } from '../../store/tasStore';
import {
  INSTRUCTOR_OVERRIDE_ACTION,
  INSTRUCTOR_OVERRIDE_CONFIRM,
  INSTRUCTOR_PUBLISH_ACTION,
  INSTRUCTOR_PUBLISH_CONFIRM,
} from '../../utils/instructorCurieUi';

jest.mock('../../services/api', () => ({
  adminSubmissionsApi: {
    get: jest.fn(),
    getRubrics: jest.fn(),
    submitFeedback: jest.fn(),
    publishCurieReview: jest.fn(),
    approveCurieReview: jest.fn(),
  },
  formatApiError: (err: any, fallback: string) => err?.response?.data?.detail ?? fallback,
}));

jest.mock('../SubmissionPdfViewer', () => ({
  SubmissionPdfViewer: () => null,
}));

jest.mock('./InstructorCommentEditor', () => ({
  InstructorCommentEditor: () => React.createElement('textarea', { 'aria-label': 'Instructor Comment' }),
}));

const getMock = adminSubmissionsApi.get as jest.Mock;
const rubricsMock = adminSubmissionsApi.getRubrics as jest.Mock;
const submitMock = adminSubmissionsApi.submitFeedback as jest.Mock;
const publishMock = adminSubmissionsApi.publishCurieReview as jest.Mock;
const approveMock = adminSubmissionsApi.approveCurieReview as jest.Mock;

const scores = (a: number, b: number, c: number) => [
  { criterion: 'Task Relevance', score: a, max_score: 10 },
  { criterion: 'Reasoning / Understanding', score: b, max_score: 10 },
  { criterion: 'Specificity & Evidence', score: c, max_score: 10 },
];

const awaitingReview = {
  status: 'ready_for_approval',
  trigger_id: 'trigger-1',
  submission_version_number: 2,
  verdict: 'accepted',
  overall_feedback: 'CURIE overall feedback awaiting approval.',
  field_feedback: [{
    field_id: 'goal',
    comment: 'CURIE goal comment.',
    weight: 1,
    field_score: 8.7,
    criterion_scores: scores(9, 8, 9),
  }],
  gate_criterion_scores: scores(9, 8, 9),
  gate_score: 8.666,
  criterion_wise_scores: { 'Task Relevance': 9 },
  star_rating: 4,
  instructor_form_locked: false,
  awaiting_approval: true,
  approval: null,
  is_slow_pending: false,
  error_detail: '',
};

const pendingReview = {
  status: 'pending_evaluation',
  verdict: null,
  overall_feedback: '',
  field_feedback: [],
  instructor_form_locked: true,
  is_slow_pending: false,
  error_detail: '',
};

const failedReview = {
  ...pendingReview,
  status: 'failed',
  instructor_form_locked: false,
  error_detail: 'CURIE timed out.',
};

const OVERALL = 'CURIE would accept this SWOT.';

const readyReview = {
  status: 'ready',
  verdict: 'accepted',
  overall_feedback: OVERALL,
  field_feedback: [{
    field_id: 'goal',
    comment: 'Clear enough.',
    weight: 1,
    field_score: 8.7,
    criterion_scores: [
      { criterion: 'Task Relevance', score: 9, max_score: 10 },
      { criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
      { criterion: 'Specificity & Evidence', score: 9, max_score: 10 },
    ],
  }],
  gate_criterion_scores: [
    { criterion: 'Task Relevance', score: 9, max_score: 10 },
    { criterion: 'Reasoning / Understanding', score: 8, max_score: 10 },
    { criterion: 'Specificity & Evidence', score: 9, max_score: 10 },
  ],
  instructor_form_locked: false,
  is_slow_pending: false,
  star_rating: 4,
  error_detail: '',
  gate_score: 8.666,
  criterion_wise_scores: {
    'Task Relevance': 9,
    'Reasoning / Understanding': 8,
  },
};

const heldReview = {
  ...readyReview,
  awaiting_instructor_approval: true,
};

function baseSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    username: 'student_curie_pending',
    status: 'submitted',
    version: 1,
    version_number: 1,
    submission_date: '2026-09-13T00:00:00Z',
    pdf: null,
    feedback: null,
    template_fields: { goal: 'Goal' },
    curie_review: pendingReview,
    ...overrides,
  };
}

function awaitingSubmission(overrides: Record<string, unknown> = {}) {
  return baseSubmission({
    version: 2,
    version_number: 2,
    curie_review: awaitingReview,
    ...overrides,
  });
}

function readyCurieSubmission(status: 'approved' | 'rejected') {
  return baseSubmission({
    username: 'student_curie',
    status,
    curie_review: {
      ...readyReview,
      verdict: status === 'approved' ? 'accepted' : 'rejected',
      overall_feedback: OVERALL,
    },
    feedback: {
      source: 'curie',
      status,
      comment: OVERALL,
      rubrics: [{
        criterion: 'Task Relevance', selected_option: 'Score: 9', marks: 9, score: 9,
      }],
      versions: [{
        version_number: 1,
        submission_version_number: 1,
        source: 'curie',
        status,
        created: '2026-09-13T00:00:01Z',
        comment: OVERALL,
        rubrics: [{
          criterion: 'Task Relevance', selected_option: 'Score: 9', marks: 9, score: 9,
        }],
      }],
    },
  });
}

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <IntlProvider locale="en" messages={{}}>
        <AdminSubmissionDetail submissionId="7" onBack={() => undefined} />
      </IntlProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

describe('AdminSubmissionDetail CURIE instructor UI', () => {
  beforeEach(() => {
    getMock.mockReset();
    rubricsMock.mockReset();
    submitMock.mockReset();
    publishMock.mockReset();
    approveMock.mockReset();
    rubricsMock.mockResolvedValue({ display_name: '', instructions: '', rubrics: [] });
    submitMock.mockResolvedValue(undefined);
    publishMock.mockResolvedValue(undefined);
    approveMock.mockResolvedValue({ outcome: 'approved' });
    useTasStore.setState({
      mfeContext: {
        usageKey: 'block-v1:VigyanShaala+STEM101+2026_T3+type@tas+block@demo',
        courseId: 'course-v1:VigyanShaala+STEM101+2026_T3',
        studentId: 'instructor',
        isStaff: false,
        isInstructor: true,
      },
    } as any);
    window.confirm = jest.fn(() => true);
  });

  it('locks Approve/Reject while CURIE is pending', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission()));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('instructor-form-locked')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.getByText(/Manual grading is locked/)).toBeTruthy();
  });

  it('unlocks the grading form when a pending review becomes failed', async () => {
    const state = { payload: baseSubmission() };
    getMock.mockImplementation(() => Promise.resolve().then(() => state.payload));
    const { client } = renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('instructor-form-locked')).toBeTruthy();
    });

    state.payload = baseSubmission({ curie_review: failedReview });
    client.setQueryData(['admin-submission-detail', '7'], state.payload);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeTruthy();
    });
    expect(screen.queryByTestId('instructor-form-locked')).toBeNull();
    expect(screen.getByText(/You can grade this attempt now/)).toBeTruthy();
  });

  it('shows publish and override actions for a held ready review', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      curie_review: heldReview,
    })));
    renderDetail();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: INSTRUCTOR_PUBLISH_ACTION })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeTruthy();
    expect(screen.getByText(/student cannot see this feedback until you approve it unchanged or edit and approve it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByTestId('curie-staff-output')).toBeTruthy();
  });

  it('shows the revised final SWOT result as one combined instructor score and comment', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      status: 'rejected',
      template_fields: {
        goal: 'Goal',
        contribution: 'Contribution to Something Larger',
        reflection: 'Personal Development Reflection',
      },
      curie_review: {
        ...readyReview,
        verdict: 'rejected',
        field_feedback: [
          ...readyReview.field_feedback,
          {
            field_id: 'reflection',
            comment: 'One final combined comment.',
            weight: 1,
            field_score: 7.5,
          },
        ],
      },
      feedback: {
        source: 'curie',
        status: 'rejected',
        comment: OVERALL,
        rubrics: [],
        versions: [],
      },
    })));
    renderDetail();

    await waitFor(() => {
      expect(screen.getByText('Reflection: Broader Contribution & Personal Development')).toBeTruthy();
    });
    expect(screen.getByTestId('curie-field-comments').textContent).toContain(
      'Reflection: Broader Contribution & Personal Development',
    );
    expect(screen.getByText('One final combined comment.')).toBeTruthy();
    expect(screen.queryByText('Contribution to Something Larger')).toBeNull();
    expect(screen.queryByText('Personal Development Reflection')).toBeNull();
  });

  it('confirms and publishes an approved held CURIE review unchanged', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      curie_review: heldReview,
    })));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: INSTRUCTOR_PUBLISH_ACTION }));
    expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_PUBLISH_CONFIRM);
    await waitFor(() => {
      expect(publishMock).toHaveBeenCalledWith('7');
    });
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('does not publish when CURIE feedback approval is cancelled', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      curie_review: heldReview,
    })));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: INSTRUCTOR_PUBLISH_ACTION }));
    expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_PUBLISH_CONFIRM);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('uses the existing human feedback endpoint when overriding a held review', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      curie_review: heldReview,
    })));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION }));
    expect(screen.getByTestId('structured-override-editor')).toBeTruthy();
    expect(screen.getByDisplayValue('Clear enough.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Reattempt' }));
    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith('7', expect.objectContaining({
        status: 'rejected',
        structured_feedback: expect.objectContaining({
          overall_feedback: OVERALL,
          field_feedback: expect.arrayContaining([
            expect.objectContaining({ field_id: 'goal', comment: 'Clear enough.' }),
          ]),
        }),
      }));
    });
    expect(publishMock).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected'] as const)(
    'keeps %s CURIE detail read-only until override is chosen',
    async (status) => {
      getMock.mockImplementation(() => Promise.resolve().then(() => readyCurieSubmission(status)));
      renderDetail();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeTruthy();
      });
      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
      expect(screen.getByTestId('curie-gate-summary')).toBeTruthy();
      expect(screen.getAllByText('8.7/10').length).toBeGreaterThan(0);
      expect(screen.getByTestId('curie-criterion-wise')).toBeTruthy();
      expect(screen.getByTestId('curie-by-field')).toBeTruthy();
      expect(screen.getAllByText(OVERALL)).toHaveLength(1);
      expect(screen.queryByText('Feedback History')).toBeNull();
    },
  );

  it('hides Feedback History when a ready CURIE review has a projected version of the same comment', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => readyCurieSubmission('approved')));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('curie-overall-comment')).toBeTruthy();
    });
    expect(screen.getAllByText(OVERALL)).toHaveLength(1);
    expect(screen.queryByText('Feedback History')).toBeNull();
  });

  it('shows earlier Human feedback while hiding the current CURIE projection duplicate', async () => {
    const submission = readyCurieSubmission('approved') as any;
    getMock.mockResolvedValue({
      ...submission,
      version_number: 4,
      version: 4,
      feedback: {
        ...submission.feedback,
        versions: [
          {
            ...submission.feedback.versions[0],
            version_number: 3,
            submission_version_number: 4,
          },
          {
            version_number: 2,
            submission_version_number: 2,
            source: 'human',
            status: 'rejected',
            created: '2026-09-13T00:00:00Z',
            comment: '<p>Please revise the evidence.</p>',
            rubrics: [],
          },
        ],
      },
    });
    renderDetail();

    expect(await screen.findByText('Feedback History')).toBeTruthy();
    expect(screen.getByText('Please revise the evidence.')).toBeTruthy();
    expect(screen.getAllByText(OVERALL)).toHaveLength(1);
  });

  it('does not POST when the instructor cancels the override confirm', async () => {
    window.confirm = jest.fn(() => false);
    getMock.mockImplementation(() => Promise.resolve().then(() => readyCurieSubmission('approved')));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_OVERRIDE_CONFIRM);
    expect(submitMock).not.toHaveBeenCalled();
  });

  it.each(['approved', 'rejected'] as const)(
    'POSTs human feedback after confirming override on a %s CURIE review',
    async (status) => {
      getMock.mockImplementation(() => Promise.resolve().then(() => readyCurieSubmission(status)));
      renderDetail();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeTruthy();
      });
      await userEvent.click(screen.getByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION }));
      const actionLabel = status === 'approved' ? 'Approve' : 'Reattempt';
      await userEvent.click(screen.getByRole('button', { name: actionLabel }));
      expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_OVERRIDE_CONFIRM);
      await waitFor(() => {
        expect(submitMock).toHaveBeenCalledWith('7', expect.objectContaining({
          status,
        }));
      });
    },
  );

  it('shows CURIE Ready output with approval actions and no manual grading form', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => awaitingSubmission()));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('curie-awaiting-approval')).toBeTruthy();
    });
    expect(screen.getByText('CURIE Awaiting Approval')).toBeTruthy();
    expect(screen.getByText('Under Review')).toBeTruthy();
    expect(screen.getByText('Source: CURIE')).toBeTruthy();
    expect(screen.getByTestId('curie-overall-comment').textContent).toBe(awaitingReview.overall_feedback);
    expect(screen.getByText('CURIE goal comment.')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByTestId('curie-gate-summary')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Approve CURIE Feedback' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit & Approve' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('approves unchanged only after confirmation', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => awaitingSubmission()));
    approveMock.mockResolvedValue({ outcome: 'approved' });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve CURIE Feedback' })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Approve CURIE Feedback' }));
    expect(approveMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/Release CURIE’s feedback to the student exactly as shown/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(approveMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Approve CURIE Feedback' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith('7', {
        action: 'approve',
        submission_version_number: 2,
        trigger_id: 'trigger-1',
      });
    });
    expect(approveMock).toHaveBeenCalledTimes(1);
  });

  it('edits scores, comments, and overall feedback before approving as Human', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => awaitingSubmission()));
    approveMock.mockResolvedValue({ outcome: 'approved' });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit & Approve' })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit & Approve' }));
    expect(screen.getByTestId('curie-approval-editor')).toBeTruthy();

    const overall = screen.getByLabelText('Overall feedback');
    await userEvent.clear(overall);
    await userEvent.type(overall, 'Edited overall.');
    const comment = screen.getByLabelText('Comment');
    await userEvent.clear(comment);
    await userEvent.type(comment, 'Edited goal comment.');
    const goalTask = document.getElementById('curie-edit-goal-Task Relevance') as HTMLInputElement;
    await userEvent.clear(goalTask);
    await userEvent.type(goalTask, '4');

    await userEvent.click(screen.getByRole('button', { name: 'Approve edited feedback' }));
    expect(await screen.findByText(/feedback source will be recorded as Human/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledTimes(1);
    });
    const [, payload] = approveMock.mock.calls[0];
    expect(payload).toMatchObject({
      action: 'override',
      submission_version_number: 2,
      trigger_id: 'trigger-1',
      overall_feedback: 'Edited overall.',
      gate_criterion_scores: scores(9, 8, 9),
    });
    expect(payload.field_feedback).toEqual([{
      field_id: 'goal',
      comment: 'Edited goal comment.',
      criterion_scores: scores(4, 8, 9),
    }]);
  });

  it('blocks Edit & Approve with invalid scores', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => awaitingSubmission()));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit & Approve' })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit & Approve' }));
    const gateTask = document.getElementById('curie-edit-gate-Task Relevance') as HTMLInputElement;
    await userEvent.clear(gateTask);
    await userEvent.type(gateTask, '11');
    await userEvent.click(screen.getByRole('button', { name: 'Approve edited feedback' }));
    expect(screen.getByText(/Fix the highlighted fields/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('shows approval info and no further approval actions once approved', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      status: 'approved',
      version: 2,
      feedback: {
        source: 'human', status: 'approved', comment: 'Edited overall.', rubrics: [], versions: [],
      },
      curie_review: {
        ...awaitingReview,
        status: 'approved',
        awaiting_approval: false,
        approval: {
          approved_by: 'staff_user',
          approved_at: '2026-11-16T10:00:00Z',
          approval_modified: true,
          published_source: 'human',
          verdict: 'accepted',
          overall_feedback: 'Edited overall.',
          field_feedback: [{
            field_id: 'goal', comment: 'Edited goal comment.', weight: 1, field_score: 7,
          }],
          gate_score: 7,
          criterion_wise_scores: { 'Task Relevance': 7 },
          star_rating: 4,
        },
      },
    })));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('curie-approval-info')).toBeTruthy();
    });
    expect(screen.getByTestId('curie-approval-info').textContent).toMatch(/Approved by staff_user/);
    expect(screen.getByTestId('curie-approval-info').textContent).toMatch(/source: Human/);
    expect(screen.getByText('CURIE Approved')).toBeTruthy();
    expect(screen.getByText('Source: Human')).toBeTruthy();
    expect(screen.getByTestId('curie-overall-comment').textContent).toBe('Edited overall.');
    expect(screen.getByText('Edited goal comment.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve CURIE Feedback' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit & Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeNull();
  });

  it('attributes human ownership and does not present CURIE as the current review', async () => {
    getMock.mockImplementation(() => Promise.resolve().then(() => baseSubmission({
      status: 'rejected',
      feedback: {
        source: 'human',
        status: 'rejected',
        comment: '<p>Instructor override</p>',
        rubrics: [],
        versions: [{
          version_number: 1,
          status: 'rejected',
          created: '2026-09-13T00:00:01Z',
          comment: '<p>Instructor override</p>',
          rubrics: [],
        }],
      },
      curie_review: readyReview,
    })));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/source: Human/)).toBeTruthy();
    });
    expect(screen.getByText('Source: Human')).toBeTruthy();
    expect(screen.queryByTestId('curie-staff-output')).toBeNull();
    expect(screen.queryByRole('button', { name: INSTRUCTOR_OVERRIDE_ACTION })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByText('Feedback History')).toBeTruthy();
  });
});
