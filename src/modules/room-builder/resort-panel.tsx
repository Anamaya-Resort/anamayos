'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FONT_FAMILIES, M_TO_FT, type ResortConfig, type TextStyle } from './types';
import { WALL_THICKNESS_M, WALL_COLOR, DOOR_COLOR, WINDOW_COLOR } from './colors';

interface ResortPanelProps {
  config: ResortConfig;
  setConfig: (config: ResortConfig) => void;
  unit: 'meters' | 'feet';
}

function TextStyleEditor({ label, style, onChange, unit }: {
  label: string; style: TextStyle;
  onChange: (s: TextStyle) => void; unit: 'meters' | 'feet';
}) {
  const fmtSize = (m: number) => unit === 'feet' ? `${(m * M_TO_FT).toFixed(2)}ft` : `${m.toFixed(2)}m`;
  const step = unit === 'feet' ? 0.03 : 0.01;

  return (
    <div className="space-y-1.5 rounded border p-2">
      <h5 className="text-[11px] font-semibold text-foreground">{label}</h5>

      {/* Font family */}
      <select value={style.fontFamily} onChange={(e) => onChange({ ...style, fontFamily: e.target.value })}
        className="w-full rounded border px-1.5 py-0.5 text-[11px]" style={{ fontFamily: style.fontFamily }}>
        <optgroup label="System">
          {FONT_FAMILIES.slice(0, 6).map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </optgroup>
        <optgroup label="Google">
          {FONT_FAMILIES.slice(6).map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </optgroup>
      </select>

      {/* Size + Style + Color row */}
      <div className="flex gap-1.5 items-center">
        {/* Size */}
        <div className="flex-1">
          <input type="range" min={0.05} max={0.8} step={step} value={style.fontSize}
            onChange={(e) => onChange({ ...style, fontSize: parseFloat(e.target.value) })}
            className="w-full accent-primary" />
          <div className="text-[9px] text-muted-foreground text-center">{fmtSize(style.fontSize)}</div>
        </div>

        {/* Style */}
        <select value={style.fontStyle} onChange={(e) => onChange({ ...style, fontStyle: e.target.value as TextStyle['fontStyle'] })}
          className="rounded border px-1 py-0.5 text-[11px] w-[72px]">
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
          <option value="italic">Italic</option>
          <option value="bold italic">Bold Italic</option>
        </select>

        {/* Color */}
        <input type="color" value={style.color}
          onChange={(e) => onChange({ ...style, color: e.target.value })}
          className="w-6 h-6 rounded border cursor-pointer p-0" />
      </div>
    </div>
  );
}

export function ResortPanel({ config, setConfig, unit }: ResortPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const updateStyle = (key: keyof ResortConfig, style: TextStyle) =>
    setConfig({ ...config, [key]: style });

  return (
    <div className="border-b">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold hover:bg-muted/50 transition-colors">
        <span>Resort</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <TextStyleEditor label="Room Titles" style={config.title} onChange={(s) => updateStyle('title', s)} unit={unit} />
          <TextStyleEditor label="Info Text" style={config.info} onChange={(s) => updateStyle('info', s)} unit={unit} />
          <TextStyleEditor label="Furniture Labels" style={config.furniture} onChange={(s) => updateStyle('furniture', s)} unit={unit} />

          {/* Element colors */}
          <div className="rounded border p-2 space-y-1.5">
            <h5 className="text-[11px] font-semibold text-foreground">Element Colors</h5>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14">Wall</span>
              <input type="color" value={config.wallColor ?? WALL_COLOR}
                onChange={(e) => setConfig({ ...config, wallColor: e.target.value })}
                className="w-5 h-5 rounded border cursor-pointer p-0" />
              <span className="text-[9px] font-mono text-muted-foreground">{config.wallColor ?? WALL_COLOR}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14">Door</span>
              <input type="color" value={config.doorColor ?? DOOR_COLOR}
                onChange={(e) => setConfig({ ...config, doorColor: e.target.value })}
                className="w-5 h-5 rounded border cursor-pointer p-0" />
              <span className="text-[9px] font-mono text-muted-foreground">{config.doorColor ?? DOOR_COLOR}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14">Window</span>
              <input type="color" value={config.windowColor ?? WINDOW_COLOR}
                onChange={(e) => setConfig({ ...config, windowColor: e.target.value })}
                className="w-5 h-5 rounded border cursor-pointer p-0" />
              <span className="text-[9px] font-mono text-muted-foreground">{config.windowColor ?? WINDOW_COLOR}</span>
            </div>
          </div>

          {/* Wall thickness display */}
          <div className="rounded border p-2 space-y-1">
            <h5 className="text-[11px] font-semibold text-foreground">Wall Thickness</h5>
            <p className="text-[10px] text-muted-foreground">
              {unit === 'feet' ? `${(WALL_THICKNESS_M * M_TO_FT).toFixed(2)} ft` : `${WALL_THICKNESS_M.toFixed(2)} m`}
              <span className="ml-1 text-muted-foreground/60">(global default)</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
