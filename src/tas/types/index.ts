/**
 * TAS (Template Assignment System) TypeScript types
 * Aligned with the TAS API contract v1
 */

// ─── Template Types (tas_template_types) ─────────────────────────────────────

export interface TemplateType {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  is_active: boolean;
}

export interface TemplateTypesResponse {
  count: number;
  results: TemplateType[];
}

// ─── Fields & Positions ───────────────────────────────────────────────────────

export interface FormField {
  id: string;
  label: string;
  type:
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'radio';
  required: boolean;
  options?: string[];
  placeholder?: string;
  fontSize?: number; // default font size in px (default 14)
  maxChars?: number; // max character limit (default 60)
  /** Optional reusable learner-form grouping. Blank means a one-field section. */
  section?: string;
  /** Presentation for the containing section. Defaults to cards. */
  displayStyle?: 'cards' | 'table' | 'stages';
  /** Instructions shown once for the active learner step. */
  sectionInstruction?: string;
  /** Field-specific guidance shown next to the answer control. */
  guidance?: string;
  /** Table metadata; both values are required when displayStyle is table. */
  tableRow?: string;
  tableColumn?: string;
  /** Stage metadata; both values are required when displayStyle is stages. */
  stage?: string;
  stageOrder?: number;
}

export interface FieldPosition {
  x: number; // 0–100 %
  y: number; // 0–100 %
  width: number; // 0–100 %
  height: number; // 0–100 %
}

// ─── Template (tas_templates) ─────────────────────────────────────────────────

