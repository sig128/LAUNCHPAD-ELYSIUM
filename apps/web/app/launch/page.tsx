import type { Metadata } from 'next';
import { LaunchView } from '@/components/views/LaunchView';

export const metadata: Metadata = { title: 'Launch' };

export default function Page() {
  return <LaunchView />;
}
