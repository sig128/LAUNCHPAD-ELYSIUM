import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Shell } from '@/components/shell/Shell';
import { BRAND, COPY } from '@/lib/config';
import './globals.css';

const fraunces = localFont({
  src: './fonts/Fraunces-full.woff2',
  variable: '--font-fraunces',
  weight: '300 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${COPY.heroSub}`, template: `%s | ${BRAND.name}` },
  description: 'Launch a market, trade with clear execution costs and earn a published share of collected fees on Elysium.',
};

export const viewport: Viewport = {
  themeColor: '#06110d',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
