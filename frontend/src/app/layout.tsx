import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from '@/components/providers';
import { UnmaskedBanner } from '@/components/ui/unmasked-banner';
import { env } from '@/lib/env';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: { default: 'COBRA-WATCH', template: '%s | COBRA-WATCH' },
  description:
    'Trust scores for exposed cameras. Vulnerability posture, gated by signal integrity.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A0C0B',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <UnmaskedBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