export interface Template {
  id: string;
  template_type_id: string;
  template_type?: TemplateType;
  name: string;
  description: string;
  image_url: string;
  image_width: number;
  image_height: number;
  thumbnail_url: string;
  fields: FormField[];
  field_positions: Record<string, FieldPosition>;
  is_public: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TemplatesResponse {
  count: number;
  results: Template[];
}

// ─── Block ↔ Template Assignments (tas_template_blocks) ──────────────────────

export interface TemplateBlockItem {
  template_block_id: string;
  sort_order: number;
  template: {
    id: string;
    name: string;
    template_type: { slug: string; name: string };
    thumbnail_url: string;
    image_width: number;
    image_height: number;
  };
}

export interface BlockTemplatesResponse {
  usage_key: string;
  course_id: string;
  templates: TemplateBlockItem[];
}

// ─── Submissions (tas_submissions) ────────────────────────────────────────────

export type SubmissionStatus = 'draft' | 'submitted' | 'rejected' | 'approved';
export type FeedbackSource = 'human' | 'curie';
export type CurieReviewStatus = 'pending_evaluation' | 'ready' | 'failed';
export type CurieVerdict = 'accepted' | 'rejected';
export type FieldColor = 'needs_revision' | 'could_improve' | 'good' | null;

// ─── Rubrics ──────────────────────────────────────────────────────────────────

export interface RubricOption {
  name: string;
  marks: number;
}

export interface RubricCriterion {
  criterion: string;
  options: RubricOption[];
  /** Category-scoped predefined feedback strings; optional on legacy rubrics. */
  feedbacks?: string[];
}

/** 1 = flat categories (`criteria`); 2 = weighted sections (`sections`). */
export type RubricSchemaVersion = 1 | 2;

export interface WeightedIndicator {
  text: string;
  marks: number;
}

/** Indicator marks add up to 10; the criterion is scored 0–10 when grading. */
export interface WeightedCriterion {
  id: string;
  name: string;
  indicators: WeightedIndicator[];
}

export interface WeightedComponent {
  id: string;
  name: string;
  learning_objective: string;
  learning_outcome: string;
  /** Ids of the rubric template's fields this component evaluates. */
  field_ids: string[];
  /** Percent of the final score; non-gate weights add up to 100. */
  weight: number;
  /** Non-negotiable check: 0% weight, reject the submission when not met. */
  is_gate: boolean;
  criteria: WeightedCriterion[];
  feedbacks?: string[];
}

export interface WeightedSection {
  id: string;
  title: string;
  components: WeightedComponent[];
}

export interface Rubric {
  id: string;
  name: string;
  schema_version: RubricSchemaVersion;
  criteria: RubricCriterion[];
  sections: WeightedSection[];
  template_id: string | null;
  is_active: boolean;
}

export interface BlockRubricsResponse {
  display_name: string;
  instructions: string;
  schema_version?: RubricSchemaVersion;
  rubrics: RubricCriterion[];
  sections?: WeightedSection[];
}

export interface WeightedCriterionScore {
  criterion_id: string;
  criterion: string;
  score: number | null;
  max_score: number;
}

/** One saved feedback row per weighted component. */
export interface WeightedFeedbackRow {
  component_id: string;
  component: string;
  /** Instructor section feedback for this component. Optional and may be blank. */
  comment?: string;
  criterion_scores: WeightedCriterionScore[];
}

export interface RubricFeedbackEntry {
  criterion: string;
  selected_option: string;
  marks: number;
  score: number | null;
}

export interface CurieFieldFeedback {
  field_id: string;
  weight: number;
  comment: string;
  color?: FieldColor;
  criterion_scores?: Array<{
    criterion: string;
    score: number;
    max_score: number;
  }>;
}

export interface CurieCriterionScore {
  criterion: string;
  score: number;
  max_score: number;
}

export interface StructuredFeedback {
  schema_version?: number;
  verdict?: CurieVerdict | null;
  gate_criterion_scores: CurieCriterionScore[];
  field_feedback: CurieFieldFeedback[];
  overall_feedback: string;
}

export interface SubmissionFeedback {
  status: 'pending' | 'approved' | 'rejected';
  comment: string;
  rubrics?: RubricFeedbackEntry[];
  total?: number;
  source?: FeedbackSource;
  verdict?: CurieVerdict | null;
  field_feedback?: CurieFieldFeedback[];
  star_rating?: number | null;
  structured_feedback?: StructuredFeedback;
}

export interface LearnerCurieReview {
  status: CurieReviewStatus;
  awaiting_instructor_approval?: boolean;
  verdict: CurieVerdict | null;
  overall_feedback: string;
  field_feedback: CurieFieldFeedback[];
  star_rating: number | null;
  is_slow_pending: boolean;
  submission_version_number: number;
  error_detail: string;
  requested_at: string | null;
  completed_at: string | null;
}

export interface Submission {
  id: string;
  template_block_id: string;
  student_id: string;
  course_id: string;
  usage_key: string;
  form_data: Record<string, string>;
  status: SubmissionStatus;
  version_number: number;
  submitted_at: string | null;
  pdf_url: string;
  feedback?: SubmissionFeedback | null;
  curie_review_status?: CurieReviewStatus | null;
  awaiting_instructor_approval?: boolean;
  is_slow_pending?: boolean;
  submission_attempt_count?: number;
  at_max_attempts?: boolean;
  created_at: string;
  updated_at: string;
}

export type FeedbackUnavailableReason = 'pending' | 'unlinked_historical';

export interface SubmissionVersion {
  version_number: number;
  submitted_at: string | null;
  feedback_available: boolean;
  feedback_unavailable_reason: FeedbackUnavailableReason | null;
  feedback_status: 'pending' | 'approved' | 'rejected' | null;
  instructor_comment: string;
  pdf_url: string | null;
  download_url: string | null;
  attempt_number?: number | null;
  curie_review_status?: CurieReviewStatus | null;
  awaiting_instructor_approval?: boolean;
  feedback_source?: FeedbackSource | null;
  verdict?: CurieVerdict | null;
  star_rating?: number | null;
  field_feedback?: CurieFieldFeedback[];
  /** Legacy fields retained for older callers / instructor table field counts. */
  form_data?: Record<string, string>;
  saved_at?: string;
}

export interface SubmissionVersionsResponse {
  submission_id: string;
  versions: SubmissionVersion[];
}

export interface PdfStatusResponse {
  pdf_url: string | null;
  status?: 'generating';
}

// ─── MFE / OpenEdX context ────────────────────────────────────────────────────

/** Values read from the OpenEdX JWT / LMS page context */
export interface MfeContext {
  usageKey: string;
  courseId: string;
  studentId: string;
  isStaff: boolean;
  isInstructor: boolean;
}

// ─── Canvas UI helpers ────────────────────────────────────────────────────────

export interface CanvasState {
  scale: number;
  positionX: number;
  positionY: number;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminView {
  activeTab: 'templates' | 'submissions';
}

export interface TemplateCreateBody {
  template_type_id: string;
  name: string;
  description: string;
  image_url: string;
  image_width: number;
  image_height: number;
  thumbnail_url: string;
  fields: FormField[];
  field_positions: Record<string, FieldPosition>;
  is_public: boolean;
  imageFile?: File;
  thumbnailFile?: File;
}

export type TemplateUpdateBody = Partial<TemplateCreateBody>;
