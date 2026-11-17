import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { CurieReviewScreen } from './CurieReviewScreen';
import type { LearnerCurieReview, Template } from '../types';

jest.mock('./TemplateCanvas', () => ({
  TemplateCanvas: ({
    overlay,
    fitToPane,
    formDataOverride,
  }: {
    overlay?: React.ReactNode;
    fitToPane?: boolean;
    formDataOverride?: Record<string, string>;
  }) => (
    <div
      data-fit-pane={fitToPane ? 'true' : 'false'}
      data-form-data={JSON.stringify(formDataOverride ?? {})}
    >
      worksheet-canvas
      {overlay}
    </div>
  ),
}));

const template: Template = {
  id: '1',
  template_type_id: '1',
  name: 'Personal SWOT',
  description: '',
  image_url: '',
  image_width: 794,
  image_height: 1123,
  thumbnail_url: '',
  fields: [
    {
      id: 'goal', label: 'Goal', type: 'textarea', required: true,
    },
    {
      id: 'contribution', label: 'Contribution', type: 'textarea', required: false,
    },
  ],
  field_positions: {
    goal: {
      x: 10, y: 10, width: 80, height: 10,
    },
    contribution: {
      x: 10, y: 70, width: 80, height: 10,
    },
  },
  is_public: true,
  is_active: true,
  created_by: '',
  created_at: '',
  updated_at: '',
};

const readyReview: LearnerCurieReview = {
  status: 'ready',
  verdict: 'rejected',
  overall_feedback: 'Make the goal more specific.',
  field_feedback: [
    {
      field_id: 'goal',
      weight: 1,
      comment: 'Too vague.',
      color: 'needs_revision',
    },
    {
      field_id: 'contribution',
      weight: 0,
      comment: 'Keep reflecting.',
      color: null,
    },
  ],
  star_rating: 2,
  is_slow_pending: false,
  submission_version_number: 2,
  error_detail: '',
  requested_at: null,
  completed_at: null,
};

function renderScreen(overrides: Partial<React.ComponentProps<typeof CurieReviewScreen>> = {}) {
  return render(
    <IntlProvider locale="en" messages={{}}>
      <MemoryRouter>
        <CurieReviewScreen
          template={template}
          displayState="curie_rejected"
          review={readyReview}
          title="Personal SWOT"
          usageKey="block-usage"
          formData={{ goal: 'Get better', contribution: 'Help others' }}
          atMaxAttempts={false}
          canReattempt
          isSlowPending={false}
          isSaving={false}
          isMobile={false}
          onBack={() => undefined}
          onRequestSubmit={() => undefined}
          {...overrides}
        />
      </MemoryRouter>
    </IntlProvider>,
  );
}

async function openEditForm() {
  await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
}

