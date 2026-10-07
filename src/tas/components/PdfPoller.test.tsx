import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PdfPoller } from './PdfPoller';
import { submissionsApi } from '../services/api';
import { downloadPdf } from '../utils/downloadPdf';
import type { Submission } from '../types';

jest.mock('../utils/downloadPdf', () => ({
  downloadPdf: jest.fn(),
}));

const submission: Submission = {
  id: '42',
  template_block_id: '7',
  student_id: '9',
  course_id: 'course-v1:test',
  usage_key: 'block-v1:test',
  form_data: {},
  status: 'approved',
  version_number: 3,
  submitted_at: '2026-10-07T12:00:00Z',
  pdf_url: '',
  created_at: '2026-10-07T12:00:00Z',
  updated_at: '2026-10-07T12:00:00Z',
};

describe('PdfPoller', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows generation status until the submitted-version PDF is ready', async () => {
    jest.spyOn(submissionsApi, 'getPdf').mockResolvedValue({
      pdf_url: 'https://example.test/submission.pdf',
      status: 'generating',
    });

    render(<PdfPoller submissionOverride={submission} />);

    expect(screen.getByText('Generating PDF…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('PDF ready')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'View PDF' }).getAttribute('href'))
      .toBe('https://example.test/submission.pdf');
  });

  it('downloads the PDF for the displayed submission version', async () => {
    render(
      <PdfPoller
        submissionOverride={{ ...submission, pdf_url: 'https://example.test/submission.pdf' }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: '↓ Download PDF' }));
    expect(downloadPdf).toHaveBeenCalledWith(
      'https://example.test/submission.pdf',
      'submission_v3.pdf',
    );
  });
});
