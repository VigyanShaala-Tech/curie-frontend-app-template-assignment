/**
 * Student-facing instructor comment helpers:
 * - stripCategoryHeadingsFromComment: remove rubric heading blocks, keep rich HTML
 * - flattenStudentFeedbackLines: legacy plain-text line flatten (compat/tests)
 */

import {
  htmlToPlainText,
  looksLikeHtml,
  sanitizeCommentHtml,
} from './commentHtmlAdapter';

/** True when a line is a rubric category heading like "Technical Accuracy:". */
export function isCategoryHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.endsWith(':') && !trimmed.slice(0, -1).includes(':');
}

const HEADING_BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3']);

/**
 * Remove only rubric category heading blocks from a stored instructor comment.
 * Preserves Quill rich-text markup for the remaining content, then sanitizes.
 */
export function stripCategoryHeadingsFromComment(comment: string): string {
  if (!comment?.trim()) {
    return '';
  }

  if (!looksLikeHtml(comment)) {
    const plain = comment
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !isCategoryHeadingLine(trimmed);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return plain;
  }

  if (typeof DOMParser === 'undefined') {
    return sanitizeCommentHtml(comment);
  }

  const doc = new DOMParser().parseFromString(comment, 'text/html');

  const candidates = [
    ...doc.body.querySelectorAll('p, div, h1, h2, h3'),
  ];

  candidates.forEach((el) => {
    if (!HEADING_BLOCK_TAGS.has(el.tagName)) {
      return;
    }
    const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    if (isCategoryHeadingLine(text)) {
      el.remove();
    }
  });

  [...doc.body.querySelectorAll('p, div')].forEach((el) => {
    const text = (el.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    const onlyBr = el.childNodes.length === 1
      && el.firstChild?.nodeName === 'BR';
    if (!text && (onlyBr || el.childNodes.length === 0)) {
      el.remove();
    }
  });

  return sanitizeCommentHtml(doc.body.innerHTML);
}

/**
 * Convert stored instructor comment HTML/plain text into non-heading content lines.
 * Kept for compatibility / tests; student UI prefers stripCategoryHeadingsFromComment.
 */
export function flattenStudentFeedbackLines(comment: string): string[] {
  if (!comment?.trim()) {
    return [];
  }
  let plain = htmlToPlainText(comment);
  plain = plain
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  return plain
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\u2022*-]\s*/, '').trim())
    .filter((line) => line.length > 0 && !isCategoryHeadingLine(line));
}
