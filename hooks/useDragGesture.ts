import { useRef, useCallback, useState, useEffect } from 'react';

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
  const isMouseDownRef = useRef(false);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    startPosRef.current = { x: clientX, y: clientY };
    isDraggingRef.current = false;
    setIsDragging(false);
    isMouseDownRef.current = true;
  }, []);

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current || !isMouseDownRef.current) return;

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
      if (!startPosRef.current || !isMouseDownRef.current) return;

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
      isMouseDownRef.current = false;
      setIsDragging(false);
    },
    [onDragRight, onTap, dragThreshold, swipeThreshold]
  );

  // Global mouse move handler for proper drag support
  const handleDocumentMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        handleMove(e.clientX, e.clientY);
      }
    },
    [handleMove]
  );

  // Global mouse up handler for proper drag support
  const handleDocumentMouseUp = useCallback(
    (e: MouseEvent) => {
      if (isMouseDownRef.current) {
        handleEnd(e.clientX, e.clientY);
      }
    },
    [handleEnd]
  );

  // Attach/detach global mouse listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [handleDocumentMouseMove, handleDocumentMouseUp]);

  const handleOnMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent text selection while dragging
      handleStart(e.clientX, e.clientY);
    },
    [handleStart]
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
      // Mouse move/up handled globally via document listeners
      onTouchStart: handleOnTouchStart,
      onTouchMove: handleOnTouchMove,
      onTouchEnd: handleOnTouchEnd,
    },
    isDragging,
  };
};
