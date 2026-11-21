/**
 * TemplateSelector
 * Loads the template(s) assigned to the current XBlock usage key.
 *
 * - Exactly one assigned template → auto-selects it immediately (no UI shown)
 * - Multiple assigned templates → shows a picker
 * - Block query fails / no usage key → falls back to public template list
 */

import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Spinner,
  Alert,
  Badge,
  Card,
} from '@openedx/paragon';
import { blockTemplatesApi, templatesApi } from '../services/api';
import { useTasStore } from '../store/tasStore';
import type { Template, TemplateBlockItem } from '../types';

export const TemplateSelector: React.FC = () => {
  const {
    setSelectedTemplate, setMfeContext, submission, mfeContext,
  } = useTasStore();
  const usageKey = mfeContext?.usageKey ?? '';
  const autoSelectFired = useRef(false);

  // Fetch templates assigned to this block
  const blockQuery = useQuery({
    queryKey: ['block-templates', usageKey],
    queryFn: () => blockTemplatesApi.list(usageKey),
    enabled: !!usageKey,
    retry: false,
  });

  // Fall back to public list only when block query errors or no usageKey
  const publicQuery = useQuery({
    queryKey: ['templates', 'active'],
    queryFn: () => templatesApi.list({ is_public: true }),
    enabled: blockQuery.isError || !usageKey,
  });

  const blockData = blockQuery.data;
  const rawItems = blockData?.templates;
  // Backend returns a single object or array — normalise to array
  let blockItems: TemplateBlockItem[] = [];
  if (rawItems) {
    blockItems = Array.isArray(rawItems) ? rawItems : [rawItems];
  }
  const useBlockItems = blockItems.length > 0;

  // Auto-select when exactly one template is assigned to this block
  useEffect(() => {
    if (autoSelectFired.current) { return; }
    if (!useBlockItems || blockItems.length !== 1) { return; }
    if (submission) { return; }

    autoSelectFired.current = true;
    const item = blockItems[0];

    // Sync mfeContext with the canonical usage_key and course_id from the DB record
    // (URL may differ from what the TemplateBlock was created with)
    if (mfeContext && blockData) {
      setMfeContext({
        ...mfeContext,
        usageKey: blockData.usage_key,
        courseId: blockData.course_id,
      });
    }

    templatesApi.get(item.template.id)
      .then((fullTemplate) => {
        setSelectedTemplate(fullTemplate, item.template_block_id);
      })
      .catch((err) => {
        autoSelectFired.current = false; // allow retry on error
        console.error('Failed to load template', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBlockItems, blockItems.length, submission]);

  const isLoading = blockQuery.isLoading || (blockQuery.isError && publicQuery.isLoading);
  const error = blockQuery.isError && publicQuery.isError ? publicQuery.error : null;

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '16rem' }}>
        <Spinner animation="border" variant="primary" screenReaderText="Loading templates" />
      </div>
    );
  }

  // Single template — show spinner while auto-select fetch resolves
  if (useBlockItems && blockItems.length === 1 && !submission) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '16rem' }}>
        <Spinner animation="border" variant="primary" screenReaderText="Loading template" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-4 text-center" style={{ minHeight: '16rem' }}>
        <Alert variant="danger" className="w-100">
          <Alert.Heading>Failed to load templates</Alert.Heading>
          <p className="mb-0 small">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </Alert>
      </div>
    );
  }

  // Build display list for the picker (multiple templates case)
  const publicTemplates = publicQuery.data?.results ?? [];
  const displayTemplates: Template[] = useBlockItems
    ? blockItems.map((item) => ({
      id: item.template.id,
      name: item.template.name,
      template_type: {
        id: '', ...item.template.template_type, description: '', icon: '', is_active: true,
      },
      template_type_id: '',
      description: '',
      image_url: '',
      image_width: item.template.image_width,
      image_height: item.template.image_height,
      thumbnail_url: item.template.thumbnail_url ?? '',
      fields: [],
      field_positions: {},
      is_public: true,
      is_active: true,
      created_by: '',
      created_at: '',
      updated_at: '',
    } as Template))
    : publicTemplates;

  if (displayTemplates.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center p-4 text-center" style={{ minHeight: '16rem' }}>
        <Alert variant="info" className="w-100">
          <Alert.Heading>No templates assigned to this block</Alert.Heading>
          <p className="mb-0 small">Please contact your instructor.</p>
        </Alert>
      </div>
    );
  }

  const handleSelect = (template: Template) => {
    if (useBlockItems) {
      const item = blockItems.find((bi) => bi.template.id === template.id);
      if (item) {
        if (mfeContext && blockData) {
          setMfeContext({ ...mfeContext, usageKey: blockData.usage_key, courseId: blockData.course_id });
        }
        templatesApi.get(item.template.id).then((fullTemplate) => {
          setSelectedTemplate(fullTemplate, item.template_block_id);
        }).catch(console.error);
        return;
      }
    }
    // Public fallback — already has full data from list endpoint
    setSelectedTemplate(template, template.id);
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="font-weight-bold">Choose a Template</h2>
        <p className="small text-muted mt-1">
          Select a template below to begin your assignment.
        </p>
        {submission && submission.status === 'submitted' && (
          <Alert variant="success" className="mt-3 mb-0">
            You have already submitted this assignment.
          </Alert>
        )}
      </div>

      <div className="row">
        {displayTemplates.map((template) => (
          <div key={template.id} className="col-12 col-sm-6 col-lg-4 mb-4">
            <Card isClickable onClick={() => handleSelect(template)} className="h-100">
              <Card.ImageCap
                src={template.thumbnail_url || template.image_url || ''}
                srcAlt={template.name}
                fallbackSrc=""
                imageLoadingType="eager"
                skeletonHeight={220}
              >
                {!(template.thumbnail_url || template.image_url) && (
                  <div
                    className="d-flex align-items-center justify-content-center w-100"
                    style={{ minHeight: '220px', background: '#e8f0fe' }}
                  >
                    <svg width="64" height="64" fill="none" stroke="#93b4f7" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                )}
              </Card.ImageCap>
              <Card.Header
                title={template.name}
                actions={
                  template.template_type
                    ? <Badge variant="light">{template.template_type.name}</Badge>
                    : undefined
                }
              />
              <Card.Section>
                {template.description && (
                  <p className="small text-muted mb-2">{template.description}</p>
                )}
              </Card.Section>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
