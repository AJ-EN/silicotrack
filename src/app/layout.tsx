import type { Metadata, Viewport } from 'next';
import { Noto_Sans, Noto_Sans_Devanagari } from 'next/font/google';

import { ServiceWorkerRegistrar } from '@/components/field/service-worker';

import './globals.css';

/**
 * Devanagari-safe stack (CLAUDE.md §8). Both faces are self-hosted by
 * next/font at build time — a field app that fetches fonts from a CDN shows
 * boxes instead of Hindi the moment it goes offline, which is most of the
 * time.
 */
const notoSans = Noto_Sans({
  variable: '--font-noto-sans',
  subsets: ['latin'],
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: '--font-noto-devanagari',
  subsets: ['devanagari'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SilicoTrack — सिलिकोट्रैक',
  description:
    'Exposure-based risk targeting and referral tracking for silicosis case-finding in Rajasthan. Unvalidated prototype, synthetic data. Not a diagnostic device.',
  manifest: '/manifest.webmanifest',
  applicationName: 'SilicoTrack',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled. Pinch-to-zoom is an accessibility right, and a health
  // worker reading a small figure in glare will use it.
  maximumScale: 5,
  themeColor: '#1b2a3d',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="hi"
      className={`${notoSans.variable} ${notoSansDevanagari.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-white">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
