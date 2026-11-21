/**
 * AdminRubricManager
 * Create, edit, and deactivate rubrics.
 *
 * A rubric has:
 *   - name (string)
 *   - criteria: [{ criterion, options: [{ name, marks }], feedbacks?: string[] }]
 *
 * The left panel is a full rubric form (name + dynamic criteria/options).
 * The right panel lists existing rubrics with edit/deactivate actions.
 */

import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Badge, Spinner, Form, Alert,
} from '@openedx/paragon';
import {
  Add, ArrowBack, Close, Edit,
} from '@openedx/paragon/icons';
import { rubricsApi } from '../../services/api';
import type { Rubric, RubricCriterion, RubricOption } from '../../types';
import {
  normalizeFeedbacks,
  serializeFeedbacksForSave,
  splitPastedFeedbacks,
} from '../../utils/rubricFeedbackUtils';
import {
  hasInvalidCategoryMarks,
  validateCategoryMarks,
} from '../../utils/rubricMarksValidation';

interface Props {
  onBack: () => void;
}

const EMPTY_OPTION: RubricOption = { name: '', marks: 0 };
const EMPTY_CRITERION: RubricCriterion = {
  criterion: '',
  options: [{ ...EMPTY_OPTION }],
  feedbacks: [],
};

let rubricRowSeq = 0;

function nextRubricRowKey() {
  rubricRowSeq += 1;
  return `rubric-row-${rubricRowSeq}`;
}

function keysForLength(length: number, existing: string[] = []) {
  return Array.from({ length }, (_, index) => existing[index] ?? nextRubricRowKey());
}

function emptyForm() {
  return {
    name: '',
    criteria: [{
      ...EMPTY_CRITERION,
      options: [{ ...EMPTY_OPTION }],
      feedbacks: [],
    }] as RubricCriterion[],
  };
}

