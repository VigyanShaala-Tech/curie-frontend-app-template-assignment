import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentForm } from './AssignmentForm';
import type { Template } from '../types';

const template: Template = {
  id: '1',
  template_type_id: '1',
  name: 'Personal SWOT',
  description: '',
  image_url: '',
  image_width: 794,
  image_height: 1123,
  thumbnail_url: '',
  fields: [
    {
      id: 'strengths', label: 'Strengths', type: 'textarea', required: true, section: 'Strengths',
    },
    {
      id: 'weaknesses', label: 'Weaknesses', type: 'textarea', required: true, section: 'Weaknesses',
    },
    {
      id: 'opportunities', label: 'Opportunities', type: 'textarea', required: true, section: 'Opportunities',
    },
    {
      id: 'threats', label: 'Threats', type: 'textarea', required: true, section: 'Threats',
    },
  ],
  field_positions: {
    strengths: {
      x: 10, y: 10, width: 80, height: 10,
    },
    weaknesses: {
      x: 10, y: 30, width: 80, height: 10,
    },
    opportunities: {
      x: 10, y: 50, width: 80, height: 10,
    },
    threats: {
      x: 10, y: 70, width: 80, height: 10,
    },
  },
  is_public: true,
  is_active: true,
  created_by: '',
  created_at: '',
  updated_at: '',
};

const filled = {
  strengths: 'Strong analytical skills',
  weaknesses: 'Tend to overthink',
  opportunities: 'Growing demand for AI',
  threats: 'High competition',
};

describe('AssignmentForm', () => {
  it('wizard shows one step at a time without Earlier answers', async () => {
    const onChange = jest.fn();
    render(
      <AssignmentForm
        template={template}
        values={filled}
        onChange={onChange}
        isMobile={false}
        mode="wizard"
      />,
    );

    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Strengths' })).toBeTruthy();
    expect(screen.queryByText('Earlier answers')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Strengths' })).toBeNull();
    expect(screen.queryByLabelText('Weaknesses')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Weaknesses →' }));
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Weaknesses' })).toBeTruthy();
    expect(screen.queryByText('Earlier answers')).toBeNull();
  });

  it('overview lists all saved responses and Edit opens then returns', async () => {
    const onChange = jest.fn();
    render(
      <AssignmentForm
        template={template}
        values={filled}
        onChange={onChange}
        isMobile={false}
        mode="overview"
      />,
    );

    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Strong analytical skills')).toBeTruthy();
    expect(screen.getByText('Tend to overthink')).toBeTruthy();
    expect(screen.getByText('Growing demand for AI')).toBeTruthy();
    expect(screen.getByText('High competition')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Weaknesses →' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit Opportunities' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Opportunities' })).toBeTruthy();
    const input = screen.getByLabelText('Opportunities') as HTMLTextAreaElement;
    expect(input.value).toBe('Growing demand for AI');

    await userEvent.clear(input);
    await userEvent.type(input, 'Updated opportunities');
    expect(onChange).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '← Back to answers' }));
    expect(screen.getByText('Earlier answers')).toBeTruthy();
    expect(screen.getByText('Tend to overthink')).toBeTruthy();
  });
});
