import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminSubmissionsList } from './AdminSubmissionsList';
import { adminSubmissionsApi } from '../../services/api';
import { useTasStore } from '../../store/tasStore';

jest.mock('../../services/api', () => ({
  adminSubmissionsApi: {
    list: jest.fn(),
    getFilterOptions: jest.fn(),
    withdrawFeedback: jest.fn(),
  },
}));

const listMock = adminSubmissionsApi.list as jest.Mock;
const filterMock = adminSubmissionsApi.getFilterOptions as jest.Mock;

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter>
          <AdminSubmissionsList onView={() => undefined} />
        </MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>,
  );
}

describe('AdminSubmissionsList CURIE queue actions', () => {
  beforeEach(() => {
    listMock.mockReset();
    filterMock.mockReset();
    filterMock.mockResolvedValue({
      college_name: [],
      university_name: [],
      partner_organization: [],
    });
    useTasStore.setState({
      mfeContext: {
        usageKey: 'block-v1:demo+demo+demo+type@tas+block@x',
        courseId: 'course-v1:demo+demo+demo',
        studentId: 'instructor',
        isStaff: false,
        isInstructor: true,
      },
    } as any);
  });

  it('hides Withdraw Feedback on CURIE-owned rows and shows it for human-owned rows', async () => {
    listMock.mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      status_counts: { submitted: 0, approved: 2, rejected: 0 },
      results: [
        {
          id: 2,
          username: 'student_curie',
          email: '',
          submission_date: '2026-09-12T18:03:30Z',
          status: 'approved',
          version_number: 2,
          feedback_status: 'approved',
          college_name: '',
          university_name: '',
          partner_organization: '',
          resubmission_count: 1,
          curie_review_status: 'ready',
          feedback_source: 'curie',
          instructor_form_locked: false,
        },
        {
          id: 1,
          username: 'student',
          email: '',
          submission_date: '2026-09-12T08:27:59Z',
          status: 'approved',
          version_number: 3,
          feedback_status: 'approved',
          college_name: '',
          university_name: '',
          partner_organization: '',
          resubmission_count: 1,
          curie_review_status: null,
          feedback_source: 'human',
          instructor_form_locked: false,
        },
      ],
    });

    renderList();
    await waitFor(() => {
      expect(screen.getByText('student_curie')).toBeTruthy();
    });
    expect(screen.getAllByRole('button', { name: 'Withdraw Feedback' })).toHaveLength(1);
    const curieRow = screen.getByText('student_curie').closest('tr');
    const humanRow = screen.getByText('student').closest('tr');
    expect(curieRow?.textContent).not.toMatch(/Withdraw Feedback/);
    expect(humanRow?.textContent).toMatch(/Withdraw Feedback/);
  });
});
