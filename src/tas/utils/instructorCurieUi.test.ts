import {
  INSTRUCTOR_FAILED_RECOVERY_COPY,
  INSTRUCTOR_HUMAN_OWNS_COPY,
  INSTRUCTOR_OVERRIDE_CONFIRM,
  canWithdrawQueueRow,
  presentInstructorCurie,
  queueCurieStatusLabel,
  queueSourceLabel,
} from './instructorCurieUi';

describe('instructor CURIE presentation', () => {
  it('locks the grading form only while a submitted review is pending', () => {
    const pending = presentInstructorCurie({
      submissionStatus: 'submitted',
      feedbackSource: null,
      curieReview: {
        status: 'pending_evaluation',
        instructor_form_locked: true,
      },
    });
    expect(pending.formLocked).toBe(true);
    expect(pending.showFailedRecovery).toBe(false);
    expect(pending.showReadyOutput).toBe(false);
    expect(pending.canOverride).toBe(false);

    const unlocked = presentInstructorCurie({
      submissionStatus: 'submitted',
      feedbackSource: null,
      curieReview: {
        status: 'failed',
        instructor_form_locked: false,
        error_detail: 'timeout',
      },
    });
    expect(unlocked.formLocked).toBe(false);
    expect(unlocked.showFailedRecovery).toBe(true);
    expect(unlocked.canOverride).toBe(false);
    expect(INSTRUCTOR_FAILED_RECOVERY_COPY).toMatch(/grade this attempt/);
  });

  it('offers override only for finalized CURIE-owned ready reviews', () => {
    const submittedReady = presentInstructorCurie({
      submissionStatus: 'submitted',
      feedbackSource: 'curie',
      curieReview: {
        status: 'ready',
        instructor_form_locked: true,
        overall_feedback: 'Looks good.',
      },
    });
    expect(submittedReady.formLocked).toBe(false);
    expect(submittedReady.showReadyOutput).toBe(true);
    expect(submittedReady.canOverride).toBe(false);
    expect(submittedReady.requireOverrideConfirm).toBe(false);

    const accepted = presentInstructorCurie({
      submissionStatus: 'approved',
      feedbackSource: 'curie',
      curieReview: { status: 'ready', verdict: 'accepted' },
    });
    expect(accepted.canOverride).toBe(true);
    expect(accepted.requireOverrideConfirm).toBe(true);

    const rejected = presentInstructorCurie({
      submissionStatus: 'rejected',
      feedbackSource: 'curie',
      curieReview: { status: 'ready', verdict: 'rejected' },
    });
    expect(rejected.canOverride).toBe(true);
    expect(INSTRUCTOR_OVERRIDE_CONFIRM).toMatch(/source to Human/);
  });

  it('attributes source and keeps human ownership over a ready CURIE row', () => {
    const human = presentInstructorCurie({
      submissionStatus: 'rejected',
      feedbackSource: 'human',
      curieReview: {
        status: 'ready',
        verdict: 'accepted',
        overall_feedback: 'CURIE would have accepted this.',
        instructor_form_locked: false,
      },
    });
    expect(human.humanOwns).toBe(true);
    expect(human.sourceLabel).toBe('Human');
    expect(human.showReadyOutput).toBe(false);
    expect(human.canOverride).toBe(false);
    expect(human.requireOverrideConfirm).toBe(false);
    expect(human.formLocked).toBe(false);
    expect(INSTRUCTOR_HUMAN_OWNS_COPY).toMatch(/cannot reclaim/);

    const curieOwned = presentInstructorCurie({
      submissionStatus: 'approved',
      feedbackSource: 'curie',
      curieReview: {
        status: 'ready',
        verdict: 'accepted',
        overall_feedback: 'Accepted.',
      },
    });
    expect(curieOwned.sourceLabel).toBe('CURIE');
    expect(curieOwned.showReadyOutput).toBe(true);
    expect(curieOwned.humanOwns).toBe(false);
  });

  it('labels queue status and source without inventing values', () => {
    expect(queueCurieStatusLabel('pending_evaluation')).toBe('Pending');
    expect(queueCurieStatusLabel('ready')).toBe('Ready');
    expect(queueCurieStatusLabel('failed')).toBe('Failed');
    expect(queueCurieStatusLabel(null)).toBe('—');
    expect(queueSourceLabel('curie')).toBe('CURIE');
    expect(queueSourceLabel('human')).toBe('Human');
    expect(queueSourceLabel(null)).toBe('—');
  });

  it('allows withdrawal only for finalized human feedback', () => {
    expect(canWithdrawQueueRow({
      feedback_status: 'approved',
      feedback_source: 'curie',
    })).toBe(false);
    expect(canWithdrawQueueRow({
      feedback_status: 'rejected',
      feedback_source: 'curie',
    })).toBe(false);
    expect(canWithdrawQueueRow({
      feedback_status: 'approved',
      feedback_source: 'human',
    })).toBe(true);
    expect(canWithdrawQueueRow({
      feedback_status: 'rejected',
      feedback_source: 'human',
    })).toBe(true);
    expect(canWithdrawQueueRow({
      feedback_status: 'pending',
      feedback_source: 'human',
    })).toBe(false);
  });
});
