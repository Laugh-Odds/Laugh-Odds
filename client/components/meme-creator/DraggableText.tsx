import React, { useRef, useCallback } from "react";
import { TextBox, Position } from "./types";

interface DraggableTextProps {
  box: TextBox;
  onMove: (id: string, position: Position) => void;
}

export const DraggableText: React.FC<DraggableTextProps> = ({
  box,
  onMove,
}) => {
  const dragState = useRef({
    isDragging: false,
    startPos: { x: 0, y: 0 },
    offset: { x: 0, y: 0 }
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current.isDragging = true;
    dragState.current.startPos = { x: e.clientX, y: e.clientY };
    dragState.current.offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Add event listeners to document (not window)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current.isDragging) return;

    // Get the container boundaries
    const container = document.querySelector(".image-container");
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // Calculate new position relative to container
    let newX = e.clientX - containerRect.left - dragState.current.offset.x;
    let newY = e.clientY - containerRect.top - dragState.current.offset.y;

    // Get text element dimensions for boundary constraints
    const textElement = document.querySelector(`[data-text-id="${box.id}"]`);
    const textRect = textElement?.getBoundingClientRect();
    const textWidth = textRect?.width || 100;
    const textHeight = textRect?.height || 30;

    // Constrain movement within container bounds
    newX = Math.max(0, Math.min(newX, containerRect.width - textWidth));
    newY = Math.max(0, Math.min(newY, containerRect.height - textHeight));

    onMove(box.id, { x: newX, y: newY });
  }, [box.id, onMove]);

  const handleMouseUp = useCallback(() => {
    dragState.current.isDragging = false;
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Restore text selection
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  // Touch event handlers with proper passive handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    
    dragState.current.isDragging = true;
    dragState.current.startPos = { x: touch.clientX, y: touch.clientY };
    dragState.current.offset = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };

    // Add touch event listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragState.current.isDragging || e.touches.length !== 1) return;

    // Prevent default scrolling behavior
    e.preventDefault();
    
    const touch = e.touches[0];
    const container = document.querySelector(".image-container");
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    let newX = touch.clientX - containerRect.left - dragState.current.offset.x;
    let newY = touch.clientY - containerRect.top - dragState.current.offset.y;

    // Get text element dimensions
    const textElement = document.querySelector(`[data-text-id="${box.id}"]`);
    const textRect = textElement?.getBoundingClientRect();
    const textWidth = textRect?.width || 100;
    const textHeight = textRect?.height || 30;

    // Constrain movement
    newX = Math.max(0, Math.min(newX, containerRect.width - textWidth));
    newY = Math.max(0, Math.min(newY, containerRect.height - textHeight));

    onMove(box.id, { x: newX, y: newY });
  }, [box.id, onMove]);

  const handleTouchEnd = useCallback(() => {
    dragState.current.isDragging = false;
    
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div
      data-text-id={box.id}
      className="absolute cursor-move p-3 bg-black/50 rounded-lg backdrop-blur-sm select-none"
      style={{
        left: `${box.position.x}px`,
        top: `${box.position.y}px`,
        fontSize: `${box.fontSize}px`,
        color: box.color,
        textShadow: "2px 2px 2px rgba(0,0,0,0.8)",
        touchAction: 'none', // Prevents default touch behaviors
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <div className="text-white pointer-events-none">
        {box.text}
      </div>
    </div>
  );
};