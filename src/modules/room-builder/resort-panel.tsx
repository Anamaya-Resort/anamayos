'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FONT_FAMILIES, M_TO_FT, type ResortConfig } from './types';
import type { TranslationKeys } from '@/i18n/en';

interface ResortPanelProps {
  config: ResortConfig;
  setConfig: (config: ResortConfig) => void;
  unit: 'meters' | 'feet';
  dict: TranslationKeys;
}

export function ResortPanel({ config, setConfig, unit, dict }: ResortPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const fmtSize = (meters: number) => unit === 'feet' ? `${(meters * M_TO_FT).toFixed(2)}ft` : `${meters.toFixed(2)}m`;
  const sizeStep = unit === 'feet' ? 0.03 : 0.01;

  const update = (partial: Partial<ResortConfig>) => setConfig({ ...config, ...partial });

  return (
    <div className="border-b">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold hover:bg-muted/50 transition-colors"
      >
        <span>Resort</span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Font family */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Font Family</label>
            <select
              value={config.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
              className="w-full rounded border px-2 py-1 text-sm"
              style={{ fontFamily: config.fontFamily }}
            >
              <optgroup label="System Fonts">
                {FONT_FAMILIES.slice(0, 6).map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </optgroup>
              <optgroup label="Google Fonts">
                {FONT_FAMILIES.slice(6).map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Room Title font size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Room Title Size <span className="font-mono text-[10px]">({fmtSize(config.titleFontSize)})</span>
            </label>
            <input type="range" min={0.1} max={0.8} step={sizeStep}
              value={config.titleFontSize}
              onChange={(e) => update({ titleFontSize: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Info Text font size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Info Text Size <span className="font-mono text-[10px]">({fmtSize(config.infoFontSize)})</span>
            </label>
            <input type="range" min={0.05} max={0.5} step={sizeStep}
              value={config.infoFontSize}
              onChange={(e) => update({ infoFontSize: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Furniture Text font size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Furniture Text Size <span className="font-mono text-[10px]">({fmtSize(config.furnitureFontSize)})</span>
            </label>
            <input type="range" min={0.05} max={0.4} step={sizeStep}
              value={config.furnitureFontSize}
              onChange={(e) => update({ furnitureFontSize: parseFloat(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}
