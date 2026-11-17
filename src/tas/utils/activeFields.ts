import type { FormField, Template } from '../types';

/**
 * Active/editable fields for the current submission canvas:
 * template fields that have a position (present and editable on the canvas).
 */
export function getActiveFields(template: Template | null | undefined): FormField[] {
  if (!template) return [];
  return template.fields.filter((field) => Boolean(template.field_positions[field.id]));
}

export function isFieldEmpty(
  formData: Record<string, string>,
  fieldId: string,
): boolean {
  return !(formData[fieldId] ?? '').trim();
}

/** True when every required active field has a non-empty response. */
export function areRequiredFieldsComplete(
  template: Template | null | undefined,
  formData: Record<string, string>,
): boolean {
  const required = getActiveFields(template).filter((field) => field.required);
  if (required.length === 0) return true;
  return required.every((field) => !isFieldEmpty(formData, field.id));
}
