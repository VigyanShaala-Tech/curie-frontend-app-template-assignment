import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSubmissionDetail } from './AdminSubmissionDetail';
import { adminSubmissionsApi } from '../../services/api';
import { useTasStore } from '../../store/tasStore';
import {
  INSTRUCTOR_OVERRIDE_ACTION,
  INSTRUCTOR_OVERRIDE_CONFIRM,
} from '../../utils/instructorCurieUi';

jest.mock('../../services/api', () => ({
  adminSubmissionsApi: {
    get: jest.fn(),
    getRubrics: jest.fn(),
    submitFeedback: jest.fn(),
  },
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
  }],
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
      rubrics: [{ criterion: 'Task Relevance', selected_option: 'Score: 9', marks: 9, score: 9 }],
      versions: [{
        version_number: 1,
        status,
        created: '2026-09-13T00:00:01Z',
        comment: OVERALL,
        rubrics: [{ criterion: 'Task Relevance', selected_option: 'Score: 9', marks: 9, score: 9 }],
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
      <AdminSubmissionDetail submissionId="7" onBack={() => undefined} />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

describe('AdminSubmissionDetail CURIE instructor UI', () => {
  beforeEach(() => {
    getMock.mockReset();
    rubricsMock.mockReset();
    submitMock.mockReset();
    rubricsMock.mockResolvedValue({ display_name: '', instructions: '', rubrics: [] });
    submitMock.mockResolvedValue(undefined);
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
      const actionLabel = status === 'approved' ? 'Approve' : 'Reject';
      await userEvent.click(screen.getByRole('button', { name: actionLabel }));
      expect(window.confirm).toHaveBeenCalledWith(INSTRUCTOR_OVERRIDE_CONFIRM);
      await waitFor(() => {
        expect(submitMock).toHaveBeenCalledWith('7', expect.objectContaining({
          status,
        }));
      });
    },
  );

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
