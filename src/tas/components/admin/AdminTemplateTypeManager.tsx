/**
 * AdminTemplateTypeManager
 * Create, edit, and deactivate template types.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Badge, Spinner, Form, Alert,
} from '@openedx/paragon';
import {
  Add, ArrowBack, Close, Edit,
} from '@openedx/paragon/icons';
import { templateTypesApi } from '../../services/api';
import type { TemplateType } from '../../types';

interface Props {
  onBack: () => void;
}

const EMPTY_FORM = { name: '', slug: '', description: '' };

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const AdminTemplateTypeManager: React.FC<Props> = ({ onBack }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['template-types-all'],
    queryFn: () => templateTypesApi.list(),
  });

  const createMut = useMutation({
    mutationFn: (body: Omit<TemplateType, 'id'>) => templateTypesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-types-all'] });
      qc.invalidateQueries({ queryKey: ['template-types'] });
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Omit<TemplateType, 'id'>> }) => templateTypesApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-types-all'] });
      qc.invalidateQueries({ queryKey: ['template-types'] });
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data ? JSON.stringify(e.response.data) : e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => templateTypesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-types-all'] });
      qc.invalidateQueries({ queryKey: ['template-types'] });
    },
  });

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      // Auto-generate slug only when not editing (or slug hasn't been manually changed)
      slug: editingId ? prev.slug : toSlug(name),
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.slug.trim()) { setError('Slug is required.'); return; }
    setError('');
    const body = {
      name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim(), is_active: true,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, body });
    } else {
      createMut.mutate(body);
    }
  };

  const startEdit = (tt: TemplateType) => {
    setEditingId(tt.id);
    setForm({ name: tt.name, slug: tt.slug, description: tt.description });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const isPending = createMut.isPending || updateMut.isPending;
  const types = data?.results ?? [];

  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex align-items-center gap-3 px-4 py-3 bg-white border-bottom shadow-sm flex-shrink-0">
        <Button variant="tertiary" size="sm" iconBefore={ArrowBack} onClick={onBack}>
          Templates
        </Button>
        <span className="text-muted">/</span>
        <span className="font-weight-bold small flex-grow-1">Template Types</span>
      </div>

      <div className="d-flex flex-grow-1 overflow-hidden">

        {/* Left: form */}
        <div className="overflow-auto bg-white border-right p-4" style={{ width: 320, flexShrink: 0 }}>
          <h3 className="h6 mb-4">{editingId ? 'Edit Type' : 'New Type'}</h3>

          {error && (
            <Alert variant="danger" className="mb-3 small">{error}</Alert>
          )}

          <Form.Group controlId="tt-name" className="mb-3">
            <Form.Label>Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              size="sm"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
              placeholder="e.g. Lab Report"
            />
          </Form.Group>

          <Form.Group controlId="tt-slug" className="mb-3">
            <Form.Label>Slug <span className="text-danger">*</span></Form.Label>
            <Form.Control
              size="sm"
              value={form.slug}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="e.g. lab-report"
            />
            <Form.Text muted>URL-safe identifier, auto-generated from name</Form.Text>
          </Form.Group>

          <Form.Group controlId="tt-desc" className="mb-4">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              size="sm"
              rows={2}
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((p) => ({
                ...p,
                description: e.target.value,
              }))}
              placeholder="Optional description…"
              style={{ resize: 'none' }}
            />
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              iconBefore={editingId ? undefined : Add}
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending && <Spinner animation="border" size="sm" screenReaderText="Saving" />}
              {!isPending && editingId && 'Save Changes'}
              {!isPending && !editingId && 'Create Type'}
            </Button>
            {editingId && (
              <Button variant="tertiary" size="sm" iconBefore={Close} onClick={cancelEdit}>
                {' '}
              </Button>
            )}
          </div>
        </div>

        {/* Right: list */}
        <div className="flex-grow-1 overflow-auto p-4">
          <h3 className="h6 mb-3">Existing Types</h3>

          {isLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" variant="primary" screenReaderText="Loading" />
            </div>
          )}

          {!isLoading && types.length === 0 && (
            <p className="text-muted small">No template types yet. Create one on the left.</p>
          )}

          <div className="d-flex flex-column gap-2">
            {types.map((tt) => (
              <div
                key={tt.id}
                className="d-flex align-items-center gap-3 p-3 bg-white rounded border"
                style={{ borderColor: editingId === tt.id ? '#2563eb' : undefined }}
              >
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="font-weight-bold small">{tt.name}</span>
                    <Badge variant={tt.is_active ? 'success' : 'light'} className="small">
                      {tt.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    slug: <code>{tt.slug}</code>
                    {tt.description && <> &nbsp;·&nbsp; {tt.description}</>}
                  </div>
                </div>

                <Button
                  variant="tertiary"
                  size="sm"
                  iconBefore={Edit}
                  onClick={() => startEdit(tt)}
                  disabled={deleteMut.isPending}
                >
                  {' '}
                </Button>

                <Button
                  variant="tertiary"
                  size="sm"
                  className="text-danger"
                  iconBefore={Close}
                  onClick={() => {
                    if (window.confirm(`Deactivate "${tt.name}"?`)) { deleteMut.mutate(tt.id); }
                  }}
                  disabled={deleteMut.isPending || !tt.is_active}
                >
                  {' '}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
