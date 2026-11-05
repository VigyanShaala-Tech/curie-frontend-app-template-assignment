/**
 * Template-field instructor evaluation.
 *
 * Section headings and order come from the assignment template.
 * This branch has no CURIE review model. Scores and section feedback are taken
 * from saved feedback rows (field_id) or from an optional field_evaluation
 * object on the submission payload when one is present. Missing data stays blank.
 */

export const EVALUATION_DIMENSIONS = [
  'Task Relevance',
  'Reasoning / Understanding',
  'Specificity & Evidence',
] as const;

export type EvaluationDimension = typeof EVALUATION_DIMENSIONS[number];

export interface TemplateFieldRef {
  id: string;
  label: string;
}

export interface CriterionScoreInput {
  criterion?: string;
  score?: number | null;
}

export interface FieldEvaluationRecord {
  field_id?: string;
  comment?: string;
  criterion_scores?: CriterionScoreInput[];
}

export interface OptionalFieldEvaluation {
  field_feedback?: FieldEvaluationRecord[];
  gate_criterion_scores?: CriterionScoreInput[];
  overall_feedback?: string;
}

export interface FieldEvaluationSection {
  fieldId: string;
  label: string;
  scores: Record<EvaluationDimension, string>;
  feedback: string;
}

export interface FieldEvaluationRubricRow {
  field_id: string;
  comment: string;
  criterion_scores: Array<{ criterion: EvaluationDimension; score: number | null; max_score: number }>;
}

export interface FieldScoreDraft {
  [fieldId: string]: Partial<Record<EvaluationDimension, string>>;
}

export interface FieldFeedbackDraft {
  [fieldId: string]: string;
}

const emptyScores = (): Record<EvaluationDimension, string> => ({
  'Task Relevance': '',
  'Reasoning / Understanding': '',
  'Specificity & Evidence': '',
});

export function scoreErrorKey(fieldId: string, dimension: EvaluationDimension): string {
  return `${fieldId}::${dimension}`;
}

export function isFieldEvaluationRow(entry: unknown): entry is FieldEvaluationRecord & { field_id: string } {
  if (!entry || typeof entry !== 'object') {
    return false;
  }
  const fieldId = (entry as { field_id?: unknown }).field_id;
  return typeof fieldId === 'string' && fieldId.length > 0;
}

export function orderedTemplateFields(
  templateFields: Record<string, string> | null | undefined,
): TemplateFieldRef[] {
  if (!templateFields || typeof templateFields !== 'object' || Array.isArray(templateFields)) {
    return [];
  }
  const seen = new Set<string>();
  const fields: TemplateFieldRef[] = [];
  Object.entries(templateFields).forEach(([id, label]) => {
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    fields.push({
      id,
      label: typeof label === 'string' && label.trim() ? label : id,
    });
  });
  return fields;
}

/** Template types whose instructor review is one card per template field. */
const FIELD_EVALUATION_TYPE_SLUGS = new Set(['swot']);

export function shouldUseFieldEvaluation(
  rubricCriteriaCount: number,
  templateFieldCount: number,
  rubricsLoaded: boolean,
  templateTypeSlug?: string | null,
): boolean {
  if (!rubricsLoaded || templateFieldCount === 0) {
    return false;
  }
  if (rubricCriteriaCount === 0) {
    return true;
  }
  return FIELD_EVALUATION_TYPE_SLUGS.has((templateTypeSlug || '').trim().toLowerCase());
}

export function fieldRecordsFromRubrics(rubrics: unknown[] | null | undefined): FieldEvaluationRecord[] {
  const records: FieldEvaluationRecord[] = [];
  const seen = new Set<string>();
  (rubrics ?? []).forEach((entry) => {
    if (!isFieldEvaluationRow(entry) || seen.has(entry.field_id)) {
      return;
    }
    seen.add(entry.field_id);
    records.push(entry);
  });
  return records;
}

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return '';
  }
  return String(Number(value));
}

function scoresFromList(list: CriterionScoreInput[] | undefined): Record<EvaluationDimension, string> {
  const scores = emptyScores();
  EVALUATION_DIMENSIONS.forEach((dimension) => {
    const match = (list ?? []).find((item) => item?.criterion === dimension);
    scores[dimension] = formatScore(match?.score);
  });
  return scores;
}

