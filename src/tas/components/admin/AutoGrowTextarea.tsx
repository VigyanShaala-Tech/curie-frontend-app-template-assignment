import React, { useLayoutEffect, useRef } from 'react';

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & {
  value: string;
};

/**
 * Textarea that grows to fit its content and can still be resized by dragging.
 * It only ever grows on its own, so a height the user dragged larger is kept.
 */
export const AutoGrowTextarea: React.FC<Props> = ({
  value, className = '', rows = 1, ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) { return; }
    if (node.scrollHeight > node.clientHeight) {
      const borders = node.offsetHeight - node.clientHeight;
      node.style.height = `${node.scrollHeight + borders}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      className={`form-control form-control-sm tas-autogrow ${className}`.trim()}
      {...rest}
    />
  );
};
