/**
 * Multi-select predefined feedback control using Paragon Dropdown + CheckboxSet.
 * Selected items appear as removable chips inside the toggle (not a count summary).
 */

import React from 'react';
import classNames from 'classnames';
import { Dropdown, Form } from '@openedx/paragon';

interface Props {
  controlId: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export const PredefinedFeedbackMultiSelect: React.FC<Props> = ({
  controlId,
  options,
  selected,
  onChange,
  className,
}) => {
  const orderedSelected = options.filter((option) => selected.includes(option));

  const applySelection = (nextSelected: string[]) => {
    onChange(options.filter((option) => nextSelected.includes(option)));
  };

  const toggleFeedback = (feedback: string) => {
    const nextSelected = selected.includes(feedback)
      ? selected.filter((item) => item !== feedback)
      : [...selected, feedback];
    applySelection(nextSelected);
  };

  const removeFeedback = (feedback: string, event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    applySelection(selected.filter((item) => item !== feedback));
  };

  return (
    <Dropdown
      className={classNames('tas-feedback-multiselect', className)}
      autoClose="outside"
    >
      <Dropdown.Toggle
        variant="outline-primary"
        id={controlId}
        className="tas-feedback-multiselect__toggle w-100"
      >
        <span className="tas-feedback-multiselect__content">
          {orderedSelected.length === 0 ? (
            <span className="tas-feedback-multiselect__placeholder">
              Select one or more predefined feedbacks…
            </span>
          ) : (
            orderedSelected.map((feedback) => (
              <span
                key={`${controlId}-chip-${feedback}`}
                role="toolbar"
                tabIndex={-1}
                aria-label={feedback}
                className="tas-feedback-multiselect__chip"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <span className="tas-feedback-multiselect__chip-label">{feedback}</span>
                <button
                  type="button"
                  className="tas-feedback-multiselect__chip-remove"
                  aria-label={`Remove ${feedback}`}
                  onClick={(event) => removeFeedback(feedback, event)}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Form.CheckboxSet
          name={controlId}
          value={selected}
          className="pgn__dropdown-filter-checkbox-group px-3 py-2"
          aria-label="Predefined feedback options"
        >
          {options.map((feedback) => (
            <Form.Checkbox
              key={`${controlId}-${feedback}`}
              value={feedback}
              onChange={() => toggleFeedback(feedback)}
            >
              {feedback}
            </Form.Checkbox>
          ))}
        </Form.CheckboxSet>
      </Dropdown.Menu>
    </Dropdown>
  );
};
