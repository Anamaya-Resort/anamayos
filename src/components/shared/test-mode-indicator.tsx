'use client';

import { useRouter } from 'next/navigation';
import { useBrandingTestMode } from '@/lib/branding-test-mode';

/**
 * Floating "TEST CSS" pill that appears on all pages when branding test mode is active.
 * Clicking it navigates back to the branding panel.
 */
export function TestModeIndicator() {
  const { isTestMode } = useBrandingTestMode();
  const router = useRouter();

  if (!isTestMode) return null;

  return (
    <button
      onClick={() => router.push('/dashboard/settings?tab=organization')}
      className="fixed right-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg hover:bg-blue-700 transition-colors animate-in slide-in-from-right-5 duration-300"
      style={{ top: 'calc(var(--topbar-height, 3.5rem) + 15px)' }}
    >
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      TEST CSS
    </button>
  );
}