export const AdminRubricManager: React.FC<Props> = ({ onBack }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const criterionKeys = useRef<string[]>([]);
  const optionKeys = useRef<string[][]>([]);
  const feedbackKeys = useRef<string[][]>([]);

  const resetRowKeys = () => {
    criterionKeys.current = [];
    optionKeys.current = [];
    feedbackKeys.current = [];
  };

  const syncRowKeys = (criteria: RubricCriterion[]) => {
    criterionKeys.current = keysForLength(criteria.length, criterionKeys.current);
    optionKeys.current = criteria.map((criterion, index) => keysForLength(
      criterion.options.length,
      optionKeys.current[index],
    ));
    feedbackKeys.current = criteria.map((criterion, index) => keysForLength(
      normalizeFeedbacks(criterion.feedbacks).length,
      feedbackKeys.current[index],
    ));
  };

  const { data, isLoading } = useQuery({
    queryKey: ['rubrics-all'],
    queryFn: () => rubricsApi.list(),
  });

  const saveMut = useMutation({
    mutationFn: (payload: { name: string; criteria: RubricCriterion[] }) => (
      editingId
        ? rubricsApi.update(editingId, payload)
        : rubricsApi.create(payload)
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rubrics-all'] });
      resetRowKeys();
      setForm(emptyForm());
      setEditingId(null);
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => rubricsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rubrics-all'] }),
  });

  // ── Criterion helpers ──────────────────────────────────────────────────────

  const setCriterionName = (ci: number, value: string) => setForm((prev) => {
    const criteria = prev.criteria.map((c, i) => (
      i === ci ? { ...c, criterion: value } : c
    ));
    return { ...prev, criteria };
  });

  const addCriterion = () => setForm((prev) => ({
    ...prev,
    criteria: [...prev.criteria, {
      ...EMPTY_CRITERION,
      options: [{ ...EMPTY_OPTION }],
      feedbacks: [],
    }],
  }));

  const removeCriterion = (ci: number) => {
    criterionKeys.current.splice(ci, 1);
    optionKeys.current.splice(ci, 1);
    feedbackKeys.current.splice(ci, 1);
    setForm((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== ci),
    }));
  };

  // ── Option helpers ────────────────────────────────────────────────────────

  const setOptionField = (
    ci: number,
    oi: number,
    field: keyof RubricOption,
    value: string | number,
  ) => setForm((prev) => {
    const criteria = prev.criteria.map((c, i) => {
      if (i !== ci) {
        return c;
      }
      const options = c.options.map((o, j) => (j === oi ? { ...o, [field]: value } : o));
      return { ...c, options };
    });
    return { ...prev, criteria };
  });

  const addOption = (ci: number) => setForm((prev) => {
    const criteria = prev.criteria.map((c, i) => (
      i === ci ? { ...c, options: [...c.options, { ...EMPTY_OPTION }] } : c
    ));
    return { ...prev, criteria };
  });

  const removeOption = (ci: number, oi: number) => {
    optionKeys.current[ci]?.splice(oi, 1);
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        return { ...c, options: c.options.filter((_, j) => j !== oi) };
      });
      return { ...prev, criteria };
    });
  };

  // ── Feedbacks helpers (category-scoped, independent of options) ─────────

  const setFeedbackText = (ci: number, fi: number, value: string) => setForm((prev) => {
    const criteria = prev.criteria.map((c, i) => {
      if (i !== ci) {
        return c;
      }
      const feedbacks = normalizeFeedbacks(c.feedbacks).map((fb, j) => (j === fi ? value : fb));
      return { ...c, feedbacks };
    });
    return { ...prev, criteria };
  });

  const addFeedback = (ci: number) => setForm((prev) => {
    const criteria = prev.criteria.map((c, i) => {
      if (i !== ci) {
        return c;
      }
      return { ...c, feedbacks: [...normalizeFeedbacks(c.feedbacks), ''] };
    });
    return { ...prev, criteria };
  });

  const removeFeedback = (ci: number, fi: number) => {
    feedbackKeys.current[ci]?.splice(fi, 1);
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        return { ...c, feedbacks: normalizeFeedbacks(c.feedbacks).filter((_, j) => j !== fi) };
      });
      return { ...prev, criteria };
    });
  };

  const handleFeedbackPaste = (ci: number, fi: number, pastedText: string) => {
    if (!/\r|\n/.test(pastedText)) {
      return false;
    }
    const lines = splitPastedFeedbacks(pastedText);
    if (lines.length === 0) {
      return true;
    }
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        const feedbacks = [...normalizeFeedbacks(c.feedbacks)];
        const [firstLine, ...moreLines] = lines;
        const insertedKeys = moreLines.map(() => nextRubricRowKey());
        feedbackKeys.current[ci] = feedbackKeys.current[ci] ?? [];
        feedbackKeys.current[ci].splice(fi + 1, 0, ...insertedKeys);
        feedbacks[fi] = firstLine ?? '';
        feedbacks.splice(fi + 1, 0, ...moreLines);
        return { ...c, feedbacks };
      });
      return { ...prev, criteria };
    });
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Rubric name is required.');
      return;
    }
    for (const [ci, c] of form.criteria.entries()) {
      if (!c.criterion.trim()) {
        setError(`Category ${ci + 1} needs a name.`);
        return;
      }
      if (c.options.length === 0) {
        setError(`Category "${c.criterion}" needs at least one criterion.`);
        return;
      }
      for (const o of c.options) {
        if (!o.name.trim()) {
          setError(`All criteria in "${c.criterion}" need a name.`);
          return;
        }
      }
    }
    if (hasInvalidCategoryMarks(form.criteria)) {
      return;
    }
    setError('');
    const criteria = form.criteria.map((c) => ({
      criterion: c.criterion.trim(),
      options: c.options,
      feedbacks: serializeFeedbacksForSave(normalizeFeedbacks(c.feedbacks)),
    }));
    saveMut.mutate({ name: form.name.trim(), criteria });
  };

  const startEdit = (r: Rubric) => {
    resetRowKeys();
    setEditingId(r.id);
    setForm({
      name: r.name,
      criteria: r.criteria.map((c) => ({
        ...c,
        options: [...c.options],
        feedbacks: normalizeFeedbacks(c.feedbacks),
      })),
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetRowKeys();
    setForm(emptyForm());
    setError('');
  };

  const rubrics = data?.results ?? [];
  const categoryMarksInvalid = hasInvalidCategoryMarks(form.criteria);
  syncRowKeys(form.criteria);
  const criteriaRows = form.criteria.map((criterion, index) => ({
    criterion,
    rowKey: criterionKeys.current[index],
    optionRows: criterion.options.map((option, optionIndex) => ({
      option,
      rowKey: optionKeys.current[index][optionIndex],
    })),
    feedbackRows: normalizeFeedbacks(criterion.feedbacks).map((feedback, feedbackIndex) => ({
      feedback,
      rowKey: feedbackKeys.current[index][feedbackIndex],
    })),
  }));
  let saveLabel = 'Create Rubric';
  if (saveMut.isPending) {
    saveLabel = '';
  } else if (editingId) {
    saveLabel = 'Save Changes';
  }

  return (
    <div className="d-flex flex-column">
      <div className="d-flex align-items-center mb-4 flex-wrap" style={{ gap: '0.5rem' }}>
        <Button variant="tertiary" size="sm" iconBefore={ArrowBack} onClick={onBack}>
          Templates
        </Button>
        <span className="text-muted">/</span>
        <h1 className="h3 mb-0">Rubrics</h1>
      </div>

      <div className="d-flex rounded border overflow-hidden bg-white" style={{ minHeight: '24rem' }}>
        {/* Left: form */}
        <div className="overflow-auto border-right p-4" style={{ width: 380, flexShrink: 0 }}>
          <h3 className="h6 mb-4">{editingId ? 'Edit Rubric' : 'New Rubric'}</h3>

          {error && <Alert variant="danger" className="mb-3 small">{error}</Alert>}

          <Form.Group controlId="rubric-name" className="mb-4">
            <Form.Label>Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              size="sm"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Essay Rubric"
            />
          </Form.Group>

          <div className="mb-2 d-flex align-items-center justify-content-between">
            <span className="small font-weight-bold">Categories</span>
            <Button variant="tertiary" size="sm" iconBefore={Add} onClick={addCriterion}>
              Add Category
            </Button>
          </div>

          {criteriaRows.map((row, ci) => {
            const { criterion } = row;
            const marksValidation = validateCategoryMarks(criterion.options);

            return (
              <div
                key={row.rowKey}
                className="mb-3 p-3 rounded border"
                style={{ background: '#f8f9fa' }}
              >
                <div className="d-flex align-items-center mb-2" style={{ gap: '0.5rem' }}>
                  <Form.Control
                    size="sm"
                    value={criterion.criterion}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCriterionName(ci, e.target.value)}
                    placeholder={`Category ${ci + 1} name`}
                    style={{ flex: 1 }}
                  />
                  {form.criteria.length > 1 && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconBefore={Close}
                      onClick={() => removeCriterion(ci)}
                      className="text-danger"
                    >
                      {' '}
                    </Button>
                  )}
                </div>

                {/* Options */}
                <div className="mb-2">
                  {row.optionRows.map((optionRow, oi) => {
                    const { option: opt } = optionRow;
                    return (
                      <div
                        key={optionRow.rowKey}
                        className="d-flex align-items-center mb-1"
                        style={{ gap: '0.4rem' }}
                      >
                        <Form.Control
                          size="sm"
                          value={opt.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionField(
                            ci,
                            oi,
                            'name',
                            e.target.value,
                          )}
                          placeholder="Criteria label"
                          style={{ flex: 2 }}
                        />
                        <Form.Control
                          size="sm"
                          type="number"
                          min={0}
                          value={opt.marks}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOptionField(
                            ci,
                            oi,
                            'marks',
                            Number(e.target.value),
                          )}
                          placeholder="Marks"
                          style={{ flex: 1 }}
                        />
                        {criterion.options.length > 1 && (
                          <Button
                            variant="tertiary"
                            size="sm"
                            iconBefore={Close}
                            onClick={() => removeOption(ci, oi)}
                            className="text-muted"
                          >
                            {' '}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  className={`small mt-1 ${marksValidation.isValid ? 'text-success' : 'text-muted'}`}
                >
                  Category Total:
                  {' '}
                  {marksValidation.total}
                  {' '}
                  / 10
                </div>
                {marksValidation.error && (
                  <div className="small text-danger mt-1">{marksValidation.error}</div>
                )}

                <Button variant="tertiary" size="sm" iconBefore={Add} onClick={() => addOption(ci)} className="mt-2">
                  <span style={{ fontSize: 12 }}>Add Criteria</span>
                </Button>

                <div className="border-top mt-3 pt-3">
                  <div className="mb-2">
                    <span className="small font-weight-bold">Feedback</span>
                  </div>

                  {row.feedbackRows.map((feedbackRow, fi) => {
                    const { feedback: fb } = feedbackRow;
                    return (
                      <div
                        key={feedbackRow.rowKey}
                        className="d-flex align-items-start mb-2"
                        style={{ gap: '0.4rem' }}
                      >
                        <Form.Control
                          as="textarea"
                          rows={2}
                          size="sm"
                          value={fb}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedbackText(
                            ci,
                            fi,
                            e.target.value,
                          )}
                          onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
                            const pasted = e.clipboardData.getData('text');
                            if (handleFeedbackPaste(ci, fi, pasted)) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="Predefined feedback text"
                          style={{ flex: 1 }}
                        />
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconBefore={Close}
                          onClick={() => removeFeedback(ci, fi)}
                          className="text-muted"
                        >
                          {' '}
                        </Button>
                      </div>
                    );
                  })}

                  <Button variant="tertiary" size="sm" iconBefore={Add} onClick={() => addFeedback(ci)}>
                    <span style={{ fontSize: 12 }}>Add Feedback</span>
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="d-flex mt-4" style={{ gap: '0.5rem' }}>
            <Button
              variant="primary"
              size="sm"
              iconBefore={editingId ? undefined : Add}
              onClick={handleSubmit}
              disabled={saveMut.isPending || categoryMarksInvalid}
            >
              {saveMut.isPending && (
                <Spinner animation="border" size="sm" screenReaderText="Saving" />
              )}
              {saveLabel}
            </Button>
            {editingId && (
              <Button variant="tertiary" size="sm" iconBefore={Close} onClick={cancelEdit}>
                {' '}
              </Button>
            )}
          </div>
        </div>

        {/* Right: list */}
        <div className="flex-grow-1 overflow-auto p-4">
          <h3 className="h6 mb-3">Existing Rubrics</h3>

          {isLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" variant="primary" screenReaderText="Loading" />
            </div>
          )}

          {!isLoading && rubrics.length === 0 && (
            <p className="text-muted small">No rubrics yet. Create one on the left.</p>
          )}

          <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
            {rubrics.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded border p-3"
                style={{ borderColor: editingId === r.id ? '#2563eb' : undefined }}
              >
                <div className="d-flex align-items-center mb-2">
                  <span className="font-weight-bold small flex-grow-1">{r.name}</span>
                  <Badge variant={r.is_active ? 'success' : 'light'} className="mr-2 small">
                    {r.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="tertiary"
                    size="sm"
                    iconBefore={Edit}
                    onClick={() => startEdit(r)}
                    disabled={deleteMut.isPending}
                  >
                    {' '}
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    iconBefore={Close}
                    className="text-danger"
                    onClick={() => {
                      if (window.confirm(`Deactivate rubric "${r.name}"?`)) {
                        deleteMut.mutate(r.id);
                      }
                    }}
                    disabled={deleteMut.isPending || !r.is_active}
                  >
                    {' '}
                  </Button>
                </div>

                {(() => {
                  const seenCriteria = new Map<string, number>();
                  return r.criteria.map((c) => {
                    const optionParts = c.options.map((o) => `${o.name}:${o.marks}`);
                    const criterionIdentity = `${c.criterion}|${optionParts.join(',')}`;
                    const criterionCopy = seenCriteria.get(criterionIdentity) ?? 0;
                    seenCriteria.set(criterionIdentity, criterionCopy + 1);
                    const seenOptions = new Map<string, number>();
                    return (
                      <div
                        key={`${r.id}-criterion-${criterionIdentity}-${criterionCopy}`}
                        className="mb-1"
                        style={{ fontSize: 12 }}
                      >
                        <span className="font-weight-bold text-muted">{c.criterion}: </span>
                        {c.options.map((o, oi) => {
                          const optionIdentity = `${o.name}:${o.marks}`;
                          const optionCopy = seenOptions.get(optionIdentity) ?? 0;
                          seenOptions.set(optionIdentity, optionCopy + 1);
                          return (
                            <span
                              key={`${r.id}-option-${criterionIdentity}-${optionIdentity}-${optionCopy}`}
                              className="mr-2"
                            >
                              {o.name} <span className="text-muted">({o.marks} pts)</span>
                              {oi < c.options.length - 1 && ' · '}
                            </span>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
