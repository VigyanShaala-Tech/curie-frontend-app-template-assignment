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

  it('presents a ready_for_approval review as awaiting approval with CURIE source', () => {
    const awaiting = presentInstructorCurie({
      submissionStatus: 'submitted',
      feedbackSource: 'human',
      curieReview: { status: 'ready_for_approval', verdict: 'accepted', instructor_form_locked: false },
    });
    expect(awaiting.awaitingApproval).toBe(true);
    expect(awaiting.approved).toBe(false);
    expect(awaiting.showReadyOutput).toBe(true);
    expect(awaiting.humanOwns).toBe(false);
    expect(awaiting.formLocked).toBe(false);
    expect(awaiting.canOverride).toBe(false);
    expect(awaiting.reviewStatusLabel).toBe('Awaiting Approval');
    expect(awaiting.sourceLabel).toBe('CURIE');
  });

  it.each([
    ['curie', 'CURIE'],
    ['human', 'Human'],
  ] as const)('presents an approved review released as %s', (publishedSource, label) => {
    const approved = presentInstructorCurie({
      submissionStatus: 'approved',
      feedbackSource: publishedSource,
      curieReview: {
        status: 'approved',
        verdict: 'accepted',
        approval: { published_source: publishedSource, approved_by: 'staff' },
      },
    });
    expect(approved.approved).toBe(true);
    expect(approved.awaitingApproval).toBe(false);
    expect(approved.humanOwns).toBe(false);
    expect(approved.canOverride).toBe(false);
    expect(approved.showReadyOutput).toBe(true);
    expect(approved.reviewStatusLabel).toBe('Approved');
    expect(approved.sourceLabel).toBe(label);
  });

  it('never offers withdrawal on approval-workflow rows', () => {
    expect(canWithdrawQueueRow({
      feedback_status: 'approved',
      feedback_source: 'human',
      curie_review_status: 'approved',
    })).toBe(false);
    expect(canWithdrawQueueRow({
      feedback_status: 'rejected',
      feedback_source: 'human',
      curie_review_status: 'ready_for_approval',
    })).toBe(false);
  });

  it('labels queue status and source without inventing values', () => {
    expect(queueCurieStatusLabel('pending_evaluation')).toBe('Pending');
    expect(queueCurieStatusLabel('ready_for_approval')).toBe('Awaiting Approval');
    expect(queueCurieStatusLabel('approved')).toBe('Approved');
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
