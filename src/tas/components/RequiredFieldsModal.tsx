/**
 * RequiredFieldsModal
 * Custom validation warning when required fields are missing on submit.
 * Display-only replacement for the native browser alert — validation logic stays in TasApp.
 *
 * Desktop: Paragon ModalDialog. Mobile/APK: in-tree MobileActionModal.
 */

import React from 'react';
import { ModalDialog, Icon } from '@openedx/paragon';
import { WarningAmber, Save, ArrowForward } from '@openedx/paragon/icons';
import { useTasStore } from '../store/tasStore';
import { MobileActionModal } from './MobileActionModal';

const SUBMIT_GREEN = '#69AB4A';
const WARNING_AMBER = '#f59e0b';

interface Props {
  isOpen: boolean;
  missingFields: string[];
  isSaving: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSaveDraftAndGoBack: () => void;
  allowSaveDraft?: boolean;
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  background: '#fff',
  color: SUBMIT_GREEN,
  border: `1.5px solid ${SUBMIT_GREEN}`,
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  background: SUBMIT_GREEN,
  color: '#fff',
  border: `1.5px solid ${SUBMIT_GREEN}`,
  cursor: 'pointer',
};

const titleIcon = (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'rgba(245, 158, 11, 0.12)',
      color: WARNING_AMBER,
      flexShrink: 0,
    }}
    aria-hidden="true"
  >
    <Icon src={WarningAmber} style={{ width: 24, height: 24 }} />
  </span>
);

export const RequiredFieldsModal: React.FC<Props> = ({
  isOpen,
  missingFields,
  isSaving,
  onClose,
  onComplete,
  onSaveDraftAndGoBack,
  allowSaveDraft = true,
}) => {
  const isMobile = useTasStore((s) => s.isMobile);

  const fieldList = (
    <div style={{ maxWidth: 560, paddingBottom: 4 }}>
      <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 14, lineHeight: 1.5 }}>
        Please complete the required fields before submitting your response.
      </p>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
        <ul
          style={{
            margin: 0,
            paddingLeft: 0,
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {missingFields.map((label, index) => (
            <li
              key={`${label}-${index}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 0',
                color: '#374151',
                fontSize: 14,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: WARNING_AMBER,
                  marginTop: 6,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const footerButtons = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        marginTop: isMobile ? 16 : 0,
      }}
    >
      {allowSaveDraft && (
      <button
        type="button"
        onClick={onSaveDraftAndGoBack}
        disabled={isSaving}
        style={{
          ...secondaryBtnStyle,
          opacity: isSaving ? 0.6 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer',
        }}
      >
        <Icon src={Save} style={{ width: 18, height: 18 }} />
        {isSaving ? 'Saving…' : 'Save Draft & Go Back'}
      </button>
      )}

      <button
        type="button"
        onClick={onComplete}
        disabled={isSaving}
        style={{
          ...primaryBtnStyle,
          opacity: isSaving ? 0.6 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer',
        }}
      >
        I&apos;ll Complete It
        <Icon src={ArrowForward} style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <MobileActionModal
        isOpen={isOpen}
        title="Complete required fields"
        onClose={onClose}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {titleIcon}
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            Complete required fields
          </h3>
        </div>
        {fieldList}
        {footerButtons}
      </MobileActionModal>
    );
  }

  return (
    <ModalDialog
      title="Complete required fields"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      hasCloseButton
      isOverflowVisible={false}
    >
      <ModalDialog.Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 8 }}>
          {titleIcon}
          <ModalDialog.Title style={{ margin: 0 }}>Complete required fields</ModalDialog.Title>
        </div>
      </ModalDialog.Header>

      <ModalDialog.Body>
        {fieldList}
      </ModalDialog.Body>

      <ModalDialog.Footer>
        {footerButtons}
      </ModalDialog.Footer>
    </ModalDialog>
  );
};