describe('CurieReviewScreen', () => {
  it('asks the worksheet canvas to fit its desktop pane', () => {
    renderScreen();
    expect(screen.getByText('worksheet-canvas').getAttribute('data-fit-pane')).toBe('true');
  });

  it('shows pending copy and no edit action while CURIE is evaluating', () => {
    renderScreen({
      displayState: 'pending',
      review: {
        ...readyReview, status: 'pending_evaluation', verdict: null, field_feedback: [],
      },
      canReattempt: false,
    });
    expect(screen.getByText(/Curie is reviewing your submission/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Assignment' })).toBeNull();
  });

  it('shows awaiting-instructor copy without any scores, comments, or reattempt', () => {
    renderScreen({
      displayState: 'awaiting_approval',
      review: {
        ...readyReview,
        status: 'ready_for_approval',
        verdict: null,
        overall_feedback: '',
        field_feedback: [],
        star_rating: null,
      },
      canReattempt: false,
    });
    expect(screen.getByText('Awaiting Instructor Review')).toBeTruthy();
    expect(screen.getByText(/CURIE has completed its review\. Your instructor is checking the feedback/)).toBeTruthy();
    expect(screen.getByText(/This page will update automatically once your feedback is approved\./)).toBeTruthy();
    expect(screen.queryByText('Overall Feedback')).toBeNull();
    expect(screen.queryByText('Rejected')).toBeNull();
    expect(screen.queryByText('Accepted')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Assignment' })).toBeNull();
  });

  it('does not render CURIE content during awaiting approval even if a review object leaks through', () => {
    renderScreen({
      displayState: 'awaiting_approval',
      review: { ...readyReview, status: 'ready_for_approval' },
      canReattempt: true,
    });
    expect(screen.queryByText('Make the goal more specific.')).toBeNull();
    expect(screen.queryByText('Too vague.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Assignment' })).toBeNull();
  });

  it.each([
    [{ feedback_source: 'curie' as const, approval_modified: false }, 'Reviewed and approved by your instructor.'],
    [{ feedback_source: 'human' as const, approval_modified: true }, 'Reviewed and updated by your instructor.'],
  ])('shows approved feedback with its release note (%o)', (extra, note) => {
    renderScreen({
      displayState: 'curie_rejected',
      review: { ...readyReview, status: 'approved', ...extra },
    });
    expect(screen.getByText(note)).toBeTruthy();
    expect(screen.getByText('Make the goal more specific.')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Assignment' })).toBeTruthy();
  });

  it('softens pending copy when the review is slow', () => {
    renderScreen({
      displayState: 'pending',
      isSlowPending: true,
      review: {
        ...readyReview, status: 'pending_evaluation', verdict: null, field_feedback: [],
      },
      canReattempt: false,
    });
    expect(screen.getByText(/taking longer than usual/)).toBeTruthy();
  });

  it('shows live-failure copy and one edit action', () => {
    renderScreen({
      displayState: 'live_failed',
      review: {
        ...readyReview, status: 'failed', verdict: null, field_feedback: [],
      },
    });
    expect(screen.getByText(/wasn't able to complete a review/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Edit Assignment' })).toHaveLength(1);
  });

  it('never renders diagnostic error detail for a historical failure', () => {
    renderScreen({
      displayState: 'live_failed',
      historical: true,
      canReattempt: false,
      review: {
        ...readyReview,
        status: 'failed',
        verdict: null,
        field_feedback: [],
        error_detail: 'HTTP 503 from internal-curie-host.example',
      },
    });
    expect(screen.getByText('CURIE did not complete a review for this attempt.')).toBeTruthy();
    expect(screen.queryByText(/HTTP 503/)).toBeNull();
  });

  it('renders accepted review without edit and with stars', () => {
    renderScreen({
      displayState: 'curie_accepted',
      canReattempt: false,
      review: { ...readyReview, verdict: 'accepted', star_rating: 4 },
    });
    expect(screen.getByText('Accepted')).toBeTruthy();
    expect(screen.getByLabelText('4 out of 5 stars')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Assignment' })).toBeNull();
    expect(screen.getByText('Make the goal more specific.')).toBeTruthy();
  });

  it('omits colour badges on unweighted fields and omits stars when field feedback is empty', () => {
    const { unmount } = renderScreen();
    expect(screen.getByText('Needs revision')).toBeTruthy();
    expect(screen.getByText('Keep reflecting.')).toBeTruthy();
    unmount();

    renderScreen({
      review: {
        ...readyReview, field_feedback: [], star_rating: null, overall_feedback: 'Gate failed.',
      },
    });
    expect(screen.getByText('Gate failed.')).toBeTruthy();
    expect(screen.queryByLabelText(/out of 5 stars/)).toBeNull();
    expect(screen.queryByText('Field-by-Field Feedback')).toBeNull();
  });

  it('shows a styled edit confirmation and cancels without opening the form', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    expect(screen.getByText(/revise your answers and resubmit/i)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Goal')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Assignment' })).toBeTruthy();
  });

  it('opens the inline edit form and submits through the existing handler', async () => {
    const onRequestSubmit = jest.fn();
    renderScreen({ onRequestSubmit });
    expect(screen.getAllByRole('button', { name: 'Edit Assignment' })).toHaveLength(1);
    await openEditForm();
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    expect(screen.getByLabelText('Goal')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Goal'));
    await userEvent.type(screen.getByLabelText('Goal'), 'A sharper STEM goal');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRequestSubmit).toHaveBeenCalledWith(expect.objectContaining({
      goal: 'A sharper STEM goal',
    }));
  });

  it('disables Submit until required fields are filled again', async () => {
    renderScreen();
    await openEditForm();
    const submit = () => screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement;
    expect(submit().disabled).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    await userEvent.clear(screen.getByLabelText('Goal'));
    expect(submit().disabled).toBe(true);

    await userEvent.type(screen.getByLabelText('Goal'), 'Restored goal');
    expect(submit().disabled).toBe(false);
  });

  it('shows the overview of saved answers and edits one section at a time', async () => {
    const onRequestSubmit = jest.fn();
    renderScreen({ onRequestSubmit });
    await openEditForm();
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Get better')).toBeTruthy();
    expect(screen.getByText('Help others')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Contribution →' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Contribution' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Contribution' })).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Contribution'));
    await userEvent.type(screen.getByLabelText('Contribution'), 'Mentor juniors');

    await userEvent.click(screen.getByRole('button', { name: '← Back to answers' }));
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Get better')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('Get better');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRequestSubmit).toHaveBeenCalledWith({ goal: 'Get better', contribution: 'Mentor juniors' });
  });

  it('replaces edit with the cap message', () => {
    renderScreen({ atMaxAttempts: true, canReattempt: false });
    const edit = screen.getByRole('button', { name: 'Edit Assignment' });
    expect((edit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/used all 10 submission attempts/)).toBeTruthy();
  });

  it('exposes Worksheet and Review tabs', () => {
    renderScreen();
    expect(screen.getByRole('tab', { name: 'Worksheet' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Review' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Chat/ })).toBeNull();
  });

  it('locks the worksheet when a rejected reattempt becomes pending', async () => {
    const view = renderScreen();
    await openEditForm();
    expect(screen.getByText('Earlier answers')).toBeTruthy();

    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter>
          <CurieReviewScreen
            template={template}
            displayState="pending"
            review={{
              ...readyReview,
              status: 'pending_evaluation',
              verdict: null,
              field_feedback: [],
              submission_version_number: 3,
            }}
            title="Personal SWOT"
            usageKey="block-usage"
            formData={{ goal: 'Get better', contribution: 'Help others' }}
            atMaxAttempts={false}
            canReattempt={false}
            isSlowPending={false}
            isSaving={false}
            isMobile={false}
            onBack={() => undefined}
            onRequestSubmit={() => undefined}
          />
        </MemoryRouter>
      </IntlProvider>,
    );

    expect(screen.queryByText('Earlier answers')).toBeNull();
    expect(screen.getByText(/Curie is reviewing your submission/)).toBeTruthy();
  });

  it('locks the worksheet when a live-failed reattempt becomes pending', async () => {
    const view = renderScreen({
      displayState: 'live_failed',
      review: {
        ...readyReview, status: 'failed', verdict: null, field_feedback: [],
      },
    });
    await openEditForm();
    expect(screen.getByText('Earlier answers')).toBeTruthy();

    view.rerender(
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter>
          <CurieReviewScreen
            template={template}
            displayState="pending"
            review={{
              ...readyReview,
              status: 'pending_evaluation',
              verdict: null,
              field_feedback: [],
              submission_version_number: 4,
            }}
            title="Personal SWOT"
            usageKey="block-usage"
            formData={{ goal: 'Get better', contribution: 'Help others' }}
            atMaxAttempts={false}
            canReattempt={false}
            isSlowPending={false}
            isSaving={false}
            isMobile={false}
            onBack={() => undefined}
            onRequestSubmit={() => undefined}
          />
        </MemoryRouter>
      </IntlProvider>,
    );

    expect(screen.queryByText('Earlier answers')).toBeNull();
    expect(screen.getByText(/Curie is reviewing your submission/)).toBeTruthy();
  });

  it('enforces field capacity on the inline reattempt form', async () => {
    renderScreen({
      template: {
        ...template,
        image_width: 40,
        image_height: 40,
        field_positions: {
          goal: {
            x: 0, y: 0, width: 8, height: 6,
          },
          contribution: {
            x: 0, y: 20, width: 8, height: 6,
          },
        },
      },
    });
    await openEditForm();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    const goal = screen.getByLabelText('Goal') as HTMLTextAreaElement;
    await userEvent.clear(goal);
    await userEvent.type(goal, 'x'.repeat(40));
    expect(goal.value.length).toBeLessThan(40);
    expect(screen.getByText(/maximum capacity/)).toBeTruthy();
  });

  it('scrolls to matching feedback after switching to Review on mobile', async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderScreen({ isMobile: true });
    await userEvent.click(screen.getByRole('button', { name: 'Field 1: Goal' }));
    expect(screen.getByRole('tab', { name: 'Review' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('previews unsaved edits and preserves them when returning to edit', async () => {
    const onRequestSubmit = jest.fn();
    renderScreen({ onRequestSubmit });
    await openEditForm();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    await userEvent.clear(screen.getByLabelText('Goal'));
    await userEvent.type(screen.getByLabelText('Goal'), 'A sharper STEM goal');

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const canvas = screen.getByText('worksheet-canvas');
    expect(canvas.getAttribute('data-form-data')).toContain('A sharper STEM goal');
    expect(screen.queryByRole('button', { name: 'Field 1: Goal' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Goal' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('A sharper STEM goal');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRequestSubmit).toHaveBeenCalledWith(expect.objectContaining({
      goal: 'A sharper STEM goal',
    }));
  });

  it('clears only the local edit draft after confirmation', async () => {
    renderScreen();
    await openEditForm();
    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(screen.getByText(/previous submitted attempt will not be changed/)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear All' }).at(-1)!);
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getAllByText('Not answered yet').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Edit Contribution' }));
    expect((screen.getByLabelText('Contribution') as HTMLTextAreaElement).value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await openEditForm();
    expect(screen.getByText('Get better')).toBeTruthy();
  });
});
