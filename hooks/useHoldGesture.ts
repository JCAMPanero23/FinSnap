import { useRef, useCallback, useState } from 'react';

interface UseHoldGestureOptions {
  onHold: () => void;
  holdDuration?: number;
  movementThreshold?: number;
}

export const useHoldGesture = ({
  onHold,
  holdDuration = 2000,
  movementThreshold = 10,
}: UseHoldGestureOptions) => {
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isActiveHold, setIsActiveHold] = useState(false);

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      startPosRef.current = { x: clientX, y: clientY };
      setIsActiveHold(true);

      // Set timer for hold detection
      timerRef.current = setTimeout(() => {
        onHold();
        setIsActiveHold(false);
      }, holdDuration);
    },
    [onHold, holdDuration]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current || !timerRef.current) return;

      const dx = clientX - startPosRef.current.x;
      const dy = clientY - startPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved beyond threshold, cancel hold
      if (distance > movementThreshold) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setIsActiveHold(false);
      }
    },
    [movementThreshold]
  );

  const handleEnd = useCallback(() => {
    // Clear timer if still running
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    setIsActiveHold(false);
  }, []);

  // Cleanup on unmount
  const handleOnMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
  );

  const handleOnMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove]
  );

  const handleOnMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const handleOnTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart]
  );

  const handleOnTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  const handleOnTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  return {
    handlers: {
      onMouseDown: handleOnMouseDown,
      onMouseMove: handleOnMouseMove,
      onMouseUp: handleOnMouseUp,
      onTouchStart: handleOnTouchStart,
      onTouchMove: handleOnTouchMove,
      onTouchEnd: handleOnTouchEnd,
    },
    isActiveHold,
  };
};
