import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldStructureControls } from './FieldStructureControls';
import type { FormField } from '../../types';

const baseField: FormField = {
  id: 'career',
  label: 'Career',
  type: 'text',
  required: false,
};

describe('FieldStructureControls', () => {
  it('lets an instructor select or create a section and choose Table metadata', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <FieldStructureControls
        field={baseField}
        sectionNames={['Career Exploration']}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByLabelText('Section'), 'Career Exploration');
    expect(onChange).toHaveBeenCalled();

    rerender(
      <FieldStructureControls
        field={{ ...baseField, section: 'Career Exploration', displayStyle: 'table' }}
        sectionNames={['Career Exploration']}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('Row')).toBeTruthy();
    expect(screen.getByLabelText('Column')).toBeTruthy();
  });

  it('shows stage name and order only for Stages', () => {
    render(
      <FieldStructureControls
        field={{ ...baseField, displayStyle: 'stages' }}
        sectionNames={[]}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText('Stage')).toBeTruthy();
    expect(screen.getByLabelText('Order')).toBeTruthy();
  });
});
