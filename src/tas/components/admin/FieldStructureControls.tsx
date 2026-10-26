import React from 'react';
import { Form } from '@openedx/paragon';
import type { FormField } from '../../types';

interface Props {
  field: FormField;
  sectionNames: string[];
  onChange: (field: FormField) => void;
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  marginBottom: 3,
  color: '#6B7280',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

export const FieldStructureControls: React.FC<Props> = ({
  field,
  sectionNames,
  onChange,
}) => {
  const style = field.displayStyle ?? 'cards';
  return (
    <>
      <Form.Group controlId={`field-section-${field.id}`} className="mb-2">
        <Form.Label style={LABEL_STYLE}>Section</Form.Label>
        <Form.Control
          list={`field-sections-${field.id}`}
          value={field.section ?? ''}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({
            ...field,
            section: event.target.value,
          })}
          placeholder="Choose or type a new section"
          size="sm"
        />
        <datalist id={`field-sections-${field.id}`}>
          {sectionNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </datalist>
        <Form.Text>Blank uses this field&apos;s label as its own section.</Form.Text>
      </Form.Group>

      <Form.Group controlId={`field-style-${field.id}`} className="mb-2">
        <Form.Label style={LABEL_STYLE}>Display style</Form.Label>
        <Form.Control
          as="select"
          value={style}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange({
            ...field,
            displayStyle: event.target.value as NonNullable<FormField['displayStyle']>,
          })}
          size="sm"
        >
          <option value="cards">Cards</option>
          <option value="table">Table</option>
          <option value="stages">Stages</option>
        </Form.Control>
      </Form.Group>

      {style === 'table' && (
        <div className="d-flex mb-2" style={{ gap: 8 }}>
          <Form.Group controlId={`field-row-${field.id}`} className="mb-0 flex-grow-1">
            <Form.Label style={LABEL_STYLE}>Row</Form.Label>
            <Form.Control
              size="sm"
              value={field.tableRow ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...field,
                tableRow: event.target.value,
              })}
              placeholder="e.g. Option 1"
            />
          </Form.Group>
          <Form.Group controlId={`field-column-${field.id}`} className="mb-0 flex-grow-1">
            <Form.Label style={LABEL_STYLE}>Column</Form.Label>
            <Form.Control
              size="sm"
              value={field.tableColumn ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...field,
                tableColumn: event.target.value,
              })}
              placeholder="e.g. Skills"
            />
          </Form.Group>
        </div>
      )}

      {style === 'stages' && (
        <div className="d-flex mb-2" style={{ gap: 8 }}>
          <Form.Group controlId={`field-stage-${field.id}`} className="mb-0 flex-grow-1">
            <Form.Label style={LABEL_STYLE}>Stage</Form.Label>
            <Form.Control
              size="sm"
              value={field.stage ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...field,
                stage: event.target.value,
              })}
              placeholder="e.g. Explore"
            />
          </Form.Group>
          <Form.Group controlId={`field-stage-order-${field.id}`} className="mb-0" style={{ width: 92 }}>
            <Form.Label style={LABEL_STYLE}>Order</Form.Label>
            <Form.Control
              type="number"
              min={1}
              size="sm"
              value={field.stageOrder ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange({
                ...field,
                stageOrder: event.target.value ? parseInt(event.target.value, 10) : undefined,
              })}
            />
          </Form.Group>
        </div>
      )}
    </>
  );
};
