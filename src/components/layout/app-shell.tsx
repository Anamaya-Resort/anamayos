'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { TestModeIndicator } from '@/components/shared/test-mode-indicator';
import { useBrandingTestMode } from '@/lib/branding-test-mode';
import type { TranslationKeys } from '@/i18n/en';

interface AppShellProps {
  children: React.ReactNode;
  dict: TranslationKeys;
}

export function AppShell({ children, dict }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const { isTestMode, testBranding, liveBranding } = useBrandingTestMode();
  const branding = isTestMode && testBranding ? testBranding : liveBranding;
  const bgColor = isDark
    ? (branding.backgroundColorDark ?? '#000000')
    : (branding.backgroundColor ?? '#ffffff');

  // Watch for dark mode class changes on <html>
  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains('dark'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: bgColor || undefined }}>
      {/* Sidebar — slides in/out */}
      <div
        className={cn(
          'sidebar-panel',
          sidebarOpen ? 'sidebar-open' : 'sidebar-closed',
        )}
      >
        <Sidebar dict={dict} />
      </div>

      {/* Floating toggle tab — vertically centered on sidebar edge */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="sidebar-toggle-tab"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        style={{ left: sidebarOpen ? 'var(--sidebar-width)' : '0px' }}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            sidebarOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar dict={dict} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative" style={{
          backgroundColor: bgColor || undefined,
        }}>
          {/* Background texture layer */}
          {branding.backgroundImageUrl && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `url(${branding.backgroundImageUrl})`,
              backgroundSize: '128px 128px',
              backgroundRepeat: 'repeat',
              opacity: branding.backgroundOpacity ?? 1,
              mixBlendMode: (branding.backgroundBlendMode ?? 'normal') as React.CSSProperties['mixBlendMode'],
            }} />
          )}
          <div className="relative">
            {children}
          </div>
        </main>
      </div>

      {/* Floating test mode indicator */}
      <TestModeIndicator />
    </div>
  );
}
