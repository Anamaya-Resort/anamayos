'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Group, Text, Line, Circle, Transformer, Shape } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { BedShape } from './bed-shape';
import { RoomShape } from './room-shape';
import { SplitKingConnectors } from './split-king-connector';
import { snapBedInsideWalls as snapBedFn } from './bed-snapping';
import { generateThumbnailDataUrl } from './thumbnail-generator';
import {
  BASE_SCALE, M_TO_FT, BED_PRESETS, FURNITURE_PRESETS,
  type LayoutShape, type LayoutBedPlacement, type LayoutLabel, type LayoutFurniture, type LayoutOpening, type LayoutArrow, type LayoutWall,
  type LayoutUnit, type LayoutShapeType, type ResortConfig,
} from './types';
import type { RoomBed, ActiveTool, ShapePreset, GeometryPreset, FurniturePresetType } from './room-builder-shell';

interface BuilderCanvasProps {
  shapes: LayoutShape[];
  setShapes: React.Dispatch<React.SetStateAction<LayoutShape[]>>;
  bedPlacements: LayoutBedPlacement[];
  setBedPlacements: React.Dispatch<React.SetStateAction<LayoutBedPlacement[]>>;
  labels: LayoutLabel[];
  setLabels: React.Dispatch<React.SetStateAction<LayoutLabel[]>>;
  furniture: LayoutFurniture[];
  setFurniture: React.Dispatch<React.SetStateAction<LayoutFurniture[]>>;
  openings: LayoutOpening[];
  setOpenings: React.Dispatch<React.SetStateAction<LayoutOpening[]>>;
  arrows: LayoutArrow[];
  setArrows: React.Dispatch<React.SetStateAction<LayoutArrow[]>>;
  walls: LayoutWall[];
  setWalls: React.Dispatch<React.SetStateAction<LayoutWall[]>>;
  beds: RoomBed[];
  setBeds: React.Dispatch<React.SetStateAction<RoomBed[]>>;
  roomId: string;
  unit: LayoutUnit;
  activeTool: ActiveTool;
  shapePreset: ShapePreset;
  geometryPreset: GeometryPreset;
  furniturePreset: FurniturePresetType;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  resortConfig: ResortConfig;
  thumbnail?: string | null;
  onThumbnailGenerated?: (dataUrl: string) => void;
}

import {
  parseWallCurve, traceShapePath, traceInnerPath, traceInnerPathStandalone,
} from './path-utils';
import { findNearestWall, projectOntoSegment, type WallSegment } from './wall-utils';
import {
  SELECT_COLOR, SELECT_BG, WARNING_COLOR, WARNING_BG, SUCCESS_COLOR,
  WALL_COLOR, WALL_THICKNESS_M,
  GRID_MAJOR, GRID_MINOR, DOOR_COLOR, WINDOW_COLOR,
  SHAPE_FILLS, SHAPE_STROKES, FURNITURE_FILL, FURNITURE_STROKE,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, TEXT_FAINT, TEXT_DIM, TEXT_EMPTY,
  BED_FILL, BED_STROKE, PILLOW_FILL, PILLOW_STROKE,
  CANVAS_BG,
} from './colors';

// Wall utilities imported from ./wall-utils.ts

function generateId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/** Measure text width using a hidden canvas */
const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function measureText(text: string, fontSize: number, fontFamily: string, fontStyle: string): number {
  if (!measureCanvas || !text) return 0;
  const weight = fontStyle.includes('bold') ? 'bold' : 'normal';
  const style = fontStyle.includes('italic') ? 'italic' : 'normal';
  measureCanvas.font = `${style} ${weight} ${fontSize}px ${fontFamily}`;
  return measureCanvas.measureText(text).width;
}

