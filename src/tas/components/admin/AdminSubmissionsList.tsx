/**
 * AdminSubmissionsList
 * Shows submissions for a block with toggleable status tabs
 * (Under Review / Accepted / Reattempt). No status selected → all submissions.
 * "Review" only available for submitted ones.
 * "Withdraw Feedback" only for finalized human-owned reviews.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Button, Badge, Spinner, ModalDialog, ActionRow, Form,
} from '@openedx/paragon';
import { Search } from '@openedx/paragon/icons';
import { adminSubmissionsApi } from '../../services/api';
import { useTasStore } from '../../store/tasStore';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatSubmissionStatusLabel } from '../../utils/statusLabels';
import {
  canWithdrawQueueRow,
  queueCurieStatusLabel,
  queueSourceLabel,
} from '../../utils/instructorCurieUi';
import {
  applyStatusTabToSearchParams,
  parseStatus,
  type StatusTabKey,
} from '../../utils/statusTabParams';

interface Props {
  onView: (submissionId: string) => void;
}

/** Shared colour source for Status column badges and status filter tabs (Paragon variants). */
const STATUS_BADGE: Record<string, string> = {
  submitted: 'primary',
  approved: 'success',
  rejected: 'danger',
};

const STATUS_TABS: { key: StatusTabKey; label: string }[] = [
  { key: 'submitted', label: 'Under Review' },
  { key: 'approved', label: 'Accepted' },
  { key: 'rejected', label: 'Reattempt' },
];

const LINK_ACTION_STYLE: React.CSSProperties = {
  fontWeight: 700,
  textDecoration: 'underline',
};

const WITHDRAW_ERROR_FALLBACK = 'Failed to withdraw feedback. Please try again.';

/** URL keys for submission list filters (do not touch course_id / student_id or sort_*). */
const FILTER_PARAM_KEYS = [
  'college',
  'university',
  'partner',
  'email',
  'submitted_after',
  'submitted_before',
] as const;

type SortBy = 'submitted_at' | 'resubmission_count';
type SortDir = 'asc' | 'desc';

const DEFAULT_SORT_BY: SortBy = 'submitted_at';
const DEFAULT_SORT_DIR: SortDir = 'desc';

function parseSortBy(value: string | null): SortBy {
  return value === 'resubmission_count' ? 'resubmission_count' : DEFAULT_SORT_BY;
}

function parseSortDir(value: string | null): SortDir {
  return value === 'asc' ? 'asc' : DEFAULT_SORT_DIR;
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Prefer backend detail/message; include HTTP status when available. */
function formatWithdrawError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } })?.response;
  const status = response?.status;
  const data = response?.data;
  let detail: string | undefined;

  if (data && typeof data === 'object') {
    const body = data as { detail?: unknown; message?: unknown };
    if (typeof body.detail === 'string' && body.detail.trim()) {
      detail = body.detail.trim();
    } else if (typeof body.message === 'string' && body.message.trim()) {
      detail = body.message.trim();
    }
  } else if (typeof data === 'string' && data.trim()) {
    detail = data.trim().slice(0, 200);
  }

  if (status && detail) {
    return `Withdraw failed (${status}): ${detail}`;
  }
  if (status) {
    return `Withdraw failed (${status}). Please try again.`;
  }
  if (detail) {
    return detail;
  }
  return WITHDRAW_ERROR_FALLBACK;
}

