import { useRef, useCallback, useState } from 'react';

interface UseDragGestureOptions {
  onDragRight: () => void;
  onTap: () => void;
  dragThreshold?: number;   // default: 40px
  swipeThreshold?: number;  // default: 10px
}

export const useDragGesture = ({
  onDragRight,
  onTap,
  dragThreshold = 40,
  swipeThreshold = 10,
}: UseDragGestureOptions) => {
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startPosRef.current = { x: clientX, y: clientY };
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current) return;

      const dx = clientX - startPosRef.current.x;
      const dy = clientY - startPosRef.current.y;

      // Check if dragging right beyond threshold (prioritize horizontal drag)
      // Only consider dragging if horizontal movement is significantly more than vertical
      if (dx > dragThreshold && Math.abs(dx) > Math.abs(dy)) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }
    },
    [dragThreshold]
  );

  const handleEnd = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current) return;

      const dx = clientX - startPosRef.current.x;
      const dy = clientY - startPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (isDraggingRef.current || (dx > dragThreshold && Math.abs(dx) > Math.abs(dy))) {
        // Drag right detected
        onDragRight();
      } else if (distance < swipeThreshold) {
        // Tap detected
        onTap();
      }

      // Cleanup
      startPosRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [onDragRight, onTap, dragThreshold, swipeThreshold]
  );

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

  const handleOnMouseUp = useCallback(
    (e: React.MouseEvent) => {
      handleEnd(e.clientX, e.clientY);
    },
    [handleEnd]
  );

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

  const handleOnTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      handleEnd(touch.clientX, touch.clientY);
    },
    [handleEnd]
  );

  return {
    handlers: {
      onMouseDown: handleOnMouseDown,
      onMouseMove: handleOnMouseMove,
      onMouseUp: handleOnMouseUp,
      onTouchStart: handleOnTouchStart,
      onTouchMove: handleOnTouchMove,
      onTouchEnd: handleOnTouchEnd,
    },
    isDragging,
  };
};