// Path tracing functions imported from ./path-utils.ts
// ── Main Canvas ──
export function BuilderCanvas({
  shapes, setShapes, bedPlacements, setBedPlacements, labels, setLabels,
  furniture, setFurniture, openings, setOpenings, arrows, setArrows, walls, setWalls, beds, setBeds, roomId, unit, activeTool,
  shapePreset, geometryPreset, furniturePreset, selectedId, setSelectedId, setActiveTool, resortConfig, thumbnail, onThumbnailGenerated,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; current: LayoutShape } | null>(null);
  // Unified inline text editor — one state for all text types
  // Also keep a ref so closures (onChange, commitTextEdit) always read the latest value
  const editingTextRef = useRef<typeof editingText>(null);
  const [editingText, setEditingText] = useState<{
    type: 'label' | 'bedName' | 'shapeTitle' | 'furnitureLabel';
    id: string;           // target entity ID
    text: string;         // current text value
    screenX: number;      // screen position
    screenY: number;
    width: number;        // input width in px
    fontSize: number;     // px
    fontFamily: string;
    fontStyle: string;    // 'normal' | 'bold' | 'italic' | 'bold italic'
    color: string;
    align: string;        // 'left' | 'center'
  } | null>(null);
  // Keep ref in sync
  const setEditingTextAndRef = useCallback((val: typeof editingText | ((prev: typeof editingText) => typeof editingText)) => {
    setEditingText((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      editingTextRef.current = next;
      return next;
    });
  }, []);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState(CANVAS_BG);
  const [showTitles, setShowTitles] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [resizingFurnitureId, setResizingFurnitureId] = useState<string | null>(null);
  const [drawingOpening, setDrawingOpening] = useState<{ type: 'door' | 'window'; seg: WallSegment; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawingWall, setDrawingWall] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [furnitureSizeModal, setFurnitureSizeModal] = useState<{ id: string; width: string; depth: string; color: string; shape: string; label: string; labelRotation: number } | null>(null);
  const [labelEditModal, setLabelEditModal] = useState<{ id: string; text: string; fontSize: string; rotation: number } | null>(null);
  const furnitureTransformerRef = useRef<Konva.Transformer>(null);
  const furnitureNodeRef = useRef<Konva.Rect | Konva.Circle | null>(null);

  // Attach furniture Transformer when resizing
  useEffect(() => {
    if (resizingFurnitureId && furnitureTransformerRef.current && furnitureNodeRef.current) {
      furnitureTransformerRef.current.nodes([furnitureNodeRef.current]);
      furnitureTransformerRef.current.getLayer()?.batchDraw();
    }
  }, [resizingFurnitureId, furniture]);

  const scale = BASE_SCALE * zoom;

  // Load Google Fonts dynamically when resortConfig fonts change
  const SYSTEM_FONTS = new Set(['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana']);
  useEffect(() => {
    const fonts = new Set([resortConfig.title.fontFamily, resortConfig.info.fontFamily, resortConfig.furniture.fontFamily]);
    const googleFonts = [...fonts].filter((f) => !SYSTEM_FONTS.has(f));
    if (googleFonts.length === 0) return;
    const linkId = 'room-builder-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?${googleFonts.map((f) => `family=${f.replace(/ /g, '+')}`).join('&')}&display=swap`;
  }, [resortConfig.title.fontFamily, resortConfig.info.fontFamily, resortConfig.furniture.fontFamily]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver((entries) => setStageSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }));
    obs.observe(el); return () => obs.disconnect();
  }, []);

  // Auto-fit: compute bounding box of all content and set zoom/pan to fit 95% of stage
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (hasAutoFit.current) return;
    if (stageSize.width <= 100 || stageSize.height <= 100) return; // wait for real size
    const allItems: { x: number; y: number; w: number; h: number }[] = [];
    for (const s of shapes) allItems.push({ x: s.x, y: s.y, w: s.width, h: s.depth });
    for (const bp of bedPlacements) {
      const bed = beds.find((b) => b.id === bp.bedId);
      const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
      if (preset) allItems.push({ x: bp.x, y: bp.y, w: preset.width, h: preset.length });
    }
    for (const f of furniture) allItems.push({ x: f.x, y: f.y, w: f.width, h: f.depth });
    for (const l of labels) allItems.push({ x: l.x, y: l.y, w: l.fontSize * 5, h: l.fontSize * 1.5 });
    if (allItems.length === 0) { hasAutoFit.current = true; return; }
    // Add padding for dimension labels, wall thickness, handles, etc.
    const PAD = 0.5; // meters padding on each side
    const minX = Math.min(...allItems.map((i) => i.x)) - PAD;
    const minY = Math.min(...allItems.map((i) => i.y)) - PAD;
    const maxX = Math.max(...allItems.map((i) => i.x + i.w)) + PAD;
    const maxY = Math.max(...allItems.map((i) => i.y + i.h)) + PAD;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) { hasAutoFit.current = true; return; }
    const fitZoomX = stageSize.width / (contentW * BASE_SCALE);
    const fitZoomY = stageSize.height / (contentH * BASE_SCALE);
    const fitZoom = Math.min(fitZoomX, fitZoomY, 3); // cap at 3x
    const fitScale = BASE_SCALE * fitZoom;
    const panX = (stageSize.width - contentW * fitScale) / 2 - minX * fitScale;
    const panY = (stageSize.height - contentH * fitScale) / 2 - minY * fitScale;
    setZoom(fitZoom);
    setPan({ x: panX, y: panY });
    hasAutoFit.current = true;
  }, [stageSize, shapes, bedPlacements, beds, furniture, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  const screenToMeters = useCallback(
    (sx: number, sy: number) => ({ x: (sx - pan.x) / scale, y: (sy - pan.y) / scale }),
    [pan, scale],
  );

  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (editingText) { commitTextEdit(); return; } // close editor on zoom
    const pointer = stageRef.current?.getPointerPosition(); if (!pointer) return;
    const dir = e.evt.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(0.2, Math.min(5, dir > 0 ? zoom * 1.08 : zoom / 1.08));
    setPan({ x: pointer.x - ((pointer.x - pan.x) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom), y: pointer.y - ((pointer.y - pan.y) / (BASE_SCALE * zoom)) * (BASE_SCALE * newZoom) });
    setZoom(newZoom);
  }, [zoom, pan, editingText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) { e.evt.preventDefault(); return; }
    if (e.evt.button === 1) { e.evt.preventDefault(); return; }
    // Commit any active text edit on any click
    if (editingTextRef.current) commitTextEdit();
    if (activeTool === 'rectangle') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawing({ startX: pos.x, startY: pos.y, current: { id: generateId(), type: shapePreset, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null, geometry: geometryPreset !== 'rectangle' ? geometryPreset : undefined } });
    } else if (activeTool === 'text') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const rc = resortConfig.info;
      const lbl: LayoutLabel = { id: generateId(), text: '', x: pos.x, y: pos.y, rotation: 0, fontSize: rc.fontSize };
      setLabels((p) => [...p, lbl]); setSelectedId(lbl.id); setActiveTool('select');
      const stage = stageRef.current;
      const container = stage?.container().getBoundingClientRect();
      setEditingTextAndRef({ type: 'label', id: lbl.id, text: '', screenX: e.evt.offsetX + (container?.left ?? 0), screenY: e.evt.offsetY + (container?.top ?? 0), width: Math.max(80, rc.fontSize * scale * 8), fontSize: rc.fontSize * scale, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color, align: 'left' });
    } else if (activeTool === 'furniture') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const fp = FURNITURE_PRESETS.find((p) => p.type === furniturePreset);
      if (fp) {
        setDrawing({ startX: pos.x, startY: pos.y, current: { id: generateId(), type: 'room' as LayoutShapeType, x: pos.x, y: pos.y, width: 0, depth: 0, rotation: 0, curve: null, _furnitureType: furniturePreset } as LayoutShape & { _furnitureType: string } });
      }
    } else if (activeTool === 'arrow') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      setDrawingArrow({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    } else if (activeTool === 'wall') {
      let pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      // Snap to nearby existing wall endpoint (within 15 pixels)
      const snapDist = 15 / scale;
      const nearest = findNearestWall(pos.x, pos.y, shapes, snapDist);
      if (nearest) { pos = { x: nearest.proj.x, y: nearest.proj.y }; }
      // Also check standalone wall endpoints
      for (const w of walls) {
        for (const pt of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
          const d = Math.sqrt((pos.x - pt.x) ** 2 + (pos.y - pt.y) ** 2);
          if (d < snapDist) { pos = pt; break; }
        }
      }
      setDrawingWall({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    } else if (activeTool === 'door' || activeTool === 'window') {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      const maxDistMeters = 10 / scale; // 10 pixels in meters
      const nearest = findNearestWall(pos.x, pos.y, shapes, maxDistMeters);
      if (nearest) {
        setDrawingOpening({ type: activeTool, seg: nearest.seg, x1: nearest.proj.x, y1: nearest.proj.y, x2: nearest.proj.x, y2: nearest.proj.y });
      }
    } else if (activeTool === 'select') {
      const t = e.target;
      const clickedEmpty = t === stageRef.current || (t.getClassName?.() === 'Rect' && t.attrs.name === 'grid-bg');
      if (clickedEmpty) {
        setSelectedId(null);
        setResizingFurnitureId(null);
        setPanning(true);
        panStart.current = { x: e.evt.clientX - pan.x, y: e.evt.clientY - pan.y };
      }
    }
  }, [activeTool, shapePreset, geometryPreset, furniturePreset, shapes, walls, scale, screenToMeters, setLabels, setSelectedId, setActiveTool, pan]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (drawingArrow) {
      let pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      // Shift held: snap to 15° angles
      if (e.evt.shiftKey) {
        const dx = pos.x - drawingArrow.x1, dy = pos.y - drawingArrow.y1;
        const angle = Math.atan2(dy, dx);
        const snapAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12); // 15° increments
        const len = Math.sqrt(dx * dx + dy * dy);
        pos = { x: drawingArrow.x1 + len * Math.cos(snapAngle), y: drawingArrow.y1 + len * Math.sin(snapAngle) };
      }
      setDrawingArrow((p) => p ? { ...p, x2: pos.x, y2: pos.y } : null);
      return;
    }
    if (drawingWall) {
      let pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      if (e.evt.shiftKey) {
        const dx = pos.x - drawingWall.x1, dy = pos.y - drawingWall.y1;
        const angle = Math.atan2(dy, dx);
        const snapAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
        const len = Math.sqrt(dx * dx + dy * dy);
        pos = { x: drawingWall.x1 + len * Math.cos(snapAngle), y: drawingWall.y1 + len * Math.sin(snapAngle) };
      }
      setDrawingWall((p) => p ? { ...p, x2: pos.x, y2: pos.y } : null);
      return;
    }
    if (drawingOpening) {
      const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
      // Project mouse onto the wall segment (constrain to 1D along wall)
      const proj = projectOntoSegment(pos.x, pos.y, drawingOpening.seg);
      setDrawingOpening((p) => p ? { ...p, x2: proj.x, y2: proj.y } : null);
      return;
    }
    if (!drawing) return;
    const pos = screenToMeters(e.evt.offsetX, e.evt.offsetY);
    const geo = drawing.current.geometry;
    let w = Math.abs(pos.x - drawing.startX);
    let d = Math.abs(pos.y - drawing.startY);
    // Circles: enforce square bounding box (diameter = max of w, d)
    if (geo === 'circle') {
      const diameter = Math.max(w, d);
      w = diameter;
      d = diameter;
    }
    setDrawing((p) => p ? { ...p, current: { ...p.current, x: Math.min(p.startX, pos.x), y: Math.min(p.startY, pos.y), width: w, depth: d } } : null);
  }, [drawing, drawingArrow, drawingWall, drawingOpening, screenToMeters]);

  const handleMouseUp = useCallback(() => {
    // Opening finalization handled by window-level mouseup listener
    if (drawingOpening) return;
    if (drawing && drawing.current.width > 0.05 && drawing.current.depth > 0.05) {
      const ft = (drawing.current as LayoutShape & { _furnitureType?: string })._furnitureType;
      if (ft) {
        // Drawing was for furniture
        const fp = FURNITURE_PRESETS.find((p) => p.type === ft);
        const item: LayoutFurniture = {
          id: drawing.current.id, type: ft, shape: fp?.shape ?? 'rectangle',
          label: (ft === 'nightstand' || fp?.shape === 'semicircle') ? '' : (fp?.label ?? ft),
          x: drawing.current.x, y: drawing.current.y, width: drawing.current.width, depth: drawing.current.depth, rotation: 0,
        };
        setFurniture((p) => [...p, item]); setSelectedId(item.id); setActiveTool('select');
      } else {
        setShapes((p) => [...p, drawing.current]); setSelectedId(drawing.current.id); setActiveTool('select');
      }
    }
    setDrawing(null);
  }, [drawing, drawingOpening, setShapes, setFurniture, setOpenings, setSelectedId, setActiveTool]);

  // Window-level mouseup for arrow drawing
  useEffect(() => {
    if (!drawingArrow) return;
    const onUp = () => {
      const { x1, y1, x2, y2 } = drawingArrow;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len > 0.05) {
        setArrows((p) => [...p, { id: generateId(), x1, y1, x2, y2 }]);
      }
      setDrawingArrow(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drawingArrow, setArrows]);

  // Window-level mouseup for wall drawing
  useEffect(() => {
    if (!drawingWall) return;
    const onUp = () => {
      const { x1, y1, x2, y2 } = drawingWall;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len > 0.05) {
        setWalls((p) => [...p, { id: generateId(), x1, y1, x2, y2, thickness: WALL_THICKNESS_M }]);
      }
      setDrawingWall(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drawingWall, setWalls]);

  // Window-level mouseup for opening drawing
  useEffect(() => {
    if (!drawingOpening) return;
    const onUp = () => {
      const { type, x1, y1, x2, y2 } = drawingOpening;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      if (len > 0.05) {
        const { seg } = drawingOpening;
        const opening: LayoutOpening = { id: generateId(), type, x1, y1, x2, y2, wallX1: seg.x1, wallY1: seg.y1, wallX2: seg.x2, wallY2: seg.y2 };
        setOpenings((p) => [...p, opening]);
      }
      setDrawingOpening(null);
      // Stay on the same tool so user can draw another
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drawingOpening, setOpenings]);

  // Pan
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onDown = (e: MouseEvent) => { if (e.button === 1) { e.preventDefault(); setPanning(true); panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; } }; // middle-click pan (left-click pan handled in handleMouseDown)
    const onMove = (e: MouseEvent) => { if (panning) setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }); };
    const onUp = () => setPanning(false);
    el.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [panning, pan]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setShapes((p) => p.filter((s) => s.id !== selectedId));
        setBedPlacements((p) => p.filter((bp) => bp.id !== selectedId));
        setLabels((p) => p.filter((l) => l.id !== selectedId));
        setFurniture((p) => p.filter((f) => f.id !== selectedId));
        setOpenings((p) => p.filter((o) => o.id !== selectedId));
        setArrows((p) => p.filter((a) => a.id !== selectedId));
        setWalls((p) => p.filter((w) => w.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === 'Escape') { setSelectedId(null); setResizingFurnitureId(null); setActiveTool('select'); setDrawing(null); setDrawingOpening(null); setDrawingArrow(null); setDrawingWall(null); }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'r' || e.key === 'R') {
        // If a furniture item is selected, rotate it 15° clockwise (not planter/circle)
        const selFurniture = selectedId ? furniture.find((f) => f.id === selectedId) : null;
        if (selFurniture && selFurniture.shape !== 'circle') {
          setFurniture((p) => p.map((f) => f.id === selectedId ? { ...f, rotation: (f.rotation + 15) % 360 } : f));
        } else {
          setActiveTool('rectangle');
        }
      }
      if (e.key === 't' || e.key === 'T') setActiveTool('text');
      if (e.key === 'f' || e.key === 'F') setActiveTool('furniture');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, furniture, setShapes, setBedPlacements, setLabels, setFurniture, setOpenings, setArrows, setWalls, setSelectedId, setActiveTool]);

  // Bed snap
  const snapBedInsideWalls = useCallback(
    (bedX: number, bedY: number, bedW: number, bedH: number) => snapBedFn(shapes, bedX, bedY, bedW, bedH),
    [shapes],
  );

  // Track drag offset for split king circle/text visual sync
  const [bedDragOffset, setBedDragOffset] = useState<{ placementId: string; dx: number; dy: number } | null>(null);

  const handleBedDragMove = useCallback((e: KonvaEventObject<DragEvent>, bedId: string, placementId: string) => {
    const bed = beds.find((b) => b.id === bedId);
    const preset = bed ? BED_PRESETS.find((p) => p.type === bed.bedType) : null;
    if (!preset) return;
    // Account for rotation: at 90° or 270°, width and length swap
    const bp = bedPlacements.find((p) => p.id === placementId);
    const rot = ((bp?.rotation ?? 0) % 360 + 360) % 360;
    const isRotated = (rot > 45 && rot < 135) || (rot > 225 && rot < 315);
    const bedW = isRotated ? preset.length : preset.width;
    const bedH = isRotated ? preset.width : preset.length;
    const bw = bedW * scale, bh = bedH * scale;
    const topLeftX = (e.target.x() - bw / 2 - pan.x) / scale;
    const topLeftY = (e.target.y() - bh / 2 - pan.y) / scale;
    const snapped = snapBedInsideWalls(topLeftX, topLeftY, bedW, bedH);
    e.target.x(snapped.x * scale + pan.x + bw / 2);
    e.target.y(snapped.y * scale + pan.y + bh / 2);

    // Move paired bed + track offset for circle/text
    if (bp?.splitKingPairId) {
      const partner = bedPlacements.find((p) => p.id === bp.splitKingPairId);
      if (partner) {
        const rad = (bp.rotation * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        // Determine if dragged bed was to the left or right of partner
        // by checking original positions along the width axis
        const projDragged = bp.x * cos + bp.y * sin;
        const projPartner = partner.x * cos + partner.y * sin;
        const dir = projDragged < projPartner ? 1 : -1; // 1 = partner is to the right, -1 = partner is to the left
        const partnerX = snapped.x + dir * preset.width * cos;
        const partnerY = snapped.y + dir * preset.width * sin;
        const stage = stageRef.current;
        const bedsLayer = stage?.children?.[2];
        if (bedsLayer) {
          for (const node of bedsLayer.children ?? []) {
            if (node.attrs?.['data-placement-id'] === bp.splitKingPairId) {
              node.x(partnerX * scale + pan.x + bw / 2);
              node.y(partnerY * scale + pan.y + bh / 2);
              break;
            }
          }
          bedsLayer.batchDraw();
        }
      }
      // Track offset so circle/text can follow
      setBedDragOffset({ placementId, dx: (snapped.x - bp.x) * scale, dy: (snapped.y - bp.y) * scale });
    } else {
      setBedDragOffset(null);
    }
  }, [beds, bedPlacements, pan, scale, snapBedInsideWalls]);

  // Bed drop from palette
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { bedId: string; bedType: string; x: number; y: number };
      const stage = stageRef.current; if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      if (d.x < rect.left || d.x > rect.right || d.y < rect.top || d.y > rect.bottom) return;
      const pos = screenToMeters(d.x - rect.left, d.y - rect.top);
      const preset = BED_PRESETS.find((p) => p.type === d.bedType); if (!preset) return;
      const snapped = snapBedInsideWalls(pos.x - preset.width / 2, pos.y - preset.length / 2, preset.width, preset.length);
      setBedPlacements((p) => [...p, { id: generateId(), bedId: d.bedId, x: snapped.x, y: snapped.y, rotation: 0, splitKingPairId: null }]);
    };
    window.addEventListener('room-builder-drop-bed', handler);
    return () => window.removeEventListener('room-builder-drop-bed', handler);
  }, [screenToMeters, setBedPlacements, snapBedInsideWalls]);

  const handleBedDragEnd = (id: string, x: number, y: number) => {
    setBedDragOffset(null);
    setBedPlacements((prev) => {
      const bp = prev.find((p) => p.id === id); if (!bp) return prev;
      // Position already snapped by handleBedDragMove — use as-is
      const finalDx = x - bp.x, finalDy = y - bp.y;
      const partnerId = bp.splitKingPairId;
      return prev.map((p) => {
        if (p.id === id) return { ...p, x, y };
        if (partnerId && p.id === partnerId) return { ...p, x: p.x + finalDx, y: p.y + finalDy };
        return p;
      });
    });
  };

  // Rename a bed (update state + DB)
  // Bed rename — local state only, persisted on Save
  const handleBedRename = (bedId: string, newLabel: string) => {
    setBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, label: newLabel } : b)));
  };

  // Commit text edit — final trim + close editor
  // Commit reads from ref (never stale) — trims and closes editor
  const commitTextEdit = () => {
    const et = editingTextRef.current;
    if (!et) return;
    const { type, id, text } = et;
    const trimmed = text.trim();
    if (type === 'label') setLabels((p) => p.map((l) => l.id === id ? { ...l, text: trimmed } : l));
    if (type === 'bedName') setBeds((p) => p.map((b) => b.id === id ? { ...b, label: trimmed || b.label } : b));
    if (type === 'shapeTitle') setShapes((p) => p.map((s) => s.id === id ? { ...s, titleText: trimmed } : s));
    if (type === 'furnitureLabel') setFurniture((p) => p.map((f) => f.id === id ? { ...f, label: trimmed || f.label } : f));
    setEditingTextAndRef(null);
  };

  // Open the unified inline editor at the exact visual position of the Konva text
  const startEditing = (type: NonNullable<typeof editingText>['type'], id: string, text: string, target: unknown, widthPx: number, style: { fontSize: number; fontFamily: string; fontStyle: string; color: string; align?: string }) => {
    const node = target as Konva.Text;
    const stage = node.getStage();
    if (!stage) return;
    const containerRect = stage.container().getBoundingClientRect();
    // getClientRect gives the actual visual bounding box on the canvas
    const textRect = node.getClientRect({ relativeTo: stage });
    // Use the visual rect position, not getAbsolutePosition (which ignores offset)
    const inputWidth = Math.max(widthPx, textRect.width + 40, 120);
    setEditingTextAndRef({
      type, id, text,
      screenX: textRect.x + containerRect.left,
      screenY: textRect.y + containerRect.top,
      width: inputWidth,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      color: style.color,
      align: style.align ?? 'left',
    });
  };

  // Thumbnail generation — delegated to thumbnail-generator.ts
  const generateThumbnail = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !onThumbnailGenerated) return;
    const dataUrl = generateThumbnailDataUrl({ stage, shapes, bedPlacements, beds, furniture, walls, zoom, pan });
    if (dataUrl) onThumbnailGenerated(dataUrl);
  }, [shapes, bedPlacements, beds, furniture, walls, zoom, pan, onThumbnailGenerated]);

  // Listen for thumbnail generation request from shell
  useEffect(() => {
    const handler = () => generateThumbnail();
    window.addEventListener('room-builder-generate-thumb', handler);
    return () => window.removeEventListener('room-builder-generate-thumb', handler);
  }, [generateThumbnail]);

  const fmtDim = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(1)}ft` : `${m.toFixed(2)}m`;
  const cursor = activeTool === 'rectangle' || activeTool === 'furniture' || activeTool === 'door' || activeTool === 'window' || activeTool === 'arrow' || activeTool === 'wall' ? 'crosshair' : activeTool === 'text' ? 'text' : panning ? 'grabbing' : 'default';

  return (
    <div ref={containerRef} className="h-full w-full relative" style={{ cursor }} onContextMenu={(e) => e.preventDefault()}>
      <Stage ref={stageRef} width={stageSize.width || 1} height={stageSize.height || 1}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>

        <Layer listening={false}>
          <Rect name="grid-bg" x={0} y={0} width={stageSize.width || 1} height={stageSize.height || 1} fill={bgColor} />
        </Layer>

        {/* Shapes + Transformer */}
        <Layer>
          {shapes.map((shape) => (
            <RoomShape key={shape.id} shape={shape} scale={scale} panX={pan.x} panY={pan.y} unit={unit}
              isSelected={selectedId === shape.id}
              isHovered={hoveredShapeId === shape.id}
              onSelect={() => { setSelectedId(shape.id); setResizingFurnitureId(null); }}
              onShapeChange={(u) => setShapes((p) => p.map((s) => (s.id === shape.id ? { ...s, ...u } : s)))}
              onMouseEnter={() => setHoveredShapeId(shape.id)}
              onMouseLeave={() => setHoveredShapeId((p) => p === shape.id ? null : p)}
              beds={beds} bedPlacements={bedPlacements} setBedPlacements={setBedPlacements}
              activeTool={activeTool}
              wallColor={resortConfig.wallColor}
            />
          ))}
          {drawing && (() => {
            const dx = drawing.current.x * scale + pan.x, dy = drawing.current.y * scale + pan.y;
            const dw = drawing.current.width * scale, dh = drawing.current.depth * scale;
            const ft = (drawing.current as LayoutShape & { _furnitureType?: string })._furnitureType;
            const fp = ft ? FURNITURE_PRESETS.find((p) => p.type === ft) : null;
            const drawShape = fp?.shape;
            const fillColor = ft ? '#f0ebe4' : (SHAPE_FILLS[drawing.current.type] ?? '#f5f5f4');
            const geo = drawing.current.geometry;
            // Determine the visual shape: furniture shapes or room geometry
            const vizShape = drawShape ?? geo;
            return (
              <Group>
                {vizShape === 'circle' ? (
                  <Circle x={dx + dw / 2} y={dy + dh / 2} radius={Math.min(dw, dh) / 2}
                    fill={fillColor} stroke={SELECT_COLOR} strokeWidth={2} dash={[6, 3]} listening={false} />
                ) : vizShape === 'semicircle' ? (
                  <Shape sceneFunc={(ctx, s) => { ctx.beginPath(); const cx = dw / 2; const r = Math.min(dw / 2, dh); ctx.moveTo(cx + r, dh); ctx.arc(cx, dh, r, 0, Math.PI); ctx.closePath(); ctx.fillStrokeShape(s); }}
                    x={dx} y={dy} fill={fillColor} stroke={SELECT_COLOR} strokeWidth={2} dash={[6, 3]} listening={false} />
                ) : (
                  <Rect x={dx} y={dy} width={dw} height={dh}
                    fill={fillColor} stroke={SELECT_COLOR} strokeWidth={2} dash={[6, 3]} listening={false} />
                )}
                <Text x={dx + dw + 6} y={dy + dh - 14}
                  text={`${fmtDim(drawing.current.width)} x ${fmtDim(drawing.current.depth)}`}
                  fontSize={12} fill={SELECT_COLOR} fontStyle="bold" listening={false} />
              </Group>
            );
          })()}
        </Layer>

        {/* Beds */}
        <Layer>
          {bedPlacements.map((bp) => {
            const bed = beds.find((b) => b.id === bp.bedId);
            if (!bed) return null;
            return (
              <BedShape key={bp.id} placement={bp} bed={bed} scale={scale} panX={pan.x} panY={pan.y}
                isSelected={selectedId === bp.id}
                onSelect={() => { setSelectedId(bp.id); setResizingFurnitureId(null); }}
                onDragMove={(e) => handleBedDragMove(e, bp.bedId, bp.id)}
                onDragEnd={(x, y) => handleBedDragEnd(bp.id, x, y)}
                onRotate={(r) => setBedPlacements((p) => p.map((b) => (b.id === bp.id ? { ...b, rotation: r } : b)))}
                onStartRename={(sx, sy, w) => {
                  const bedFontSize = Math.max(9, Math.min(12, w * 0.12));
                  setEditingTextAndRef({ type: 'bedName', id: bp.bedId, text: bed.label, screenX: sx, screenY: sy, width: w, fontSize: bedFontSize, fontFamily: resortConfig.title.fontFamily, fontStyle: 'normal', color: TEXT_SECONDARY, align: 'center' });
                }}
                fontFamily={resortConfig.title.fontFamily}
                draggable={activeTool === 'select'}
                placementId={bp.id}
              />
            );
          })}
          <SplitKingConnectors placements={bedPlacements} beds={beds} scale={scale} panX={pan.x} panY={pan.y} bgColor={bgColor} dragOffset={bedDragOffset}
            onTogglePair={(idA, idB) => {
              setBedPlacements((prev) => {
                const a = prev.find((p) => p.id === idA), b = prev.find((p) => p.id === idB);
                if (!a || !b) return prev;
                const aBed = beds.find((bd) => bd.id === a.bedId);
                const aPreset = aBed ? BED_PRESETS.find((p) => p.type === aBed.bedType) : null;
                if (!aPreset) return prev;
                const rad = (a.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);

                if (a.splitKingPairId === idB) {
                  // UNPAIR — separate beds by 0.3m (circle width) along width direction
                  const sepDist = 0.3;
                  return prev.map((p) => {
                    if (p.id === idA) return { ...p, splitKingPairId: null, x: p.x - sepDist / 2 * cos, y: p.y - sepDist / 2 * sin };
                    if (p.id === idB) return { ...p, splitKingPairId: null, x: p.x + sepDist / 2 * cos, y: p.y + sepDist / 2 * sin };
                    return p;
                  });
                }

                // PAIR — snap side-by-side
                const dx = b.x - a.x, dy = b.y - a.y;
                const projWidth = dx * cos + dy * sin;
                const firstId = projWidth >= 0 ? idA : idB;
                const secondId = projWidth >= 0 ? idB : idA;
                const first = projWidth >= 0 ? a : b;
                const snapX = first.x + aPreset.width * cos;
                const snapY = first.y + aPreset.width * sin;
                return prev.map((p) => {
                  if (p.id === firstId) return { ...p, splitKingPairId: secondId };
                  if (p.id === secondId) return { ...p, splitKingPairId: firstId, x: snapX, y: snapY, rotation: first.rotation };
                  return p;
                });
              });
            }}
          />
        </Layer>

        {/* Furniture */}
        <Layer>
          {furniture.map((item) => {
            const fw = item.width * scale, fd = item.depth * scale;
            const fx = item.x * scale + pan.x, fy = item.y * scale + pan.y;
            const isSel = selectedId === item.id;
            const rc = resortConfig.furniture;
            const isCircle = item.shape === 'circle';
            const isSemiCircle = item.shape === 'semicircle';
            return (
              <Group key={item.id} x={fx} y={fy} rotation={item.rotation}
                draggable={activeTool === 'select'}
                onClick={(e) => { e.cancelBubble = true; setSelectedId(item.id); if (resizingFurnitureId !== item.id) setResizingFurnitureId(null); }}
                onDblClick={(e) => { e.cancelBubble = true;
                  // Toggle resize mode with Transformer
                  setResizingFurnitureId(resizingFurnitureId === item.id ? null : item.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  const wVal = unit === 'feet' ? (item.width * M_TO_FT).toFixed(1) : item.width.toFixed(2);
                  const dVal = unit === 'feet' ? (item.depth * M_TO_FT).toFixed(1) : item.depth.toFixed(2);
                  setFurnitureSizeModal({ id: item.id, width: wVal, depth: dVal, color: item.color ?? '#f0ebe4', shape: item.shape ?? 'rectangle', label: item.label, labelRotation: item.labelRotation ?? 0 });
                }}
                onDragEnd={(e) => {
                  const nx = (e.target.x() - pan.x) / scale, ny = (e.target.y() - pan.y) / scale;
                  const itemId = item.id;
                  setFurniture((p) => p.map((f) => {
                    if (f.id !== itemId) return f;
                    // Semicircles and circles: no wall snap (decorative, can go anywhere)
                    if (f.shape === 'semicircle' || f.shape === 'circle') return { ...f, x: nx, y: ny };
                    const snapped = snapBedInsideWalls(nx, ny, f.width, f.depth);
                    return { ...f, x: snapped.x, y: snapped.y };
                  }));
                }}
              >
                {isCircle ? (
                  <Circle x={fw / 2} y={fd / 2} radius={Math.min(fw, fd) / 2}
                    ref={resizingFurnitureId === item.id ? furnitureNodeRef as React.RefObject<Konva.Circle> : undefined}
                    fill={item.color ?? FURNITURE_FILL} stroke={resizingFurnitureId === item.id ? SELECT_COLOR : (isSel ? SELECT_COLOR : FURNITURE_STROKE)}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)} />
                ) : isSemiCircle ? (
                  <Shape
                    sceneFunc={(ctx, shape) => {
                      const r = Math.min(fw, fd) / 2;
                      ctx.beginPath();
                      ctx.arc(fw / 2, fd / 2, r, Math.PI, 0);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    hitFunc={(ctx, shape) => {
                      const r = Math.min(fw, fd) / 2;
                      ctx.beginPath();
                      ctx.arc(fw / 2, fd / 2, r, Math.PI, 0);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                    fill={item.color ?? FURNITURE_FILL}
                    stroke={resizingFurnitureId === item.id ? SELECT_COLOR : (isSel ? SELECT_COLOR : FURNITURE_STROKE)}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)}
                  />
                ) : (
                  <Rect x={0} y={0} width={fw} height={fd}
                    ref={resizingFurnitureId === item.id ? furnitureNodeRef as React.RefObject<Konva.Rect> : undefined}
                    fill={item.color ?? FURNITURE_FILL} stroke={resizingFurnitureId === item.id ? SELECT_COLOR : (isSel ? SELECT_COLOR : FURNITURE_STROKE)}
                    strokeWidth={resizingFurnitureId === item.id ? 2 : (isSel ? 1.5 : 0.5)} cornerRadius={2} />
                )}
                {/* Text along longest dimension, with optional manual label rotation */}
                {(() => {
                  const textAlongLong = item.depth > item.width && !isCircle;
                  const localRot = textAlongLong ? -90 : 0;
                  const totalAngle = ((item.rotation ?? 0) + localRot + 360) % 360;
                  const flip = totalAngle > 90 && totalAngle < 270 ? 180 : 0;
                  const textRot = localRot + flip + (item.labelRotation ?? 0);
                  const textW = textAlongLong ? fd : fw;
                  const noText = !item.label;
                  const isVis = !noText && !(editingText?.type === 'furnitureLabel' && editingText.id === item.id) && Math.max(fw, fd) > 35 && Math.min(fw, fd) > 12;
                  // For semicircles, position text at visual centroid (42% of radius above flat edge)
                  const textY = isSemiCircle
                    ? fd / 2 - Math.min(fw, fd) / 2 * 0.42
                    : fd / 2;
                  return (
                    <Text
                      x={fw / 2} y={textY}
                      offsetX={textW / 2} offsetY={(rc.fontSize * scale) / 2}
                      rotation={textRot}
                      width={textW} text={item.label}
                      fontSize={rc.fontSize * scale} fontFamily={rc.fontFamily}
                      fontStyle={rc.fontStyle} fill={rc.color} align="center"
                      visible={isVis}
                      onDblClick={(e) => {
                        e.cancelBubble = true;
                        startEditing('furnitureLabel', item.id, item.label, e.target as unknown as Parameters<typeof startEditing>[3], textW,
                          { fontSize: rc.fontSize * scale, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color, align: 'center' });
                      }}
                    />
                  );
                })()}
              </Group>
            );
          })}
          {/* Transformer for furniture resize */}
          {resizingFurnitureId && (
            <Transformer
              ref={furnitureTransformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              keepRatio={false}
              borderStroke={SELECT_COLOR}
              borderStrokeWidth={1}
              anchorFill={SELECT_COLOR}
              anchorStroke={CANVAS_BG}
              anchorSize={6}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
              boundBoxFunc={(_old, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) ? _old : newBox}
              onTransformEnd={() => {
                const node = furnitureNodeRef.current;
                if (!node) return;
                const scX = node.scaleX(), scY = node.scaleY();
                node.scaleX(1); node.scaleY(1);
                const item = furniture.find((f) => f.id === resizingFurnitureId);
                if (item) {
                  const newW = Math.max(0.05, item.width * scX);
                  const newD = Math.max(0.05, item.depth * scY);
                  // Capture position shift from transform (corner/edge resize moves the node)
                  const parent = node.getParent();
                  const groupX = parent ? parent.x() : 0;
                  const groupY = parent ? parent.y() : 0;
                  const newX = (groupX + node.x() - pan.x) / scale;
                  const newY = (groupY + node.y() - pan.y) / scale;
                  node.x(0); node.y(0); // reset node offset within group
                  setFurniture((p) => p.map((f) => f.id === resizingFurnitureId ? { ...f, x: newX, y: newY, width: newW, depth: newD } : f));
                }
                setResizingFurnitureId(null);
              }}
            />
          )}
        </Layer>

        {/* Standalone walls */}
        <Layer>
          {walls.map((w) => {
            const wx1 = w.x1 * scale + pan.x, wy1 = w.y1 * scale + pan.y;
            const wx2 = w.x2 * scale + pan.x, wy2 = w.y2 * scale + pan.y;
            const wdx = wx2 - wx1, wdy = wy2 - wy1;
            const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
            if (wlen < 1) return null;
            const nx = -wdy / wlen, ny = wdx / wlen;
            const hw = (w.thickness ?? WALL_THICKNESS_M) * scale / 2;
            const isSel = selectedId === w.id;
            return (
              <Group key={w.id}
                draggable={activeTool === 'select'}
                onClick={(e) => { e.cancelBubble = true; setSelectedId(w.id); setResizingFurnitureId(null); }}
                onDragEnd={(e) => {
                  const dx = (e.target.x()) / scale;
                  const dy = (e.target.y()) / scale;
                  e.target.x(0); e.target.y(0);
                  // Snap endpoints to nearby room walls
                  const snapDist = 15 / scale;
                  let nx1 = w.x1 + dx, ny1 = w.y1 + dy, nx2 = w.x2 + dx, ny2 = w.y2 + dy;
                  const near1 = findNearestWall(nx1, ny1, shapes, snapDist);
                  if (near1) { nx1 = near1.proj.x; ny1 = near1.proj.y; }
                  const near2 = findNearestWall(nx2, ny2, shapes, snapDist);
                  if (near2) { nx2 = near2.proj.x; ny2 = near2.proj.y; }
                  setWalls((p) => p.map((wl) => wl.id === w.id ? { ...wl, x1: nx1, y1: ny1, x2: nx2, y2: ny2 } : wl));
                }}
              >
                <Line points={[wx1 + nx * hw, wy1 + ny * hw, wx2 + nx * hw, wy2 + ny * hw, wx2 - nx * hw, wy2 - ny * hw, wx1 - nx * hw, wy1 - ny * hw]}
                  closed fill={isSel ? SELECT_COLOR : (resortConfig.wallColor ?? WALL_COLOR)} />
                {/* Endpoint handles when selected */}
                {isSel && (
                  <>
                    <Circle x={wx1} y={wy1} radius={6} fill={SELECT_COLOR} stroke={CANVAS_BG} strokeWidth={1.5}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      onDragStart={(e) => { e.cancelBubble = true; }}
                      onDragMove={(e) => { e.cancelBubble = true; }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        let nx = (e.target.x() - pan.x) / scale, ny = (e.target.y() - pan.y) / scale;
                        const near = findNearestWall(nx, ny, shapes, 15 / scale);
                        if (near) { nx = near.proj.x; ny = near.proj.y; }
                        e.target.x(nx * scale + pan.x); e.target.y(ny * scale + pan.y);
                        setWalls((p) => p.map((wl) => wl.id === w.id ? { ...wl, x1: nx, y1: ny } : wl));
                      }}
                    />
                    <Circle x={wx2} y={wy2} radius={6} fill={SELECT_COLOR} stroke={CANVAS_BG} strokeWidth={1.5}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'grab'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      onDragStart={(e) => { e.cancelBubble = true; }}
                      onDragMove={(e) => { e.cancelBubble = true; }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        let nx = (e.target.x() - pan.x) / scale, ny = (e.target.y() - pan.y) / scale;
                        const near = findNearestWall(nx, ny, shapes, 15 / scale);
                        if (near) { nx = near.proj.x; ny = near.proj.y; }
                        e.target.x(nx * scale + pan.x); e.target.y(ny * scale + pan.y);
                        setWalls((p) => p.map((wl) => wl.id === w.id ? { ...wl, x2: nx, y2: ny } : wl));
                      }}
                    />
                  </>
                )}
              </Group>
            );
          })}
          {drawingWall && (() => {
            const wx1 = drawingWall.x1 * scale + pan.x, wy1 = drawingWall.y1 * scale + pan.y;
            const wx2 = drawingWall.x2 * scale + pan.x, wy2 = drawingWall.y2 * scale + pan.y;
            const wdx = wx2 - wx1, wdy = wy2 - wy1;
            const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
            if (wlen < 1) return null;
            const nx = -wdy / wlen, ny = wdx / wlen;
            const hw = WALL_THICKNESS_M * scale / 2;
            return (
              <Line points={[wx1 + nx * hw, wy1 + ny * hw, wx2 + nx * hw, wy2 + ny * hw, wx2 - nx * hw, wy2 - ny * hw, wx1 - nx * hw, wy1 - ny * hw]}
                closed fill={resortConfig.wallColor ?? WALL_COLOR} opacity={0.6} listening={false} />
            );
          })()}
        </Layer>

        {/* Openings (doors + windows) — above all room layers */}
        <Layer>
          {openings.map((op) => {
            const sx1 = op.x1 * scale + pan.x, sy1 = op.y1 * scale + pan.y;
            const sx2 = op.x2 * scale + pan.x, sy2 = op.y2 * scale + pan.y;
            const isSel = selectedId === op.id;
            const isDoor = op.type === 'door';
            const wallPx = WALL_THICKNESS_M * scale;
            const color = isDoor ? (resortConfig.doorColor ?? DOOR_COLOR) : (resortConfig.windowColor ?? WINDOW_COLOR);
            const dx = sx2 - sx1, dy = sy2 - sy1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const nx = -dy / len, ny = dx / len;
            const hw = wallPx / 2;
            return (
              <Group key={op.id}>
                {/* Main opening shape — not draggable, click to select */}
                <Line
                  points={[sx1 + nx * hw, sy1 + ny * hw, sx2 + nx * hw, sy2 + ny * hw, sx2 - nx * hw, sy2 - ny * hw, sx1 - nx * hw, sy1 - ny * hw]}
                  closed fill={color}
                  stroke={isSel ? SELECT_COLOR : 'transparent'}
                  strokeWidth={isSel ? 1 : 0}
                  onClick={(e) => { e.cancelBubble = true; setSelectedId(op.id); setResizingFurnitureId(null); }}
                />
                {/* Door endcaps — perpendicular lines at each end, extend slightly beyond wall */}
                {isDoor && (
                  <>
                    <Line points={[sx1 + nx * (hw + 2), sy1 + ny * (hw + 2), sx1 - nx * (hw + 2), sy1 - ny * (hw + 2)]} stroke={resortConfig.wallColor ?? WALL_COLOR} strokeWidth={3} lineCap="round" />
                    <Line points={[sx2 + nx * (hw + 2), sy2 + ny * (hw + 2), sx2 - nx * (hw + 2), sy2 - ny * (hw + 2)]} stroke={resortConfig.wallColor ?? WALL_COLOR} strokeWidth={3} lineCap="round" />
                  </>
                )}
                {/* Endpoint adjustment dots (dark blue, only when selected) */}
                {isSel && (
                  <>
                    <Circle x={sx1} y={sy1} radius={5} fill="#1e3a5f" stroke={CANVAS_BG} strokeWidth={1}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      dragBoundFunc={(pos) => {
                        // Constrain to the wall segment
                        if (op.wallX1 !== undefined && op.wallY1 !== undefined && op.wallX2 !== undefined && op.wallY2 !== undefined) {
                          const proj = projectOntoSegment((pos.x - pan.x) / scale, (pos.y - pan.y) / scale, { x1: op.wallX1, y1: op.wallY1, x2: op.wallX2, y2: op.wallY2 });
                          return { x: proj.x * scale + pan.x, y: proj.y * scale + pan.y };
                        }
                        return pos;
                      }}
                      onDragEnd={(e) => {
                        const nx1 = (e.target.x() - pan.x) / scale, ny1 = (e.target.y() - pan.y) / scale;
                        setOpenings((p) => p.map((o) => o.id === op.id ? { ...o, x1: nx1, y1: ny1 } : o));
                      }}
                    />
                    <Circle x={sx2} y={sy2} radius={5} fill="#1e3a5f" stroke={CANVAS_BG} strokeWidth={1}
                      draggable
                      onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
                      onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                      dragBoundFunc={(pos) => {
                        if (op.wallX1 !== undefined && op.wallY1 !== undefined && op.wallX2 !== undefined && op.wallY2 !== undefined) {
                          const proj = projectOntoSegment((pos.x - pan.x) / scale, (pos.y - pan.y) / scale, { x1: op.wallX1, y1: op.wallY1, x2: op.wallX2, y2: op.wallY2 });
                          return { x: proj.x * scale + pan.x, y: proj.y * scale + pan.y };
                        }
                        return pos;
                      }}
                      onDragEnd={(e) => {
                        const nx2 = (e.target.x() - pan.x) / scale, ny2 = (e.target.y() - pan.y) / scale;
                        setOpenings((p) => p.map((o) => o.id === op.id ? { ...o, x2: nx2, y2: ny2 } : o));
                      }}
                    />
                  </>
                )}
              </Group>
            );
          })}
          {/* Drawing preview for door/window — shows in final color */}
          {drawingOpening && (() => {
            const sx1 = drawingOpening.x1 * scale + pan.x, sy1 = drawingOpening.y1 * scale + pan.y;
            const sx2 = drawingOpening.x2 * scale + pan.x, sy2 = drawingOpening.y2 * scale + pan.y;
            const color = drawingOpening.type === 'door' ? (resortConfig.doorColor ?? DOOR_COLOR) : (resortConfig.windowColor ?? WINDOW_COLOR);
            const wallPx = WALL_THICKNESS_M * scale;
            const dx = sx2 - sx1, dy = sy2 - sy1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const nx = -dy / len * wallPx / 2, ny = dx / len * wallPx / 2;
            return (
              <Group listening={false}>
                <Line points={[sx1 + nx, sy1 + ny, sx2 + nx, sy2 + ny, sx2 - nx, sy2 - ny, sx1 - nx, sy1 - ny]}
                  closed fill={color} />
                {drawingOpening.type === 'door' && (
                  <>
                    <Line points={[sx1 + nx, sy1 + ny, sx1 - nx, sy1 - ny]} stroke={resortConfig.wallColor ?? WALL_COLOR} strokeWidth={2} />
                    <Line points={[sx2 + nx, sy2 + ny, sx2 - nx, sy2 - ny]} stroke={resortConfig.wallColor ?? WALL_COLOR} strokeWidth={2} />
                  </>
                )}
              </Group>
            );
          })()}

          {/* Arrows */}
          {arrows.map((ar) => {
            const ax1 = ar.x1 * scale + pan.x, ay1 = ar.y1 * scale + pan.y;
            const ax2 = ar.x2 * scale + pan.x, ay2 = ar.y2 * scale + pan.y;
            const adx = ax2 - ax1, ady = ay2 - ay1;
            const alen = Math.sqrt(adx * adx + ady * ady);
            if (alen < 2) return null;
            const isSel = selectedId === ar.id;
            // Arrowhead: two lines from the tip
            const headLen = 12;
            const angle = Math.atan2(ady, adx);
            const h1x = ax2 - headLen * Math.cos(angle - 0.4), h1y = ay2 - headLen * Math.sin(angle - 0.4);
            const h2x = ax2 - headLen * Math.cos(angle + 0.4), h2y = ay2 - headLen * Math.sin(angle + 0.4);
            return (
              <Group key={ar.id} onClick={(e) => { e.cancelBubble = true; setSelectedId(ar.id); setResizingFurnitureId(null); }}>
                <Line points={[ax1, ay1, ax2, ay2]} stroke={isSel ? SELECT_COLOR : TEXT_PRIMARY} strokeWidth={3} lineCap="round" />
                <Line points={[h1x, h1y, ax2, ay2, h2x, h2y]} stroke={isSel ? SELECT_COLOR : TEXT_PRIMARY} strokeWidth={3} lineCap="round" lineJoin="round" />
              </Group>
            );
          })}

          {/* Arrow drawing preview */}
          {drawingArrow && (() => {
            const ax1 = drawingArrow.x1 * scale + pan.x, ay1 = drawingArrow.y1 * scale + pan.y;
            const ax2 = drawingArrow.x2 * scale + pan.x, ay2 = drawingArrow.y2 * scale + pan.y;
            const adx = ax2 - ax1, ady = ay2 - ay1;
            const alen = Math.sqrt(adx * adx + ady * ady);
            if (alen < 2) return null;
            const angle = Math.atan2(ady, adx);
            const h1x = ax2 - 12 * Math.cos(angle - 0.4), h1y = ay2 - 12 * Math.sin(angle - 0.4);
            const h2x = ax2 - 12 * Math.cos(angle + 0.4), h2y = ay2 - 12 * Math.sin(angle + 0.4);
            return (
              <Group listening={false}>
                <Line points={[ax1, ay1, ax2, ay2]} stroke="#44403c" strokeWidth={3} lineCap="round" />
                <Line points={[h1x, h1y, ax2, ay2, h2x, h2y]} stroke="#44403c" strokeWidth={3} lineCap="round" lineJoin="round" />
              </Group>
            );
          })()}

        </Layer>

        {/* Labels (Text tool) — above furniture, walls, and openings */}
        <Layer visible={showTitles}>
          {labels.map((label) => {
            const rc = resortConfig.info;
            const labelFs = label.fontSize > 0 ? label.fontSize : rc.fontSize;
            const fsPx = labelFs * scale;
            const isBeingEdited = editingText?.type === 'label' && editingText.id === label.id;
            const lx = label.x * scale + pan.x, ly = label.y * scale + pan.y;
            return (
              <Group key={label.id} x={lx} y={ly} rotation={label.rotation ?? 0}
                draggable={activeTool === 'select' && !isBeingEdited}
                onClick={() => { setSelectedId(label.id); setResizingFurnitureId(null); }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  const fsDisplay = unit === 'feet' ? (labelFs * M_TO_FT).toFixed(2) : labelFs.toFixed(2);
                  setLabelEditModal({ id: label.id, text: label.text, fontSize: fsDisplay, rotation: label.rotation ?? 0 });
                }}
                onDragEnd={(e) => {
                  setLabels((p) => p.map((l) => (l.id === label.id ? { ...l, x: (e.target.x() - pan.x) / scale, y: (e.target.y() - pan.y) / scale } : l)));
                }}
              >
                {label.text && !isBeingEdited && (
                  <Rect x={-3} y={-2} width={measureText(label.text, fsPx, rc.fontFamily, rc.fontStyle) + 6} height={fsPx * 1.3 + 4}
                    fill={bgColor} cornerRadius={4} listening={false} />
                )}
                <Text x={0} y={0}
                  text={label.text || 'Add text...'} fontSize={fsPx}
                  fontFamily={rc.fontFamily} fill={label.text ? rc.color : TEXT_EMPTY}
                  fontStyle={label.text ? rc.fontStyle : 'italic'}
                  visible={!isBeingEdited}
                  onDblClick={(e) => startEditing('label', label.id, label.text, e.target, Math.max(120, fsPx * 10),
                    { fontSize: fsPx, fontFamily: rc.fontFamily, fontStyle: rc.fontStyle, color: rc.color })}
                />
              </Group>
            );
          })}
        </Layer>

        {/* Room titles — MUST be last layer for highest z-index */}
        <Layer visible={showTitles}>
            {shapes.map((shape) => {
              const sw = shape.width * scale, sh = shape.depth * scale;
              const sx = shape.x * scale + pan.x, sy = shape.y * scale + pan.y;
              const titleFs = resortConfig.title.fontSize * scale;
              const titleText = shape.titleText || 'TEXT';
              const titleW = measureText(titleText, titleFs, resortConfig.title.fontFamily, resortConfig.title.fontStyle) + 8;
              const tx = sx + sw / 2 + (shape.titleOffsetX ?? 0) * sw;
              const ty = sy + sh / 2 + (shape.titleOffsetY ?? 0) * sh;
              const isTitleSelected = selectedId === shape.id;
              const isEditing = editingText?.type === 'shapeTitle' && editingText.id === shape.id;
              if (isEditing) return null;
              return (
                <Group key={`title-top-${shape.id}`} x={tx} y={ty} offsetX={titleW / 2}
                  draggable={activeTool === 'select'}
                  onMouseEnter={(e) => { if (activeTool === 'select') e.target.getStage()!.container().style.cursor = 'move'; }}
                  onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
                  onDragStart={(e) => { e.cancelBubble = true; }}
                  onDragMove={(e) => { e.cancelBubble = true; }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const newOffX = (e.target.x() - (sx + sw / 2)) / sw;
                    const newOffY = (e.target.y() - (sy + sh / 2)) / sh;
                    setShapes((p) => p.map((s) => s.id === shape.id ? { ...s, titleOffsetX: Math.max(-0.45, Math.min(0.45, newOffX)), titleOffsetY: Math.max(-0.45, Math.min(0.45, newOffY)) } : s));
                  }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    startEditing('shapeTitle', shape.id, shape.titleText ?? '', e.target as unknown as Parameters<typeof startEditing>[3], titleW,
                      { fontSize: titleFs, fontFamily: resortConfig.title.fontFamily, fontStyle: resortConfig.title.fontStyle, color: resortConfig.title.color, align: 'center' });
                  }}
                >
                  <Rect x={-2} y={-2} width={titleW + 4} height={titleFs * 1.3 + 4}
                    fill={isTitleSelected ? SELECT_BG : SHAPE_FILLS[shape.type]}
                    stroke={isTitleSelected ? SELECT_COLOR : 'transparent'}
                    strokeWidth={isTitleSelected ? 1 : 0}
                    cornerRadius={4} />
                  <Text x={0} y={0} width={titleW} text={titleText} fontSize={titleFs}
                    fontFamily={resortConfig.title.fontFamily}
                    fill={isTitleSelected ? SELECT_COLOR : (shape.titleText ? resortConfig.title.color : TEXT_EMPTY)}
                    fontStyle={shape.titleText ? resortConfig.title.fontStyle : 'italic'}
                    align="center" />
                </Group>
              );
            })}
        </Layer>

        {/* Shape info (type + dimensions) — top layer so not obscured by overlapping shapes */}
        <Layer visible={showInfo} listening={false}>
          {shapes.map((shape) => {
            const sw = shape.width * scale, sh = shape.depth * scale;
            const sx = shape.x * scale + pan.x, sy = shape.y * scale + pan.y;
            const typeText = shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
            const dimText = `${fmtDim(shape.width)} x ${fmtDim(shape.depth)}`;
            const textW = Math.max(measureText(typeText, 10, 'Arial', 'normal'), measureText(dimText, 10, 'Arial', 'normal'));
            const infoH = showTitles ? 28 : 16;
            const pad = 6;
            // Bottom-right of shape, right-aligned to shape edge
            const ix = sx + sw - textW - pad;
            const iy = sy + sh + 3;
            return (
              <Group key={`info-${shape.id}`} x={ix} y={iy}>
                <Rect x={-3} y={-2} width={textW + pad} height={infoH} fill="white" opacity={0.8} cornerRadius={3} />
                {showTitles && <Text x={0} y={0} text={typeText} fontSize={10} fill="#a1a1aa" />}
                <Text x={0} y={showTitles ? 13 : 0} text={dimText} fontSize={10} fill="#71717a" />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {/* Furniture size modal (right-click) */}
      {furnitureSizeModal && (() => {
        const item = furniture.find((f) => f.id === furnitureSizeModal.id);
        const applyModal = () => {
          const w = parseFloat(furnitureSizeModal.width), d = parseFloat(furnitureSizeModal.depth);
          if (!isNaN(w) && !isNaN(d) && w > 0 && d > 0) {
            const wm = unit === 'feet' ? w / M_TO_FT : w;
            const dm = unit === 'feet' ? d / M_TO_FT : d;
            setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, width: wm, depth: dm, color: furnitureSizeModal.color, label: furnitureSizeModal.label, labelRotation: furnitureSizeModal.labelRotation } : f));
          } else {
            // If dimensions invalid, still apply label/color/rotation
            setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, color: furnitureSizeModal.color, label: furnitureSizeModal.label, labelRotation: furnitureSizeModal.labelRotation } : f));
          }
          setFurnitureSizeModal(null);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={applyModal}>
            <div className="bg-background border rounded-lg shadow-lg p-4 space-y-3 w-64" onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter') applyModal(); }}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{furnitureSizeModal.label || item?.type || 'Edit'}</h4>
                <button onClick={applyModal} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
              </div>
              {/* Dimensions — single diameter for circle/semicircle, width+depth for rectangles */}
              {furnitureSizeModal.shape === 'circle' || furnitureSizeModal.shape === 'semicircle' ? (
                <div>
                  <label className="text-[10px] text-muted-foreground">Diameter ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input type="text" value={furnitureSizeModal.width}
                    onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, width: e.target.value, depth: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input type="text" value={furnitureSizeModal.width}
                      onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, width: e.target.value })}
                      className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Depth ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input type="text" value={furnitureSizeModal.depth}
                      onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, depth: e.target.value })}
                      className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
                  </div>
                </div>
              )}
              {/* Label text */}
              <div>
                <label className="text-[10px] text-muted-foreground">Label</label>
                <input type="text" value={furnitureSizeModal.label}
                  onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, label: e.target.value })}
                  placeholder="(no label)"
                  className="w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              {/* Label text rotation — applies immediately to canvas */}
              <div className="flex gap-2">
                <button onClick={() => {
                  const newRot = ((furnitureSizeModal.labelRotation ?? 0) - 15 + 360) % 360;
                  setFurnitureSizeModal({ ...furnitureSizeModal, labelRotation: newRot });
                  setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, labelRotation: newRot } : f));
                }}
                  className="flex-1 rounded border border-border py-1 text-xs font-medium text-muted-foreground hover:bg-muted">↶ Text -15°</button>
                <span className="text-[10px] text-muted-foreground self-center w-10 text-center">{furnitureSizeModal.labelRotation ?? 0}°</span>
                <button onClick={() => {
                  const newRot = ((furnitureSizeModal.labelRotation ?? 0) + 15) % 360;
                  setFurnitureSizeModal({ ...furnitureSizeModal, labelRotation: newRot });
                  setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, labelRotation: newRot } : f));
                }}
                  className="flex-1 rounded border border-border py-1 text-xs font-medium text-muted-foreground hover:bg-muted">↷ Text +15°</button>
              </div>
              {/* Color picker */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground">Color</label>
                <input type="color" value={furnitureSizeModal.color}
                  onChange={(e) => setFurnitureSizeModal({ ...furnitureSizeModal, color: e.target.value })}
                  className="w-6 h-6 rounded border cursor-pointer" />
              </div>
              <button onClick={() => {
                const w = parseFloat(furnitureSizeModal.width), d = parseFloat(furnitureSizeModal.depth);
                if (!isNaN(w) && !isNaN(d) && w > 0 && d > 0) {
                  const wm = unit === 'feet' ? w / M_TO_FT : w;
                  const dm = unit === 'feet' ? d / M_TO_FT : d;
                  setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, width: wm, depth: dm, color: furnitureSizeModal.color, label: furnitureSizeModal.label, labelRotation: furnitureSizeModal.labelRotation } : f));
                }
                setFurnitureSizeModal(null);
              }} className="w-full rounded bg-primary text-primary-foreground py-1.5 text-xs font-medium hover:opacity-90">Apply</button>
              {/* Rotate buttons (not for circles) */}
              {item?.shape !== 'circle' && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, rotation: ((f.rotation ?? 0) - 15 + 360) % 360 } : f));
                  }} className="flex-1 rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">↶ Rotate -15°</button>
                  <button onClick={() => {
                    setFurniture((p) => p.map((f) => f.id === furnitureSizeModal.id ? { ...f, rotation: ((f.rotation ?? 0) + 15) % 360 } : f));
                  }} className="flex-1 rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">↷ Rotate +15°</button>
                </div>
              )}
              {/* Duplicate */}
              <button onClick={() => {
                if (!item) return;
                const dup: LayoutFurniture = { ...item, id: generateId(), x: item.x + 0.2, y: item.y + 0.2 };
                setFurniture((p) => [...p, dup]);
                setSelectedId(dup.id);
                setFurnitureSizeModal(null);
              }} className="w-full rounded border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">Duplicate</button>
            </div>
          </div>
        );
      })()}

      {/* Label edit modal (right-click on Text tool labels) */}
      {labelEditModal && (() => {
        const applyLabelModal = () => {
          const fs = parseFloat(labelEditModal.fontSize);
          if (!isNaN(fs) && fs > 0) {
            const fsM = unit === 'feet' ? fs / M_TO_FT : fs;
            setLabels((p) => p.map((l) => l.id === labelEditModal.id ? { ...l, text: labelEditModal.text, fontSize: fsM, rotation: labelEditModal.rotation } : l));
          } else {
            setLabels((p) => p.map((l) => l.id === labelEditModal.id ? { ...l, text: labelEditModal.text, rotation: labelEditModal.rotation } : l));
          }
          setLabelEditModal(null);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={applyLabelModal}>
            <div className="bg-background border rounded-lg shadow-lg p-4 space-y-3 w-64" onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter') applyLabelModal(); }}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Edit Text</h4>
                <button onClick={applyLabelModal} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
              </div>
              {/* Text content */}
              <div>
                <label className="text-[10px] text-muted-foreground">Text</label>
                <input type="text" value={labelEditModal.text}
                  onChange={(e) => setLabelEditModal({ ...labelEditModal, text: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/50" autoFocus />
              </div>
              {/* Font size */}
              <div>
                <label className="text-[10px] text-muted-foreground">Font Size ({unit === 'feet' ? 'ft' : 'm'})</label>
                <input type="text" value={labelEditModal.fontSize}
                  onChange={(e) => setLabelEditModal({ ...labelEditModal, fontSize: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              {/* Rotation ±15° */}
              <div className="flex gap-2">
                <button onClick={() => {
                  const newRot = ((labelEditModal.rotation ?? 0) - 15 + 360) % 360;
                  setLabelEditModal({ ...labelEditModal, rotation: newRot });
                  setLabels((p) => p.map((l) => l.id === labelEditModal.id ? { ...l, rotation: newRot } : l));
                }}
                  className="flex-1 rounded border border-border py-1 text-xs font-medium text-muted-foreground hover:bg-muted">↶ -15°</button>
                <span className="text-[10px] text-muted-foreground self-center w-10 text-center">{labelEditModal.rotation ?? 0}°</span>
                <button onClick={() => {
                  const newRot = ((labelEditModal.rotation ?? 0) + 15) % 360;
                  setLabelEditModal({ ...labelEditModal, rotation: newRot });
                  setLabels((p) => p.map((l) => l.id === labelEditModal.id ? { ...l, rotation: newRot } : l));
                }}
                  className="flex-1 rounded border border-border py-1 text-xs font-medium text-muted-foreground hover:bg-muted">↷ +15°</button>
              </div>
              {/* Apply */}
              <button onClick={applyLabelModal}
                className="w-full rounded bg-primary text-primary-foreground py-1.5 text-xs font-medium hover:opacity-90">Apply</button>
              {/* Delete */}
              <button onClick={() => {
                setLabels((p) => p.filter((l) => l.id !== labelEditModal.id));
                setSelectedId(null);
                setLabelEditModal(null);
              }} className="w-full rounded border border-destructive text-destructive py-1.5 text-xs font-medium hover:bg-destructive/10">Delete</button>
            </div>
          </div>
        );
      })()}

      {/* ── UNIFIED INLINE TEXT EDITOR ── */}
      {editingText && (
        <input
          type="text"
          className="absolute z-50 outline-none rounded-[5px] border border-primary/30"
          style={{
            left: editingText.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0) - 4,
            top: editingText.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0) - 2,
            width: editingText.width + 8,
            padding: '2px 4px',
            fontSize: editingText.fontSize,
            fontFamily: editingText.fontFamily,
            fontWeight: editingText.fontStyle.includes('bold') ? 'bold' : 'normal',
            fontStyle: editingText.fontStyle.includes('italic') ? 'italic' : 'normal',
            color: editingText.color,
            backgroundColor: 'white',
            textAlign: editingText.align as 'left' | 'center',
            lineHeight: 1.2,
          }}
          value={editingText.text}
          onChange={(e) => {
            const val = e.target.value;
            setEditingTextAndRef((p) => p ? { ...p, text: val } : null);
            // Live update — read type/id from ref (never stale)
            const et = editingTextRef.current;
            if (!et) return;
            if (et.type === 'label') setLabels((p) => p.map((l) => l.id === et.id ? { ...l, text: val } : l));
            if (et.type === 'bedName') setBeds((p) => p.map((b) => b.id === et.id ? { ...b, label: val } : b));
            if (et.type === 'shapeTitle') setShapes((p) => p.map((s) => s.id === et.id ? { ...s, titleText: val } : s));
            if (et.type === 'furnitureLabel') setFurniture((p) => p.map((f) => f.id === et.id ? { ...f, label: val } : f));
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitTextEdit(); }}
          onBlur={commitTextEdit}
          autoFocus
        />
      )}

      {/* Floating display controls — bottom-right, stacked vertically */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 items-end">
        {/* Room thumbnail preview */}
        {thumbnail && (
          <div className="w-24 rounded-lg border bg-background/90 shadow-sm overflow-hidden p-1">
            <img src={thumbnail} alt="Room thumbnail" className="w-full h-auto rounded" style={{ imageRendering: 'auto' }} />
          </div>
        )}
        <button
          onClick={() => setShowTitles(!showTitles)}
          className={`flex items-center justify-center w-24 h-8 rounded-lg border text-[10px] font-medium shadow-sm transition-colors ${showTitles ? 'bg-background/90 text-foreground' : 'bg-muted/60 text-muted-foreground'}`}
        >
          {showTitles ? 'Hide' : 'Show'} Titles
        </button>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className={`flex items-center justify-center w-24 h-8 rounded-lg border text-[10px] font-medium shadow-sm transition-colors ${showInfo ? 'bg-background/90 text-foreground' : 'bg-muted/60 text-muted-foreground'}`}
        >
          {showInfo ? 'Hide' : 'Show'} Info
        </button>
        <div className="flex items-center justify-between w-24 h-8 rounded-lg border bg-background/90 shadow-sm px-2">
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium text-muted-foreground">BG</span>
            <span className="text-[10px] font-medium text-muted-foreground">Color</span>
          </div>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
            className="w-5 h-5 rounded border cursor-pointer" />
        </div>
      </div>
    </div>
  );
}
