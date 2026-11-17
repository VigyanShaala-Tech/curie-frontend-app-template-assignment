import React, { useMemo, useRef, useState } from 'react';
import type { FormField, Template } from '../types';
import { getActiveFields } from '../utils/activeFields';
import { buildAssignmentSteps } from '../utils/assignmentStructure';
import type { AssignmentStep } from '../utils/assignmentStructure';
import { applyTextCandidate } from '../utils/clampTextToField';
import { resolveFieldLayout } from '../utils/fieldLayout';

export type AssignmentFormMode = 'wizard' | 'overview';

interface Props {
  template: Template;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  isMobile: boolean;
  /** wizard = first-time step-by-step; overview = all saved responses with Edit. */
  mode?: AssignmentFormMode;
}

interface FieldControlProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  capacityFull: boolean;
  hideVisualLabel?: boolean;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

const FieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  capacityFull,
  hideVisualLabel = false,
}) => {
  const id = `assignment-field-${field.id}`;
  const warningId = `${id}-capacity-warning`;
  const guidanceId = `${id}-guidance`;
  const describedBy = [
    field.guidance?.trim() ? guidanceId : null,
    capacityFull ? warningId : null,
  ].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    required: field.required,
    'aria-required': field.required || undefined,
    'aria-describedby': describedBy,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onChange(event.target.value),
  };

  let control: React.ReactNode;
  if (field.type === 'select') {
    control = (
      <select {...common}>
        <option value="">Select…</option>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === 'checkbox') {
    control = (
      <input
        id={id}
        type="checkbox"
        checked={value === 'true'}
        required={field.required}
        aria-required={field.required || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked ? 'true' : '')}
      />
    );
  } else if (field.type === 'radio') {
    control = (
      <fieldset className="assignment-field__radio-fieldset">
        <legend className="assignment-field__radio-legend">
          {field.label}{field.required && <span aria-hidden="true"> *</span>}
        </legend>
        <div className="assignment-field__radio-group">
          {(field.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="radio"
                name={id}
                value={option}
                checked={value === option}
                required={field.required}
                aria-describedby={describedBy}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  } else if (field.type === 'textarea') {
    control = <textarea {...common} rows={4} placeholder={field.placeholder} />;
  } else {
    control = (
      <input
        {...common}
        type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <div className="assignment-field">
      {field.type !== 'radio' && (
        <div className={`assignment-field__label${hideVisualLabel ? ' assignment-field__label--sr-only' : ''}`}>
          <label htmlFor={id}>{field.label}</label>
          {field.required && <span aria-hidden="true"> *</span>}
        </div>
      )}
      {field.guidance?.trim() && (
        <p id={guidanceId} className="assignment-field__guidance">{field.guidance}</p>
      )}
      {control}
      {capacityFull && (
        <p id={warningId} className="assignment-field__warning" role="status">
          This field has reached its maximum capacity.
        </p>
      )}
    </div>
  );
};

const AnswerList: React.FC<{ step: AssignmentStep; values: Record<string, string> }> = ({ step, values }) => (
  <div className="assignment-earlier-answer-list">
    {step.fields.map((field) => (
      <div className="assignment-earlier-answer" key={field.id}>
        {(step.fields.length > 1 || normalized(field.label) !== normalized(step.title)) && (
          <div className="assignment-earlier-answer__label">{field.label}</div>
        )}
        <div className="assignment-earlier-answer__value">
          {values[field.id]?.trim() || <span>Not answered yet</span>}
        </div>
      </div>
    ))}
  </div>
);

export const AssignmentForm: React.FC<Props> = ({
  template,
  values,
  onChange,
  isMobile,
  mode = 'wizard',
}) => {
  const [capacityFull, setCapacityFull] = useState<Record<string, boolean>>({});
  const steps = useMemo(() => buildAssignmentSteps(getActiveFields(template)), [template]);
  const [activeStepKey, setActiveStepKey] = useState<string | null>(steps[0]?.key ?? null);
  /** When set in overview mode, show the single-section editor for that step. */
  const [editingStepKey, setEditingStepKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const wizardIndex = (() => {
    const requested = steps.findIndex((step) => step.key === activeStepKey);
    return requested >= 0 ? requested : 0;
  })();

  const overviewEditIndex = editingStepKey
    ? steps.findIndex((step) => step.key === editingStepKey)
    : -1;

  const activeIndex = mode === 'overview' && overviewEditIndex >= 0
    ? overviewEditIndex
    : wizardIndex;
  const activeStep = steps[activeIndex];
  const showOverviewList = mode === 'overview' && overviewEditIndex < 0;

  const navigateTo = (index: number) => {
    const step = steps[index];
    if (!step) { return; }
    setActiveStepKey(step.key);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const openOverviewEdit = (index: number) => {
    const step = steps[index];
    if (!step) { return; }
    setEditingStepKey(step.key);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const returnToOverview = () => {
    setEditingStepKey(null);
  };

  const updateField = (field: FormField, candidate: string) => {
    let next = candidate;
    let full = false;
    const position = template.field_positions[field.id];
    if (position && (field.type === 'text' || field.type === 'textarea')) {
      const layout = resolveFieldLayout(
        field,
        position,
        template.image_width || 794,
        template.image_height || 1123,
      );
      const result = applyTextCandidate(values[field.id] ?? '', candidate, layout);
      next = result.value;
      full = result.capacityFull;
    }
    setCapacityFull((current) => ({ ...current, [field.id]: full }));
    onChange(field.id, next);
  };

  if (!steps.length) {
    return <div className="assignment-form assignment-form--empty">No assignment fields are configured.</div>;
  }

  const renderField = (field: FormField, hideVisualLabel = false) => (
    <FieldControl
      key={field.id}
      field={field}
      value={values[field.id] ?? ''}
      onChange={(value) => updateField(field, value)}
      capacityFull={Boolean(capacityFull[field.id])}
      hideVisualLabel={hideVisualLabel}
    />
  );

  const renderStepBody = (step: AssignmentStep, stepIndex: number) => {
    const hideSingleLabel = step.fields.length === 1
      && normalized(step.fields[0].label) === normalized(step.title);

    if (step.displayStyle === 'table') {
      if (isMobile) {
        return <div className="assignment-table-row-card">{step.fields.map((field) => renderField(field))}</div>;
      }
      return (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>{step.fields.map((field) => <th key={field.id}>{field.tableColumn || field.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{step.fields.map((field) => <td key={field.id}>{renderField(field, true)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (step.displayStyle === 'stages') {
      return (
        <div className="assignment-current-stage">
          <span className="assignment-current-stage__number">{step.ordinal ?? stepIndex + 1}</span>
          <div className="assignment-stage-fields">{step.fields.map((field) => renderField(field, hideSingleLabel))}</div>
        </div>
      );
    }

    return (
      <div className="assignment-cards">
        {step.fields.map((field) => renderField(field, hideSingleLabel))}
      </div>
    );
  };

  const progressLabel = showOverviewList
    ? `Step ${steps.length} of ${steps.length}`
    : `Step ${activeIndex + 1} of ${steps.length}`;

  if (showOverviewList) {
    return (
      <div
        className={`assignment-form assignment-form--overview${isMobile ? ' assignment-form--mobile' : ''}`}
        aria-label="Assignment form"
      >
        <div className="assignment-progress">
          <div className="assignment-progress__meta">{progressLabel}</div>
        </div>

        <section className="assignment-earlier" aria-labelledby="assignment-earlier-heading">
          <div className="assignment-earlier__heading">
            <h3 id="assignment-earlier-heading">Earlier answers</h3>
            <p>Read your previous responses while updating your assignment.</p>
          </div>
          {steps.map((step, index) => (
            <details
              className="assignment-earlier-card"
              key={step.key}
              open
            >
              <summary>
                <span className="assignment-earlier-card__title">{step.title}</span>
                <button
                  type="button"
                  className="assignment-earlier-card__edit"
                  aria-label={`Edit ${step.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openOverviewEdit(index);
                  }}
                >
                  Edit
                </button>
              </summary>
              <AnswerList step={step} values={values} />
            </details>
          ))}
        </section>
      </div>
    );
  }

  if (!activeStep) {
    return <div className="assignment-form assignment-form--empty">No assignment fields are configured.</div>;
  }

  return (
    <div
      className={`assignment-form${mode === 'overview' ? ' assignment-form--overview-edit' : ''}${isMobile ? ' assignment-form--mobile' : ''}`}
      aria-label="Assignment form"
    >
      <div className="assignment-progress">
        <div className="assignment-progress__meta">{progressLabel}</div>
      </div>

      <section id="assignment-current-section" className="assignment-current">
        <div className="assignment-current__heading">
          {normalized(activeStep.sectionTitle) !== normalized(activeStep.title) && (
            <div className="assignment-current__eyebrow">{activeStep.sectionTitle}</div>
          )}
          <h2 id="assignment-current-heading" ref={headingRef} tabIndex={-1}>{activeStep.title}</h2>
          {activeStep.instruction && (
            <p className="assignment-current__instruction">{activeStep.instruction}</p>
          )}
        </div>
        <div className="assignment-current__body">{renderStepBody(activeStep, activeIndex)}</div>
      </section>

      <div className="assignment-step-actions">
        {mode === 'overview' ? (
          <button
            type="button"
            className="assignment-step-actions__secondary"
            onClick={returnToOverview}
          >
            ← Back to answers
          </button>
        ) : (
          <>
            <button
              type="button"
              className="assignment-step-actions__secondary"
              disabled={activeIndex === 0}
              onClick={() => navigateTo(activeIndex - 1)}
            >
              {activeIndex > 0 ? `← ${steps[activeIndex - 1].title}` : 'Back'}
            </button>
            {activeIndex < steps.length - 1 && (
              <button
                type="button"
                className="assignment-step-actions__primary"
                onClick={() => navigateTo(activeIndex + 1)}
              >
                {`${steps[activeIndex + 1].title} →`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
