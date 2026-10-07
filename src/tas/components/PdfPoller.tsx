/**
 * PdfPoller
 * After submit, polls GET /submissions/{id}/pdf/ until the backend-generated PDF is ready.
 */

import React, { useEffect, useState } from 'react';
import { submissionsApi } from '../services/api';
import { useTasStore } from '../store/tasStore';
import { downloadPdf } from '../utils/downloadPdf';
import type { Submission } from '../types';

const MAX_POLLS = 15; // 15 × 2s = 30s

interface Props {
  submissionOverride?: Submission | null;
}

export const PdfPoller: React.FC<Props> = ({ submissionOverride }) => {
  const storeSubmission = useTasStore((state) => state.submission);
  const setSubmission = useTasStore((state) => state.setSubmission);
  const submission = submissionOverride ?? storeSubmission;
  const submissionId = submission?.id;
  const submissionPdfUrl = submission?.pdf_url;
  const submissionStatus = submission?.status;
  const [pdfUrl, setPdfUrl] = useState<string | null>(submission?.pdf_url || null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setPdfUrl(submissionPdfUrl || null);
    setTimedOut(false);
    if (!submissionId || submissionStatus === 'draft' || submissionPdfUrl) {
      return undefined;
    }

    let polls = 0;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const checkPdf = async () => {
      polls += 1;
      let resolved = false;
      try {
        const res = await submissionsApi.getPdf(submissionId);
        if (!cancelled && res.pdf_url) {
          resolved = true;
          setPdfUrl(res.pdf_url);
          const currentSubmission = useTasStore.getState().submission;
          if (currentSubmission?.id === submissionId) {
            setSubmission({ ...currentSubmission, pdf_url: res.pdf_url });
          }
          if (interval) { clearInterval(interval); }
        }
      } catch { /* ignore */ }
      if (!cancelled && polls >= MAX_POLLS && !resolved) {
        setTimedOut(true);
        if (interval) { clearInterval(interval); }
      }
    };

    checkPdf();
    interval = setInterval(checkPdf, 2000);

    return () => {
      cancelled = true;
      if (interval) { clearInterval(interval); }
    };
  }, [
    setSubmission,
    submissionId,
    submissionPdfUrl,
    submissionStatus,
  ]);

  if (!submission || submission.status === 'draft') { return null; }

  const filename = `submission_v${submission.version_number}.pdf`;
  let statusLabel = 'Generating PDF…';
  if (pdfUrl) {
    statusLabel = 'PDF ready';
  } else if (timedOut) {
    statusLabel = 'PDF is taking longer than expected';
  }

  return (
    <div className={`tas-pdf-status-banner ${pdfUrl ? 'is-ready' : 'is-generating'}`}>
      <div className="tas-pdf-status-copy" role="status">
        <span className="tas-pdf-status-icon" aria-hidden="true">{pdfUrl ? '✓' : '…'}</span>
        <span>
          <strong>{statusLabel}</strong>
          <small>{pdfUrl ? 'Generated from this submitted version' : 'This usually takes a moment.'}</small>
        </span>
      </div>
      {pdfUrl && (
        <div className="tas-pdf-status-actions">
          <a className="tas-pdf-button" href={pdfUrl} target="_blank" rel="noreferrer">View PDF</a>
          <button
            type="button"
            className="tas-pdf-button tas-pdf-button--primary"
            onClick={() => { downloadPdf(pdfUrl, filename); }}
          >
            ↓ Download PDF
          </button>
        </div>
      )}
    </div>
  );
};
