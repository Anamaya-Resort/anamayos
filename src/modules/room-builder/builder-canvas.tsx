'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { BedShape } from './bed-shape';
import { SplitKingConnectors } from './split-king-connector';
import {
  BASE_SCALE,
  M_TO_FT,
  BED_PRESETS,
  type LayoutShape,
  type LayoutBedPlacement,
  type LayoutLabel,
  type LayoutUnit,
  type LayoutShapeType,
} from './types';
import type { RoomBed, ActiveTool, ShapePreset } from './room-builder-shell';

interface BuilderCanvasProps {
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  labels: LayoutLabel[];
  setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>>;
  beds: RoomBed[];
  unit: LayoutUnit;
  activeTool: ActiveTool;
  shapePreset: ShapePreset;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
}

// Grid colors
const GRID_MAJOR = '#d4d4d8';
const GRID_MINOR = '#e8e8ec';

// Shape fill colors by type
const SHAPE_FILLS: Record<LayoutShapeType, string> = {
  room: '#f5f5f4',
  bathroom: '#e0f2fe',
  deck: '#f0fdf4',
  loft: '#fef3c7',
};
const SHAPE_STROKES: Record<LayoutShapeType, string> = {
  room: '#78716c',
  bathroom: '#7dd3fc',
  deck: '#86efac',
  loft: '#fcd34d',
};

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BuilderCanvas({
  shapes,
  setShapes,
  bedPlacements,
  setBedPlacements,
  labels,
  setLabels,
  beds,
  unit,
  activeTool,
  shapePreset,
  selectedId,
  setSelectedId,
  setActiveTool,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });

  // Drawing state for rectangle tool
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: LayoutShape } | null>(null);

  // Dragging state for bed drops from external palette
  const [dragBed, setDragBed] = useState<{ bedId: string; bedType: string } | null>(null);

  const scale = BASE_SCALE * zoom;

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Convert screen coords to meters
  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / scale,
      y: (sy - pan.y) / scale,
    }),
    [pan, scale],
  );

  // Zoom with scroll
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const factor = 1.08;
      const newZoom = Math.max(0.2, Math.min(5, direction > 0 ? zoom * factor : zoom / factor));

      // Zoom towards pointer
      const mouseX = pointer.x;
      const mouseY = pointer.y;
      const newPanX = mouseX - ((mouseX - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);
      const newPanY = mouseY - ((mouseY - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan],
  );

  // Mouse down — start drawing or pan
  const handleMouseDown = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      // Right-click or middle-click → pan
      if (e.evt.button === 1 || e.evt.button === 2) {
        e.evt.preventDefault();
        return;
      }

      if (activeTool === 'rectangle') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        const newShape: LayoutShape = {
          id: generateId(),
          type: shapePreset,
          x: pos.x,
          y: pos.y,
          width: 0,
          depth: 0,
          rotation: 0,
          curve: null,
        };
        setDrawing({ startX: pos.x, startY: pos.y, current: newShape });
      } else if (activeTool === 'text') {
        const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
        const newLabel: LayoutLabel = {
          id: generateId(),
          text: '',
          x: pos.x,
          y: pos.y,
          rotation: 0,
          fontSize: 14,
        };
        setLabels((prev) => [...prev, newLabel]);
        setSelectedId(newLabel.id);
        setActiveTool('select');
      } else if (activeTool === 'select') {
        // Click on empty space deselects
        const target = e.target;
        if (target === stageRef.current || (target.getClassName?.() === 'Rect' && target.attrs.name === 'grid-bg')) {
          setSelectedId(null);
        }
      }
    },
    [activeTool, shapePreset, screenToMeters, setLabels, setSelectedId, setActiveTool],
  );

  const handleMouseMove = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (!drawing) return;
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const x = Math.min(drawing.startX, pos.x);
      const y = Math.min(drawing.startY, pos.y);
      const width = Math.abs(pos.x - drawing.startX);
      const depth = Math.abs(pos.y - drawing.startY);
      setDrawing((prev) =>
        prev ? { ...prev, current: { ...prev.current, x, y, width, depth } } : null,
      );
    },
    [drawing, screenToMeters],
  );

  const handleMouseUp = useCallback(() => {
    if (drawing && drawing.current.width > 0.05 && drawing.current.depth > 0.05) {
      setShapes((prev) => [...prev, drawing.current]);
      setSelectedId(drawing.current.id);
      setActiveTool('select');
    }
    setDrawing(null);
  }, [drawing, setShapes, setSelectedId, setActiveTool]);

  // Pan with middle mouse drag
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        setPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    };
    const onMove = (e: MouseEvent) => {
      if (panning) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    };
    const onUp = () => setPanning(false);

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning, pan]);

  // Delete selected with keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // Don't delete if an input is focused
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setBedPlacements((prev) => prev.filter((bp) => bp.id !== selectedId));
        setLabels((prev) => prev.filter((l) => l.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setActiveTool('select');
        setDrawing(null);
      }
      // Tool shortcuts (only when not in an input)
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') setActiveTool('rectangle');
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, setShapes, setBedPlacements, setLabels, setSelectedId, setActiveTool]);

  // Handle bed drop from palette (via custom event)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { bedId: string; bedType: string; x: number; y: number };
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      // Ignore drops outside the canvas bounds
      if (detail.x < rect.left || detail.x > rect.right || detail.y < rect.top || detail.y > rect.bottom) return;
      const pos = screenToMeters(detail.x - rect.left, detail.y - rect.top);

      const preset = BED_PRESETS.find((p) => p.type === detail.bedType);
      if (!preset) return;

      const placement: LayoutBedPlacement = {
        id: generateId(),
        bedId: detail.bedId,
        x: pos.x - preset.width / 2,
        y: pos.y - preset.length / 2,
        rotation: 0,
        splitKingPairId: null,
      };
      setBedPlacements((prev) => [...prev, placement]);
      setSelectedId(placement.id);
    };

    window.addEventListener('room-builder-drop-bed', handler);
    return () => window.removeEventListener('room-builder-drop-bed', handler);
  }, [screenToMeters, setBedPlacements, setSelectedId]);

  // Render grid
  const renderGrid = () => {
    const lines: React.ReactNode[] = [];
    const viewLeft = -pan.x / scale;
    const viewTop = -pan.y / scale;
    const viewRight = viewLeft + stageSize.width / scale;
    const viewBottom = viewTop + stageSize.height / scale;

    // Minor grid: 10cm for meters, 3 inches (0.0762m) for feet
    const minorStep = unit === 'meters' ? 0.1 : 0.0762;
    // Major grid: 1m or 1ft (0.3048m)
    const majorStep = unit === 'meters' ? 1.0 : 0.3048;

    // Only draw minor grid if zoomed in enough
    if (scale * minorStep > 4) {
      const startX = Math.floor(viewLeft / minorStep) * minorStep;
      const startY = Math.floor(viewTop / minorStep) * minorStep;
      for (let x = startX; x <= viewRight; x += minorStep) {
        lines.push(
          <Line
            key={`mv-${x.toFixed(4)}`}
            points={[x * scale + pan.x, 0, x * scale + pan.x, stageSize.height]}
            stroke={GRID_MINOR}
            strokeWidth={0.5}
            listening={false}
          />,
        );
      }
      for (let y = startY; y <= viewBottom; y += minorStep) {
        lines.push(
          <Line
            key={`mh-${y.toFixed(4)}`}
            points={[0, y * scale + pan.y, stageSize.width, y * scale + pan.y]}
            stroke={GRID_MINOR}
            strokeWidth={0.5}
            listening={false}
          />,
        );
      }
    }

    // Major grid
    const startMajX = Math.floor(viewLeft / majorStep) * majorStep;
    const startMajY = Math.floor(viewTop / majorStep) * majorStep;
    for (let x = startMajX; x <= viewRight; x += majorStep) {
      lines.push(
        <Line
          key={`Mv-${x.toFixed(4)}`}
          points={[x * scale + pan.x, 0, x * scale + pan.x, stageSize.height]}
          stroke={GRID_MAJOR}
          strokeWidth={1}
          listening={false}
        />,
      );
    }
    for (let y = startMajY; y <= viewBottom; y += majorStep) {
      lines.push(
        <Line
          key={`Mh-${y.toFixed(4)}`}
          points={[0, y * scale + pan.y, stageSize.width, y * scale + pan.y]}
          stroke={GRID_MAJOR}
          strokeWidth={1}
          listening={false}
        />,
      );
    }

    return lines;
  };

  // Shape drag handler
  const handleShapeDrag = (id: string, x: number, y: number) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, x, y } : s)));
  };

  // Shape resize handler
  const handleShapeResize = (id: string, updates: Partial<LayoutShape>) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Bed drag handler
  const handleBedDrag = (id: string, x: number, y: number) => {
    setBedPlacements((prev) => prev.map((bp) => (bp.id === id ? { ...bp, x, y } : bp)));
  };

  // Bed rotate handler
  const handleBedRotate = (id: string, rotation: number) => {
    setBedPlacements((prev) => prev.map((bp) => (bp.id === id ? { ...bp, rotation } : bp)));
  };

  // Format dimension for display
  const fmtDim = (meters: number) => {
    if (unit === 'feet') return `${(meters * M_TO_FT).toFixed(1)}ft`;
    return `${meters.toFixed(2)}m`;
  };

  // Cursor style
  const cursor =
    activeTool === 'rectangle' ? 'crosshair' :
    activeTool === 'text' ? 'text' :
    panning ? 'grabbing' : 'default';

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ cursor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Background + Grid */}
        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width} height={stageSize.height} fill="#ffffff" />
          {renderGrid()}
        </Layer>

        {/* Shapes layer */}
        <Layer>
          {shapes.map((shape) => (
            <Group key={shape.id}>
              <Rect
                x={shape.x * scale + pan.x}
                y={shape.y * scale + pan.y}
                width={shape.width * scale}
                height={shape.depth * scale}
                fill={SHAPE_FILLS[shape.type]}
                stroke={selectedId === shape.id ? '#3b82f6' : SHAPE_STROKES[shape.type]}
                strokeWidth={selectedId === shape.id ? 2 : 1}
                dash={shape.type === 'loft' ? [6, 4] : undefined}
                draggable={activeTool === 'select'}
                onClick={() => setSelectedId(shape.id)}
                onTap={() => setSelectedId(shape.id)}
                onDragEnd={(e) => {
                  const newX = (e.target.x() - pan.x) / scale;
                  const newY = (e.target.y() - pan.y) / scale;
                  handleShapeDrag(shape.id, newX, newY);
                  // Reset position since we store in state
                  e.target.x(newX * scale + pan.x);
                  e.target.y(newY * scale + pan.y);
                }}
              />
              {/* Shape type label */}
              <Text
                x={shape.x * scale + pan.x + 4}
                y={shape.y * scale + pan.y + 4}
                text={shape.type.charAt(0).toUpperCase() + shape.type.slice(1)}
                fontSize={10}
                fill="#a1a1aa"
                listening={false}
              />
              {/* Dimension label bottom-right */}
              <Text
                x={shape.x * scale + pan.x + shape.width * scale - 4}
                y={shape.y * scale + pan.y + shape.depth * scale - 16}
                text={`${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`}
                fontSize={10}
                fill="#71717a"
                align="right"
                width={100}
                offsetX={100}
                listening={false}
              />
              {/* Edge resize handles when selected */}
              {selectedId === shape.id && (
                <>
                  {/* Right edge */}
                  <Rect
                    x={shape.x * scale + pan.x + shape.width * scale - 3}
                    y={shape.y * scale + pan.y + shape.depth * scale * 0.25}
                    width={6}
                    height={shape.depth * scale * 0.5}
                    fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ew-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    dragBoundFunc={(pos) => ({ x: pos.x, y: shape.y * scale + pan.y + shape.depth * scale * 0.25 })}
                    onDragEnd={(e) => {
                      const newWidth = Math.max(0.1, (e.target.x() + 3 - pan.x) / scale - shape.x);
                      handleShapeResize(shape.id, { width: newWidth });
                      e.target.x(shape.x * scale + pan.x + newWidth * scale - 3);
                    }}
                  />
                  {/* Bottom edge */}
                  <Rect
                    x={shape.x * scale + pan.x + shape.width * scale * 0.25}
                    y={shape.y * scale + pan.y + shape.depth * scale - 3}
                    width={shape.width * scale * 0.5}
                    height={6}
                    fill="transparent"
                    onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'ns-resize'; }}
                    onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = cursor; }}
                    draggable
                    dragBoundFunc={(pos) => ({ x: shape.x * scale + pan.x + shape.width * scale * 0.25, y: pos.y })}
                    onDragEnd={(e) => {
                      const newDepth = Math.max(0.1, (e.target.y() + 3 - pan.y) / scale - shape.y);
                      handleShapeResize(shape.id, { depth: newDepth });
                      e.target.y(shape.y * scale + pan.y + newDepth * scale - 3);
                    }}
                  />
                </>
              )}
            </Group>
          ))}

          {/* Drawing preview */}
          {drawing && (
            <Group>
              <Rect
                x={drawing.current.x * scale + pan.x}
                y={drawing.current.y * scale + pan.y}
                width={drawing.current.width * scale}
                height={drawing.current.depth * scale}
                fill={SHAPE_FILLS[drawing.current.type]}
                stroke="#3b82f6"
                strokeWidth={2}
                dash={[6, 3]}
                listening={false}
              />
              <Text
                x={drawing.current.x * scale + pan.x + drawing.current.width * scale + 6}
                y={drawing.current.y * scale + pan.y + drawing.current.depth * scale - 14}
                text={`${fmtDim(drawing.current.width)} x ${fmtDim(drawing.current.depth)}`}
                fontSize={12}
                fill="#3b82f6"
                fontStyle="bold"
                listening={false}
              />
            </Group>
          )}
        </Layer>

        {/* Beds layer */}
        <Layer>
          {bedPlacements.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            if (!bed) return null;
            return (
              <BedShape
                key={bp.id}
                placement={bp}
                bed={bed}
                scale={scale}
                panX={pan.x}
                panY={pan.y}
                isSelected={selectedId === bp.id}
                onSelect={() => setSelectedId(bp.id)}
                onDragEnd={(x, y) => handleBedDrag(bp.id, x, y)}
                onRotate={(r) => handleBedRotate(bp.id, r)}
                draggable={activeTool === 'select'}
              />
            );
          })}
          <SplitKingConnectors
            placements={bedPlacements}
            beds={beds}
            scale={scale}
            panX={pan.x}
            panY={pan.y}
            onTogglePair={(idA, idB) => {
              setBedPlacements((prev) => {
                const a = prev.find((p) => p.id === idA);
                const b = prev.find((p) => p.id === idB);
                if (!a || !b) return prev;
                const isPaired = a.splitKingPairId === idB;
                if (isPaired) {
                  // Unpair
                  return prev.map((p) => {
                    if (p.id === idA) return { ...p, splitKingPairId: null };
                    if (p.id === idB) return { ...p, splitKingPairId: null };
                    return p;
                  });
                } else {
                  // Pair — snap beds together
                  const preset = BED_PRESETS.find((p) => p.type === 'single_long');
                  if (!preset) return prev;
                  const leftId = a.x <= b.x ? idA : idB;
                  const rightId = a.x <= b.x ? idB : idA;
                  const left = a.x <= b.x ? a : b;
                  return prev.map((p) => {
                    if (p.id === leftId) return { ...p, splitKingPairId: rightId };
                    if (p.id === rightId) return { ...p, splitKingPairId: leftId, x: left.x + preset.width, y: left.y };
                    return p;
                  });
                }
              });
            }}
          />
        </Layer>

        {/* Labels layer */}
        <Layer>
          {labels.map((label) => (
            <Text
              key={label.id}
              x={label.x * scale + pan.x}
              y={label.y * scale + pan.y}
              text={label.text || 'Add text...'}
              fontSize={label.fontSize}
              fill={label.text ? '#44403c' : '#d4d4d8'}
              fontStyle={label.text ? 'normal' : 'italic'}
              draggable={activeTool === 'select'}
              onClick={() => {
                setSelectedId(label.id);
                const newText = prompt('Enter label text:', label.text);
                if (newText !== null) {
                  setLabels((prev) => prev.map((l) => (l.id === label.id ? { ...l, text: newText } : l)));
                }
              }}
              onDragEnd={(e) => {
                const newX = (e.target.x() - pan.x) / scale;
                const newY = (e.target.y() - pan.y) / scale;
                setLabels((prev) => prev.map((l) => (l.id === label.id ? { ...l, x: newX, y: newY } : l)));
                e.target.x(newX * scale + pan.x);
                e.target.y(newY * scale + pan.y);
              }}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
