'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { TranslationKeys } from '@/i18n/en';

interface AppShellProps {
  children: React.ReactNode;
  dict: TranslationKeys;
}

export function AppShell({ children, dict }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar dict={dict} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar dict={dict} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar dict={dict} onMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
