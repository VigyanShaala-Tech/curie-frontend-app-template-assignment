/**
 * Vertical drag handle between two side-by-side panes.
 * Pointer capture keeps move and release on this element for mouse and touch.
 */

import React, { useEffect, useRef } from 'react';
import { SPLITTER_WIDTH } from '../utils/clampSplitWidth';

interface Props {
  onResize: (clientX: number) => void;
  label?: string;
}

export const VerticalPanelSplitter: React.FC<Props> = ({
  onResize,
  label = 'Resize panels',
}) => {
  const dragging = useRef(false);
  const previousBodyStyle = useRef<{ userSelect: string; cursor: string } | null>(null);

  const endDragChrome = () => {
    if (!previousBodyStyle.current) { return; }
    document.body.style.userSelect = previousBodyStyle.current.userSelect;
    document.body.style.cursor = previousBodyStyle.current.cursor;
    previousBodyStyle.current = null;
  };

  const finishDrag = () => {
    if (!dragging.current) { return; }
    dragging.current = false;
    endDragChrome();
  };

  useEffect(() => () => {
    dragging.current = false;
    if (!previousBodyStyle.current) { return; }
    document.body.style.userSelect = previousBodyStyle.current.userSelect;
    document.body.style.cursor = previousBodyStyle.current.cursor;
    previousBodyStyle.current = null;
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragging.current) { return; }
    event.preventDefault();
    dragging.current = true;
    previousBodyStyle.current = {
      userSelect: document.body.style.userSelect,
      cursor: document.body.style.cursor,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) { return; }
    onResize(event.clientX);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={finishDrag}
      style={{
        width: SPLITTER_WIDTH,
        flexShrink: 0,
        alignSelf: 'stretch',
        cursor: 'col-resize',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: 'transparent',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 1,
          background: '#e5e7eb',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'relative',
          width: 4,
          height: 28,
          borderRadius: 2,
          background: '#d1d5db',
        }}
      />
    </div>
  );
};
