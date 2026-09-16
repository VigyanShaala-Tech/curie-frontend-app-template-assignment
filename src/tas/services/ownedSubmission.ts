import { blockTemplatesApi, submissionsApi, templatesApi } from './api';
import type { MfeContext, Submission, Template } from '../types';

/** Reload-safe bootstrap: existing row for this block, or a new draft if none exists. */
export async function loadOwnedSubmission(ctx: MfeContext): Promise<Submission | null> {
  const block = await blockTemplatesApi.list(ctx.usageKey);
  const first = block.templates?.[0];
  if (!first) {
    return null;
  }
  return submissionsApi.createOrGetDraft({
    template_block_id: String(first.template_block_id),
    usage_key: ctx.usageKey,
    // TemplateBlock.course_id is canonical; derived URL course ids can trail a '+'.
    course_id: block.course_id || ctx.courseId,
    student_id: ctx.studentId,
  });
}

export async function loadAssignedTemplate(ctx: MfeContext): Promise<Template | null> {
  const block = await blockTemplatesApi.list(ctx.usageKey);
  const first = block.templates?.[0];
  if (!first) return null;
  return templatesApi.get(first.template.id);
}
