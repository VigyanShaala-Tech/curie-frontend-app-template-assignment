/**
 * WeightedRubricEditor
 * Table editor for weighted rubrics: sections → components → criteria → indicators.
 *
 * Columns: Component (name, gate, linked template fields) | Learning Objective |
 * Learning Outcome | Criteria & indicators | Weight. Weights sit in one right-hand
 * column so they line up and total at the bottom.
 */

import React, { useState } from 'react';
import { Button, Form, Icon } from '@openedx/paragon';
import {
  Add, Close, KeyboardArrowDown, KeyboardArrowRight,
} from '@openedx/paragon/icons';
import type {
  WeightedComponent, WeightedCriterion, WeightedIndicator, WeightedSection,
} from '../../types';
import {
  CRITERION_MAX,
  WEIGHT_TOTAL,
  emptyComponent,
  emptyCriterion,
  emptyIndicator,
  emptySection,
  isCloseTo,
  parsePastedIndicators,
  sumIndicatorMarks,
  totalWeight,
} from '../../utils/weightedRubric';
import { splitPastedFeedbacks } from '../../utils/rubricFeedbackUtils';
import { AutoGrowTextarea } from './AutoGrowTextarea';

export interface TemplateFieldOption {
  id: string;
  label: string;
}

interface Props {
  sections: WeightedSection[];
  onChange: (sections: WeightedSection[]) => void;
  /** Fields of the rubric's template; empty when no template is chosen. */
  templateFields: TemplateFieldOption[];
}

function hasContent(component: WeightedComponent): boolean {
  return Boolean(
    component.name.trim()
    || component.learning_objective.trim()
    || component.learning_outcome.trim()
    || component.criteria.some((c) => c.indicators.some((i) => i.text.trim())),
  );
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

const IconOnlyButton: React.FC<{
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ label, onClick, className = 'text-muted' }) => (
  <Button
    variant="tertiary"
    size="sm"
    iconBefore={Close}
    onClick={onClick}
    className={`tas-wr-icon-btn ${className}`}
    aria-label={label}
    title={label}
  >
    {' '}
  </Button>
);

const Chevron: React.FC<{ expanded: boolean; label: string; onToggle: () => void }> = ({
  expanded, label, onToggle,
}) => (
  <button
    type="button"
    className="tas-rubric-collapse-toggle"
    aria-expanded={expanded}
    aria-label={label}
    onClick={onToggle}
  >
    <Icon src={expanded ? KeyboardArrowDown : KeyboardArrowRight} style={{ width: 20, height: 20 }} />
  </button>
);

// ─── Criterion card ─────────────────────────────────────────────────────────

