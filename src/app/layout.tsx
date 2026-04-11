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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <MeditationScreensaver />
        <ButtonEffectsInit />
      </body>
    </html>
  );
}
