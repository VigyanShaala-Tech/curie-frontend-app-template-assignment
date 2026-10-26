import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import type { FormField, Template } from '../types';
import { getActiveFields } from '../utils/activeFields';
import { buildAssignmentSteps } from '../utils/assignmentStructure';
import type { AssignmentStep } from '../utils/assignmentStructure';
import { applyTextCandidate } from '../utils/clampTextToField';
import { resolveFieldLayout } from '../utils/fieldLayout';

interface Props {
  template: Template;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  isMobile: boolean;
  readOnly?: boolean;
  onActiveFieldChange?: (fieldId: string | null) => void;
}

interface FieldControlProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  readOnly: boolean;
  capacityFull: boolean;
  hideVisualLabel?: boolean;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();

const FieldControl: React.FC<FieldControlProps> = ({
  field,
  value,
  onChange,
  onFocus,
  readOnly,
  capacityFull,
  hideVisualLabel = false,
}) => {
  const id = `assignment-field-${field.id}`;
  const countId = `${id}-count`;
  const warningId = `${id}-capacity-warning`;
  const guidanceId = `${id}-guidance`;
  const describedBy = [
    field.guidance?.trim() ? guidanceId : null,
    field.maxChars != null ? countId : null,
    capacityFull ? warningId : null,
  ].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    value,
    disabled: readOnly,
    required: field.required,
    'aria-required': field.required || undefined,
    'aria-describedby': describedBy,
    onFocus,
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
        disabled={readOnly}
        required={field.required}
        aria-required={field.required || undefined}
        aria-describedby={describedBy}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.checked ? 'true' : '')}
      />
    );
  } else if (field.type === 'radio') {
    control = (
      <fieldset className="assignment-field__radio-fieldset" disabled={readOnly}>
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
                disabled={readOnly}
                required={field.required}
                aria-describedby={describedBy}
                onFocus={onFocus}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  } else if (field.type === 'textarea') {
    control = (
      <textarea
        {...common}
        rows={4}
        maxLength={field.maxChars}
        placeholder={field.placeholder}
      />
    );
  } else {
    control = (
      <input
        {...common}
        type={field.type === 'number' || field.type === 'date' ? field.type : 'text'}
        maxLength={field.type === 'text' ? field.maxChars : undefined}
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
      {field.maxChars != null && (field.type === 'text' || field.type === 'textarea') && (
        <span id={countId} className="assignment-field__count">{value.length}/{field.maxChars}</span>
      )}
      {capacityFull && (
        <p id={warningId} className="assignment-field__warning" role="status">
          This field has reached its maximum capacity on the template.
        </p>
      )}
    </div>
  );
};

interface AnswerListProps {
  step: AssignmentStep;
  values: Record<string, string>;
}

const AnswerList: React.FC<AnswerListProps> = ({ step, values }) => (
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
  readOnly = false,
  onActiveFieldChange,
}) => {
  const [capacityFull, setCapacityFull] = useState<Record<string, boolean>>({});
  const steps = useMemo(
    () => buildAssignmentSteps(getActiveFields(template)),
    [template],
  );
  const [activeStepKey, setActiveStepKey] = useState<string | null>(steps[0]?.key ?? null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestedIndex = steps.findIndex((step) => step.key === activeStepKey);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const activeStep = steps[activeIndex];

  useEffect(() => {
    onActiveFieldChange?.(activeStep?.fields[0]?.id ?? null);
  }, [activeStep, onActiveFieldChange]);

  const navigateTo = (index: number) => {
    const step = steps[index];
    if (!step) { return; }
    setActiveStepKey(step.key);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const updateField = (field: FormField, candidate: string) => {
    let next = candidate;
    let full = false;
    if (field.type === 'text' || field.type === 'textarea') {
      if (field.maxChars != null && next.length > field.maxChars) {
        next = next.slice(0, field.maxChars);
        full = true;
      }
      const position = template.field_positions[field.id];
      if (position) {
        const layout = resolveFieldLayout(
          field,
          position,
          template.image_width || 794,
          template.image_height || 1123,
        );
        const result = applyTextCandidate(values[field.id] ?? '', next, layout);
        next = result.value;
        full = full || result.capacityFull;
      }
    }
    setCapacityFull((current) => ({ ...current, [field.id]: full }));
    onChange(field.id, next);
  };

  if (!activeStep) {
    return <div className="assignment-form assignment-form--empty">No assignment fields are configured.</div>;
  }

  const renderField = (field: FormField, hideVisualLabel = false) => (
    <FieldControl
      key={field.id}
      field={field}
      value={values[field.id] ?? ''}
      onChange={(value) => updateField(field, value)}
      onFocus={() => onActiveFieldChange?.(field.id)}
      readOnly={readOnly}
      capacityFull={Boolean(capacityFull[field.id])}
      hideVisualLabel={hideVisualLabel}
    />
  );

  const renderCurrentStep = () => {
    const hideSingleLabel = activeStep.fields.length === 1
      && normalized(activeStep.fields[0].label) === normalized(activeStep.title);

    if (activeStep.displayStyle === 'table') {
      if (isMobile) {
        return <div className="assignment-table-row-card">{activeStep.fields.map((field) => renderField(field))}</div>;
      }
      return (
        <div className="assignment-table-wrap">
          <table className="assignment-table">
            <thead>
              <tr>{activeStep.fields.map((field) => <th key={field.id}>{field.tableColumn || field.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{activeStep.fields.map((field) => <td key={field.id}>{renderField(field, true)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      );
    }

    if (activeStep.displayStyle === 'stages') {
      return (
        <div className="assignment-current-stage">
          <span className="assignment-current-stage__number">{activeStep.ordinal ?? activeIndex + 1}</span>
          <div className="assignment-stage-fields">{activeStep.fields.map((field) => renderField(field, hideSingleLabel))}</div>
        </div>
      );
    }

    return (
      <div className="assignment-cards">
        {activeStep.fields.map((field) => renderField(field, hideSingleLabel))}
      </div>
    );
  };

  const earlierSteps = steps.slice(0, activeIndex);
  return (
    <div className={`assignment-form${isMobile ? ' assignment-form--mobile' : ''}`} aria-label="Assignment form">
      <div className="assignment-progress">
        <div className="assignment-progress__meta">Step {activeIndex + 1} of {steps.length}</div>
      </div>

      {earlierSteps.length > 0 && (
        <section className="assignment-earlier" aria-labelledby="assignment-earlier-heading">
          <div className="assignment-earlier__heading">
            <h3 id="assignment-earlier-heading">Earlier answers</h3>
            <p>Read your previous responses while writing this section.</p>
          </div>
          {earlierSteps.map((step, index) => (
            <details
              className="assignment-earlier-card"
              key={step.key}
              open={index === earlierSteps.length - 1}
            >
              <summary>{step.title}</summary>
              <AnswerList step={step} values={values} />
            </details>
          ))}
        </section>
      )}

      <section
        id="assignment-current-section"
        className="assignment-current"
      >
        <div className="assignment-current__heading">
          {normalized(activeStep.sectionTitle) !== normalized(activeStep.title) && (
            <div className="assignment-current__eyebrow">{activeStep.sectionTitle}</div>
          )}
          <h2 id="assignment-current-heading" ref={headingRef} tabIndex={-1}>{activeStep.title}</h2>
          {activeStep.instruction && (
            <p className="assignment-current__instruction">{activeStep.instruction}</p>
          )}
        </div>
        <div className="assignment-current__body">{renderCurrentStep()}</div>
      </section>

      <div className="assignment-step-actions">
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
      </div>
    </div>
  );
};
