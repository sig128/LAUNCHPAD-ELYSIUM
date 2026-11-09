import type { Metadata } from 'next';
import { AnalyticsView } from '@/components/views/InfoViews';

export const metadata: Metadata = { title: 'Analytics' };

export default function Page() {
  return <AnalyticsView />;
}
