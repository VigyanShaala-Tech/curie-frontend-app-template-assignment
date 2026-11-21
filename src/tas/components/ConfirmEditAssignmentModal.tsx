/**
 * ConfirmEditAssignmentModal
 * Confirmation when the student opens Edit Assignment from a CURIE review.
 * Display-only — edit/reopen logic stays in CurieReviewScreen / TasApp.
 *
 * Desktop: Paragon ModalDialog. Mobile/APK: in-tree MobileActionModal.
 */

import React from 'react';
import { ModalDialog, Icon } from '@openedx/paragon';
import { WarningAmber } from '@openedx/paragon/icons';
import { useTasStore } from '../store/tasStore';
import { MobileActionModal } from './MobileActionModal';

const SUBMIT_GREEN = '#69AB4A';
const WARNING_AMBER = '#f59e0b';

export const EDIT_ASSIGNMENT_CONFIRM_MESSAGE = 'Editing will let you revise your answers and resubmit for a new review. Continue?';

interface Props {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  flex: 1,
  padding: '12px 16px',
  borderRadius: 10,
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
  justifyContent: 'center',
  gap: 8,
  flex: 1,
  padding: '12px 16px',
  borderRadius: 10,
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

export const ConfirmEditAssignmentModal: React.FC<Props> = ({
  isOpen,
  isSaving,
  onClose,
  onCancel,
  onConfirm,
}) => {
  const isMobile = useTasStore((s) => s.isMobile);

  if (!isOpen) {
    return null;
  }

  const footerButtons = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        marginTop: isMobile ? 16 : 0,
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        style={{
          ...secondaryBtnStyle,
          opacity: isSaving ? 0.6 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer',
        }}
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onConfirm}
        disabled={isSaving}
        style={{
          ...primaryBtnStyle,
          opacity: isSaving ? 0.6 : 1,
          cursor: isSaving ? 'not-allowed' : 'pointer',
        }}
      >
        Confirm
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <MobileActionModal
        isOpen={isOpen}
        title="Edit this assignment?"
        onClose={onClose}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
        }}
        >
          {titleIcon}
          <h3 style={{
            margin: 0, fontSize: 16, fontWeight: 700, color: '#111827',
          }}
          >
            Edit this assignment?
          </h3>
        </div>
        <p style={{
          margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.5,
        }}
        >
          {EDIT_ASSIGNMENT_CONFIRM_MESSAGE}
        </p>
        {footerButtons}
      </MobileActionModal>
    );
  }

  return (
    <ModalDialog
      title="Edit this assignment?"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      hasCloseButton
      isOverflowVisible={false}
    >
      <ModalDialog.Header>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, paddingRight: 8,
        }}
        >
          {titleIcon}
          <ModalDialog.Title style={{ margin: 0 }}>Edit this assignment?</ModalDialog.Title>
        </div>
      </ModalDialog.Header>

      <ModalDialog.Body>
        <div style={{ maxWidth: 560, paddingBottom: 4 }}>
          <p style={{
            margin: 0, color: '#6b7280', fontSize: 14, lineHeight: 1.5,
          }}
          >
            {EDIT_ASSIGNMENT_CONFIRM_MESSAGE}
          </p>
        </div>
      </ModalDialog.Body>

      <ModalDialog.Footer>
        {footerButtons}
      </ModalDialog.Footer>
    </ModalDialog>
  );
};
