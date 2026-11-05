/**
 * WeightedRubricGrading
 * Instructor scoring for weighted rubrics: one card per component with a 0–10
 * score per criterion, optional section feedback, the component score (criteria average),
 * its weighted marks, and the total out of the rubric maximum.
 */

import React, { useState } from 'react';
import {
  Badge, Card, Form, Icon,
} from '@openedx/paragon';
import { KeyboardArrowDown, KeyboardArrowRight } from '@openedx/paragon/icons';
import type { WeightedComponent, WeightedSection } from '../../types';
import {
  CRITERION_MAX,
  componentAverage,
  componentMaxMarks,
  round2,
  weightedScoreErrorKey,
  weightedTotals,
  type WeightedFeedbackDraft,
  type WeightedScoreDraft,
} from '../../utils/weightedRubric';

interface Props {
  sections: WeightedSection[];
  /** Template field id → label, for "Evaluates" lines. */
  templateFields?: Record<string, string> | null;
  scores: WeightedScoreDraft;
  feedback?: WeightedFeedbackDraft;
  errors?: Record<string, string>;
  readOnly?: boolean;
  onScoreChange?: (componentId: string, criterionId: string, value: string) => void;
  onFeedbackChange?: (componentId: string, value: string) => void;
  /** Extra controls under each component (e.g. predefined feedback). */
  renderComponentExtras?: (component: WeightedComponent) => React.ReactNode;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid #ced4da',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #00262b',
  borderRadius: '0.25rem',
  textAlign: 'center',
  height: '38px',
  width: '100%',
};

const feedbackStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '5.5rem',
  whiteSpace: 'pre-wrap',
  border: '1px solid #00262b',
  borderRadius: '0.25rem',
};

function format(value: number | null): string {
  return value === null ? '—' : String(round2(value));
}

const ScoringGuide: React.FC<{ component: WeightedComponent }> = ({ component }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        type="button"
        className="tas-rubric-feedback-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon src={open ? KeyboardArrowDown : KeyboardArrowRight} style={{ width: 20, height: 20, flexShrink: 0 }} />
        <span>Scoring guide</span>
      </button>
      {open && (
        <div className="small mt-2">
          {component.learning_objective && (
            <p className="mb-1"><strong>Objective:</strong> {component.learning_objective}</p>
          )}
          {component.learning_outcome && (
            <p className="mb-2"><strong>Outcome:</strong> {component.learning_outcome}</p>
          )}
          {component.criteria.map((criterion) => (
            <div key={criterion.id} className="mb-2">
              <div className="font-weight-bold">{criterion.name}</div>
              <ul className="mb-0 pl-3">
                {criterion.indicators.map((indicator, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={index}>{indicator.text} ({indicator.marks})</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const WeightedRubricGrading: React.FC<Props> = ({
  sections,
  templateFields,
  scores,
  feedback = {},
  errors = {},
  readOnly = false,
  onScoreChange,
  onFeedbackChange,
  renderComponentExtras,
}) => {
  const totals = weightedTotals(sections, scores);

  return (
    <div data-testid="weighted-rubric-grading">
      {sections.map((section) => (
        <div key={section.id} className="mb-2">
          {section.title && (
            <h3
              className="small font-weight-bold text-muted text-uppercase mb-2"
              style={{ letterSpacing: '0.04em' }}
            >
              {section.title}
            </h3>
          )}
          {section.components.map((component) => {
            const average = componentAverage(component, scores[component.id]);
            const maxMarks = componentMaxMarks(component);
            const sectionFeedback = feedback[component.id] ?? '';
            const fieldLabels = component.field_ids
              .map((id) => templateFields?.[id])
              .filter(Boolean);
            return (
              <Card key={component.id} className="mb-3" style={cardStyle}>
                <Card.Section className="p-3">
                  <div className="d-flex align-items-start justify-content-between mb-1" style={{ gap: '0.5rem' }}>
                    <h4 className="mb-0 font-weight-bold" style={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
                      {component.name}
                    </h4>
                    {component.is_gate ? (
                      <Badge variant="warning" style={{ flexShrink: 0 }}>Gate</Badge>
                    ) : (
                      <span className="small text-muted" style={{ flexShrink: 0 }}>
                        Weight {component.weight}% · max {round2(maxMarks)}
                      </span>
                    )}
                  </div>
                  {fieldLabels.length > 0 && (
                    <div className="small text-muted mb-2">Evaluates: {fieldLabels.join(', ')}</div>
                  )}
                  {!readOnly && <ScoringGuide component={component} />}

                  <div className="tas-wg-scores">
                    {component.criteria.map((criterion) => {
                      const key = weightedScoreErrorKey(component.id, criterion.id);
                      const value = scores[component.id]?.[criterion.id] ?? '';
                      return (
                        <Form.Group key={key} className="mb-0">
                          <Form.Label className="small font-weight-bold">{criterion.name}</Form.Label>
                          {readOnly ? (
                            <div className="small">{value === '' ? '—' : `${value} / ${CRITERION_MAX}`}</div>
                          ) : (
                            <Form.Control
                              type="number"
                              min={0}
                              max={CRITERION_MAX}
                              step="any"
                              value={value}
                              placeholder={`0–${CRITERION_MAX}`}
                              aria-label={`${component.name} ${criterion.name}`}
                              isInvalid={Boolean(errors[key])}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                onScoreChange?.(component.id, criterion.id, e.target.value);
                              }}
                              style={inputStyle}
                            />
                          )}
                          {errors[key] && <div className="small text-danger mt-1">{errors[key]}</div>}
                        </Form.Group>
                      );
                    })}
                  </div>

                  {(!readOnly || sectionFeedback.trim()) && (
                    <Form.Group className="mb-0 mt-3">
                      <Form.Label className="small font-weight-bold">Section feedback</Form.Label>
                      {readOnly ? (
                        <p className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>{sectionFeedback}</p>
                      ) : (
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={sectionFeedback}
                          placeholder="Add feedback for this component..."
                          aria-label={`${component.name} section feedback`}
                          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                            onFeedbackChange?.(component.id, event.target.value);
                          }}
                          style={feedbackStyle}
                        />
                      )}
                    </Form.Group>
                  )}

                  <div className="d-flex justify-content-between small mt-3" style={{ gap: '0.5rem' }}>
                    <span>
                      Component score: <strong>{format(average)}</strong> / {CRITERION_MAX}
                    </span>
                    {component.is_gate ? (
                      <span className="text-muted">Not counted in total. Reject if not met.</span>
                    ) : (
                      <span>
                        Marks: <strong>{average === null ? '—' : round2((maxMarks * average) / CRITERION_MAX)}</strong>
                        {' / '}
                        {round2(maxMarks)}
                      </span>
                    )}
                  </div>

                  {renderComponentExtras && <div className="mt-3">{renderComponentExtras(component)}</div>}
                </Card.Section>
              </Card>
            );
          })}
        </div>
      ))}

      <Card className="shadow-sm border-0 mb-3" style={{ background: '#f8f9fa' }}>
        <Card.Section className="py-3">
          <div className="d-flex justify-content-between align-items-center">
            <span className="small font-weight-bold text-muted text-uppercase mb-0" style={{ letterSpacing: '0.04em' }}>
              Total Score
            </span>
            <span className="h5 mb-0 font-weight-bold">
              {totals.earned} / {totals.max}
            </span>
          </div>
        </Card.Section>
      </Card>
    </div>
  );
};
