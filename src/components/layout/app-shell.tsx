'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { TestModeIndicator } from '@/components/shared/test-mode-indicator';
import type { TranslationKeys } from '@/i18n/en';

interface AppShellProps {
  children: React.ReactNode;
  dict: TranslationKeys;
}

export function AppShell({ children, dict }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--ao-bg-color, var(--background))' }}>
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
          backgroundColor: 'var(--ao-bg-color, var(--background))',
        }}>
          {/* Background texture layer */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'var(--ao-bg-image, none)',
            backgroundSize: '128px 128px',
            backgroundRepeat: 'repeat',
            opacity: 'var(--ao-bg-opacity, 1)' as unknown as number,
            mixBlendMode: 'var(--ao-bg-blend, normal)' as unknown as React.CSSProperties['mixBlendMode'],
          }} />
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
