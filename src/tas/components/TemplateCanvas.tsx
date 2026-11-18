/**
 * TemplateCanvas
 * Renders the template image with all field overlays.
 * Zoom/pan via react-zoom-pan-pinch, contained inside the white card from TasApp.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useTasStore } from '../store/tasStore';
import { FieldOverlay } from './FieldOverlay';
import { fittedCanvasBox } from '../utils/fitScaleToWidth';
import type { Template } from '../types';

interface Props {
  template: Template;
  readOnly?: boolean;
  overlay?: React.ReactNode;
  formDataOverride?: Record<string, string>;
  /** Review pane. The image keeps its width and extra pages scroll. */
  fitToPane?: boolean;
}

export const TemplateCanvas: React.FC<Props> = ({
  template,
  readOnly = false,
  overlay = null,
  formDataOverride,
  fitToPane = false,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    setCanvasState, selectedFieldId, setSelectedFieldId, isMobile,
  } = useTasStore();

  const imageNaturalW = template.image_width || 794;
  const imageNaturalH = template.image_height || 1123;

  const [containerWidth, setContainerWidth] = useState(0);
  const [viewScale, setViewScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) { return undefined; }

    const update = () => {
      const next = el.clientWidth;
      setContainerWidth((prev) => (Math.abs(prev - next) < 2 ? prev : next));
    };

    update();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(update)
      : null;
    observer?.observe(el);

    return () => {
      observer?.disconnect();
    };
  }, []);

  const fitted = fittedCanvasBox(
    containerWidth || imageNaturalW,
    imageNaturalW,
    imageNaturalH,
    0,
  );
  const zoomedIn = viewScale != null && viewScale > fitted.scale + 0.02;

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) { setSelectedFieldId(null); }
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedFieldId(null);
    }
  };

  const transformKey = `fit-${fitted.scale.toFixed(4)}-${imageNaturalW}x${imageNaturalH}`;

  return (
    <div
      ref={wrapperRef}
      className={`tas-template-canvas${fitToPane ? ' tas-template-canvas--fit-pane' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: fitted.height,
        overflow: 'visible',
        ['--tas-aspect-ratio' as string]: `${imageNaturalW}/${imageNaturalH}`,
      }}
    >
      <TransformWrapper
        key={transformKey}
        initialScale={fitted.scale}
        initialPositionX={0}
        initialPositionY={0}
        minScale={fitted.scale}
        maxScale={5}
        limitToBounds={false}
        centerOnInit={false}
        wheel={{ disabled: true }}
        pinch={{ disabled: !isMobile }}
        panning={{ disabled: !zoomedIn, allowRightClickPan: false }}
        onTransformed={(ref) => {
          setViewScale(ref.state.scale);
          setCanvasState({
            scale: ref.state.scale,
            positionX: ref.state.positionX,
            positionY: ref.state.positionY,
          });
        }}
      >
        {({
          zoomIn, zoomOut, setTransform,
        }) => (
          <>
            {/* Zoom controls */}
            <div style={{
              position: 'sticky',
              top: 8,
              zIndex: 10,
              height: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
              paddingRight: 8,
            }}
            >
              {[
                { label: '+', action: () => zoomIn() },
                { label: '−', action: () => zoomOut() },
                {
                  label: '↺',
                  action: () => setTransform(0, 0, fitted.scale, 0),
                },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  style={{
                    width: 32,
                    height: 32,
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#374151',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={{
                textAlign: 'center',
                fontSize: 10,
                color: '#6b7280',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 4,
                padding: '1px 3px',
              }}
              >
                {Math.round((viewScale ?? fitted.scale) * 100)}%
              </div>
            </div>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              }}
              contentClass="tas-template-canvas__transform-content"
            >
              <div
                ref={canvasRef}
                className="tas-template-canvas__content"
                onClick={handleCanvasClick}
                onKeyDown={handleCanvasKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Assignment canvas"
                style={{
                  position: 'relative',
                  width: imageNaturalW,
                  height: imageNaturalH,
                  flexShrink: 0,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                {template.image_url ? (
                  <img
                    src={template.image_url}
                    alt={template.name}
                    draggable={false}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                ) : (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#fff',
                    border: '2px dashed #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  >
                    <span style={{ color: '#9ca3af', fontSize: 14 }}>No template image</span>
                  </div>
                )}

                {template.fields.map((field) => {
                  const position = template.field_positions[field.id];
                  if (!position) { return null; }
                  return (
                    <FieldOverlay
                      key={field.id}
                      field={field}
                      position={position}
                      isSelected={selectedFieldId === field.id}
                      actualImageWidth={imageNaturalW}
                      actualImageHeight={imageNaturalH}
                      isReadOnly={readOnly}
                      formDataOverride={formDataOverride}
                    />
                  );
                })}
                {overlay ? (
                  <div className="tas-template-canvas__overlay">
                    {overlay}
                  </div>
                ) : null}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
