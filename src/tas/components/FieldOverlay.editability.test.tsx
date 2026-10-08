import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldOverlay } from './FieldOverlay';
import { useTasStore } from '../store/tasStore';
import type { FormField, FieldPosition, Submission } from '../types';

const field: FormField = {
  id: 'goal',
  label: 'Goal',
  type: 'textarea',
  required: true,
};

const position: FieldPosition = {
  x: 0, y: 0, width: 20, height: 10,
};

const submitted: Submission = {
  id: '1',
  template_block_id: '1',
  student_id: 'student',
  course_id: 'course',
  usage_key: 'block',
  form_data: { goal: 'text' },
  status: 'submitted',
  version_number: 2,
  submitted_at: '2026-09-13T00:00:00Z',
  pdf_url: '',
  created_at: '',
  updated_at: '',
};

describe('FieldOverlay editability', () => {
  const openFieldEditor = jest.fn();

  beforeEach(() => {
    openFieldEditor.mockReset();
    useTasStore.setState({
      openFieldEditor,
      formData: { goal: 'text' },
      fieldCapacityFull: {},
      isMobile: false,
      submission: submitted,
    } as any);
  });

  it('does not infer inactivity from raw submitted status', async () => {
    render(
      <FieldOverlay
        field={field}
        position={position}
        isSelected={false}
        actualImageWidth={800}
        actualImageHeight={1000}
        isReadOnly={false}
      />,
    );
    await userEvent.click(screen.getByText('text'));
    expect(openFieldEditor).toHaveBeenCalledWith('goal');
  });

  it('stays inactive when the lifecycle passes read-only', async () => {
    render(
      <FieldOverlay
        field={field}
        position={position}
        isSelected={false}
        actualImageWidth={800}
        actualImageHeight={1000}
        isReadOnly
      />,
    );
    await userEvent.click(screen.getByText('text'));
    expect(openFieldEditor).not.toHaveBeenCalled();
  });
});
