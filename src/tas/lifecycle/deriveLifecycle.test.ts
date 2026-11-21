import { deriveLifecycle } from './deriveLifecycle';

describe('deriveLifecycle', () => {
  it('preserves legacy draft/locked behavior when no CURIE review exists', () => {
    expect(deriveLifecycle({ submissionStatus: 'draft' })).toMatchObject({
      displayState: 'draft',
      hasCurieReview: false,
      canEdit: true,
      canSubmit: true,
      isCanvasReadOnly: false,
      shouldPoll: false,
    });
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      hasFeedback: false,
    })).toMatchObject({
      displayState: 'legacy',
      canEdit: false,
      canSubmit: false,
      isCanvasReadOnly: true,
      shouldPoll: true,
    });
    expect(deriveLifecycle({
      submissionStatus: 'rejected',
      hasFeedback: true,
    })).toMatchObject({
      displayState: 'legacy',
      useLegacyReopen: true,
      canEdit: false,
      isCanvasReadOnly: true,
    });
  });

  it('locks the canvas while pending and asks the poller to run', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'pending_evaluation',
      isSlowPending: true,
      hasFeedback: true,
    })).toMatchObject({
      displayState: 'pending',
      canEdit: false,
      canSubmit: false,
      shouldPoll: true,
      isSlowPending: true,
      instructorFormLocked: true,
    });
  });

  it('keeps refreshing without a loading state while the instructor reviews', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'ready',
      awaitingInstructorApproval: true,
    })).toMatchObject({
      displayState: 'awaiting_instructor_review',
      canEdit: false,
      canSubmit: false,
      shouldPoll: true,
      isSlowPending: false,
      instructorFormLocked: false,
    });
  });

  it('treats a cold failed load as editable and submittable', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'failed',
      observedPendingInSession: false,
    })).toMatchObject({
      displayState: 'cold_failed',
      canEdit: true,
      canSubmit: true,
      isCanvasReadOnly: false,
      shouldPoll: false,
    });
  });

  it('keeps live failure read-only on the canvas but still submittable', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'failed',
      observedPendingInSession: true,
    })).toMatchObject({
      displayState: 'live_failed',
      canEdit: false,
      canSubmit: true,
      isCanvasReadOnly: true,
    });
  });

  it('does not unlock a capped failed review', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'failed',
      atMaxAttempts: true,
    })).toMatchObject({
      canEdit: false,
      canSubmit: false,
      atMaxAttempts: true,
    });
  });

  it('does not use legacy reopen for a CURIE rejection', () => {
    expect(deriveLifecycle({
      submissionStatus: 'rejected',
      curieReviewStatus: 'ready',
      feedbackSource: 'curie',
    })).toMatchObject({
      displayState: 'curie_rejected',
      useLegacyReopen: false,
      canEdit: false,
      canReattempt: true,
    });
  });

  it('routes human-owned feedback to the legacy panel even if a CURIE row exists', () => {
    expect(deriveLifecycle({
      submissionStatus: 'approved',
      curieReviewStatus: 'failed',
      feedbackSource: 'human',
    })).toMatchObject({
      displayState: 'human_feedback',
      canEdit: false,
      canSubmit: false,
      canWithdraw: true,
      useLegacyReopen: false,
    });
  });

  it('does not classify a human-owned failed submission as a CURIE failure', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'failed',
      feedbackSource: 'human',
      observedPendingInSession: true,
    })).toMatchObject({
      displayState: 'human_feedback',
      canEdit: false,
      canSubmit: false,
      canReattempt: false,
      useLegacyReopen: false,
    });
  });

  it('does not expose reopen for a capped human-rejected submission', () => {
    expect(deriveLifecycle({
      submissionStatus: 'rejected',
      curieReviewStatus: 'ready',
      feedbackSource: 'human',
      atMaxAttempts: true,
    })).toMatchObject({
      displayState: 'human_feedback',
      useLegacyReopen: false,
      canReattempt: false,
      atMaxAttempts: true,
    });
  });

  it('allows a reopened human-rejected draft to submit a new CURIE attempt', () => {
    expect(deriveLifecycle({
      submissionStatus: 'draft',
      curieReviewStatus: 'ready',
      feedbackSource: 'human',
      hasFeedback: true,
    })).toMatchObject({
      displayState: 'draft',
      canEdit: true,
      canSubmit: true,
      canReattempt: false,
      isCanvasReadOnly: false,
    });
  });

  it('holds the learner in awaiting_approval and keeps polling until release', () => {
    expect(deriveLifecycle({
      submissionStatus: 'submitted',
      curieReviewStatus: 'ready_for_approval',
      // A previous attempt's edited approval must not flip this into human ownership.
      feedbackSource: 'human',
      hasFeedback: false,
    })).toMatchObject({
      displayState: 'awaiting_approval',
      hasCurieReview: true,
      canEdit: false,
      canSubmit: false,
      canReattempt: false,
      canWithdraw: false,
      isCanvasReadOnly: true,
      shouldPoll: true,
    });
  });

  it.each([
    ['curie', 'approved', 'curie_accepted', false],
    ['curie', 'rejected', 'curie_rejected', true],
    ['human', 'approved', 'curie_accepted', false],
    ['human', 'rejected', 'curie_rejected', true],
  ] as const)(
    'shows an approved review (source %s, submission %s) as %s',
    (feedbackSource, submissionStatus, displayState, canReattempt) => {
      expect(deriveLifecycle({
        submissionStatus,
        curieReviewStatus: 'approved',
        feedbackSource,
        hasFeedback: true,
      })).toMatchObject({
        displayState,
        canReattempt,
        canWithdraw: false,
        shouldPoll: false,
      });
    },
  );

  it('blocks reattempt on an approved rejection at the attempt cap', () => {
    expect(deriveLifecycle({
      submissionStatus: 'rejected',
      curieReviewStatus: 'approved',
      feedbackSource: 'curie',
      atMaxAttempts: true,
    })).toMatchObject({ displayState: 'curie_rejected', canReattempt: false });
  });
});
