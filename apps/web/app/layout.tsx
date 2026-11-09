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

/**
 * Sets the entrance stage before first paint so there is no flash: the intro shows only on a plain
 * visit to "/" that has not entered yet this session. Without JavaScript no stage is set and the
 * workspace shows directly.
 */
const STAGE_SCRIPT = `(function(){var d=document.documentElement;try{var intro=location.pathname==='/'&&!location.search&&sessionStorage.getItem('canopy:entered')!=='1';d.dataset.stage=intro?'intro':'app';}catch(e){d.dataset.stage='app';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STAGE_SCRIPT }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
