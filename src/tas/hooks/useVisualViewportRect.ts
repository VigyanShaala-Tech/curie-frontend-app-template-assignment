import { useEffect, useState } from 'react';

export interface VisualViewportRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getViewportRect(): VisualViewportRect {
  if (typeof window === 'undefined') {
    return {
      top: 0, left: 0, width: 0, height: 0,
    };
  }

  const vv = window.visualViewport;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
    };
  }

  return {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Tracks window.visualViewport so fixed UI stays within the visible area
 * (above the mobile software keyboard). Falls back to window dimensions
 * when the Visual Viewport API is unavailable.
 */
export function useVisualViewportRect(active: boolean): VisualViewportRect {
  const [rect, setRect] = useState<VisualViewportRect>(getViewportRect);

  useEffect(() => {
    if (!active || typeof window === 'undefined') { return undefined; }

    const update = () => setRect(getViewportRect());

    update();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active]);

  return rect;
}
