/**
 * FieldOverlay
 * Renders one positioned field on top of the template image.
 * Uses inline styles for positioning (no Tailwind/Paragon needed for absolute placement).
 */

import React from 'react';
import { useTasStore } from '../store/tasStore';
import { resolveFieldLayout, fieldTextStyle } from '../utils/fieldLayout';
import type { FormField, FieldPosition } from '../types';

interface FieldOverlayProps {
  field: FormField;
  position: FieldPosition;
  isSelected: boolean;
  actualImageWidth: number;
  actualImageHeight: number;
  isReadOnly?: boolean;
  formDataOverride?: Record<string, string>;
}

const CAPACITY_WARNING = 'This field has reached its maximum capacity.';

export const FieldOverlay: React.FC<FieldOverlayProps> = ({
  field,
  position,
  isSelected,
  actualImageWidth,
  actualImageHeight,
  isReadOnly = false,
  formDataOverride,
}) => {
  const {
    openFieldEditor, formData, isMobile, fieldCapacityFull,
  } = useTasStore();

  const layout = resolveFieldLayout(field, position, actualImageWidth, actualImageHeight);
  const fieldValue = (formDataOverride ?? formData)[field.id] ?? '';
  const hasValue = fieldValue.trim().length > 0;
  const isInactive = isReadOnly;
  const isCapacityFull = Boolean(fieldCapacityFull[field.id]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInactive) { openFieldEditor(field.id); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openFieldEditor(field.id);
    }
  };

  const isEmptyPlaceholder = !isInactive && !isSelected && !hasValue;

  let borderColor = '#d1d5db';
  if (isInactive) {
    borderColor = 'transparent';
  } else if (isSelected) {
    borderColor = '#3b82f6';
  } else if (hasValue) {
    borderColor = '#22c55e';
  }

  const borderWidth = isEmptyPlaceholder ? 1 : 2;
  const borderStyle = isEmptyPlaceholder ? 'dashed' : 'solid';

  let bgColor = 'rgba(255,255,255,0.15)';
  if (isInactive) {
    bgColor = 'transparent';
  } else if (isSelected) {
    bgColor = 'rgba(59,130,246,0.1)';
  } else if (hasValue) {
    bgColor = 'rgba(34,197,94,0.08)';
  }

  const textStyles = fieldTextStyle(layout);

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isInactive ? -1 : 0}
      aria-disabled={isInactive}
      aria-label={isInactive ? undefined : `Edit ${field.label}`}
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: `${position.width}%`,
        height: `${position.height}%`,
        border: `${borderWidth}px ${borderStyle} ${borderColor}`,
        backgroundColor: bgColor,
        cursor: isInactive ? 'default' : 'pointer',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
      }}
    >
      {/* Field header intentionally hidden on the assignment template; popup shows the label while editing. */}
      {!isInactive && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: isMobile ? -15 : -22,
            backgroundColor: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            borderRadius: 3,
            fontSize: isMobile ? 7 : 11,
            padding: isMobile ? '1px 3px' : '2px 6px',
            lineHeight: 1.2,
            visibility: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {field.label}
          {field.required && <span style={{ color: '#fca5a5', marginLeft: 2 }}>*</span>}
        </div>
      )}

      {/* Capacity warning — outside the content box so it does not cover assignment text */}
      {!isInactive && isCapacityFull && (
        <span
          role="img"
          aria-label={CAPACITY_WARNING}
          title={CAPACITY_WARNING}
          style={{
            position: 'absolute',
            top: -12,
            right: -12,
            width: isMobile ? 22 : 16,
            height: isMobile ? 22 : 16,
            borderRadius: '50%',
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            color: '#b45309',
            fontSize: isMobile ? 11 : 10,
            fontWeight: 700,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            pointerEvents: 'auto',
            boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          !
        </span>
      )}

      {/* Value preview */}
      {hasValue && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            ...textStyles,
            // padding already in textStyles; inset:0 + box padding matches PDF inset
          }}
        >
          {fieldValue}
        </div>
      )}
    </div>
  );
};
