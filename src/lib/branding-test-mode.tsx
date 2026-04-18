'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  DEFAULT_BRANDING, COLOR_KEY_TO_CSS_VAR,
  type OrgBranding, type BrandingColors,
} from '@/config/branding-defaults';

interface BrandingTestModeState {
  isTestMode: boolean;
  liveBranding: OrgBranding;
  testBranding: OrgBranding | null;
  resetTest: () => Promise<void>;
  enterTestMode: () => Promise<void>;
  exitTestMode: () => Promise<void>;
  promoteToLive: () => Promise<void>;
  updateTest: (partial: Partial<OrgBranding>) => void;
}

const BrandingTestModeContext = createContext<BrandingTestModeState>({
  isTestMode: false,
  liveBranding: DEFAULT_BRANDING,
  testBranding: null,
  resetTest: async () => {},
  enterTestMode: async () => {},
  exitTestMode: async () => {},
  promoteToLive: async () => {},
  updateTest: () => {},
});

export function useBrandingTestMode() {
  return useContext(BrandingTestModeContext);
}

/** Inject or update a dynamic <style> element for test branding */
let testStyleEl: HTMLStyleElement | null = null;

function getOrCreateStyleEl(): HTMLStyleElement {
  // Check DOM first (survives HMR)
  const existing = document.querySelector('style[data-branding-test]') as HTMLStyleElement | null;
  if (existing) { testStyleEl = existing; return existing; }
  const el = document.createElement('style');
  el.setAttribute('data-branding-test', '');
  document.head.appendChild(el);
  testStyleEl = el;
  return el;
}

function applyTestCss(branding: OrgBranding | null) {
  // Also clean up orphaned preview style from old branding panel
  document.querySelector('style[data-branding-preview]')?.remove();

  if (!branding) {
    // Remove test style
    const el = testStyleEl ?? document.querySelector('style[data-branding-test]');
    if (el) { el.remove(); testStyleEl = null; }
    return;
  }

  const el = getOrCreateStyleEl();

  const lightVars: string[] = [];
  const darkVars: string[] = [];

  for (const [key, cssVar] of Object.entries(COLOR_KEY_TO_CSS_VAR)) {
    const lightVal = branding.light[key as keyof BrandingColors];
    const darkVal = branding.dark[key as keyof BrandingColors];
    if (lightVal) lightVars.push(`${cssVar}:${lightVal}`);
    if (darkVal) darkVars.push(`${cssVar}:${darkVal}`);
  }

  if (branding.radius !== undefined) lightVars.push(`--radius:${branding.radius}px`);
  if (branding.btnFxStrength !== undefined) lightVars.push(`--btn-fx-strength:${branding.btnFxStrength}`);
  if (branding.btnFxSpeed !== undefined) lightVars.push(`--btn-fx-speed:${branding.btnFxSpeed}`);
  if (branding.backgroundColor) lightVars.push(`--ao-bg-color:${branding.backgroundColor}`);
  if (branding.backgroundImageUrl) lightVars.push(`--ao-bg-image:url(${branding.backgroundImageUrl})`);
  if (branding.backgroundOpacity !== undefined) lightVars.push(`--ao-bg-opacity:${branding.backgroundOpacity}`);
  if (branding.backgroundBlendMode) lightVars.push(`--ao-bg-blend:${branding.backgroundBlendMode}`);
  if (branding.backgroundColorDark) darkVars.push(`--ao-bg-color:${branding.backgroundColorDark}`);

  el.textContent = `:root{${lightVars.join(';')}}.dark{${darkVars.join(';')}}`;
}

export function BrandingTestModeProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [liveBranding, setLiveBranding] = useState<OrgBranding>(DEFAULT_BRANDING);
  const [testBranding, setTestBranding] = useState<OrgBranding | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load state on mount — only fetch if ao_test_branding cookie exists or user might be admin
  useEffect(() => {
    // Quick check: if no test mode cookie, skip the fetch for non-admin users
    const hasTestCookie = document.cookie.includes('ao_test_branding=1');

    (async () => {
      try {
        // Only fetch if test mode cookie exists (need to sync state)
        // OR on first load to get live branding (lightweight)
        const res = await fetch('/api/admin/branding');
        if (!res.ok) return; // 403 for non-admins — silently skip
        const data = await res.json();
        setLiveBranding(data.branding);
        if (data.testBranding && data.isTestMode) {
          setTestBranding(data.testBranding);
          setIsTestMode(true);
          applyTestCss(data.testBranding);
        } else if (hasTestCookie && !data.isTestMode) {
          // Cookie exists but server says no test mode — stale cookie, clean up
          applyTestCss(null);
        }
      } catch { /* ignore */ }
    })();

    return () => {
      // Cleanup: remove test style on unmount
      if (testStyleEl) { testStyleEl.remove(); testStyleEl = null; }
    };
  }, []);

  const enterTestMode = useCallback(async () => {
    const res = await fetch('/api/admin/branding/test-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enter' }),
    });
    if (!res.ok) return;

    // Refresh state
    const getRes = await fetch('/api/admin/branding');
    if (getRes.ok) {
      const data = await getRes.json();
      setLiveBranding(data.branding);
      setTestBranding(data.testBranding);
      setIsTestMode(true);
      applyTestCss(data.testBranding);
    }
  }, []);

  const exitTestMode = useCallback(async () => {
    await fetch('/api/admin/branding?target=discard', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    setTestBranding(null);
    setIsTestMode(false);
    applyTestCss(null);
  }, []);

  const promoteToLive = useCallback(async () => {
    const res = await fetch('/api/admin/branding?target=promote', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) return;
    const data = await res.json();
    setLiveBranding(data.branding);
    setTestBranding(null);
    setIsTestMode(false);
    // Apply the promoted values as persistent CSS (don't remove — SSR tag has old values)
    applyTestCss(data.branding);
  }, []);

  const resetTest = useCallback(async () => {
    // Reset test branding to current live values
    const liveClone = JSON.parse(JSON.stringify(liveBranding)) as OrgBranding;
    setTestBranding(liveClone);
    applyTestCss(liveClone);
    // Save reset to DB
    await fetch('/api/admin/branding?target=test', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(liveClone),
    });
  }, [liveBranding]);

  const updateTest = useCallback((partial: Partial<OrgBranding>) => {
    setTestBranding((prev) => {
      if (!prev) return prev;
      const next: OrgBranding = {
        ...prev,
        ...partial,
        light: { ...prev.light, ...(partial.light ?? {}) },
        dark: { ...prev.dark, ...(partial.dark ?? {}) },
      };
      applyTestCss(next);

      // Debounced save to DB
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch('/api/admin/branding?target=test', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
      }, 800);

      return next;
    });
  }, []);

  return (
    <BrandingTestModeContext.Provider value={{ isTestMode, liveBranding, testBranding, resetTest, enterTestMode, exitTestMode, promoteToLive, updateTest }}>
      {children}
    </BrandingTestModeContext.Provider>
  );
}
