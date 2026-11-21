/**
 * Shared PDF embed + download actions used by instructor and student detail views.
 */

import React from 'react';
import { Card } from '@openedx/paragon';
import { downloadPdf } from '../utils/downloadPdf';

interface Props {
  pdfUrl: string | null | undefined;
  title?: string;
  downloadFilename?: string;
  iframeTitle?: string;
  height?: number;
  emptyMessage?: string;
  /** When false, only Download is shown (instructor default). */
  showViewPdf?: boolean;
}

const actionBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

export const SubmissionPdfViewer: React.FC<Props> = ({
  pdfUrl,
  title = 'Submitted Assignment',
  downloadFilename = 'submission.pdf',
  iframeTitle = 'Submission PDF',
  height = 600,
  emptyMessage = 'PDF unavailable for this submission.',
  showViewPdf = false,
}) => {
  if (!pdfUrl) {
    return (
      <Card className="shadow-sm mb-4">
        <Card.Header title={title} />
        <Card.Section>
          <p className="text-muted small mb-0">{emptyMessage}</p>
        </Card.Section>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm mb-4 tas-submission-pdf-viewer">
      <Card.Header title={title} />
      <Card.Section style={{ padding: 0 }}>
        <iframe
          src={pdfUrl}
          title={iframeTitle}
          style={{
            width: '100%', height, border: 'none', display: 'block',
          }}
        />
        <div
          className="px-3 py-2 border-top d-flex tas-submission-pdf-viewer__actions"
          style={{ background: '#f8f9fa', gap: 8 }}
        >
          {showViewPdf && (
            <button
              type="button"
              onClick={() => window.open(pdfUrl, '_blank')}
              style={{ ...actionBtnStyle, background: '#4b5563' }}
            >
              View PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => { downloadPdf(pdfUrl, downloadFilename); }}
            style={actionBtnStyle}
          >
            ↓ Download PDF
          </button>
        </div>
      </Card.Section>
    </Card>
  );
};
