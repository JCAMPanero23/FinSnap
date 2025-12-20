import { useRef, useCallback } from 'react';

interface UseDoubleTapOptions {
  onDoubleTap: () => void;
  tapWindow?: number; // Time window for second tap (ms)
  positionThreshold?: number; // Max distance between taps (px)
}

export const useDoubleTapGesture = ({
  onDoubleTap,
  tapWindow = 300,
  positionThreshold = 20,
}: UseDoubleTapOptions) => {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap) {
        const timeDiff = now - lastTap.time;
        const dx = clientX - lastTap.x;
        const dy = clientY - lastTap.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (timeDiff <= tapWindow && distance <= positionThreshold) {
          // Double tap detected!
          onDoubleTap();
          lastTapRef.current = null; // Reset
          return;
        }
      }

      // First tap or too slow/far for double tap
      lastTapRef.current = { time: now, x: clientX, y: clientY };
    },
    [onDoubleTap, tapWindow, positionThreshold]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      handleTap(e.clientX, e.clientY);
    },
    [handleTap]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touch) {
        handleTap(touch.clientX, touch.clientY);
      }
    },
    [handleTap]
  );

  return {
    handlers: {
      onClick: handleClick,
      onTouchEnd: handleTouchEnd,
    },
  };
};
