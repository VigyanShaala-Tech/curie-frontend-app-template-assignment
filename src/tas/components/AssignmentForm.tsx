import React, {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
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
  /**
   * When true, show the saved-responses overview with per-section Edit
   * (reattempt / reopen). First-time drafts keep the step-by-step UI.
   */
  resubmissionMode?: boolean;
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

const syncTextareaHeight = (el: HTMLTextAreaElement | null) => {
  if (!el) {
    return;
  }
  // Reset to auto so scrollHeight reflects wrapped content, then expand.
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

const AutoResizeTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  value,
  onInput,
  ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    syncTextareaHeight(ref.current);
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      {...rest}
      value={value}
      onInput={(event) => {
        syncTextareaHeight(event.currentTarget);
        onInput?.(event);
      }}
    />
  );
};

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
  const placeholderId = `${id}-placeholder`;
  const guidanceText = field.guidance?.trim() || '';
  const placeholderText = field.placeholder?.trim() || '';
  const describedBy = [
    guidanceText ? guidanceId : null,
    placeholderText ? placeholderId : null,
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
  } else if (field.type === 'number' || field.type === 'date') {
    control = (
      <input
        {...common}
        type={field.type}
        placeholder={field.placeholder}
      />
    );
  } else if (field.type === 'textarea' || field.type === 'text') {
    // Template SWOT/response fields are often typed as `text` but still need
    // multi-line wrap + vertical auto-grow (single-line <input> truncates).
    control = (
      <AutoResizeTextarea
        {...common}
        className={
          field.type === 'text'
            ? 'assignment-field__textarea--auto assignment-field__textarea--from-text'
            : 'assignment-field__textarea--auto'
        }
        maxLength={field.maxChars}
        placeholder={field.placeholder}
      />
    );
  } else {
    control = (
      <input
        {...common}
        type="text"
        maxLength={field.maxChars}
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
      {guidanceText && (
        <p id={guidanceId} className="assignment-field__guidance">{field.guidance}</p>
      )}
      {placeholderText && (
        <p id={placeholderId} className="assignment-field__placeholder">{field.placeholder}</p>
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
  resubmissionMode = false,
  onActiveFieldChange,
}) => {
  const [capacityFull, setCapacityFull] = useState<Record<string, boolean>>({});
  const steps = useMemo(
    () => buildAssignmentSteps(getActiveFields(template)),
    [template],
  );
  const [activeStepKey, setActiveStepKey] = useState<string | null>(steps[0]?.key ?? null);
  /** In resubmission mode, null means the saved-responses overview. */
  const [resubmissionEditKey, setResubmissionEditKey] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requestedIndex = steps.findIndex((step) => step.key === activeStepKey);
  const activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const activeStep = steps[activeIndex];
  const showResubmissionOverview = resubmissionMode
    && (resubmissionEditKey == null || readOnly);

  useEffect(() => {
    if (!resubmissionMode) {
      setResubmissionEditKey(null);
    }
  }, [resubmissionMode]);

  // Preview (read-only) always shows the full responses overview.
  useEffect(() => {
    if (readOnly) {
      setResubmissionEditKey(null);
    }
  }, [readOnly]);

  useEffect(() => {
    if (showResubmissionOverview) {
      onActiveFieldChange?.(null);
      return;
    }
    onActiveFieldChange?.(activeStep?.fields[0]?.id ?? null);
  }, [activeStep, onActiveFieldChange, showResubmissionOverview]);

  const navigateTo = (index: number) => {
    const step = steps[index];
    if (!step) { return; }
    setActiveStepKey(step.key);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const openResubmissionSection = (index: number) => {
    const step = steps[index];
    if (!step) { return; }
    setActiveStepKey(step.key);
    setResubmissionEditKey(step.key);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const returnToResubmissionOverview = () => {
    setResubmissionEditKey(null);
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

  if (!activeStep && !showResubmissionOverview) {
    return <div className="assignment-form assignment-form--empty">No assignment fields are configured.</div>;
  }

  if (steps.length === 0) {
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

  const renderCurrentStep = (step: AssignmentStep, stepIndex: number) => {
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

  if (showResubmissionOverview) {
    return (
      <div className={`assignment-form${isMobile ? ' assignment-form--mobile' : ''}`} aria-label="Assignment form">
        <div className="assignment-progress">
          <div className="assignment-progress__meta">Step {steps.length} of {steps.length}</div>
        </div>

        <section className="assignment-earlier" aria-labelledby="assignment-earlier-heading">
          <div className="assignment-earlier__heading">
            <h3 id="assignment-earlier-heading">Earlier answers</h3>
            <p>Read your previous responses while updating your assignment.</p>
          </div>
          {steps.map((step, index) => (
            <div className="assignment-earlier-card assignment-earlier-card--overview" key={step.key}>
              <div className="assignment-earlier-card__summary">
                <div className="assignment-earlier-card__preview-block">
                  <div className="assignment-earlier-card__title">{step.title}</div>
                  <AnswerList step={step} values={values} />
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="assignment-earlier-card__edit"
                    onClick={() => openResubmissionSection(index)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const editingStep = resubmissionMode && resubmissionEditKey
    ? (steps.find((step) => step.key === resubmissionEditKey) ?? activeStep)
    : activeStep;
  const editingIndex = steps.findIndex((step) => step.key === editingStep.key);

  return (
    <div className={`assignment-form${isMobile ? ' assignment-form--mobile' : ''}`} aria-label="Assignment form">
      <div className="assignment-progress">
        <div className="assignment-progress__meta">Step {editingIndex + 1} of {steps.length}</div>
      </div>

      <section
        id="assignment-current-section"
        className="assignment-current"
      >
        <div className="assignment-current__heading">
          {normalized(editingStep.sectionTitle) !== normalized(editingStep.title) && (
            <div className="assignment-current__eyebrow">{editingStep.sectionTitle}</div>
          )}
          <h2 id="assignment-current-heading" ref={headingRef} tabIndex={-1}>{editingStep.title}</h2>
          {editingStep.instruction && (
            <p className="assignment-current__instruction">{editingStep.instruction}</p>
          )}
        </div>
        <div className="assignment-current__body">{renderCurrentStep(editingStep, editingIndex)}</div>
      </section>

      <div className="assignment-step-actions">
        {resubmissionMode ? (
          <button
            type="button"
            className="assignment-step-actions__secondary"
            onClick={returnToResubmissionOverview}
          >
            ← Back to responses
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
