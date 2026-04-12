'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onCapture: (dataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  label?: string;
  clearLabel?: string;
}

export function SignaturePad({
  onCapture,
  onClear,
  width = 280,
  height = 120,
  label = 'Sign here',
  clearLabel = 'Clear',
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Set up canvas resolution for retina displays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1a1a1a';
    }
  }, [width, height]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if ('touches' in e) {
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return null;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const startStroke = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      setIsDrawing(true);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    },
    [getPos],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const pos = getPos(e);
      if (!pos) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasStrokes(true);
    },
    [isDrawing, getPos],
  );

  const endStroke = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasStrokes) {
      onCapture(canvas.toDataURL('image/png'));
    }
  }, [isDrawing, hasStrokes, onCapture]);

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, width * dpr, height * dpr);
    setHasStrokes(false);
    onClear?.();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <canvas
        ref={canvasRef}
        className="rounded-md border border-border bg-white cursor-crosshair"
        style={{ touchAction: 'none' }}
        onMouseDown={startStroke}
        onMouseMove={draw}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
        onTouchStart={startStroke}
        onTouchMove={draw}
        onTouchEnd={endStroke}
      />
      <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasStrokes}>
        {clearLabel}
      </Button>
    </div>
  );
}
