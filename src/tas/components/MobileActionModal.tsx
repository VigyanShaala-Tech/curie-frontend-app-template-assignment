/**
 * MobileActionModal
 * In-tree fixed overlay for student confirmation dialogs on mobile / APK WebView.
 * Desktop continues to use Paragon ModalDialog (portal + 100vh centering).
 *
 * Card is flex-centered inside the overlay (no portal, no visualViewport offsets)
 * so Android WebView shows the dialog whenever the grey backdrop is visible.
 */

import React from 'react';

const BACKDROP_Z = 70;
const MAX_WIDTH = 360;

interface Props {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const MobileActionModal: React.FC<Props> = ({
  isOpen,
  title,
  onClose,
  children,
}) => {
  if (!isOpen) { return null; }

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: BACKDROP_Z,
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        aria-modal="true"
        style={{
          position: 'relative',
          width: '86vw',
          maxWidth: MAX_WIDTH,
          maxHeight: '90%',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.18)',
          overflowY: 'auto',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            borderRadius: 8,
            padding: 0,
            zIndex: 1,
          }}
        >
          ×
        </button>
        <div
          style={{
            position: 'relative',
            padding: '16px 12px 16px',
            paddingRight: 36,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
