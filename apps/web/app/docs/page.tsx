import type { Metadata } from 'next';
import { HowItWorks } from '@/components/views/HowItWorks';

export const metadata: Metadata = { title: 'How it works' };

export default function Page() {
  return <HowItWorks />;
}
