/**
 * AdminTemplateEditor
 * Two-panel: left = metadata + fields, right = canvas with draggable field overlays.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {
  Button, Form, Spinner,
} from '@openedx/paragon';
import { ArrowBack, Add, ZoomIn, ZoomOut, Refresh } from '@openedx/paragon/icons';
import { templateTypesApi, adminTemplatesApi } from '../../services/api';
import { validateStructuralMetadata } from '../../utils/assignmentStructure';
import { FieldStructureControls } from './FieldStructureControls';
import type { Template, FormField, FieldPosition, TemplateCreateBody } from '../../types';

function generateFieldId() {
  return `f-${Math.random().toString(36).slice(2, 8)}`;
}

const FIELD_TYPES: FormField['type'][] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox', 'radio'];
const DEFAULT_POSITION: FieldPosition = { x: 10, y: 10, width: 40, height: 5 };

// ── FieldRow ──────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: FormField;
  index: number;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onChange: (f: FormField) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  sectionNames: string[];
}

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24];

const FieldRow: React.FC<FieldRowProps> = ({
  field, index, isSelected, isDragOver,
  onSelect, onChange, onRemove,
  onDragStart, onDragOver, onDrop, onDragEnd,
  sectionNames,
}) => (
  <div
    draggable
    onDragStart={onDragStart}
    onDragOver={onDragOver}
    onDrop={onDrop}
    onDragEnd={onDragEnd}
    onClick={onSelect}
    style={{
      borderRadius: 8,
      border: `1.5px solid ${isDragOver ? '#6366f1' : isSelected ? '#2563eb' : '#e5e7eb'}`,
      background: isDragOver ? '#eef2ff' : isSelected ? '#f8faff' : '#fff',
      marginBottom: 6,
      transition: 'border-color 0.1s, background 0.1s',
      overflow: 'hidden',
    }}
  >
    {/* Collapsed header — always visible */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px' }}>
      <span
        title="Drag to reorder"
        style={{ cursor: 'grab', fontSize: 13, color: '#c4c9d4', flexShrink: 0, lineHeight: 1, userSelect: 'none', paddingRight: 2 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        ⠿
      </span>

      <span style={{
        flexShrink: 0, minWidth: 18, height: 18, borderRadius: 4,
        background: isSelected ? '#2563eb' : '#e5e7eb',
        color: isSelected ? '#fff' : '#6b7280',
        fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {index + 1}
      </span>

      <span style={{
        flex: 1, fontSize: 13, fontWeight: isSelected ? 600 : 400,
        color: field.label ? '#111827' : '#9ca3af',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {field.label || 'Untitled field'}
      </span>

      <span style={{
        flexShrink: 0, fontSize: 10, color: '#9ca3af',
        background: '#f3f4f6', borderRadius: 4, padding: '2px 5px',
      }}>
        {field.type}
      </span>

      {field.required && (
        <span style={{ flexShrink: 0, fontSize: 11, color: '#ef4444', fontWeight: 700 }}>*</span>
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: '#d1d5db', fontSize: 14, lineHeight: 1, padding: '0 2px',
          borderRadius: 4,
        }}
        title="Remove field"
      >
        ✕
      </button>
    </div>

    {/* Expanded detail — only when selected */}
    {isSelected && (
      <div
        style={{ borderTop: '1px solid #e5e7eb', padding: '10px 10px 12px', background: '#f9fafb' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Label input */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Label
          </label>
          <Form.Control
            value={field.label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...field, label: e.target.value })}
            placeholder="Field label"
            size="sm"
          />
        </div>

        {/* Type + Required row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Type
            </label>
            <Form.Control
              as="select"
              value={field.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...field, type: e.target.value as FormField['type'] })}
              size="sm"
            >
              {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Form.Control>
          </div>
          <div style={{ paddingBottom: 4 }}>
            <Form.Checkbox
              label="Required"
              checked={field.required}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...field, required: e.target.checked })}
            />
          </div>
        </div>

        <FieldStructureControls
          field={field}
          sectionNames={sectionNames}
          onChange={onChange}
        />

        {/* Font size + Max chars row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Font size (px)
            </label>
            <Form.Control
              as="select"
              value={field.fontSize ?? 14}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange({
                ...field,
                fontSize: parseInt(e.target.value, 10),
              })}
              size="sm"
            >
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
            </Form.Control>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Max chars (optional)
            </label>
            <Form.Control
              type="number"
              size="sm"
              min={1}
              max={500}
              value={field.maxChars ?? ''}
              placeholder="Template geometry"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const next = { ...field };
                const parsed = parseInt(e.target.value, 10);
                if (Number.isFinite(parsed) && parsed > 0) {
                  next.maxChars = parsed;
                } else {
                  delete next.maxChars;
                }
                onChange(next);
              }}
            />
          </div>
        </div>

        {/* Options — select / radio only */}
        {(field.type === 'select' || field.type === 'radio') && (
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              Options (one per line)
            </label>
            <Form.Control
              as="textarea"
              rows={3}
              value={(field.options ?? []).join('\n')}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onChange({ ...field, options: e.target.value.split('\n').filter((o) => o.trim()) })
              }
              placeholder={'Option A\nOption B'}
              size="sm"
              style={{ resize: 'none' }}
            />
          </div>
        )}
      </div>
    )}
  </div>
);

// ── DraggableOverlay ──────────────────────────────────────────────────────────

interface DraggableOverlayProps {
  field: FormField;
  fieldIndex: number;
  position: FieldPosition;
  isSelected: boolean;
  canvasRef: React.RefObject<HTMLDivElement>;
  onSelect: () => void;
  onPositionChange: (pos: FieldPosition) => void;
}

const BORDER_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#374151'];

const DraggableOverlay: React.FC<DraggableOverlayProps> = ({
  field, fieldIndex, position, isSelected, canvasRef, onSelect, onPositionChange,
}) => {
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; rw: number; rh: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; ow: number; oh: number; rw: number; rh: number } | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const borderColor = BORDER_COLORS[fieldIndex % BORDER_COLORS.length];

  // Get the canvas's actual rendered size (accounts for zoom/scale)
  const getRenderedSize = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { rw: rect?.width ?? 794, rh: rect?.height ?? 1123 };
  };

  const px = {
    left:   `${position.x}%`,
    top:    `${position.y}%`,
    width:  `${position.width}%`,
    height: `${position.height}%`,
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const { rw, rh } = getRenderedSize();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: position.x, oy: position.y, rw, rh };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { sx, sy, ox, oy, rw: w, rh: h } = dragRef.current;
      onPositionChange({
        ...position,
        x: Math.max(0, Math.min(100 - position.width,  ox + ((ev.clientX - sx) / w) * 100)),
        y: Math.max(0, Math.min(100 - position.height, oy + ((ev.clientY - sy) / h) * 100)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { rw, rh } = getRenderedSize();
    resizeRef.current = { sx: e.clientX, sy: e.clientY, ow: position.width, oh: position.height, rw, rh };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { sx, sy, ow, oh, rw: w, rh: h } = resizeRef.current;
      onPositionChange({
        ...position,
        width:  Math.max(0.5, Math.min(100 - position.x, ow + ((ev.clientX - sx) / w) * 100)),
        height: Math.max(0.5, Math.min(100 - position.y, oh + ((ev.clientY - sy) / h) * 100)),
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'absolute',
        left: px.left, top: px.top, width: px.width, height: px.height,
        border: `2px ${isSelected ? 'solid' : 'dashed'} ${borderColor}`,
        background: isSelected ? `${borderColor}18` : `${borderColor}08`,
        cursor: 'move', userSelect: 'none', borderRadius: 4,
        boxSizing: 'border-box',
        boxShadow: isSelected ? `0 0 0 2px ${borderColor}40` : 'none',
      }}
    >
      {/* Label badge — visible on hover or when selected */}
      {(isHovered || isSelected) && (
        <div style={{
          position: 'absolute', left: 0, top: -18,
          background: borderColor, color: '#fff',
          fontSize: 9, fontWeight: 700,
          padding: '2px 6px', borderRadius: 3,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 10,
        }}>
          {fieldIndex + 1}. {field.label || '(unnamed)'}{field.required ? ' *' : ''}
        </div>
      )}

      {/* Type hint */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: borderColor, fontWeight: 500, pointerEvents: 'none',
      }}>
        {field.type}
      </div>

      {/* Resize handle — always visible when selected */}
      <div
        onMouseDown={onResizeDown}
        style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 16, height: 16,
          background: borderColor,
          cursor: 'se-resize',
          borderRadius: '3px 0 0 0',
          opacity: isSelected ? 1 : 0.4,
        }}
      />
    </div>
  );
};

// ── Main Editor ───────────────────────────────────────────────────────────────

interface Props {
  template: Template | null;
  onBack: () => void;
}

export const AdminTemplateEditor: React.FC<Props> = ({ template, onBack }) => {
  const qc = useQueryClient();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [templateTypeId, setTemplateTypeId] = useState(template?.template_type_id ?? '');
  const [imageUrl, setImageUrl] = useState(template?.image_url ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(template?.thumbnail_url ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(template?.is_public ?? true);
  const [fields, setFields] = useState<FormField[]>(template?.fields ?? []);
  const [positions, setPositions] = useState<Record<string, FieldPosition>>(template?.field_positions ?? {});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<{ sx: number; sy: number; rect: DOMRect } | null>(null);
  const [drawPreview, setDrawPreview] = useState<FieldPosition | null>(null);
  const imageNaturalW = template?.image_width || 794;
  const imageNaturalH = template?.image_height || 1123;

  const { data: typesResult } = useQuery({
    queryKey: ['template-types'],
    queryFn: () => templateTypesApi.list(),
  });
  const templateTypes = typesResult?.results ?? [];

  const saveMut = useMutation({
    mutationFn: (body: TemplateCreateBody) =>
      isEdit ? adminTemplatesApi.update(template!.id, body) : adminTemplatesApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-templates'] }); onBack(); },
  });

  const addField = useCallback(() => {
    const id = generateFieldId();
    setFields((prev) => [...prev, { id, label: '', type: 'text', required: false }]);
    setPositions((prev) => ({ ...prev, [id]: { ...DEFAULT_POSITION, y: 10 + Object.keys(prev).length * 8 } }));
    setSelectedFieldId(id);
  }, []);

  const updateField = useCallback((updated: FormField) => {
    setFields((prev) => {
      const previous = prev.find((field) => field.id === updated.id);
      const section = updated.section?.trim();
      const styleChanged = previous?.displayStyle !== updated.displayStyle;
      return prev.map((field) => {
        if (field.id === updated.id) return updated;
        if (
          styleChanged
          && section
          && field.section?.trim().toLocaleLowerCase() === section.toLocaleLowerCase()
        ) {
          return { ...field, displayStyle: updated.displayStyle };
        }
        return field;
      });
    });
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setPositions((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (selectedFieldId === id) setSelectedFieldId(null);
  }, [selectedFieldId]);

  const updatePosition = useCallback((id: string, pos: FieldPosition) => {
    setPositions((prev) => ({ ...prev, [id]: pos }));
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    drawRef.current = { sx: e.clientX, sy: e.clientY, rect };
    setDrawPreview({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, width: 0, height: 0 });

    const onMove = (ev: MouseEvent) => {
      if (!drawRef.current) return;
      const { sx, sy, rect: r } = drawRef.current;
      const x1 = Math.max(0, Math.min((sx - r.left) / r.width, 1)) * 100;
      const y1 = Math.max(0, Math.min((sy - r.top) / r.height, 1)) * 100;
      const x2 = Math.max(0, Math.min((ev.clientX - r.left) / r.width, 1)) * 100;
      const y2 = Math.max(0, Math.min((ev.clientY - r.top) / r.height, 1)) * 100;
      setDrawPreview({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!drawRef.current) return;
      const { sx, sy, rect: r } = drawRef.current;
      drawRef.current = null;
      setDrawPreview(null);
      const x1 = Math.max(0, Math.min((sx - r.left) / r.width, 1)) * 100;
      const y1 = Math.max(0, Math.min((sy - r.top) / r.height, 1)) * 100;
      const x2 = Math.max(0, Math.min((ev.clientX - r.left) / r.width, 1)) * 100;
      const y2 = Math.max(0, Math.min((ev.clientY - r.top) / r.height, 1)) * 100;
      const w = Math.abs(x2 - x1);
      const h = Math.abs(y2 - y1);
      if (w < 0.5 || h < 0.5) return; // too small — ignore accidental right-clicks
      const id = generateFieldId();
      setFields((prev) => [...prev, { id, label: '', type: 'text', required: false }]);
      setPositions((prev) => ({ ...prev, [id]: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: w, height: h } }));
      setSelectedFieldId(id);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const reorderFields = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const handleSave = () => {
    if (!name.trim()) { alert('Please enter a template name.'); return; }
    if (!templateTypeId) { alert('Please select a template type.'); return; }
    const structureErrors = validateStructuralMetadata(fields);
    if (structureErrors.length > 0) { alert(structureErrors.join('\n')); return; }
    saveMut.mutate({
      template_type_id: templateTypeId,
      name: name.trim(),
      description: description.trim(),
      image_url: imageUrl.trim(),
      image_width: imageNaturalW,
      image_height: imageNaturalH,
      thumbnail_url: thumbnailUrl.trim() || imageUrl.trim(),
      fields,
      field_positions: positions,
      is_public: isPublic,
      imageFile: imageFile ?? undefined,
      thumbnailFile: thumbnailFile ?? undefined,
    });
  };

  const selectedPos = selectedFieldId ? positions[selectedFieldId] : null;
  const sectionNames = Array.from(new Set(fields.map((field) => field.section?.trim()).filter(Boolean))) as string[];
  const setSelectedPos = (pos: FieldPosition) => { if (selectedFieldId) updatePosition(selectedFieldId, pos); };

  return (
    <div className="d-flex flex-column h-100">
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-3 px-4 py-2 bg-white border-bottom shadow-sm flex-shrink-0">
        <Button
          variant="tertiary"
          size="sm"
          iconBefore={ArrowBack}
          onClick={onBack}
        >
          Templates
        </Button>
        <span className="text-muted">/</span>
        <span className="font-weight-bold small flex-grow-1 text-truncate">
          {isEdit ? template!.name : 'New Template'}
        </span>
        {saveMut.isError && (
          <span className="small text-danger">
            {(saveMut.error as Error)?.message ?? 'Save failed'}
          </span>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? <Spinner animation="border" size="sm" screenReaderText="Saving" /> : isEdit ? 'Save Changes' : 'Create'}
        </Button>
      </div>

      {/* Two panels */}
      <div className="d-flex flex-grow-1 overflow-hidden">

        {/* Left panel */}
        <div
          className="overflow-auto bg-white border-right"
          style={{ width: 380, flexShrink: 0 }}
        >
          {/* Details */}
          <div className="p-3 border-bottom">
            <p className="x-small font-weight-bold text-muted text-uppercase mb-3" style={{ letterSpacing: '0.08em' }}>Details</p>

            <Form.Group controlId="tpl-name" className="mb-3">
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control size="sm" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="Template name" />
            </Form.Group>

            <Form.Group controlId="tpl-desc" className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" size="sm" rows={2} value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)} placeholder="Brief description…" style={{ resize: 'none' }} />
            </Form.Group>

            <Form.Group controlId="tpl-type" className="mb-3">
              <Form.Label>Type <span className="text-danger">*</span></Form.Label>
              <Form.Control as="select" size="sm" value={templateTypeId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemplateTypeId(e.target.value)}>
                <option value="">Select type…</option>
                {templateTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
              </Form.Control>
            </Form.Group>

            <Form.Group controlId="tpl-img" className="mb-3">
              <Form.Label>Image</Form.Label>
              <Form.Control
                size="sm"
                type="file"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0] ?? null;
                  setImageFile(file);
                  if (file) setImageUrl(URL.createObjectURL(file));
                }}
              />
              {imageUrl && (
                <img src={imageUrl} alt="preview" className="mt-2 rounded" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }} />
              )}
            </Form.Group>

            <Form.Group controlId="tpl-thumb" className="mb-3">
              <Form.Label>Thumbnail <small className="text-muted">(optional)</small></Form.Label>
              <Form.Control
                size="sm"
                type="file"
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0] ?? null;
                  setThumbnailFile(file);
                  if (file) setThumbnailUrl(URL.createObjectURL(file));
                }}
              />
            </Form.Group>

            <Form.Switch
              id="tpl-public"
              label="Public"
              checked={isPublic}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPublic(e.target.checked)}
            />
          </div>

          {/* Fields */}
          <div className="p-3">
            <div className="d-flex align-items-center mb-3">
              <span className="x-small font-weight-bold text-muted text-uppercase flex-grow-1" style={{ letterSpacing: '0.08em' }}>
                Fields ({fields.length})
              </span>
              <Button variant="primary" size="sm" iconBefore={Add} onClick={addField}>
                Add
              </Button>
            </div>

            {fields.length === 0 && (
              <p className="small text-center text-muted py-3">No fields yet.</p>
            )}

            {fields.map((f, i) => (
              <FieldRow
                key={f.id}
                field={f}
                index={i}
                isSelected={selectedFieldId === f.id}
                isDragOver={dragOverIndex === i}
                onSelect={() => setSelectedFieldId(f.id)}
                onChange={updateField}
                onRemove={() => removeField(f.id)}
                onDragStart={() => setDragFromIndex(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                onDrop={() => {
                  if (dragFromIndex !== null) reorderFields(dragFromIndex, i);
                  setDragFromIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { setDragFromIndex(null); setDragOverIndex(null); }}
                sectionNames={sectionNames}
              />
            ))}

            {/* Numeric position editor */}
            {selectedPos && selectedFieldId && (
              <div className="mt-3 p-3 border rounded" style={{ background: '#eff6ff', borderColor: '#bfdbfe !important' }}>
                <p className="x-small font-weight-bold text-primary text-uppercase mb-2" style={{ letterSpacing: '0.08em' }}>Position (%)</p>
                <div className="row g-2">
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <div key={key} className="col-6">
                      <Form.Group controlId={`pos-${key}`} className="mb-0">
                        <Form.Label className="text-capitalize small">{key}</Form.Label>
                        <Form.Control
                          type="number" size="sm" min={0} max={100} step={0.5}
                          value={Math.round(selectedPos[key] * 10) / 10}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSelectedPos({ ...selectedPos, [key]: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </Form.Group>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: canvas */}
        <div className="flex-grow-1 position-relative overflow-hidden" style={{ background: '#e5e7eb' }}>
          <TransformWrapper minScale={0.2} maxScale={4} limitToBounds={false} centerOnInit wheel={{ disabled: true }} pinch={{ disabled: true }}>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Zoom controls */}
                <div className="position-absolute d-flex flex-column gap-2" style={{ top: 12, right: 12, zIndex: 10 }}>
                  {([
                    { icon: ZoomIn,  action: () => zoomIn(),        label: '+' },
                    { icon: ZoomOut, action: () => zoomOut(),       label: '−' },
                    { icon: Refresh, action: () => resetTransform(), label: '↺' },
                  ] as const).map(({ icon: Ic, action, label }) => (
                    <Button key={label} variant="light" size="sm" iconBefore={Ic} onClick={action} className="p-1 shadow-sm">
                      {' '}
                    </Button>
                  ))}
                </div>

                <TransformComponent wrapperClass="w-100 h-100" contentClass="w-100 h-100 d-flex align-items-center justify-content-center">
                  <div
                    ref={canvasRef}
                    className="position-relative shadow"
                    style={{ width: imageNaturalW, height: imageNaturalH }}
                    onClick={() => setSelectedFieldId(null)}
                    onMouseDown={handleCanvasMouseDown}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="template" className="position-absolute w-100 h-100" style={{ objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} draggable={false} />
                    ) : (
                      <div className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white" style={{ border: '2px dashed #d1d5db' }}>
                        <p className="text-muted small">Set an Image URL in the left panel</p>
                      </div>
                    )}

                    {fields.map((f, i) => {
                      const pos = positions[f.id];
                      if (!pos) return null;
                      return (
                        <DraggableOverlay
                          key={f.id}
                          field={f}
                          fieldIndex={i}
                          position={pos}
                          isSelected={selectedFieldId === f.id}
                          canvasRef={canvasRef}
                          onSelect={() => setSelectedFieldId(f.id)}
                          onPositionChange={(p) => updatePosition(f.id, p)}
                        />
                      );
                    })}

                    {drawPreview && drawPreview.width > 0 && drawPreview.height > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          left: `${drawPreview.x}%`, top: `${drawPreview.y}%`,
                          width: `${drawPreview.width}%`, height: `${drawPreview.height}%`,
                          border: '2px dashed #2563eb',
                          background: 'rgba(37,99,235,0.08)',
                          pointerEvents: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>

          <div className="position-absolute small text-muted bg-white rounded shadow-sm px-3 py-2" style={{ bottom: 12, left: 12, pointerEvents: 'none' }}>
            Drag to move · resize from bottom-right · right-click drag to draw new field
          </div>
        </div>
      </div>
    </div>
  );
};