/**
 * One section per template field, in template order.
 * Gate scores attach only when exactly one template field has no field row.
 * The gate does not create a comment.
 */
export function buildFieldSections(
  fields: TemplateFieldRef[],
  records: FieldEvaluationRecord[] | null | undefined,
  gateScores: CriterionScoreInput[] | null | undefined,
): FieldEvaluationSection[] {
  const byId = new Map<string, FieldEvaluationRecord>();
  (records ?? []).forEach((record) => {
    if (!record?.field_id || byId.has(record.field_id)) {
      return;
    }
    byId.set(record.field_id, record);
  });

  const unmatched = fields.filter((field) => !byId.has(field.id));
  const gate = gateScores ?? [];
  const gateHasScore = gate.some((item) => item?.score != null && Number.isFinite(Number(item.score)));
  const gateFieldId = gateHasScore && unmatched.length === 1 ? unmatched[0].id : null;

  return fields.map((field) => {
    const record = byId.get(field.id);
    const useGate = field.id === gateFieldId && !record;
    return {
      fieldId: field.id,
      label: field.label,
      scores: useGate ? scoresFromList(gate) : scoresFromList(record?.criterion_scores),
      feedback: typeof record?.comment === 'string' ? record.comment : '',
    };
  });
}

export function resolveFieldEvaluation(input: {
  templateFields: Record<string, string> | null | undefined;
  feedbackRubrics?: unknown[] | null;
  feedbackComment?: string | null;
  fieldEvaluation?: OptionalFieldEvaluation | null;
}): { fields: TemplateFieldRef[]; sections: FieldEvaluationSection[]; overall: string } {
  const fields = orderedTemplateFields(input.templateFields);
  const saved = fieldRecordsFromRubrics(input.feedbackRubrics);
  const external = input.fieldEvaluation ?? null;
  const usingSaved = saved.length > 0;
  const sections = buildFieldSections(
    fields,
    usingSaved ? saved : (external?.field_feedback ?? []),
    usingSaved ? [] : (external?.gate_criterion_scores ?? []),
  );
  const savedComment = typeof input.feedbackComment === 'string' ? input.feedbackComment : '';
  const externalOverall = typeof external?.overall_feedback === 'string' ? external.overall_feedback : '';
  const overall = usingSaved || savedComment.length > 0 ? savedComment : externalOverall;
  return { fields, sections, overall };
}

export function draftFromSections(sections: FieldEvaluationSection[]): {
  scores: FieldScoreDraft;
  feedback: FieldFeedbackDraft;
} {
  const scores: FieldScoreDraft = {};
  const feedback: FieldFeedbackDraft = {};
  sections.forEach((section) => {
    scores[section.fieldId] = { ...section.scores };
    feedback[section.fieldId] = section.feedback;
  });
  return { scores, feedback };
}

function parseScoreInput(rawInput: string): number | null {
  const trimmed = rawInput.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateFieldScoreInputs(
  fields: TemplateFieldRef[],
  scores: FieldScoreDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    const parsed = EVALUATION_DIMENSIONS.map((dimension) => (
      parseScoreInput(scores[field.id]?.[dimension] ?? '')
    ));
    if (parsed.every((value) => value === null)) {
      return;
    }
    EVALUATION_DIMENSIONS.forEach((dimension, index) => {
      const value = parsed[index];
      const key = scoreErrorKey(field.id, dimension);
      if (value === null) {
        errors[key] = 'Score is required.';
      } else if (Number.isNaN(value)) {
        errors[key] = 'Enter a valid number.';
      } else if (value > 10) {
        errors[key] = 'Score cannot be greater than 10.';
      } else if (value < 0) {
        errors[key] = 'Score cannot be less than 0.';
      }
    });
  });
  return errors;
}

export function buildFieldRubricPayload(
  fields: TemplateFieldRef[],
  scores: FieldScoreDraft,
  feedback: FieldFeedbackDraft,
): FieldEvaluationRubricRow[] {
  return fields.map((field) => ({
    field_id: field.id,
    comment: feedback[field.id] ?? '',
    criterion_scores: EVALUATION_DIMENSIONS.map((dimension) => {
      const parsed = parseScoreInput(scores[field.id]?.[dimension] ?? '');
      return {
        criterion: dimension,
        score: parsed === null || Number.isNaN(parsed) ? null : parsed,
        max_score: 10,
      };
    }),
  }));
}
