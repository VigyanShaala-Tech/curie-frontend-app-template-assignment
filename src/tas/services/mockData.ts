/**
 * Mock data for TAS API — replace with real axios calls when backend is ready.
 */

import type {
  TemplateType,
  Template,
  TemplateBlockItem,
  BlockTemplatesResponse,
  BlockRubricsResponse,
  Submission,
  SubmissionVersion,
} from '../types';

// ─── Template Types ───────────────────────────────────────────────────────────

export const MOCK_TEMPLATE_TYPES: TemplateType[] = [
  {
    id: 'tt-1',
    name: 'Lab Report',
    slug: 'lab-report',
    description: 'Scientific lab report template',
    icon: 'flask',
    is_active: true,
  },
  {
    id: 'tt-2',
    name: 'Essay',
    slug: 'essay',
    description: 'Academic essay template',
    icon: 'file-alt',
    is_active: true,
  },
  {
    id: 'tt-3',
    name: 'Worksheet',
    slug: 'worksheet',
    description: 'General worksheet template',
    icon: 'clipboard',
    is_active: true,
  },
];

// ─── Templates ────────────────────────────────────────────────────────────────

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 'tpl-1',
    template_type_id: 'tt-1',
    template_type: MOCK_TEMPLATE_TYPES[0],
    name: 'Biology Lab Report',
    description: 'For first-year biology students',
    image_url: 'https://placehold.co/794x1123/f8f8f8/cccccc?text=Biology+Lab+Report',
    image_width: 794,
    image_height: 1123,
    thumbnail_url: 'https://placehold.co/300x424/f8f8f8/cccccc?text=Biology+Lab+Report',
    fields: [
      {
        id: 'f1', label: 'Student Name', type: 'text', required: true, placeholder: 'Enter your full name',
      },
      {
        id: 'f2', label: 'Hypothesis', type: 'textarea', required: true, placeholder: 'Write your hypothesis here...',
      },
      {
        id: 'f3', label: 'Outcome', type: 'select', required: false, options: ['Pass', 'Fail', 'Inconclusive'],
      },
      {
        id: 'f4', label: 'Date', type: 'date', required: true,
      },
    ],
    field_positions: {
      f1: {
        x: 10.5, y: 8.2, width: 40.0, height: 4.0,
      },
      f2: {
        x: 10.5, y: 20.0, width: 80.0, height: 15.0,
      },
      f3: {
        x: 10.5, y: 60.0, width: 30.0, height: 4.0,
      },
      f4: {
        x: 55.0, y: 8.2, width: 30.0, height: 4.0,
      },
    },
    is_public: true,
    is_active: true,
    created_by: 'admin',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tpl-2',
    template_type_id: 'tt-2',
    template_type: MOCK_TEMPLATE_TYPES[1],
    name: 'Physics Worksheet',
    description: 'Newton\'s laws worksheet',
    image_url: 'https://placehold.co/794x1123/f0f4ff/9999cc?text=Physics+Worksheet',
    image_width: 794,
    image_height: 1123,
    thumbnail_url: 'https://placehold.co/300x424/f0f4ff/9999cc?text=Physics+Worksheet',
    fields: [
      {
        id: 'g1', label: 'Student Name', type: 'text', required: true,
      },
      {
        id: 'g2', label: 'Question 1 Answer', type: 'textarea', required: true,
      },
      {
        id: 'g3', label: 'Question 2 Answer', type: 'textarea', required: true,
      },
      {
        id: 'g4', label: 'Score', type: 'number', required: false,
      },
    ],
    field_positions: {
      g1: {
        x: 10, y: 10, width: 50, height: 4,
      },
      g2: {
        x: 10, y: 25, width: 80, height: 12,
      },
      g3: {
        x: 10, y: 50, width: 80, height: 12,
      },
      g4: {
        x: 70, y: 80, width: 20, height: 4,
      },
    },
    is_public: true,
    is_active: true,
    created_by: 'admin',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

// ─── Block → Template assignments ────────────────────────────────────────────

export const MOCK_BLOCK_TEMPLATES: Record<string, BlockTemplatesResponse> = {
  'block-v1:Org+Course101+2024+type@format_forge+block@abc123': {
    usage_key: 'block-v1:Org+Course101+2024+type@format_forge+block@abc123',
    course_id: 'course-v1:Org+Course101+2024',
    templates: MOCK_TEMPLATES.map((t, i): TemplateBlockItem => ({
      template_block_id: `tb-${t.id}`,
      sort_order: i,
      template: {
        id: t.id,
        name: t.name,
        template_type: {
          slug: t.template_type?.slug || 'unknown',
          name: t.template_type?.name || 'Unknown',
        },
        thumbnail_url: t.thumbnail_url,
        image_width: t.image_width,
        image_height: t.image_height,
      },
    })),
  },
};

// ─── Rubrics ─────────────────────────────────────────────────────────────────

export const MOCK_BLOCK_RUBRICS: BlockRubricsResponse = {
  display_name: 'Biology Lab Report',
  instructions: 'Grade the student submission using the criteria below.',
  rubrics: [
    {
      criterion: 'Hypothesis',
      options: [
        { name: 'Excellent', marks: 10 },
        { name: 'Good', marks: 7 },
        { name: 'Needs Improvement', marks: 4 },
        { name: 'Incomplete', marks: 0 },
      ],
    },
    {
      criterion: 'Methodology',
      options: [
        { name: 'Excellent', marks: 10 },
        { name: 'Good', marks: 7 },
        { name: 'Needs Improvement', marks: 4 },
        { name: 'Incomplete', marks: 0 },
      ],
    },
    {
      criterion: 'Results & Analysis',
      options: [
        { name: 'Excellent', marks: 15 },
        { name: 'Good', marks: 10 },
        { name: 'Needs Improvement', marks: 5 },
        { name: 'Incomplete', marks: 0 },
      ],
    },
  ],
};

// ─── In-memory submission store ───────────────────────────────────────────────

export const submissionStore: Record<string, Submission> = {};
export const versionStore: Record<string, SubmissionVersion[]> = {};
let submissionCounter = 1;
const versionCounter: Record<string, number> = {};

export function makeSubmissionId() {
  return `sub-${submissionCounter++}`;
}

export function nextVersion(submissionId: string): number {
  versionCounter[submissionId] = (versionCounter[submissionId] || 0) + 1;
  return versionCounter[submissionId];
}