export const AdminSubmissionsList: React.FC<Props> = ({ onView }) => {
  const { mfeContext } = useTasStore();
  const usageKey = mfeContext?.usageKey ?? '';
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [withdrawTarget, setWithdrawTarget] = useState<{ id: string; username: string } | null>(null);

  const collegeFilter = searchParams.get('college') ?? '';
  const universityFilter = searchParams.get('university') ?? '';
  const partnerFilter = searchParams.get('partner') ?? '';
  const emailFilter = searchParams.get('email') ?? '';
  const submittedAfter = searchParams.get('submitted_after') ?? '';
  const submittedBefore = searchParams.get('submitted_before') ?? '';
  const statusFilter = parseStatus(searchParams.get('status'));
  const sortBy = parseSortBy(searchParams.get('sort_by'));
  const sortDir = parseSortDir(searchParams.get('sort_dir'));
  const page = parsePage(searchParams.get('page'));

  const [emailInput, setEmailInput] = useState(emailFilter);
  const debouncedEmail = useDebouncedValue(emailInput, 300);

  const listQueryParams = useMemo(() => ({
    usage_key: usageKey,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(collegeFilter ? { college: collegeFilter } : {}),
    ...(universityFilter ? { university: universityFilter } : {}),
    ...(partnerFilter ? { partner: partnerFilter } : {}),
    ...(debouncedEmail.trim() ? { email: debouncedEmail.trim() } : {}),
    ...(submittedAfter ? { submitted_after: submittedAfter } : {}),
    ...(submittedBefore ? { submitted_before: submittedBefore } : {}),
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    page_size: 24,
  }), [
    usageKey,
    statusFilter,
    collegeFilter,
    universityFilter,
    partnerFilter,
    debouncedEmail,
    submittedAfter,
    submittedBefore,
    sortBy,
    sortDir,
    page,
  ]);

  // Keep local email input aligned when URL email changes (e.g. Clear Filters / back navigation).
  useEffect(() => {
    setEmailInput(emailFilter);
  }, [emailFilter]);

  // Persist debounced email to the URL; reset to page 1 when email filter changes.
  useEffect(() => {
    const current = searchParams.get('email') ?? '';
    if (debouncedEmail === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedEmail) {
      next.set('email', debouncedEmail);
    } else {
      next.delete('email');
    }
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilterParam = (key: typeof FILTER_PARAM_KEYS[number], value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const setStatusTab = (status: StatusTabKey) => {
    setSearchParams(
      applyStatusTabToSearchParams(searchParams, statusFilter, status),
      { replace: true },
    );
  };

  const clearFilters = () => {
    // Clear filter-bar params only — leave status tab and sort unchanged.
    const next = new URLSearchParams(searchParams);
    FILTER_PARAM_KEYS.forEach((key) => next.delete(key));
    next.delete('page');
    setEmailInput('');
    setSearchParams(next, { replace: true });
  };

  const handleSortHeaderClick = (field: SortBy) => {
    const next = new URLSearchParams(searchParams);
    if (sortBy === field) {
      next.set('sort_dir', sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sort_by', field);
      next.set('sort_dir', 'desc');
    }
    next.delete('page');
    // Persist defaults explicitly so refresh restores the active sort.
    if (!next.get('sort_by')) next.set('sort_by', DEFAULT_SORT_BY);
    if (!next.get('sort_dir')) next.set('sort_dir', DEFAULT_SORT_DIR);
    setSearchParams(next, { replace: true });
  };

  const setPageParam = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(nextPage));
    }
    setSearchParams(next, { replace: true });
  };

  const hasActiveFilters = FILTER_PARAM_KEYS.some((key) => {
    if (key === 'email') return !!(emailInput || searchParams.get('email'));
    return !!searchParams.get(key);
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-submissions', listQueryParams],
    queryFn: () => adminSubmissionsApi.list(listQueryParams),
    enabled: !!usageKey,
    refetchOnMount: 'always',
  });

  const { data: filterOptionsData } = useQuery({
    queryKey: ['admin-submissions-filter-options', usageKey],
    queryFn: () => adminSubmissionsApi.getFilterOptions(usageKey),
    enabled: !!usageKey,
    refetchOnMount: 'always',
  });

  const withdrawMut = useMutation({
    mutationFn: (submissionId: string) => adminSubmissionsApi.withdrawFeedback(submissionId),
    onSuccess: (_data, submissionId) => {
      setWithdrawTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-detail', submissionId] });
      onView(submissionId);
    },
    onError: (error) => {
      const response = (error as { response?: { status?: number; data?: unknown } })?.response;
      // eslint-disable-next-line no-console
      console.error('Withdraw feedback failed', {
        status: response?.status,
        body: response?.data,
        error,
      });
    },
  });

  const totalCount = data?.count ?? 0;
  const submissions = totalCount > 0 ? (data?.results ?? []) : [];
  const hasNextPage = !!data?.next;
  const hasPreviousPage = !!data?.previous;
  const isWithdrawing = withdrawMut.isPending;
  const statusCounts = data?.status_counts ?? { submitted: 0, approved: 0, rejected: 0 };
  const activeStatusLabel = statusFilter
    ? formatSubmissionStatusLabel(statusFilter)
    : '';

  const collegeOptions = filterOptionsData?.college_name ?? [];
  const universityOptions = filterOptionsData?.university_name ?? [];
  const partnerOptions = filterOptionsData?.partner_organization ?? [];

  const handleConfirmWithdraw = () => {
    if (!withdrawTarget || isWithdrawing) return;
    withdrawMut.mutate(withdrawTarget.id);
  };

  const countLabel = hasActiveFilters
    ? `${totalCount} matching submission${totalCount !== 1 ? 's' : ''}`
    : `${totalCount} submission${totalCount !== 1 ? 's' : ''}`;

  const renderStatusTabs = () => (
    <div
      className="d-flex align-items-end mb-3"
      style={{ gap: '0.5rem', overflowX: 'auto' }}
      role="tablist"
      aria-label="Submission status"
    >
      {STATUS_TABS.map(({ key, label }) => {
        const isActive = statusFilter === key;
        const variant = STATUS_BADGE[key];
        const count = statusCounts[key] ?? 0;
        return (
          <div
            key={key}
            style={{
              flex: '0 0 auto',
              borderBottom: isActive
                ? '2px solid var(--pgn-color-primary-500)'
                : '2px solid transparent',
              paddingBottom: 2,
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`badge badge-${variant} d-inline-flex align-items-center border-0`}
              onClick={() => setStatusTab(key)}
              style={statusTabStyle}
            >
              <span style={{ fontWeight: 700, color: '#fff' }}>{label}</span>
              <span
                className="d-inline-flex align-items-center justify-content-center"
                style={statusCountPillStyle}
                aria-label={`${count} ${label}`}
              >
                {count}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-bottom">
        <div className="d-flex align-items-start justify-content-between flex-wrap" style={{ gap: '0.75rem' }}>
          <div>
            <h2 className="h5 mb-0">Student Submissions</h2>
            <small className="text-muted">{countLabel}</small>
          </div>

          <div className="d-flex align-items-center flex-wrap" style={{ gap: '0.5rem' }}>
            <Form.Control
              as="select"
              size="sm"
              value={collegeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterParam('college', e.target.value)}
              style={{ width: 160 }}
              aria-label="College Name"
            >
              <option value="">All colleges</option>
              {collegeOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Form.Control>

            <Form.Control
              as="select"
              size="sm"
              value={universityFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterParam('university', e.target.value)}
              style={{ width: 160 }}
              aria-label="University Name"
            >
              <option value="">All universities</option>
              {universityOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Form.Control>

            <Form.Control
              as="select"
              size="sm"
              value={partnerFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterParam('partner', e.target.value)}
              style={{ width: 180 }}
              aria-label="Partner Organization"
            >
              <option value="">All partners</option>
              {partnerOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Form.Control>

            <Form.Control
              leadingElement={<Search />}
              value={emailInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmailInput(e.target.value)}
              placeholder="Email ID…"
              size="sm"
              style={{ width: 180 }}
              aria-label="Email ID"
            />

            <Form.Control
              type="date"
              size="sm"
              value={submittedBefore}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterParam('submitted_before', e.target.value)}
              style={{ width: 150 }}
              aria-label="Submitted to"
            />

            {hasActiveFilters && (
              <Button variant="primary" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow-1 overflow-auto p-4">
        {isLoading && (
          <div className="d-flex justify-content-center pt-5">
            <Spinner animation="border" variant="primary" screenReaderText="Loading submissions" />
          </div>
        )}

        {isError && (
          <div className="alert alert-danger">Failed to load submissions.</div>
        )}

        {!isLoading && !isError && (
          <>
            {renderStatusTabs()}

            {totalCount === 0 && statusFilter !== null && (
              <div className="text-center pt-5 text-muted">
                <p>No {activeStatusLabel} submissions.</p>
              </div>
            )}

            {totalCount === 0 && statusFilter === null && !hasActiveFilters && (
              <div className="text-center pt-5 text-muted">
                <p>No submissions yet for this block.</p>
              </div>
            )}

            {totalCount === 0 && statusFilter === null && hasActiveFilters && (
              <div className="text-center pt-5 text-muted">
                <p className="mb-2">No submissions match these filters.</p>
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}

            {totalCount > 0 && (
          <div className="bg-white rounded shadow-sm" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f7fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={thStyle}>Student Email</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>CURIE</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => handleSortHeaderClick('submitted_at')}
                      style={sortableThButtonStyle}
                      aria-label="Sort by Submitted At"
                    >
                      Submitted At
                      {sortBy === 'submitted_at' && (
                        <span aria-hidden="true">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                      )}
                    </button>
                  </th>
                  <th style={thStyle}>
                    <button
                      type="button"
                      onClick={() => handleSortHeaderClick('resubmission_count')}
                      style={sortableThButtonStyle}
                      aria-label="Sort by Resubmission Count"
                    >
                      Resubmission Count
                      {sortBy === 'resubmission_count' && (
                        <span aria-hidden="true">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                      )}
                    </button>
                  </th>
                  <th style={{ ...thStyle, width: 260 }}></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub: any, idx: number) => {
                  const canWithdraw = canWithdrawQueueRow(sub);
                  const rowWithdrawing = isWithdrawing && withdrawTarget?.id === String(sub.id);

                  return (
                    <tr
                      key={sub.id}
                      style={{
                        borderBottom: '1px solid #dee2e6',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      }}
                    >
                      <td style={tdStyle}>
                        <span className="font-weight-bold">{sub.username}</span>
                      </td>
                      <td style={tdStyle}>
                        <Badge variant={STATUS_BADGE[sub.status] ?? 'secondary'}>
                          {formatSubmissionStatusLabel(sub.status)}
                        </Badge>
                      </td>
                      <td style={tdStyle}>
                        <span className="small">{queueCurieStatusLabel(sub.curie_review_status)}</span>
                        {sub.instructor_form_locked && (
                          <div className="small text-muted">Locked</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span className="small">{queueSourceLabel(sub.feedback_source)}</span>
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                        {sub.submission_date
                          ? new Date(sub.submission_date).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: '#6b7280', fontSize: '0.85rem' }}>
                        {sub.resubmission_count ?? 0}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div className="d-flex justify-content-end" style={{ gap: '0.5rem' }}>
                          {canWithdraw && (
                            <Button
                              variant="tertiary"
                              size="sm"
                              style={{ ...LINK_ACTION_STYLE, color: '#dc3545' }}
                              disabled={isWithdrawing}
                              onClick={() => setWithdrawTarget({
                                id: String(sub.id),
                                username: sub.username ?? 'this student',
                              })}
                            >
                              {rowWithdrawing ? (
                                <Spinner animation="border" size="sm" screenReaderText="Withdrawing" />
                              ) : (
                                'Withdraw Feedback'
                              )}
                            </Button>
                          )}
                          {sub.status === 'submitted' ? (
                            <Button
                              variant="brand"
                              size="sm"
                              onClick={() => onView(String(sub.id))}
                              disabled={isWithdrawing}
                            >
                              Review
                            </Button>
                          ) : (
                            <Button
                              variant="tertiary"
                              size="sm"
                              style={LINK_ACTION_STYLE}
                              onClick={() => onView(String(sub.id))}
                              disabled={isWithdrawing}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {(hasPreviousPage || hasNextPage) && (
              <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top">
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={!hasPreviousPage}
                  onClick={() => setPageParam(page - 1)}
                >
                  Previous
                </Button>
                <small className="text-muted">Page {page}</small>
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={!hasNextPage}
                  onClick={() => setPageParam(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
            )}
          </>
        )}

        {withdrawMut.isError && (
          <div className="alert alert-danger mt-3">
            {formatWithdrawError(withdrawMut.error)}
          </div>
        )}
      </div>

      <ModalDialog
        title="Withdraw Feedback"
        isOpen={!!withdrawTarget}
        onClose={() => {
          if (!isWithdrawing) setWithdrawTarget(null);
        }}
        size="md"
        hasCloseButton
        isOverflowVisible={false}
        isBlocking={isWithdrawing}
      >
        <ModalDialog.Header>
          <ModalDialog.Title>Withdraw Feedback</ModalDialog.Title>
        </ModalDialog.Header>
        <ModalDialog.Body>
          <p className="mb-0">
            Withdraw feedback for{' '}
            <strong>{withdrawTarget?.username ?? 'this student'}</strong>
            ? This will reopen the grading form with the previous scores and comments so you can
            correct and resubmit. The student will not see the previous review until you submit again.
          </p>
        </ModalDialog.Body>
        <ModalDialog.Footer>
          <ActionRow>
            <ModalDialog.CloseButton variant="tertiary" disabled={isWithdrawing}>
              Cancel
            </ModalDialog.CloseButton>
            <Button
              variant="danger"
              onClick={handleConfirmWithdraw}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? (
                <Spinner animation="border" size="sm" screenReaderText="Withdrawing" />
              ) : (
                'Withdraw Feedback'
              )}
            </Button>
          </ActionRow>
        </ModalDialog.Footer>
      </ModalDialog>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  whiteSpace: 'nowrap',
};

const sortableThButtonStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  cursor: 'pointer',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  verticalAlign: 'middle',
};

const statusTabStyle: React.CSSProperties = {
  gap: '0.5rem',
  padding: '0.45rem 0.75rem',
  fontSize: '0.875rem',
  lineHeight: 1.2,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
};

const statusCountPillStyle: React.CSSProperties = {
  minWidth: '1.35rem',
  height: '1.35rem',
  padding: '0 0.35rem',
  borderRadius: '999px',
  background: 'rgba(0, 0, 0, 0.22)',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 700,
  lineHeight: 1,
};
