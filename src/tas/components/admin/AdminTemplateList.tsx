import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, Badge, Spinner, Card, Form,
} from '@openedx/paragon';
import { Add, Search } from '@openedx/paragon/icons';
import { templatesApi, adminTemplatesApi, templateTypesApi } from '../../services/api';
import type { Template } from '../../types';

interface Props {
  onEdit: (template: Template) => void;
  onCreate: () => void;
  onManageTypes: () => void;
  onManageRubrics: () => void;
}

export const AdminTemplateList: React.FC<Props> = ({
  onEdit, onCreate, onManageTypes, onManageRubrics,
}) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => templatesApi.list({ active_only: false }),
  });

  const { data: typesData } = useQuery({
    queryKey: ['template-types'],
    queryFn: () => templateTypesApi.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => (
      adminTemplatesApi.toggleActive(id, is_active)
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-templates'] }),
  });

  const types = typesData?.results ?? [];

  const filtered = (data?.results ?? []).filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    // Some rows may not include template_type detail; normalize id comparison.
    const templateTypeId = t.template_type?.id ?? t.template_type_id;
    const matchesType = !typeFilter || String(templateTypeId ?? '') === String(typeFilter);
    return matchesSearch && matchesType;
  });

  const handleDelete = (t: Template) => {
    if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) {
      deleteMut.mutate(t.id);
    }
  };

  return (
    <div className="d-flex flex-column h-100" style={{ background: '#f8f9fa' }}>
      {/* Header */}
      <div className="px-4 py-3 bg-white border-bottom">
        <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: '0.75rem' }}>
          <div>
            <h2 className="h5 mb-0">Templates</h2>
            <small className="text-muted">
              {filtered.length} of {data?.results.length ?? 0} template{(data?.results.length ?? 0) !== 1 ? 's' : ''}
            </small>
          </div>

          <div className="d-flex align-items-center flex-wrap" style={{ gap: '0.5rem' }}>
            {/* Search */}
            <Form.Control
              leadingElement={<Search />}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              placeholder="Search…"
              size="sm"
              style={{ width: 180 }}
            />

            {/* Type filter */}
            <Form.Control
              as="select"
              size="sm"
              value={typeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">All types</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Form.Control>

            <Button variant="tertiary" size="sm" onClick={onManageTypes}>
              Manage Types
            </Button>

            <Button variant="tertiary" size="sm" onClick={onManageRubrics}>
              Manage Rubrics
            </Button>

            <Button variant="primary" size="sm" iconBefore={Add} onClick={onCreate}>
              New Template
            </Button>
          </div>
        </div>

        {/* Active type filter pill */}
        {typeFilter && (
          <div className="mt-2">
            <span className="small text-muted mr-1">Filtered by:</span>
            <Badge variant="primary" className="mr-1">
              {types.find((t) => t.id === typeFilter)?.name}
            </Badge>
            <Button
              variant="inline"
              size="sm"
              className="p-0 small"
              onClick={() => setTypeFilter('')}
              style={{ verticalAlign: 'baseline' }}
            >
              ✕ Clear
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-grow-1 overflow-auto p-4">
        {isLoading && (
          <div className="d-flex justify-content-center pt-5">
            <Spinner animation="border" variant="primary" screenReaderText="Loading templates" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center pt-5 text-muted">
            <p className="mb-2">
              {search || typeFilter ? 'No templates match your filters.' : 'No templates yet.'}
            </p>
            {!search && !typeFilter && (
              <Button variant="link" size="sm" onClick={onCreate}>
                Create your first template →
              </Button>
            )}
          </div>
        )}

        <div className="row">
          {filtered.map((t) => (
            <div key={t.id} className="col-12 col-sm-6 col-lg-4 col-xl-3" style={{ marginBottom: '1.5rem' }}>
              <Card
                style={{ opacity: t.is_active ? 1 : 0.6, height: '100%' }}
                className="shadow-sm"
              >
                <Card.ImageCap
                  src={t.thumbnail_url || t.image_url || ''}
                  fallbackSrc=""
                  srcAlt={t.name}
                  style={{ height: 140, objectFit: 'cover', background: '#f3f4f6' }}
                />

                <Card.Header
                  title={t.name}
                  actions={(
                    <Badge variant={t.is_active ? 'success' : 'secondary'}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  )}
                />

                <Card.Section>
                  <div className="d-flex flex-wrap" style={{ gap: '0.25rem' }}>
                    {t.template_type && (
                      <Badge variant="primary">{t.template_type.name}</Badge>
                    )}
                    <Badge variant="secondary">{t.fields.length} fields</Badge>
                    <Badge variant={t.is_public ? 'success' : 'light'}>
                      {t.is_public ? 'Public' : 'Private'}
                    </Badge>
                  </div>
                  {t.description && (
                    <p
                      className="small text-muted mt-2 mb-0"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {t.description}
                    </p>
                  )}
                </Card.Section>

                <Card.Footer>
                  <Button variant="tertiary" size="sm" onClick={() => onEdit(t)}>
                    Edit
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => toggleMut.mutate({ id: t.id, is_active: t.is_active })}
                    disabled={toggleMut.isPending}
                  >
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    style={{ color: '#dc3545' }}
                    onClick={() => handleDelete(t)}
                    disabled={deleteMut.isPending}
                  >
                    Delete
                  </Button>
                </Card.Footer>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
