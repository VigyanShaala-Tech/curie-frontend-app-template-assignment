/**
 * Weighted rubrics (schema_version 2): sections → components → criteria → indicators.
 *
 * Each criterion is scored 0–10 and its indicator marks add up to 10. A component's
 * score is the average of its criterion scores; it is worth 10 × weight% marks and
 * earns that × (score ÷ 10). Gate components have 0% weight and only decide whether
 * the submission can be accepted. Mirrors tas_app/utils/rubric_scoring.py.
 */

import type {
  WeightedComponent,
  WeightedCriterion,
  WeightedFeedbackRow,
  WeightedIndicator,
  WeightedSection,
} from '../types';

export const CRITERION_MAX = 10;
export const WEIGHT_TOTAL = 100;
const TOLERANCE = 1e-6;

export const DEFAULT_CRITERIA_NAMES = [
  'Task Relevance',
  'Reasoning / Understanding',
  'Specificity & Evidence',
];

let idSequence = 0;

export function newRubricId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSequence}`;
}

export function emptyIndicator(): WeightedIndicator {
  return { text: '', marks: 0 };
}

export function emptyCriterion(name = ''): WeightedCriterion {
  return { id: newRubricId('crit'), name, indicators: [emptyIndicator()] };
}

export function emptyComponent(): WeightedComponent {
  return {
    id: newRubricId('comp'),
    name: '',
    learning_objective: '',
    learning_outcome: '',
    field_ids: [],
    weight: 0,
    is_gate: false,
    criteria: DEFAULT_CRITERIA_NAMES.map((name) => emptyCriterion(name)),
    feedbacks: [],
  };
}

export function emptySection(): WeightedSection {
  return { id: newRubricId('sec'), title: '', components: [emptyComponent()] };
}

export function allComponents(sections: WeightedSection[] | null | undefined): WeightedComponent[] {
  return (sections ?? []).flatMap((section) => section.components ?? []);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumIndicatorMarks(indicators: WeightedIndicator[]): number {
  return indicators.reduce((sum, indicator) => sum + toNumber(indicator.marks), 0);
}

export function totalWeight(sections: WeightedSection[]): number {
  return allComponents(sections)
    .filter((component) => !component.is_gate)
    .reduce((sum, component) => sum + toNumber(component.weight), 0);
}

export function isCloseTo(value: number, target: number): boolean {
  return Math.abs(value - target) <= TOLERANCE;
}

/** Problems that block saving; empty when the rubric is valid. Mirrors the backend check. */
export function validateWeightedRubric(name: string, sections: WeightedSection[]): string[] {
  const errors: string[] = [];
  if (!name.trim()) {
    errors.push('Rubric name is required.');
  }
  if (sections.length === 0) {
    errors.push('Add at least one section.');
    return errors;
  }
  sections.forEach((section, sIndex) => {
    const label = section.title.trim() || `Section ${sIndex + 1}`;
    if (!section.title.trim()) {
      errors.push(`Section ${sIndex + 1} needs a title.`);
    }
    if (section.components.length === 0) {
      errors.push(`"${label}" needs at least one component.`);
    }
    section.components.forEach((component, cIndex) => {
      const cLabel = component.name.trim() || `Component ${cIndex + 1} in ${label}`;
      if (!component.name.trim()) {
        errors.push(`Component ${cIndex + 1} in ${label} needs a name.`);
      }
      if (toNumber(component.weight) < 0) {
        errors.push(`${cLabel}: weight must be 0 or more.`);
      }
      if (component.is_gate && toNumber(component.weight) > TOLERANCE) {
        errors.push(`${cLabel}: a gate component must have 0% weight.`);
      }
      if (component.criteria.length === 0) {
        errors.push(`${cLabel} needs at least one criterion.`);
      }
      component.criteria.forEach((criterion, kIndex) => {
        const kLabel = criterion.name.trim() || `criterion ${kIndex + 1}`;
        if (!criterion.name.trim()) {
          errors.push(`${cLabel}: criterion ${kIndex + 1} needs a name.`);
        }
        if (criterion.indicators.length === 0) {
          errors.push(`${cLabel} / ${kLabel} needs at least one indicator.`);
          return;
        }
        if (criterion.indicators.some((indicator) => !indicator.text.trim())) {
          errors.push(`${cLabel} / ${kLabel}: every indicator needs text.`);
        }
        const total = sumIndicatorMarks(criterion.indicators);
        if (!isCloseTo(total, CRITERION_MAX)) {
          errors.push(`${cLabel} / ${kLabel}: indicator marks must add up to 10 (now ${total}).`);
        }
      });
    });
  });
  const weight = totalWeight(sections);
  if (allComponents(sections).length > 0 && !isCloseTo(weight, WEIGHT_TOTAL)) {
    errors.push(`Component weights must add up to 100% (now ${weight}%).`);
  }
  return errors;
}

/** Trim text, drop blank indicators/feedbacks before saving. */
export function cleanSectionsForSave(sections: WeightedSection[]): WeightedSection[] {
  return sections.map((section) => ({
    ...section,
    title: section.title.trim(),
    components: section.components.map((component) => ({
      ...component,
      name: component.name.trim(),
      learning_objective: component.learning_objective.trim(),
      learning_outcome: component.learning_outcome.trim(),
      weight: component.is_gate ? 0 : toNumber(component.weight),
      feedbacks: (component.feedbacks ?? []).map((fb) => fb.trim()).filter(Boolean),
      criteria: component.criteria.map((criterion) => ({
        ...criterion,
        name: criterion.name.trim(),
        indicators: criterion.indicators
          .map((indicator) => ({ text: indicator.text.trim(), marks: toNumber(indicator.marks) }))
          .filter((indicator) => indicator.text || indicator.marks),
      })),
    })),
  }));
}

const TRAILING_MARKS_RE = /\s*\((\d+(?:\.\d+)?)\)\s*[;,.]?\s*$/;
const BULLET_RE = /^\s*(?:[•●▪◦*\-–]|\d+[.)])\s+/;

/**
 * Split pasted rubric text into indicators. Lines (or `;`-separated parts that end in
 * a "(n)" mark, as in the Excel rubric) become separate indicators; "(n)" becomes marks.
 */
export function parsePastedIndicators(text: string): WeightedIndicator[] {
  const parts: string[] = [];
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const pieces = trimmed.split(/;\s*/).map((piece) => piece.trim()).filter(Boolean);
    const allMarked = pieces.length > 1 && pieces.every((piece) => TRAILING_MARKS_RE.test(piece));
    if (allMarked) {
      parts.push(...pieces);
    } else {
      parts.push(trimmed);
    }
  });
  return parts.map((part) => {
    const withoutBullet = part.replace(BULLET_RE, '');
    const match = withoutBullet.match(TRAILING_MARKS_RE);
    if (!match) {
      return { text: withoutBullet.trim(), marks: 0 };
    }
    return {
      text: withoutBullet.slice(0, match.index).trim(),
      marks: Number(match[1]),
    };
  }).filter((indicator) => indicator.text.length > 0);
}

// ─── Grading ────────────────────────────────────────────────────────────────

/** componentId → criterionId → raw input ('' = not scored). */
export type WeightedScoreDraft = Record<string, Record<string, string>>;

/** componentId → section feedback. Blank means the instructor left it empty. */
export type WeightedFeedbackDraft = Record<string, string>;

export interface CurieNamedScore {
  criterion?: string;
  score?: number | null;
}

export interface CurieFieldSource {
  field_id: string;
  comment?: string;
  criterion_scores?: CurieNamedScore[];
}

/** The parts of a CURIE review that can prefill a weighted grading form. */
export interface CurieWeightedSource {
  gate_criterion_scores?: CurieNamedScore[];
  field_feedback?: CurieFieldSource[];
}

export function parseScore(raw: string | undefined): number | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isValidScore(value: number | null): value is number {
  return value !== null && !Number.isNaN(value) && value >= 0 && value <= CRITERION_MAX;
}

/** Average of the valid criterion scores, or null when none is entered. */
export function componentAverage(
  component: WeightedComponent,
  scores: Record<string, string> | undefined,
): number | null {
  const values = component.criteria
    .map((criterion) => parseScore(scores?.[criterion.id]))
    .filter(isValidScore);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function componentMaxMarks(component: WeightedComponent): number {
  return component.is_gate ? 0 : (CRITERION_MAX * toNumber(component.weight)) / WEIGHT_TOTAL;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function weightedTotals(sections: WeightedSection[], draft: WeightedScoreDraft): {
  earned: number;
  max: number;
} {
  let earned = 0;
  let max = 0;
  allComponents(sections).forEach((component) => {
    if (component.is_gate) return;
    const componentMax = componentMaxMarks(component);
    max += componentMax;
    const average = componentAverage(component, draft[component.id]);
    if (average !== null) {
      earned += (componentMax * average) / CRITERION_MAX;
    }
  });
  return { earned: round2(earned), max: round2(max) };
}

export function weightedScoreErrorKey(componentId: string, criterionId: string): string {
  return `${componentId}::${criterionId}`;
}

/** Every criterion of every component (gates included) needs a 0–10 score. */
export function validateWeightedScores(
  sections: WeightedSection[],
  draft: WeightedScoreDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};
  allComponents(sections).forEach((component) => {
    component.criteria.forEach((criterion) => {
      const value = parseScore(draft[component.id]?.[criterion.id]);
      const key = weightedScoreErrorKey(component.id, criterion.id);
      if (value === null) {
        errors[key] = 'Score is required.';
      } else if (Number.isNaN(value)) {
        errors[key] = 'Enter a valid number.';
      } else if (value > CRITERION_MAX) {
        errors[key] = 'Score cannot be greater than 10.';
      } else if (value < 0) {
        errors[key] = 'Score cannot be less than 0.';
      }
    });
  });
  return errors;
}

export function buildWeightedFeedbackPayload(
  sections: WeightedSection[],
  draft: WeightedScoreDraft,
  feedback: WeightedFeedbackDraft = {},
): WeightedFeedbackRow[] {
  return allComponents(sections).map((component) => ({
    component_id: component.id,
    component: component.name,
    comment: feedback[component.id] ?? '',
    criterion_scores: component.criteria.map((criterion) => {
      const value = parseScore(draft[component.id]?.[criterion.id]);
      return {
        criterion_id: criterion.id,
        criterion: criterion.name,
        score: value === null || Number.isNaN(value) ? null : value,
        max_score: CRITERION_MAX,
      };
    }),
  }));
}

export function isWeightedFeedbackRow(entry: unknown): entry is WeightedFeedbackRow {
  return Boolean(entry) && typeof entry === 'object'
    && typeof (entry as { component_id?: unknown }).component_id === 'string'
    && (entry as { component_id: string }).component_id.length > 0;
}

function rowsByComponent(rows: unknown[] | null | undefined): Map<string, WeightedFeedbackRow> {
  const byComponent = new Map<string, WeightedFeedbackRow>();
  (rows ?? []).forEach((row) => {
    if (isWeightedFeedbackRow(row)) byComponent.set(row.component_id, row);
  });
  return byComponent;
}

/** Rebuild a score draft from saved feedback rows (matches by id, then by criterion name). */
export function draftFromWeightedFeedback(
  sections: WeightedSection[],
  rows: unknown[] | null | undefined,
): WeightedScoreDraft {
  const byComponent = rowsByComponent(rows);
  const draft: WeightedScoreDraft = {};
  allComponents(sections).forEach((component) => {
    const row = byComponent.get(component.id);
    if (!row) return;
    const scores: Record<string, string> = {};
    component.criteria.forEach((criterion) => {
      const match = (row.criterion_scores ?? []).find((item) => item.criterion_id === criterion.id)
        ?? (row.criterion_scores ?? []).find((item) => item.criterion === criterion.name);
      if (match?.score != null && Number.isFinite(Number(match.score))) {
        scores[criterion.id] = String(match.score);
      }
    });
    draft[component.id] = scores;
  });
  return draft;
}

/** Section feedback saved on each component row. Missing comments stay absent. */
export function feedbackFromWeightedRows(
  sections: WeightedSection[],
  rows: unknown[] | null | undefined,
): WeightedFeedbackDraft {
  const byComponent = rowsByComponent(rows);
  const feedback: WeightedFeedbackDraft = {};
  allComponents(sections).forEach((component) => {
    const comment = byComponent.get(component.id)?.comment;
    if (typeof comment === 'string') {
      feedback[component.id] = comment;
    }
  });
  return feedback;
}

function normCriterionName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function finiteScores(items: CurieNamedScore[] | undefined, criterionName: string): number[] {
  const named = items ?? [];
  const exact = named.filter((item) => (
    item.criterion === criterionName
    && item.score != null
    && Number.isFinite(Number(item.score))
  ));
  const pool = exact.length > 0
    ? exact
    : named.filter((item) => (
      normCriterionName(item.criterion ?? '') === normCriterionName(criterionName)
      && item.score != null
      && Number.isFinite(Number(item.score))
    ));
  return pool.map((item) => Number(item.score));
}

function scoreText(values: number[]): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return String(values[0]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return String(round2(average));
}

/**
 * Prefill a weighted grading form from a ready CURIE review.
 * Gate components use gate criterion scores. Other components use the CURIE
 * fields they evaluate. Nothing is written until the instructor saves.
 */
export function draftFromCurieReview(
  sections: WeightedSection[],
  source: CurieWeightedSource | null | undefined,
): { scores: WeightedScoreDraft; feedback: WeightedFeedbackDraft } {
  const scores: WeightedScoreDraft = {};
  const feedback: WeightedFeedbackDraft = {};
  if (!source) {
    return { scores, feedback };
  }
  const fields = source.field_feedback ?? [];
  allComponents(sections).forEach((component) => {
    const linked = component.is_gate
      ? []
      : fields.filter((field) => component.field_ids.includes(field.field_id));
    const namedScores = component.is_gate
      ? (source.gate_criterion_scores ?? [])
      : linked.flatMap((field) => field.criterion_scores ?? []);
    const componentScores: Record<string, string> = {};
    component.criteria.forEach((criterion) => {
      const value = scoreText(finiteScores(namedScores, criterion.name));
      if (value != null) {
        componentScores[criterion.id] = value;
      }
    });
    if (Object.keys(componentScores).length > 0) {
      scores[component.id] = componentScores;
    }
    if (!component.is_gate) {
      const comments = linked
        .map((field) => (field.comment ?? '').trim())
        .filter(Boolean);
      if (comments.length > 0) {
        feedback[component.id] = comments.join('\n\n');
      }
    }
  });
  return { scores, feedback };
}
