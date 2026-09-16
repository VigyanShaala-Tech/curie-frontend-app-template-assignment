import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SubmissionHistoryPage } from './SubmissionHistoryPage';
import { HistoricalReviewPage } from './HistoricalReviewPage';

jest.mock('@edx/frontend-platform/auth', () => ({
  getAuthenticatedUser: () => ({ username: 'student' }),
}));

jest.mock('./TemplateCanvas', () => ({
  TemplateCanvas: () => <div>worksheet-canvas</div>,
}));

jest.mock('../services/ownedSubmission', () => ({
  loadOwnedSubmission: jest.fn(),
  loadAssignedTemplate: jest.fn(),
}));

jest.mock('../services/api', () => ({
  submissionsApi: {
    getVersions: jest.fn(),
    getCurieReview: jest.fn(),
  },
}));

const { loadOwnedSubmission, loadAssignedTemplate } = jest.requireMock('../services/ownedSubmission');
const { submissionsApi } = jest.requireMock('../services/api');

const usageKey = 'block-v1:VigyanShaala+STEM101+2026_T3+type@tas+block@demo';

describe('reload-safe history routes', () => {
  beforeEach(() => {
    loadOwnedSubmission.mockClear();
    loadAssignedTemplate.mockClear();
    submissionsApi.getVersions.mockClear();
    submissionsApi.getCurieReview.mockClear();
    loadOwnedSubmission.mockResolvedValue({
      id: '9',
      status: 'approved',
      usage_key: usageKey,
    });
    loadAssignedTemplate.mockResolvedValue({
      id: '1',
      name: 'Personal SWOT',
      fields: [{ id: 'goal', label: 'Goal', type: 'textarea', required: true }],
      field_positions: { goal: { x: 10, y: 10, width: 80, height: 10 } },
      image_url: '',
      image_width: 794,
      image_height: 1123,
    });
    submissionsApi.getVersions.mockResolvedValue({
      submission_id: '9',
      versions: [{
        version_number: 4,
        attempt_number: 1,
        submitted_at: '2026-09-13T00:00:00Z',
        feedback_available: true,
        feedback_unavailable_reason: null,
        feedback_status: 'approved',
        instructor_comment: '',
        pdf_url: null,
        download_url: null,
        curie_review_status: 'ready',
        feedback_source: 'curie',
        verdict: 'accepted',
        star_rating: 4,
      }],
    });
    submissionsApi.getCurieReview.mockResolvedValue({
      status: 'ready',
      verdict: 'accepted',
      overall_feedback: 'Strong SWOT.',
      field_feedback: [],
      star_rating: 4,
      is_slow_pending: false,
      submission_version_number: 4,
      error_detail: '',
      requested_at: null,
      completed_at: null,
    });
  });

  it('bootstraps versions from the usageKey history URL', async () => {
    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history`]}>
        <Routes>
          <Route path="/submission/:usageKey/history" element={<SubmissionHistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(loadOwnedSubmission).toHaveBeenCalled();
      expect(submissionsApi.getVersions).toHaveBeenCalledWith('9');
    });
    expect(await screen.findByText('Submission History')).toBeTruthy();
    expect(await screen.findByText('Attempt 1')).toBeTruthy();
    expect(await screen.findByText('View Detailed Feedback')).toBeTruthy();
  });

  it('bootstraps a versioned review from the historical-review URL', async () => {
    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history/4`]}>
        <Routes>
          <Route path="/submission/:usageKey/history/:version" element={<HistoricalReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(submissionsApi.getCurieReview).toHaveBeenCalledWith('9', 4);
    });
    expect(await screen.findByText(/Strong SWOT/)).toBeTruthy();
  });

  it('renders legacy human historical feedback when the CURIE review is absent', async () => {
    submissionsApi.getVersions.mockResolvedValue({
      submission_id: '9',
      versions: [{
        version_number: 3,
        attempt_number: 1,
        submitted_at: '2026-09-13T00:00:00Z',
        feedback_available: true,
        feedback_unavailable_reason: null,
        feedback_status: 'approved',
        instructor_comment: 'Graded by the instructor.',
        pdf_url: null,
        download_url: null,
        curie_review_status: null,
        feedback_source: 'human',
        verdict: null,
        star_rating: null,
      }],
    });
    const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
    submissionsApi.getCurieReview.mockRejectedValue(notFound);

    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history/3`]}>
        <Routes>
          <Route path="/submission/:usageKey/history/:version" element={<HistoricalReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Graded by the instructor/)).toBeTruthy();
    expect(submissionsApi.getCurieReview).not.toHaveBeenCalled();
  });

  it('falls back to human historical feedback when the CURIE review endpoint returns 404', async () => {
    submissionsApi.getVersions.mockResolvedValue({
      submission_id: '9',
      versions: [{
        version_number: 3,
        attempt_number: 1,
        submitted_at: '2026-09-13T00:00:00Z',
        feedback_available: true,
        feedback_unavailable_reason: null,
        feedback_status: 'rejected',
        instructor_comment: 'Please revise the SWOT.',
        pdf_url: null,
        download_url: null,
        curie_review_status: 'failed',
        feedback_source: 'curie',
        verdict: null,
        star_rating: null,
      }],
    });
    const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
    submissionsApi.getCurieReview.mockRejectedValue(notFound);

    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history/3`]}>
        <Routes>
          <Route path="/submission/:usageKey/history/:version" element={<HistoricalReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Please revise the SWOT/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prefers finalized human override over a successful ready CURIE review', async () => {
    submissionsApi.getVersions.mockResolvedValue({
      submission_id: '9',
      versions: [{
        version_number: 4,
        attempt_number: 1,
        submitted_at: '2026-09-13T00:00:00Z',
        feedback_available: true,
        feedback_unavailable_reason: null,
        feedback_status: 'approved',
        instructor_comment: 'Instructor override.',
        pdf_url: null,
        download_url: null,
        curie_review_status: 'ready',
        feedback_source: 'human',
        verdict: 'accepted',
        star_rating: 4,
      }],
    });
    submissionsApi.getCurieReview.mockResolvedValue({
      status: 'ready',
      verdict: 'accepted',
      overall_feedback: 'Strong SWOT.',
      field_feedback: [],
      star_rating: 4,
      is_slow_pending: false,
      submission_version_number: 4,
      error_detail: '',
      requested_at: null,
      completed_at: null,
    });

    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history/4`]}>
        <Routes>
          <Route path="/submission/:usageKey/history/:version" element={<HistoricalReviewPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Instructor override/)).toBeTruthy();
    expect(screen.queryByText(/Strong SWOT/)).toBeNull();
    expect(submissionsApi.getCurieReview).not.toHaveBeenCalled();
  });

  it('shows the empty history message once', async () => {
    submissionsApi.getVersions.mockResolvedValue({
      submission_id: '9',
      versions: [],
    });
    render(
      <MemoryRouter initialEntries={[`/submission/${encodeURIComponent(usageKey)}/history`]}>
        <Routes>
          <Route path="/submission/:usageKey/history" element={<SubmissionHistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const empties = await screen.findAllByText('No submitted attempts yet.');
    expect(empties).toHaveLength(1);
  });
});
