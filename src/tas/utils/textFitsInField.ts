/**
 * Determines whether text fits inside a template field box using the same
 * typography/wrapping rules as FieldOverlay (off-DOM measurement probe).
 */

import type { FieldLayoutMetrics } from './fieldLayout';
import { fieldTextStyle } from './fieldLayout';

const PROBE_ID = 'tas-field-fit-probe';

function getProbe(): HTMLDivElement | null {
  if (typeof document === 'undefined') { return null; }

  let probe = document.getElementById(PROBE_ID) as HTMLDivElement | null;
  if (!probe) {
    probe = document.createElement('div');
    probe.id = PROBE_ID;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.left = '-10000px';
    probe.style.top = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.zIndex = '-1';
    document.body.appendChild(probe);
  }
  return probe;
}

function applyProbeLayout(probe: HTMLDivElement, layout: FieldLayoutMetrics): void {
  const styles = fieldTextStyle(layout);
  const node = probe.style;
  node.setProperty('width', `${layout.boxWidth}px`);
  node.setProperty('height', `${layout.boxHeight}px`);
  node.setProperty('overflow', 'hidden');
  node.setProperty('font-family', String(styles.fontFamily ?? ''));
  node.setProperty('font-weight', String(styles.fontWeight ?? ''));
  node.setProperty('font-size', `${layout.fontSize}px`);
  node.setProperty('line-height', String(styles.lineHeight ?? ''));
  node.setProperty('color', String(styles.color ?? ''));
  node.setProperty('padding', `${layout.padding}px`);
  node.setProperty('box-sizing', 'border-box');
  node.setProperty('white-space', 'pre-wrap');
  node.setProperty('overflow-wrap', 'anywhere');
  node.setProperty('word-break', 'break-word');
}

/**
 * Returns true when `text` renders fully inside the field box
 * (no vertical or horizontal overflow under canonical styles).
 */
export function textFitsInField(text: string, layout: FieldLayoutMetrics): boolean {
  if (!text) { return true; }
  if (layout.contentWidth <= 0 || layout.contentHeight <= 0) { return false; }

  const probe = getProbe();
  if (!probe) {
    // SSR / non-DOM: be permissive; submit path still clamps when DOM is available.
    return true;
  }

  applyProbeLayout(probe, layout);
  probe.textContent = text;

  // Allow 1px tolerance for sub-pixel rounding differences across browsers.
  const fitsHeight = probe.scrollHeight <= layout.boxHeight + 1;
  const fitsWidth = probe.scrollWidth <= layout.boxWidth + 1;
  return fitsHeight && fitsWidth;
}
