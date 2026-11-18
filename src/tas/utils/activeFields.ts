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

/** True when any active required field is empty (optional fields ignored). */
export function hasMissingRequiredFields(
  template: Template | null | undefined,
  formData: Record<string, string>,
): boolean {
  return getActiveFields(template).some(
    (field) => field.required && isFieldEmpty(formData, field.id),
  );
}
