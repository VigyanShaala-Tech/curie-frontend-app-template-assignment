/**
 * AdminRubricManager
 * Create, edit, and deactivate rubrics.
 *
 * A rubric is either:
 *   - simple (schema_version 1): name + criteria: [{ criterion, options: [{ name, marks }], feedbacks? }]
 *   - weighted (schema_version 2): name + template + sections of weighted components,
 *     edited with WeightedRubricEditor
 *
 * The left panel lists existing rubrics with edit/deactivate actions.
 * The right panel is a full rubric form (name + dynamic criteria/options).
 * A draggable splitter between them resizes both panes. Below 768px the
 * splitter is hidden and the sections stack vertically.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Badge, Spinner, Form, Alert, Icon,
} from '@openedx/paragon';
import {
  Add, ArrowBack, Close, Edit, KeyboardArrowDown, KeyboardArrowRight,
} from '@openedx/paragon/icons';
import { rubricsApi, templatesApi, type RubricSaveBody } from '../../services/api';
import type {
  Rubric, RubricCriterion, RubricOption, RubricSchemaVersion, WeightedSection,
} from '../../types';
import { VerticalPanelSplitter } from '../VerticalPanelSplitter';
import { WeightedRubricEditor, type TemplateFieldOption } from './WeightedRubricEditor';
import {
  allComponents,
  cleanSectionsForSave,
  emptySection,
  validateWeightedRubric,
} from '../../utils/weightedRubric';
import {
  clampSplitWidth,
  DEFAULT_LIST_WIDTH,
  SPLITTER_WIDTH,
} from '../../utils/clampSplitWidth';
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

let criterionKeySequence = 0;

function createCriterionKey(): string {
  criterionKeySequence += 1;
  return `rubric-category-${criterionKeySequence}`;
}

const CollapseChevron = ({
  expanded,
  controlsId,
  label,
  onToggle,
}: {
  expanded: boolean;
  controlsId: string;
  label: string;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="tas-rubric-collapse-toggle"
    aria-expanded={expanded}
    aria-controls={controlsId}
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation();
      onToggle();
    }}
  >
    <Icon
      src={expanded ? KeyboardArrowDown : KeyboardArrowRight}
      style={{ width: 20, height: 20 }}
    />
  </button>
);

const CollapsePanel = ({
  id,
  expanded,
  children,
}: {
  id: string;
  expanded: boolean;
  children: React.ReactNode;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }
    node.inert = !expanded;
  }, [expanded]);

  return (
    <div
      id={id}
      className={`tas-rubric-collapse-panel${expanded ? '' : ' is-collapsed'}`}
      aria-hidden={expanded ? undefined : true}
    >
      <div ref={contentRef} className="tas-rubric-collapse-panel__content">
        {children}
      </div>
    </div>
  );
};

interface RubricForm {
  name: string;
  schemaVersion: RubricSchemaVersion;
  criteria: RubricCriterion[];
  sections: WeightedSection[];
  templateId: string;
}

function emptyForm(schemaVersion: RubricSchemaVersion = 2): RubricForm {
  return {
    name: '',
    schemaVersion,
    criteria: [{
      ...EMPTY_CRITERION,
      options: [{ ...EMPTY_OPTION }],
      feedbacks: [],
    }] as RubricCriterion[],
    sections: [emptySection()],
    templateId: '',
  };
}

const MOBILE_SPLIT_QUERY = '(max-width: 767.98px)';

function useStackedRubricPanes(): boolean {
  const [stacked, setStacked] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOBILE_SPLIT_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(MOBILE_SPLIT_QUERY);
    const update = () => setStacked(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return stacked;
}

function applyListPaneWidth(container: HTMLElement, pane: HTMLElement, proposedWidth: number): number {
  const containerWidth = container.getBoundingClientRect().width;
  if (containerWidth <= 0) {
    return proposedWidth;
  }
  const width = clampSplitWidth(proposedWidth, containerWidth);
  pane.style.setProperty('width', `${width}px`);
  return width;
}

export const AdminRubricManager: React.FC<Props> = ({ onBack }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<RubricForm>(() => emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [weightedErrors, setWeightedErrors] = useState<string[]>([]);
  const [criterionKeys, setCriterionKeys] = useState<string[]>(() => [createCriterionKey()]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedFeedback, setCollapsedFeedback] = useState<Record<string, boolean>>({});

  const resetCriterionChrome = (criteriaCount: number) => {
    setCriterionKeys(Array.from({ length: criteriaCount }, () => createCriterionKey()));
    setCollapsedCategories({});
    setCollapsedFeedback({});
  };

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFeedback = (key: string) => {
    setCollapsedFeedback((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const stacked = useStackedRubricPanes();
  const containerRef = useRef<HTMLDivElement>(null);
  const listPaneRef = useRef<HTMLDivElement>(null);
  const listWidthRef = useRef(DEFAULT_LIST_WIDTH);

  const syncListWidth = (proposedWidth: number) => {
    const container = containerRef.current;
    const pane = listPaneRef.current;
    if (!container || !pane || stacked) return;
    listWidthRef.current = applyListPaneWidth(container, pane, proposedWidth);
  };

  useEffect(() => {
    const pane = listPaneRef.current;
    if (!pane) return undefined;
    if (stacked) {
      pane.style.width = '100%';
      return undefined;
    }
    const fit = () => {
      const container = containerRef.current;
      const listPane = listPaneRef.current;
      if (!container || !listPane) return;
      listWidthRef.current = applyListPaneWidth(container, listPane, listWidthRef.current);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [stacked]);

  const handleSplitterResize = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const proposed = clientX - container.getBoundingClientRect().left - (SPLITTER_WIDTH / 2);
    syncListWidth(proposed);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['rubrics-all'],
    queryFn: () => rubricsApi.list(),
  });

  const { data: templatesData } = useQuery({
    queryKey: ['rubric-templates'],
    queryFn: () => templatesApi.list(),
    enabled: form.schemaVersion === 2,
  });
  const templates = templatesData?.results ?? [];
  const selectedTemplate = templates.find((t) => t.id === form.templateId);
  const templateFields: TemplateFieldOption[] = (selectedTemplate?.fields ?? [])
    .filter((field) => field?.id && (field as { active?: boolean }).active !== false)
    .map((field) => ({ id: field.id, label: field.label || field.id }));

  const saveMut = useMutation({
    mutationFn: (payload: RubricSaveBody) => {
      if (editingId) {
        return rubricsApi.update(editingId, payload);
      }
      return rubricsApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rubrics-all'] });
      setForm(emptyForm());
      setEditingId(null);
      setError('');
      setWeightedErrors([]);
      resetCriterionChrome(1);
    },
    onError: (e: any) => setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => rubricsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rubrics-all'] }),
  });

  // ── Criterion helpers ──────────────────────────────────────────────────────

  const setCriterionName = (ci: number, value: string) => {
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i === ci) {
          return { ...c, criterion: value };
        }
        return c;
      });
      return { ...prev, criteria };
    });
  };

  const addCriterion = () => {
    setCriterionKeys((keys) => [...keys, createCriterionKey()]);
    setForm((prev) => ({
      ...prev,
      criteria: [...prev.criteria, {
        ...EMPTY_CRITERION,
        options: [{ ...EMPTY_OPTION }],
        feedbacks: [],
      }],
    }));
  };

  const removeCriterion = (ci: number) => {
    const removedKey = criterionKeys[ci];
    setCriterionKeys((keys) => keys.filter((_, i) => i !== ci));
    if (removedKey) {
      setCollapsedCategories((prev) => {
        if (!(removedKey in prev)) return prev;
        const next = { ...prev };
        delete next[removedKey];
        return next;
      });
      setCollapsedFeedback((prev) => {
        if (!(removedKey in prev)) return prev;
        const next = { ...prev };
        delete next[removedKey];
        return next;
      });
    }
    setForm((prev) => ({ ...prev, criteria: prev.criteria.filter((_, i) => i !== ci) }));
  };

  // ── Option helpers ────────────────────────────────────────────────────────

  const setOptionField = (
    ci: number,
    oi: number,
    field: keyof RubricOption,
    value: string | number,
  ) => {
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        const options = c.options.map((o, j) => {
          if (j === oi) {
            return { ...o, [field]: value };
          }
          return o;
        });
        return { ...c, options };
      });
      return { ...prev, criteria };
    });
  };

  const addOption = (ci: number) => {
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i === ci) {
          return { ...c, options: [...c.options, { ...EMPTY_OPTION }] };
        }
        return c;
      });
      return { ...prev, criteria };
    });
  };

  const removeOption = (ci: number, oi: number) => {
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

  const setFeedbackText = (ci: number, fi: number, value: string) => {
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        const feedbacks = normalizeFeedbacks(c.feedbacks).map((fb, j) => (j === fi ? value : fb));
        return { ...c, feedbacks };
      });
      return { ...prev, criteria };
    });
  };

  const addFeedback = (ci: number) => {
    setForm((prev) => {
      const criteria = prev.criteria.map((c, i) => {
        if (i !== ci) {
          return c;
        }
        return { ...c, feedbacks: [...normalizeFeedbacks(c.feedbacks), ''] };
      });
      return { ...prev, criteria };
    });
  };

  const removeFeedback = (ci: number, fi: number) => {
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
        feedbacks[fi] = firstLine;
        feedbacks.splice(fi + 1, 0, ...moreLines);
        return { ...c, feedbacks };
      });
      return { ...prev, criteria };
    });
    return true;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (form.schemaVersion === 2) {
      const problems = validateWeightedRubric(form.name, form.sections);
      setWeightedErrors(problems);
      if (problems.length > 0) {
        setError('');
        return;
      }
      setError('');
      saveMut.mutate({
        name: form.name.trim(),
        schema_version: 2,
        sections: cleanSectionsForSave(form.sections),
        template: form.templateId ? Number(form.templateId) : null,
      });
      return;
    }
    if (!form.name.trim()) { setError('Rubric name is required.'); return; }
    for (const [ci, c] of form.criteria.entries()) {
      if (!c.criterion.trim()) { setError(`Category ${ci + 1} needs a name.`); return; }
      if (c.options.length === 0) { setError(`Category "${c.criterion}" needs at least one criterion.`); return; }
      for (const o of c.options) {
        if (!o.name.trim()) { setError(`All criteria in "${c.criterion}" need a name.`); return; }
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
    saveMut.mutate({ name: form.name.trim(), schema_version: 1, criteria });
  };

  const startEdit = (r: Rubric) => {
    setEditingId(r.id);
    setForm({
      ...emptyForm(r.schema_version),
      name: r.name,
      criteria: r.schema_version === 2
        ? emptyForm(1).criteria
        : r.criteria.map((c) => ({
          ...c,
          options: [...c.options],
          feedbacks: normalizeFeedbacks(c.feedbacks),
        })),
      sections: r.schema_version === 2 ? JSON.parse(JSON.stringify(r.sections)) : [emptySection()],
      templateId: r.template_id ?? '',
    });
    setError('');
    setWeightedErrors([]);
    resetCriterionChrome(r.schema_version === 2 ? 1 : r.criteria.length);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setWeightedErrors([]);
    resetCriterionChrome(1);
  };

  const rubrics = data?.results ?? [];
  const isWeighted = form.schemaVersion === 2;
  const categoryMarksInvalid = !isWeighted && hasInvalidCategoryMarks(form.criteria);

  return (
    <div className="d-flex flex-column" style={{ minWidth: 0, maxWidth: '100%' }}>
      <div className="d-flex align-items-center mb-4 flex-wrap" style={{ gap: '0.5rem' }}>
        <Button variant="tertiary" size="sm" iconBefore={ArrowBack} onClick={onBack}>
          Templates
        </Button>
        <span className="text-muted">/</span>
        <h1 className="h3 mb-0">Rubrics</h1>
      </div>

      <div
        ref={containerRef}
        className="d-flex rounded border bg-white"
        style={{
          minHeight: '24rem',
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          flexDirection: stacked ? 'column' : 'row',
          overflow: 'hidden',
        }}
      >
        <div
          ref={listPaneRef}
          className="p-4"
          style={{
            width: stacked ? '100%' : listWidthRef.current,
            flexShrink: 0,
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'hidden',
            overflowY: 'auto',
            borderBottom: stacked ? '1px solid #e5e7eb' : undefined,
          }}
        >
          <h3 className="h6 mb-3">Existing Rubrics</h3>

          {isLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" variant="primary" screenReaderText="Loading" />
            </div>
          )}

          {!isLoading && rubrics.length === 0 && (
            <p className="text-muted small">No rubrics yet. Create one on the right.</p>
          )}

          <div className="d-flex flex-column" style={{ gap: '0.75rem', minWidth: 0 }}>
            {rubrics.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded border p-3"
                style={{
                  borderColor: editingId === r.id ? '#2563eb' : undefined,
                  minWidth: 0,
                  maxWidth: '100%',
                }}
              >
                <div className="d-flex align-items-center mb-2" style={{ gap: '0.25rem', minWidth: 0, flexWrap: 'wrap' }}>
                  <span
                    className="font-weight-bold small flex-grow-1"
                    style={{ minWidth: 0, overflowWrap: 'anywhere' }}
                  >
                    {r.name}
                  </span>
                  <Badge variant={r.is_active ? 'success' : 'light'} className="mr-2 small" style={{ flexShrink: 0 }}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="tertiary"
                    size="sm"
                    iconBefore={Edit}
                    onClick={() => startEdit(r)}
                    disabled={deleteMut.isPending}
                    style={{ flexShrink: 0 }}
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
                    style={{ flexShrink: 0 }}
                  >
                    {' '}
                  </Button>
                </div>

                {r.schema_version === 2 && (
                  <>
                    <Badge variant="info" className="small mb-2">Weighted</Badge>
                    {allComponents(r.sections).map((component) => (
                      <div
                        key={component.id}
                        className="d-flex justify-content-between mb-1"
                        style={{ fontSize: 12, gap: '0.5rem', minWidth: 0 }}
                      >
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{component.name}</span>
                        <span className="text-muted" style={{ flexShrink: 0 }}>
                          {component.is_gate ? 'Gate' : `${component.weight}%`}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {r.schema_version !== 2 && r.criteria.map((c, ci) => (
                  <div key={ci} className="mb-1" style={{ fontSize: 12, minWidth: 0, overflowWrap: 'anywhere' }}>
                    <span className="font-weight-bold text-muted">{c.criterion}: </span>
                    {c.options.map((o, oi) => (
                      <span key={oi} className="mr-2">
                        {o.name} <span className="text-muted">({o.marks} pts)</span>
                        {oi < c.options.length - 1 && ' · '}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {!stacked && (
          <VerticalPanelSplitter
            label="Resize Existing Rubrics and Edit Rubric"
            onResize={handleSplitterResize}
          />
        )}

        <div
          className="p-4"
          style={{
            flex: stacked ? '1 1 auto' : '1 1 0%',
            minWidth: 0,
            width: stacked ? '100%' : undefined,
            maxWidth: '100%',
            overflowX: 'hidden',
            overflowY: 'auto',
            overflowWrap: 'anywhere',
          }}
        >
          <h3 className="h6 mb-4">{editingId ? 'Edit Rubric' : 'New Rubric'}</h3>

          {error && <Alert variant="danger" className="mb-3 small">{error}</Alert>}
          {weightedErrors.length > 0 && (
            <Alert variant="danger" className="mb-3 small">
              <div className="font-weight-bold mb-1">Fix these before saving:</div>
              <ul className="mb-0 pl-3">
                {weightedErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            </Alert>
          )}

          {!editingId && (
            <Form.Group controlId="rubric-type" className="mb-3">
              <Form.Label>Rubric type</Form.Label>
              <Form.Control
                as="select"
                size="sm"
                value={form.schemaVersion}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const next = Number(e.target.value) as RubricSchemaVersion;
                  setForm((p) => ({ ...p, schemaVersion: next }));
                  setWeightedErrors([]);
                  setError('');
                }}
                style={{ maxWidth: 360 }}
              >
                <option value={2}>Weighted components (sections, criteria, weightage)</option>
                <option value={1}>Simple categories (each out of 10, added up)</option>
              </Form.Control>
            </Form.Group>
          )}

          <div className="d-flex flex-wrap mb-4" style={{ gap: '1rem' }}>
            <Form.Group controlId="rubric-name" className="mb-0" style={{ flex: '1 1 260px', minWidth: 0 }}>
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                size="sm"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder={isWeighted ? 'e.g. Personal SWOT' : 'e.g. Essay Rubric'}
                style={{ width: '100%', maxWidth: '100%' }}
              />
            </Form.Group>
            {isWeighted && (
              <Form.Group controlId="rubric-template" className="mb-0" style={{ flex: '1 1 260px', minWidth: 0 }}>
                <Form.Label>Template (for linking fields)</Form.Label>
                <Form.Control
                  as="select"
                  size="sm"
                  value={form.templateId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const nextId = e.target.value;
                    const hasLinks = allComponents(form.sections).some((c) => c.field_ids.length > 0);
                    if (hasLinks && !window.confirm('Changing the template removes the linked fields. Continue?')) {
                      return;
                    }
                    setForm((p) => (p.templateId === nextId ? p : {
                      ...p,
                      templateId: nextId,
                      sections: p.sections.map((section) => ({
                        ...section,
                        components: section.components.map((component) => ({ ...component, field_ids: [] })),
                      })),
                    }));
                  }}
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Form.Control>
              </Form.Group>
            )}
          </div>

          {isWeighted && (
            <WeightedRubricEditor
              sections={form.sections}
              onChange={(sections) => setForm((p) => ({ ...p, sections }))}
              templateFields={templateFields}
            />
          )}

          {!isWeighted && (
            <>
              <div className="mb-2 d-flex align-items-center justify-content-between" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="small font-weight-bold">Categories</span>
                <Button variant="tertiary" size="sm" iconBefore={Add} onClick={addCriterion}>
                  Add Category
                </Button>
              </div>

              {form.criteria.map((criterion, ci) => {
                const marksValidation = validateCategoryMarks(criterion.options);
                const criterionKey = criterionKeys[ci] ?? `rubric-category-fallback-${ci}`;
                const categoryExpanded = !collapsedCategories[criterionKey];
                const feedbackExpanded = !collapsedFeedback[criterionKey];
                const categoryBodyId = `${criterionKey}-criteria`;
                const feedbackBodyId = `${criterionKey}-feedback`;

                return (
                  <div
                    key={criterionKey}
                    className="mb-3 p-3 rounded border"
                    style={{ background: '#f8f9fa', minWidth: 0, maxWidth: '100%' }}
                  >
                    <div
                      className={`d-flex align-items-center tas-rubric-collapse-header${categoryExpanded ? ' mb-2' : ''}`}
                      style={{ gap: '0.35rem', minWidth: 0 }}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest('input, textarea, button, a')) {
                          return;
                        }
                        toggleCategory(criterionKey);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return;
                        }
                        const target = event.target as HTMLElement;
                        if (target.closest('input, textarea, button, a')) {
                          return;
                        }
                        event.preventDefault();
                        toggleCategory(criterionKey);
                      }}
                    >
                      <CollapseChevron
                        expanded={categoryExpanded}
                        controlsId={categoryBodyId}
                        label={categoryExpanded ? 'Collapse category' : 'Expand category'}
                        onToggle={() => toggleCategory(criterionKey)}
                      />
                      <Form.Control
                        size="sm"
                        value={criterion.criterion}
                        onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCriterionName(ci, e.target.value)
                        }
                        placeholder={`Category ${ci + 1} name`}
                        style={{ flex: '1 1 0%', minWidth: 0, maxWidth: '100%' }}
                      />
                      {form.criteria.length > 1 && (
                        <Button
                          variant="tertiary"
                          size="sm"
                          iconBefore={Close}
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            removeCriterion(ci);
                          }}
                          className="text-danger"
                          style={{ flexShrink: 0 }}
                        >
                          {' '}
                        </Button>
                      )}
                    </div>

                    <CollapsePanel id={categoryBodyId} expanded={categoryExpanded}>
                      <div className="mb-2">
                        {criterion.options.map((opt, oi) => (
                          <div key={oi} className="d-flex align-items-center mb-1" style={{ gap: '0.4rem', minWidth: 0 }}>
                            <Form.Control
                              size="sm"
                              value={opt.name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setOptionField(ci, oi, 'name', e.target.value)
                              }
                              placeholder="Criteria label"
                              style={{ flex: '2 1 0%', minWidth: 0, maxWidth: '100%' }}
                            />
                            <Form.Control
                              size="sm"
                              type="number"
                              min={0}
                              value={opt.marks}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setOptionField(ci, oi, 'marks', Number(e.target.value))
                              }
                              placeholder="Marks"
                              style={{ flex: '1 1 0%', minWidth: 0, maxWidth: '100%' }}
                            />
                            {criterion.options.length > 1 && (
                              <Button
                                variant="tertiary"
                                size="sm"
                                iconBefore={Close}
                                onClick={() => removeOption(ci, oi)}
                                className="text-muted"
                                style={{ flexShrink: 0 }}
                              >
                                {' '}
                              </Button>
                            )}
                          </div>
                        ))}
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
                    </CollapsePanel>

                    <div className={`border-top ${categoryExpanded ? 'mt-3 pt-3' : 'mt-2 pt-2'}`}>
                      <button
                        type="button"
                        className={`tas-rubric-feedback-toggle${feedbackExpanded ? ' mb-2' : ''}`}
                        aria-expanded={feedbackExpanded}
                        aria-controls={feedbackBodyId}
                        onClick={() => toggleFeedback(criterionKey)}
                      >
                        <Icon
                          src={feedbackExpanded ? KeyboardArrowDown : KeyboardArrowRight}
                          style={{ width: 20, height: 20, flexShrink: 0 }}
                        />
                        <span>Feedback</span>
                      </button>

                      <CollapsePanel id={feedbackBodyId} expanded={feedbackExpanded}>
                        {normalizeFeedbacks(criterion.feedbacks).map((fb, fi) => (
                          <div key={fi} className="d-flex align-items-start mb-2" style={{ gap: '0.4rem', minWidth: 0 }}>
                            <Form.Control
                              as="textarea"
                              rows={2}
                              size="sm"
                              value={fb}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setFeedbackText(ci, fi, e.target.value)
                              }
                              onPaste={(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
                                const pasted = e.clipboardData.getData('text');
                                if (handleFeedbackPaste(ci, fi, pasted)) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Predefined feedback text"
                              style={{
                                flex: '1 1 0%',
                                minWidth: 0,
                                width: '100%',
                                maxWidth: '100%',
                                overflowWrap: 'anywhere',
                              }}
                            />
                            <Button
                              variant="tertiary"
                              size="sm"
                              iconBefore={Close}
                              onClick={() => removeFeedback(ci, fi)}
                              className="text-muted"
                              style={{ flexShrink: 0 }}
                            >
                              {' '}
                            </Button>
                          </div>
                        ))}

                        <Button variant="tertiary" size="sm" iconBefore={Add} onClick={() => addFeedback(ci)}>
                          <span style={{ fontSize: 12 }}>Add Feedback</span>
                        </Button>
                      </CollapsePanel>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div className="d-flex mt-4" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="sm"
              iconBefore={editingId ? undefined : Add}
              onClick={handleSubmit}
              disabled={saveMut.isPending || categoryMarksInvalid}
            >
              {saveMut.isPending
                ? <Spinner animation="border" size="sm" screenReaderText="Saving" />
                : editingId ? 'Save Changes' : 'Create Rubric'}
            </Button>
            {editingId && (
              <Button variant="tertiary" size="sm" iconBefore={Close} onClick={cancelEdit}>
                {' '}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
