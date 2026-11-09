import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MeditationScreensaver } from '@/components/shared/meditation-screensaver';
import { ButtonEffectsInit } from '@/components/shared/button-effects-init';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AO Platform',
  description: 'Operations management platform',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            if (localStorage.getItem('ao-theme') === 'dark' ||
                (!localStorage.getItem('ao-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
              document.documentElement.classList.add('dark');
            }
          } catch {}
        ` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <MeditationScreensaver />
        <ButtonEffectsInit />
        {/*
          Host for the click-burst SVGs. It exists so those bursts are never
          appended straight into <body>.

          In the App Router <body> and its children are part of React's own
          tree, so a foreign node inserted there puts React's bookkeeping out
          of step with the real DOM. A burst lives 800ms, and if a navigation
          committed inside that window React threw "Cannot read properties of
          null (reading 'removeChild')" partway through unmounting the old
          page and left the UI frozen. That is what made navigation stall at
          random.

          React renders this div but never gives it children, so it never
          diffs what is inside it and anything appended here is safe. The
          burst is position: fixed, so nesting changes nothing visually, as
          long as this element never gets a transform or filter.
        */}
        <div id="ao-fx-layer" aria-hidden="true" />
      </body>
    </html>
  );
}
