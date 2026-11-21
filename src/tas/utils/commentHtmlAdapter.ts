/**
 * UI-only helpers to bridge Quill HTML with plain-text instructorCommentSync.
 * Does not change sync algorithms — converts at the call site only.
 */

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

export function looksLikeHtml(value: string): boolean {
  return HTML_TAG_RE.test(value);
}

export function htmlToPlainText(html: string): string {
  if (!html) {
    return '';
  }
  if (!looksLikeHtml(html)) {
    return html;
  }

  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd();
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR']);

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      return '\n';
    }
    let out = '';
    el.childNodes.forEach((child) => {
      out += walk(child);
    });
    if (blockTags.has(tag)) {
      out += '\n';
    }
    return out;
  };

  return walk(doc.body)
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd();
}

/** Quill empty document / whitespace-only → '' so API payloads match the old textarea. */
export function normalizeEditorHtml(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }
  if (!htmlToPlainText(html).trim()) {
    return '';
  }
  return html;
}

export function plainTextToHtml(plain: string): string {
  if (!plain) {
    return '';
  }
  if (looksLikeHtml(plain) && !plain.includes('\n')) {
    return plain;
  }

  const escape = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return plain
    .split(/\n\n+/)
    .map((paragraph) => {
      const withBreaks = escape(paragraph).replace(/\n/g, '<br>');
      return `<p>${withBreaks || '<br>'}</p>`;
    })
    .join('');
}

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'A',
  'H1', 'H2', 'H3', 'SPAN', 'DIV', 'UL', 'OL', 'LI',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel']),
  SPAN: new Set(['class', 'style']),
  P: new Set(['class', 'style']),
  DIV: new Set(['class', 'style']),
  H1: new Set(['class', 'style']),
  H2: new Set(['class', 'style']),
  H3: new Set(['class', 'style']),
  UL: new Set(['class']),
  OL: new Set(['class']),
  LI: new Set(['class', 'style', 'data-list']),
};

/** Minimal sanitizer for Quill HTML before dangerouslySetInnerHTML. */
export function sanitizeCommentHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  const sanitizeNode = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
      return;
    }

    [...el.attributes].forEach((attr) => {
      const allowed = ALLOWED_ATTRS[tag];
      if (!allowed || !allowed.has(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    });

    if (tag === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:|\/)/i.test(href)) {
        el.removeAttribute('href');
      }
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }

    [...el.childNodes].forEach(sanitizeNode);
  };

  [...doc.body.childNodes].forEach(sanitizeNode);
  return doc.body.innerHTML;
}