const CriterionCard: React.FC<{
  criterion: WeightedCriterion;
  onChange: (next: WeightedCriterion) => void;
  onRemove: (() => void) | null;
}> = ({ criterion, onChange, onRemove }) => {
  const total = sumIndicatorMarks(criterion.indicators);
  const totalOk = isCloseTo(total, CRITERION_MAX);

  const setIndicator = (index: number, patch: Partial<WeightedIndicator>) => onChange({
    ...criterion,
    indicators: criterion.indicators.map((ind, i) => (i === index ? { ...ind, ...patch } : ind)),
  });

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    const parsed = parsePastedIndicators(text);
    const multiLine = /\r|\n/.test(text.trim());
    const hasMarks = parsed.some((ind) => ind.marks > 0);
    if (parsed.length === 0 || (!multiLine && parsed.length === 1 && !hasMarks)) {
      return;
    }
    event.preventDefault();
    const current = criterion.indicators[index];
    const replaceCurrent = !current.text.trim() && !current.marks;
    const indicators = [...criterion.indicators];
    indicators.splice(replaceCurrent ? index : index + 1, replaceCurrent ? 1 : 0, ...parsed);
    onChange({ ...criterion, indicators });
  };

  return (
    <div className="tas-wr-criterion">
      <div className="d-flex align-items-start" style={{ gap: '0.25rem' }}>
        <AutoGrowTextarea
          value={criterion.name}
          onChange={(e) => onChange({ ...criterion, name: e.target.value })}
          placeholder="Criterion name"
          aria-label="Criterion name"
          className="font-weight-bold"
        />
        {onRemove && <IconOnlyButton label={`Delete criterion ${criterion.name}`} onClick={onRemove} />}
      </div>

      <div className="tas-wr-indicators">
        {criterion.indicators.map((indicator, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="tas-wr-indicator">
            <AutoGrowTextarea
              value={indicator.text}
              onChange={(e) => setIndicator(index, { text: e.target.value })}
              onPaste={(e) => handlePaste(index, e)}
              placeholder="Indicator (paste a list to add many)"
              aria-label="Indicator text"
            />
            <input
              type="number"
              min={0}
              max={CRITERION_MAX}
              step="any"
              className="form-control form-control-sm tas-wr-marks"
              value={indicator.marks}
              onChange={(e) => setIndicator(index, { marks: Number(e.target.value) })}
              aria-label="Indicator marks"
            />
            <IconOnlyButton
              label="Delete indicator"
              onClick={() => onChange({
                ...criterion,
                indicators: criterion.indicators.filter((_, i) => i !== index),
              })}
            />
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center justify-content-between mt-1">
        <span className={`small ${totalOk ? 'text-success' : 'text-danger'}`}>
          Total {formatNumber(total)} / {CRITERION_MAX}
        </span>
        <Button
          variant="tertiary"
          size="sm"
          iconBefore={Add}
          onClick={() => onChange({ ...criterion, indicators: [...criterion.indicators, emptyIndicator()] })}
        >
          <span style={{ fontSize: 12 }}>Indicator</span>
        </Button>
      </div>
    </div>
  );
};

// ─── Fields picker ──────────────────────────────────────────────────────────

const FieldsPicker: React.FC<{
  componentName: string;
  selected: string[];
  options: TemplateFieldOption[];
  onChange: (next: string[]) => void;
}> = ({
  componentName, selected, options, onChange,
}) => {
  const labelFor = (id: string) => options.find((o) => o.id === id)?.label ?? 'Field no longer on template';
  const available = options.filter((o) => !selected.includes(o.id));

  return (
    <div className="mt-2">
      <div className="small text-muted mb-1">Template fields</div>
      <div className="d-flex flex-wrap" style={{ gap: '0.25rem' }}>
        {selected.map((id) => (
          <span key={id} className="tas-wr-chip">
            {labelFor(id)}
            <button
              type="button"
              className="tas-wr-chip__remove"
              aria-label={`Remove field ${labelFor(id)}`}
              onClick={() => onChange(selected.filter((s) => s !== id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {options.length === 0 ? (
        <div className="small text-muted mt-1">Choose a template above to link fields.</div>
      ) : (
        available.length > 0 && (
          <select
            className="form-control form-control-sm mt-1"
            value=""
            aria-label={`Add template field to ${componentName || 'component'}`}
            onChange={(e) => {
              if (e.target.value) { onChange([...selected, e.target.value]); }
            }}
          >
            <option value="">+ Add field…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        )
      )}
    </div>
  );
};

// ─── Component row ──────────────────────────────────────────────────────────

const ComponentRow: React.FC<{
  component: WeightedComponent;
  templateFields: TemplateFieldOption[];
  onChange: (next: WeightedComponent) => void;
  onRemove: () => void;
}> = ({
  component, templateFields, onChange, onRemove,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbacks = component.feedbacks ?? [];

  const setCriterion = (index: number, next: WeightedCriterion) => onChange({
    ...component,
    criteria: component.criteria.map((c, i) => (i === index ? next : c)),
  });

  const setFeedbacks = (next: string[]) => onChange({ ...component, feedbacks: next });

  const handleFeedbackPaste = (index: number, event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = event.clipboardData.getData('text');
    if (!/\r|\n/.test(text)) { return; }
    event.preventDefault();
    const lines = splitPastedFeedbacks(text);
    if (lines.length === 0) { return; }
    const next = [...feedbacks];
    next.splice(index, 1, ...lines);
    setFeedbacks(next);
  };

  return (
    <div className={`tas-wr-row${component.is_gate ? ' is-gate' : ''}`} role="row">
      <div className="tas-wr-cell" role="cell">
        <div className="d-flex align-items-start" style={{ gap: '0.25rem' }}>
          <Chevron
            expanded={expanded}
            label={expanded ? 'Collapse component' : 'Expand component'}
            onToggle={() => setExpanded((v) => !v)}
          />
          <AutoGrowTextarea
            value={component.name}
            onChange={(e) => onChange({ ...component, name: e.target.value })}
            placeholder="Component name (e.g. Strengths)"
            aria-label="Component name"
            className="font-weight-bold"
          />
        </div>
        {expanded && (
          <>
            <Form.Checkbox
              className="mt-2 small"
              checked={component.is_gate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...component,
                is_gate: e.target.checked,
                weight: e.target.checked ? 0 : component.weight,
              })}
            >
              Gate (reject if not met)
            </Form.Checkbox>
            <FieldsPicker
              componentName={component.name}
              selected={component.field_ids}
              options={templateFields}
              onChange={(field_ids) => onChange({ ...component, field_ids })}
            />
          </>
        )}
      </div>

      <div className="tas-wr-cell" role="cell">
        {expanded ? (
          <AutoGrowTextarea
            value={component.learning_objective}
            onChange={(e) => onChange({ ...component, learning_objective: e.target.value })}
            placeholder="Purpose of this component"
            aria-label="Learning objective"
            rows={3}
          />
        ) : <span className="small text-muted tas-wr-clamp">{component.learning_objective || '—'}</span>}
      </div>

      <div className="tas-wr-cell" role="cell">
        {expanded ? (
          <AutoGrowTextarea
            value={component.learning_outcome}
            onChange={(e) => onChange({ ...component, learning_outcome: e.target.value })}
            placeholder="What the student should show"
            aria-label="Learning outcome"
            rows={3}
          />
        ) : <span className="small text-muted tas-wr-clamp">{component.learning_outcome || '—'}</span>}
      </div>

      <div className="tas-wr-cell" role="cell">
        {expanded ? (
          <>
            <div className="tas-wr-criteria">
              {component.criteria.map((criterion, index) => (
                <CriterionCard
                  key={criterion.id}
                  criterion={criterion}
                  onChange={(next) => setCriterion(index, next)}
                  onRemove={component.criteria.length > 1
                    ? () => onChange({
                      ...component,
                      criteria: component.criteria.filter((_, i) => i !== index),
                    })
                    : null}
                />
              ))}
            </div>
            <Button
              variant="tertiary"
              size="sm"
              iconBefore={Add}
              className="mt-2"
              onClick={() => onChange({ ...component, criteria: [...component.criteria, emptyCriterion()] })}
            >
              <span style={{ fontSize: 12 }}>Add criterion</span>
            </Button>

            <div className="border-top mt-2 pt-2">
              <button
                type="button"
                className="tas-rubric-feedback-toggle"
                aria-expanded={feedbackOpen}
                onClick={() => setFeedbackOpen((v) => !v)}
              >
                <Icon
                  src={feedbackOpen ? KeyboardArrowDown : KeyboardArrowRight}
                  style={{ width: 20, height: 20, flexShrink: 0 }}
                />
                <span>Feedback ({feedbacks.length})</span>
              </button>
              {feedbackOpen && (
                <div className="mt-2">
                  {feedbacks.map((fb, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={index} className="d-flex align-items-start mb-1" style={{ gap: '0.25rem' }}>
                      <AutoGrowTextarea
                        value={fb}
                        onChange={(e) => setFeedbacks(feedbacks.map((f, i) => (i === index ? e.target.value : f)))}
                        onPaste={(e) => handleFeedbackPaste(index, e)}
                        placeholder="Predefined feedback text"
                        aria-label="Predefined feedback"
                      />
                      <IconOnlyButton
                        label="Delete feedback"
                        onClick={() => setFeedbacks(feedbacks.filter((_, i) => i !== index))}
                      />
                    </div>
                  ))}
                  <Button variant="tertiary" size="sm" iconBefore={Add} onClick={() => setFeedbacks([...feedbacks, ''])}>
                    <span style={{ fontSize: 12 }}>Add feedback</span>
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <span className="small text-muted">
            {component.criteria.map((c) => c.name || 'Unnamed').join(' · ')}
          </span>
        )}
      </div>

      <div className="tas-wr-cell tas-wr-weight" role="cell">
        {component.is_gate ? (
          <span className="tas-wr-gate-badge">Gate · 0%</span>
        ) : (
          <div className="d-flex align-items-center" style={{ gap: '0.25rem' }}>
            <input
              type="number"
              min={0}
              max={WEIGHT_TOTAL}
              step="any"
              className="form-control form-control-sm text-right"
              value={component.weight}
              onChange={(e) => onChange({ ...component, weight: Number(e.target.value) })}
              aria-label={`Weight of ${component.name || 'component'} in percent`}
            />
            <span className="small">%</span>
          </div>
        )}
      </div>

      <div className="tas-wr-cell tas-wr-actions" role="cell">
        <IconOnlyButton label={`Delete component ${component.name}`} onClick={onRemove} className="text-danger" />
      </div>
    </div>
  );
};

// ─── Editor ─────────────────────────────────────────────────────────────────

export const WeightedRubricEditor: React.FC<Props> = ({ sections, onChange, templateFields }) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const weight = totalWeight(sections);
  const weightOk = isCloseTo(weight, WEIGHT_TOTAL);

  const setSection = (index: number, next: WeightedSection) => onChange(
    sections.map((s, i) => (i === index ? next : s)),
  );

  const removeSection = (index: number) => {
    const section = sections[index];
    if (section.components.some(hasContent)
      && !window.confirm(`Delete section "${section.title || `Section ${index + 1}`}" and its components?`)) {
      return;
    }
    onChange(sections.filter((_, i) => i !== index));
  };

  const removeComponent = (sIndex: number, cIndex: number) => {
    const section = sections[sIndex];
    const component = section.components[cIndex];
    if (hasContent(component) && !window.confirm(`Delete component "${component.name || 'Unnamed'}"?`)) {
      return;
    }
    setSection(sIndex, { ...section, components: section.components.filter((_, i) => i !== cIndex) });
  };

  return (
    <div className="tas-wr-scroll">
      <div className="tas-wr-table" role="table" aria-label="Weighted rubric">
        <div className="tas-wr-row tas-wr-head" role="row">
          <div className="tas-wr-cell" role="columnheader">Component</div>
          <div className="tas-wr-cell" role="columnheader">Learning Objective</div>
          <div className="tas-wr-cell" role="columnheader">Learning Outcome</div>
          <div className="tas-wr-cell" role="columnheader">Criteria &amp; indicators (each totals 10)</div>
          <div className="tas-wr-cell tas-wr-weight" role="columnheader">Weight</div>
          <div className="tas-wr-cell" role="columnheader"><span className="sr-only">Actions</span></div>
        </div>

        {sections.map((section, sIndex) => {
          const collapsed = Boolean(collapsedSections[section.id]);
          const sectionWeight = totalWeight([section]);
          return (
            <React.Fragment key={section.id}>
              <div className="tas-wr-row tas-wr-section" role="row">
                <div className="tas-wr-cell tas-wr-section__title" role="cell">
                  <Chevron
                    expanded={!collapsed}
                    label={collapsed ? 'Expand section' : 'Collapse section'}
                    onToggle={() => setCollapsedSections((prev) => ({ ...prev, [section.id]: !collapsed }))}
                  />
                  <input
                    className="form-control form-control-sm font-weight-bold text-uppercase"
                    value={section.title}
                    onChange={(e) => setSection(sIndex, { ...section, title: e.target.value })}
                    placeholder={`Section ${sIndex + 1} title (e.g. SWOT Quadrants)`}
                    aria-label="Section title"
                  />
                </div>
                <div className="tas-wr-cell tas-wr-weight small text-muted" role="cell">
                  {formatNumber(sectionWeight)}%
                </div>
                <div className="tas-wr-cell tas-wr-actions" role="cell">
                  <IconOnlyButton
                    label={`Delete section ${section.title}`}
                    onClick={() => removeSection(sIndex)}
                    className="text-danger"
                  />
                </div>
              </div>

              {!collapsed && section.components.map((component, cIndex) => (
                <ComponentRow
                  key={component.id}
                  component={component}
                  templateFields={templateFields}
                  onChange={(next) => setSection(sIndex, {
                    ...section,
                    components: section.components.map((c, i) => (i === cIndex ? next : c)),
                  })}
                  onRemove={() => removeComponent(sIndex, cIndex)}
                />
              ))}

              {!collapsed && (
                <div className="tas-wr-row tas-wr-add" role="row">
                  <div className="tas-wr-cell" role="cell">
                    <Button
                      variant="tertiary"
                      size="sm"
                      iconBefore={Add}
                      onClick={() => setSection(sIndex, {
                        ...section,
                        components: [...section.components, emptyComponent()],
                      })}
                    >
                      <span style={{ fontSize: 12 }}>Add component</span>
                    </Button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        <div className="tas-wr-row tas-wr-foot" role="row">
          <div className="tas-wr-cell tas-wr-foot__label" role="cell">
            <Button variant="outline-primary" size="sm" iconBefore={Add} onClick={() => onChange([...sections, emptySection()])}>
              Add section
            </Button>
            <span className="small font-weight-bold ml-auto">Total weight</span>
          </div>
          <div
            className={`tas-wr-cell tas-wr-weight font-weight-bold ${weightOk ? 'text-success' : 'text-danger'}`}
            role="cell"
          >
            {formatNumber(weight)}%
          </div>
          <div className="tas-wr-cell" role="cell" />
        </div>
      </div>
    </div>
  );
};
