/**
 * Zustand store for the TAS MFE
 */

import { create } from 'zustand';
import type {
  Template,
  FormField,
  CanvasState,
  MfeContext,
  Submission,
} from '../types';

interface TasState {
  // ── MFE / OpenEdX context ──────────────────────────────────────────────────
  mfeContext: MfeContext | null;
  setMfeContext: (ctx: MfeContext) => void;

  // ── Template selection ─────────────────────────────────────────────────────
  selectedTemplate: Template | null;
  selectedTemplateBlockId: string | null;
  setSelectedTemplate: (template: Template | null, templateBlockId?: string | null) => void;

  // ── Active submission ──────────────────────────────────────────────────────
  submission: Submission | null;
  setSubmission: (sub: Submission | null) => void;

  // ── Form data (live edits before auto-save) ────────────────────────────────
  formData: Record<string, string>;
  setFormValue: (fieldId: string, value: string) => void;
  setFormData: (data: Record<string, string>) => void;
  clearFormData: () => void;

  // ── Per-field capacity warning (geometry-based, not maxChars) ───────────────
  fieldCapacityFull: Record<string, boolean>;
  setFieldCapacityFull: (fieldId: string, full: boolean) => void;
  setFieldCapacityFullMap: (map: Record<string, boolean>) => void;
  clearFieldCapacityFull: () => void;

  // ── Canvas state ───────────────────────────────────────────────────────────
  canvasState: CanvasState;
  setCanvasState: (state: Partial<CanvasState>) => void;
  resetCanvasState: () => void;

  // ── Selected field (for editor popup) ─────────────────────────────────────
  selectedFieldId: string | null;
  setSelectedFieldId: (id: string | null) => void;

  // ── Field editor popup ─────────────────────────────────────────────────────
  isFieldEditorOpen: boolean;
  openFieldEditor: (fieldId: string) => void;
  closeFieldEditor: () => void;

  // ── View state ─────────────────────────────────────────────────────────────
  isPreviewMode: boolean;
  setPreviewMode: (mode: boolean) => void;
  isMobile: boolean;
  setIsMobile: (v: boolean) => void;

  // ── Auto-save status ───────────────────────────────────────────────────────
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  lastSavedAt: string | null;
  setLastSavedAt: (v: string | null) => void;

  // ── Helpers ────────────────────────────────────────────────────────────────
  getSelectedField: () => FormField | null;
  clearSelection: () => void;
}

const DEFAULT_CANVAS: CanvasState = { scale: 1, positionX: 0, positionY: 0 };

export const useTasStore = create<TasState>((set, get) => ({
  // Context
  mfeContext: null,
  setMfeContext: (ctx) => set({ mfeContext: ctx }),

  // Template
  selectedTemplate: null,
  selectedTemplateBlockId: null,
  setSelectedTemplate: (template, templateBlockId = null) => set({
    selectedTemplate: template,
    selectedTemplateBlockId: templateBlockId,
    formData: {},
    fieldCapacityFull: {},
    submission: null,
    canvasState: DEFAULT_CANVAS,
    selectedFieldId: null,
    isFieldEditorOpen: false,
    isPreviewMode: false,
  }),

  // Submission
  submission: null,
  setSubmission: (sub) => set({ submission: sub }),

  // Form data
  formData: {},
  setFormValue: (fieldId, value) => set((state) => ({ formData: { ...state.formData, [fieldId]: value } })),
  setFormData: (data) => set({ formData: data }),
  clearFormData: () => set({ formData: {}, fieldCapacityFull: {} }),

  // Capacity warnings
  fieldCapacityFull: {},
  setFieldCapacityFull: (fieldId, full) => set((state) => {
    if (!full) {
      if (!state.fieldCapacityFull[fieldId]) { return state; }
      const next = { ...state.fieldCapacityFull };
      delete next[fieldId];
      return { fieldCapacityFull: next };
    }
    if (state.fieldCapacityFull[fieldId]) { return state; }
    return { fieldCapacityFull: { ...state.fieldCapacityFull, [fieldId]: true } };
  }),
  setFieldCapacityFullMap: (map) => set({ fieldCapacityFull: map }),
  clearFieldCapacityFull: () => set({ fieldCapacityFull: {} }),

  // Canvas
  canvasState: DEFAULT_CANVAS,
  setCanvasState: (newState) => set((state) => ({ canvasState: { ...state.canvasState, ...newState } })),
  resetCanvasState: () => set({ canvasState: DEFAULT_CANVAS }),

  // Selected field
  selectedFieldId: null,
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),

  // Field editor
  isFieldEditorOpen: false,
  openFieldEditor: (fieldId) => set({ isFieldEditorOpen: true, selectedFieldId: fieldId }),
  closeFieldEditor: () => set({ isFieldEditorOpen: false, selectedFieldId: null }),

  // View
  isPreviewMode: false,
  setPreviewMode: (mode) => set({ isPreviewMode: mode }),
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  setIsMobile: (v) => set({ isMobile: v }),

  // Auto-save
  isSaving: false,
  setIsSaving: (v) => set({ isSaving: v }),
  lastSavedAt: null,
  setLastSavedAt: (v) => set({ lastSavedAt: v }),

  // Helpers
  getSelectedField: () => {
    const { selectedTemplate, selectedFieldId } = get();
    if (!selectedTemplate || !selectedFieldId) { return null; }
    return selectedTemplate.fields.find((f) => f.id === selectedFieldId) || null;
  },
  clearSelection: () => set({
    selectedTemplate: null,
    selectedTemplateBlockId: null,
    submission: null,
    formData: {},
    fieldCapacityFull: {},
    selectedFieldId: null,
    isFieldEditorOpen: false,
    isPreviewMode: false,
    canvasState: DEFAULT_CANVAS,
  }),
}));
