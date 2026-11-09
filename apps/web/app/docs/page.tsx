import type { Metadata } from 'next';
import { DocsView } from '@/components/views/InfoViews';

export const metadata: Metadata = { title: 'How it works' };

export default function Page() {
  return <DocsView />;
}
