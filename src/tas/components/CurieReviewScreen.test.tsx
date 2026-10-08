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

describe('CurieReviewScreen', () => {
  beforeEach(() => {
    window.confirm = jest.fn(() => true);
  });

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

  it('opens the inline edit form and submits through the existing handler', async () => {
    const onRequestSubmit = jest.fn();
    renderScreen({ onRequestSubmit });
    expect(screen.getAllByRole('button', { name: 'Edit Assignment' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Goal')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Goal'));
    await userEvent.type(screen.getByLabelText('Goal'), 'A sharper STEM goal');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRequestSubmit).toHaveBeenCalledWith(expect.objectContaining({
      goal: 'A sharper STEM goal',
    }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    expect(screen.getByLabelText('Goal')).toBeTruthy();

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

    expect(screen.queryByLabelText('Goal')).toBeNull();
    expect(screen.getByText(/Curie is reviewing your submission/)).toBeTruthy();
  });

  it('locks the worksheet when a live-failed reattempt becomes pending', async () => {
    const view = renderScreen({
      displayState: 'live_failed',
      review: {
        ...readyReview, status: 'failed', verdict: null, field_feedback: [],
      },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    expect(screen.getByLabelText('Goal')).toBeTruthy();

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

    expect(screen.queryByLabelText('Goal')).toBeNull();
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
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    await userEvent.clear(screen.getByLabelText('Goal'));
    await userEvent.type(screen.getByLabelText('Goal'), 'A sharper STEM goal');

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const canvas = screen.getByText('worksheet-canvas');
    expect(canvas.getAttribute('data-form-data')).toContain('A sharper STEM goal');
    expect(screen.queryByRole('button', { name: 'Field 1: Goal' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('A sharper STEM goal');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onRequestSubmit).toHaveBeenCalledWith(expect.objectContaining({
      goal: 'A sharper STEM goal',
    }));
  });

  it('clears only the local edit draft after confirmation', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(screen.getByText(/previous submitted attempt will not be changed/)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear All' }).at(-1)!);
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('');
    expect((screen.getByLabelText('Contribution') as HTMLTextAreaElement).value).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Assignment' }));
    expect((screen.getByLabelText('Goal') as HTMLTextAreaElement).value).toBe('Get better');
  });
});
